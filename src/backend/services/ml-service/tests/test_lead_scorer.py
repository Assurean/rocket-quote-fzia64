import pytest
import numpy as np
import pandas as pd
from unittest.mock import Mock, patch
from datetime import datetime

from ..src.models.lead_scorer import LeadScorer
from ..src.utils.feature_engineering import FeatureEngineer
from ..src.config.model_config import ModelConfig

# Test data constants
TEST_DATA = {
    'auto': {
        'age': 30,
        'driving_years': 10,
        'vehicle_age': 5,
        'annual_mileage': 12000,
        'vehicle_make': 'Toyota',
        'vehicle_model': 'Camry',
        'usage_type': 'personal',
        'coverage_type': 'full',
        'occupation': 'engineer',
        'location': 'California'
    },
    'home': {
        'property_type': 'single_family',
        'year_built': 1990,
        'square_feet': 2000,
        'construction_type': 'frame',
        'roof_type': 'composition',
        'location': 'Florida'
    },
    'health': {
        'age': 45,
        'gender': 'F',
        'tobacco_use': False,
        'health_conditions': ['none'],
        'coverage_type': 'family',
        'location': 'Texas'
    },
    'life': {
        'age': 35,
        'gender': 'M',
        'tobacco_use': False,
        'health_class': 'preferred',
        'coverage_amount': 500000,
        'term_length': 20
    }
}

EXPECTED_SCORES = {
    'auto': 0.85,
    'home': 0.75,
    'health': 0.7,
    'life': 0.8
}

@pytest.mark.usefixtures('test_env')
class TestLeadScorer:
    """Comprehensive test suite for LeadScorer implementation."""

    def setUp(self):
        """Set up test environment before each test."""
        self.mock_config = Mock(spec=ModelConfig)
        self.mock_config.get_model_path.return_value = '/tmp/test_model'
        self.mock_config.get_scoring_threshold.return_value = 0.7
        
        self.performance_metrics = {
            'latency': [],
            'memory_usage': [],
            'cpu_usage': []
        }

    def tearDown(self):
        """Clean up test environment after each test."""
        self.performance_metrics.clear()

    @pytest.mark.parametrize('vertical', ['auto', 'home', 'health', 'life'])
    def test_lead_scorer_initialization(self, vertical):
        """Test LeadScorer initialization across verticals."""
        with patch('src.models.lead_scorer.ModelConfig') as mock_config:
            mock_config.return_value = self.mock_config
            
            scorer = LeadScorer(vertical=vertical)
            
            assert scorer._config == self.mock_config
            assert scorer._model is not None
            assert scorer._threshold == 0.7
            assert isinstance(scorer._feature_engineer, FeatureEngineer)

    @pytest.mark.parametrize('vertical,test_data', TEST_DATA.items())
    def test_score_lead(self, vertical, test_data):
        """Test lead scoring functionality."""
        with patch('src.models.lead_scorer.ModelConfig') as mock_config:
            mock_config.return_value = self.mock_config
            
            scorer = LeadScorer(vertical=vertical)
            
            # Test scoring
            result = scorer.score_lead(test_data)
            
            # Validate response structure
            assert isinstance(result, dict)
            assert all(key in result for key in ['score', 'price', 'confidence', 'feature_importance', 'latency_ms'])
            
            # Validate score range
            assert 0 <= result['score'] <= 1
            
            # Validate price calculation
            assert result['price'] > 0
            assert isinstance(result['price'], float)
            
            # Validate performance
            assert result['latency_ms'] < 500  # 500ms SLA requirement

    @pytest.mark.performance
    def test_scoring_performance(self):
        """Test scoring system performance."""
        scorer = LeadScorer(vertical='auto')
        test_data = TEST_DATA['auto']
        
        # Test batch scoring performance
        batch_size = 100
        start_time = datetime.now()
        
        for _ in range(batch_size):
            result = scorer.score_lead(test_data)
            self.performance_metrics['latency'].append(result['latency_ms'])
        
        total_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Validate performance metrics
        assert max(self.performance_metrics['latency']) < 500  # Max latency
        assert total_time / batch_size < 100  # Average latency
        assert len(self.performance_metrics['latency']) == batch_size

    def test_model_reload(self):
        """Test model reloading functionality."""
        scorer = LeadScorer(vertical='auto')
        initial_model = scorer._model
        
        # Test model reload
        success = scorer.reload_model()
        assert success
        assert scorer._model is not None
        assert scorer._model != initial_model  # Should be a new model instance
        
        # Verify threshold update
        assert scorer._threshold == self.mock_config.get_scoring_threshold()

    def test_threshold_updates(self):
        """Test threshold adjustment functionality."""
        scorer = LeadScorer(vertical='auto')
        initial_threshold = scorer._threshold
        
        # Test valid threshold update
        new_threshold = 0.75
        success = scorer.update_threshold(new_threshold)
        assert success
        assert scorer._threshold == new_threshold
        
        # Test invalid threshold
        with pytest.raises(ValueError):
            scorer.update_threshold(1.5)
        
        # Test force update
        extreme_threshold = 0.95
        success = scorer.update_threshold(extreme_threshold, force_update=True)
        assert success
        assert scorer._threshold == extreme_threshold

    def test_error_handling(self):
        """Test error handling scenarios."""
        scorer = LeadScorer(vertical='auto')
        
        # Test missing required fields
        invalid_data = {'age': 30}  # Missing required fields
        with pytest.raises(ValueError):
            scorer.score_lead(invalid_data)
        
        # Test invalid data types
        invalid_type_data = TEST_DATA['auto'].copy()
        invalid_type_data['age'] = 'invalid'
        with pytest.raises(ValueError):
            scorer.score_lead(invalid_type_data)
        
        # Test boundary conditions
        boundary_data = TEST_DATA['auto'].copy()
        boundary_data['age'] = -1
        with pytest.raises(ValueError):
            scorer.score_lead(boundary_data)
        
        # Test model reload failure
        with patch('src.models.lead_scorer.joblib.load', side_effect=Exception('Model load failed')):
            with pytest.raises(ValueError):
                scorer.reload_model()