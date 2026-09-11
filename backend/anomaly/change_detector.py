"""
change_detector.py

Algorithm 7: Transmission State Change Detector.
Detects sudden shifts in transmission regime (e.g. transmitter turning ON or OFF)
by comparing rolling mean of recent observations vs. prior observations.
"""

from typing import Dict, Any, Tuple
from collections import deque
from config import CHANGE_DETECTION_THRESHOLD, NUMBER_OF_BANDS


class ChangeDetector:
    """
    Monitors recent vs prior sliding windows of binary detections to identify
    activity state transitions.
    """

    def __init__(self, num_bands: int = NUMBER_OF_BANDS, window_size: int = 10):
        self.num_bands = num_bands
        self.window_size = window_size
        self.windows: Dict[int, deque] = {
            bid: deque(maxlen=window_size) for bid in range(1, num_bands + 1)
        }

    def record_and_evaluate(self, band_id: int, is_hit: bool) -> Tuple[bool, float, str]:
        """
        Record new detection event and check for regime change.
        Returns:
            has_changed: bool
            delta: float in [0.0, 1.0]
            change_type: 'ACTIVATED' | 'DEACTIVATED' | 'STABLE'
        """
        w = self.windows[band_id]
        w.append(1 if is_hit else 0)

        if len(w) < 6:
            return False, 0.0, "STABLE"

        mid = len(w) // 2
        prior = list(w)[:mid]
        recent = list(w)[mid:]

        prior_mean = sum(prior) / float(len(prior))
        recent_mean = sum(recent) / float(len(recent))
        delta = recent_mean - prior_mean

        abs_delta = abs(delta)
        has_changed = abs_delta >= CHANGE_DETECTION_THRESHOLD

        if has_changed:
            change_type = "ACTIVATED" if delta > 0 else "DEACTIVATED"
        else:
            change_type = "STABLE"

        return has_changed, round(abs_delta, 3), change_type

    def reset(self):
        """Clear all sliding windows."""
        for bid in range(1, self.num_bands + 1):
            self.windows[bid].clear()
