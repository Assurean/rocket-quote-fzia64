import mongoose from 'mongoose'; // v7.0.0
import winston from 'winston'; // v3.8.0
import { Lead } from '../models/lead.model';

// Configure logger for database operations
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'database-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'database.log' })
  ]
});

// MongoDB connection URI with fallback
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leads';

// Enhanced MongoDB connection options with security and performance optimizations
const createConnectionOptions = (): mongoose.ConnectOptions => {
  return {
    retryWrites: true,
    w: 'majority',
    wtimeout: 10000,
    maxPoolSize: 100,
    minPoolSize: 10,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    ssl: process.env.MONGODB_SSL_ENABLED === 'true',
    replicaSet: process.env.MONGODB_REPLICA_SET,
    authSource: 'admin',
    sslValidate: true,
    sslCA: process.env.MONGODB_SSL_CA,
    sslCert: process.env.MONGODB_SSL_CERT,
    sslKey: process.env.MONGODB_SSL_KEY,
    readPreference: 'secondaryPreferred',
    retryReads: true,
    autoIndex: false,
    serverSelectionTimeoutMS: 15000,
    heartbeatFrequencyMS: 10000,
    autoEncryption: {
      keyVaultNamespace: 'encryption.__keyVault',
      kmsProviders: {
        aws: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      }
    }
  };
};

// Retry decorator for database operations
const retryable = (retries: number) => {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError;
      for (let i = 0; i < retries; i++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          logger.warn(`Retry attempt ${i + 1} of ${retries} failed`, { error });
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
      throw lastError;
    };

    return descriptor;
  };
};

// Monitoring decorator for database operations
const monitored = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = Date.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - start;
      logger.info(`Database operation ${propertyKey} completed`, { duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Database operation ${propertyKey} failed`, { duration, error });
      throw error;
    }
  };

  return descriptor;
};

// Initialize MongoDB connection with enhanced security and monitoring
@retryable(3)
@monitored
export const initializeDatabase = async (): Promise<mongoose.Connection> => {
  try {
    // Configure mongoose settings
    mongoose.set('strictQuery', true);
    mongoose.set('debug', process.env.NODE_ENV === 'development');

    // Connect to MongoDB with enhanced options
    await mongoose.connect(MONGODB_URI, createConnectionOptions());

    const connection = mongoose.connection;

    // Configure comprehensive connection event handlers
    connection.on('connected', () => {
      logger.info('Successfully connected to MongoDB');
    });

    connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Monitor connection pool metrics
    setInterval(() => {
      logger.info('Connection pool metrics', {
        active: connection.active,
        available: connection.available,
        pending: connection.pending
      });
    }, 60000);

    // Initialize indexes in background
    await Lead.init();

    return connection;
  } catch (error) {
    logger.error('Failed to initialize database connection:', error);
    throw error;
  }
};

// Enhanced health check function with comprehensive monitoring
export const createHealthCheck = async (connection: mongoose.Connection): Promise<HealthCheckResult> => {
  try {
    // Check basic connection status
    if (!connection || connection.readyState !== 1) {
      throw new Error('Database connection is not ready');
    }

    // Verify read operations
    const startRead = Date.now();
    await Lead.findOne().select('_id').lean().exec();
    const readLatency = Date.now() - startRead;

    // Verify write operations
    const startWrite = Date.now();
    const testDoc = await Lead.create({ _id: new mongoose.Types.ObjectId() });
    await Lead.deleteOne({ _id: testDoc._id });
    const writeLatency = Date.now() - startWrite;

    // Check replica set status if applicable
    let replicaStatus = null;
    if (process.env.MONGODB_REPLICA_SET) {
      replicaStatus = await connection.db.admin().replSetGetStatus();
    }

    // Collect connection pool metrics
    const poolMetrics = {
      active: connection.active,
      available: connection.available,
      pending: connection.pending
    };

    return {
      status: 'healthy',
      details: {
        readLatency,
        writeLatency,
        connectionPool: poolMetrics,
        replicaSet: replicaStatus,
        encryptionEnabled: !!process.env.MONGODB_SSL_ENABLED,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error('Health check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Health check result interface
interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  details?: {
    readLatency: number;
    writeLatency: number;
    connectionPool: {
      active: number;
      available: number;
      pending: number;
    };
    replicaSet: any;
    encryptionEnabled: boolean;
    timestamp: string;
  };
  error?: string;
  timestamp: string;
}

export default initializeDatabase;