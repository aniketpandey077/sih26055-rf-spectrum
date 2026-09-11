"""
spectrum.py

This file defines the VIRTUAL frequency range for our simulation and
splits it into bands. Nothing here talks to real hardware -- it is
just numbers (in MHz) that represent a pretend RF spectrum.

Think of it like a ruler from 100 MHz to 1000 MHz, cut into equal
pieces. Each piece is one "band" that our virtual receiver can scan.
"""

# ---------------------------------------------------------------
# CONFIGURATION
# Change these numbers to change the whole simulated spectrum.
# ---------------------------------------------------------------

SPECTRUM_START_MHZ = 100      # lowest simulated frequency
SPECTRUM_END_MHZ = 1000       # highest simulated frequency
NUMBER_OF_BANDS = 18          # how many equal-sized bands to create

# Amplitude settings used when we draw the spectrum graph.
NOISE_FLOOR_DBM = -90         # baseline "background noise" level
NOISE_VARIATION_DBM = 4       # how much the noise wobbles up/down


def get_band_width_mhz():
    """Each band is the same width: total range / number of bands."""
    total_range = SPECTRUM_END_MHZ - SPECTRUM_START_MHZ
    return total_range / NUMBER_OF_BANDS


def generate_bands():
    """
    Build the list of bands, e.g.:
    Band 1: 100-150 MHz, Band 2: 150-200 MHz, ...

    Returns a list of dictionaries so it's easy to turn into JSON
    for the frontend.
    """
    band_width = get_band_width_mhz()
    bands = []

    for i in range(NUMBER_OF_BANDS):
        band_id = i + 1
        start_freq = SPECTRUM_START_MHZ + (i * band_width)
        end_freq = start_freq + band_width

        bands.append({
            "id": band_id,
            "start_frequency": round(start_freq, 2),
            "end_frequency": round(end_freq, 2),
        })

    return bands
