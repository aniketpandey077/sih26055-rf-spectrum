// ComparisonStats.jsx
//
// Displays a side-by-side benchmark comparing Traditional Sequential
// scanning vs. Uniform Random vs. Smart Adaptive Scanning (16-Algorithm Pipeline).
//
// Refactored to use a reusable StrategyComparisonCard component for zero redundancy.

"use client";

/**
 * Reusable card representing one scanning strategy's performance metrics.
 */
function StrategyComparisonCard({
  title,
  subtitle,
  modeKey,
  currentMode,
  data,
  colorScheme,
}) {
  const isActive = currentMode === modeKey;

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all ${
        isActive
          ? `${colorScheme.activeBg} ${colorScheme.activeBorder} ring-1 ${colorScheme.ring} shadow-md`
          : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-semibold uppercase tracking-wider font-mono ${colorScheme.text}`}>
          {title}
        </span>
        {isActive && (
          <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold border ${colorScheme.badge}`}>
            ACTIVE MODE
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mb-3">
        {subtitle}
      </p>

      {/* Hit Rate Progress Bar */}
      <div className="space-y-1 mb-3">
        <div className="flex justify-between text-[10px] font-mono text-slate-400">
          <span>Hit Rate:</span>
          <span className={`font-bold ${colorScheme.text}`}>{data.hit_rate_pct}%</span>
        </div>
        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${colorScheme.bar}`}
            style={{ width: `${Math.min(100, data.hit_rate_pct)}%` }}
          />
        </div>
      </div>

      {/* 3-Metric Numerical Breakdown */}
      <div className="grid grid-cols-3 gap-1 text-center pt-2 border-t border-slate-800/80 font-mono">
        <div>
          <p className="text-[10px] text-slate-400">Scans</p>
          <p className="text-sm font-bold text-slate-200">{data.total_scans}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">Hits</p>
          <p className="text-sm font-bold text-slate-200">{data.signal_hits}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">Wasted</p>
          <p className="text-sm font-bold text-slate-400">{data.wasted_scans}</p>
        </div>
      </div>
    </div>
  );
}

export default function ComparisonStats({ stats, onReset, currentMode }) {
  const normal = stats?.normal || { total_scans: 0, signal_hits: 0, wasted_scans: 0, hit_rate_pct: 0.0 };
  const random = stats?.random || { total_scans: 0, signal_hits: 0, wasted_scans: 0, hit_rate_pct: 0.0 };
  const smart = stats?.smart || { total_scans: 0, signal_hits: 0, wasted_scans: 0, hit_rate_pct: 0.0 };

  // Calculate algorithmic efficiency ratio (Smart vs. Normal)
  const efficiencyRatio =
    normal.hit_rate_pct > 0
      ? (smart.hit_rate_pct / normal.hit_rate_pct).toFixed(1)
      : smart.hit_rate_pct > 0
      ? (smart.hit_rate_pct / 10).toFixed(1)
      : "1.0";

  const strategies = [
    {
      title: "1. Sequential",
      subtitle: "Sweeps 100MHz to 1000MHz in rigid numerical order.",
      modeKey: "normal",
      data: normal,
      colorScheme: {
        text: "text-blue-400",
        activeBg: "bg-blue-950/30",
        activeBorder: "border-blue-500",
        ring: "ring-blue-500/40",
        badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        bar: "bg-blue-500",
      },
    },
    {
      title: "2. Random",
      subtitle: "Uniform random baseline without temporal memory.",
      modeKey: "random",
      data: random,
      colorScheme: {
        text: "text-purple-400",
        activeBg: "bg-purple-950/30",
        activeBorder: "border-purple-500",
        ring: "ring-purple-500/40",
        badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        bar: "bg-purple-500",
      },
    },
    {
      title: "3. Smart Adaptive",
      subtitle: "Exploits active signals, minimizes wasted noise scans.",
      modeKey: "smart",
      data: smart,
      colorScheme: {
        text: "text-emerald-400",
        activeBg: "bg-emerald-950/30",
        activeBorder: "border-emerald-500",
        ring: "ring-emerald-500/40",
        badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        bar: "bg-emerald-500",
      },
    },
  ];

  return (
    <div className="bg-panel border border-panelBorder rounded-xl p-4 shadow-xl space-y-4">
      {/* 1. Header with Title and Reset Action */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚖️</span>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
              Real-Time Scanning Efficiency Benchmark
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Side-by-side comparison: Sequential Sweep vs. Random Baseline vs. ML Smart Adaptive
          </p>
        </div>

        <button
          onClick={onReset}
          className="text-xs px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-slate-300 rounded-lg border border-slate-800 hover:border-slate-700 transition font-mono flex items-center gap-1.5"
          title="Reset benchmark counters to start fresh comparison"
        >
          <span>↺</span>
          <span>Reset Counters</span>
        </button>
      </div>

      {/* 2. Reusable 3-Strategy Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {strategies.map((strat) => (
          <StrategyComparisonCard
            key={strat.modeKey}
            title={strat.title}
            subtitle={strat.subtitle}
            modeKey={strat.modeKey}
            currentMode={currentMode}
            data={strat.data}
            colorScheme={strat.colorScheme}
          />
        ))}
      </div>

      {/* 3. Summary Banner with Efficiency Multiplier */}
      <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <span>⚡</span>
            <span>Real-Time Algorithmic Advantage:</span>
          </p>
          <p className="text-xs text-slate-400 font-mono">
            Smart Mode delivers{" "}
            <span className="text-emerald-400 font-bold">
              {efficiencyRatio}x higher signal interception efficiency
            </span>{" "}
            by skipping dead channels.
          </p>
        </div>

        <div className="text-right font-mono">
          <span className="text-[10px] text-slate-500 uppercase block">Total Operations</span>
          <span className="text-xs font-bold text-slate-300">
            {smart.total_scans + normal.total_scans + random.total_scans} Total Scans
          </span>
        </div>
      </div>
    </div>
  );
}
