// StatusBar.jsx
//
// Modern operational telemetry bar showing backend status, simulator state,
// live strategy state, and active ML predictor pipeline.

"use client";

import { useState, useEffect } from "react";

export default function StatusBar({
  backendConnected,
  strategyState = "NORMAL",
  activeModel = "random_forest",
  currentTick = 0,
}) {
  const [missionUptime, setMissionUptime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMissionUptime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const modelLabels = {
    random_forest: "Random Forest",
    xgboost: "XGBoost",
    logistic_regression: "Logistic Regression",
  };

  const isDeception = strategyState === "COUNTER_DECEPTION";
  const isAnomaly = strategyState === "ANOMALY_DETECTED";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* 1. BACKEND LINK */}
      <div className="glass-panel rounded-xl px-4 py-3 flex items-center justify-between border border-slate-800/80 hover:border-slate-700 transition">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Engine Backend
          </span>
          <p className="text-sm font-bold text-slate-100 mt-0.5 font-mono">
            {backendConnected ? "FastAPI 2.0" : "Offline"}
          </p>
        </div>
        <span className="flex items-center gap-2 font-mono text-xs">
          <span
            className={`status-dot ${
              backendConnected
                ? "bg-emerald-400 text-emerald-400 shadow-emerald-400/80 animate-pulse"
                : "bg-rose-400 text-rose-400"
            }`}
          ></span>
          <span className={backendConnected ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
            {backendConnected ? "ONLINE" : "OFFLINE"}
          </span>
        </span>
      </div>

      {/* 2. RF SIMULATOR */}
      <div className="glass-panel rounded-xl px-4 py-3 flex items-center justify-between border border-slate-800/80 hover:border-slate-700 transition">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            RF Receiver
          </span>
          <p className="text-sm font-bold text-slate-100 mt-0.5 font-mono">
            18 RF Bands
          </p>
        </div>
        <span className="flex items-center gap-2 font-mono text-xs">
          <span
            className={`status-dot ${
              backendConnected
                ? "bg-cyan-400 text-cyan-400 shadow-cyan-400/80"
                : "bg-amber-400 text-amber-400"
            }`}
          ></span>
          <span className="text-cyan-400 font-semibold font-mono">
            {backendConnected ? "100-1000 MHz" : "STANDBY"}
          </span>
        </span>
      </div>

      {/* 3. ACTIVE STRATEGY STATE */}
      <div className={`glass-panel rounded-xl px-4 py-3 flex items-center justify-between border transition ${
        isDeception
          ? "border-amber-500/80 bg-amber-950/30 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/50 animate-pulse"
          : isAnomaly
          ? "border-rose-500/80 bg-rose-950/30 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/50"
          : "border-slate-800/80 hover:border-slate-700"
      }`}>
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            FSM Strategy
          </span>
          <p className={`text-sm font-bold font-mono mt-0.5 ${
            isDeception ? "text-amber-400" : isAnomaly ? "text-rose-400" : "text-slate-100"
          }`}>
            {strategyState}
          </p>
        </div>
        <div className="text-right font-mono">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-700/60 bg-slate-900/90 text-cyan-300 block">
            TICK #{currentTick}
          </span>
        </div>
      </div>

      {/* 4. ACTIVE ML PREDICTOR & UPTIME */}
      <div className="glass-panel rounded-xl px-4 py-3 flex items-center justify-between border border-slate-800/80 hover:border-slate-700 transition">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            ML Activity Model
          </span>
          <p className="text-sm font-bold text-slate-100 mt-0.5 font-mono truncate max-w-[120px]">
            {modelLabels[activeModel] || activeModel}
          </p>
        </div>
        <div className="text-right font-mono">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-700/60 block">
            17 ALGOS
          </span>
          <span className="text-[9px] text-slate-500 block mt-0.5">
            ⏱ {formatUptime(missionUptime)}
          </span>
        </div>
      </div>
    </div>
  );
}
