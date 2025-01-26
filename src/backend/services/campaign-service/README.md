# Campaign Service

Enterprise-grade campaign management microservice for the Multi-Vertical Insurance Lead Generation Platform.

## Overview

The Campaign Service provides comprehensive campaign lifecycle management with real-time analytics, sophisticated filtering, and optimized lead distribution capabilities.

## Features

- Campaign CRUD operations with validation
- Real-time campaign performance monitoring
- Sophisticated filter management
- Budget tracking and optimization
- Distributed caching with Redis
- Circuit breaker pattern implementation
- Comprehensive metrics collection
- Sharded MongoDB storage

## Prerequisites

- Node.js v20 LTS
- MongoDB v6.0+
- Redis v7.0+
- Docker v24+
- Kubernetes v1.27+

## Installation

```bash
# Install dependencies
npm install

# Build service
npm run build

# Run tests
npm test
```

## Environment Variables

```bash
# Required
MONGODB_URI=mongodb://localhost:27017/campaigns
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
NODE_ENV=development

# Optional
METRICS_ENABLED=true
CACHE_TTL=300
CIRCUIT_BREAKER_TIMEOUT=5000
```

## API Documentation

### Create Campaign
```typescript
POST /api/v1/campaigns

Request:
{
  "buyerId": string,
  "name": string,
  "vertical": "AUTO" | "HOME" | "HEALTH" | "LIFE" | "RENTERS" | "COMMERCIAL",
  "filters": {
    "rules": [{
      "field": string,
      "operator": "EQUALS" | "NOT_EQUALS" | "GREATER_THAN" | "LESS_THAN" | "IN" | "NOT_IN" | "CONTAINS" | "NOT_CONTAINS",
      "value": any
    }],
    "matchType": "ALL" | "ANY"
  },
  "maxCpl": number,
  "dailyBudget": number
}

Response:
{
  "id": string,
  "status": "DRAFT",
  ...request
}
```

### Update Campaign
```typescript
PUT /api/v1/campaigns/:id

Request:
{
  "name?": string,
  "filters?": {
    "rules": Array<FilterRule>,
    "matchType": "ALL" | "ANY"
  },
  "maxCpl?": number,
  "dailyBudget?": number,
  "status?": "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "DELETED"
}

Response:
{
  "id": string,
  ...updatedFields
}
```

### List Campaigns
```typescript
GET /api/v1/campaigns

Query Parameters:
- buyerId?: string
- vertical?: InsuranceVertical
- status?: CampaignStatus[]
- page: number
- pageSize: number
- sortBy?: string
- sortOrder?: "asc" | "desc"

Response:
{
  "campaigns": Array<ICampaign>,
  "total": number,
  "page": number,
  "pageSize": number,
  "totalPages": number
}
```

## Development

### Local Development
```bash
# Start development server
npm run dev

# Start with Docker Compose
docker-compose up campaign-service
```

### Testing
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## Deployment

### Docker Build
```bash
docker build -t campaign-service:latest .
```

### Kubernetes Deployment
```bash
# Apply configurations
kubectl apply -f k8s/campaign-service/

# Verify deployment
kubectl get pods -l app=campaign-service
```

## Monitoring

### Metrics
- Campaign creation rate
- Filter evaluation latency
- Cache hit ratio
- Database operation latency
- Circuit breaker status

### Prometheus Metrics
```typescript
# HELP campaign_creation_total Total number of campaigns created
# TYPE campaign_creation_total counter
campaign_creation_total{vertical="AUTO"} 123

# HELP campaign_update_duration_seconds Campaign update operation duration
# TYPE campaign_update_duration_seconds histogram
campaign_update_duration_seconds_bucket{le="0.1"} 42
```

### Health Check
```bash
GET /health

Response:
{
  "status": "UP",
  "checks": {
    "mongodb": "UP",
    "redis": "UP",
    "metrics": "UP"
  }
}
```

## Troubleshooting

### Common Issues

1. MongoDB Connection
```bash
# Check MongoDB status
kubectl exec -it $(kubectl get pod -l app=mongodb -o jsonpath='{.items[0].metadata.name}') -- mongo admin -u admin -p
```

2. Redis Cache
```bash
# Monitor Redis
redis-cli monitor

# Clear cache
redis-cli FLUSHALL
```

3. Circuit Breaker
```bash
# Check circuit breaker metrics
GET /metrics

# Reset circuit breaker
POST /admin/circuit-breaker/reset
```

## Contributing

1. Follow TypeScript best practices
2. Ensure test coverage > 80%
3. Update documentation
4. Submit PR with description

## License

Copyright (c) 2024 Company Name. All rights reserved.