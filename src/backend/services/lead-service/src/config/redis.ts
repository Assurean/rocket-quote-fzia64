import Redis from 'ioredis';
import winston from 'winston';

// Logger configuration for Redis operations
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'redis-config' },
  transports: [
    new winston.transports.Console()
  ]
});

// Global constants
export const REDIS_KEY_PREFIX = 'lead-service:';
const REDIS_HOSTS = process.env.REDIS_HOSTS?.split(',') || ['localhost:6379'];

// Base Redis connection options
const REDIS_OPTIONS: Redis.RedisOptions = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  keepAlive: 30000,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  reconnectOnError: (err: Error) => true,
  tls: process.env.REDIS_TLS_ENABLED === 'true' ? {} : undefined,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  connectionName: 'lead-service',
  maxReconnectAttempts: 10,
  autoResendUnfulfilledCommands: true,
  lazyConnect: true
};

// Cluster-specific configuration options
const REDIS_CLUSTER_OPTIONS: Redis.ClusterOptions = {
  clusterRetryStrategy: (times: number) => Math.min(times * 100, 3000),
  enableOfflineQueue: true,
  enableReadyCheck: true,
  scaleReads: 'slave',
  redisOptions: REDIS_OPTIONS,
  maxRedirections: 3,
  retryDelayOnFailover: 100,
  retryDelayOnClusterDown: 100,
  enableAutoPipelining: true
};

/**
 * Creates a standalone Redis client with robust configuration
 * @returns Configured Redis client instance
 */
const createStandaloneClient = (): Redis.Redis => {
  const client = new Redis({
    host: REDIS_HOSTS[0].split(':')[0],
    port: parseInt(REDIS_HOSTS[0].split(':')[1], 10),
    ...REDIS_OPTIONS
  });

  client.on('connect', () => {
    logger.info('Redis client connected successfully');
  });

  client.on('error', (error) => {
    logger.error('Redis client error:', error);
  });

  client.on('ready', () => {
    logger.info('Redis client ready for operations');
  });

  client.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  return client;
};

/**
 * Creates Redis cluster client with advanced configuration for high availability
 * @returns Configured cluster client instance
 */
const createClusterClient = (): Redis.Cluster => {
  const nodes = REDIS_HOSTS.map(host => {
    const [hostname, port] = host.split(':');
    return { host: hostname, port: parseInt(port, 10) };
  });

  const cluster = new Redis.Cluster(nodes, REDIS_CLUSTER_OPTIONS);

  cluster.on('connect', () => {
    logger.info('Redis cluster connected successfully');
  });

  cluster.on('error', (error) => {
    logger.error('Redis cluster error:', error);
  });

  cluster.on('node error', (error, node) => {
    logger.error(`Redis cluster node error on ${node.options.host}:${node.options.port}:`, error);
  });

  cluster.on('+node', (node) => {
    logger.info(`Redis cluster node added: ${node.options.host}:${node.options.port}`);
  });

  cluster.on('-node', (node) => {
    logger.info(`Redis cluster node removed: ${node.options.host}:${node.options.port}`);
  });

  return cluster;
};

/**
 * Creates comprehensive Redis health check function
 * @param client Redis client instance
 * @returns Promise resolving to health check status
 */
export const createHealthCheck = (client: Redis.Redis | Redis.Cluster): () => Promise<boolean> => {
  return async (): Promise<boolean> => {
    try {
      const healthCheckKey = `${REDIS_KEY_PREFIX}health`;
      const testValue = 'health-check';
      
      // Test basic operations
      await client.set(healthCheckKey, testValue, 'EX', 10);
      const result = await client.get(healthCheckKey);
      
      if (result !== testValue) {
        logger.error('Redis health check failed: value mismatch');
        return false;
      }

      // Additional cluster health check if applicable
      if (client instanceof Redis.Cluster) {
        const nodes = await (client as Redis.Cluster).nodes();
        if (nodes.length === 0) {
          logger.error('Redis health check failed: no cluster nodes available');
          return false;
        }
      }

      await client.del(healthCheckKey);
      return true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  };
};

/**
 * Initializes Redis client with comprehensive cluster support and monitoring
 * @returns Promise resolving to initialized Redis client
 */
const initializeRedis = async (): Promise<Redis.Redis | Redis.Cluster> => {
  try {
    const client = REDIS_HOSTS.length > 1 ? createClusterClient() : createStandaloneClient();

    // Verify connection
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, REDIS_OPTIONS.connectTimeout);

      client.once('ready', () => {
        clearTimeout(timeoutId);
        resolve();
      });

      client.once('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });

    // Initial health check
    const healthCheck = createHealthCheck(client);
    const isHealthy = await healthCheck();
    
    if (!isHealthy) {
      throw new Error('Redis initial health check failed');
    }

    logger.info('Redis client initialized successfully');
    return client;
  } catch (error) {
    logger.error('Failed to initialize Redis client:', error);
    throw error;
  }
};

export default initializeRedis;