// CogniwarPrgPanel.jsx
//
// Algorithm 17: Prediction-Reality Gap (PRG) Engine ("Silence is Signal" / COGNIWAR).
// Displays live PRG suspicion scores across all 18 bands, suspicious silence alerts,
// silent gaps counters, and dynamic Counter-Deception FSM state.
//
// Key Mathematical Formulas:
// 1. Laplace-Smoothed Predictor: P(active) = (hits + 1) / (scans + 2)
// 2. Entropy Uncertainty: U = 4 * p * (1 - p), peaks at p=0.5
// 3. Suspicious Silence: Flagged when P(active) >= 0.65 AND signal_detected == False
// 4. Counter-Deception FSM: Triggered when max(prg_scores) >= 3.0

"use client";

import { useState } from "react";
import { getBandFrequencyRange } from "../lib/constants";

export default function CogniwarPrgPanel({
  prgStatus,
  activeBandId,
  onScanBand,
  isAutoRunning,
}) {
  const [filterMode, setFilterMode] = useState("all"); // "all" | "suspicious"

  const fsmState = prgStatus?.fsm_state || "NORMAL";
  const bands = prgStatus?.bands || [];
  const suspiciousBands = prgStatus?.suspicious_bands || [];
  const totalSilences = prgStatus?.total_suspicious_silences || 0;
  const maxPrg = prgStatus?.max_prg_score || 0.0;
  const isCounterDeception = fsmState === "COUNTER_DECEPTION";

  const displayedBands =
    filterMode === "suspicious"
      ? bands.filter((b) => b.prg_score > 0)
      : bands;

  // PRG suspicion level color thresholds
  function getPrgBarColor(score) {
    if (score >= 3.0) return "bg-rose-500 shadow-rose-500/50";
    if (score >= 1.0) return "bg-amber-400 shadow-amber-400/50";
    return "bg-emerald-500 shadow-emerald-500/50";
  }

  function getPrgTextColor(score) {
    if (score >= 3.0) return "text-rose-400";
    if (score >= 1.0) return "text-amber-400";
    return "text-emerald-400";
  }

  return (
    <section className="bg-panel border border-panelBorder rounded-xl p-4 shadow-xl space-y-4">
      {/* 1. Header Bar with COGNIWAR Title and FSM State */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📡</span>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100 flex items-center gap-2">
              COGNIWAR &bull; Algorithm 17: PRG Suspicion Monitor
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 font-bold">
              Silence is Signal
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Predicts expected emissions via Laplace-smoothed hit-rate &mdash; flags deliberate electronic silence &amp; activates Counter-Deception.
          </p>
        </div>

        {/* FSM State Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all ${
            isCounterDeception
              ? "bg-amber-950/90 border-amber-500 text-amber-200 shadow-lg shadow-amber-950/60 animate-pulse ring-1 ring-amber-500/60"
              : "bg-emerald-950/60 border-emerald-500/60 text-emerald-300 shadow-sm"
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isCounterDeception ? "bg-amber-400" : "bg-emerald-400"
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isCounterDeception ? "bg-amber-500" : "bg-emerald-500"
              }`}
            ></span>
          </span>
          <span>FSM: {fsmState}</span>
        </div>
      </div>

      {/* 2. Key Operational Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-slate-100">
            {suspiciousBands.length}
            <span className="text-xs text-slate-500 font-normal"> / 18</span>
          </div>
          <div className="text-[10px] uppercase text-slate-400 mt-0.5">
            Suspicious Bands (🚨)
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-amber-400">
            {totalSilences}
          </div>
          <div className="text-[10px] uppercase text-slate-400 mt-0.5">
            Silent Gaps Flagged
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-center">
          <div className={`text-lg font-bold ${getPrgTextColor(maxPrg)}`}>
            {maxPrg.toFixed(1)}
            <span className="text-xs text-slate-500 font-normal"> / 3.0</span>
          </div>
          <div className="text-[10px] uppercase text-slate-400 mt-0.5">
            Peak PRG Suspicion
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-cyan-300">
            {isCounterDeception ? "2.5x / 1.5x" : "1.0x / 1.0x"}
          </div>
          <div className="text-[10px] uppercase text-slate-400 mt-0.5">
            Staleness / PRG Bias
          </div>
        </div>
      </div>

      {/* 3. Filter Controls & Threshold Notice */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-slate-400 mr-1">Display:</span>
          <button
            onClick={() => setFilterMode("all")}
            className={`px-2.5 py-1 rounded-lg border transition ${
              filterMode === "all"
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/80 font-bold"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            All 18 Bands
          </button>
          <button
            onClick={() => setFilterMode("suspicious")}
            className={`px-2.5 py-1 rounded-lg border transition ${
              filterMode === "suspicious"
                ? "bg-rose-500/20 text-rose-300 border-rose-500/80 font-bold"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            🚨 Suspicious Only ({suspiciousBands.length})
          </button>
        </div>

        <span className="text-[11px] font-mono text-slate-400">
          Trigger: PRG &ge; 3.0 shifts scanner into Counter-Deception
        </span>
      </div>

      {/* 4. 18 Bands Suspicion Grid */}
      {displayedBands.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/50 border border-slate-800/60 rounded-xl font-mono space-y-1">
          <p className="text-emerald-400 font-semibold">✓ No Suspicious Bands Active</p>
          <p className="text-slate-500">All scanned channels are currently matching expected emission patterns.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
          {displayedBands.map((b) => {
            const isTuned = activeBandId === b.band_id;
            const isSusp = b.prg_score > 0;
            const pct = Math.min((b.prg_score / 3.0) * 100, 100);
            const freq = getBandFrequencyRange(b.band_id);

            return (
              <div
                key={b.band_id}
                className={`p-3 rounded-xl border transition-all text-xs font-mono ${
                  isTuned
                    ? "border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-500/70 shadow-md shadow-cyan-950/50"
                    : isSusp
                    ? "border-rose-500/60 bg-rose-950/20 hover:border-rose-400"
                    : "border-slate-800/80 bg-slate-950/60 hover:border-slate-700/80"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-100">
                      Band #{b.band_id}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({freq.start}&ndash;{freq.end} MHz)
                    </span>
                  </div>

                  {isSusp ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-rose-950 text-rose-300 border border-rose-600/80 rounded animate-pulse">
                      🚨 {b.prg_score.toFixed(1)}/3.0
                    </span>
                  ) : (
                    <span className="text-[9px] text-emerald-400/80 px-1.5 py-0.2 bg-emerald-950/40 border border-emerald-800/40 rounded">
                      CLEAR
                    </span>
                  )}
                </div>

                {/* PRG Score Progress Bar */}
                <div className="space-y-1 mb-2.5">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>PRG Suspicion:</span>
                    <span className={`font-bold ${getPrgTextColor(b.prg_score)}`}>
                      {b.prg_score.toFixed(1)} / 3.0
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${getPrgBarColor(
                        b.prg_score
                      )}`}
                      style={{ width: `${Math.max(pct, isSusp ? 12 : 0)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Band Statistics & Scan Action */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/60">
                  <span>
                    P(act):{" "}
                    <b className="text-slate-200">
                      {(b.p_active * 100).toFixed(0)}%
                    </b>
                  </span>
                  <span>
                    U: <b className="text-slate-200">{b.uncertainty.toFixed(2)}</b>
                  </span>
                  <span>
                    Hits:{" "}
                    <b className="text-slate-200">
                      {b.total_hits}/{b.total_scans}
                    </b>
                  </span>
                  {onScanBand && (
                    <button
                      onClick={() => onScanBand(b.band_id)}
                      disabled={isAutoRunning}
                      className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/60 disabled:opacity-30 font-bold transition"
                    >
                      Scan
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
