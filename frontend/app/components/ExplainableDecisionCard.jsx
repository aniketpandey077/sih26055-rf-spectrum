// ExplainableDecisionCard.jsx
//
// Explainable AI (XAI) transparent decision engine card.
// Shows the exact mathematical factors that caused the scanner to choose
// the current band:
// 1. Activity probability P(active) [Exploitation]
// 2. Uncertainty 4*p*(1-p) [Exploration]
// 3. Statistical Anomaly Z-Score [Threat Response]
// 4. Information Value I(b) [Knowledge Gain]
// 5. Freshness / Staleness Score [Anti-Staleness]
// 6. Anti-Starvation Cooldown Penalty
// 7. Counter-Deception Multipliers (Algorithm 17)
//
// Enables runtime switching between Logistic Regression, Random Forest, and XGBoost.

"use client";

import { useState } from "react";
import { switchActiveModel } from "../lib/api";
import { STATE_COLORS, MODEL_LABELS } from "../lib/constants";

export default function ExplainableDecisionCard({
  xai,
  strategyState = "NORMAL",
  activeModel = "random_forest",
  onModelChanged,
  rankings = [],
}) {
  const [switching, setSwitching] = useState(false);

  // Switch the active machine learning predictor
  async function handleModelSwitch(newModel) {
    if (newModel === activeModel) return;
    setSwitching(true);
    try {
      await switchActiveModel(newModel);
      if (onModelChanged) onModelChanged(newModel);
    } catch (err) {
      console.error("Failed to switch model:", err);
    } finally {
      setSwitching(false);
    }
  }

  const chosenEval = xai?.chosen_band_eval || rankings[0] || null;
  const weights = xai?.weights || {
    activity: 0.50,
    uncertainty: 0.15,
    anomaly: 0.15,
    information: 0.10,
    freshness: 0.10,
  };

  const isCounterDeception = strategyState === "COUNTER_DECEPTION";

  return (
    <div className="bg-panel border border-panelBorder rounded-xl p-4 shadow-xl space-y-4">
      {/* 1. Card Header with Title and Policy Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2.5">
          <span className="text-xl">🧠</span>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100 flex items-center gap-2">
              Explainable AI (XAI) Decision Engine
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Multi-Factor Multi-Armed Bandit &bull; Mathematical Proof
            </p>
          </div>
        </div>

        {/* Dynamic Strategy State Badge */}
        <div className="flex items-center gap-2 font-mono">
          <span className="text-[11px] text-slate-400">Policy:</span>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
              STATE_COLORS[strategyState] || STATE_COLORS.NORMAL
            }`}
          >
            {isCounterDeception && <span>⚡</span>}
            {strategyState}
          </span>
        </div>
      </div>

      {/* 2. Counter-Deception Multipliers Callout */}
      {isCounterDeception && (
        <div className="p-3 bg-amber-950/40 border border-amber-500/80 rounded-lg flex items-center justify-between text-xs font-mono text-amber-200">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <span>Counter-Deception Policy Active: Staleness Weight &times;2.5 &bull; PRG Weight &times;1.5</span>
          </div>
          <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded">
            BOOSTED
          </span>
        </div>
      )}

      {/* 3. ML Model Switcher Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
        <span className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
          <span className="text-slate-400">Activity Predictor:</span>
          {switching && <span className="text-cyan-400 animate-spin text-[11px]">⟳</span>}
        </span>

        <div className="flex items-center space-x-1.5 text-xs font-mono">
          {Object.entries(MODEL_LABELS).map(([id, meta]) => (
            <button
              key={id}
              onClick={() => handleModelSwitch(id)}
              disabled={switching}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                activeModel === id
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500 font-bold shadow-sm shadow-cyan-500/30 ring-1 ring-cyan-500/50"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Natural Language Decision Justification */}
      <div className="bg-slate-950/90 border border-slate-800/90 rounded-lg p-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Primary Decision Justification:</span>
          {chosenEval && (
            <span className="text-cyan-300 font-bold">
              Band #{chosenEval.band_id} &bull; Priority Score: {chosenEval.priority_score.toFixed(3)}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-200 font-sans italic bg-slate-900/60 p-2.5 rounded border border-slate-800/70">
          &ldquo;{xai?.top_reason || chosenEval?.top_reason || "Balancing activity probability, uncertainty exploration, and staleness freshness..."}&rdquo;
        </p>
      </div>

      {/* 5. 5-Factor Mathematical Breakdown */}
      {chosenEval && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            <span>Decision Factors</span>
            <span>Weight &bull; Contribution</span>
          </div>

          {/* Factor 1: Activity Probability */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-emerald-400 flex items-center gap-1">
                <span>●</span> P(Active) [Exploitation]
              </span>
              <span className="text-slate-300">
                w={weights.activity.toFixed(2)} &bull; {(chosenEval.activity_prob * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, chosenEval.activity_prob * 100)}%` }}
              />
            </div>
          </div>

          {/* Factor 2: Uncertainty */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-amber-400 flex items-center gap-1">
                <span>●</span> Uncertainty 4p(1-p) [Exploration]
              </span>
              <span className="text-slate-300">
                w={weights.uncertainty.toFixed(2)} &bull; {(chosenEval.uncertainty_score * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-amber-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, chosenEval.uncertainty_score * 100)}%` }}
              />
            </div>
          </div>

          {/* Factor 3: Anomaly Score */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-rose-400 flex items-center gap-1">
                <span>●</span> RF Anomaly Z-Score [Threat]
              </span>
              <span className="text-slate-300">
                w={weights.anomaly.toFixed(2)} &bull; {(chosenEval.anomaly_score * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-rose-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, chosenEval.anomaly_score * 100)}%` }}
              />
            </div>
          </div>

          {/* Factor 4: Information Value */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-cyan-400 flex items-center gap-1">
                <span>●</span> Information Value [Gain]
              </span>
              <span className="text-slate-300">
                w={weights.information.toFixed(2)} &bull; {(chosenEval.info_score * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, chosenEval.info_score * 100)}%` }}
              />
            </div>
          </div>

          {/* Factor 5: Staleness / Freshness */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-purple-400 flex items-center gap-1">
                <span>●</span> Staleness Need [1 - Freshness]
              </span>
              <span className="text-slate-300">
                w={weights.freshness.toFixed(2)} &bull; {(chosenEval.staleness_score * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-purple-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, chosenEval.staleness_score * 100)}%` }}
              />
            </div>
          </div>

          {/* Anti-Starvation Cooldown Penalty Notice */}
          {chosenEval.cooldown_penalty > 0 && (
            <div className="flex items-center justify-between text-[11px] font-mono bg-amber-950/40 border border-amber-800/50 px-2.5 py-1 rounded text-amber-300">
              <span>⚠️ Anti-Starvation Cooldown Applied:</span>
              <span className="font-bold">-{chosenEval.cooldown_penalty.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* 6. Candidate Priority Queue (Top 4) */}
      {rankings && rankings.length > 1 && (
        <div className="border-t border-slate-800 pt-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Candidate Band Priority Queue:</span>
            <span>Top 4 Ranked</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            {rankings.slice(0, 4).map((r, i) => (
              <div
                key={r.band_id}
                className={`p-2 rounded-lg border transition ${
                  i === 0
                    ? "bg-cyan-950/50 border-cyan-500/70 text-cyan-200 ring-1 ring-cyan-500/40"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                  <span className="font-bold">#{i + 1}</span>
                  <span className="opacity-60">{r.band_id}</span>
                </div>
                <div className="font-bold text-slate-100">Band {r.band_id}</div>
                <div className="text-[10px] text-cyan-400 mt-0.5">{r.priority_score.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
