// SpectrumGraph.jsx
//
// Electronic Warfare SDR Spectrum Analyzer:
// Frequency (MHz) on X axis, Amplitude (dBm) on Y axis.
// Real-time animated RF waveform with active channel spotlight.

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";

export default function SpectrumGraph({ points, activeBand }) {
  if (!points || points.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
        Acquiring live RF carrier telemetry...
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="spectrumGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00f2ff" stopOpacity={0.55} />
              <stop offset="60%" stopColor="#0284c7" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#0284c7" stopOpacity={0.01} />
            </linearGradient>
            <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" vertical={false} />

          <XAxis
            dataKey="frequency"
            stroke="#475569"
            tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "#334155" }}
            label={{
              value: "Frequency (MHz)",
              position: "insideBottom",
              offset: -2,
              fill: "#94a3b8",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          />

          <YAxis
            stroke="#475569"
            domain={[-100, -20]}
            tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "#334155" }}
            label={{
              value: "Power (dBm)",
              angle: -90,
              position: "insideLeft",
              fill: "#94a3b8",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              offset: 15,
            }}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(12, 19, 34, 0.95)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(0, 242, 255, 0.3)",
              borderRadius: "8px",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "#e2e8f0",
            }}
            labelFormatter={(freq) => `Center Freq: ${freq} MHz`}
            formatter={(value) => [`${value} dBm`, "Amplitude"]}
          />

          {activeBand && (
            <ReferenceArea
              x1={activeBand.start_frequency}
              x2={activeBand.end_frequency}
              fill="#00f2ff"
              fillOpacity={0.12}
              stroke="#00f2ff"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}

          <Area
            type="monotone"
            dataKey="amplitude"
            stroke="#00f2ff"
            strokeWidth={1.8}
            fill="url(#spectrumGradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
