"""
Feature Engineering Module

Provides optimized feature engineering and preprocessing for insurance lead data
with enhanced performance, caching, and quality controls.

Version: 1.0.0
"""

import numpy as np  # version: 1.24+
import pandas as pd  # version: 2.0+
from sklearn.preprocessing import StandardScaler, LabelEncoder, MinMaxScaler  # version: 1.3+
from sklearn.feature_extraction.text import TfidfVectorizer, HashingVectorizer  # version: 1.3+
import joblib  # version: 1.3+
from typing import Dict, Any, Union, Tuple
from ..config.model_config import ModelConfig

# Global caches for preprocessors and encoders
CATEGORICAL_ENCODERS: Dict[str, Union[LabelEncoder, Dict[str, int]]] = {}
TEXT_VECTORIZERS: Dict[str, Union[TfidfVectorizer, HashingVectorizer]] = {}
NUMERICAL_SCALERS: Dict[str, Union[StandardScaler, MinMaxScaler]] = {}
PREPROCESSOR_CACHE: Dict[str, Any] = {}
FEATURE_IMPORTANCE: Dict[str, float] = {}

class FeatureEngineer:
    """
    Enhanced feature engineering pipeline with optimized preprocessing,
    caching, and quality controls for insurance lead data.
    """
    
    def __init__(self, vertical: str, use_cache: bool = True) -> None:
        """
        Initialize feature engineering pipeline with caching and monitoring.

        Args:
            vertical (str): Insurance vertical (auto, home, etc.)
            use_cache (bool): Enable preprocessor caching

        Raises:
            ValueError: If vertical configuration is invalid
        """
        self._config = ModelConfig(vertical)
        self._feature_config = self._config.get_feature_config()
        self._cache_config = self._config.get_cache_config()
        self._encoders = {}
        self._vectorizers = {}
        self._scalers = {}
        self._feature_stats = {
            'numerical': {},
            'categorical': {},
            'text': {}
        }
        
        # Initialize preprocessors with validation
        self._initialize_preprocessors()
        
        # Enable caching if requested
        self._use_cache = use_cache and bool(self._cache_config.get('enable_cache'))

    def transform_features(self, lead_data: pd.DataFrame, return_importance: bool = False) -> Tuple[np.ndarray, Dict]:
        """
        Transform raw lead data into model-ready features with optimized performance.

        Args:
            lead_data (pd.DataFrame): Raw lead data
            return_importance (bool): Include feature importance scores

        Returns:
            Tuple[np.ndarray, Dict]: Transformed features and importance scores

        Raises:
            ValueError: If input data is invalid
        """
        # Validate input data
        self._validate_input_data(lead_data)
        
        # Check cache for existing transformations
        cache_key = self._generate_cache_key(lead_data)
        if self._use_cache and cache_key in PREPROCESSOR_CACHE:
            return PREPROCESSOR_CACHE[cache_key]
        
        # Split features by type
        numerical_data = lead_data[self._feature_config['numerical_features']]
        categorical_data = lead_data[self._feature_config['categorical_features']]
        text_data = lead_data[self._feature_config['text_features']]
        
        # Process features in parallel using joblib
        transformed_features = joblib.Parallel(n_jobs=-1)(
            joblib.delayed(self._process_feature_group)(data, feature_type)
            for data, feature_type in [
                (numerical_data, 'numerical'),
                (categorical_data, 'categorical'),
                (text_data, 'text')
            ]
        )
        
        # Combine transformed features
        combined_features = np.hstack(transformed_features)
        
        # Update feature statistics
        self._update_feature_stats(lead_data)
        
        # Calculate importance scores if requested
        importance_scores = {}
        if return_importance:
            importance_scores = self._calculate_feature_importance(combined_features)
        
        # Cache results if enabled
        if self._use_cache:
            PREPROCESSOR_CACHE[cache_key] = (combined_features, importance_scores)
        
        return combined_features, importance_scores

    def preprocess_numerical(self, numerical_data: pd.DataFrame) -> np.ndarray:
        """
        Enhanced numerical feature preprocessing with validation and statistics.

        Args:
            numerical_data (pd.DataFrame): Numerical features

        Returns:
            np.ndarray: Validated and scaled numerical features

        Raises:
            ValueError: If numerical preprocessing fails
        """
        # Validate numerical ranges
        self._validate_numerical_ranges(numerical_data)
        
        # Handle missing values
        numerical_data = numerical_data.fillna(numerical_data.mean())
        
        # Apply scaling based on configuration
        scaling_method = self._feature_config['preprocessing']['scaling']
        if scaling_method == 'standard':
            scaler = StandardScaler()
        else:
            scaler = MinMaxScaler()
            
        scaled_features = scaler.fit_transform(numerical_data)
        
        # Track feature distributions
        self._track_numerical_stats(numerical_data)
        
        return scaled_features

    def preprocess_categorical(self, categorical_data: pd.DataFrame) -> np.ndarray:
        """
        Optimized categorical feature encoding with frequency analysis.

        Args:
            categorical_data (pd.DataFrame): Categorical features

        Returns:
            np.ndarray: Encoded categorical features

        Raises:
            ValueError: If categorical preprocessing fails
        """
        encoded_features = []
        
        for column in categorical_data.columns:
            # Handle rare categories
            value_counts = categorical_data[column].value_counts()
            rare_mask = value_counts < self._feature_config.get('min_category_frequency', 10)
            rare_categories = value_counts[rare_mask].index
            
            # Replace rare categories with 'Other'
            column_data = categorical_data[column].copy()
            column_data[column_data.isin(rare_categories)] = 'Other'
            
            # Apply encoding
            if column not in self._encoders:
                self._encoders[column] = LabelEncoder()
                
            encoded_features.append(
                self._encoders[column].fit_transform(column_data).reshape(-1, 1)
            )
        
        return np.hstack(encoded_features)

    def preprocess_text(self, text_data: pd.DataFrame) -> np.ndarray:
        """
        Advanced text feature processing with multiple vectorizer options.

        Args:
            text_data (pd.DataFrame): Text features

        Returns:
            np.ndarray: Vectorized text features

        Raises:
            ValueError: If text preprocessing fails
        """
        vectorized_features = []
        
        for column in text_data.columns:
            # Clean and normalize text
            cleaned_text = self._clean_text(text_data[column])
            
            # Select vectorizer based on vocabulary size
            if len(set(' '.join(cleaned_text).split())) > 10000:
                vectorizer = HashingVectorizer(n_features=100)
            else:
                vectorizer = TfidfVectorizer(max_features=100)
                
            # Store vectorizer for future use
            self._vectorizers[column] = vectorizer
            
            # Transform text features
            vectorized_features.append(
                vectorizer.fit_transform(cleaned_text).toarray()
            )
        
        return np.hstack(vectorized_features)

    def update_feature_importance(self, importance_scores: Dict) -> bool:
        """
        Track and update feature importance scores.

        Args:
            importance_scores (Dict): New importance scores

        Returns:
            bool: Update success status

        Raises:
            ValueError: If importance scores are invalid
        """
        if not isinstance(importance_scores, dict):
            raise ValueError("Importance scores must be a dictionary")
            
        # Validate score ranges
        if not all(0 <= score <= 1 for score in importance_scores.values()):
            raise ValueError("Importance scores must be between 0 and 1")
            
        # Update global importance tracking
        FEATURE_IMPORTANCE.update(importance_scores)
        
        # Calculate trends and trigger alerts if needed
        self._analyze_importance_trends(importance_scores)
        
        return True

    def _initialize_preprocessors(self) -> None:
        """Initialize and validate all preprocessor components."""
        required_configs = ['numerical_features', 'categorical_features', 'text_features']
        if not all(key in self._feature_config for key in required_configs):
            raise ValueError("Incomplete feature configuration")
            
        # Clear existing preprocessors
        self._encoders.clear()
        self._vectorizers.clear()
        self._scalers.clear()

    def _validate_input_data(self, data: pd.DataFrame) -> None:
        """Validate input data structure and contents."""
        required_columns = (
            self._feature_config['numerical_features'] +
            self._feature_config['categorical_features'] +
            self._feature_config['text_features']
        )
        
        missing_columns = set(required_columns) - set(data.columns)
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")

    def _generate_cache_key(self, data: pd.DataFrame) -> str:
        """Generate unique cache key for input data."""
        return joblib.hash(data)

    def _process_feature_group(self, data: pd.DataFrame, feature_type: str) -> np.ndarray:
        """Process a group of features based on their type."""
        if feature_type == 'numerical':
            return self.preprocess_numerical(data)
        elif feature_type == 'categorical':
            return self.preprocess_categorical(data)
        else:
            return self.preprocess_text(data)

    def _clean_text(self, text_series: pd.Series) -> pd.Series:
        """Clean and normalize text data."""
        return text_series.fillna('').str.lower().str.replace(r'[^\w\s]', '')

    def _track_numerical_stats(self, data: pd.DataFrame) -> None:
        """Track numerical feature statistics."""
        for column in data.columns:
            self._feature_stats['numerical'][column] = {
                'mean': data[column].mean(),
                'std': data[column].std(),
                'min': data[column].min(),
                'max': data[column].max()
            }

    def _validate_numerical_ranges(self, data: pd.DataFrame) -> None:
        """Validate numerical feature ranges."""
        for column in data.columns:
            if data[column].min() < self._feature_config.get('min_values', {}).get(column, float('-inf')):
                raise ValueError(f"Values below minimum threshold in column: {column}")
            if data[column].max() > self._feature_config.get('max_values', {}).get(column, float('inf')):
                raise ValueError(f"Values above maximum threshold in column: {column}")

    def _analyze_importance_trends(self, new_scores: Dict) -> None:
        """Analyze feature importance trends and trigger alerts if needed."""
        for feature, score in new_scores.items():
            if feature in FEATURE_IMPORTANCE:
                change = abs(score - FEATURE_IMPORTANCE[feature])
                if change > self._feature_config.get('importance_change_threshold', 0.2):
                    self._trigger_importance_alert(feature, change)

    def _trigger_importance_alert(self, feature: str, change: float) -> None:
        """Trigger alert for significant feature importance changes."""
        # Alert implementation would go here
        pass

    def _calculate_feature_importance(self, features: np.ndarray) -> Dict:
        """Calculate feature importance scores."""
        # Implementation would depend on the specific importance calculation method
        return {}