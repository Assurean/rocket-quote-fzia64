#!/bin/bash

# Apply Terraform infrastructure changes across environments
# Version: 1.0.0
# Required: terraform >= 1.5.0, aws-cli >= 2.0

set -euo pipefail

# Source initialization functions
source "$(dirname "$0")/init-terraform.sh"

# Logging configuration
LOG_FILE="/var/log/terraform/apply-$(date +%Y%m%d).log"
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function with timestamp and level
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# Error handling
trap 'log ERROR "Script failed on line $LINENO"' ERR

# Validate environment function
validate_environment() {
    local environment=$1
    log INFO "Validating environment: $environment"

    # Validate environment name
    if [[ ! "$environment" =~ ^(dev|staging|prod)$ ]]; then
        log ERROR "Invalid environment. Must be dev, staging, or prod"
        return 1
    }

    # Verify AWS credentials and permissions
    if ! aws sts get-caller-identity &>/dev/null; then
        log ERROR "Invalid or missing AWS credentials"
        return 1
    }

    # Check required environment variables
    local required_vars=(
        "AWS_REGION"
        "TF_STATE_BUCKET"
        "TF_LOCK_TABLE"
        "TF_LOG"
        "HEALTH_CHECK_TIMEOUT"
    )

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log ERROR "Required environment variable $var is not set"
            return 1
        fi
    done

    # Verify environment-specific tfvars file
    local tfvars_file="infrastructure/terraform/environments/${environment}/terraform.tfvars"
    if [[ ! -f "$tfvars_file" ]]; then
        log ERROR "Environment tfvars file not found: $tfvars_file"
        return 1
    }

    # Validate multi-AZ configuration for production
    if [[ "$environment" == "prod" ]]; then
        if ! grep -q "availability_zones.*=.*\[.*,.*\]" "$tfvars_file"; then
            log ERROR "Production environment requires multi-AZ configuration"
            return 1
        fi
    fi

    log INFO "Environment validation successful"
    return 0
}

# Plan changes function
plan_changes() {
    local environment=$1
    log INFO "Planning changes for environment: $environment"

    # Create state backup if enabled
    if [[ "${TF_BACKUP:-false}" == "true" ]]; then
        log INFO "Creating state backup"
        aws s3 cp "s3://${TF_STATE_BUCKET}/${environment}/terraform.tfstate" \
            "s3://${TF_STATE_BUCKET}/${environment}/terraform.tfstate.backup-$(date +%Y%m%d-%H%M%S)"
    fi

    # Generate plan file
    local plan_file="tfplan-${environment}-$(date +%Y%m%d-%H%M%S)"
    export TF_LOG_PATH="${LOG_FILE}"

    log INFO "Running terraform plan"
    if ! terraform plan \
        -var-file="terraform.tfvars" \
        -out="$plan_file" \
        -detailed-exitcode; then
        log ERROR "Terraform plan failed"
        return 1
    fi

    # Analyze plan for destructive changes
    if terraform show -json "$plan_file" | jq -e '.resource_changes[] | select(.change.actions[] | contains("delete"))' >/dev/null; then
        log WARN "Plan contains destructive changes"
        if [[ "$environment" == "prod" ]]; then
            log ERROR "Destructive changes not allowed in production"
            return 1
        fi
    fi

    # Send notifications if enabled
    if [[ "${NOTIFY_SLACK:-false}" == "true" ]]; then
        log INFO "Sending plan notification to Slack"
        # Implementation of Slack notification would go here
    fi

    echo "$plan_file"
    return 0
}

# Apply changes function
apply_changes() {
    local environment=$1
    local plan_file=$2
    log INFO "Applying changes for environment: $environment"

    # Verify plan file exists and is recent
    if [[ ! -f "$plan_file" ]]; then
        log ERROR "Plan file not found: $plan_file"
        return 1
    fi

    # Check for required approvals in production
    if [[ "$environment" == "prod" && "${AUTO_APPROVE:-false}" != "true" ]]; then
        log INFO "Production deployment requires manual approval"
        read -p "Do you want to proceed with production deployment? (yes/no) " -r
        if [[ ! "$REPLY" =~ ^yes$ ]]; then
            log INFO "Deployment cancelled by user"
            return 1
        fi
    fi

    # Apply terraform changes
    log INFO "Running terraform apply"
    if ! terraform apply -auto-approve "$plan_file"; then
        log ERROR "Terraform apply failed"
        return 1
    fi

    # Perform post-deploy health checks
    log INFO "Running post-deployment health checks"
    local timeout="${HEALTH_CHECK_TIMEOUT:-300}"
    local start_time=$(date +%s)

    while true; do
        if aws eks describe-cluster --name "${environment}-insurance-platform" --query 'cluster.status' | grep -q ACTIVE; then
            break
        fi

        if (( $(date +%s) - start_time > timeout )); then
            log ERROR "Health check timeout exceeded"
            return 1
        fi

        log INFO "Waiting for cluster to become active..."
        sleep 30
    done

    # Cleanup
    rm -f "$plan_file"
    log INFO "Deployment completed successfully"
    return 0
}

# Main execution
main() {
    local environment=${1:-}

    if [[ -z "$environment" ]]; then
        log ERROR "Environment parameter is required"
        exit 1
    fi

    # Initialize and validate
    if ! check_prerequisites; then
        log ERROR "Prerequisites check failed"
        exit 1
    fi

    if ! validate_environment "$environment"; then
        log ERROR "Environment validation failed"
        exit 1
    fi

    if ! init_terraform "$environment"; then
        log ERROR "Terraform initialization failed"
        exit 1
    fi

    # Plan and apply changes
    local plan_file
    if ! plan_file=$(plan_changes "$environment"); then
        log ERROR "Planning changes failed"
        exit 1
    fi

    if ! apply_changes "$environment" "$plan_file"; then
        log ERROR "Applying changes failed"
        exit 1
    fi

    log INFO "Infrastructure deployment completed successfully"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi