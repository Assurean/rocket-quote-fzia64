#!/bin/bash

# Enterprise-grade database backup script for Multi-Vertical Insurance Lead Generation Platform
# Version: 1.0.0
# Dependencies: aws-cli v2.0+, jq v1.6+

set -euo pipefail
IFS=$'\n\t'

# Constants
readonly BACKUP_RETENTION_DAYS=30
readonly BACKUP_PATH="/backup"
readonly LOG_PATH="/var/log/database-backups"
readonly SECONDARY_REGION="us-west-2"
readonly MAX_RETRIES=3
readonly BACKUP_CHUNK_SIZE="100GB"
readonly MIN_DISK_SPACE="500GB"
readonly ALERT_THRESHOLD=85
readonly BACKUP_TIMEOUT=3600
readonly MAX_CONCURRENT_BACKUPS=2
readonly SCRIPT_VERSION="1.0.0"

# Initialize logging
mkdir -p "${LOG_PATH}"
exec 1> >(tee -a "${LOG_PATH}/backup-$(date +%Y%m%d).log")
exec 2>&1

# Logging function with JSON structured output
log_message() {
    local level=$1
    local message=$2
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    jq -n \
        --arg timestamp "$timestamp" \
        --arg level "$level" \
        --arg message "$message" \
        --arg version "$SCRIPT_VERSION" \
        '{timestamp: $timestamp, level: $level, message: $message, version: $version}'
}

# Error handling function
handle_error() {
    local exit_code=$?
    local line_number=$1
    log_message "ERROR" "Backup failed on line ${line_number} with exit code ${exit_code}"
    
    # Send alert to CloudWatch
    aws cloudwatch put-metric-data \
        --namespace "DatabaseBackups" \
        --metric-name "BackupFailure" \
        --value 1 \
        --dimensions "Script=backup-databases.sh"
        
    exit "${exit_code}"
}

trap 'handle_error ${LINENO}' ERR

# Verify AWS credentials and assume role
verify_aws_credentials() {
    log_message "INFO" "Verifying AWS credentials"
    
    if ! aws sts get-caller-identity &>/dev/null; then
        log_message "ERROR" "AWS credentials verification failed"
        exit 1
    }
    
    # Assume backup role for enhanced security
    if ! aws sts assume-role \
        --role-arn "${AWS_ROLE_ARN}" \
        --role-session-name "DatabaseBackup" > /dev/null; then
        log_message "ERROR" "Failed to assume backup role"
        exit 1
    fi
}

# Check available disk space
check_disk_space() {
    local available_space
    available_space=$(df -BG "${BACKUP_PATH}" | awk 'NR==2 {print $4}' | sed 's/G//')
    
    if [[ ${available_space} -lt ${MIN_DISK_SPACE%GB} ]]; then
        log_message "ERROR" "Insufficient disk space. Required: ${MIN_DISK_SPACE}, Available: ${available_space}GB"
        exit 1
    fi
}

# DocumentDB backup function
backup_documentdb() {
    local cluster_identifier=$1
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local snapshot_identifier="${cluster_identifier}-${timestamp}"
    
    log_message "INFO" "Starting DocumentDB backup for cluster ${cluster_identifier}"
    
    # Create cluster snapshot
    aws docdb create-db-cluster-snapshot \
        --db-cluster-identifier "${cluster_identifier}" \
        --db-cluster-snapshot-identifier "${snapshot_identifier}" \
        --kms-key-id "${MONGODB_KMS_KEY_ID}"
        
    # Wait for snapshot completion
    aws docdb wait db-cluster-snapshot-available \
        --db-cluster-snapshot-identifier "${snapshot_identifier}"
        
    # Copy snapshot to secondary region
    aws docdb copy-db-cluster-snapshot \
        --source-db-cluster-snapshot-identifier "${snapshot_identifier}" \
        --target-db-cluster-snapshot-identifier "${snapshot_identifier}" \
        --kms-key-id "${MONGODB_KMS_KEY_ID}" \
        --region "${SECONDARY_REGION}"
        
    log_message "INFO" "DocumentDB backup completed successfully"
    
    # Update CloudWatch metrics
    aws cloudwatch put-metric-data \
        --namespace "DatabaseBackups" \
        --metric-name "BackupSuccess" \
        --value 1 \
        --dimensions "Database=DocumentDB,Cluster=${cluster_identifier}"
}

