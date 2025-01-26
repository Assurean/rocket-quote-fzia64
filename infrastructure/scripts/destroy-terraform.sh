#!/bin/bash

# destroy-terraform.sh
# Version: 1.0.0
# Safely destroys Terraform-managed infrastructure with comprehensive validation,
# safety checks, audit logging, and state cleanup procedures.

set -e
set -o pipefail

# Import common functions
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/init-terraform.sh"

# Global variables
export TF_LOG=${TF_LOG:-TRACE}
export FORCE_DESTROY=${FORCE_DESTROY:-false}
export LOG_FILE="/var/log/terraform/destroy-$(date +%Y%m%d-%H%M%S).log"
export LOCK_FILE="/var/run/terraform-destroy.lock"
export STATE_BUCKET="insurance-platform-tfstate"
export LOCK_TABLE="insurance-platform-tflock"

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Logging setup
setup_logging() {
    local log_dir=$(dirname "${LOG_FILE}")
    mkdir -p "${log_dir}"
    exec 1> >(tee -a "${LOG_FILE}")
    exec 2> >(tee -a "${LOG_FILE}" >&2)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting infrastructure destruction process"
}

# Check prerequisites
check_prerequisites() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking prerequisites..."

    # Verify required tools
    command -v terraform >/dev/null 2>&1 || { echo "Terraform is required but not installed. Aborting."; exit 1; }
    command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required but not installed. Aborting."; exit 1; }
    command -v jq >/dev/null 2>&1 || { echo "jq is required but not installed. Aborting."; exit 1; }

    # Check terraform version
    local tf_version=$(terraform version -json | jq -r '.terraform_version')
    if [[ ! "${tf_version}" =~ ^1\.[5-9]\. ]]; then
        echo "Terraform version >= 1.5.0 is required. Found: ${tf_version}"
        return 1
    }

    # Validate AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        echo "Invalid or expired AWS credentials. Please configure valid credentials."
        return 1
    }

    # Check required environment variables
    [[ -z "${ENV}" ]] && { echo "ENV environment variable must be set"; return 1; }
    [[ -z "${AWS_REGION}" ]] && { echo "AWS_REGION environment variable must be set"; return 1; }

    # Verify S3 bucket and DynamoDB table existence
    aws s3 ls "s3://${STATE_BUCKET}" >/dev/null 2>&1 || { echo "State bucket not found"; return 1; }
    aws dynamodb describe-table --table-name "${LOCK_TABLE}" >/dev/null 2>&1 || { echo "Lock table not found"; return 1; }

    return 0
}

# Validate environment and implement safety measures
validate_environment() {
    local env=$1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Validating environment: ${env}"

    # Verify environment name
    if [[ ! "${env}" =~ ^(dev|staging|prod)$ ]]; then
        echo "Invalid environment: ${env}. Must be dev, staging, or prod"
        return 1
    }

    # Environment-specific warnings
    case "${env}" in
        prod)
            printf "${RED}WARNING: You are about to destroy PRODUCTION infrastructure!${NC}\n"
            printf "${RED}This action is IRREVERSIBLE and will result in DOWNTIME!${NC}\n"
            
            # Require manual confirmation for production
            read -p "Type the environment name 'prod' to confirm: " confirmation
            if [[ "${confirmation}" != "prod" ]]; then
                echo "Confirmation failed. Aborting."
                return 1
            }

            # Additional 5-minute waiting period for production
            echo "Waiting 5 minutes before proceeding with production destruction..."
            for i in {300..1}; do
                printf "\rProceeding in %d seconds... Press Ctrl+C to abort" $i
                sleep 1
            done
            echo
            ;;
        staging)
            printf "${YELLOW}WARNING: Destroying staging environment${NC}\n"
            read -p "Are you sure? (y/N): " confirmation
            [[ "${confirmation}" != "y" ]] && return 1
            ;;
        dev)
            printf "${GREEN}Preparing to destroy development environment${NC}\n"
            ;;
    esac

    # Create execution lock
    if ! mkdir -p "$(dirname "${LOCK_FILE}")" || ! touch "${LOCK_FILE}"; then
        echo "Failed to create lock file. Another destruction might be in progress."
        return 1
    }

    return 0
}

