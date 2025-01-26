import mongoose from 'mongoose'; // v7.5.0
import winston from 'winston'; // v3.10.0

// Configuration Constants
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campaign-service';

const MONGODB_OPTIONS: mongoose.ConnectOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 100,
    minPoolSize: 10,
    retryWrites: true,
    retryReads: true,
    w: 'majority',
    readPreference: 'primaryPreferred',
    heartbeatFrequencyMS: 10000,
    replicaSet: 'rs0',
    ssl: true,
    authSource: 'admin',
    connectTimeoutMS: 30000
};

const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 1000;

// Logger configuration
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'database-error.log', level: 'error' })
    ]
});

/**
 * Monitors database connection health and performance metrics
 */
function monitorConnectionHealth(): void {
    const { connections } = mongoose;
    
    setInterval(() => {
        connections.forEach((connection, index) => {
            const metrics = {
                readyState: connection.readyState,
                active: connection.active,
                available: connection.available,
                pending: connection.pending,
                serverLatencyMS: connection.serverLatencyMS
            };

            logger.info('Connection health metrics', {
                connectionIndex: index,
                metrics,
                timestamp: new Date().toISOString()
            });

            // Alert on critical conditions
            if (connection.readyState !== 1) {
                logger.error('Connection not ready', {
                    connectionIndex: index,
                    readyState: connection.readyState
                });
            }
        });
    }, 30000); // Check every 30 seconds
}

/**
 * Handles database connection errors with retry logic
 * @param error - The connection error
 * @param retryAttempt - Current retry attempt number
 */
async function handleConnectionError(error: Error, retryAttempt: number): Promise<void> {
    const backoffDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryAttempt);

    logger.error('Database connection error', {
        error: error.message,
        stack: error.stack,
        retryAttempt,
        backoffDelay
    });

    if (retryAttempt >= MAX_RETRY_ATTEMPTS) {
        logger.error('Max retry attempts reached, failing connection', {
            maxAttempts: MAX_RETRY_ATTEMPTS
        });
        throw new Error('Failed to connect to database after maximum retry attempts');
    }

    await new Promise(resolve => setTimeout(resolve, backoffDelay));
}

/**
 * Establishes connection to MongoDB with retry logic and monitoring
 */
export async function connectDatabase(): Promise<void> {
    logger.info('Initiating database connection', {
        uri: MONGODB_URI.replace(/\/\/.*@/, '//***:***@'), // Mask credentials
        options: MONGODB_OPTIONS
    });

    let retryAttempt = 0;

    while (retryAttempt < MAX_RETRY_ATTEMPTS) {
        try {
            // Set up connection event listeners
            mongoose.connection.on('connected', () => {
                logger.info('Successfully connected to MongoDB');
                monitorConnectionHealth();
            });

            mongoose.connection.on('disconnected', () => {
                logger.warn('MongoDB connection disconnected');
            });

            mongoose.connection.on('reconnected', () => {
                logger.info('MongoDB connection reestablished');
            });

            mongoose.connection.on('error', (err) => {
                logger.error('MongoDB connection error', { error: err.message });
            });

            // Attempt connection
            await mongoose.connect(MONGODB_URI, MONGODB_OPTIONS);
            
            // Connection successful
            logger.info('Database connection established successfully');
            return;

        } catch (error) {
            await handleConnectionError(error as Error, retryAttempt);
            retryAttempt++;
        }
    }
}

/**
 * Gracefully closes database connection
 */
export async function disconnectDatabase(): Promise<void> {
    logger.info('Initiating database disconnection');

    try {
        await mongoose.disconnect();
        logger.info('Database disconnected successfully');
    } catch (error) {
        logger.error('Error during database disconnection', {
            error: (error as Error).message,
            stack: (error as Error).stack
        });
        throw error;
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    try {
        await disconnectDatabase();
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', {
            error: (error as Error).message
        });
        process.exit(1);
    }
});