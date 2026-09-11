// BenchmarkPanel.jsx
//
// Algorithm 14 & 15: Comparative Strategy Benchmarking & Model Evaluation.
// Shows:
// 1. Rigorous comparison: Sequential Sweep vs Random Baseline vs Smart Adaptive
// 2. ML Model Performance Matrix: Logistic Regression vs Random Forest vs XGBoost
// 3. SQLite persistence status

"use client";

import { useState, useEffect } from "react";
import { runBenchmark, getModelBenchmarks } from "../lib/api";

export default function BenchmarkPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [modelBenchmarks, setModelBenchmarks] = useState(null);
  const [numSteps, setNumSteps] = useState(150);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadModelBenchmarks();
  }, []);

  async function loadModelBenchmarks() {
    try {
      const data = await getModelBenchmarks();
      setModelBenchmarks(data);
    } catch (err) {
      console.error("Failed to load model benchmarks:", err);
    }
  }

  async function handleRunBenchmark() {
    setIsRunning(true);
    setError(null);
    try {
      const result = await runBenchmark(numSteps);
      setBenchmarkResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  }

  const strat = benchmarkResult?.strategies;

  return (
    <section className="bg-panel border border-panelBorder rounded-xl p-5 shadow-xl space-y-5">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xl">📊</span>
          <div>
            <h2 className="text-base font-semibold uppercase tracking-wider text-slate-100 flex items-center gap-2">
              System Benchmarks &amp; Algorithmic Comparison
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Academic Validation &bull; Sequential vs. Random vs. Smart Adaptive (16-Algorithm Pipeline)
            </p>
          </div>
        </div>

        {/* Trigger Button */}
        <div className="flex items-center space-x-2">
          <select
            value={numSteps}
            onChange={(e) => setNumSteps(Number(e.target.value))}
            className="bg-slate-900 text-xs font-mono text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-lg"
          >
            <option value={100}>100 Scan Cycles</option>
            <option value={150}>150 Scan Cycles</option>
            <option value={300}>300 Scan Cycles</option>
          </select>

          <button
            onClick={handleRunBenchmark}
            disabled={isRunning}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition flex items-center gap-2 ${
              isRunning
                ? "bg-cyan-900/60 text-cyan-300 cursor-wait border border-cyan-700/50"
                : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
            }`}
          >
            {isRunning ? (
              <>
                <span className="animate-spin">⟳</span>
                <span>Benchmarking...</span>
              </>
            ) : (
              <span>▶ Run Comparative Benchmark</span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-800 p-2.5 rounded-lg font-mono">
          {error}
        </div>
      )}

      {/* STRATEGY COMPARISON CARDS */}
      {strat ? (
        <div className="space-y-4">
          <div className="bg-emerald-950/40 border border-emerald-600/50 rounded-lg p-3 text-xs font-mono text-emerald-300">
            🎯 <strong>Benchmark Summary:</strong> {benchmarkResult.summary.smart_advantage}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sequential Card */}
            <div className="bg-slate-950/80 border border-blue-800/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 uppercase font-mono">
                  1. Sequential Sweep
                </span>
                <span className="text-[10px] font-mono bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                  Normal Baseline
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">
                {strat.normal.hit_rate_pct}%
                <span className="text-xs font-normal text-slate-400 ml-1.5">Hit Rate</span>
              </div>
              <div className="space-y-1 text-xs font-mono text-slate-400 pt-2 border-t border-slate-800">
                <div className="flex justify-between">
                  <span>Signal Hits:</span>
                  <span className="text-slate-200">{strat.normal.signal_hits} / {strat.normal.total_scans}</span>
                </div>
                <div className="flex justify-between">
                  <span>Wasted Scans (Noise):</span>
                  <span className="text-red-400">{strat.normal.wasted_scans}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Latency:</span>
                  <span className="text-slate-300">{strat.normal.avg_latency_ticks} ticks</span>
                </div>
                <div className="flex justify-between">
                  <span>Band Coverage:</span>
                  <span className="text-cyan-300">{strat.normal.band_coverage_pct}%</span>
                </div>
              </div>
            </div>

            {/* Random Card */}
            <div className="bg-slate-950/80 border border-purple-800/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 uppercase font-mono">
                  2. Uniform Random
                </span>
                <span className="text-[10px] font-mono bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800">
                  Uninformed
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">
                {strat.random.hit_rate_pct}%
                <span className="text-xs font-normal text-slate-400 ml-1.5">Hit Rate</span>
              </div>
              <div className="space-y-1 text-xs font-mono text-slate-400 pt-2 border-t border-slate-800">
                <div className="flex justify-between">
                  <span>Signal Hits:</span>
                  <span className="text-slate-200">{strat.random.signal_hits} / {strat.random.total_scans}</span>
                </div>
                <div className="flex justify-between">
                  <span>Wasted Scans (Noise):</span>
                  <span className="text-red-400">{strat.random.wasted_scans}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Latency:</span>
                  <span className="text-slate-300">{strat.random.avg_latency_ticks} ticks</span>
                </div>
                <div className="flex justify-between">
                  <span>Band Coverage:</span>
                  <span className="text-cyan-300">{strat.random.band_coverage_pct}%</span>
                </div>
              </div>
            </div>

            {/* Smart Adaptive Card */}
            <div className="bg-emerald-950/20 border border-emerald-500 rounded-xl p-4 space-y-2 shadow-lg shadow-emerald-950/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase font-mono">
                  3. Smart Adaptive
                </span>
                <span className="text-[10px] font-mono bg-emerald-900/80 text-emerald-200 px-2 py-0.5 rounded border border-emerald-500 font-bold">
                  ★ OUR SYSTEM
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-300">
                {strat.smart.hit_rate_pct}%
                <span className="text-xs font-normal text-slate-400 ml-1.5">Hit Rate</span>
              </div>
              <div className="space-y-1 text-xs font-mono text-slate-300 pt-2 border-t border-slate-800">
                <div className="flex justify-between">
                  <span>Signal Hits:</span>
                  <span className="text-emerald-400 font-bold">{strat.smart.signal_hits} / {strat.smart.total_scans}</span>
                </div>
                <div className="flex justify-between">
                  <span>Wasted Scans (Noise):</span>
                  <span className="text-emerald-400 font-bold">{strat.smart.wasted_scans}</span>
                </div>
                <div className="flex justify-between">
                  <span>Advantage vs Normal:</span>
                  <span className="text-emerald-300 font-bold">+{benchmarkResult.summary.efficiency_gain_pct}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Wasted Scans Saved:</span>
                  <span className="text-emerald-300 font-bold">{benchmarkResult.summary.wasted_scans_saved} scans</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-2">
          <p className="text-xs font-mono text-slate-400">
            Click &ldquo;Run Comparative Benchmark&rdquo; to simulate {numSteps} controlled scan cycles across all 3 strategies.
          </p>
          <p className="text-[11px] text-slate-500">
            Measures Hit Rate (%), Wasted Scans Saved, and Latency under the exact same RF conditions.
          </p>
        </div>
      )}

      {/* ML MODELS EVALUATION MATRIX */}
      {modelBenchmarks && modelBenchmarks.models && (
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-300">
              Machine Learning Predictor Evaluation Matrix (Algorithm 2 &amp; 14)
            </h3>
            <span className="text-[11px] font-mono text-cyan-400">
              Active: {modelBenchmarks.active_model}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Model Architecture</th>
                  <th className="p-2.5 text-right">Accuracy</th>
                  <th className="p-2.5 text-right">Precision</th>
                  <th className="p-2.5 text-right">Recall</th>
                  <th className="p-2.5 text-right">F1-Score</th>
                  <th className="p-2.5 text-right">ROC-AUC</th>
                  <th className="p-2.5 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {modelBenchmarks.models.map((m) => {
                  const isActive =
                    modelBenchmarks.active_model.toLowerCase() ===
                    m.model_name.toLowerCase().replace(" ", "_");
                  return (
                    <tr
                      key={m.model_name}
                      className={`hover:bg-slate-800/40 transition ${
                        isActive ? "bg-cyan-950/30 font-semibold" : ""
                      }`}
                    >
                      <td className="p-2.5 text-slate-200 flex items-center gap-2">
                        {isActive && <span className="text-cyan-400">●</span>}
                        <span>{m.model_name}</span>
                      </td>
                      <td className="p-2.5 text-right text-slate-300">
                        {(m.accuracy * 100).toFixed(1)}%
                      </td>
                      <td className="p-2.5 text-right text-slate-300">
                        {(m.precision * 100).toFixed(1)}%
                      </td>
                      <td className="p-2.5 text-right text-slate-300">
                        {(m.recall * 100).toFixed(1)}%
                      </td>
                      <td className="p-2.5 text-right text-emerald-400 font-bold">
                        {m.f1_score.toFixed(3)}
                      </td>
                      <td className="p-2.5 text-right text-cyan-300">
                        {m.auc_roc.toFixed(3)}
                      </td>
                      <td className="p-2.5 text-right text-slate-400">
                        {m.inference_time_ms < 0.001
                          ? "<0.001 ms"
                          : `${m.inference_time_ms.toFixed(3)} ms`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PERSISTENCE FOOTER */}
      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
        <span className="flex items-center gap-1.5">
          <span className="text-emerald-400">🗄️</span>
          <span>Persistence: SQLite Database (<code>rf_spectrum.db</code>) Active &bull; Zero Network Overhead</span>
        </span>
        <span>100% Offline &bull; Academic Viva Ready</span>
      </div>
    </section>
  );
}
