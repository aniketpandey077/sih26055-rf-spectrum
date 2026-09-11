"""
decision_engine.py

This module contains the scanning strategy logic comparing:
1. TRADITIONAL / NORMAL SCAN (Sequential Sweep)
2. SMART / ADAPTIVE SCAN (Exploration vs. Exploitation Heuristic)

No black-box machine learning libraries (PyTorch/TensorFlow) are used here.
Instead, this implements standard algorithmic decision theory that is 100%
transparent, easily understood, and defensible in academic reviews.
"""

import csv
import io
from datetime import datetime
from typing import Dict, Any, List
from simulator.spectrum import generate_bands
from simulator.receiver import scan_band


class SpectrumDecisionEngine:
    """
    Manages the state of the scanner and compares two scanning strategies:
    
    1. NORMAL (Sequential Sweep):
       - Scans bands sequentially: 1 -> 2 -> 3 -> ... -> N -> 1
       - Spends equal time on dead bands with zero RF activity.
       
    2. SMART (Adaptive / Multi-Armed Bandit Heuristic):
       - Balances EXPLOITATION (monitoring bands known to have active/intermittent signals)
         and EXPLORATION (periodically checking unvisited bands for new transmissions).
       - Score(band) = ActivityWeight * DetectionRate + ExplorationBonus * (TimeSinceLastScan)
    """

    def __init__(self):
        self.bands = generate_bands()
        self.total_bands = len(self.bands)

        # Sequential scanner pointer
        self.sequential_index = 0

        # Memory of past scans for adaptive decision making:
        # For each band: {
        #    "scans_count": int,
        #    "hits_count": int,
        #    "last_scanned_tick": int,
        #    "last_signal_detected": bool
        # }
        self.current_tick = 0
        self.band_memory: Dict[int, Dict[str, Any]] = {
            b["id"]: {
                "scans_count": 0,
                "hits_count": 0,
                "last_scanned_tick": 0,
                "last_signal_detected": False,
            }
            for b in self.bands
        }

        # Comparative performance statistics
        self.stats = {
            "normal": {
                "total_scans": 0,
                "signal_hits": 0,
                "wasted_scans": 0,  # scans where nothing was found
                "hit_rate_pct": 0.0,
            },
            "smart": {
                "total_scans": 0,
                "signal_hits": 0,
                "wasted_scans": 0,
                "hit_rate_pct": 0.0,
            },
        }

        # Chronological audit log of scan events
        self.event_log: List[Dict[str, Any]] = []

    def reset(self):
        """Reset all state and metrics back to initial state."""
        self.sequential_index = 0
        self.current_tick = 0
        self.event_log = []
        for b in self.bands:
            self.band_memory[b["id"]] = {
                "scans_count": 0,
                "hits_count": 0,
                "last_scanned_tick": 0,
                "last_signal_detected": False,
            }
        self.stats["normal"] = {
            "total_scans": 0,
            "signal_hits": 0,
            "wasted_scans": 0,
            "hit_rate_pct": 0.0,
        }
        self.stats["smart"] = {
            "total_scans": 0,
            "signal_hits": 0,
            "wasted_scans": 0,
            "hit_rate_pct": 0.0,
        }

    def _next_band_sequential(self) -> int:
        """
        Traditional policy:
        Simply walks through bands one by one in numerical order.
        """
        band = self.bands[self.sequential_index]
        self.sequential_index = (self.sequential_index + 1) % self.total_bands
        return band["id"]

    def _next_band_smart(self) -> int:
        """
        Adaptive policy:
        Computes a priority score for each band based on:
          1. Exploitation: Bands with recent positive detections have high score.
          2. Exploration: Bands that have not been checked recently gain an
             urgency bonus so new signals won't be missed.
        """
        # If any band has never been scanned yet, prioritize visiting it first (initial discovery)
        unvisited = [
            b["id"] for b in self.bands if self.band_memory[b["id"]]["scans_count"] == 0
        ]
        if unvisited:
            return unvisited[0]

        best_band_id = self.bands[0]["id"]
        highest_score = -1.0

        # Weights: adjust how much we prioritize known signals vs exploring new ones
        W_EXPLOITATION = 4.0   # Weight for active / recent signal presence
        W_EXPLORATION = 1.2    # Weight for how long since band was last inspected

        for b in self.bands:
            bid = b["id"]
            mem = self.band_memory[bid]

            # 1. Exploitation score: recent hit rate + active flag
            historical_hit_rate = mem["hits_count"] / max(mem["scans_count"], 1)
            recent_hit_bonus = 1.0 if mem["last_signal_detected"] else 0.0
            exploitation_score = (historical_hit_rate * 0.5 + recent_hit_bonus * 0.5)

            # 2. Exploration score: ticks since last scan
            ticks_idle = self.current_tick - mem["last_scanned_tick"]
            # Normalized by total bands so older bands grow linearly
            exploration_score = min(ticks_idle / float(self.total_bands), 2.0)

            total_priority = (W_EXPLOITATION * exploitation_score) + (W_EXPLORATION * exploration_score)

            if total_priority > highest_score:
                highest_score = total_priority
                best_band_id = bid

        return best_band_id

    def step(self, mode: str = "smart") -> Dict[str, Any]:
        """
        Execute one scan step using the specified strategy.
        mode can be 'smart' or 'normal'.
        """
        self.current_tick += 1

        # 1. Decide which band to tune into
        if mode == "normal":
            target_band_id = self._next_band_sequential()
            strategy_name = "Sequential Sweep (Normal)"
        else:
            target_band_id = self._next_band_smart()
            strategy_name = "Adaptive Priority (Smart)"

        # 2. Perform the physical/simulated scan of that band
        scan_result = scan_band(target_band_id)
        if scan_result is None:
            raise ValueError(f"Invalid band {target_band_id}")

        # 3. Update memory of the band
        mem = self.band_memory[target_band_id]
        mem["scans_count"] += 1
        mem["last_scanned_tick"] = self.current_tick
        is_hit = scan_result["signal_detected"]
        mem["last_signal_detected"] = is_hit
        if is_hit:
            mem["hits_count"] += 1

        # 4. Update comparative statistics
        stats_bucket = self.stats["normal"] if mode == "normal" else self.stats["smart"]
        stats_bucket["total_scans"] += 1
        if is_hit:
            stats_bucket["signal_hits"] += 1
        else:
            stats_bucket["wasted_scans"] += 1

        if stats_bucket["total_scans"] > 0:
            stats_bucket["hit_rate_pct"] = round(
                (stats_bucket["signal_hits"] / stats_bucket["total_scans"]) * 100.0, 1
            )

        # 5. Record event in chronological audit log
        classification = scan_result.get("classification", {})
        event = {
            "id": len(self.event_log) + 1,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "tick": self.current_tick,
            "mode": mode,
            "band_id": target_band_id,
            "freq_range": f"{scan_result['frequency_start']} - {scan_result['frequency_end']} MHz",
            "signal_detected": is_hit,
            "signal_strength": scan_result["signal_strength"],
            "noise_level": scan_result["noise_level"],
            "signal_type": classification.get("signal_type", "Noise Floor"),
            "modulation": classification.get("modulation", "None"),
            "snr_db": classification.get("snr_db", 0.0),
            "threat_level": classification.get("threat_level", "CLEAR"),
            "is_anomaly": classification.get("is_anomaly", False),
        }
        self.event_log.insert(0, event)
        if len(self.event_log) > 200:
            self.event_log.pop()

        return {
            "mode": mode,
            "strategy": strategy_name,
            "target_band_id": target_band_id,
            "scan_result": scan_result,
            "stats": self.stats,
            "current_tick": self.current_tick,
            "event": event,
        }

    def get_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return the latest N events from the audit log."""
        return self.event_log[:limit]

    def export_csv(self) -> str:
        """Export the scan history log as a CSV string for reports."""
        output = io.StringIO()
        fieldnames = [
            "id",
            "timestamp",
            "tick",
            "mode",
            "band_id",
            "freq_range",
            "signal_detected",
            "signal_strength",
            "noise_level",
            "signal_type",
            "modulation",
            "snr_db",
            "threat_level",
            "is_anomaly",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for ev in reversed(self.event_log):
            writer.writerow(ev)
        return output.getvalue()


# Singleton engine instance
engine = SpectrumDecisionEngine()
