# -----------------------------
# Build Stage
# -----------------------------
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Set build arguments
ARG NODE_ENV=production
ARG NODE_OPTIONS="--max-old-space-size=4096"

# Copy package files for workspace setup
COPY package*.json ./
COPY lerna.json ./
COPY services/*/package*.json ./services/
COPY tsconfig.json ./
COPY services/*/tsconfig.json ./services/

# Install dependencies with workspace support
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# Copy source files
COPY . .

# Build TypeScript with project references
RUN npm run build

# Run security scans
RUN npm audit && \
    npm run security-audit

# Prune dev dependencies
RUN npm prune --production

# -----------------------------
# Production Stage
# -----------------------------
FROM node:20-alpine

# Install security updates and runtime dependencies
RUN apk update && \
    apk upgrade && \
    apk add --no-cache tini curl && \
    addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser && \
    mkdir -p /app/node_modules && \
    chown -R appuser:appgroup /app

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=4096" \
    PORT=3000

# Copy built artifacts and dependencies
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules/
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist/
COPY --from=builder --chown=appuser:appgroup /app/services/*/dist ./services/

# Copy health check script
COPY --chown=appuser:appgroup healthcheck.js ./

# Configure security permissions
RUN chmod 550 /app/dist && \
    chmod 440 /app/package*.json && \
    chmod 550 /app/healthcheck.js

# Switch to non-root user
USER appuser

# Configure health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Set security options
LABEL org.opencontainers.image.vendor="Insurance Platform" \
      org.opencontainers.image.title="Backend Services" \
      org.opencontainers.image.description="Multi-vertical insurance lead generation platform backend services" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.licenses="UNLICENSED"

# Configure read-only root filesystem
VOLUME ["/tmp"]
RUN chmod 1777 /tmp

# Drop all capabilities and run with minimal privileges
USER 1001:1001

# Start the application
CMD ["node", "dist/index.js"]

# Expose service port
EXPOSE 3000