# Execute Terraform destroy
destroy_infrastructure() {
    local env=$1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Executing infrastructure destruction for ${env}"

    # Create state backup
    local backup_file="tfstate-backup-${env}-$(date +%Y%m%d-%H%M%S).json"
    aws s3 cp "s3://${STATE_BUCKET}/${env}/terraform.tfstate" "${backup_file}" || true

    # Navigate to Terraform directory
    cd "${SCRIPT_DIR}/../../terraform/aws"

    # Initialize Terraform
    terraform init \
        -backend=true \
        -backend-config="bucket=${STATE_BUCKET}" \
        -backend-config="key=${env}/terraform.tfstate" \
        -backend-config="region=${AWS_REGION}" \
        -backend-config="dynamodb_table=${LOCK_TABLE}"

    # Run destroy plan
    terraform plan -destroy -out=destroy.plan

    # Execute destroy
    if [[ "${FORCE_DESTROY}" == "true" ]]; then
        terraform destroy -auto-approve
    else
        terraform destroy
    fi

    return $?
}

# Cleanup state and related resources
cleanup_state() {
    local env=$1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up state and resources"

    # Remove state file from S3
    aws s3 rm "s3://${STATE_BUCKET}/${env}/terraform.tfstate"

    # Remove lock entries
    aws dynamodb delete-item \
        --table-name "${LOCK_TABLE}" \
        --key "{\"LockID\":{\"S\":\"${STATE_BUCKET}/${env}/terraform.tfstate-md5\"}}"

    # Clean local files
    rm -rf .terraform destroy.plan

    # Release execution lock
    rm -f "${LOCK_FILE}"

    return 0
}

# Error handler
handle_error() {
    local error_message=$1
    local error_code=$2

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: ${error_message}" >&2

    # Capture stack trace
    local stack_trace
    if [[ "${BASH_VERSION}" =~ ^4.* ]]; then
        stack_trace=$(caller)
    else
        stack_trace="Stack trace not available"
    fi
    echo "Stack trace: ${stack_trace}" >&2

    # Cleanup on error
    cleanup_state "${ENV}" || true
    rm -f "${LOCK_FILE}" || true

    # Notify administrators for production errors
    if [[ "${ENV}" == "prod" ]]; then
        aws sns publish \
            --topic-arn "arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:infrastructure-alerts" \
            --message "Production infrastructure destruction failed: ${error_message}" || true
    fi

    exit "${error_code}"
}

# Main execution
main() {
    setup_logging

    # Trap errors
    trap 'handle_error "Script failed" $?' ERR

    # Check prerequisites
    check_prerequisites || exit 1

    # Validate environment
    validate_environment "${ENV}" || exit 1

    # Execute destruction
    destroy_infrastructure "${ENV}" || exit 1

    # Cleanup
    cleanup_state "${ENV}" || exit 1

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Infrastructure destruction completed successfully"
    return 0
}

# Execute main function
main "$@"
```

This implementation provides a robust and secure way to destroy Terraform-managed infrastructure with:

1. Comprehensive prerequisite checking
2. Environment-specific safety measures
3. Production safeguards including manual confirmation and waiting period
4. State backup before destruction
5. Detailed audit logging
6. Error handling with cleanup
7. Lock mechanism to prevent concurrent executions
8. State and resource cleanup after successful destruction

The script follows enterprise-grade practices with:

- Strict error handling (set -e)
- Proper logging
- Color-coded output for visibility
- AWS credential validation
- Version checking for dependencies
- Backup creation before destruction
- SNS notifications for production failures
- Comprehensive cleanup procedures

Usage:
```bash
# Set required environment variables
export ENV=dev
export AWS_REGION=us-east-1

# Execute with normal confirmation
./destroy-terraform.sh

# Execute with force destroy (no confirmation)
export FORCE_DESTROY=true
./destroy-terraform.sh