"""
signals.py

Stochastic, Non-Stationary RF Signal Environment.
Simulates a realistic, unpredictable electromagnetic spectrum with:
- Random frequency appearances anywhere in the 100-1000 MHz spectrum
- Random lifespans, bursts, and duty cycles
- Random frequency hopping (FHSS)
- Carrier frequency drift and multipath fading
- Sudden unpredictable high-power rogue anomalies/jammers
- Fluctuating RF noise floor

No hardcoded bands or deterministic scripts. Every scan step and tick
evolves stochastically.
"""

import random
import numpy as np
from typing import List, Dict, Any, Optional

from simulator.spectrum import (
    SPECTRUM_START_MHZ,
    SPECTRUM_END_MHZ,
    NOISE_FLOOR_DBM,
    NOISE_VARIATION_DBM,
)


class StochasticEmitter:
    """Represents a single active or hopping RF emitter in the spectrum."""

    def __init__(self, emitter_id: int):
        self.id = emitter_id
        self.emitter_type = random.choice([
            "hopping",     # Hops across unpredictable frequencies
            "burst",       # Short-lived transmission burst (IoT / Telemetry)
            "session",     # Multi-tick voice or broadband downlink
            "mobile",      # Drifting carrier with Doppler drift & fading
            "jammer",      # Occasional high-power rogue anomaly
        ])
        
        # Random center frequency anywhere across the valid spectrum
        self.center_frequency = round(
            random.uniform(SPECTRUM_START_MHZ + 15, SPECTRUM_END_MHZ - 15), 2
        )
        # Random bandwidth (5 to 25 MHz)
        self.bandwidth = round(random.uniform(6.0, 22.0), 1)

        # Signal strength & anomaly profile
        if self.emitter_type == "jammer" or random.random() < 0.08:
            self.strength = round(random.uniform(-25.0, -20.0), 1)  # High power anomaly
            self.is_anomaly = True
            self.remaining_ticks = random.randint(2, 6)
        else:
            self.strength = round(random.uniform(-58.0, -32.0), 1)  # Normal RF emission
            self.is_anomaly = False
            if self.emitter_type == "burst":
                self.remaining_ticks = random.randint(1, 4)
            elif self.emitter_type == "hopping":
                self.remaining_ticks = random.randint(3, 8)
            else:
                self.remaining_ticks = random.randint(6, 18)

        # Drift rate for mobile carriers (MHz / tick)
        self.drift_rate = round(random.uniform(-1.8, 1.8), 2) if self.emitter_type == "mobile" else 0.0
        self.activity_state = "active"

    def step(self):
        """Evolve this emitter over one simulation tick."""
        self.remaining_ticks -= 1

        # Mobile carrier frequency drift
        if self.emitter_type == "mobile":
            self.center_frequency += self.drift_rate
            # Bounce off band limits
            if self.center_frequency < SPECTRUM_START_MHZ + 10:
                self.center_frequency = SPECTRUM_START_MHZ + 10
                self.drift_rate = abs(self.drift_rate)
            elif self.center_frequency > SPECTRUM_END_MHZ - 10:
                self.center_frequency = SPECTRUM_END_MHZ - 10
                self.drift_rate = -abs(self.drift_rate)
            self.center_frequency = round(self.center_frequency, 2)

        # Hopping carrier random frequency jump
        elif self.emitter_type == "hopping" and random.random() < 0.40:
            # Hop to a completely random new frequency in the spectrum
            self.center_frequency = round(
                random.uniform(SPECTRUM_START_MHZ + 15, SPECTRUM_END_MHZ - 15), 2
            )

        # Multipath Rayleigh/Rician amplitude fading
        wobble = random.uniform(-2.5, 2.5)
        self.strength = round(max(-75.0, min(-18.0, self.strength + wobble)), 1)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "center_frequency": self.center_frequency,
            "bandwidth": self.bandwidth,
            "strength": self.strength,
            "activity_state": self.activity_state,
            "emitter_type": self.emitter_type,
            "is_anomaly": self.is_anomaly,
        }


