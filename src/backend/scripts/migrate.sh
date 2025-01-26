#!/bin/bash

# Enterprise-grade database migration script for Multi-Vertical Insurance Lead Generation Platform
# Version: 1.0.0
# Dependencies:
# - mongodb-migrate ^2.0.2
# - winston ^3.10.0
# - mongodb-client-encryption ^2.3.0
# - datadog-metrics ^1.0.0

set -euo pipefail
IFS=$'\n\t'

# Configuration and Environment Variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="${SCRIPT_DIR}/../migrations"
LOG_FILE="${SCRIPT_DIR}/../logs/migration-$(date +%Y%m%d_%H%M%S).log"
LOCK_FILE="/tmp/db_migration.lock"
BACKUP_DIR="${SCRIPT_DIR}/../backups"

# Ensure required environment variables
required_env_vars=(
    "MONGODB_URI"
    "ENCRYPTION_KEY_PATH"
    "DATADOG_API_KEY"
    "ALERT_WEBHOOK"
    "NODE_ENV"
)

# Logging setup
setup_logging() {
    mkdir -p "$(dirname "$LOG_FILE")"
    exec 1> >(tee -a "$LOG_FILE")
    exec 2> >(tee -a "$LOG_FILE" >&2)
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Migration script started"
}

# Check prerequisites
check_prerequisites() {
    local status=0

    echo "Checking prerequisites..."

    # Verify environment variables
    for var in "${required_env_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            echo "ERROR: Required environment variable $var is not set"
            status=1
        fi
    done

    # Verify MongoDB connection
    if ! mongosh --eval "db.adminCommand('ping')" "$MONGODB_URI" &>/dev/null; then
        echo "ERROR: Cannot connect to MongoDB"
        status=1
    fi

    # Check encryption key
    if [[ ! -f "$ENCRYPTION_KEY_PATH" ]]; then
        echo "ERROR: Encryption key file not found"
        status=1
    fi

    # Verify migration directory
    if [[ ! -d "$MIGRATION_DIR" ]]; then
        echo "ERROR: Migration directory not found"
        status=1
    fi

    # Check required tools
    for cmd in mongosh jq curl node; do
        if ! command -v "$cmd" &>/dev/null; then
            echo "ERROR: Required command $cmd not found"
            status=1
        fi
    done

    return $status
}

# Distributed locking mechanism
acquire_lock() {
    if ! mkdir "$LOCK_FILE" 2>/dev/null; then
        echo "ERROR: Another migration is in progress"
        exit 1
    fi
    trap 'rm -rf "$LOCK_FILE"' EXIT
}

# Backup creation
create_backup() {
    local service=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="${BACKUP_DIR}/${service}_${timestamp}"
    
    echo "Creating backup for $service..."
    mkdir -p "$backup_path"
    
    mongodump --uri="$MONGODB_URI" --out="$backup_path" \
        --gzip --archive="${backup_path}/backup.gz"
    
    echo "Backup created at ${backup_path}"
}

# Monitor migration progress
monitor_migration_progress() {
    local start_time=$(date +%s)
    local service=$1
    local migration_id=$2

    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        # Get migration status
        local status=$(mongosh --quiet "$MONGODB_URI" --eval "db.migrations.findOne({_id: '$migration_id'}).status")
        
        # Send metrics to Datadog
        curl -X POST "https://api.datadoghq.com/api/v1/series" \
            -H "Content-Type: application/json" \
            -H "DD-API-KEY: ${DATADOG_API_KEY}" \
            -d @- << EOF
{
    "series": [{
        "metric": "migration.progress",
        "points": [[${current_time}, ${elapsed}]],
        "type": "gauge",
        "tags": ["service:${service}", "migration_id:${migration_id}"]
    }]
}
EOF

        # Alert if migration takes too long
        if [[ $elapsed -gt 3600 ]]; then
            send_alert "Migration ${migration_id} for ${service} running longer than expected: ${elapsed}s"
        fi

        sleep 30
    done
}

# Execute migrations for a service
run_migrations() {
    local service=$1
    local status=0
    
    echo "Running migrations for $service..."
    
    # Create backup before migration
    create_backup "$service"
    
    # Initialize migration tracking
    local migration_id="migration_$(date +%s)"
    
    # Start progress monitoring in background
    monitor_migration_progress "$service" "$migration_id" &
    local monitor_pid=$!
    
    # Execute migrations
    if ! node "${SCRIPT_DIR}/node_modules/.bin/migrate-mongo" up \
        --file "${MIGRATION_DIR}/${service}/migrate-mongo-config.js"; then
        status=1
        send_alert "Migration failed for service: $service"
    fi
    
    # Stop monitoring
    kill $monitor_pid
    
    return $status
}

# Rollback migration
rollback_migration() {
    local service=$1
    local migration_id=$2
    local status=0
    
    echo "Rolling back migration ${migration_id} for ${service}..."
    
    # Verify rollback is possible
    if ! node "${SCRIPT_DIR}/node_modules/.bin/migrate-mongo" status \
        --file "${MIGRATION_DIR}/${service}/migrate-mongo-config.js" | grep -q "$migration_id"; then
        echo "ERROR: Migration ${migration_id} not found"
        return 1
    fi
    
    # Execute rollback
    if ! node "${SCRIPT_DIR}/node_modules/.bin/migrate-mongo" down \
        --file "${MIGRATION_DIR}/${service}/migrate-mongo-config.js"; then
        status=1
        send_alert "Rollback failed for migration: ${migration_id} in service: ${service}"
    fi
    
    return $status
}

# Send alerts
send_alert() {
    local message=$1
    
    curl -X POST "$ALERT_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"[MIGRATION ALERT] $message\"}"
}

# Main execution
main() {
    setup_logging
    
    if ! check_prerequisites; then
        echo "Prerequisites check failed"
        exit 1
    }
    
    acquire_lock
    
    local status=0
    
    # Run migrations for each service
    for service in lead-service campaign-service; do
        if ! run_migrations "$service"; then
            status=1
            echo "Migration failed for $service"
            
            # Attempt rollback if specified
            if [[ "${AUTO_ROLLBACK:-false}" == "true" ]]; then
                rollback_migration "$service" "$(ls -t "${MIGRATION_DIR}/${service}" | head -1)"
            fi
        fi
    done
    
    # Final status report
    if [[ $status -eq 0 ]]; then
        echo "All migrations completed successfully"
        send_alert "Migrations completed successfully"
    else
        echo "Migrations failed"
        send_alert "Migrations failed - check logs for details"
    fi
    
    return $status
}

# Execute main function
main "$@"