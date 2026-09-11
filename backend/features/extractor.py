"""
extractor.py

Feature Extraction & Temporal History Engine for RF Spectrum Scanning.
Strictly adheres to ZERO DATA LEAKAGE:
All features at decision tick t are calculated strictly using observations
recorded up to tick t-1. Ground-truth state of tick t is never revealed.
"""

from collections import deque
import math
from typing import Dict, Any, List, Optional
import numpy as np
from config import ROLLING_WINDOW_SIZE, FRESHNESS_LAMBDA, NUMBER_OF_BANDS


FEATURE_NAMES = [
    "band_center_freq_mhz",
    "band_width_mhz",
    "time_since_last_scan",
    "historical_hit_rate",
    "recent_hit_rate",
    "mean_signal_power",
    "activity_gradient",
]


class TemporalHistory:
    """
    Tracks observation history for each RF band across scan ticks.
    Maintains a rolling window of recent observations to compute dynamic features.
    """

    def __init__(self, num_bands: int = NUMBER_OF_BANDS, window_size: int = ROLLING_WINDOW_SIZE):
        self.num_bands = num_bands
        self.window_size = window_size
        self.current_tick = 0
        
        # Per-band rolling records: list of dicts {tick, is_hit, power_dbm, is_anomaly}
        self.history: Dict[int, deque] = {
            bid: deque(maxlen=window_size) for bid in range(1, num_bands + 1)
        }

        # Aggregate lifetime counters
        self.lifetime_stats: Dict[int, Dict[str, Any]] = {
            bid: {
                "scans_count": 0,
                "hits_count": 0,
                "last_scanned_tick": 0,
                "total_power_sum": 0.0,
                "power_count": 0,
                "last_power": -100.0,
                "consecutive_hits": 0,
            }
            for bid in range(1, num_bands + 1)
        }

    def record_observation(self, band_id: int, tick: int, is_hit: bool,
                           power_dbm: float, is_anomaly: bool = False):
        """Record an observation after a band has been scanned at tick."""
        self.current_tick = max(self.current_tick, tick)
        stats = self.lifetime_stats[band_id]
        stats["scans_count"] += 1
        stats["last_scanned_tick"] = tick
        stats["total_power_sum"] += power_dbm
        stats["power_count"] += 1
        stats["last_power"] = power_dbm

        if is_hit:
            stats["hits_count"] += 1
            stats["consecutive_hits"] += 1
        else:
            stats["consecutive_hits"] = 0

        self.history[band_id].append({
            "tick": tick,
            "is_hit": 1 if is_hit else 0,
            "power_dbm": power_dbm,
            "is_anomaly": 1 if is_anomaly else 0,
        })

    def get_time_since_last_scan(self, band_id: int, current_tick: int) -> int:
        """Ticks elapsed since band was last scanned."""
        last_tick = self.lifetime_stats[band_id]["last_scanned_tick"]
        if last_tick == 0:
            # Band has never been scanned; maximum staleness
            return max(50, current_tick + 20)
        return max(0, current_tick - last_tick)

    def get_historical_hit_rate(self, band_id: int) -> float:
        """Overall lifetime hit rate (hits / total scans)."""
        stats = self.lifetime_stats[band_id]
        if stats["scans_count"] == 0:
            return 0.0
        return stats["hits_count"] / float(stats["scans_count"])

    def get_recent_hit_rate(self, band_id: int) -> float:
        """Fraction of hits in the rolling window."""
        window = self.history[band_id]
        if not window:
            return 0.0
        return sum(r["is_hit"] for r in window) / float(len(window))

    def get_mean_signal_power(self, band_id: int) -> float:
        """Mean power across all scans of this band."""
        stats = self.lifetime_stats[band_id]
        if stats["power_count"] == 0:
            return -100.0
        return round(stats["total_power_sum"] / float(stats["power_count"]), 2)

    def get_activity_gradient(self, band_id: int) -> float:
        """
        Velocity / Trend of RF activity:
        Difference between recent half vs prior half of the rolling window.
        """
        window = list(self.history[band_id])
        if len(window) < 4:
            return 0.0
        
        mid = len(window) // 2
        prior_half = window[:mid]
        recent_half = window[mid:]

        prior_rate = sum(r["is_hit"] for r in prior_half) / float(len(prior_half))
        recent_rate = sum(r["is_hit"] for r in recent_half) / float(len(recent_half))

        return round(recent_rate - prior_rate, 4)

    def get_freshness(self, band_id: int, current_tick: int) -> float:
        """
        Knowledge Freshness / Decay (Algorithm 4):
        Freshness(b, dt) = exp(-lambda * dt)
        Decays from 1.0 (just scanned) toward 0.0 (very stale).
        Never scanned band has freshness 0.0 (100% stale).
        """
        if self.lifetime_stats[band_id]["scans_count"] == 0:
            return 0.0
        dt = self.get_time_since_last_scan(band_id, current_tick)
        return float(math.exp(-FRESHNESS_LAMBDA * dt))

    def reset(self):
        """Reset history to initial blank state."""
        self.current_tick = 0
        for bid in range(1, self.num_bands + 1):
            self.history[bid].clear()
            self.lifetime_stats[bid] = {
                "scans_count": 0,
                "hits_count": 0,
                "last_scanned_tick": 0,
                "total_power_sum": 0.0,
                "power_count": 0,
                "last_power": -100.0,
                "consecutive_hits": 0,
            }


class FeatureExtractor:
    """
    Extracts the strictly zero-leakage feature vector for any band
    at the moment a decision is being evaluated.
    """

    @staticmethod
    def extract_vector(band: Dict[str, Any], current_tick: int,
                       history: TemporalHistory) -> np.ndarray:
        """
        Extract feature vector for one band.
        Order matches FEATURE_NAMES.
        """
        bid = band["id"]
        f_start = band.get("start_frequency", band.get("frequency_start", 100.0))
        f_end = band.get("end_frequency", band.get("frequency_end", 150.0))
        center_freq = (f_start + f_end) / 2.0
        bandwidth = f_end - f_start

        time_since = float(history.get_time_since_last_scan(bid, current_tick))
        hist_hit = history.get_historical_hit_rate(bid)
        recent_hit = history.get_recent_hit_rate(bid)
        mean_power = history.get_mean_signal_power(bid)
        gradient = history.get_activity_gradient(bid)

        return np.array([
            center_freq,
            bandwidth,
            time_since,
            hist_hit,
            recent_hit,
            mean_power,
            gradient
        ], dtype=np.float32)

    @staticmethod
    def extract_matrix(bands: List[Dict[str, Any]], current_tick: int,
                       history: TemporalHistory) -> np.ndarray:
        """
        Extract feature matrix for all bands. Shape: (num_bands, num_features).
        """
        rows = [
            FeatureExtractor.extract_vector(b, current_tick, history)
            for b in bands
        ]
        return np.vstack(rows)
