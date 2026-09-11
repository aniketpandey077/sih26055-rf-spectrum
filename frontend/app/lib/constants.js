// constants.js
//
// Centralized configuration and reference data for the SIH26055 Frontend.
// Eliminates magic numbers, duplicate frequency math, and hardcoded service maps.

/**
 * Calculates the start and end frequency for a given 1-indexed band ID.
 * Bands span 100 MHz to 1000 MHz across 18 bands, each 50 MHz wide.
 *
 * @param {number} bandId - Band identifier (1 to 18)
 * @returns {{ start: number, end: number, label: string }}
 */
export function getBandFrequencyRange(bandId) {
  const start = 100 + (bandId - 1) * 50;
  const end = 150 + (bandId - 1) * 50;
  return {
    start,
    end,
    label: `${start} – ${end} MHz`,
  };
}

/**
 * Deterministic ITU Frequency Allocation mapping for all 18 bands.
 * Matches ITU-R standard band plans with service category and UI color tokens.
 */
export const BAND_SERVICES = {
  1: { tag: "Aviation Air-Band", category: "Aero", color: "text-sky-300 border-sky-800/80 bg-sky-950/40" },
  2: { tag: "Tactical VHF Voice", category: "Tactical", color: "text-emerald-300 border-emerald-800/80 bg-emerald-950/40" },
  3: { tag: "Mil Air-to-Ground", category: "Military", color: "text-amber-300 border-amber-800/80 bg-amber-950/40" },
  4: { tag: "Defense Satcom", category: "Satcom", color: "text-purple-300 border-purple-800/80 bg-purple-950/40" },
  5: { tag: "Mobile Mil Radio", category: "Military", color: "text-amber-300 border-amber-800/80 bg-amber-950/40" },
  6: { tag: "Public Safety Tetra", category: "Emergency", color: "text-rose-300 border-rose-800/80 bg-rose-950/40" },
  7: { tag: "UAV Drone Telemetry", category: "Drone", color: "text-cyan-300 border-cyan-800/80 bg-cyan-950/40" },
  8: { tag: "Rail Comm / Land", category: "Civilian", color: "text-slate-300 border-slate-700/80 bg-slate-900/40" },
  9: { tag: "Digital TV DVB-T", category: "Broadcast", color: "text-indigo-300 border-indigo-800/80 bg-indigo-950/40" },
  10: { tag: "DVB-T Multicast", category: "Broadcast", color: "text-indigo-300 border-indigo-800/80 bg-indigo-950/40" },
  11: { tag: "TV White Space", category: "Broadcast", color: "text-indigo-300 border-indigo-800/80 bg-indigo-950/40" },
  12: { tag: "Public Broadband", category: "Emergency", color: "text-rose-300 border-rose-800/80 bg-rose-950/40" },
  13: { tag: "4G/LTE Uplink", category: "Cellular", color: "text-teal-300 border-teal-800/80 bg-teal-950/40" },
  14: { tag: "4G/LTE Downlink", category: "Cellular", color: "text-teal-300 border-teal-800/80 bg-teal-950/40" },
  15: { tag: "5G NR Sub-1GHz", category: "Cellular", color: "text-teal-300 border-teal-800/80 bg-teal-950/40" },
  16: { tag: "IoT LoRa / ISM", category: "IoT", color: "text-violet-300 border-violet-800/80 bg-violet-950/40" },
  17: { tag: "Industrial RFID", category: "ISM", color: "text-yellow-300 border-yellow-800/80 bg-yellow-950/40" },
  18: { tag: "Aero DME / TACAN", category: "Aero", color: "text-sky-300 border-sky-800/80 bg-sky-950/40" },
};

/**
 * Color and styling tokens for Strategy FSM states.
 */
export const STATE_COLORS = {
  NORMAL: "bg-cyan-950/70 text-cyan-300 border-cyan-700/60",
  COUNTER_DECEPTION: "bg-amber-950/90 text-amber-300 border-amber-500 shadow-lg shadow-amber-950/50 animate-pulse",
  ANOMALY_DETECTED: "bg-rose-950/90 text-rose-300 border-rose-500 shadow-lg shadow-rose-950/50 animate-pulse",
  HIGH_UNCERTAINTY: "bg-yellow-950/70 text-yellow-300 border-yellow-600/70",
  HIGH_ACTIVITY: "bg-emerald-950/70 text-emerald-300 border-emerald-600/70",
  SPARSE_ACTIVITY: "bg-purple-950/70 text-purple-300 border-purple-600/70",
};

/**
 * Human-readable labels and icons for runtime ML Activity Predictors.
 */
export const MODEL_LABELS = {
  random_forest: { label: "Random Forest", icon: "🌲", shortLabel: "RF" },
  xgboost: { label: "XGBoost", icon: "⚡", shortLabel: "XGB" },
  logistic_regression: { label: "Logistic Regression", icon: "📈", shortLabel: "LogReg" },
};

/**
 * Dwell time speed options (in milliseconds) for automated scanning.
 */
export const DWELL_SPEEDS = [
  { label: "1.5s (Slow)", val: 1500 },
  { label: "0.9s (Norm)", val: 900 },
  { label: "0.5s (Fast)", val: 500 },
];

/**
 * Available scanning policies and their display meta.
 */
export const SCAN_MODES = [
  { id: "smart", label: "⚡ Smart Adaptive (17-Algo)", activeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-sm shadow-emerald-500/20" },
  { id: "normal", label: "🔄 Normal (Sequential Sweep)", activeColor: "bg-blue-500/20 text-blue-300 border-blue-500 shadow-sm shadow-blue-500/20" },
  { id: "random", label: "🎲 Uniform Random", activeColor: "bg-purple-500/20 text-purple-300 border-purple-500 shadow-sm shadow-purple-500/20" },
  { id: "manual", label: "🔘 Manual Inspect", activeColor: "bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm shadow-amber-500/20" },
];
