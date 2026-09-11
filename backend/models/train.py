"""
train.py

Trains and compares the 3 ML activity predictors:
1. Logistic Regression (Linear baseline)
2. Random Forest (Ensemble Bagging)
3. XGBoost (Gradient Boosted Decision Trees)

Ensures ZERO DATA LEAKAGE:
Dataset is generated tick-by-tick where features at tick t are extracted
strictly from historical observations up to t-1.
"""

import time
import random
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from datetime import datetime
from typing import Dict, Any, Tuple
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
)
import xgboost as xgb

from config import MODEL_DIR, NUMBER_OF_BANDS
from simulator.spectrum import generate_bands
from features.extractor import TemporalHistory, FeatureExtractor, FEATURE_NAMES
from database.db import insert_model_benchmark


from simulator.receiver import scan_band
from simulator.signals import advance_rf_environment, rf_environment


def generate_training_data(num_ticks: int = 1500) -> Tuple[np.ndarray, np.ndarray]:
    """
    Simulate realistic RF transmission duty cycles across 18 bands over time
    by sampling directly from the virtual RF environment and receiver.
    Strict zero data leakage: features at tick t are computed using history
    up to tick t-1.
    """
    rf_environment.reset()
    bands = generate_bands()
    history = TemporalHistory(num_bands=len(bands))

    X_list = []
    y_list = []

    for tick in range(1, num_ticks + 1):
        advance_rf_environment()
        for b in bands:
            bid = b["id"]

            # 1. Feature extraction strictly from past history (before tick t)
            features = FeatureExtractor.extract_vector(b, tick, history)

            # 2. Virtual receiver samples band at tick t
            obs = scan_band(bid)
            is_active = 1 if obs["signal_detected"] else 0
            power = float(obs["signal_strength"]) if obs["signal_strength"] is not None else float(obs["noise_level"])
            is_anomaly = bool(obs.get("classification", {}).get("is_anomaly", False))

            # Warmup buffer of 10 ticks before recording training rows
            if tick > 10:
                X_list.append(features)
                y_list.append(is_active)

            # 3. Update temporal history with this observation
            history.record_observation(
                band_id=bid,
                tick=tick,
                is_hit=(is_active == 1),
                power_dbm=power,
                is_anomaly=is_anomaly
            )

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int32)
    return X, y


