# Validation Service

Enterprise-grade microservice for real-time validation of contact information with TCPA compliance and PII protection.

## Overview

### Service Purpose
The Validation Service is a critical component of the Multi-Vertical Insurance Lead Generation Platform, providing real-time validation of contact information including addresses, email addresses, and phone numbers. It ensures data quality and compliance while maintaining sub-500ms response times.

### Architecture Overview
- Node.js 20.x LTS based microservice
- MongoDB 6.0 for validation history
- Redis 7.0 for rate limiting and caching
- Integrates with USPS API v3 and Twilio
- Implements mTLS and JWT authentication

### Integration Points
- Lead Generation Service
- Compliance Service
- Audit Logging Service
- Third-party validation providers

### Performance Targets
- Response time: <500ms
- Success rate: >95%
- Throughput: 200+ validations/second
- Availability: 99.9%

## Features

### Address Validation
- USPS API integration for US addresses
- Real-time geocoding
- Address standardization
- Unit/apartment validation

### Email Verification
- MX record validation
- Disposable email detection
- Syntax validation
- Domain verification

### Phone Number Validation
- Format validation
- Carrier lookup
- Type detection (mobile/landline)
- Active status verification

### TCPA Compliance
- Do-Not-Call registry check
- Time zone validation
- Consent tracking
- Compliance logging

### Error Handling
- Graceful degradation
- Fallback providers
- Detailed error codes
- Retry mechanisms

## Security

### PII Protection
- AES-256 encryption at rest
- Field-level encryption
- Data masking
- Secure audit trails

### Data Encryption
- TLS 1.3 in transit
- Encrypted storage
- Key rotation
- HSM integration

### Access Control
- mTLS authentication
- JWT authorization
- Role-based access
- IP whitelisting

### Audit Logging
- Request/response logging
- Access logs
- Error logs
- Compliance trails

## Installation

### Prerequisites
- Node.js 20.x LTS
- MongoDB 6.0
- Redis 7.0
- Docker & Kubernetes

### Environment Setup
```bash
# Required environment variables
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
ENCRYPTION_KEY=<secret>

# Optional environment variables
REDIS_URL=redis://localhost:6379
MONGODB_URI=mongodb://localhost:27017/validation
```

### Dependencies
```bash
npm install
npm run build
```

### Configuration
Configuration files located in `/config`:
- `default.json` - Default configuration
- `production.json` - Production overrides
- `test.json` - Testing configuration

## API Documentation

### Authentication
All endpoints require:
- mTLS client certificates
- JWT Bearer token
- API key header

### Endpoints

#### Address Validation
```
POST /v1/validate/address
Content-Type: application/json
Authorization: Bearer <token>

{
  "street": "123 Main St",
  "city": "Anytown",
  "state": "CA",
  "zip": "12345"
}
```

#### Email Validation
```
POST /v1/validate/email
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "user@example.com"
}
```

#### Phone Validation
```
POST /v1/validate/phone
Content-Type: application/json
Authorization: Bearer <token>

{
  "phone": "+1234567890"
}
```

### Rate Limits
- Address: 100/minute
- Email: 200/minute
- Phone: 100/minute

## Development

### Local Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### Testing
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- Load tests: `npm run test:load`
- Coverage: `npm run coverage`

### Code Style
- ESLint configuration
- Prettier formatting
- TypeScript strict mode
- Husky pre-commit hooks

### CI/CD
- GitHub Actions workflows
- Automated testing
- Security scanning
- Docker image builds

## Deployment

### Kubernetes Setup
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: validation-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: validation-service
```

### Scaling
- Horizontal pod autoscaling
- CPU/Memory limits
- Rate limiting per instance
- Load balancing

### Monitoring
- Prometheus metrics
- Grafana dashboards
- ELK stack logging
- Datadog integration

### Disaster Recovery
- Multi-region deployment
- Automated backups
- Failover procedures
- Recovery playbooks

## Troubleshooting

### Known Issues
- Rate limit exceeded
- Third-party service outages
- Network timeouts
- Cache invalidation

### Debug Procedures
1. Check service logs
2. Verify third-party status
3. Monitor error rates
4. Review metrics

### Support Contacts
- Technical Lead: `tech-lead@company.com`
- DevOps: `devops@company.com`
- Security: `security@company.com`

### FAQs
1. How to handle validation failures?
2. What are the retry policies?
3. How to rotate encryption keys?
4. What are the compliance requirements?

## License
Proprietary and Confidential
Copyright © 2024 Company Name