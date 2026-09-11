"""
scoring.py

Algorithm 8, 9, 10 & 13: Multi-Factor Priority Scoring & Explainable AI (XAI).
Calculates priority scores across all bands by balancing:
1. Activity Probability P(active)  [Exploitation]
2. Uncertainty 4*p*(1-p)            [Exploration]
3. Anomaly Score                   [Threat Response]
4. Information Value               [Knowledge Gain]
5. Freshness / Staleness Score     [Anti-Staleness]
minus Cooldown Penalty             [Anti-Starvation]
"""

from typing import Dict, Any, List, Tuple
from config import COOLDOWN_PENALTIES


def compute_information_value(uncertainty: float, freshness: float) -> float:
    """
    Algorithm 5: Information Value Estimation
    I(b) = 0.6 * Uncertainty(p) + 0.4 * (1.0 - Freshness(b))
    """
    staleness = max(0.0, 1.0 - freshness)
    return round(0.6 * uncertainty + 0.4 * staleness, 4)


def calculate_band_priority(
    band_id: int,
    activity_prob: float,
    uncertainty: float,
    anomaly_score: float,
    freshness: float,
    weights: Dict[str, float],
    ticks_since_last_scan: int,
    recent_scanned_bands: List[int]
) -> Dict[str, Any]:
    """
    Computes composite multi-factor score and anti-starvation penalty.
    Returns full factor breakdown and human-readable XAI justification.
    """
    staleness_score = round(max(0.0, 1.0 - freshness), 4)
    info_score = compute_information_value(uncertainty, freshness)

    # Raw multi-factor weighted sum
    raw_score = (
        weights["activity"] * activity_prob +
        weights["uncertainty"] * uncertainty +
        weights["anomaly"] * anomaly_score +
        weights["information"] * info_score +
        weights["freshness"] * staleness_score
    )

    # Algorithm 13: Anti-Starvation & Cooldown Penalty
    # If band was scanned 1 tick ago, apply strong cooldown (e.g. 0.60)
    # If scanned 2 ticks ago, apply moderate cooldown (e.g. 0.30)
    cooldown_penalty = 0.0
    if recent_scanned_bands:
        if recent_scanned_bands[-1] == band_id:
            cooldown_penalty = COOLDOWN_PENALTIES.get(1, 0.60)
        elif len(recent_scanned_bands) >= 2 and recent_scanned_bands[-2] == band_id:
            cooldown_penalty = COOLDOWN_PENALTIES.get(2, 0.30)

    final_score = max(0.0, round(raw_score - cooldown_penalty, 4))

    # Determine dominant contributing factor for Explainable AI (XAI)
    contributions = {
        "Activity": weights["activity"] * activity_prob,
        "Uncertainty": weights["uncertainty"] * uncertainty,
        "Anomaly": weights["anomaly"] * anomaly_score,
        "Information Gain": weights["information"] * info_score,
        "Staleness Refresh": weights["freshness"] * staleness_score,
    }

    dominant_factor = max(contributions.items(), key=lambda x: x[1])[0]

    # Generate natural language reason
    if cooldown_penalty > 0:
        top_reason = f"Cooldown penalty (-{cooldown_penalty:.2f}) applied from recent scan; {dominant_factor} remains dominant."
    elif anomaly_score > 0.4:
        top_reason = f"High RF anomaly surge detected (score: {anomaly_score:.2f}). Priority investigation."
    elif activity_prob > 0.75:
        top_reason = f"Strong predicted carrier transmission ({activity_prob*100:.1f}% prob). Exploitation focus."
    elif staleness_score > 0.70:
        top_reason = f"Knowledge staleness ({staleness_score*100:.1f}%). Band idle for {ticks_since_last_scan} ticks."
    elif uncertainty > 0.70:
        top_reason = f"High prediction ambiguity / entropy ({uncertainty*100:.1f}%). Exploration needed."
    else:
        top_reason = f"Balanced score driven primarily by {dominant_factor}."

    return {
        "band_id": band_id,
        "activity_prob": round(activity_prob, 4),
        "uncertainty_score": round(uncertainty, 4),
        "anomaly_score": round(anomaly_score, 4),
        "info_score": round(info_score, 4),
        "freshness_score": round(freshness, 4),
        "staleness_score": round(staleness_score, 4),
        "raw_score": round(raw_score, 4),
        "cooldown_penalty": round(cooldown_penalty, 4),
        "priority_score": final_score,
        "dominant_factor": dominant_factor,
        "top_reason": top_reason,
    }
