"""
strategy.py

Algorithm 11 & 12: Adaptive Strategy & Dynamic State Controller.
Monitors environmental condition indicators and transitions the scanner
into appropriate operational strategy states:
- NORMAL: Standard balanced multi-factor weights
- ANOMALY_DETECTED: Threat response mode (anomaly weight boosted to 0.50)
- HIGH_UNCERTAINTY: Exploration mode (uncertainty weight boosted to 0.40)
- HIGH_ACTIVITY: Exploitation mode (activity weight boosted to 0.50)
- SPARSE_ACTIVITY: Wide-spectrum discovery mode
"""

from typing import Dict, Any, List
from config import STRATEGY_WEIGHTS, DEFAULT_STRATEGY


class StrategyStateController:
    """
    Evaluates system metrics and determines the current active strategy state.
    """

    def __init__(self, initial_state: str = DEFAULT_STRATEGY):
        self.state = initial_state
        self.anomaly_cooldown_ticks = 0
        self.transition_log: List[Dict[str, Any]] = []

    def evaluate_state(
        self,
        current_tick: int,
        has_active_anomaly: bool,
        mean_uncertainty: float,
        recent_hit_rate: float,
        has_counter_deception: bool = False
    ) -> str:
        """
        Evaluate conditions and determine state transition.
        """
        old_state = self.state

        # 1. Counter-Deception (Algorithm 17 PRG) takes precedence when deception detected
        if has_counter_deception:
            self.state = "COUNTER_DECEPTION"
        # 2. Anomaly response takes highest threat priority
        elif has_active_anomaly:
            self.state = "ANOMALY_DETECTED"
            self.anomaly_cooldown_ticks = 4  # Stay in anomaly mode for at least 4 ticks
        elif self.anomaly_cooldown_ticks > 0:
            self.anomaly_cooldown_ticks -= 1
            self.state = "ANOMALY_DETECTED"
        # 2. High uncertainty / exploration
        elif mean_uncertainty >= 0.65:
            self.state = "HIGH_UNCERTAINTY"
        # 3. Dense activity environment
        elif recent_hit_rate >= 0.70:
            self.state = "HIGH_ACTIVITY"
        # 4. Sparse activity environment
        elif recent_hit_rate <= 0.15 and current_tick > 20:
            self.state = "SPARSE_ACTIVITY"
        # 5. Default normal balance
        else:
            self.state = "NORMAL"

        if old_state != self.state:
            self.transition_log.append({
                "tick": current_tick,
                "from_state": old_state,
                "to_state": self.state,
            })

        return self.state

    def get_weights(self) -> Dict[str, float]:
        """Return the priority weights dictionary for current state."""
        return STRATEGY_WEIGHTS.get(self.state, STRATEGY_WEIGHTS[DEFAULT_STRATEGY])

    def reset(self):
        """Reset state controller to initial state."""
        self.state = DEFAULT_STRATEGY
        self.anomaly_cooldown_ticks = 0
        self.transition_log.clear()
