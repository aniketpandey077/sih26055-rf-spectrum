// ScanResultPanel.jsx
//
// Displays the result of the most recent RF scan:
// - Physical RF receiver telemetry (Signal strength, Noise floor, SNR in dB)
// - Visual graduated dBm signal strength gauge meter
// - Deterministic ITU emitter classification (modulation, service profile)
// - RF threat / anomaly detection warning banner

"use client";

export default function ScanResultPanel({ result, error }) {
  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono space-y-1">
        <div className="flex items-center gap-2 font-bold text-red-200">
          <span>⚠️</span>
          <span>RECEIVER TELEMETRY ERROR</span>
        </div>
        <p className="opacity-90">{error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-500 font-mono text-xs space-y-3">
        <div className="relative w-12 h-12 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping"></div>
          <div className="w-10 h-10 rounded-full border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-base">
            📡
          </div>
        </div>
        <div>
          <p className="text-slate-300 font-semibold">Virtual SDR Receiver Idle</p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-[220px] mx-auto">
            Click &ldquo;Start Auto-Scan&rdquo; or select any RF band to inspect live emissions.
          </p>
        </div>
      </div>
    );
  }

  const classification = result.classification || {};
  const isAnomaly = classification.is_anomaly || false;
  const threatLevel = classification.threat_level || "CLEAR";
  const snr = classification.snr_db ?? (result.signal_detected ? Math.max(0, result.signal_strength - result.noise_level) : 0);

  // Compute signal gauge percentage (-100 dBm to -20 dBm mapped to 0% to 100%)
  const minDbm = -100;
  const maxDbm = -20;
  const sigLevel = result.signal_detected ? result.signal_strength : result.noise_level;
  const gaugePct = Math.min(Math.max(((sigLevel - minDbm) / (maxDbm - minDbm)) * 100, 4), 100);

  return (
    <div className="space-y-3.5">
      {/* 1. THREAT / ANOMALY WARNING BANNER */}
      {isAnomaly && (
        <div className="p-3 bg-red-950/80 border border-red-500 rounded-xl shadow-lg shadow-red-950/50 flex items-start gap-2.5 animate-pulse">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-red-200 uppercase tracking-wider">
                RF Threat / Anomaly Detected
              </p>
              <span className="text-[10px] font-mono bg-red-600 text-white font-bold px-1.5 py-0.2 rounded">
                CRITICAL
              </span>
            </div>
            <p className="text-xs text-red-200 mt-1 font-sans">
              {classification.threat_description || "High-power unauthorized emitter detected violating threshold."}
            </p>
          </div>
        </div>
      )}

      {/* 2. RECEIVER HEADER */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
            Tuned Channel
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-lg font-bold text-slate-100 font-mono">
              Band #{result.band_id}
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                result.signal_detected
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20"
                  : "bg-slate-900 text-slate-400 border-slate-800"
              }`}
            >
              {result.signal_detected ? "● EMITTER ACTIVE" : "○ CHANNEL CLEAR"}
            </span>
          </div>
        </div>

        <div className="text-right font-mono">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
            Frequency Range
          </span>
          <span className="text-xs font-bold text-cyan-300">
            {result.frequency_start} &ndash; {result.frequency_end} MHz
          </span>
        </div>
      </div>

      {/* 3. SIGNAL STRENGTH & SNR GAUGES */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-3">
        {/* Signal Level Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Carrier Power (P_sig):</span>
            <span className="font-bold text-slate-200">
              {result.signal_detected ? `${result.signal_strength} dBm` : "Floor Noise"}
            </span>
          </div>

          <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800 relative">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isAnomaly
                  ? "bg-gradient-to-r from-amber-500 to-red-500"
                  : result.signal_detected
                  ? "bg-gradient-to-r from-cyan-500 to-emerald-400"
                  : "bg-slate-700"
              }`}
              style={{ width: `${gaugePct}%` }}
            />
          </div>

          {/* Scale Labels */}
          <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
            <span>-100 dBm</span>
            <span>-70 dBm</span>
            <span>-40 dBm</span>
            <span>-20 dBm</span>
          </div>
        </div>

        {/* 3 Metric Readout Cards */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/60 font-mono text-center">
          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[9px] text-slate-400 uppercase block">Signal Level</span>
            <span className="text-xs font-bold text-slate-200">
              {result.signal_detected ? `${result.signal_strength} dBm` : "--"}
            </span>
          </div>

          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[9px] text-slate-400 uppercase block">Noise Floor</span>
            <span className="text-xs font-bold text-slate-400">
              {result.noise_level} dBm
            </span>
          </div>

          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[9px] text-cyan-400 uppercase block">SNR Link</span>
            <span className="text-xs font-bold text-cyan-300">
              {result.signal_detected ? `+${snr} dB` : "0.0 dB"}
            </span>
          </div>
        </div>
      </div>

      {/* 4. DETERMINISTIC CLASSIFICATION PROFILE */}
      {result.signal_detected ? (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
            ITU Emitter Classification
          </span>

          <div>
            <span className="text-sm font-bold text-amber-300 block">
              {classification.signal_type || "Standard RF Carrier"}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Service: {classification.service || "General Radiocommunication"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800/60 text-xs font-mono">
            <div>
              <span className="text-slate-500 text-[10px] block">Modulation Scheme</span>
              <span className="text-slate-200 font-semibold">
                {classification.modulation || "Continuous Wave"}
              </span>
            </div>

            <div>
              <span className="text-slate-500 text-[10px] block">Threat Status</span>
              <span
                className={`font-bold inline-block px-1.5 py-0.2 rounded text-[10px] ${
                  threatLevel === "ALERT"
                    ? "bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse"
                    : threatLevel === "WATCH"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                {threatLevel}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 text-center text-xs font-mono text-slate-500">
          No signal carrier detected above thermal noise threshold (-80 dBm).
        </div>
      )}

      <p className="text-[10px] text-slate-500 px-1 font-mono leading-relaxed">
        Deterministic digital signal characterization &bull; Real-time SNR &bull; Zero external cloud dependency.
      </p>
    </div>
  );
}
