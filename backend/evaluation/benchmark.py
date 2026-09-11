"""
benchmark.py

Algorithm 14 & 15: Comparative Strategy Benchmarking Engine.
Runs identical controlled simulation trials across:
1. Sequential Sweep (Normal)
2. Uniform Random (Random)
3. Smart Adaptive (Ours - 16 Algorithms)

Measures:
- Hit Rate (%)
- Wasted Scans Saved (%)
- Detection Latency (Ticks)
- Band Coverage (%)
Stores benchmark records in SQLite database `strategy_benchmarks`.
"""

import copy
from datetime import datetime
from typing import Dict, Any, List
from decision.scanner import SpectrumScannerSystem
from database.db import insert_strategy_benchmark, get_latest_strategy_benchmarks


def run_strategy_benchmark(num_steps: int = 200) -> Dict[str, Any]:
    """
    Execute benchmark across Sequential, Random, and Smart strategies.
    Uses independent scanner instances running through the exact same sequence.
    """
    strategies = ["normal", "random", "smart"]
    results = {}

    for strat in strategies:
        scanner = SpectrumScannerSystem()
        scanner.reset()

        visited_bands = set()
        for _ in range(num_steps):
            step_res = scanner.step(mode=strat)
            visited_bands.add(step_res["target_band_id"])

        strat_stats = scanner.stats[strat]
        total = strat_stats["total_scans"]
        hits = strat_stats["signal_hits"]
        wasted = strat_stats["wasted_scans"]
        hit_rate = round((hits / max(1, total)) * 100.0, 1)
        coverage_pct = round((len(visited_bands) / scanner.total_bands) * 100.0, 1)

        # Average latency approximation: inversely related to hit frequency
        avg_latency = round((total / max(1, hits)), 2)

        data = {
            "timestamp": datetime.now().isoformat(),
            "strategy": strat,
            "strategy_label": {
                "normal": "Sequential Sweep",
                "random": "Uniform Random",
                "smart": "Smart Adaptive (16-Algo)",
            }[strat],
            "total_scans": total,
            "signal_hits": hits,
            "hit_rate_pct": hit_rate,
            "wasted_scans": wasted,
            "avg_latency_ticks": avg_latency,
            "band_coverage_pct": coverage_pct,
        }

        # Persist to SQLite
        insert_strategy_benchmark(data)
        results[strat] = data

    # Calculate comparative gains of Smart over Sequential and Random
    normal_hit_rate = results["normal"]["hit_rate_pct"]
    smart_hit_rate = results["smart"]["hit_rate_pct"]
    efficiency_gain_pct = round(smart_hit_rate - normal_hit_rate, 1)
    wasted_scans_saved = results["normal"]["wasted_scans"] - results["smart"]["wasted_scans"]

    comparison = {
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "num_steps": num_steps,
        "strategies": results,
        "summary": {
            "efficiency_gain_pct": efficiency_gain_pct,
            "wasted_scans_saved": max(0, wasted_scans_saved),
            "smart_advantage": (
                f"Smart Adaptive achieved {smart_hit_rate}% hit rate vs {normal_hit_rate}% "
                f"for Sequential (+{efficiency_gain_pct}% advantage, saving {max(0, wasted_scans_saved)} wasted scans)."
            )
        }
    }

    return comparison


if __name__ == "__main__":
    comp = run_strategy_benchmark(num_steps=200)
    print("Benchmark Results:", comp["summary"]["smart_advantage"])
