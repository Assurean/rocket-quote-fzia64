# Multi-Vertical Insurance Lead Generation Platform

## Overview

The Multi-Vertical Insurance Lead Generation Platform is an AI-driven system designed to revolutionize insurance lead generation across Auto, Home, Renters, Health/Medicare, Life, and Commercial verticals. The platform leverages machine learning for dynamic lead scoring and pricing while providing dual monetization through validated lead sales and real-time bidding (RTB) click walls.

### Key Features

- Multi-step form funnels with real-time validation across six insurance verticals
- AI/ML scoring engine for lead quality assessment and dynamic pricing
- RTB integration layer for click wall monetization
- Self-service buyer portal for campaign management
- Microservices architecture supporting high scalability and reliability

### Success Metrics

- Lead Quality: >40% lead acceptance rate
- Monetization: >25% revenue increase vs traditional platforms
- Performance: <500ms average response time
- Scalability: Support 10,000+ concurrent users
- Availability: 99.9% uptime SLA

## Architecture

### Technology Stack

#### Frontend
- React 18.2+ with TypeScript
- Redux Toolkit 2.0+ for state management
- Material-UI 5.0+ component library
- React Hook Form 7.0+ for form handling

#### Backend
- Node.js 20 LTS for Lead and Validation services
- Python 3.11+ for ML Service
- Go 1.21+ for RTB Service
- Express.js 4.18+ and FastAPI 0.100+ frameworks

#### Infrastructure
- AWS EKS for container orchestration
- MongoDB 6.0+ for lead storage
- PostgreSQL 15+ for campaign management
- Redis 7.0+ for session management
- Elasticsearch 8.0+ for analytics

### Security

- Authentication:
  - OAuth 2.0 + JWT for users
  - mTLS for service-to-service communication
  - API keys for external partners
- Data Protection:
  - AES-256 encryption at rest
  - TLS 1.3 for data in transit
  - Field-level encryption for PII
- Compliance:
  - GDPR compliant
  - CCPA compliant
  - SOC 2 certified

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- Python >= 3.11
- Go >= 1.21
- Docker and Docker Compose
- AWS CLI configured with appropriate permissions

### Local Development Setup

1. Clone the repository:
```bash
git clone https://github.com/your-org/insurance-lead-platform.git
cd insurance-lead-platform
```

2. Install dependencies:
```bash
# Install root project dependencies
npm install

# Install service-specific dependencies
cd src/backend/lead-service && npm install
cd src/backend/validation-service && npm install
cd src/backend/ml-service && pip install -r requirements.txt
cd src/backend/rtb-service && go mod download
```

3. Configure environment:
```bash
# Copy example environment files
cp .env.example .env
cp src/backend/lead-service/.env.example src/backend/lead-service/.env
# Repeat for other services
```

4. Start development environment:
```bash
docker-compose up -d
npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific service tests
npm run test:lead-service
npm run test:validation-service
npm run test:ml-service
npm run test:rtb-service
```

## Project Structure

```
├── src/
│   ├── web/                 # Frontend applications
│   │   ├── form-engine/     # Consumer-facing forms
│   │   └── buyer-portal/    # Campaign management interface
│   ├── backend/             # Backend services
│   │   ├── lead-service/    # Lead processing service
│   │   ├── ml-service/      # Machine learning service
│   │   ├── rtb-service/     # Real-time bidding service
│   │   └── validation/      # Data validation service
│   └── shared/              # Shared utilities and types
├── infrastructure/          # Infrastructure as Code
│   ├── terraform/           # AWS resource definitions
│   └── kubernetes/          # K8s manifests
├── docs/                    # Additional documentation
└── scripts/                 # Development utilities
```

## Documentation

- [Backend Services](./src/backend/README.md)
- [Frontend Applications](./src/web/README.md)
- [Infrastructure Setup](./infrastructure/terraform/README.md)

## Troubleshooting

### Common Issues

1. Environment Setup
   - Ensure all required services are running in Docker
   - Verify environment variables are properly configured
   - Check AWS credentials and permissions

2. Service Connectivity
   - Verify service health endpoints
   - Check network configurations
   - Review service logs for errors

3. Development Workflow
   - Clear Docker volumes if data becomes stale
   - Rebuild services after dependency changes
   - Use proper Node.js and Python versions

### Support

For additional support:
1. Review internal documentation in the `docs/` directory
2. Contact the development team on Slack (#lead-platform-dev)
3. Submit issues through JIRA with appropriate labels

## Contributing

Please refer to [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines, code style requirements, and pull request procedures.

## License

Copyright © 2024 Your Organization. All rights reserved.