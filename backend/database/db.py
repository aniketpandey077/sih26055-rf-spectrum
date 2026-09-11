"""
db.py

SQLite persistence layer for the SIH26055 Intelligent RF Spectrum Scanner.
Manages:
1. Historical scan events
2. Explainable AI (XAI) decision breakdowns per step
3. Model evaluation benchmarks (LogReg vs. RF vs. XGBoost)
4. Scanning strategy comparison benchmarks (Sequential vs. Random vs. Smart)
"""

import sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional
from config import DB_PATH


def get_connection() -> sqlite3.Connection:
    """Return a SQLite connection with row factory enabled."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create all required tables and indexes if they do not already exist."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        tick INTEGER NOT NULL,
        mode TEXT NOT NULL,
        band_id INTEGER NOT NULL,
        freq_range TEXT NOT NULL,
        signal_detected INTEGER NOT NULL,
        signal_strength REAL NOT NULL,
        noise_level REAL NOT NULL,
        signal_type TEXT NOT NULL,
        modulation TEXT NOT NULL,
        snr_db REAL NOT NULL,
        threat_level TEXT NOT NULL,
        is_anomaly INTEGER NOT NULL,
        strategy_state TEXT DEFAULT 'NORMAL'
    );

    CREATE INDEX IF NOT EXISTS idx_scans_tick ON scans(tick);
    CREATE INDEX IF NOT EXISTS idx_scans_band_id ON scans(band_id);

    CREATE TABLE IF NOT EXISTS decisions_xai (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id INTEGER,
        tick INTEGER NOT NULL,
        band_id INTEGER NOT NULL,
        activity_prob REAL NOT NULL,
        uncertainty_score REAL NOT NULL,
        anomaly_score REAL NOT NULL,
        info_score REAL NOT NULL,
        freshness_score REAL NOT NULL,
        priority_score REAL NOT NULL,
        top_reason TEXT NOT NULL,
        FOREIGN KEY(scan_id) REFERENCES scans(id)
    );

    CREATE INDEX IF NOT EXISTS idx_xai_tick ON decisions_xai(tick);

    CREATE TABLE IF NOT EXISTS model_benchmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        model_name TEXT NOT NULL,
        accuracy REAL NOT NULL,
        precision REAL NOT NULL,
        recall REAL NOT NULL,
        f1_score REAL NOT NULL,
        auc_roc REAL NOT NULL,
        inference_time_ms REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS strategy_benchmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        strategy TEXT NOT NULL,
        total_scans INTEGER NOT NULL,
        signal_hits INTEGER NOT NULL,
        hit_rate_pct REAL NOT NULL,
        wasted_scans INTEGER NOT NULL,
        avg_latency_ticks REAL NOT NULL,
        band_coverage_pct REAL NOT NULL
    );
    """)

    conn.commit()
    conn.close()


def insert_scan_event(event: Dict[str, Any], strategy_state: str = "NORMAL") -> int:
    """Insert a single scan event into the database and return the row id."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO scans (
            timestamp, tick, mode, band_id, freq_range, signal_detected,
            signal_strength, noise_level, signal_type, modulation,
            snr_db, threat_level, is_anomaly, strategy_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        event.get("timestamp", datetime.now().strftime("%H:%M:%S")),
        event["tick"],
        event["mode"],
        event["band_id"],
        event.get("freq_range", ""),
        1 if event.get("signal_detected") else 0,
        float(event.get("signal_strength", -100.0)),
        float(event.get("noise_level", -100.0)),
        event.get("signal_type", "Noise Floor"),
        event.get("modulation", "None"),
        float(event.get("snr_db", 0.0)),
        event.get("threat_level", "CLEAR"),
        1 if event.get("is_anomaly") else 0,
        strategy_state
    ))

    scan_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return scan_id


def insert_xai_decision(scan_id: Optional[int], tick: int, band_id: int,
                        factors: Dict[str, Any], top_reason: str):
    """Insert an XAI decision factor record."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO decisions_xai (
            scan_id, tick, band_id, activity_prob, uncertainty_score,
            anomaly_score, info_score, freshness_score, priority_score, top_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        scan_id,
        tick,
        band_id,
        float(factors.get("activity_prob", 0.0)),
        float(factors.get("uncertainty_score", 0.0)),
        float(factors.get("anomaly_score", 0.0)),
        float(factors.get("info_score", 0.0)),
        float(factors.get("freshness_score", 0.0)),
        float(factors.get("priority_score", 0.0)),
        top_reason
    ))

    conn.commit()
    conn.close()


def insert_model_benchmark(data: Dict[str, Any]):
    """Insert model evaluation metrics into SQLite."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO model_benchmarks (
            timestamp, model_name, accuracy, precision, recall,
            f1_score, auc_roc, inference_time_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("timestamp", datetime.now().isoformat()),
        data["model_name"],
        float(data.get("accuracy", 0.0)),
        float(data.get("precision", 0.0)),
        float(data.get("recall", 0.0)),
        float(data.get("f1_score", 0.0)),
        float(data.get("auc_roc", 0.0)),
        float(data.get("inference_time_ms", 0.0))
    ))

    conn.commit()
    conn.close()


def insert_strategy_benchmark(data: Dict[str, Any]):
    """Insert strategy comparison benchmark metrics."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO strategy_benchmarks (
            timestamp, strategy, total_scans, signal_hits,
            hit_rate_pct, wasted_scans, avg_latency_ticks, band_coverage_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("timestamp", datetime.now().isoformat()),
        data["strategy"],
        int(data["total_scans"]),
        int(data["signal_hits"]),
        float(data["hit_rate_pct"]),
        int(data["wasted_scans"]),
        float(data.get("avg_latency_ticks", 0.0)),
        float(data.get("band_coverage_pct", 100.0))
    ))

    conn.commit()
    conn.close()


def get_recent_scans(limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve the most recent N scans with their XAI explanations if available."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT s.*, x.activity_prob, x.uncertainty_score, x.anomaly_score,
               x.info_score, x.freshness_score, x.priority_score, x.top_reason
        FROM scans s
        LEFT JOIN decisions_xai x ON s.id = x.scan_id
        ORDER BY s.id DESC
        LIMIT ?
    """, (limit,))

    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_latest_model_benchmarks() -> List[Dict[str, Any]]:
    """Retrieve the latest benchmark score for each evaluated ML model."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM model_benchmarks
        WHERE id IN (
            SELECT MAX(id) FROM model_benchmarks GROUP BY model_name
        )
        ORDER BY f1_score DESC
    """)

    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_latest_strategy_benchmarks() -> List[Dict[str, Any]]:
    """Retrieve the latest strategy comparison scores."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM strategy_benchmarks
        WHERE id IN (
            SELECT MAX(id) FROM strategy_benchmarks GROUP BY strategy
        )
        ORDER BY hit_rate_pct DESC
    """)

    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# Auto-initialize tables when module is imported
init_db()
