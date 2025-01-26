#!/bin/bash

# Initialize Terraform infrastructure deployment across environments
# Version: 1.0.0
# Required tools: terraform >= 1.5.0, aws-cli >= 2.0

set -euo pipefail

# Logging configuration
LOG_FILE="/var/log/terraform/init-$(date +%Y%m%d).log"
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function with timestamp and level
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# Error handling
trap 'log ERROR "Script failed on line $LINENO"' ERR

# Check prerequisites function
check_prerequisites() {
    log INFO "Checking prerequisites..."

    # Check Terraform version
    if ! terraform version | grep -q "v1.5"; then
        log ERROR "Terraform >= 1.5.0 is required"
        return 1
    fi

    # Check AWS CLI version
    if ! aws --version | grep -q "aws-cli/2"; then
        log ERROR "AWS CLI version 2.x is required"
        return 1
    }

    # Verify AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        log ERROR "AWS credentials not configured or invalid"
        return 1
    }

    # Check required environment variables
    local required_vars=("AWS_REGION" "TF_STATE_BUCKET" "TF_LOCK_TABLE")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log ERROR "Required environment variable $var is not set"
            return 1
        fi
    done

    log INFO "Prerequisites check passed"
    return 0
}

# Initialize backend function
init_backend() {
    local environment=$1
    log INFO "Initializing backend for environment: $environment"

    # Create S3 bucket if it doesn't exist
    if ! aws s3api head-bucket --bucket "$TF_STATE_BUCKET" 2>/dev/null; then
        log INFO "Creating S3 bucket: $TF_STATE_BUCKET"
        aws s3api create-bucket \
            --bucket "$TF_STATE_BUCKET" \
            --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION"

        # Enable versioning
        aws s3api put-bucket-versioning \
            --bucket "$TF_STATE_BUCKET" \
            --versioning-configuration Status=Enabled

        # Enable default encryption
        aws s3api put-bucket-encryption \
            --bucket "$TF_STATE_BUCKET" \
            --server-side-encryption-configuration '{
                "Rules": [{
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "aws:kms"
                    }
                }]
            }'

        # Enable access logging
        aws s3api put-bucket-logging \
            --bucket "$TF_STATE_BUCKET" \
            --bucket-logging-status '{
                "LoggingEnabled": {
                    "TargetBucket": "'$TF_STATE_BUCKET'",
                    "TargetPrefix": "logs/"
                }
            }'
    fi

    # Create DynamoDB table if it doesn't exist
    if ! aws dynamodb describe-table --table-name "$TF_LOCK_TABLE" &>/dev/null; then
        log INFO "Creating DynamoDB table: $TF_LOCK_TABLE"
        aws dynamodb create-table \
            --table-name "$TF_LOCK_TABLE" \
            --attribute-definitions AttributeName=LockID,AttributeType=S \
            --key-schema AttributeName=LockID,KeyType=HASH \
            --billing-mode PAY_PER_REQUEST \
            --region "$AWS_REGION"

        # Enable point-in-time recovery
        aws dynamodb update-continuous-backups \
            --table-name "$TF_LOCK_TABLE" \
            --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
    fi

    log INFO "Backend initialization completed"
    return 0
}

# Initialize Terraform function
init_terraform() {
    local environment=$1
    log INFO "Initializing Terraform for environment: $environment"

    # Navigate to environment directory
    local tf_dir="infrastructure/terraform/environments/${environment}"
    if [[ ! -d "$tf_dir" ]]; then
        log ERROR "Environment directory not found: $tf_dir"
        return 1
    }
    cd "$tf_dir"

    # Create backend config
    cat > backend.tf <<EOF
terraform {
  backend "s3" {
    bucket         = "${TF_STATE_BUCKET}"
    key            = "${environment}/terraform.tfstate"
    region         = "${AWS_REGION}"
    dynamodb_table = "${TF_LOCK_TABLE}"
    encrypt        = true
  }
}
EOF

    # Initialize Terraform
    export TF_LOG=TRACE
    export TF_LOG_PATH="${LOG_FILE}"

    log INFO "Running terraform init"
    if ! terraform init -reconfigure; then
        log ERROR "Terraform initialization failed"
        return 1
    fi

    # Validate Terraform configuration
    log INFO "Validating Terraform configuration"
    if ! terraform validate; then
        log ERROR "Terraform validation failed"
        return 1
    }

    log INFO "Terraform initialization completed successfully"
    return 0
}

# Main execution
main() {
    local environment=${1:-}

    # Validate environment argument
    if [[ ! "$environment" =~ ^(dev|staging|uat|prod)$ ]]; then
        log ERROR "Invalid environment. Must be one of: dev, staging, uat, prod"
        exit 1
    }

    # Execute initialization steps
    if ! check_prerequisites; then
        log ERROR "Prerequisites check failed"
        exit 1
    fi

    if ! init_backend "$environment"; then
        log ERROR "Backend initialization failed"
        exit 1
    fi

    if ! init_terraform "$environment"; then
        log ERROR "Terraform initialization failed"
        exit 1
    fi

    log INFO "Infrastructure initialization completed successfully for environment: $environment"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi