"""
prg_engine.py

Algorithm 17: Prediction-Reality Gap (PRG) Engine — "Silence is Signal" (COGNIWAR).
Reacts not just to signals found, but to signals EXPECTED and NOT FOUND.

Architectural Concept:
In hostile Electronic Warfare (EW), an adversary radar or communications node that
transmits consistently and then suddenly ceases transmissions is often engaging in
tactical radar silence, frequency hopping, or deception. Conventional scanners only
react to RF power peaks (exploiting active signals). The PRG Engine detects the *gap*
between expected carrier presence and actual silence, elevating surveillance priority
on suspiciously silent bands.

Core Mathematical Principles:
1. Laplace-Smoothed Empirical Hit-Rate Predictor:
   P(active) = (total_hits + 1) / (total_scans + 2)
   - Cold-start safety: Defaults to 0.50 for the first 3 observations.
   - Strict Zero-Leakage: Prediction is read BEFORE the current scan result is committed.

2. Information Entropy Uncertainty:
   U = 4 * p * (1 - p)
   - Parabolic profile peaking at U = 1.0 when p = 0.50 (maximum ambiguity).
   - Falls symmetrically to 0.0 at absolute certainty (p = 0.0 or p = 1.0).

3. Suspicious Silence Trigger:
   Flagged if: (signal_detected == False) AND (P(active) >= PREDICTION_THRESHOLD)
   - When triggered: prg_score increments by +1.0.
   - When active: prg_score decays gradually: prg_score = max(0.0, prg_score - 0.5).

4. Counter-Deception Finite State Machine (FSM):
   FSM State shifts to COUNTER_DECEPTION if max(prg_score across all bands) >= PRG_THRESHOLD (3.0).
   In Counter-Deception mode, Staleness weight multiplier (2.5x) and PRG multiplier (1.5x)
   are applied to prioritize unmasking hidden emitters.
"""

from typing import Dict, Any, List, Optional


# Algorithm 17 Mathematical Constants
PREDICTION_THRESHOLD: float = 0.65   # Expected hit rate above which silence is deemed suspicious
PRG_THRESHOLD: float = 3.0          # Cumulative suspicion threshold triggering Counter-Deception
NUMBER_OF_BANDS: int = 18           # Total frequency bands in spectrum

# Base Decision Weights for PRG Multi-Factor Scoring
WEIGHT_P_ACTIVE: float = 0.50
WEIGHT_UNCERTAINTY: float = 0.20
WEIGHT_PRG: float = 0.40
WEIGHT_STALENESS: float = 0.30

# Anti-Starvation Cooldown Penalties
COOLDOWN_PENALTIES: Dict[int, float] = {
    1: -0.25,  # Scanned 1 tick ago
    2: -0.10,  # Scanned 2 ticks ago
}


class BandMemory:
    """
    State tracking memory for an individual RF spectrum channel under Algorithm 17.
    Maintains empirical hit history, suspicion scores, and zero-leakage predictors.
    """

    def __init__(self, band_id: int):
        self.band_id: int = band_id
        self.prg_score: float = 0.0
        self.total_scans: int = 0
        self.total_hits: int = 0
        self.last_scanned_tick: int = 0
        self.scan_history: List[bool] = []
        self.prg_history: List[float] = []

    @property
    def p_active(self) -> float:
        """
        Laplace-smoothed empirical hit-rate predictor:
        P(active) = (hits + 1) / (scans + 2)
        Defaults to 0.5 for the first 3 scans to prevent premature bias (cold-start).
        """
        if self.total_scans < 3:
            return 0.5
        return (self.total_hits + 1.0) / (self.total_scans + 2.0)

    @property
    def uncertainty(self) -> float:
        """
        Entropy-based prediction uncertainty:
        U = 4 * p * (1 - p)
        Normalized to [0.0, 1.0], peaking at p = 0.5.
        """
        p = self.p_active
        return 4.0 * p * (1.0 - p)

    def to_dict(self) -> Dict[str, Any]:
        """Serializes band memory state into JSON-compatible dictionary."""
        return {
            "band_id": self.band_id,
            "prg_score": round(self.prg_score, 2),
            "total_scans": self.total_scans,
            "total_hits": self.total_hits,
            "p_active": round(self.p_active, 4),
            "uncertainty": round(self.uncertainty, 4),
            "last_scanned_tick": self.last_scanned_tick,
            "is_suspicious": self.prg_score > 0.0,
        }


class PRGEngine:
    """
    Algorithm 17: Prediction-Reality Gap (PRG) Core Decision & FSM Controller.
    """

    def __init__(self, num_bands: int = NUMBER_OF_BANDS):
        self.num_bands: int = num_bands
        self.current_tick: int = 0
        self.fsm_state: str = "NORMAL"  # "NORMAL" | "COUNTER_DECEPTION"
        self.bands: Dict[int, BandMemory] = {
            bid: BandMemory(bid) for bid in range(1, num_bands + 1)
        }
        self.total_suspicious_silences: int = 0
        self.recent_scanned_bands: List[int] = []
        self.audit_log: List[Dict[str, Any]] = []

    def reset(self):
        """Wipes all suspicion scores, counters, and history for a new session."""
        self.current_tick = 0
        self.fsm_state = "NORMAL"
        self.total_suspicious_silences = 0
        self.recent_scanned_bands.clear()
        self.audit_log.clear()
        self.bands = {bid: BandMemory(bid) for bid in range(1, self.num_bands + 1)}

    def get_weights(self) -> Dict[str, float]:
        """
        Returns dynamic multi-factor priority weights based on FSM state:
        In COUNTER_DECEPTION:
          - Staleness weight is boosted by 2.5x (0.30 -> 0.75)
          - PRG suspicion weight is boosted by 1.5x (0.40 -> 0.60)
        """
        if self.fsm_state == "COUNTER_DECEPTION":
            return {
                "p_active": WEIGHT_P_ACTIVE,
                "uncertainty": WEIGHT_UNCERTAINTY,
                "prg": WEIGHT_PRG * 1.5,
                "staleness": WEIGHT_STALENESS * 2.5,
            }
        return {
            "p_active": WEIGHT_P_ACTIVE,
            "uncertainty": WEIGHT_UNCERTAINTY,
            "prg": WEIGHT_PRG,
            "staleness": WEIGHT_STALENESS,
        }

    def calculate_band_score(self, band_id: int) -> Dict[str, Any]:
        """
        Computes composite priority score for a candidate band using Algorithm 17 factors:
        Score = w_p * P(act) + w_u * U + w_prg * PRG_norm + w_stale * Staleness - Cooldown
        """
        b = self.bands[band_id]
        weights = self.get_weights()

        p_act = b.p_active
        unc = b.uncertainty
        prg_norm = min(b.prg_score / PRG_THRESHOLD, 1.5)

        # Staleness: normalized ticks since last observation
        dt = self.current_tick - b.last_scanned_tick
        staleness = min(dt / 15.0, 1.0) if self.current_tick > 0 else 1.0

        # Anti-Starvation cooldown penalty
        cooldown = 0.0
        if len(self.recent_scanned_bands) >= 1 and self.recent_scanned_bands[-1] == band_id:
            cooldown = COOLDOWN_PENALTIES.get(1, -0.25)
        elif len(self.recent_scanned_bands) >= 2 and self.recent_scanned_bands[-2] == band_id:
            cooldown = COOLDOWN_PENALTIES.get(2, -0.10)

        raw_score = (
            weights["p_active"] * p_act
            + weights["uncertainty"] * unc
            + weights["prg"] * prg_norm
            + weights["staleness"] * staleness
            + cooldown
        )

        final_score = max(0.0, round(raw_score, 4))

        return {
            "band_id": band_id,
            "score": final_score,
            "p_active": round(p_act, 4),
            "uncertainty": round(unc, 4),
            "prg_score": round(b.prg_score, 2),
            "prg_norm": round(prg_norm, 4),
            "staleness": round(staleness, 4),
            "cooldown": cooldown,
            "total_scans": b.total_scans,
            "total_hits": b.total_hits,
            "is_suspicious": b.prg_score > 0.0,
        }

    def get_recommendation(self) -> Dict[str, Any]:
        """
        Selects highest-scoring band across all 18 channels with transparent reasoning.
        """
        all_evals = [self.calculate_band_score(bid) for bid in range(1, self.num_bands + 1)]
        all_evals.sort(key=lambda x: (x["score"], -x["band_id"]), reverse=True)
        recommended = all_evals[0]

        return {
            "recommended_band_id": recommended["band_id"],
            "recommended_score": recommended["score"],
            "fsm_state": self.fsm_state,
            "weights": self.get_weights(),
            "breakdown": all_evals,
            "suspicious_bands": [b.band_id for b in self.bands.values() if b.prg_score > 0.0],
            "current_tick": self.current_tick,
        }

    def record_scan(
        self,
        band_id: int,
        signal_detected: bool,
        signal_strength: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        PRG Core Logic per tick:
        1. Strict zero-leakage read of P(active) and uncertainty before updating.
        2. Evaluate Suspicious Silence: (signal_detected == False) and (P(active) >= 0.65).
        3. If suspicious: prg_score += 1.0; else if active: decay prg_score.
        4. Check FSM transition: max(prg_scores) >= 3.0 -> COUNTER_DECEPTION.
        """
        self.current_tick += 1
        b = self.bands[band_id]

        # 1. Zero-leakage read BEFORE updating memory
        p_predicted = b.p_active
        u_predicted = b.uncertainty

        # 2. Suspicious silence condition:
        # A band that was expected to be active goes silent -> triggers suspicion.
        # Once verified silent by an inspection probe, suspicion decays to prevent deadlock.
        is_suspicious_silence = False
        prg_delta = 0.0
        if not signal_detected:
            if b.prg_score == 0.0 and p_predicted >= PREDICTION_THRESHOLD:
                is_suspicious_silence = True
                prg_delta = 1.5
                b.prg_score += 1.5
                self.total_suspicious_silences += 1
            elif b.prg_score > 0.0:
                # Confirmed vacant upon inspection probe: decay suspicion so scanner can hunt next band
                prg_delta = -1.0
                b.prg_score = max(0.0, round(b.prg_score - 1.0, 2))
        else:
            # Signal resumed or active: decay suspicion
            if b.prg_score > 0.0:
                prg_delta = -0.75
                b.prg_score = max(0.0, round(b.prg_score - 0.75, 2))

        # 3. Update empirical history
        b.total_scans += 1
        if signal_detected:
            b.total_hits += 1
        b.last_scanned_tick = self.current_tick
        b.scan_history.append(signal_detected)
        b.prg_history.append(b.prg_score)

        self.recent_scanned_bands.append(band_id)
        if len(self.recent_scanned_bands) > 5:
            self.recent_scanned_bands.pop(0)

        # 4. FSM State Transition
        old_fsm_state = self.fsm_state
        max_prg = max(band.prg_score for band in self.bands.values())
        if max_prg >= PRG_THRESHOLD:
            self.fsm_state = "COUNTER_DECEPTION"
        elif max_prg < 1.0:
            self.fsm_state = "NORMAL"

        # Generate Explainable Natural Language Justification
        transition_str = ""
        if old_fsm_state != self.fsm_state:
            transition_str = f" [FSM SHIFT: {old_fsm_state} -> {self.fsm_state}]"

        if is_suspicious_silence:
            justification = (
                f"SUSPICIOUS SILENCE: Band #{band_id} was silent despite expected activity "
                f"(P(active)={p_predicted*100:.0f}% >= {PREDICTION_THRESHOLD*100:.0f}% threshold). "
                f"PRG suspicion increased to {b.prg_score:.1f}/3.0.{transition_str}"
            )
        elif signal_detected:
            justification = (
                f"EMISSION CONFIRMED: Band #{band_id} active as expected "
                f"(P(active)={p_predicted*100:.0f}%, hits={b.total_hits}/{b.total_scans}).{transition_str}"
            )
        else:
            justification = (
                f"CHANNEL CLEAR: Band #{band_id} silent, aligning with prediction "
                f"(P(active)={p_predicted*100:.0f}%).{transition_str}"
            )

        event = {
            "tick": self.current_tick,
            "band_id": band_id,
            "p_predicted": round(p_predicted, 4),
            "uncertainty": round(u_predicted, 4),
            "signal_detected": signal_detected,
            "prg_delta": prg_delta,
            "prg_score": round(b.prg_score, 2),
            "suspicious_silence": is_suspicious_silence,
            "fsm_state": self.fsm_state,
            "justification": justification,
        }

        self.audit_log.insert(0, event)
        if len(self.audit_log) > 100:
            self.audit_log.pop()

        return event

    def get_status(self) -> Dict[str, Any]:
        """Returns comprehensive PRG status across all 18 bands."""
        bands_list = [b.to_dict() for b in self.bands.values()]
        suspicious = [b["band_id"] for b in bands_list if b["prg_score"] > 0.0]
        max_prg = max((b["prg_score"] for b in bands_list), default=0.0)

        return {
            "fsm_state": self.fsm_state,
            "current_tick": self.current_tick,
            "total_suspicious_silences": self.total_suspicious_silences,
            "max_prg_score": round(max_prg, 2),
            "prg_threshold": PRG_THRESHOLD,
            "prediction_threshold": PREDICTION_THRESHOLD,
            "suspicious_bands": suspicious,
            "weights": self.get_weights(),
            "bands": bands_list,
            "recent_audit": self.audit_log[:15],
        }


# Global singleton instance for system-wide imports
prg_engine: PRGEngine = PRGEngine(num_bands=NUMBER_OF_BANDS)


if __name__ == "__main__":
    # Quick self-test verification
    print("[Algorithm 17] Running PRG Engine self-test...")
    engine = PRGEngine()
    # Simulate a pattern: band 1 is active 4 times, then goes silent
    for i in range(4):
        engine.record_scan(1, signal_detected=True)
    res = engine.record_scan(1, signal_detected=False)
    print(f"Self-test result: Suspicious Silence = {res['suspicious_silence']}, PRG Score = {res['prg_score']}")
    print(f"FSM State = {engine.fsm_state}")
    print("[Algorithm 17] Self-test complete.")
