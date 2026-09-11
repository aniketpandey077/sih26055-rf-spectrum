// BandList.jsx
//
// Shows all 18 simulated RF spectrum bands with ITU service allocations,
// live tuned indicator, PRG suspicion badge, search/filter, and instant scan trigger.

"use client";

import { useState, useMemo } from "react";
import { BAND_SERVICES } from "../lib/constants";

export default function BandList({
  bands = [],
  onScan,
  activeBandId,
  loadingBandId,
  isAutoRunning,
  prgStatus,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // Create PRG suspicion lookup map: { [band_id]: BandStatus }
  const prgMap = useMemo(() => {
    const map = {};
    if (prgStatus?.bands) {
      prgStatus.bands.forEach((b) => {
        map[b.band_id] = b;
      });
    }
    return map;
  }, [prgStatus]);

  // Filter bands based on search query and active category filter
  const filteredBands = useMemo(() => {
    return bands.filter((band) => {
      const info = BAND_SERVICES[band.id] || { tag: "RF Channel", category: "RF" };
      const matchesSearch =
        `Band ${band.id}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        info.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${band.start_frequency}`.includes(searchTerm) ||
        `${band.end_frequency}`.includes(searchTerm);

      const matchesCat =
        filterCategory === "all" ||
        (filterCategory === "suspicious" && (prgMap[band.id]?.prg_score > 0)) ||
        info.category.toLowerCase() === filterCategory.toLowerCase();

      return matchesSearch && matchesCat;
    });
  }, [bands, searchTerm, filterCategory, prgMap]);

  if (!bands || bands.length === 0) {
    return <p className="text-sm text-slate-500 font-mono py-4 text-center">No bands discovered.</p>;
  }

  return (
    <div className="space-y-3">
      {/* 1. Search & Quick Filter Controls */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Search band or service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-mono bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1.5 text-xs text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-mono no-scrollbar">
          {[
            { id: "all", label: "All (18)" },
            { id: "suspicious", label: "🚨 Suspicious" },
            { id: "Aero", label: "✈️ Aero" },
            { id: "Cellular", label: "📶 4G/5G" },
            { id: "Drone", label: "🛸 Drone" },
            { id: "Tactical", label: "🛡️ Tactical" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-2 py-0.5 rounded border transition shrink-0 ${
                filterCategory === cat.id
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/80 font-bold"
                  : "bg-slate-950/60 text-slate-400 border-slate-800/80 hover:text-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Band Cards Scrollable Container */}
      <div className="max-h-[380px] overflow-y-auto pr-1 space-y-2">
        {filteredBands.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 font-mono">
            No matching frequency bands found.
          </div>
        ) : (
          filteredBands.map((band) => {
            const isActive = activeBandId === band.id;
            const info = BAND_SERVICES[band.id] || {
              tag: "General RF",
              category: "RF",
              color: "text-slate-300 border-slate-700 bg-slate-900",
            };
            const prgInfo = prgMap[band.id];
            const isSuspicious = prgInfo && prgInfo.prg_score > 0;
            const isLoading = loadingBandId === band.id;

            return (
              <div
                key={band.id}
                className={`flex items-center justify-between rounded-lg border p-2.5 transition-all duration-200 ${
                  isActive
                    ? "border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-500 shadow-md shadow-cyan-950/50"
                    : isSuspicious
                    ? "border-red-500/50 bg-red-950/15 hover:border-red-400/80"
                    : "border-slate-800/80 bg-slate-950/50 hover:border-slate-700/90 hover:bg-slate-900/40"
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  {/* Active / Suspicious Status Indicator Dot */}
                  <div className="relative flex items-center justify-center shrink-0 w-3 h-3">
                    {isActive ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                      </>
                    ) : isSuspicious ? (
                      <span className="inline-flex rounded-full h-2 w-2 bg-red-500 animate-pulse"></span>
                    ) : (
                      <span className="inline-flex rounded-full h-1.5 w-1.5 bg-slate-600"></span>
                    )}
                  </div>

                  {/* Band Meta */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-100 font-mono">
                        Band #{band.id}
                      </span>

                      {isActive && (
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 bg-cyan-950/90 text-cyan-300 border border-cyan-500/60 rounded font-bold animate-pulse">
                          TUNED
                        </span>
                      )}

                      {isSuspicious && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 bg-red-950/90 text-red-300 border border-red-600/70 rounded font-bold">
                          🚨 PRG {prgInfo.prg_score.toFixed(1)}
                        </span>
                      )}

                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border truncate max-w-[130px] ${info.color}`}>
                        {info.tag}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {band.start_frequency} &ndash; {band.end_frequency} MHz
                    </p>
                  </div>
                </div>

                {/* Quick Manual Scan Action Button */}
                <button
                  onClick={() => onScan(band.id)}
                  disabled={isAutoRunning || isLoading}
                  className={`text-[11px] font-mono font-bold px-3 py-1.5 rounded-lg transition-all shrink-0 ml-2 ${
                    isAutoRunning
                      ? "bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800"
                      : isActive
                      ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-sm shadow-cyan-400/40"
                      : "bg-slate-900 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/50"
                  }`}
                >
                  {isLoading ? "SCAN..." : "SCAN"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