def train_and_evaluate_all() -> Dict[str, Dict[str, Any]]:
    """
    Train Logistic Regression, Random Forest, and XGBoost models,
    evaluate them, save checkpoints, and write benchmarks to SQLite.
    """
    print("Generating zero-leakage synthetic RF training dataset...")
    X, y = generate_training_data(num_ticks=1500)

    # Time-series split (first 80% train, last 20% test to prevent temporal leakage)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    print(f"Dataset shape: Train={X_train.shape}, Test={X_test.shape}")
    print(f"Class distribution: Active={np.sum(y)} ({np.mean(y)*100:.1f}%), Idle={len(y)-np.sum(y)}")

    results = {}

    # 1. Logistic Regression
    print("\n--- Training Model 1: Logistic Regression ---")
    lr = LogisticRegression(max_iter=1000, random_state=42)
    t0 = time.perf_counter()
    lr.fit(X_train, y_train)
    train_time = time.perf_counter() - t0

    t0 = time.perf_counter()
    y_pred_lr = lr.predict(X_test)
    y_prob_lr = lr.predict_proba(X_test)[:, 1]
    infer_time_ms = ((time.perf_counter() - t0) / len(X_test)) * 1000.0

    acc_lr = float(accuracy_score(y_test, y_pred_lr))
    prec_lr = float(precision_score(y_test, y_pred_lr, zero_division=0))
    rec_lr = float(recall_score(y_test, y_pred_lr, zero_division=0))
    f1_lr = float(f1_score(y_test, y_pred_lr, zero_division=0))
    auc_lr = float(roc_auc_score(y_test, y_prob_lr))

    results["logistic_regression"] = {
        "model_name": "Logistic Regression",
        "accuracy": round(acc_lr, 4),
        "precision": round(prec_lr, 4),
        "recall": round(rec_lr, 4),
        "f1_score": round(f1_lr, 4),
        "auc_roc": round(auc_lr, 4),
        "inference_time_ms": round(infer_time_ms, 5),
    }
    joblib.dump(lr, MODEL_DIR / "logistic_regression.joblib")
    insert_model_benchmark(results["logistic_regression"])

    # 2. Random Forest
    print("\n--- Training Model 2: Random Forest ---")
    rf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42, n_jobs=-1)
    t0 = time.perf_counter()
    rf.fit(X_train, y_train)
    train_time = time.perf_counter() - t0

    t0 = time.perf_counter()
    y_pred_rf = rf.predict(X_test)
    y_prob_rf = rf.predict_proba(X_test)[:, 1]
    infer_time_ms = ((time.perf_counter() - t0) / len(X_test)) * 1000.0

    acc_rf = float(accuracy_score(y_test, y_pred_rf))
    prec_rf = float(precision_score(y_test, y_pred_rf, zero_division=0))
    rec_rf = float(recall_score(y_test, y_pred_rf, zero_division=0))
    f1_rf = float(f1_score(y_test, y_pred_rf, zero_division=0))
    auc_rf = float(roc_auc_score(y_test, y_prob_rf))

    results["random_forest"] = {
        "model_name": "Random Forest",
        "accuracy": round(acc_rf, 4),
        "precision": round(prec_rf, 4),
        "recall": round(rec_rf, 4),
        "f1_score": round(f1_rf, 4),
        "auc_roc": round(auc_rf, 4),
        "inference_time_ms": round(infer_time_ms, 5),
        "feature_importances": {
            name: round(float(imp), 4)
            for name, imp in zip(FEATURE_NAMES, rf.feature_importances_)
        }
    }
    joblib.dump(rf, MODEL_DIR / "random_forest.joblib")
    insert_model_benchmark(results["random_forest"])

    # 3. XGBoost
    print("\n--- Training Model 3: XGBoost Classifier ---")
    xgb_model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.08,
        eval_metric="logloss",
        random_state=42
    )
    t0 = time.perf_counter()
    xgb_model.fit(X_train, y_train)
    train_time = time.perf_counter() - t0

    t0 = time.perf_counter()
    y_pred_xgb = xgb_model.predict(X_test)
    y_prob_xgb = xgb_model.predict_proba(X_test)[:, 1]
    infer_time_ms = ((time.perf_counter() - t0) / len(X_test)) * 1000.0

    acc_xgb = float(accuracy_score(y_test, y_pred_xgb))
    prec_xgb = float(precision_score(y_test, y_pred_xgb, zero_division=0))
    rec_xgb = float(recall_score(y_test, y_pred_xgb, zero_division=0))
    f1_xgb = float(f1_score(y_test, y_pred_xgb, zero_division=0))
    auc_xgb = float(roc_auc_score(y_test, y_prob_xgb))

    results["xgboost"] = {
        "model_name": "XGBoost",
        "accuracy": round(acc_xgb, 4),
        "precision": round(prec_xgb, 4),
        "recall": round(rec_xgb, 4),
        "f1_score": round(f1_xgb, 4),
        "auc_roc": round(auc_xgb, 4),
        "inference_time_ms": round(infer_time_ms, 5),
        "feature_importances": {
            name: round(float(imp), 4)
            for name, imp in zip(FEATURE_NAMES, xgb_model.feature_importances_)
        }
    }
    joblib.dump(xgb_model, MODEL_DIR / "xgboost.joblib")
    insert_model_benchmark(results["xgboost"])

    print("\n================ ML Training & Benchmark Complete ================")
    for k, v in results.items():
        print(f"[{v['model_name']}] F1: {v['f1_score']} | AUC: {v['auc_roc']} | Acc: {v['accuracy']} | Infer: {v['inference_time_ms']} ms/sample")

    return results


if __name__ == "__main__":
    train_and_evaluate_all()
