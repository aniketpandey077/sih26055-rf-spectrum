// page.js
//
// SIH26055 - Adaptive RF Spectrum Scanning & Intelligent Decision System
// Main Next.js Dashboard Client.
//
// Core Capabilities:
// 1. Live SDR RF Moving Waveform + 2D Waterfall Spectrogram
// 2. Closed-Loop Scanning Policies: Smart Adaptive (17-Algo) vs. Sequential vs. Random
// 3. Deterministic ITU Signal Classification & RF Anomaly Detection
// 4. Algorithm 17 COGNIWAR Prediction-Reality Gap (PRG) Suspicion Engine
// 5. Explainable AI (XAI) Multi-Armed Bandit Factor Transparency
// 6. Chronological Mission Event Audit Log with CSV Report Export

"use client";

import { useEffect, useState, useRef } from "react";
import StatusBar from "./components/StatusBar";
import SpectrumGraph from "./components/SpectrumGraph";
import WaterfallSpectrogram from "./components/WaterfallSpectrogram";
import BandList from "./components/BandList";
import ScanResultPanel from "./components/ScanResultPanel";
import ComparisonStats from "./components/ComparisonStats";
import DetectionLog from "./components/DetectionLog";
import ExplainableDecisionCard from "./components/ExplainableDecisionCard";
import BenchmarkPanel from "./components/BenchmarkPanel";
import CogniwarPrgPanel from "./components/CogniwarPrgPanel";
import {
  checkHealth,
  getBands,
  getSpectrum,
  scanBand,
  stepAutoScan,
  getScanStats,
  resetScanStats,
  getScanEvents,
  getXaiRankings,
  getPrgStatus,
} from "./lib/api";
import { DWELL_SPEEDS, SCAN_MODES } from "./lib/constants";

