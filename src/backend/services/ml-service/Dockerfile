# Build stage
FROM python:3.11-slim AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN curl -sSL https://install.python-poetry.org | python3 -

# Copy dependency files
COPY pyproject.toml poetry.lock* ./
COPY requirements.txt ./

# Install dependencies with optimized compilation
RUN python -m venv /opt/venv && \
    . /opt/venv/bin/activate && \
    pip install --no-cache-dir -r requirements.txt && \
    poetry install --no-dev --no-interaction --no-ansi

# Copy source code and model files
COPY src/ ./src/
COPY models/ ./models/

# Compile Python bytecode
RUN python -m compileall .

# Runtime stage
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Create non-root user
RUN groupadd -r ml-service && \
    useradd -r -g ml-service -s /sbin/nologin -d /app ml-service && \
    mkdir -p /app/models /app/logs /tmp/prometheus && \
    chown -R ml-service:ml-service /app /tmp/prometheus

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Copy application files
COPY --from=builder --chown=ml-service:ml-service /app/src ./src
COPY --from=builder --chown=ml-service:ml-service /app/models ./models

# Set environment variables
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH="/app/src" \
    MODEL_PATH="/app/models" \
    LOG_LEVEL="INFO" \
    WORKERS="2" \
    THREADS="4" \
    MAX_REQUESTS="10000" \
    PROMETHEUS_MULTIPROC_DIR="/tmp/prometheus" \
    CUDA_VISIBLE_DEVICES="" \
    PYTHONUNBUFFERED="1"

# Configure log rotation
RUN mkdir -p /etc/docker-entrypoint.d && \
    echo '#!/bin/sh\n\
    exec logrotate -v /etc/logrotate.d/ml-service' > /etc/docker-entrypoint.d/logrotate && \
    chmod +x /etc/docker-entrypoint.d/logrotate

# Set security limits
RUN echo "ml-service soft nofile 65535" >> /etc/security/limits.conf && \
    echo "ml-service hard nofile 65535" >> /etc/security/limits.conf

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Set resource limits
ENV NVIDIA_VISIBLE_DEVICES=${CUDA_VISIBLE_DEVICES} \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Switch to non-root user
USER ml-service

# Start command with Gunicorn
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "${WORKERS}", \
     "--threads", "${THREADS}", \
     "--worker-class", "gthread", \
     "--worker-tmp-dir", "/dev/shm", \
     "--max-requests", "${MAX_REQUESTS}", \
     "--max-requests-jitter", "1000", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "${LOG_LEVEL}", \
     "--logger-class", "src.utils.logging.GunicornJsonLogger", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--preload", \
     "src.main:app"]

# Labels for container metadata
LABEL maintainer="Insurance Lead Platform Team" \
      version="1.0.0" \
      description="ML service for real-time lead scoring and dynamic pricing" \
      org.opencontainers.image.source="https://github.com/org/insurance-lead-platform"