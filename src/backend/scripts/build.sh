#!/usr/bin/env bash

# Build script for Multi-Vertical Insurance Lead Generation Platform backend services
# Version: 1.0.0
# Node.js version: 20 LTS
# Docker version: 24+

set -euo pipefail
IFS=$'\n\t'

# Global configuration
DOCKER_REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
BUILD_MODE="${BUILD_MODE:-production}"
MAX_PARALLEL_BUILDS="${MAX_PARALLEL_BUILDS:-4}"
ENABLE_SECURITY_SCAN="${ENABLE_SECURITY_SCAN:-true}"

# Service directories
SERVICES=(
    "lead-service"
    "campaign-service"
    "validation-service"
    "ml-service"
    "rtb-service"
)

# Logging configuration
LOG_FILE="build-$(date +%Y%m%d-%H%M%S).log"
exec 1> >(tee -a "$LOG_FILE") 2>&1

# Color configuration
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    log_info "Cleaning up build artifacts..."
    rm -rf ./tmp
    if [ $exit_code -ne 0 ]; then
        log_error "Build failed with exit code $exit_code"
    fi
    exit $exit_code
}

# Set up cleanup trap
trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log_info "Checking build prerequisites..."

    # Check Docker version
    if ! docker --version | grep -q "version 24"; then
        log_error "Docker version 24+ is required"
        return 1
    fi

    # Check Node.js version
    if ! node --version | grep -q "v20"; then
        log_error "Node.js v20 LTS is required"
        return 1
    }

    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        return 1
    }

    # Check Docker registry connectivity
    if ! curl -s "$DOCKER_REGISTRY/v2/" >/dev/null; then
        log_warn "Docker registry $DOCKER_REGISTRY is not accessible"
    fi

    # Check disk space
    local available_space=$(df -P . | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 5242880 ]; then
        log_error "Insufficient disk space (5GB required)"
        return 1
    }

    return 0
}

# Build TypeScript services
build_typescript_services() {
    log_info "Building TypeScript services..."
    
    # Create temporary build directory
    mkdir -p ./tmp/build

    # Install dependencies
    log_info "Installing dependencies..."
    npm ci --no-audit --prefer-offline

    # Build all services in parallel
    log_info "Building services..."
    local build_commands=()
    for service in "${SERVICES[@]}"; do
        if [ -f "services/$service/package.json" ]; then
            build_commands+=("cd services/$service && npm run build")
        fi
    done

    # Execute builds in parallel with limit
    printf "%s\n" "${build_commands[@]}" | xargs -P "$MAX_PARALLEL_BUILDS" -I {} bash -c '{}'

    # Run tests if in production mode
    if [ "$BUILD_MODE" = "production" ]; then
        log_info "Running tests..."
        npm run test
    fi

    # Security audit in production
    if [ "$BUILD_MODE" = "production" ] && [ "$ENABLE_SECURITY_SCAN" = "true" ]; then
        log_info "Running security audit..."
        npm audit --production
    fi

    return 0
}

# Build Docker images
build_docker_images() {
    log_info "Building Docker images..."

    # Configure Docker buildx
    docker buildx create --use --name insurance-platform-builder

    # Build each service
    for service in "${SERVICES[@]}"; do
        if [ -f "services/$service/Dockerfile" ]; then
            log_info "Building $service image..."
            
            # Build arguments
            local build_args=(
                "--build-arg NODE_VERSION=20"
                "--build-arg BUILD_MODE=$BUILD_MODE"
                "--build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
                "--build-arg VCS_REF=$(git rev-parse --short HEAD)"
            )

            # Security scanning
            if [ "$ENABLE_SECURITY_SCAN" = "true" ]; then
                build_args+=("--security-opt seccomp=unconfined")
            fi

            # Build image
            docker buildx build \
                ${build_args[@]} \
                --platform linux/amd64 \
                --cache-from type=registry,ref=$DOCKER_REGISTRY/$service:cache \
                --cache-to type=registry,ref=$DOCKER_REGISTRY/$service:cache,mode=max \
                --tag $DOCKER_REGISTRY/$service:$IMAGE_TAG \
                --file services/$service/Dockerfile \
                --push \
                services/$service

            # Verify image
            if ! docker pull $DOCKER_REGISTRY/$service:$IMAGE_TAG >/dev/null; then
                log_error "Failed to verify $service image"
                return 1
            fi
        fi
    done

    return 0
}

# Main build function
main() {
    log_info "Starting build process..."
    log_info "Build mode: $BUILD_MODE"
    log_info "Docker registry: $DOCKER_REGISTRY"
    log_info "Image tag: $IMAGE_TAG"

    # Create build directory
    mkdir -p ./tmp
    cd "$(dirname "$0")/.."

    # Run build steps
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        return 1
    fi

    if ! build_typescript_services; then
        log_error "TypeScript build failed"
        return 1
    fi

    if ! build_docker_images; then
        log_error "Docker build failed"
        return 1
    fi

    log_info "Build completed successfully"
    return 0
}

# Execute main function
main "$@"