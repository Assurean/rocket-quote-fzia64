# Multi-Vertical Insurance Lead Generation Platform Frontend

## Overview

Enterprise-grade React monorepo powering the consumer-facing insurance quote forms and buyer portal applications. Built with a mobile-first approach and optimized for high performance and scalability.

### Key Features
- Mobile-first responsive design supporting 10,000+ concurrent users
- Sub-500ms response time for form interactions
- Real-time bidding (RTB) integration for click wall monetization
- Comprehensive analytics and performance monitoring
- Enterprise-grade security and compliance

## Project Structure

```
src/web/
├── apps/
│   ├── consumer/           # Consumer-facing quote forms
│   │   ├── components/     # Form-specific components
│   │   └── pages/         # Route-based page components
│   └── portal/            # Buyer portal application
│       ├── dashboard/     # Analytics dashboard
│       └── campaigns/     # Campaign management
├── packages/
│   ├── shared/           # Common components and utilities
│   │   ├── components/   # Reusable UI components
│   │   └── hooks/       # Custom React hooks
│   ├── rtb/             # Real-time bidding integration
│   │   ├── services/    # RTB API services
│   │   └── components/  # RTB-specific components
│   └── analytics/       # Analytics and tracking
│       ├── tracking/    # Event tracking
│       └── reporting/   # Analytics visualization
└── package.json         # Root workspace configuration
```

## Getting Started

### Prerequisites
- Node.js v20.x LTS
- Yarn v1.22+
- Docker v24+ (for local development)

### Installation
```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build

# Run tests
yarn test
```

## Development

### Technology Stack
- React v18.2+ - Component library
- TypeScript v5.0+ - Type safety
- Redux Toolkit v2.0+ - State management
- Material-UI v5.0+ - UI framework
- React Hook Form v7.0+ - Form handling
- Jest/Testing Library - Testing framework
- Cypress v13+ - E2E testing

### Code Style
- ESLint configuration with TypeScript support
- Prettier for consistent formatting
- Husky for pre-commit hooks
- Conventional commits enforced

### State Management
- Redux Toolkit for global state
- React Query v5+ for server state
- Context API for component state
- Reselect for memoized selectors

### Form Architecture
- Multi-step form engine
- Real-time validation
- Partial save recovery
- Cross-vertical optimization
- Mobile-first responsive design

### Performance Optimization
- Code splitting by route
- Dynamic imports for heavy components
- Image optimization pipeline
- Service Worker caching
- Bundle size monitoring

## Testing

### Unit Testing
```bash
# Run unit tests
yarn test

# Run with coverage
yarn test:coverage
```

### Integration Testing
```bash
# Run integration tests
yarn test:integration
```

### E2E Testing
```bash
# Run Cypress tests
yarn test:e2e

# Open Cypress UI
yarn cypress:open
```

### Performance Testing
- Lighthouse CI integration
- Bundle size analysis
- Core Web Vitals monitoring
- Real User Monitoring (RUM)

## Deployment

### Build Process
```bash
# Production build
yarn build

# Analyze bundle
yarn analyze
```

### CI/CD Pipeline
- GitHub Actions workflow
- Automated testing
- Bundle size checks
- Lighthouse CI
- Automated deployments

### Environment Configuration
- Development (.env.development)
- Staging (.env.staging)
- Production (.env.production)
- Feature flags support

### Monitoring
- Error tracking with Sentry
- Performance monitoring with New Relic
- Custom analytics dashboard
- Real-time alerts

## Architecture Decisions

### Technology Selection
- React for component architecture
- TypeScript for type safety
- Redux Toolkit for predictable state
- Material-UI for enterprise UI
- Monorepo for code sharing

### Performance Strategy
- Server-side rendering where beneficial
- Aggressive code splitting
- Optimized asset loading
- Caching strategy
- Performance budgets

### Security Measures
- CSP implementation
- CSRF protection
- Input sanitization
- Secure data handling
- Regular security audits

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- Color contrast requirements
- Regular a11y audits

## Contributing

### Development Workflow
1. Create feature branch
2. Implement changes
3. Write/update tests
4. Submit PR
5. Code review
6. Merge to main

### Documentation
- Keep README updated
- Document new features
- Update API documentation
- Maintain changelog
- Architecture decision records

## License

Proprietary - All rights reserved