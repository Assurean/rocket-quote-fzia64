# Stage 1: Builder
FROM node:20-alpine AS builder

# Build arguments
ARG NODE_ENV=production
ARG NPM_TOKEN

# Set working directory
WORKDIR /build

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files for layer caching
COPY package*.json ./
COPY tsconfig*.json ./

# Authenticate with private npm registry if needed
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc

# Install dependencies with exact versions
RUN npm ci --production=false

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Run security audit
RUN npm run security:audit

# Clean dev dependencies
RUN npm prune --production

# Remove npm token file
RUN rm -f .npmrc

# Stage 2: Production
FROM node:20-alpine

# Set labels
LABEL maintainer="DevOps Team <devops@company.com>" \
      version="1.0.0" \
      service="lead-service"

# Create non-root user/group
RUN addgroup -g 1000 nodejs && \
    adduser -u 1000 -G nodejs -s /bin/sh -D nodejs

# Set working directory
WORKDIR /app

# Copy production dependencies and compiled code
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/package.json ./

# Set ownership and permissions
RUN chown -R nodejs:nodejs /app && \
    chmod -R 550 /app

# Create and set permissions for volumes
RUN mkdir -p /app/logs /tmp && \
    chown -R nodejs:nodejs /app/logs /tmp && \
    chmod -R 750 /app/logs /tmp

# Set security options
RUN apk add --no-cache dumb-init

# Set environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=1024" \
    NPM_CONFIG_LOGLEVEL=warn

# Set resource limits
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set security options
SECURITY_OPTS="--security-opt=no-new-privileges:true --security-opt=seccomp=unconfined"

# Define volumes
VOLUME ["/app/logs", "/tmp"]

# Start application with dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]