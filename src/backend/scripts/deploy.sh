#!/usr/bin/env bash

# Multi-Vertical Insurance Lead Generation Platform - Deployment Script
# Version: 1.0.0
# Dependencies:
# - kubectl v1.27+
# - helm v3.0+
# - aws-cli v2.0+
# - istioctl v1.19+

set -euo pipefail
IFS=$'\n\t'

# Import build script functions
source "$(dirname "$0")/build.sh"

# Environment variables with defaults
DEPLOY_ENV="${DEPLOY_ENV:-staging}"
KUBE_CONTEXT="${KUBE_CONTEXT:-staging-cluster}"
AWS_REGION="${AWS_REGION:-us-east-1}"
NAMESPACE="${NAMESPACE:-default}"
LOG_LEVEL="${LOG_LEVEL:-INFO}"
DEPLOY_TIMEOUT="${DEPLOY_TIMEOUT:-300}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-5}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-true}"

# Color configuration
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

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
    if [ $exit_code -ne 0 ]; then
        log_error "Deployment failed with exit code $exit_code"
        if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
            rollback_deployment "$service_name" "$(kubectl rollout history deployment "$service_name" -n "$NAMESPACE" | tail -n 1 | awk '{print $1}')"
        fi
    fi
    exit $exit_code
}

trap cleanup EXIT

# Check deployment prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."

    # Check required tools
    local required_tools=("kubectl" "helm" "aws" "istioctl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed"
            return 1
        fi
    done

    # Verify kubectl context
    if ! kubectl config use-context "$KUBE_CONTEXT" &> /dev/null; then
        log_error "Failed to switch to Kubernetes context: $KUBE_CONTEXT"
        return 1
    fi

    # Check AWS CLI configuration
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS CLI is not properly configured"
        return 1
    }

    # Verify cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        return 1
    }

    # Check namespace existence
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_warn "Namespace $NAMESPACE does not exist, creating..."
        kubectl create namespace "$NAMESPACE"
    fi

    # Verify Istio installation
    if ! istioctl verify-install &> /dev/null; then
        log_error "Istio is not properly installed"
        return 1
    }

    log_info "Prerequisites check completed successfully"
    return 0
}

# Deploy microservice
deploy_service() {
    local service_name="$1"
    local image_tag="$2"
    local resource_config="$3"

    log_info "Deploying service: $service_name"

    # Apply ConfigMaps and Secrets
    kubectl apply -f "../k8s/$service_name/configmap.yaml" -n "$NAMESPACE"
    kubectl apply -f "../k8s/$service_name/secrets.yaml" -n "$NAMESPACE"

    # Configure service mesh
    istioctl install -f "../k8s/$service_name/istio-config.yaml" -y

    # Deploy service with rolling update
    kubectl set image deployment/"$service_name" \
        "$service_name=$service_name:$image_tag" \
        --record=true \
        -n "$NAMESPACE"

    # Wait for rollout completion
    if ! kubectl rollout status deployment/"$service_name" \
        -n "$NAMESPACE" \
        --timeout="${DEPLOY_TIMEOUT}s"; then
        log_error "Deployment rollout failed for $service_name"
        return 1
    fi

    # Apply resource quotas and limits
    kubectl apply -f "../k8s/$service_name/resource-quotas.yaml" -n "$NAMESPACE"

    # Configure HPA
    kubectl apply -f "../k8s/$service_name/hpa.yaml" -n "$NAMESPACE"

    # Set up monitoring
    kubectl apply -f "../k8s/$service_name/service-monitor.yaml" -n "$NAMESPACE"

    # Apply network policies
    kubectl apply -f "../k8s/$service_name/network-policy.yaml" -n "$NAMESPACE"

    log_info "Service $service_name deployed successfully"
    return 0
}

# Deploy monitoring stack
deploy_monitoring() {
    log_info "Deploying monitoring stack..."

    # Add Helm repositories
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    # Deploy Prometheus operator
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --values "../helm/monitoring/prometheus-values.yaml"

    # Deploy Jaeger
    kubectl apply -f "../k8s/monitoring/jaeger-operator.yaml"

    # Configure AlertManager
    kubectl apply -f "../k8s/monitoring/alertmanager-config.yaml"

    # Set up logging stack
    helm upgrade --install logging elastic/elasticsearch \
        --namespace logging \
        --create-namespace \
        --values "../helm/monitoring/elasticsearch-values.yaml"

    log_info "Monitoring stack deployed successfully"
    return 0
}

# Validate deployment
validate_deployment() {
    local service_name="$1"
    log_info "Validating deployment for $service_name..."

    # Check pod health
    local ready_pods=$(kubectl get pods -l app="$service_name" \
        -n "$NAMESPACE" \
        -o jsonpath='{.items[*].status.containerStatuses[*].ready}' | tr ' ' '\n' | grep -c "true")
    
    if [ "$ready_pods" -eq 0 ]; then
        log_error "No healthy pods found for $service_name"
        return 1
    fi

    # Verify service endpoints
    if ! kubectl get endpoints "$service_name" -n "$NAMESPACE" | grep -q ":"; then
        log_error "No endpoints available for $service_name"
        return 1
    }

    # Check metrics collection
    if ! curl -s "http://prometheus-operated:9090/api/v1/targets" | grep -q "$service_name"; then
        log_warn "Prometheus is not collecting metrics for $service_name"
    fi

    # Validate service mesh configuration
    if ! istioctl analyze -n "$NAMESPACE" | grep -q "No validation issues found"; then
        log_warn "Istio configuration issues detected"
    }

    log_info "Deployment validation completed for $service_name"
    return 0
}

# Rollback deployment
rollback_deployment() {
    local service_name="$1"
    local revision="$2"

    log_warn "Rolling back deployment for $service_name to revision $revision"

    kubectl rollout undo deployment/"$service_name" \
        --to-revision="$revision" \
        -n "$NAMESPACE"

    if ! kubectl rollout status deployment/"$service_name" \
        -n "$NAMESPACE" \
        --timeout="${DEPLOY_TIMEOUT}s"; then
        log_error "Rollback failed for $service_name"
        return 1
    fi

    log_info "Rollback completed successfully for $service_name"
    return 0
}

# Main deployment function
main() {
    log_info "Starting deployment process for environment: $DEPLOY_ENV"

    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    fi

    # Deploy monitoring stack first
    if ! deploy_monitoring; then
        log_error "Failed to deploy monitoring stack"
        exit 1
    }

    # Deploy each service
    local services=("lead-service" "campaign-service" "validation-service" "ml-service" "rtb-service")
    for service in "${services[@]}"; do
        log_info "Processing deployment for $service"

        # Build and push Docker image
        if ! build_docker_images "$service"; then
            log_error "Failed to build Docker image for $service"
            continue
        }

        # Deploy service
        if ! deploy_service "$service" "latest" "{}"; then
            log_error "Failed to deploy $service"
            continue
        }

        # Validate deployment
        if ! validate_deployment "$service"; then
            log_error "Deployment validation failed for $service"
            continue
        }

        log_info "Successfully deployed $service"
    done

    log_info "Deployment process completed"
    return 0
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi