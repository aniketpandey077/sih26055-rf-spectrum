"""
model_manager.py

Manages lifecycle and runtime switching of active ML models:
- Logistic Regression
- Random Forest
- XGBoost
"""

from pathlib import Path
from typing import Dict, Any, Optional
import joblib
from config import MODEL_DIR, ACTIVE_ML_MODEL
from models.predict import ActivityPredictor
from database.db import get_latest_model_benchmarks


class ModelManager:
    """
    Loads trained models from disk and switches active model for inference.
    """

    def __init__(self, default_model: str = ACTIVE_ML_MODEL):
        self.active_model_name = default_model
        self.loaded_models: Dict[str, Any] = {}
        self.predictors: Dict[str, ActivityPredictor] = {}
        self._load_all_models()

    def _load_all_models(self):
        """Pre-load available trained models."""
        for name in ["logistic_regression", "random_forest", "xgboost"]:
            model_file = MODEL_DIR / f"{name}.joblib"
            if model_file.exists():
                try:
                    loaded = joblib.load(model_file)
                    self.loaded_models[name] = loaded
                    self.predictors[name] = ActivityPredictor(loaded, model_name=name)
                except Exception as e:
                    print(f"Warning: could not load model {name}: {e}")

    def get_active_predictor(self) -> ActivityPredictor:
        """Return the predictor corresponding to the currently active model."""
        if self.active_model_name in self.predictors:
            return self.predictors[self.active_model_name]
        
        # Fallback to any loaded model
        if self.predictors:
            fallback_name = next(iter(self.predictors))
            return self.predictors[fallback_name]
        
        raise RuntimeError("No trained ML models are available. Please run train.py first.")

    def set_active_model(self, model_name: str) -> Dict[str, Any]:
        """Switch active model."""
        if model_name not in ["logistic_regression", "random_forest", "xgboost"]:
            raise ValueError(f"Unknown model name: {model_name}")
        
        if model_name not in self.predictors:
            model_file = MODEL_DIR / f"{model_name}.joblib"
            if model_file.exists():
                loaded = joblib.load(model_file)
                self.loaded_models[model_name] = loaded
                self.predictors[model_name] = ActivityPredictor(loaded, model_name=model_name)
            else:
                raise FileNotFoundError(f"Model checkpoint {model_file} not found.")

        self.active_model_name = model_name
        return {"status": "success", "active_model": model_name}

    def get_benchmarks(self) -> Dict[str, Any]:
        """Return benchmark comparison for all models from SQLite."""
        benchmarks = get_latest_model_benchmarks()
        return {
            "active_model": self.active_model_name,
            "models": benchmarks
        }


# Global singleton manager
model_manager = ModelManager()
