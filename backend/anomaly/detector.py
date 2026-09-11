"""
detector.py

Algorithm 6: Statistical Z-Score RF Anomaly Detection.
Maintains running baseline mean and variance of power (dBm) per band.
Computes Z-score = (P_t - mean) / std.
Generates normalized anomaly score in [0, 1] and flags anomalies exceeding threshold.
"""

import math
from typing import Dict, Any, Tuple
from config import (
    ANOMALY_Z_THRESHOLD,
    ANOMALY_POWER_SURGE_DB,
    NUMBER_OF_BANDS,
)


class AnomalyDetector:
    """
    Online Welford-algorithm statistical tracker for power distribution per band.
    Avoids storing infinite history while computing exact running mean and variance.
    """

    def __init__(self, num_bands: int = NUMBER_OF_BANDS):
        self.num_bands = num_bands
        # Welford state per band: count, mean, M2 (sum of squared differences)
        self.stats: Dict[int, Dict[str, float]] = {
            bid: {"count": 0.0, "mean": -90.0, "M2": 0.0}
            for bid in range(1, num_bands + 1)
        }

    def update(self, band_id: int, power_dbm: float):
        """Update running mean and variance using Welford's algorithm."""
        s = self.stats[band_id]
        s["count"] += 1.0
        delta = power_dbm - s["mean"]
        s["mean"] += delta / s["count"]
        delta2 = power_dbm - s["mean"]
        s["M2"] += delta * delta2

    def get_stats(self, band_id: int) -> Tuple[float, float]:
        """Return (mean, std_dev) for a band."""
        s = self.stats[band_id]
        if s["count"] < 2:
            return s["mean"], 2.0
        variance = s["M2"] / (s["count"] - 1.0)
        std_dev = math.sqrt(max(variance, 0.25))
        return s["mean"], std_dev

    def evaluate(self, band_id: int, current_power_dbm: float) -> Tuple[bool, float, float]:
        """
        Evaluate if current power observation is anomalous.
        Returns:
            is_anomaly: bool
            anomaly_score: float in [0.0, 1.0]
            z_score: float
        """
        mean, std = self.get_stats(band_id)
        effective_std = max(std, 1.0)
        z_score = (current_power_dbm - mean) / effective_std

        # Check conditions
        surge = current_power_dbm - mean
        is_z_anomaly = z_score >= ANOMALY_Z_THRESHOLD
        is_surge_anomaly = surge >= ANOMALY_POWER_SURGE_DB

        is_anomaly = bool(is_z_anomaly or is_surge_anomaly)

        # Normalize score into [0, 1] range
        # Z = 0 -> 0.0, Z = 2.5 -> ~0.625, Z >= 4.0 -> 1.0
        norm_score = max(0.0, min(1.0, z_score / 4.0))

        return is_anomaly, round(norm_score, 4), round(z_score, 2)

    def reset(self):
        """Reset all statistical baselines."""
        for bid in range(1, self.num_bands + 1):
            self.stats[bid] = {"count": 0.0, "mean": -90.0, "M2": 0.0}
