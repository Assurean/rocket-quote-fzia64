"""
Lead Scoring and Pricing Engine

Advanced ML-based lead scoring and dynamic pricing engine with real-time evaluation,
performance monitoring, and continuous model refinement capabilities.

Version: 1.0.0
"""

import numpy as np  # version: 1.24+
import pandas as pd  # version: 2.0+
import joblib  # version: 1.3+
import lightgbm as lgb  # version: 4.0+
from prometheus_client import Counter, Histogram, Gauge  # version: 0.17+
from typing import Dict, Tuple, Optional
import time
from datetime import datetime

from ..config.model_config import ModelConfig
from ..utils.feature_engineering import FeatureEngineer

# Global model cache to avoid reloading
MODEL_CACHE: Dict[str, Tuple[lgb.Booster, float]] = {}

# Vertical-specific price multipliers
PRICE_MULTIPLIERS = {
    'auto': 1.0,
    'home': 1.2,
    'health': 1.5,
    'life': 1.8,
    'renters': 0.8,
    'commercial': 2.0
}

# Dynamic market adjustments
MARKET_ADJUSTMENTS = {
    'peak_hours': 1.2,
    'off_peak': 0.9,
    'weekend': 1.1,
    'holiday': 1.3
}

# Performance thresholds
PERFORMANCE_THRESHOLDS = {
    'max_latency': 500,  # milliseconds
    'min_acceptance': 0.4,
    'score_threshold': 0.7
}

# Prometheus metrics
SCORING_LATENCY = Histogram('lead_scoring_latency_ms', 'Lead scoring latency in milliseconds')
ACCEPTANCE_RATE = Gauge('lead_acceptance_rate', 'Lead acceptance rate')
SCORING_ERRORS = Counter('lead_scoring_errors_total', 'Total lead scoring errors')

class LeadScorer:
    """
    Advanced ML model for real-time lead scoring and dynamic pricing with performance monitoring.
    """
    
    def __init__(self, vertical: str, enable_monitoring: bool = True) -> None:
        """
        Initialize lead scoring model with monitoring and validation.

        Args:
            vertical (str): Insurance vertical (auto, home, etc.)
            enable_monitoring (bool): Enable performance monitoring

        Raises:
            ValueError: If model initialization fails
        """
        self._config = ModelConfig(vertical)
        self._feature_engineer = FeatureEngineer(vertical)
        self._model = None
        self._threshold = None
        self._performance_metrics = {}
        self._enable_monitoring = enable_monitoring
        
        # Initialize model and thresholds
        self._initialize_model()
        
    def score_lead(self, lead_data: Dict) -> Dict:
        """
        Score and price a lead with performance monitoring.

        Args:
            lead_data (Dict): Lead information and features

        Returns:
            Dict: Score, price, and confidence metrics

        Raises:
            ValueError: If scoring fails
        """
        start_time = time.time()
        
        try:
            # Convert lead data to DataFrame
            df = pd.DataFrame([lead_data])
            
            # Feature engineering
            features, importance = self._feature_engineer.transform_features(
                df, return_importance=True
            )
            
            # Generate prediction
            score = float(self._model.predict(features)[0])
            
            # Calculate price
            price = self.calculate_price(
                score,
                market_conditions=self._get_market_conditions()
            )
            
            # Track performance metrics
            if self._enable_monitoring:
                latency = (time.time() - start_time) * 1000
                SCORING_LATENCY.observe(latency)
                
                if score >= self._threshold:
                    ACCEPTANCE_RATE.inc()
            
            return {
                'score': score,
                'price': price,
                'confidence': self._calculate_confidence(score),
                'feature_importance': importance,
                'threshold': self._threshold,
                'latency_ms': (time.time() - start_time) * 1000
            }
            
        except Exception as e:
            SCORING_ERRORS.inc()
            raise ValueError(f"Lead scoring failed: {str(e)}")

    def calculate_price(self, score: float, market_conditions: Dict) -> float:
        """
        Dynamic price calculation with market adjustments.

        Args:
            score (float): Lead score
            market_conditions (Dict): Current market conditions

        Returns:
            float: Optimized lead price
        """
        # Base price calculation
        base_price = 50 + (score * 100)  # $50-150 range
        
        # Apply vertical multiplier
        vertical = self._config._vertical
        base_price *= PRICE_MULTIPLIERS.get(vertical, 1.0)
        
        # Apply market adjustments
        for condition, adjustment in market_conditions.items():
            if condition in MARKET_ADJUSTMENTS:
                base_price *= MARKET_ADJUSTMENTS[condition]
        
        # Apply seasonal adjustment
        month = datetime.now().month
        seasonal_factor = 1 + (0.1 * (month in [1, 4, 7, 10]))  # 10% boost in key months
        base_price *= seasonal_factor
        
        # Ensure price stays within reasonable bounds
        return round(min(max(base_price, 25.0), 500.0), 2)

    def reload_model(self) -> bool:
        """
        Reload and validate model from disk.

        Returns:
            bool: Success status
        """
        try:
            model_path = self._config.get_model_path()
            
            # Load model with validation
            new_model = joblib.load(model_path)
            
            if not isinstance(new_model, lgb.Booster):
                raise ValueError("Invalid model type")
            
            # Update model and cache
            self._model = new_model
            MODEL_CACHE[self._config._vertical] = (new_model, time.time())
            
            # Update threshold
            self._threshold = self._config.get_scoring_threshold()
            
            return True
            
        except Exception as e:
            SCORING_ERRORS.inc()
            raise ValueError(f"Model reload failed: {str(e)}")

    def update_threshold(self, new_threshold: float, force_update: bool = False) -> bool:
        """
        Update scoring threshold with validation.

        Args:
            new_threshold (float): New threshold value
            force_update (bool): Force update without validation

        Returns:
            bool: Update success status
        """
        if not 0 <= new_threshold <= 1:
            raise ValueError("Threshold must be between 0 and 1")
            
        if not force_update:
            # Validate threshold against historical performance
            if new_threshold > 0.9 or new_threshold < 0.3:
                raise ValueError("Threshold outside acceptable range")
        
        self._threshold = new_threshold
        return True

    def _initialize_model(self) -> None:
        """Initialize and validate model and configuration."""
        vertical = self._config._vertical
        
        # Check cache first
        if vertical in MODEL_CACHE:
            model, cache_time = MODEL_CACHE[vertical]
            if time.time() - cache_time < 3600:  # 1 hour cache
                self._model = model
                self._threshold = self._config.get_scoring_threshold()
                return
        
        # Load model if not in cache
        self.reload_model()

    def _get_market_conditions(self) -> Dict:
        """Get current market conditions for pricing adjustments."""
        hour = datetime.now().hour
        day = datetime.now().weekday()
        
        conditions = {}
        
        # Peak hours (9AM-5PM weekdays)
        if 9 <= hour <= 17 and day < 5:
            conditions['peak_hours'] = True
        else:
            conditions['off_peak'] = True
            
        # Weekend adjustment
        if day >= 5:
            conditions['weekend'] = True
            
        return conditions

    def _calculate_confidence(self, score: float) -> float:
        """Calculate confidence level for the score."""
        # Higher confidence near extreme values
        if score > 0.8 or score < 0.2:
            return 0.9
        # Medium confidence in mid-range
        elif 0.4 <= score <= 0.6:
            return 0.7
        # Default confidence
        return 0.8