class StochasticRFEnvironment:
    """
    Manages the living stochastic RF spectrum.
    Dynamically spawns, mutates, and extinguishes random emitters.
    """

    def __init__(self, min_emitters: int = 3, max_emitters: int = 6):
        self.min_emitters = min_emitters
        self.max_emitters = max_emitters
        self.next_id = 1
        self.emitters: List[StochasticEmitter] = []
        self.current_tick = 0
        self.reset()

    def reset(self):
        """Resets the environment with a freshly randomized emitter population."""
        self.emitters.clear()
        self.current_tick = 0
        num_initial = random.randint(self.min_emitters, self.max_emitters)
        for _ in range(num_initial):
            self._spawn_emitter()

    def _spawn_emitter(self):
        emitter = StochasticEmitter(self.next_id)
        self.next_id += 1
        self.emitters.append(emitter)

    def advance(self):
        """Advance the RF environment by one simulation tick."""
        self.current_tick += 1

        # Step existing emitters
        surviving = []
        for e in self.emitters:
            e.step()
            # If lifetime remains, keep emitter; otherwise allow natural expiration
            if e.remaining_ticks > 0:
                surviving.append(e)
            else:
                # With 30% chance, hopper/session changes frequency instead of dying
                if random.random() < 0.30:
                    e.center_frequency = round(
                        random.uniform(SPECTRUM_START_MHZ + 15, SPECTRUM_END_MHZ - 15), 2
                    )
                    e.remaining_ticks = random.randint(3, 8)
                    surviving.append(e)

        self.emitters = surviving

        # Maintain population: spawn new random emitters
        target_count = random.randint(self.min_emitters, self.max_emitters)
        while len(self.emitters) < target_count:
            self._spawn_emitter()

        # Occasional random transient burst anywhere in spectrum
        if random.random() < 0.25:
            self._spawn_emitter()

    def get_active_signals(self) -> List[Dict[str, Any]]:
        """Return dict representation of all active emitters."""
        return [e.to_dict() for e in self.emitters]


# Global singleton instance of the stochastic RF environment
rf_environment = StochasticRFEnvironment()


class DynamicSignalsProxy:
    """
    Acts as a dynamic list proxy for `SIGNALS` so that legacy code
    (e.g., `for signal in SIGNALS:`) automatically accesses the latest
    randomized emitters without hardcoding.
    """
    def __iter__(self):
        return iter(rf_environment.get_active_signals())

    def __len__(self):
        return len(rf_environment.get_active_signals())

    def __getitem__(self, idx):
        return rf_environment.get_active_signals()[idx]


# Drop-in replacement for legacy static SIGNALS list
SIGNALS = DynamicSignalsProxy()


def is_signal_currently_on(signal: Dict[str, Any]) -> bool:
    """Active emitters in the stochastic environment are currently transmitting."""
    return signal.get("activity_state", "active") == "active"


def advance_rf_environment():
    """Manually advance the stochastic environment by 1 tick."""
    rf_environment.advance()


def generate_spectrum_points(num_points: int = 400) -> List[Dict[str, float]]:
    """
    Build real-time data for the spectrum curve and rolling waterfall.
    Synthesizes active stochastic emitters with Gaussian bell curves
    plus ambient background noise.
    """
    frequencies = np.linspace(SPECTRUM_START_MHZ, SPECTRUM_END_MHZ, num_points)

    # Ambient fluctuating noise floor
    amplitudes = NOISE_FLOOR_DBM + np.random.uniform(
        -NOISE_VARIATION_DBM, NOISE_VARIATION_DBM, size=num_points
    )

    # Superimpose every active stochastic emitter
    active_signals = rf_environment.get_active_signals()
    for signal in active_signals:
        if not is_signal_currently_on(signal):
            continue

        center = signal["center_frequency"]
        bandwidth = signal["bandwidth"]
        peak_strength = signal["strength"]

        # Gaussian power spectral density curve
        spread = max(bandwidth / 2.5, 1.0)
        bump = (peak_strength - NOISE_FLOOR_DBM) * np.exp(
            -((frequencies - center) ** 2) / (2 * spread ** 2)
        )

        amplitudes = np.maximum(amplitudes, NOISE_FLOOR_DBM + bump)

    points = [
        {"frequency": round(float(f), 2), "amplitude": round(float(a), 2)}
        for f, a in zip(frequencies, amplitudes)
    ]
    return points
