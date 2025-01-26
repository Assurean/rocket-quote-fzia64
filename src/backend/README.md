# Multi-Vertical Insurance Lead Generation Platform - Backend

## Overview

Enterprise-grade microservices architecture for processing, validating, scoring, and distributing insurance leads across multiple verticals with real-time bidding capabilities.

## Architecture

### Core Services

- **Lead Service** (Node.js 20 LTS)
  - Lead intake and processing
  - Real-time validation
  - ML scoring integration
  - Event distribution

- **Campaign Service** (Node.js 20 LTS)
  - Campaign management
  - Lead matching
  - Budget tracking
  - Performance analytics

- **Validation Service** (Node.js 20 LTS)
  - Data verification
  - Third-party integrations
  - Field encryption
  - Compliance checks

- **ML Service** (Python 3.11+)
  - Lead scoring
  - Price optimization
  - Behavioral analysis
  - Model training

- **RTB Service** (Go 1.21+)
  - Real-time bidding
  - Click wall optimization
  - Partner integrations
  - Bid aggregation

### Data Layer

- **MongoDB** (v6.0)
  - Lead storage
  - Sharded clusters
  - Field-level encryption
  - Time-series collections

- **PostgreSQL** (v15)
  - Campaign data
  - Financial transactions
  - Audit logs
  - Analytics

- **Redis** (v7.0)
  - Session caching
  - Rate limiting
  - Real-time queues
  - Pub/sub events

- **Elasticsearch** (v8.0)
  - Search indexing
  - Analytics
  - Log aggregation
  - Performance metrics

### Message Broker

- **Kafka** (v7.0)
  - Event streaming
  - Service communication
  - Data pipeline
  - Audit logging

## Development Setup

### Prerequisites

```bash
# Required software versions
Node.js >= 20.0.0
npm >= 9.0.0
Docker >= 24.0.0
Docker Compose >= 3.9
```

### Local Environment Setup

```bash
# Clone repository
git clone git@github.com:insurance-platform/backend.git
cd backend

# Install dependencies
npm install

# Bootstrap services
npm run bootstrap

# Start development environment
docker-compose up -d
```

### Environment Configuration

Create `.env` files for each service based on provided templates:

```bash
cp .env.example services/lead-service/.env
cp .env.example services/campaign-service/.env
cp .env.example services/validation-service/.env
```

## Development Workflow

### Building Services

```bash
# Build all services
npm run build

# Build specific service
npm run build --scope=@insurance-platform/lead-service
```

### Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific service tests
npm run test --scope=@insurance-platform/campaign-service
```

### Code Quality

```bash
# Lint all code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Deployment

### Container Images

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Push to registry
docker-compose -f docker-compose.prod.yml push
```

### Kubernetes Deployment

```bash
# Apply configurations
kubectl apply -f k8s/

# Verify deployments
kubectl get pods -n insurance-platform
```

## Monitoring

### Health Checks

- Lead Service: `http://localhost:3001/health`
- Campaign Service: `http://localhost:3002/health`
- Validation Service: `http://localhost:3003/health`

### Metrics

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`

### Logging

- ELK Stack
  - Elasticsearch: `http://localhost:9200`
  - Kibana: `http://localhost:5601`

## Security

### Authentication

- OAuth 2.0 + JWT for API authentication
- mTLS for service-to-service communication
- API keys for external integrations

### Encryption

- TLS 1.3 for all external communication
- Field-level encryption for PII
- At-rest encryption for all data stores

### Compliance

- GDPR compliance built-in
- CCPA data handling
- SOC 2 audit readiness
- PCI DSS standards

## API Documentation

- OpenAPI Specs: `http://localhost:3000/api-docs`
- Postman Collection: `docs/postman/insurance-platform.json`

## Performance

### Service Level Objectives (SLOs)

- Response Time: < 500ms (p95)
- Availability: 99.9%
- Error Rate: < 0.1%

### Scaling Parameters

- CPU Threshold: 70%
- Memory Threshold: 80%
- Concurrent Users: 10,000+

## Contributing

### Code Standards

- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Conventional commits

### Pull Request Process

1. Branch naming: `feature/`, `bugfix/`, `hotfix/`
2. Required reviews: 2
3. CI checks must pass
4. Up-to-date documentation

## License

UNLICENSED - Copyright (c) 2024 Insurance Platform Team