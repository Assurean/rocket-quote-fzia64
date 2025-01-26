# Build stage
FROM golang:1.21-alpine AS builder

# Install required system packages
RUN apk add --no-cache ca-certificates tzdata git

# Set working directory
WORKDIR /app

# Set build arguments for version control
ARG VERSION=1.0.0
ARG BUILD_DATE
ARG GIT_COMMIT

# Set build environment variables for optimization
ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64 \
    GO111MODULE=on

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code and config
COPY . .

# Build the application with security flags and optimizations
RUN go build \
    -ldflags="-w -s \
    -X main.Version=${VERSION} \
    -X main.BuildDate=${BUILD_DATE} \
    -X main.GitCommit=${GIT_COMMIT} \
    -extldflags '-static'" \
    -trimpath \
    -o rtb-service ./src/main.go

# Runtime stage
FROM scratch

# Import certificates and timezone data
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Create non-root user
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

# Copy the binary
COPY --from=builder /app/rtb-service /rtb-service
COPY --from=builder /app/config /config

# Set environment variables
ENV PORT=8080 \
    METRICS_PORT=9090 \
    GIN_MODE=release \
    TZ=UTC

# Use non-root user
USER nobody:nobody

# Expose service and metrics ports
EXPOSE ${PORT}
EXPOSE ${METRICS_PORT}

# Configure healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/rtb-service", "health"]

# Set resource limits
LABEL org.opencontainers.image.source="github.com/insurance-lead-platform/rtb-service" \
    org.opencontainers.image.version="${VERSION}" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${GIT_COMMIT}" \
    org.opencontainers.image.vendor="Insurance Lead Platform" \
    org.opencontainers.image.title="RTB Service" \
    org.opencontainers.image.description="Real-Time Bidding service for insurance lead generation platform"

# Set memory and CPU constraints
LABEL com.docker.memory="1g" \
    com.docker.cpu="1.0"

# Run with security options
ENTRYPOINT ["/rtb-service"]
CMD ["serve"]