---
name: Bug Report
about: Create a detailed bug report to help us maintain system reliability and performance
title: '[BUG] '
labels: bug
assignees: ''
---

## Bug Overview

### Title
<!-- Provide a clear and concise bug title -->

### Description
<!-- Provide a detailed description of the bug -->

### Severity
<!-- Select the bug severity level -->
- [ ] Critical-SLA (Impacts system SLA/uptime)
- [ ] Critical
- [ ] High
- [ ] Medium
- [ ] Low

### Category
<!-- Select the primary bug category -->
- [ ] Functional
- [ ] Performance
- [ ] Security
- [ ] Data
- [ ] UI/UX
- [ ] Infrastructure

### Vertical
<!-- Select the affected insurance vertical or platform area -->
- [ ] Auto
- [ ] Home
- [ ] Renters
- [ ] Health
- [ ] Medicare
- [ ] Life
- [ ] Commercial
- [ ] Cross-Vertical
- [ ] Platform

## Environment

### Environment Type
<!-- Select the environment where the bug was discovered -->
- [ ] Production
- [ ] Staging
- [ ] Development
- [ ] Local

### Component
<!-- Select the affected system component -->
- [ ] lead-service
- [ ] ml-service
- [ ] rtb-service
- [ ] validation-service
- [ ] campaign-service
- [ ] consumer-app
- [ ] portal-app
- [ ] infrastructure
- [ ] monitoring
- [ ] security
- [ ] database

### Version Information
```yaml
Component Version: 
API Version: 
Infrastructure Version: 
```

### Infrastructure Details (if applicable)
```yaml
Region: 
Availability Zone: 
Cluster: 
```

## Reproduction

### Prerequisites
<!-- List any required setup or conditions -->
1. 
2. 

### Steps to Reproduce
<!-- Provide detailed step-by-step reproduction instructions -->
1. 
2. 
3. 

### Expected Behavior
<!-- Describe what should happen -->

### Actual Behavior
<!-- Describe what actually happens -->

### Frequency
<!-- Select how often the bug occurs -->
- [ ] Always
- [ ] Intermittent
- [ ] One-time

## Impact Assessment

### SLA Impact
```yaml
Uptime Affected: [Yes/No]
Performance Degradation: [Yes/No]
Data Integrity: [Yes/No]
Security Breach: [Yes/No]
```

### Performance Metrics (if applicable)
```yaml
Response Time: 
Error Rate: 
Throughput: 
Resource Usage: 
```

### Security Impact (if applicable)
```yaml
Data Exposure: [none/partial/full]
Authentication Affected: [Yes/No]
Authorization Affected: [Yes/No]
Compliance Violation: 
```

### Business Impact
```yaml
Revenue Impact: 
Affected Users: 
Affected Verticals:
  - 
Affected Partners:
  - 
```

## Additional Context

### Logs
<!-- Attach or link to relevant logs -->
```yaml
Application Logs: 
Error Logs: 
Monitoring Data: 
Trace IDs:
  - 
```

### Screenshots
<!-- Attach any relevant screenshots -->

### Related Issues
```yaml
Related Bugs:
  - 
Dependent Features:
  - 
Blocked By:
  - 
```

### Team Impact
```yaml
Primary Owner: 
Affected Teams:
  - 
Escalation Path: 
Communication Plan: 
```

<!-- 
Note: For Critical-SLA bugs:
1. Immediate escalation required
2. SLA impact must be quantified
3. Attach relevant monitoring data
4. Include incident response details
-->