export default function Home() {
  // =========================================================================
  // 1. STATE MANAGEMENT
  // =========================================================================

  // Connectivity & Virtual Environment
  const [backendConnected, setBackendConnected] = useState(false);
  const [bands, setBands] = useState([]);
  const [spectrumPoints, setSpectrumPoints] = useState([]);
  const [loadError, setLoadError] = useState(null);

  // Active Scan Results & Hardware SDR Telemetry
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [activeBandId, setActiveBandId] = useState(null);
  const [loadingBandId, setLoadingBandId] = useState(null);

  // Scanning Strategy & Policy State
  const [scanMode, setScanMode] = useState("smart"); // "smart" | "normal" | "random" | "manual"
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [scanSpeedMs, setScanSpeedMs] = useState(900); // 500ms, 900ms, or 1500ms
  const [stats, setStats] = useState({
    normal: { total_scans: 0, signal_hits: 0, wasted_scans: 0, hit_rate_pct: 0 },
    random: { total_scans: 0, signal_hits: 0, wasted_scans: 0, hit_rate_pct: 0 },
    smart: { total_scans: 0, signal_hits: 0, wasted_scans: 0, hit_rate_pct: 0 },
  });

  // Display Visualization Tabs: "split" | "waveform" | "waterfall"
  const [spectrumView, setSpectrumView] = useState("split");

  // Explainable AI (XAI) & Runtime ML Activity Model
  const [xai, setXai] = useState(null);
  const [strategyState, setStrategyState] = useState("NORMAL");
  const [activeModel, setActiveModel] = useState("random_forest");
  const [rankings, setRankings] = useState([]);

  // Algorithm 17 COGNIWAR PRG Suspicion Monitor State
  const [prgInfo, setPrgInfo] = useState(null);
  const [prgStatus, setPrgStatus] = useState(null);

  // Mission Detection Log & Tick Telemetry
  const [events, setEvents] = useState([]);
  const [currentTick, setCurrentTick] = useState(0);

  // Mutable refs for interval access without stale closures
  const isAutoRunningRef = useRef(isAutoRunning);
  isAutoRunningRef.current = isAutoRunning;

  const scanModeRef = useRef(scanMode);
  scanModeRef.current = scanMode;

  // =========================================================================
  // 2. LIFECYCLE & BACKGROUND POLLING
  // =========================================================================

  // Initial dashboard hydration
  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoadError(null);
    try {
      const health = await checkHealth();
      setBackendConnected(true);
      if (health.active_model) setActiveModel(health.active_model);
      if (health.strategy_state) setStrategyState(health.strategy_state);

      const [bandsData, spectrumData, statsData, eventsData, xaiData, prgData] = await Promise.all([
        getBands(),
        getSpectrum(),
        getScanStats().catch(() => null),
        getScanEvents(20).catch(() => []),
        getXaiRankings().catch(() => null),
        getPrgStatus().catch(() => null),
      ]);

      setBands(bandsData || []);
      setSpectrumPoints(spectrumData?.points || []);
      if (statsData) setStats(statsData);
      if (eventsData) setEvents(eventsData);
      if (prgData) setPrgStatus(prgData);
      if (xaiData) {
        setRankings(xaiData.rankings || []);
        if (xaiData.strategy_state) setStrategyState(xaiData.strategy_state);
        if (xaiData.active_model) setActiveModel(xaiData.active_model);
      }
    } catch (err) {
      setBackendConnected(false);
      setLoadError(err.message);
    }
  }

  // Live moving spectrum polling (every 800ms)
  useEffect(() => {
    const liveTimer = setInterval(async () => {
      try {
        const spec = await getSpectrum();
        setSpectrumPoints(spec.points || []);
        setBackendConnected(true);
      } catch (err) {
        setBackendConnected(false);
      }
    }, 800);

    return () => clearInterval(liveTimer);
  }, []);

  // Automated Scanning Loop
  useEffect(() => {
    if (!isAutoRunning || scanMode === "manual" || !backendConnected) {
      return;
    }

    const scanInterval = setInterval(async () => {
      if (!isAutoRunningRef.current || scanModeRef.current === "manual") {
        return;
      }

      try {
        const response = await stepAutoScan(scanModeRef.current);
        setActiveBandId(response.target_band_id);
        setScanResult(response.scan_result);

        if (response.current_tick !== undefined) {
          setCurrentTick(response.current_tick);
        } else {
          setCurrentTick((t) => t + 1);
        }

        if (response.xai) setXai(response.xai);
        if (response.strategy_state) setStrategyState(response.strategy_state);
        if (response.active_model) setActiveModel(response.active_model);
        if (response.rankings) setRankings(response.rankings);
        if (response.prg) setPrgInfo(response.prg);
        if (response.prg_status) setPrgStatus(response.prg_status);
        if (response.stats) setStats(response.stats);

        if (response.event) {
          setEvents((prev) => [response.event, ...prev.slice(0, 49)]);
        }
        setScanError(null);
      } catch (err) {
        setScanError(err.message);
        setIsAutoRunning(false);
      }
    }, scanSpeedMs);

    return () => clearInterval(scanInterval);
  }, [isAutoRunning, scanMode, scanSpeedMs, backendConnected]);

  // =========================================================================
  // 3. ACTION HANDLERS
  // =========================================================================

  // Manual band scan handler
  async function handleManualScan(bandId) {
    setLoadingBandId(bandId);
    setScanError(null);

    try {
      const result = await scanBand(bandId);
      setScanResult(result);
      setActiveBandId(bandId);
      setCurrentTick((t) => t + 1);

      if (result.prg) setPrgInfo(result.prg);
      if (result.fsm_state) setStrategyState(result.fsm_state);

      const freshPrg = await getPrgStatus().catch(() => null);
      if (freshPrg) setPrgStatus(freshPrg);

      // Refresh events audit log
      const updatedEvents = await getScanEvents(20);
      setEvents(updatedEvents);
    } catch (err) {
      setScanError(err.message);
      setScanResult(null);
    } finally {
      setLoadingBandId(null);
    }
  }

  // Reset benchmark stats and clear runtime counters
  async function handleResetStats() {
    try {
      const res = await resetScanStats();
      if (res.stats) setStats(res.stats);
      setScanResult(null);
      setActiveBandId(null);
      setCurrentTick(0);
      setEvents([]);

      const freshPrg = await getPrgStatus().catch(() => null);
      if (freshPrg) setPrgStatus(freshPrg);
    } catch (err) {
      console.error("Failed to reset stats:", err);
    }
  }

  // Derived states
  const activeBand = bands.find((b) => b.id === activeBandId) || null;
  const isCurrentAnomaly = scanResult?.classification?.is_anomaly || false;

  // =========================================================================
  // 4. JSX DASHBOARD LAYOUT
  // =========================================================================

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* HEADER SECTION */}
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs tracking-wide text-accent font-mono font-semibold">
            SIH26055
          </p>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 shadow-sm">
            Phase 5 &bull; 17-Algorithm Pipeline (16-Algo + PRG Engine COGNIWAR) &amp; XAI
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
          Adaptive RF Spectrum Scanning &amp; Intelligent Decision Station
        </h1>
        <p className="text-sm text-slate-400">
          Zero-leakage closed-loop dynamic scanning comparing Sequential Sweep, Random Baseline, and ML-driven Smart Adaptive with full XAI transparency.
        </p>
      </header>

      {/* OPERATIONAL TELEMETRY STATUS BAR */}
      <StatusBar
        backendConnected={backendConnected}
        strategyState={strategyState}
        activeModel={activeModel}
        currentTick={currentTick}
      />

      {/* ANOMALY THREAT ALERT BANNER */}
      {isCurrentAnomaly && (
        <div className="p-3.5 bg-red-950/80 border border-red-500 rounded-xl shadow-lg shadow-red-950/50 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="text-sm font-bold text-red-200">
                CRITICAL RF EMISSION ALERT DETECTED
              </p>
              <p className="text-xs text-red-300 font-mono">
                {scanResult?.classification?.threat_description} in Band #{activeBand?.id} ({activeBand?.start_frequency}&ndash;{activeBand?.end_frequency} MHz)
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-red-600 text-white px-3 py-1 rounded-md uppercase">
            Threat Level: ALERT
          </span>
        </div>
      )}

      {/* COUNTER-DECEPTION FSM ALERT BANNER (Algorithm 17) */}
      {strategyState === "COUNTER_DECEPTION" && (
        <div className="p-3.5 bg-amber-950/80 border border-amber-500 rounded-xl shadow-lg shadow-amber-950/50 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="text-sm font-bold text-amber-200">
                COUNTER-DECEPTION MODE ACTIVE (Algorithm 17: PRG Engine)
              </p>
              <p className="text-xs text-amber-300 font-mono">
                Suspicious silence detected across expected emitter bands. Multipliers applied: Staleness &times; 2.5, PRG &times; 1.5.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-amber-500 text-black px-3 py-1 rounded-md uppercase">
            State: COUNTER_DECEPTION
          </span>
        </div>
      )}

      {/* INDIVIDUAL SUSPICIOUS SILENCE NOTIFICATION */}
      {prgInfo?.suspicious_silence && strategyState !== "COUNTER_DECEPTION" && (
        <div className="p-3 bg-red-950/70 border border-red-500/80 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🚨</span>
            <div>
              <p className="text-xs font-bold text-red-200">
                SUSPICIOUS SILENCE FLAGGED (Algorithm 17 PRG)
              </p>
              <p className="text-[11px] text-red-300 font-mono">
                Band #{prgInfo.band_id} was silent despite expected activity (P(active) = {(prgInfo.p_predicted * 100).toFixed(0)}% &ge; 65%). PRG suspicion: {prgInfo.prg_score} / 3.0.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold bg-red-700 text-white px-2.5 py-1 rounded">
            PRG +1.0
          </span>
        </div>
      )}

      {/* BACKEND CONNECTION ERROR BANNER */}
      {loadError && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-md p-3 flex items-center justify-between">
          <span>{loadError}</span>
          <button
            onClick={loadInitialData}
            className="underline hover:text-red-300 font-medium"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* SCANNER CONTROL TOOLBAR */}
      <section className="bg-panel border border-panelBorder rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        {/* Strategy Selector Buttons */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <span className="text-xs font-medium text-slate-400 mr-1 font-mono">
            Scanning Policy:
          </span>

          {SCAN_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                setScanMode(mode.id);
                if (mode.id === "manual") setIsAutoRunning(false);
              }}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition border ${
                scanMode === mode.id
                  ? mode.activeColor
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Auto-runner controls (Dwell Speed & Play/Pause/Reset) */}
        {scanMode !== "manual" && (
          <div className="flex items-center space-x-3">
            {/* Speed Selector */}
            <div className="flex items-center space-x-1 text-xs font-mono">
              <span className="text-slate-400 mr-1">Dwell Time:</span>
              {DWELL_SPEEDS.map((s) => (
                <button
                  key={s.val}
                  onClick={() => setScanSpeedMs(s.val)}
                  className={`px-2 py-1 rounded text-[11px] font-mono border transition ${
                    scanSpeedMs === s.val
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Play / Pause Toggle Button */}
            <button
              onClick={() => setIsAutoRunning(!isAutoRunning)}
              disabled={!backendConnected}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition flex items-center space-x-1.5 ${
                isAutoRunning
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/60 hover:bg-amber-500/30 ring-1 ring-amber-500/40"
                  : "bg-cyan-400 text-slate-950 font-bold hover:bg-cyan-300 shadow-md shadow-cyan-500/30"
              }`}
            >
              <span>{isAutoRunning ? "⏸ Pause Scanner" : "▶ Start Auto-Scan"}</span>
            </button>

            {/* Quick Reset Action */}
            <button
              onClick={handleResetStats}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 font-mono transition"
              title="Reset all benchmark counters and logs"
            >
              ↺ Reset
            </button>
          </div>
        )}
      </section>

      {/* MAIN DASHBOARD TWO-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT & CENTER COLUMN (2 COLS): SPECTRUM, WATERFALL, XAI, PRG, BENCHMARKS */}
        <div className="lg:col-span-2 space-y-6">
          {/* LIVE SPECTRUM RF VISUALIZER (Waveform + Waterfall) */}
          <section className="bg-panel border border-panelBorder rounded-xl p-4 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                </span>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                  Live Spectrum RF Visualizer
                </h2>
              </div>

              {/* Visualization View Switcher Tabs */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
                {["split", "waveform", "waterfall"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setSpectrumView(v)}
                    className={`px-2.5 py-1 rounded-md transition capitalize ${
                      spectrumView === v
                        ? "bg-cyan-500 text-slate-950 font-bold shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {v === "split" ? "⚡ Split View" : v === "waveform" ? "📊 Waveform" : "🌊 Waterfall"}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Tuned Band Callout */}
            {activeBand && (
              <div className="flex items-center justify-between text-xs font-mono bg-cyan-950/50 border border-cyan-800/40 px-3 py-1.5 rounded-lg text-cyan-300">
                <span>
                  📡 Antenna Tuned: Band #{activeBand.id} ({activeBand.start_frequency}&ndash;{activeBand.end_frequency} MHz)
                </span>
                <span className="text-[11px] text-cyan-400/80 font-bold">
                  {scanResult?.signal_detected ? "SIGNAL LOCKED" : "MONITORING NOISE"}
                </span>
              </div>
            )}

            {/* Waveform Area Chart */}
            {(spectrumView === "split" || spectrumView === "waveform") && (
              <div>
                <SpectrumGraph points={spectrumPoints} activeBand={activeBand} />
              </div>
            )}

            {/* 2D Waterfall Spectrogram */}
            {(spectrumView === "split" || spectrumView === "waterfall") && (
              <div>
                <WaterfallSpectrogram
                  points={spectrumPoints}
                  activeBand={activeBand}
                />
              </div>
            )}
          </section>

          {/* EXPLAINABLE AI (XAI) DECISION ENGINE */}
          <ExplainableDecisionCard
            xai={xai}
            strategyState={strategyState}
            activeModel={activeModel}
            onModelChanged={(m) => setActiveModel(m)}
            rankings={rankings}
          />

          {/* ALGORITHM 17: COGNIWAR PREDICTION-REALITY GAP (PRG) SUSPICION MONITOR */}
          <CogniwarPrgPanel
            prgStatus={prgStatus}
            activeBandId={activeBandId}
            onScanBand={handleManualScan}
            isAutoRunning={isAutoRunning}
          />

          {/* SIDE-BY-SIDE REAL-TIME EFFICIENCY COMPARISON */}
          <ComparisonStats
            stats={stats}
            onReset={handleResetStats}
            currentMode={scanMode}
          />

          {/* RIGOROUS COMPARATIVE BENCHMARK MATRIX */}
          <BenchmarkPanel />
        </div>

        {/* RIGHT COLUMN (1 COL): RECEIVER OBSERVATION + 18-BAND MANAGER */}
        <div className="space-y-6">
          {/* RECEIVER OBSERVATION & CLASSIFIER */}
          <section className="bg-panel border border-panelBorder rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                Receiver Observation
              </h2>
              {isAutoRunning && (
                <span className="text-[10px] font-mono text-emerald-400 animate-pulse font-bold">
                  ● ACTIVE SCAN
                </span>
              )}
            </div>
            <ScanResultPanel result={scanResult} error={scanError} />
          </section>

          {/* 18 FREQUENCY BANDS MANAGER */}
          <section className="bg-panel border border-panelBorder rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                Frequency Bands (18)
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                100 &ndash; 1000 MHz
              </span>
            </div>
            <BandList
              bands={bands}
              onScan={handleManualScan}
              activeBandId={activeBandId}
              loadingBandId={loadingBandId}
              isAutoRunning={isAutoRunning}
              prgStatus={prgStatus}
            />
          </section>
        </div>
      </div>

      {/* FULL-WIDTH MISSION DETECTION & AUDIT LOG */}
      <section>
        <DetectionLog events={events} />
      </section>
    </main>
  );
}
