<!-- 
Please follow the PR template carefully to ensure comprehensive review.
All sections marked with [Required] must be completed before review.
-->

## PR Title [Required]
<!-- Format: [type] description
Allowed types: feat, fix, docs, style, refactor, perf, test, chore, infra, security
Example: [feat] Add real-time lead scoring API -->

## Description [Required]
### What changes does this PR introduce?
<!-- Provide a clear and concise description of the changes -->

### Why are these changes needed?
<!-- Explain the business/technical motivation for these changes -->

### How was this tested?
<!-- Detail the testing approach and results -->

### What are the security implications?
<!-- Describe security impact and mitigations -->

### What is the performance impact?
<!-- Detail performance implications and optimizations -->

## Type of Change [Required]
<!-- Check all that apply -->
- [ ] New feature (non-breaking change)
- [ ] Bug fix (non-breaking change)
- [ ] Breaking change (requires client updates)
- [ ] Documentation update
- [ ] Infrastructure change
- [ ] Performance improvement
- [ ] Security enhancement
- [ ] Compliance update

## Testing Checklist [Required]
<!-- Check all completed items -->
- [ ] Unit tests added/updated (>80% coverage)
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Load tests performed (>1000 concurrent users)
- [ ] Security tests performed
- [ ] Cross-browser testing completed
- [ ] Mobile responsiveness verified
- [ ] Accessibility testing completed

## Security Checklist [Required]
<!-- All items must be checked for infrastructure/security changes -->
- [ ] Security impact assessment completed
- [ ] PII/PHI exposure checked
- [ ] OWASP Top 10 vulnerabilities addressed
- [ ] Dependencies scanned for vulnerabilities
- [ ] Infrastructure security validated
- [ ] Encryption requirements met
- [ ] Authentication/Authorization changes reviewed
- [ ] Compliance requirements verified (GDPR/CCPA/HIPAA)

## Performance Checklist [Required]
<!-- Check all completed items -->
- [ ] Response time impact assessed (<500ms)
- [ ] Resource utilization verified
- [ ] Database query optimization checked
- [ ] Cache strategy reviewed
- [ ] Load balancing impact considered
- [ ] CDN optimization verified
- [ ] Mobile performance validated

## Deployment Impact [Required]
### Database migrations required?
<!-- If yes, provide details of migrations -->

### Configuration changes needed?
<!-- List all required configuration changes -->

### Infrastructure changes required?
<!-- Include relevant Terraform plans -->

### Backward compatibility impact?
<!-- Detail any breaking changes and mitigation -->

### Rollback strategy
<!-- Describe the rollback approach if needed -->

### Monitoring/Alerting updates needed?
<!-- List required monitoring/alerting changes -->

<!-- 
CI Validation Requirements:
- All required checks must pass
- Minimum 2 reviewer approvals needed
- Security review required for security/infrastructure changes
- Performance review required for performance-impacting changes
-->