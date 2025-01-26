#!/bin/bash

# Comprehensive test execution script for backend microservices
# Supports TypeScript, Python, and Go services with unified coverage reporting
# Version: 1.0.0

set -e # Exit on error
set -o pipefail # Exit on pipe failure

# Configuration and environment variables
COVERAGE_DIR="coverage"
MIN_COVERAGE=80
PARALLEL_JOBS=${PARALLEL_JOBS:-$(nproc)}
TEST_TIMEOUT=${TEST_TIMEOUT:-30000}
export NODE_ENV=test
export TEST_ENV=${TEST_ENV:-"local"}
export DEBUG=${DEBUG:-"false"}

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Initialize test environment
initialize_test_environment() {
    log_info "Initializing test environment..."

    # Check required tools
    command -v node >/dev/null 2>&1 || { log_error "Node.js is required but not installed."; exit 1; }
    command -v python3 >/dev/null 2>&1 || { log_error "Python3 is required but not installed."; exit 1; }
    command -v go >/dev/null 2>&1 || { log_error "Go is required but not installed."; exit 1; }

    # Create coverage directory if it doesn't exist
    mkdir -p "${COVERAGE_DIR}"

    # Clean previous coverage reports
    rm -rf "${COVERAGE_DIR:?}"/*

    # Set up environment variables for testing
    export COVERAGE_THRESHOLD=${MIN_COVERAGE}
    export JEST_JUNIT_OUTPUT_DIR="${COVERAGE_DIR}"
    export JEST_JUNIT_OUTPUT_NAME="junit.xml"

    log_info "Test environment initialized successfully"
}

# Run TypeScript tests using Jest
run_typescript_tests() {
    log_info "Running TypeScript tests..."

    # Find all TypeScript services
    local ts_services=("lead-service" "campaign-service" "validation-service")

    for service in "${ts_services[@]}"; do
        log_info "Testing ${service}..."
        
        # Run Jest with coverage
        NODE_OPTIONS="--max-old-space-size=4096" npx jest \
            --config="services/${service}/jest.config.ts" \
            --coverage \
            --coverageDirectory="${COVERAGE_DIR}/${service}" \
            --maxWorkers="${PARALLEL_JOBS}" \
            --testTimeout="${TEST_TIMEOUT}" \
            --forceExit \
            --detectOpenHandles \
            --verbose \
            || { log_error "${service} tests failed"; return 1; }
    done

    log_info "TypeScript tests completed successfully"
}

# Run Python tests for ML service
run_python_tests() {
    log_info "Running Python ML service tests..."

    cd services/ml-service || { log_error "ML service directory not found"; return 1; }

    # Activate virtual environment if it exists
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi

    # Run pytest with coverage
    python3 -m pytest \
        --cov=src \
        --cov-report=xml:"../../${COVERAGE_DIR}/ml-service/coverage.xml" \
        --cov-report=html:"../../${COVERAGE_DIR}/ml-service/html" \
        --cov-fail-under="${MIN_COVERAGE}" \
        tests/ \
        || { log_error "Python tests failed"; return 1; }

    cd ../.. || exit
    log_info "Python tests completed successfully"
}

# Run Go tests for RTB service
run_go_tests() {
    log_info "Running Go RTB service tests..."

    cd services/rtb-service || { log_error "RTB service directory not found"; return 1; }

    # Set Go test flags
    export GORACE="halt_on_error=1"
    
    # Run tests with race detection and coverage
    go test \
        -race \
        -coverprofile="../../${COVERAGE_DIR}/rtb-service/coverage.out" \
        -covermode=atomic \
        -timeout="${TEST_TIMEOUT}ms" \
        ./... \
        || { log_error "Go tests failed"; return 1; }

    # Convert coverage report to HTML
    go tool cover \
        -html="../../${COVERAGE_DIR}/rtb-service/coverage.out" \
        -o "../../${COVERAGE_DIR}/rtb-service/coverage.html"

    cd ../.. || exit
    log_info "Go tests completed successfully"
}

# Aggregate coverage reports
aggregate_coverage() {
    log_info "Aggregating coverage reports..."

    # Install coverage report tools if needed
    npm install -g istanbul-merge istanbul-reporter-cobertura

    # Merge coverage reports
    istanbul-merge \
        --out "${COVERAGE_DIR}/coverage-final.json" \
        "${COVERAGE_DIR}"/*/coverage-final.json

    # Generate unified HTML report
    istanbul report --dir "${COVERAGE_DIR}/unified" \
        --include "${COVERAGE_DIR}/coverage-final.json" \
        html cobertura

    # Check if coverage meets threshold
    local total_coverage
    total_coverage=$(jq -r '.total.lines.pct' "${COVERAGE_DIR}/coverage-final.json")
    
    if (( $(echo "${total_coverage} < ${MIN_COVERAGE}" | bc -l) )); then
        log_error "Coverage ${total_coverage}% is below minimum ${MIN_COVERAGE}%"
        return 1
    fi

    log_info "Overall coverage: ${total_coverage}%"
}

# Main execution
main() {
    log_info "Starting test execution..."

    initialize_test_environment || exit 1
    
    # Run tests for each service type
    run_typescript_tests || exit 1
    run_python_tests || exit 1
    run_go_tests || exit 1
    
    # Aggregate and check coverage
    aggregate_coverage || exit 1

    log_info "All tests completed successfully!"
}

# Execute main function
main "$@"