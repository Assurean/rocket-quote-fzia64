# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including dev dependencies
RUN npm ci

# Copy source code and config files
COPY tsconfig.json ./
COPY src ./src

# Build the application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Run security audit
RUN npm audit

# Production stage
FROM node:20-alpine

# Set environment variables for Node.js optimization
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512 --optimize-for-size --gc-interval=100" \
    NPM_CONFIG_LOGLEVEL=warn

# Create non-root user
RUN addgroup -S nonroot && \
    adduser -S nonroot -G nonroot

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production && \
    npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Set ownership to non-root user
RUN chown -R nonroot:nonroot /app

# Configure security settings
RUN apk add --no-cache dumb-init && \
    chmod -R 555 /app && \
    mkdir -p /app/logs && \
    chown -R nonroot:nonroot /app/logs

# Switch to non-root user
USER nonroot

# Set up container labels
LABEL maintainer="Insurance Lead Platform Team" \
      com.insurance.service="validation" \
      com.insurance.version="${VERSION}" \
      com.insurance.build-date="${BUILD_DATE}" \
      com.insurance.git-commit="${GIT_COMMIT}"

# Expose service port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set resource limits
ENV MEMORY_LIMIT=1g \
    CPU_LIMIT=1

# Use dumb-init as entrypoint for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the service
CMD ["node", "dist/index.js"]

# Security options
SECURITY_OPT no-new-privileges:true
SECURITY_OPT seccomp=unconfined

# Read-only root filesystem
VOLUME ["/app/logs"]
READONLY_ROOTFS true

# Drop all capabilities
DROP_CAPABILITIES ALL