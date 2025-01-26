# ---- Build Stage ----
FROM node:20-alpine AS builder

# Add build essentials for native dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files with cache optimization
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code and configs
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Remove build tools
RUN apk del python3 make g++

# ---- Production Stage ----
FROM node:20-alpine

# Set production environment
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=768" \
    TZ=UTC

# Create non-root user/group
RUN addgroup -g 1001 -S node && \
    adduser -u 1001 -S node -G node

# Set working directory
WORKDIR /app

# Copy built artifacts and dependencies from builder
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package*.json ./

# Create required directories with proper permissions
RUN mkdir -p /tmp/cache && \
    chown -R node:node /tmp/cache && \
    chmod 1777 /tmp/cache

# Security configurations
RUN chmod -R 555 /app && \
    chmod -R 444 /app/dist && \
    chmod 444 package*.json

# Switch to non-root user
USER node

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Expose application port
EXPOSE 3000

# Set resource limits
LABEL com.docker.resource.memory.limit="1Gi" \
      com.docker.resource.memory.reservation="768Mi" \
      com.docker.resource.cpu.limit="1000m" \
      com.docker.resource.cpu.reservation="500m"

# Add metadata labels
LABEL maintainer="Insurance Platform Team" \
      service="campaign-service" \
      version="1.0.0" \
      security.scan.status="verified" \
      logging.format="json" \
      monitoring.enabled="true"

# Configure graceful shutdown
STOPSIGNAL SIGTERM

# Set entry point with proper signal handling
CMD ["node", "--enable-source-maps", "dist/index.js"]