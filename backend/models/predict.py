"""
predict.py

Inference engine for RF spectrum activity prediction.
Given a zero-leakage feature vector for band(s), returns:
1. P(active) in [0, 1]
2. Prediction uncertainty: 4 * p * (1 - p) in [0, 1] (Algorithm 5)
"""

from typing import Tuple, Dict, Any
import numpy as np


def compute_uncertainty(probabilities: np.ndarray) -> np.ndarray:
    """
    Algorithm 5: Uncertainty & Information Value Estimation
    Uncertainty(p) = 4 * p * (1 - p)
    - Peaks at 1.0 when p = 0.5 (maximum entropy / ambiguity)
    - Reaches 0.0 when p -> 0.0 or p -> 1.0 (certain state)
    """
    return 4.0 * probabilities * (1.0 - probabilities)


class ActivityPredictor:
    """
    Wraps a trained scikit-learn / xgboost model for fast vectorized inference.
    """

    def __init__(self, model: Any, model_name: str = "random_forest"):
        self.model = model
        self.model_name = model_name

    def predict(self, feature_matrix: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Input: feature matrix of shape (N, num_features)
        Returns:
            probabilities: shape (N,) P(active)
            uncertainties: shape (N,) Uncertainty in [0, 1]
        """
        if hasattr(self.model, "predict_proba"):
            probs = self.model.predict_proba(feature_matrix)[:, 1]
        else:
            probs = self.model.predict(feature_matrix)
        
        probs = np.clip(probs, 0.0, 1.0)
        uncertainties = compute_uncertainty(probs)
        return probs, uncertainties
