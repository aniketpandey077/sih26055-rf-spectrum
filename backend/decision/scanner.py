"""
scanner.py

Full closed-loop scanner orchestrating all 16 algorithms:
1. Virtual RF Environment & Receiver Sampling
2. Strictly Zero-Leakage Feature Extraction
3. ML Activity Prediction (Logistic Regression / Random Forest / XGBoost)
4. Statistical Z-Score Anomaly Detection
5. Transmission Change Detection
6. Dynamic Strategy State Machine
7. Multi-Factor Priority Scoring & Anti-Starvation Cooldown
8. Transparent Explainable AI (XAI) Justification Generation
9. Persistent SQLite Storage & Performance Benchmarks
"""

import csv
import io
import random
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

from simulator.spectrum import generate_bands
from simulator.receiver import scan_band
from simulator.signals import advance_rf_environment, rf_environment
from features.extractor import TemporalHistory, FeatureExtractor
from anomaly.detector import AnomalyDetector
from anomaly.change_detector import ChangeDetector
from decision.scoring import calculate_band_priority
from decision.strategy import StrategyStateController
from decision.prg_engine import prg_engine
from models.model_manager import model_manager
from database.db import insert_scan_event, insert_xai_decision


class SpectrumScannerSystem:
    """
    Master closed-loop spectrum scanning controller.
    Supports 3 operational modes:
      - 'smart': Full 16-algorithm intelligent adaptive scanning
      - 'normal': Sequential round-robin sweep (1 -> 2 -> ... -> 18 -> 1)
      - 'random': Uniform random baseline
    """

    def __init__(self):
        self.bands = generate_bands()
        self.total_bands = len(self.bands)
        self.current_tick = 0

        # Pointers and history
        self.sequential_index = 0
        self.recent_scanned_bands: List[int] = []

        # Algorithmic modules
        self.temporal_history = TemporalHistory(num_bands=self.total_bands)
        self.anomaly_detector = AnomalyDetector(num_bands=self.total_bands)
        self.change_detector = ChangeDetector(num_bands=self.total_bands)
        self.strategy_controller = StrategyStateController()

        # Comparative performance statistics for all 3 modes
        self.stats = {
            "normal": {"total_scans": 0, "signal_hits": 0, "wasted_scans": 0, "hit_rate_pct": 0.0},
            "random": {"total_scans": 0, "signal_hits": 0, "wasted_scans": 0, "hit_rate_pct": 0.0},
            "smart": {"total_scans": 0, "signal_hits": 0, "wasted_scans": 0, "hit_rate_pct": 0.0},
        }

        # Chronological audit log buffer
        self.event_log: List[Dict[str, Any]] = []

        # Latest XAI decision rankings for all bands
        self.latest_rankings: List[Dict[str, Any]] = []

    def reset(self):
        """Reset all runtime memory, statistics, and detectors."""
        self.current_tick = 0
        self.sequential_index = 0
        self.recent_scanned_bands.clear()
        self.temporal_history.reset()
        self.anomaly_detector.reset()
        self.change_detector.reset()
        self.strategy_controller.reset()
        prg_engine.reset()
        rf_environment.reset()
        self.event_log.clear()
        self.latest_rankings.clear()

        for m in ["normal", "random", "smart"]:
            self.stats[m] = {
                "total_scans": 0,
                "signal_hits": 0,
                "wasted_scans": 0,
                "hit_rate_pct": 0.0,
            }

    def _next_band_sequential(self) -> int:
        """Baseline 1: Sequential sweep."""
        band = self.bands[self.sequential_index]
        self.sequential_index = (self.sequential_index + 1) % self.total_bands
        return band["id"]

    def _next_band_random(self) -> int:
        """Baseline 2: Uniform random sweep."""
        return random.choice(self.bands)["id"]

    def _evaluate_all_bands_smart(self) -> Tuple[int, List[Dict[str, Any]], Dict[str, Any]]:
        """
        Closed-loop evaluation:
        1. Extract zero-leakage feature matrix for all 18 bands
        2. Predict P(active) & uncertainty via active ML model
        3. Score each band with dynamic weights & cooldown penalties
        4. Select argmax priority band
        """
        # Feature extraction
        feature_matrix = FeatureExtractor.extract_matrix(
            self.bands, self.current_tick, self.temporal_history
        )

        # ML inference
        predictor = model_manager.get_active_predictor()
        probabilities, uncertainties = predictor.predict(feature_matrix)

        # Calculate anomaly scores per band
        anomaly_scores = []
        for b in self.bands:
            bid = b["id"]
            # Power observed in history (or default noise floor)
            last_p = self.temporal_history.lifetime_stats[bid]["last_power"]
            _, a_score, _ = self.anomaly_detector.evaluate(bid, last_p)
            anomaly_scores.append(a_score)

        # Strategy state update
        has_active_anomaly = any(s >= 0.65 for s in anomaly_scores)
        mean_uncertainty = float(np.mean(uncertainties))
        smart_hit_rate = (
            self.stats["smart"]["signal_hits"] / max(1, self.stats["smart"]["total_scans"])
        )

        has_counter_deception = (prg_engine.fsm_state == "COUNTER_DECEPTION")
        current_strategy = self.strategy_controller.evaluate_state(
            current_tick=self.current_tick,
            has_active_anomaly=has_active_anomaly,
            mean_uncertainty=mean_uncertainty,
            recent_hit_rate=smart_hit_rate,
            has_counter_deception=has_counter_deception
        )
        weights = self.strategy_controller.get_weights()

        # Multi-factor score evaluation for every band
        evaluated_bands: List[Dict[str, Any]] = []
        for idx, b in enumerate(self.bands):
            bid = b["id"]
            p_act = float(probabilities[idx])
            unc = float(uncertainties[idx])
            anom = float(anomaly_scores[idx])

            # If band has never been scanned, treat as complete unknown with max exploration incentive
            if self.temporal_history.lifetime_stats[bid]["scans_count"] == 0:
                unc = 1.0
                p_act = 0.5

            fresh = self.temporal_history.get_freshness(bid, self.current_tick)
            ticks_since = self.temporal_history.get_time_since_last_scan(bid, self.current_tick)

            band_eval = calculate_band_priority(
                band_id=bid,
                activity_prob=p_act,
                uncertainty=unc,
                anomaly_score=anom,
                freshness=fresh,
                weights=weights,
                ticks_since_last_scan=ticks_since,
                recent_scanned_bands=self.recent_scanned_bands
            )
            # Add frequency range for frontend display
            band_eval["frequency_start"] = b.get("start_frequency", b.get("frequency_start", 100.0))
            band_eval["frequency_end"] = b.get("end_frequency", b.get("frequency_end", 150.0))
            # Tie-break jitter (Algorithm 6: non-deterministic exploration when scores tie)
            band_eval["effective_rank_score"] = band_eval["priority_score"] + random.uniform(0.0001, 0.005)
            evaluated_bands.append(band_eval)

        # Algorithm 18: Tactical Burst Dwell Policy & PRG Cognitive Targeting
        # In Electronic Warfare, intercepting an active burst/packet requires dwelling
        # across the active transmission frame (up to 3 consecutive hits) before cooldown
        # forces release to prevent starvation.
        if self.recent_scanned_bands:
            last_bid = self.recent_scanned_bands[-1]
            last_stats = self.temporal_history.lifetime_stats[last_bid]
            if 1 <= last_stats["consecutive_hits"] < 4:
                for eb in evaluated_bands:
                    if eb["band_id"] == last_bid:
                        eb["priority_score"] += 2.5
                        eb["effective_rank_score"] += 2.5
                        eb["top_reason"] = f"Tactical Burst Dwell: Intercepting active transmission frame ({last_stats['consecutive_hits']}/3)."

        # Algorithm 17: PRG Suspicion prioritization
        for eb in evaluated_bands:
            bid = eb["band_id"]
            prg_score = prg_engine.bands[bid].prg_score
            if prg_score > 0:
                eb["priority_score"] += min(prg_score * 0.4, 1.2)
                eb["effective_rank_score"] += min(prg_score * 0.4, 1.2)
                if eb["priority_score"] > 1.5 and "Tactical Burst" not in eb["top_reason"]:
                    eb["top_reason"] = f"PRG Suspicious Silence: Tracking potential evasive hopper (PRG: {prg_score:.1f})."

        # Sort bands by effective priority score descending
        evaluated_bands.sort(key=lambda x: x["effective_rank_score"], reverse=True)
        self.latest_rankings = evaluated_bands

        # Selected band is argmax priority score
        best_band_id = evaluated_bands[0]["band_id"]

        meta = {
            "strategy_state": current_strategy,
            "weights": weights,
            "active_model": predictor.model_name,
            "top_reason": evaluated_bands[0]["top_reason"],
            "chosen_band_eval": evaluated_bands[0],
        }

        return best_band_id, evaluated_bands, meta

    def step(self, mode: str = "smart") -> Dict[str, Any]:
        """
        Execute one full scan cycle.
        mode can be 'smart', 'normal', or 'random'.
        """
        self.current_tick += 1
        advance_rf_environment()
        xai_meta: Optional[Dict[str, Any]] = None

        # 1. Decide target band
        if mode == "normal":
            target_band_id = self._next_band_sequential()
            strategy_name = "Sequential Sweep (Normal)"
            strategy_state = "SEQUENTIAL"
        elif mode == "random":
            target_band_id = self._next_band_random()
            strategy_name = "Uniform Random Baseline"
            strategy_state = "RANDOM"
        else:
            target_band_id, _, xai_meta = self._evaluate_all_bands_smart()
            strategy_name = f"Smart Adaptive ({xai_meta['strategy_state']})"
            strategy_state = xai_meta["strategy_state"]

        # Track recent scanned bands for anti-starvation cooldown
        self.recent_scanned_bands.append(target_band_id)
        if len(self.recent_scanned_bands) > 5:
            self.recent_scanned_bands.pop(0)

        # 2. Simulated receiver tunes into and samples chosen band
        scan_result = scan_band(target_band_id)
        if scan_result is None:
            raise ValueError(f"Invalid band {target_band_id}")

        is_hit = bool(scan_result["signal_detected"])
        noise_level = float(scan_result["noise_level"])
        raw_strength = scan_result["signal_strength"]
        power_dbm = float(raw_strength) if raw_strength is not None else noise_level

        # 3. Anomaly & Change Detection updates & PRG (Algorithm 17)
        self.anomaly_detector.update(target_band_id, power_dbm)
        is_anomaly, anomaly_score, z_score = self.anomaly_detector.evaluate(target_band_id, power_dbm)
        has_changed, change_delta, change_type = self.change_detector.record_and_evaluate(target_band_id, is_hit)
        prg_feedback = prg_engine.record_scan(target_band_id, is_hit, power_dbm)

        # 4. Update temporal history with the newly acquired observation
        self.temporal_history.record_observation(
            band_id=target_band_id,
            tick=self.current_tick,
            is_hit=is_hit,
            power_dbm=power_dbm,
            is_anomaly=is_anomaly
        )

        # 5. Update comparative statistics
        stats_bucket = self.stats[mode] if mode in self.stats else self.stats["smart"]
        stats_bucket["total_scans"] += 1
        if is_hit:
            stats_bucket["signal_hits"] += 1
        else:
            stats_bucket["wasted_scans"] += 1

        if stats_bucket["total_scans"] > 0:
            stats_bucket["hit_rate_pct"] = round(
                (stats_bucket["signal_hits"] / stats_bucket["total_scans"]) * 100.0, 1
            )

        # 6. Format event record
        classification = scan_result.get("classification", {})
        event = {
            "id": len(self.event_log) + 1,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "tick": self.current_tick,
            "mode": mode,
            "band_id": target_band_id,
            "freq_range": f"{scan_result['frequency_start']} - {scan_result['frequency_end']} MHz",
            "signal_detected": is_hit,
            "signal_strength": power_dbm,
            "noise_level": float(scan_result["noise_level"]),
            "signal_type": classification.get("signal_type", "Noise Floor"),
            "modulation": classification.get("modulation", "None"),
            "snr_db": float(classification.get("snr_db", 0.0)),
            "threat_level": classification.get("threat_level", "CLEAR"),
            "is_anomaly": is_anomaly,
            "strategy_state": strategy_state,
            "prg_score": prg_feedback["prg_score"],
            "suspicious_silence": prg_feedback["suspicious_silence"],
        }

        # 7. Persist to SQLite database
        scan_id = insert_scan_event(event, strategy_state=strategy_state)
        if xai_meta and "chosen_band_eval" in xai_meta:
            insert_xai_decision(
                scan_id=scan_id,
                tick=self.current_tick,
                band_id=target_band_id,
                factors=xai_meta["chosen_band_eval"],
                top_reason=xai_meta["top_reason"]
            )

        # 8. Append to memory log buffer
        self.event_log.insert(0, event)
        if len(self.event_log) > 200:
            self.event_log.pop()

        return {
            "mode": mode,
            "strategy": strategy_name,
            "strategy_state": strategy_state,
            "target_band_id": target_band_id,
            "scan_result": scan_result,
            "stats": self.stats,
            "current_tick": self.current_tick,
            "event": event,
            "xai": xai_meta,
            "rankings": self.latest_rankings[:5] if self.latest_rankings else [],
            "anomaly_info": {
                "is_anomaly": is_anomaly,
                "anomaly_score": anomaly_score,
                "z_score": z_score,
                "regime_change": change_type,
            },
            "prg": prg_feedback,
            "prg_status": prg_engine.get_status(),
        }

    def get_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return latest N audit log events."""
        return self.event_log[:limit]

    def get_rankings(self) -> List[Dict[str, Any]]:
        """Return priority rankings and breakdown across all bands."""
        return self.latest_rankings

    def export_csv(self) -> str:
        """Export history to CSV string."""
        output = io.StringIO()
        fieldnames = [
            "id", "timestamp", "tick", "mode", "band_id", "freq_range",
            "signal_detected", "signal_strength", "noise_level", "signal_type",
            "modulation", "snr_db", "threat_level", "is_anomaly", "strategy_state"
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for ev in reversed(self.event_log):
            writer.writerow(ev)
        return output.getvalue()


# Master singleton instance
scanner_system = SpectrumScannerSystem()
