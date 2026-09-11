// DetectionLog.jsx
//
// Mission Event Audit Log showing timestamped spectrum scan events,
// signal classifications, SNR link quality, anomaly alerts, and CSV export.

"use client";

import { useState, useMemo } from "react";
import { getExportCsvUrl } from "../lib/api";

export default function DetectionLog({ events = [] }) {
  const [filterType, setFilterType] = useState("all"); // "all" | "hits" | "alerts"
  const [searchQuery, setSearchQuery] = useState("");

  const handleExportCsv = () => {
    const downloadUrl = getExportCsvUrl();
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", "spectrum_scan_session.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const isAlert = ev.threat_level === "ALERT" || ev.is_anomaly;
      const isHit = ev.signal_detected;

      if (filterType === "hits" && !isHit) return false;
      if (filterType === "alerts" && !isAlert) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSignal = ev.signal_type?.toLowerCase().includes(query);
        const matchesBand = `band ${ev.band_id}`.toLowerCase().includes(query) || `${ev.band_id}` === query;
        const matchesFreq = ev.freq_range?.toLowerCase().includes(query);
        const matchesThreat = ev.threat_level?.toLowerCase().includes(query);
        return matchesSignal || matchesBand || matchesFreq || matchesThreat;
      }

      return true;
    });
  }, [events, filterType, searchQuery]);

  return (
    <div className="bg-panel border border-panelBorder rounded-xl p-4 shadow-xl space-y-3">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-100">
            Mission Detection &amp; Audit Log
          </h2>
          <span className="text-xs font-mono bg-slate-950 text-cyan-300 border border-slate-800 px-2.5 py-0.5 rounded-full font-bold">
            {events.length} Events
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCsv}
            disabled={events.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/60 disabled:opacity-40 rounded-lg text-xs font-semibold font-mono transition shadow-sm"
            title="Download full CSV session log for lab reports"
          >
            <span>📥</span>
            <span>Export CSV Audit</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 mr-1">Filter:</span>
          {[
            { id: "all", label: "All Logs" },
            { id: "hits", label: "🎯 Signal Hits" },
            { id: "alerts", label: "🚨 Threat Alerts" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-2.5 py-1 rounded-lg border transition ${
                filterType === tab.id
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/80 font-bold"
                  : "bg-slate-950/70 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search log records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:border-cyan-500/70 w-44"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1 text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-xl border border-slate-800/90 bg-slate-950/70">
        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs font-mono">
            {events.length === 0
              ? "No scan events recorded yet. Start scanning to capture live RF telemetry."
              : "No scan events match the selected filters."}
          </div>
        ) : (
          <table className="w-full text-left text-xs font-mono">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur text-slate-400 border-b border-slate-800 z-10">
              <tr>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Mode</th>
                <th className="py-2.5 px-3">Band</th>
                <th className="py-2.5 px-3">Frequency Range</th>
                <th className="py-2.5 px-3">Detected Emitter</th>
                <th className="py-2.5 px-3 text-right">SNR (dB)</th>
                <th className="py-2.5 px-3 text-center">Threat Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredEvents.map((ev) => {
                const isAlert = ev.threat_level === "ALERT" || ev.is_anomaly;
                const isWatch = ev.threat_level === "WATCH";
                const isHit = ev.signal_detected;

                return (
                  <tr
                    key={ev.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isAlert ? "bg-rose-950/20" : ""
                    }`}
                  >
                    <td className="py-2 px-3 text-slate-400">{ev.timestamp}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          ev.mode === "smart"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {ev.mode?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-200">
                      Band #{ev.band_id}
                    </td>
                    <td className="py-2 px-3 text-slate-400">{ev.freq_range}</td>
                    <td className="py-2 px-3">
                      {isHit ? (
                        <span
                          className={`font-semibold ${
                            isAlert
                              ? "text-rose-400"
                              : isWatch
                              ? "text-amber-300"
                              : "text-emerald-300"
                          }`}
                        >
                          {ev.signal_type}
                        </span>
                      ) : (
                        <span className="text-slate-500">Noise Floor (Clear)</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-bold">
                      {isHit ? (
                        <span className="text-cyan-300">+{ev.snr_db} dB</span>
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          isAlert
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                            : isWatch
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : isHit
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {ev.threat_level}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
