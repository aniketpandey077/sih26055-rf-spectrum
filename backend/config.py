"""
config.py

Centralized configuration for the SIH26055 Intelligent RF Spectrum Scanner.
Contains all mathematical parameters, strategy presets, decay lambdas, and
database configurations.

NO magic numbers are allowed in algorithm implementations; everything is
referenced from this file.

Mathematical Formulations:
1. Temporal Freshness Decay:
   Freshness(b, dt) = exp(-FRESHNESS_LAMBDA * dt)
   where dt = current_tick - last_scanned_tick(b)

2. RF Anomaly Z-Score:
   Z(b) = (P_observed(b) - Mean_rolling(b)) / Std_rolling(b)
   Flagged as anomaly if Z(b) >= ANOMALY_Z_THRESHOLD (2.5 sigma)

3. Information Value (Algorithm 5):
   I(b) = 0.6 * Uncertainty(b) + 0.4 * (1.0 - Freshness(b))

4. Multi-Factor Composite Priority Score (Algorithm 9 & 12):
   Score(b) = w_act * P(act) + w_unc * U + w_anom * Z + w_info * I + w_fresh * (1 - Freshness)
              - Cooldown_Penalty(b)
"""

from pathlib import Path
from typing import Dict, List

# -----------------------------------------------------------------------------
# Base Directories & Storage Paths
# -----------------------------------------------------------------------------
BASE_DIR: Path = Path(__file__).resolve().parent
DB_PATH: Path = BASE_DIR / "rf_spectrum.db"
MODEL_DIR: Path = BASE_DIR / "models" / "saved"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------------------------------
# Physical RF Spectrum Environment Constraints
# -----------------------------------------------------------------------------
SPECTRUM_START_MHZ: float = 100.0   # Lower bound of simulated spectrum
SPECTRUM_END_MHZ: float = 1000.0    # Upper bound of simulated spectrum
NUMBER_OF_BANDS: int = 18           # Total channels (each (1000-100)/18 = 50 MHz wide)

# -----------------------------------------------------------------------------
# History & Temporal Model Parameters (Algorithm 3 & 4)
# -----------------------------------------------------------------------------
ROLLING_WINDOW_SIZE: int = 10       # Number of previous observations kept per band
FRESHNESS_LAMBDA: float = 0.08      # Exponential decay rate: Freshness = exp(-0.08 * dt)

# -----------------------------------------------------------------------------
# Anomaly & Change Detection Thresholds (Algorithm 6 & 7)
# -----------------------------------------------------------------------------
ANOMALY_Z_THRESHOLD: float = 2.5         # Standard deviations above rolling mean to flag threat
ANOMALY_POWER_SURGE_DB: float = 15.0     # Sudden power spike above noise floor (dB)
CHANGE_DETECTION_THRESHOLD: float = 0.40 # Rolling difference |mean_recent - mean_prior|

# -----------------------------------------------------------------------------
# Anti-Starvation & Cooldown Penalties (Algorithm 13)
# Prevents scanner from locking into the same high-power band repeatedly
# -----------------------------------------------------------------------------
COOLDOWN_PENALTIES: Dict[int, float] = {
    1: 0.25,  # Deducted if band was scanned 1 tick ago
    2: 0.10,  # Deducted if band was scanned 2 ticks ago
}

# -----------------------------------------------------------------------------
# Multi-Factor Priority Weights by Strategy State (Algorithm 9 & 12)
# Sum of weights in each preset equals 1.0
# -----------------------------------------------------------------------------
STRATEGY_WEIGHTS: Dict[str, Dict[str, float]] = {
    # Default balanced mode: balances exploitation with exploration & freshness
    "NORMAL": {
        "activity": 0.50,     # Exploitation of known transmissions
        "uncertainty": 0.15,  # Exploration of ambiguous bands
        "anomaly": 0.15,      # Response to RF threats
        "information": 0.10,  # Value of information gain
        "freshness": 0.10,    # Anti-staleness knowledge maintenance
    },
    # Triggered when an active RF anomaly / unauthorized transmission is detected
    "ANOMALY_DETECTED": {
        "activity": 0.15,
        "uncertainty": 0.10,
        "anomaly": 0.50,      # Heavily prioritize inspecting the anomaly channel
        "information": 0.15,
        "freshness": 0.10,
    },
    # Triggered when average prediction entropy is high across the spectrum
    "HIGH_UNCERTAINTY": {
        "activity": 0.20,
        "uncertainty": 0.40,  # Focus on unexplored / high-entropy bands
        "anomaly": 0.10,
        "information": 0.20,
        "freshness": 0.10,
    },
    # Triggered when multiple channels are simultaneously transmitting
    "HIGH_ACTIVITY": {
        "activity": 0.50,     # Exploit active channels to maximize detection hit rate
        "uncertainty": 0.15,
        "anomaly": 0.15,
        "information": 0.10,
        "freshness": 0.10,
    },
    # Triggered when transmission activity is very low across all channels
    "SPARSE_ACTIVITY": {
        "activity": 0.20,
        "uncertainty": 0.30,
        "anomaly": 0.10,
        "information": 0.25,  # Wide-spectrum discovery mode
        "freshness": 0.15,
    },
    # Algorithm 17: Triggered when expected emitters go deliberately silent (PRG >= 3.0)
    "COUNTER_DECEPTION": {
        "activity": 0.20,
        "uncertainty": 0.15,
        "anomaly": 0.15,
        "information": 0.20,
        "freshness": 0.30,    # Boosted staleness to counter radar evasion
    },
}

DEFAULT_STRATEGY: str = "NORMAL"

# -----------------------------------------------------------------------------
# Machine Learning Activity Predictors (Algorithm 2 & 14)
# -----------------------------------------------------------------------------
EVALUATION_MODELS: List[str] = ["logistic_regression", "random_forest", "xgboost"]
ACTIVE_ML_MODEL: str = "random_forest"  # Default active predictor
