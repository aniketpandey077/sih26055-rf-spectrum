"""
main.py

FastAPI backend for SIH26055 Intelligent RF Spectrum Scanning System.
Orchestrates:
1. Virtual RF Simulation & Receiver Sampling
2. 16-Algorithm Closed-Loop Decision Engine & XAI
3. Algorithm 17: Prediction-Reality Gap (PRG) Counter-Deception Engine (COGNIWAR)
4. Dynamic Machine Learning Model Switching (LogReg vs RF vs XGBoost)
5. Comparative Strategy Benchmarking (Sequential vs Random vs Smart)
6. SQLite Persistent Audit Trail & CSV Export

All endpoints are strictly non-blocking, typed, and fully documented.
"""

from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Response, Query
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from simulator.spectrum import generate_bands
from simulator.signals import generate_spectrum_points
from simulator.receiver import scan_band
from decision.scanner import scanner_system
from decision.prg_engine import prg_engine
from models.model_manager import model_manager
from evaluation.benchmark import run_strategy_benchmark
from database.db import (
    get_recent_scans,
    get_latest_model_benchmarks,
    get_latest_strategy_benchmarks,
)

# -----------------------------------------------------------------------------
# FastAPI Application Initialization
# -----------------------------------------------------------------------------
app = FastAPI(
    title="SIH26055 Intelligent RF Spectrum Scanner",
    description="Adaptive RF Spectrum Scanning & Smart Detection System (Simulation)",
    version="2.0.0"
)

# -----------------------------------------------------------------------------
# CORS & Chrome Private Network Access (PNA) Headers
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_private_network_headers(request, call_next):
    """
    Ensures Chrome preflight checks (PNA) succeed when frontend at localhost:3000
    fetches from backend at 127.0.0.1:8000 or localhost:8000.
    """
    if request.method == "OPTIONS":
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Private-Network": "true",
            },
        )
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


# =============================================================================
# 1. CORE SYSTEM & HEALTH CHECK ENDPOINTS
# =============================================================================

@app.get("/")
def read_root():
    """Sanity-check root endpoint."""
    return {
        "system": "SIH26055 Intelligent RF Spectrum Scanner",
        "status": "operational",
        "pipeline": "17-Algorithm Closed-Loop Adaptive Spectrum Controller",
        "simulated": True
    }


@app.get("/health")
def health_check():
    """
    Health check for frontend connection badge.
    Returns operational status, active ML predictor model, and current FSM strategy state.
    """
    return {
        "status": "healthy",
        "active_model": model_manager.active_model_name,
        "strategy_state": scanner_system.strategy_controller.state
    }


# =============================================================================
# 2. VIRTUAL SPECTRUM & PHYSICAL RF ENVIRONMENT
# =============================================================================

@app.get("/bands")
def get_bands():
    """Returns all 18 simulated frequency bands (100 MHz to 1000 MHz, 50 MHz each)."""
    return generate_bands()


@app.get("/spectrum")
def get_spectrum():
    """Returns dense RF spectrum curve points for real-time waveform visualization."""
    return {"points": generate_spectrum_points()}


# =============================================================================
# 3. CLOSED-LOOP SCANNER & DECISION ENGINE ENDPOINTS (Algorithms 1-16)
# =============================================================================

@app.post("/scan/next-step")
def scan_next_step(mode: str = "smart"):
    """
    Executes one discrete scan step using requested strategy ('smart', 'normal', or 'random').
    Returns chosen band, simulated RF observation, XAI factor breakdown, and performance stats.
    """
    if mode not in ("smart", "normal", "random"):
        raise HTTPException(
            status_code=400,
            detail="Mode must be 'smart', 'normal', or 'random'."
        )
    return scanner_system.step(mode=mode)


@app.get("/scan/stats")
def get_scan_stats():
    """Returns comparative scanning metrics across Normal, Random, and Smart modes."""
    return scanner_system.stats


@app.post("/scan/reset-stats")
def reset_scan_stats():
    """Resets all runtime scanner memory, detectors, stats, and tick counters."""
    scanner_system.reset()
    return {
        "message": "Scanner reset successfully",
        "stats": scanner_system.stats,
        "current_tick": scanner_system.current_tick
    }


@app.get("/scan/events")
def get_scan_events(limit: int = 50):
    """Returns recent scan events from the in-memory chronological audit buffer."""
    return scanner_system.get_events(limit=limit)


@app.get("/scan/xai-rankings")
def get_xai_rankings():
    """Returns current multi-factor priority scores, weights, and XAI factor rankings for all bands."""
    return {
        "strategy_state": scanner_system.strategy_controller.state,
        "weights": scanner_system.strategy_controller.get_weights(),
        "active_model": model_manager.active_model_name,
        "rankings": scanner_system.get_rankings()
    }


@app.get("/scan/export")
def export_scan_csv():
    """Downloads historical scan session audit records as CSV for lab reporting."""
    csv_data = scanner_system.export_csv()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=rf_spectrum_scan_session.csv"},
    )


@app.get("/scan/{band_id}")
def scan_single_band(band_id: int):
    """
    Manually samples a single band directly with PRG feedback & XAI justification.
    """
    result = scan_band(band_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Band {band_id} does not exist in simulated spectrum."
        )
    is_hit = bool(result["signal_detected"])
    power = float(result["signal_strength"]) if result["signal_strength"] is not None else float(result["noise_level"])
    prg_event = prg_engine.record_scan(band_id=band_id, signal_detected=is_hit, signal_strength=power)

    return {
        **result,
        "prg": prg_event,
        "fsm_state": prg_engine.fsm_state,
        "xai_justification": prg_event["justification"],
        "tick": prg_engine.current_tick,
    }


# =============================================================================
# 4. ALGORITHM 17: PREDICTION-REALITY GAP (PRG) ENGINE (COGNIWAR)
# =============================================================================

@app.get("/smart-scan")
def prg_smart_scan():
    """PRG engine's recommended next band + full multi-factor score breakdown."""
    return prg_engine.get_recommendation()


@app.get("/prg-status")
def prg_status():
    """All 18 bands' PRG suspicion scores, FSM state, and suspicious bands list."""
    return prg_engine.get_status()


@app.post("/reset")
@app.post("/prg/reset")
def reset_all_state():
    """Wipes both master scanner and PRG engine state for a fresh mission session."""
    scanner_system.reset()
    prg_engine.reset()
    return {
        "message": "Engine reset successfully.",
        "fsm_state": prg_engine.fsm_state,
        "current_tick": prg_engine.current_tick,
    }


@app.get("/cogniwar", response_class=HTMLResponse)
@app.get("/prg-dashboard", response_class=HTMLResponse)
def get_cogniwar_dashboard():
    """Serves the self-contained Algorithm 17 PRG Canvas Dashboard HTML."""
    html_path = Path(__file__).resolve().parent / "cogniwar_dashboard.html"
    if html_path.exists():
        return HTMLResponse(content=html_path.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>Dashboard HTML not found</h1>", status_code=404)


# =============================================================================
# 5. ML MODEL PREDICTOR MANAGEMENT (Algorithm 2 & 14)
# =============================================================================

@app.get("/models/benchmarks")
def get_model_benchmarks():
    """Returns accuracy, precision, recall, F1, and latency across LogReg, RF, and XGBoost."""
    return model_manager.get_benchmarks()


@app.get("/models/active")
def get_active_model():
    """Returns currently selected ML model."""
    return {"active_model": model_manager.active_model_name}


@app.post("/models/switch")
def switch_model(model_name: str = Query(..., description="logistic_regression | random_forest | xgboost")):
    """Switches the active ML predictor for runtime inference."""
    try:
        res = model_manager.set_active_model(model_name)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# 6. COMPARATIVE STRATEGY BENCHMARKING (Algorithm 15)
# =============================================================================

@app.post("/benchmark/run")
def trigger_strategy_benchmark(num_steps: int = 150):
    """
    Runs a rigorous comparative benchmark across Sequential, Random, and Smart Adaptive.
    Returns efficiency gains, wasted scans saved, and detection latency.
    """
    if num_steps < 20 or num_steps > 1000:
        raise HTTPException(status_code=400, detail="num_steps must be between 20 and 1000.")
    return run_strategy_benchmark(num_steps=num_steps)


@app.get("/benchmark/latest")
def get_latest_benchmarks():
    """Returns the most recent strategy comparison benchmarks from SQLite."""
    benchmarks = get_latest_strategy_benchmarks()
    return {"latest_benchmarks": benchmarks}


# =============================================================================
# 7. SQLITE PERSISTENCE QUERIES
# =============================================================================

@app.get("/database/scans")
def query_db_scans(limit: int = 50):
    """Queries persistent SQLite database for historical scans with XAI factors."""
    return {"scans": get_recent_scans(limit=limit)}
