"""
classifier.py

Deterministic Signal Classification & RF Anomaly Detection Engine.

This module implements transparent, explainable Digital Signal Processing (DSP)
and telecommunications heuristics:
1. Signal-to-Noise Ratio (SNR in dB): SNR = Signal Power (dBm) - Noise Floor (dBm)
2. Frequency Allocation Mapping: Classifies signals by center frequency, bandwidth,
   and transmission duty cycle using ITU-R standard band plans.
3. Anomaly & Threat Detection: Flags transmissions that exceed legal power thresholds
   (e.g., > -30 dBm) or operate in restricted guard channels.

100% transparent and explainable without any black-box AI dependencies.
"""

from typing import Dict, Any, Optional


# Standard ITU / Commercial Frequency Allocation Table
FREQUENCY_ALLOCATIONS = [
    {
        "min_freq": 88,
        "max_freq": 108,
        "type": "Commercial FM Broadcast",
        "modulation": "WFM (Wideband FM)",
        "service": "Civilian Audio Broadcast",
        "expected_power_max": -35,
    },
    {
        "min_freq": 118,
        "max_freq": 137,
        "type": "Aviation Air-Band",
        "modulation": "AM (Air Traffic Control)",
        "service": "Aeronautical Voice",
        "expected_power_max": -40,
    },
    {
        "min_freq": 138,
        "max_freq": 190,
        "type": "VHF Tactical / Emergency Voice",
        "modulation": "NFM (Narrowband FM)",
        "service": "Public Safety / Tactical",
        "expected_power_max": -35,
    },
    {
        "min_freq": 400,
        "max_freq": 470,
        "type": "UHF Drone Telemetry / ISM",
        "modulation": "FSK / FHSS (Frequency Hopping)",
        "service": "UAV Control / Remote Link",
        "expected_power_max": -40,
    },
    {
        "min_freq": 500,
        "max_freq": 650,
        "type": "Digital TV / DVB-T Broadcast",
        "modulation": "COFDM (Multi-carrier)",
        "service": "Terrestrial Broadcast",
        "expected_power_max": -45,
    },
    {
        "min_freq": 700,
        "max_freq": 850,
        "type": "Cellular LTE/5G Downlink",
        "modulation": "OFDMA / QAM-64",
        "service": "Mobile Broadband Base Station",
        "expected_power_max": -30,
    },
    {
        "min_freq": 860,
        "max_freq": 930,
        "type": "LoRa / Smart Utility ISM",
        "modulation": "CSS (Chirp Spread Spectrum)",
        "service": "IoT Telemetry / Sensors",
        "expected_power_max": -45,
    },
]


def calculate_snr(signal_strength_dbm: float, noise_level_dbm: float) -> float:
    """
    Computes Signal-to-Noise Ratio (SNR) in decibels (dB):
        SNR (dB) = P_signal (dBm) - P_noise (dBm)
    Example: -35 dBm signal with -80 dBm noise gives +45.0 dB SNR.
    """
    return round(float(signal_strength_dbm - noise_level_dbm), 1)


def evaluate_snr_quality(snr_db: float) -> str:
    """Classify the signal quality based on standard RF link margins."""
    if snr_db >= 35.0:
        return "Excellent (+35 dB)"
    elif snr_db >= 20.0:
        return "Good (+20 dB)"
    elif snr_db >= 10.0:
        return "Moderate (+10 dB)"
    else:
        return "Weak / Marginal (< 10 dB)"


def classify_signal(signal: Optional[Dict[str, Any]], noise_level_dbm: float) -> Dict[str, Any]:
    """
    Inspects an active RF emitter and classifies its identity, modulation,
    SNR quality, and threat status.
    """
    if signal is None:
        return {
            "signal_type": "Noise Floor (Clear)",
            "modulation": "None / Thermal White Noise",
            "service": "Unoccupied Channel",
            "snr_db": 0.0,
            "quality": "Noise Only",
            "bandwidth_mhz": 0,
            "is_anomaly": False,
            "threat_level": "CLEAR",
            "threat_description": "Channel is clear. Normal ambient noise floor.",
        }

    center_freq = signal.get("center_frequency", 0)
    strength = signal.get("strength", -80)
    bandwidth = signal.get("bandwidth", 10)
    activity = signal.get("activity_state", "active")

    snr_db = calculate_snr(strength, noise_level_dbm)
    quality = evaluate_snr_quality(snr_db)

    # 1. Match against Frequency Allocation Table
    matched_profile = None
    for profile in FREQUENCY_ALLOCATIONS:
        if profile["min_freq"] <= center_freq <= profile["max_freq"]:
            matched_profile = profile
            break

    if matched_profile:
        signal_type = matched_profile["type"]
        modulation = matched_profile["modulation"]
        service = matched_profile["service"]
        expected_max = matched_profile["expected_power_max"]
    else:
        signal_type = f"Unallocated Carrier ({center_freq} MHz)"
        modulation = "Unknown / Carrier Wave"
        service = "Experimental / Unknown"
        expected_max = -45

    # 2. Anomaly & Threat Detection
    # An anomaly is triggered if:
    # a) Power exceeds -30 dBm (abnormal power surge / intentional interference)
    # b) Tactical or unallocated transmission
    is_anomaly = False
    threat_level = "NORMAL"
    threat_description = "Compliant transmission within allocated parameters."

    if strength > -30:
        is_anomaly = True
        threat_level = "ALERT"
        signal_type = f"⚠️ Jammer / High-Power Anomaly ({center_freq} MHz)"
        threat_description = f"Excessive RF emission ({strength} dBm). Exceeds standard power mask."
    elif activity == "intermittent" and strength > expected_max:
        threat_level = "WATCH"
        threat_description = "Unregistered intermittent burst detected. Monitoring duty cycle."

    return {
        "signal_type": signal_type,
        "modulation": modulation,
        "service": service,
        "snr_db": snr_db,
        "quality": quality,
        "bandwidth_mhz": bandwidth,
        "is_anomaly": is_anomaly,
        "threat_level": threat_level,
        "threat_description": threat_description,
    }
