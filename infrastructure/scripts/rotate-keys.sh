#!/bin/bash

# AWS KMS Key Rotation Script
# Version: 1.0.0
# Dependencies:
# - aws-cli v2.0+
# - jq v1.6+
# - aws-sdk v2.0+

set -euo pipefail

# Global Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
LOG_FILE=${LOG_FILE:-"/var/log/insurance-platform/key-rotation.log"}
ROTATION_INTERVAL_DAYS=${ROTATION_INTERVAL_DAYS:-90}
MAX_RETRIES=${MAX_RETRIES:-3}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-365}
ALERT_THRESHOLD_MINUTES=${ALERT_THRESHOLD_MINUTES:-30}
BACKUP_DIR="/opt/insurance-platform/key-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Logging Configuration
setup_logging() {
    local log_dir=$(dirname "${LOG_FILE}")
    mkdir -p "${log_dir}"
    touch "${LOG_FILE}"
    exec 1> >(tee -a "${LOG_FILE}")
    exec 2> >(tee -a "${LOG_FILE}" >&2)
}

log() {
    local level=$1
    local message=$2
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    local trace_id=$(cat /proc/sys/kernel/random/uuid)
    local user=$(aws sts get-caller-identity --query 'Arn' --output text)
    local source_ip=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)
    echo "${timestamp}|${level}|KEY_ROTATION|${key_id:-N/A}|${status:-INFO}|${message}|${trace_id}|${user}|${source_ip}"
}

# Error Handling
error_handler() {
    local exit_code=$?
    local line_number=$1
    log "ERROR" "Script failed at line ${line_number} with exit code ${exit_code}"
    cleanup_and_notify
    exit "${exit_code}"
}
trap 'error_handler ${LINENO}' ERR

# AWS Authentication Validation
validate_aws_credentials() {
    log "INFO" "Validating AWS credentials"
    if ! aws sts get-caller-identity &>/dev/null; then
        log "ERROR" "Invalid or expired AWS credentials"
        exit 1
    fi
}

# Key Status Verification
verify_key_status() {
    local key_id=$1
    log "INFO" "Verifying status for key ${key_id}"
    
    # Check key enabled status
    local key_status=$(aws kms describe-key --key-id "${key_id}" --query 'KeyMetadata.KeyState' --output text)
    if [[ "${key_status}" != "Enabled" ]]; then
        log "ERROR" "Key ${key_id} is not in Enabled state (current: ${key_status})"
        return 1
    }
    
    # Verify key not pending deletion
    local pending_deletion=$(aws kms describe-key --key-id "${key_id}" --query 'KeyMetadata.DeletionDate' --output text)
    if [[ "${pending_deletion}" != "None" ]]; then
        log "ERROR" "Key ${key_id} is pending deletion"
        return 1
    }
    
    # Check key usage quotas
    local key_usage=$(aws kms get-key-rotation-status --key-id "${key_id}" --output json)
    log "INFO" "Key rotation status: ${key_usage}"
    
    return 0
}

# Backup Key Metadata
backup_key_metadata() {
    local key_id=$1
    local backup_path="${BACKUP_DIR}/${key_id}/${TIMESTAMP}"
    log "INFO" "Creating backup for key ${key_id} at ${backup_path}"
    
    mkdir -p "${backup_path}"
    
    # Backup key metadata
    aws kms describe-key --key-id "${key_id}" > "${backup_path}/key-metadata.json"
    
    # Backup key policy
    aws kms get-key-policy --key-id "${key_id}" --policy-name default > "${backup_path}/key-policy.json"
    
    # Backup tags
    aws kms list-resource-tags --key-id "${key_id}" > "${backup_path}/tags.json"
    
    # Create backup manifest
    cat > "${backup_path}/manifest.json" <<EOF
{
    "backup_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
    "key_id": "${key_id}",
    "backup_version": "1.0",
    "files": [
        "key-metadata.json",
        "key-policy.json",
        "tags.json"
    ]
}
EOF
    
    # Generate checksum
    find "${backup_path}" -type f -exec sha256sum {} \; > "${backup_path}/checksums.txt"
    
    log "INFO" "Backup completed successfully for key ${key_id}"
    return 0
}

# Key Rotation Function
rotate_kms_key() {
    local key_id=$1
    local key_alias=$2
    local force_rotation=${3:-false}
    local status="STARTED"
    
    log "INFO" "Starting key rotation for ${key_id}"
    
    # Verify key status
    if ! verify_key_status "${key_id}"; then
        log "ERROR" "Key verification failed for ${key_id}"
        return 1
    }
    
    # Create backup
    if ! backup_key_metadata "${key_id}"; then
        log "ERROR" "Backup failed for ${key_id}"
        return 1
    }
    
    # Enable automatic rotation if not enabled
    if [[ "${force_rotation}" == "true" ]]; then
        aws kms enable-key-rotation --key-id "${key_id}"
        log "INFO" "Enabled automatic key rotation for ${key_id}"
    fi
    
    # Update key alias
    aws kms update-alias --alias-name "${key_alias}" --target-key-id "${key_id}"
    
    # Verify rotation
    local rotation_status=$(aws kms get-key-rotation-status --key-id "${key_id}" --query 'KeyRotationEnabled' --output text)
    if [[ "${rotation_status}" != "True" ]]; then
        log "ERROR" "Key rotation verification failed for ${key_id}"
        return 1
    }
    
    status="COMPLETED"
    log "INFO" "Key rotation completed successfully for ${key_id}"
    
    # Update CloudWatch metrics
    aws cloudwatch put-metric-data \
        --namespace "Insurance/KMS" \
        --metric-name "KeyRotationSuccess" \
        --value 1 \
        --dimensions "KeyId=${key_id}"
    
    return 0
}

# Cleanup and Notification
cleanup_and_notify() {
    log "INFO" "Performing cleanup operations"
    
    # Cleanup old backups
    find "${BACKUP_DIR}" -type d -mtime "+${BACKUP_RETENTION_DAYS}" -exec rm -rf {} \;
    
    # Send notification if configured
    if [[ -n "${SNS_TOPIC_ARN:-}" ]]; then
        aws sns publish \
            --topic-arn "${SNS_TOPIC_ARN}" \
            --message "Key rotation operation completed with status: ${status:-UNKNOWN}" \
            --subject "KMS Key Rotation Status"
    fi
}

# Main Execution
main() {
    setup_logging
    validate_aws_credentials
    
    # Read key configuration
    local config_file="/etc/insurance-platform/kms-config.json"
    if [[ ! -f "${config_file}" ]]; then
        log "ERROR" "Configuration file not found: ${config_file}"
        exit 1
    }
    
    # Process each key
    jq -r '.keys[]' "${config_file}" | while read -r key; do
        key_id=$(echo "${key}" | jq -r '.key_id')
        key_alias=$(echo "${key}" | jq -r '.alias')
        force_rotation=$(echo "${key}" | jq -r '.force_rotation')
        
        if ! rotate_kms_key "${key_id}" "${key_alias}" "${force_rotation}"; then
            log "ERROR" "Failed to rotate key ${key_id}"
            continue
        fi
    done
    
    cleanup_and_notify
}

# Script Entry Point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi