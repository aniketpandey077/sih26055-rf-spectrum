"""
receiver.py

This is our "virtual receiver". In a real RF system, a receiver would
tune to a frequency band and measure what's actually there. Here, we
simulate that by looking up what our virtual signals are doing inside
the requested band, and making up a noise reading.

The receiver does NOT know the whole spectrum ahead of time -- it
only reports on the one band it was asked to scan, via GET /scan/{band_id}.
"""

import random

from simulator.spectrum import generate_bands, NOISE_FLOOR_DBM, NOISE_VARIATION_DBM
from simulator.signals import SIGNALS, is_signal_currently_on
from simulator.classifier import classify_signal


def find_band(band_id):
    """Look up a band's frequency range by its id. Returns None if invalid."""
    for band in generate_bands():
        if band["id"] == band_id:
            return band
    return None


def scan_band(band_id):
    """
    Simulate scanning one band.

    Returns a result dictionary, or None if the band_id doesn't exist
    (the API layer turns that into a 404).
    """
    band = find_band(band_id)
    if band is None:
        return None

    start = band["start_frequency"]
    end = band["end_frequency"]

    # Find any signal whose center frequency falls inside this band
    # AND is currently switched on.
    strongest_signal = None
    for signal in SIGNALS:
        center = signal["center_frequency"]
        if start <= center <= end and is_signal_currently_on(signal):
            if (
                strongest_signal is None
                or signal["strength"] > strongest_signal["strength"]
            ):
                strongest_signal = signal

    # Made-up noise reading for this scan, wobbling around the noise floor.
    noise_level = round(
        NOISE_FLOOR_DBM + random.uniform(-NOISE_VARIATION_DBM, NOISE_VARIATION_DBM), 2
    )

    signal_detected = strongest_signal is not None
    strongest_signal_strength = strongest_signal["strength"] if strongest_signal else None

    # Deterministic signal classification & threat detection
    classification = classify_signal(strongest_signal, noise_level)

    return {
        "band_id": band_id,
        "frequency_start": start,
        "frequency_end": end,
        "signal_detected": signal_detected,
        "signal_strength": strongest_signal_strength,
        "noise_level": noise_level,
        "classification": classification,
    }