# PostgreSQL RDS backup function
backup_rds() {
    local db_identifier=$1
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local snapshot_identifier="${db_identifier}-${timestamp}"
    
    log_message "INFO" "Starting RDS backup for instance ${db_identifier}"
    
    # Create DB snapshot
    aws rds create-db-snapshot \
        --db-instance-identifier "${db_identifier}" \
        --db-snapshot-identifier "${snapshot_identifier}" \
        --kms-key-id "${POSTGRESQL_KMS_KEY_ID}"
        
    # Wait for snapshot completion
    aws rds wait db-snapshot-available \
        --db-snapshot-identifier "${snapshot_identifier}"
        
    # Copy snapshot to secondary region
    aws rds copy-db-snapshot \
        --source-db-snapshot-identifier "${snapshot_identifier}" \
        --target-db-snapshot-identifier "${snapshot_identifier}" \
        --kms-key-id "${POSTGRESQL_KMS_KEY_ID}" \
        --region "${SECONDARY_REGION}"
        
    log_message "INFO" "RDS backup completed successfully"
    
    # Update CloudWatch metrics
    aws cloudwatch put-metric-data \
        --namespace "DatabaseBackups" \
        --metric-name "BackupSuccess" \
        --value 1 \
        --dimensions "Database=PostgreSQL,Instance=${db_identifier}"
}

# Cleanup old backups
cleanup_old_backups() {
    local retention_days=$1
    local timestamp_threshold
    timestamp_threshold=$(date -d "${retention_days} days ago" +%Y-%m-%d)
    
    log_message "INFO" "Starting cleanup of backups older than ${retention_days} days"
    
    # Cleanup DocumentDB snapshots
    aws docdb describe-db-cluster-snapshots --query "DBClusterSnapshots[?SnapshotCreateTime<='${timestamp_threshold}'].[DBClusterSnapshotIdentifier]" --output text | \
    while read -r snapshot; do
        aws docdb delete-db-cluster-snapshot --db-cluster-snapshot-identifier "${snapshot}"
        log_message "INFO" "Deleted DocumentDB snapshot: ${snapshot}"
    done
    
    # Cleanup RDS snapshots
    aws rds describe-db-snapshots --query "DBSnapshots[?SnapshotCreateTime<='${timestamp_threshold}'].[DBSnapshotIdentifier]" --output text | \
    while read -r snapshot; do
        aws rds delete-db-snapshot --db-snapshot-identifier "${snapshot}"
        log_message "INFO" "Deleted RDS snapshot: ${snapshot}"
    done
    
    # Cleanup in secondary region
    aws docdb describe-db-cluster-snapshots --region "${SECONDARY_REGION}" --query "DBClusterSnapshots[?SnapshotCreateTime<='${timestamp_threshold}'].[DBClusterSnapshotIdentifier]" --output text | \
    while read -r snapshot; do
        aws docdb delete-db-cluster-snapshot --db-cluster-snapshot-identifier "${snapshot}" --region "${SECONDARY_REGION}"
        log_message "INFO" "Deleted secondary region DocumentDB snapshot: ${snapshot}"
    done
    
    aws rds describe-db-snapshots --region "${SECONDARY_REGION}" --query "DBSnapshots[?SnapshotCreateTime<='${timestamp_threshold}'].[DBSnapshotIdentifier]" --output text | \
    while read -r snapshot; do
        aws rds delete-db-snapshot --db-snapshot-identifier "${snapshot}" --region "${SECONDARY_REGION}"
        log_message "INFO" "Deleted secondary region RDS snapshot: ${snapshot}"
    done
}

# Main execution
main() {
    log_message "INFO" "Starting database backup process"
    
    # Verify prerequisites
    verify_aws_credentials
    check_disk_space
    
    # Backup DocumentDB clusters
    backup_documentdb "${MONGODB_CLUSTER_ID}"
    
    # Backup PostgreSQL instances
    backup_rds "${POSTGRESQL_DB_ID}"
    
    # Cleanup old backups
    cleanup_old_backups "${BACKUP_RETENTION_DAYS}"
    
    log_message "INFO" "Database backup process completed successfully"
}

# Execute main function
main

exit 0