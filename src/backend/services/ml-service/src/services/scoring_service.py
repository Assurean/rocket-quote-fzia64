"""
Core service layer implementing real-time lead scoring, model management, and dynamic pricing logic
across insurance verticals with comprehensive monitoring and thread-safe operations.

Version: 1.0.0
"""

import asyncio  # version: system
import logging  # version: system
import numpy as np  # version: 1.24+
from prometheus_client import Counter, Histogram, Gauge  # version: 0.17+
from typing import Dict

from ..models.lead_scorer import LeadScorer
from ..config.model_config import ModelConfig

# Configure logging
logger = logging.getLogger(__name__)

# Prometheus metrics
SCORING_LATENCY = Histogram('ml_scoring_latency_seconds', 'Lead scoring latency', buckets=[0.1, 0.25, 0.5, 1.0])
SCORING_ERRORS = Counter('ml_scoring_errors_total', 'Lead scoring errors', ['vertical', 'error_type'])
MODEL_VERSIONS = Gauge('ml_model_version', 'Current model version', ['vertical'])

class ScoringService:
    """
    Enhanced service class managing lead scoring operations, model lifecycle, and performance monitoring.
    """
    
    def __init__(self) -> None:
        """
        Initializes scoring service with enhanced configuration and monitoring.
        """
        # Initialize dictionaries for scorers and configs
        self._scorers: Dict[str, LeadScorer] = {}
        self._configs: Dict[str, ModelConfig] = {}
        
        # Create async lock for thread-safe operations
        self._lock = asyncio.Lock()
        
        # Initialize thresholds and market adjustments
        self._thresholds: Dict[str, float] = {}
        self._market_adjustments: Dict[str, Dict] = {}
        
        # Initialize circuit breakers
        self._error_counts: Dict[str, int] = {}
        self._circuit_open: Dict[str, bool] = {}
        
        logger.info("ScoringService initialized successfully")

    @SCORING_LATENCY.time()
    async def score_lead(self, vertical: str, lead_data: Dict) -> Dict:
        """
        Scores a lead using vertical-specific model with market adjustments.
        
        Args:
            vertical: Insurance vertical (auto, home, etc.)
            lead_data: Lead information and features
            
        Returns:
            Dict containing score, confidence, price and market factors
            
        Raises:
            ValueError: If scoring fails or vertical is unsupported
        """
        try:
            # Validate vertical and lead data
            if not vertical or not lead_data:
                raise ValueError("Missing required parameters")
                
            # Check circuit breaker
            if self._circuit_open.get(vertical, False):
                logger.warning(f"Circuit breaker open for vertical: {vertical}")
                return self._get_fallback_score(vertical)
            
            # Get or initialize scorer
            scorer = await self._get_scorer(vertical)
            
            # Generate base score with monitoring
            scoring_result = scorer.score_lead(lead_data)
            
            # Apply market adjustments
            adjusted_score = self._apply_market_adjustments(
                vertical,
                scoring_result['score'],
                scoring_result['confidence']
            )
            
            # Calculate final price
            price = self._calculate_price(
                vertical,
                adjusted_score,
                scoring_result.get('feature_importance', {})
            )
            
            # Record successful scoring
            self._record_success(vertical)
            
            return {
                'score': adjusted_score,
                'original_score': scoring_result['score'],
                'confidence': scoring_result['confidence'],
                'price': price,
                'market_factors': self._market_adjustments.get(vertical, {}),
                'feature_importance': scoring_result.get('feature_importance', {}),
                'model_version': scorer.get_model_version(),
                'threshold': self._thresholds.get(vertical, 0.65)
            }
            
        except Exception as e:
            # Record error and check circuit breaker
            self._record_error(vertical, str(e))
            SCORING_ERRORS.labels(vertical=vertical, error_type=type(e).__name__).inc()
            logger.error(f"Lead scoring failed for vertical {vertical}: {str(e)}")
            raise ValueError(f"Lead scoring failed: {str(e)}")

    async def reload_models(self) -> Dict[str, Dict]:
        """
        Reloads ML models with version validation and monitoring.
        
        Returns:
            Dict containing reload status per vertical including versions
            
        Raises:
            RuntimeError: If model reload fails
        """
        async with self._lock:
            try:
                reload_status = {}
                
                for vertical in self._scorers.keys():
                    try:
                        # Reload model with validation
                        scorer = self._scorers[vertical]
                        success = scorer.reload_model()
                        
                        # Update model version metric
                        MODEL_VERSIONS.labels(vertical=vertical).set(
                            float(scorer.get_model_version())
                        )
                        
                        # Update configuration
                        config = ModelConfig(vertical)
                        self._configs[vertical] = config
                        self._thresholds[vertical] = config.get_scoring_threshold()
                        
                        # Update market adjustments
                        self._market_adjustments[vertical] = config.get_market_adjustments()
                        
                        reload_status[vertical] = {
                            'success': success,
                            'version': scorer.get_model_version(),
                            'threshold': self._thresholds[vertical]
                        }
                        
                        logger.info(f"Successfully reloaded model for vertical: {vertical}")
                        
                    except Exception as e:
                        reload_status[vertical] = {
                            'success': False,
                            'error': str(e)
                        }
                        logger.error(f"Failed to reload model for vertical {vertical}: {str(e)}")
                
                return reload_status
                
            except Exception as e:
                logger.error(f"Model reload failed: {str(e)}")
                raise RuntimeError(f"Model reload failed: {str(e)}")

    async def _get_scorer(self, vertical: str) -> LeadScorer:
        """Initialize or retrieve scorer for vertical with validation."""
        if vertical not in self._scorers:
            async with self._lock:
                if vertical not in self._scorers:
                    self._scorers[vertical] = LeadScorer(vertical)
                    self._configs[vertical] = ModelConfig(vertical)
                    self._thresholds[vertical] = self._configs[vertical].get_scoring_threshold()
                    self._market_adjustments[vertical] = self._configs[vertical].get_market_adjustments()
                    
        return self._scorers[vertical]

    def _apply_market_adjustments(self, vertical: str, score: float, confidence: float) -> float:
        """Apply market-based adjustments to score."""
        adjustments = self._market_adjustments.get(vertical, {})
        adjusted_score = score
        
        for factor, value in adjustments.items():
            if confidence >= 0.8:  # Only apply adjustments with high confidence
                adjusted_score *= value
                
        return np.clip(adjusted_score, 0.0, 1.0)

    def _calculate_price(self, vertical: str, score: float, feature_importance: Dict) -> float:
        """Calculate optimized price based on score and market factors."""
        base_price = 50 + (score * 100)  # Base range $50-150
        
        # Apply vertical-specific multipliers
        multipliers = {
            'auto': 1.0,
            'home': 1.2,
            'health': 1.5,
            'life': 1.8,
            'renters': 0.8,
            'commercial': 2.0
        }
        
        base_price *= multipliers.get(vertical, 1.0)
        
        # Apply feature importance adjustments
        if feature_importance:
            importance_factor = sum(feature_importance.values()) / len(feature_importance)
            base_price *= (0.9 + (importance_factor * 0.2))  # ±10% adjustment
            
        return round(min(max(base_price, 25.0), 500.0), 2)

    def _record_error(self, vertical: str, error: str) -> None:
        """Record error and update circuit breaker status."""
        self._error_counts[vertical] = self._error_counts.get(vertical, 0) + 1
        
        # Open circuit breaker if error threshold reached
        if self._error_counts[vertical] >= 5:  # 5 consecutive errors
            self._circuit_open[vertical] = True
            logger.warning(f"Circuit breaker opened for vertical: {vertical}")

    def _record_success(self, vertical: str) -> None:
        """Record successful operation and reset error count."""
        self._error_counts[vertical] = 0
        self._circuit_open[vertical] = False

    def _get_fallback_score(self, vertical: str) -> Dict:
        """Return fallback scoring result when circuit breaker is open."""
        return {
            'score': 0.5,
            'confidence': 0.3,
            'price': 75.0,
            'market_factors': {},
            'feature_importance': {},
            'model_version': 'fallback',
            'threshold': self._thresholds.get(vertical, 0.65),
            'fallback': True
        }