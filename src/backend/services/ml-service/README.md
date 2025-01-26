# ML Service Documentation

## Overview

The ML Service is a high-performance machine learning system providing real-time lead scoring, dynamic pricing, and model management capabilities across multiple insurance verticals. Built with FastAPI and LightGBM, it delivers enterprise-grade ML operations with comprehensive monitoring and optimization.

## Requirements

### System Requirements
- Python 3.11+
- 4+ CPU cores recommended
- 8GB+ RAM
- GPU support optional but recommended

### Dependencies
```python
fastapi==0.100.0  # High-performance API framework
lightgbm==4.0.0   # Gradient boosting framework
prometheus_client==0.17.0  # Metrics collection
numpy==1.24.0     # Numerical computations
pandas==2.0.0     # Data manipulation
scikit-learn==1.3.0  # ML utilities
pydantic==2.0.0   # Data validation
uvicorn==0.22.0   # ASGI server
```

## Installation

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
```bash
export MODEL_PATH=/opt/ml/models
export LOG_LEVEL=INFO
export METRICS_PORT=9090
export CACHE_CONFIG='{"enable":true,"ttl":3600}'
export MONITORING_CONFIG='{"alerts":true,"thresholds":{"latency_ms":500}}'
```

## Configuration

### Model Configuration
```yaml
model_base_path: /opt/ml/models
default_scoring_threshold: 0.65
feature_config:
  auto:
    numerical_features: [age, driving_years, vehicle_age, annual_mileage]
    categorical_features: [vehicle_make, vehicle_model, usage_type]
    text_features: [occupation, location]
  home:
    numerical_features: [property_age, square_footage, property_value]
    categorical_features: [construction_type, roof_type, property_type]
    text_features: [address, security_features]
```

### Performance Optimization
```yaml
cache:
  enable: true
  ttl: 3600
  max_size: 10000
scaling:
  min_instances: 2
  max_instances: 10
  target_cpu_util: 70
```

## API Documentation

### Lead Scoring Endpoint
```python
POST /api/v1/score
Content-Type: application/json

{
  "vertical": "auto",
  "lead_data": {
    "age": 35,
    "driving_years": 15,
    "vehicle_age": 5,
    "vehicle_make": "Toyota",
    "occupation": "Engineer"
  }
}

Response:
{
  "score": 0.85,
  "confidence": 0.92,
  "price": 125.50,
  "market_factors": {"peak_hours": 1.2},
  "model_version": "1.0.0"
}
```

### Model Management
```python
POST /api/v1/models/reload
Authorization: Bearer <token>

Response:
{
  "status": "success",
  "versions": {
    "auto": "1.0.0",
    "home": "1.0.1"
  }
}
```

## Model Management

### Model Versioning
- Models stored in `/opt/ml/models/<vertical>/v<version>`
- Version format: `major.minor.patch`
- Hot-reloading supported via API

### Model Monitoring
```python
# Prometheus metrics
ml_scoring_latency_seconds  # Lead scoring latency
ml_scoring_errors_total     # Scoring errors by type
ml_model_performance        # Model performance metrics
```

## Metrics

### Core Metrics
- Scoring latency (target <500ms)
- Lead acceptance rate (target >40%)
- Model performance (AUC, precision, recall)
- Error rates and types

### Prometheus Configuration
```yaml
metrics_port: 9090
path: /metrics
labels:
  vertical: [auto, home, health, life]
  environment: [prod, staging]
```

## Development

### Testing
```bash
# Unit tests
pytest tests/unit

# Integration tests
pytest tests/integration

# Performance tests
locust -f tests/performance/locustfile.py
```

### Code Style
- Black formatting
- Type hints required
- Docstrings in Google format
- 80% test coverage minimum

## Deployment

### Kubernetes Configuration
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ml-service
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: ml-service
        image: ml-service:1.0.0
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
        env:
        - name: MODEL_PATH
          value: /opt/ml/models
        - name: METRICS_PORT
          value: "9090"
```

### Health Checks
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Performance Optimization

### Caching Strategy
- Model predictions cached with TTL
- Feature encoders cached in memory
- Redis cache for high-traffic deployments

### Resource Management
- Automatic horizontal scaling
- Memory-optimized instances
- GPU acceleration support

## Security

### Authentication
- JWT-based API authentication
- Role-based access control
- API key rotation every 30 days

### Data Protection
- PII encryption at rest
- TLS 1.3 in transit
- Model artifact signing

## Monitoring and Alerts

### Alert Thresholds
```yaml
alerts:
  latency:
    threshold_ms: 500
    window: 5m
  error_rate:
    threshold: 0.01
    window: 15m
  model_drift:
    threshold: 0.1
    window: 1h
```

### Dashboards
- Real-time scoring metrics
- Model performance trends
- Resource utilization
- Error rates and patterns

## Troubleshooting

### Common Issues
1. High latency
   - Check resource utilization
   - Verify cache hit rates
   - Monitor batch sizes

2. Scoring errors
   - Validate input data
   - Check model versions
   - Review error logs

3. Model performance
   - Monitor feature distributions
   - Check for data drift
   - Validate scoring thresholds

## Support

### Contact
- ML Team: ml-team@example.com
- DevOps: devops@example.com
- Emergency: oncall@example.com

### Documentation
- API Specs: /docs/api
- Model Documentation: /docs/models
- Runbooks: /docs/runbooks