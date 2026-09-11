"use client";

import { useEffect, useRef } from "react";

/**
 * Maps an RF amplitude value (dBm) to an RGB color for the waterfall heatmap.
 * -95 dBm (Noise Floor) -> Deep Navy/Violet
 * -75 dBm -> Cyan/Teal
 * -55 dBm -> Emerald/Green
 * -40 dBm -> Bright Yellow
 * > -30 dBm -> Intense Orange/Hot Red (Anomaly)
 */
function amplitudeToColor(amp) {
  // Normalize between -95 dBm and -25 dBm
  const minAmp = -95;
  const maxAmp = -25;
  const norm = Math.max(0, Math.min(1, (amp - minAmp) / (maxAmp - minAmp)));

  if (norm < 0.2) {
    // Deep Navy to Violet
    const t = norm / 0.2;
    const r = Math.round(10 + t * 40);
    const g = Math.round(12 + t * 25);
    const b = Math.round(45 + t * 110);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (norm < 0.45) {
    // Violet to Cyan
    const t = (norm - 0.2) / 0.25;
    const r = Math.round(50 - t * 40);
    const g = Math.round(37 + t * 145);
    const b = Math.round(155 + t * 65);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (norm < 0.7) {
    // Cyan to Bright Green
    const t = (norm - 0.45) / 0.25;
    const r = Math.round(10 + t * 25);
    const g = Math.round(182 + t * 40);
    const b = Math.round(220 - t * 180);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (norm < 0.88) {
    // Green to Bright Yellow/Gold
    const t = (norm - 0.7) / 0.18;
    const r = Math.round(35 + t * 205);
    const g = Math.round(222 + t * 20);
    const b = Math.round(40 - t * 20);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow to Intense Red/Magenta
    const t = (norm - 0.88) / 0.12;
    const r = Math.round(240 + t * 15);
    const g = Math.round(242 - t * 180);
    const b = Math.round(20 + t * 50);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export default function WaterfallSpectrogram({ points = [], activeBand = null }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const lastPointsRef = useRef([]);

  useEffect(() => {
    if (!points || points.length === 0) return;

    // Check if points changed
    if (JSON.stringify(points) === JSON.stringify(lastPointsRef.current)) {
      return;
    }
    lastPointsRef.current = points;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const scrollStep = 3; // Scroll down 3 pixels per frame

    // 1. Shift canvas content downwards
    ctx.drawImage(
      canvas,
      0, 0, width, height - scrollStep,
      0, scrollStep, width, height - scrollStep
    );

    // 2. Draw the new top row slice
    const numPoints = points.length;
    const sliceWidth = width / numPoints;

    for (let i = 0; i < numPoints; i++) {
      const pt = points[i];
      ctx.fillStyle = amplitudeToColor(pt.amplitude);
      ctx.fillRect(Math.floor(i * sliceWidth), 0, Math.ceil(sliceWidth) + 1, scrollStep);
    }
  }, [points]);

  return (
    <div
      ref={containerRef}
      className="bg-slate-900 border border-slate-700/80 rounded-xl p-4 shadow-xl flex flex-col"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
            2D Waterfall Spectrogram (Time vs. Frequency)
          </h2>
        </div>

        {/* Heatmap color scale bar */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span>-95 dBm</span>
          <div
            className="w-36 h-2.5 rounded-full border border-slate-700 shadow-inner"
            style={{
              background:
                "linear-gradient(to right, #0b0f2e, #1e1b4b, #06b6d4, #22c55e, #eab308, #ef4444)",
            }}
          />
          <span className="text-red-400 font-semibold">-25 dBm</span>
        </div>
      </div>

      {/* Canvas Display */}
      <div className="relative w-full rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
        <canvas
          ref={canvasRef}
          width={800}
          height={220}
          className="w-full h-48 block"
        />

        {/* Tuned Band Highlight Overlay */}
        {activeBand && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none border-x-2 border-amber-400/80 bg-amber-400/10 transition-all duration-300 flex items-start justify-center"
            style={{
              left: `${Math.max(0, ((activeBand.start_frequency - 100) / 900) * 100)}%`,
              width: `${Math.max(2, ((activeBand.end_frequency - activeBand.start_frequency) / 900) * 100)}%`,
            }}
          >
            <span className="text-[9px] font-mono font-bold bg-amber-500 text-slate-950 px-1 py-0.5 rounded shadow">
              Tuned Band #{activeBand.id}
            </span>
          </div>
        )}

        {/* Time label on the side */}
        <div className="absolute left-2 top-2 text-[10px] font-mono text-cyan-400/80 bg-slate-950/70 px-1.5 py-0.5 rounded border border-cyan-500/20 pointer-events-none">
          ▼ Time Falling (Recent → Older)
        </div>
      </div>

      {/* Frequency Axis Labels */}
      <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mt-2 px-1">
        <span>100 MHz</span>
        <span>250 MHz</span>
        <span>400 MHz</span>
        <span>550 MHz</span>
        <span>700 MHz</span>
        <span>850 MHz</span>
        <span>1000 MHz</span>
      </div>
    </div>
  );
}
