"""
ML Model Configuration Module

Provides comprehensive configuration management for ML models across insurance verticals
with support for versioning, caching, and performance optimization.

Version: 1.0.0
"""

import os
from typing import Dict, Optional, List, Union, Any
import yaml  # version: 6.0+

# Global Constants
MODEL_BASE_PATH = os.getenv('MODEL_BASE_PATH', '/opt/ml/models')
DEFAULT_SCORING_THRESHOLD = 0.65
CONFIG_VERSION = '1.0.0'

# Feature Configuration for Different Insurance Verticals
FEATURE_CONFIG = {
    'auto': {
        'numerical_features': ['age', 'driving_years', 'vehicle_age', 'annual_mileage'],
        'categorical_features': ['vehicle_make', 'vehicle_model', 'usage_type', 'coverage_type'],
        'text_features': ['occupation', 'location'],
        'feature_weights': {
            'age': 0.15,
            'driving_years': 0.2,
            'vehicle_age': 0.1
        },
        'preprocessing': {
            'scaling': 'standard',
            'encoding': 'label'
        }
    },
    'home': {
        'numerical_features': ['property_age', 'square_footage', 'property_value'],
        'categorical_features': ['construction_type', 'roof_type', 'property_type'],
        'text_features': ['address', 'security_features'],
        'feature_weights': {
            'property_value': 0.25,
            'property_age': 0.15
        },
        'preprocessing': {
            'scaling': 'minmax',
            'encoding': 'onehot'
        }
    }
}

class ModelConfig:
    """
    Configuration manager for ML models providing versioned access to model paths,
    parameters, thresholds, and feature settings with caching support.
    """
    
    def __init__(
        self,
        vertical: str,
        config_override: Optional[Dict] = None,
        enable_caching: bool = True
    ) -> None:
        """
        Initialize configuration for a specific insurance vertical.
        
        Args:
            vertical (str): Insurance vertical (auto, home, etc.)
            config_override (Dict, optional): Override default configuration
            enable_caching (bool): Enable configuration caching
            
        Raises:
            ValueError: If vertical is not supported or configuration is invalid
        """
        if vertical not in FEATURE_CONFIG:
            raise ValueError(f"Unsupported insurance vertical: {vertical}")
            
        self._vertical = vertical
        self._config = FEATURE_CONFIG[vertical].copy()
        self._cache = {} if enable_caching else None
        self._version = float(CONFIG_VERSION)
        
        # Apply configuration override if provided
        if config_override:
            self._validate_config_override(config_override)
            self._config.update(config_override)
            
        # Validate configuration completeness
        self._validate_configuration()

    def get_model_path(self, model_version: Optional[str] = None) -> str:
        """
        Get the path to model artifacts for the vertical.
        
        Args:
            model_version (str, optional): Specific model version
            
        Returns:
            str: Absolute path to model files
            
        Raises:
            FileNotFoundError: If model path does not exist
        """
        cache_key = f"model_path_{model_version}"
        
        # Check cache first
        if self._cache is not None and cache_key in self._cache:
            return self._cache[cache_key]
            
        # Construct base path
        base_path = os.path.join(MODEL_BASE_PATH, self._vertical)
        
        # Add version subdirectory if specified
        if model_version:
            base_path = os.path.join(base_path, f"v{model_version}")
            
        # Validate path exists
        if not os.path.exists(base_path):
            raise FileNotFoundError(f"Model path does not exist: {base_path}")
            
        # Cache result if enabled
        if self._cache is not None:
            self._cache[cache_key] = base_path
            
        return base_path

    def get_scoring_threshold(self) -> float:
        """
        Get the scoring acceptance threshold for the vertical.
        
        Returns:
            float: Scoring threshold value between 0 and 1
            
        Raises:
            ValueError: If threshold is invalid
        """
        cache_key = "scoring_threshold"
        
        # Check cache first
        if self._cache is not None and cache_key in self._cache:
            return self._cache[cache_key]
            
        # Get vertical-specific threshold or default
        threshold = self._config.get('scoring_threshold', DEFAULT_SCORING_THRESHOLD)
        
        # Validate threshold range
        if not 0 <= threshold <= 1:
            raise ValueError(f"Invalid scoring threshold: {threshold}")
            
        # Cache result if enabled
        if self._cache is not None:
            self._cache[cache_key] = threshold
            
        return threshold

    def update_config(self, new_config: Dict[str, Any], persist: bool = False) -> bool:
        """
        Update configuration settings with validation.
        
        Args:
            new_config (Dict): New configuration settings
            persist (bool): Whether to persist changes to disk
            
        Returns:
            bool: Success status
            
        Raises:
            ValueError: If new configuration is invalid
        """
        # Validate new configuration
        self._validate_config_override(new_config)
        
        # Create backup of current config
        old_config = self._config.copy()
        
        try:
            # Update configuration
            self._config.update(new_config)
            
            # Increment version
            self._version += 0.1
            
            # Clear cache if enabled
            if self._cache is not None:
                self._cache.clear()
                
            # Persist changes if requested
            if persist:
                self._persist_configuration()
                
            return True
            
        except Exception as e:
            # Rollback to backup on error
            self._config = old_config
            raise ValueError(f"Failed to update configuration: {str(e)}")

    def _validate_configuration(self) -> None:
        """
        Validate completeness and correctness of configuration.
        
        Raises:
            ValueError: If configuration is invalid
        """
        required_keys = {
            'numerical_features',
            'categorical_features',
            'text_features',
            'feature_weights',
            'preprocessing'
        }
        
        if not all(key in self._config for key in required_keys):
            raise ValueError("Missing required configuration keys")
            
        if not all(isinstance(self._config[key], (list, dict)) for key in required_keys):
            raise ValueError("Invalid configuration value types")

    def _validate_config_override(self, config: Dict) -> None:
        """
        Validate configuration override values.
        
        Args:
            config (Dict): Configuration override to validate
            
        Raises:
            ValueError: If configuration override is invalid
        """
        allowed_keys = set(FEATURE_CONFIG[self._vertical].keys())
        invalid_keys = set(config.keys()) - allowed_keys
        
        if invalid_keys:
            raise ValueError(f"Invalid configuration keys: {invalid_keys}")

    def _persist_configuration(self) -> None:
        """
        Persist configuration changes to disk.
        
        Raises:
            IOError: If configuration cannot be persisted
        """
        config_path = os.path.join(MODEL_BASE_PATH, self._vertical, 'config.yaml')
        
        try:
            with open(config_path, 'w') as f:
                yaml.dump({
                    'version': self._version,
                    'config': self._config
                }, f)
        except Exception as e:
            raise IOError(f"Failed to persist configuration: {str(e)}")