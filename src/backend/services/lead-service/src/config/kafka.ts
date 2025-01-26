import { Kafka, Producer, Consumer, logLevel, CompressionTypes } from 'kafkajs'; // ^2.2.0
import winston from 'winston'; // ^3.8.0
import { Lead } from '../models/lead.model';

// Initialize logger for Kafka operations
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'kafka-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'kafka-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'kafka-combined.log' })
  ]
});

// Environment-based configuration
export const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
export const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'lead-service';
export const KAFKA_CONSUMER_GROUP = process.env.KAFKA_CONSUMER_GROUP || 'lead-service-group';

// SSL Configuration
const SSL_CONFIG = {
  rejectUnauthorized: process.env.KAFKA_SSL_REJECT_UNAUTHORIZED === 'true',
  ca: process.env.KAFKA_SSL_CA,
  key: process.env.KAFKA_SSL_KEY,
  cert: process.env.KAFKA_SSL_CERT
};

// SASL Configuration
const SASL_CONFIG = {
  mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
  username: process.env.KAFKA_SASL_USERNAME,
  password: process.env.KAFKA_SASL_PASSWORD
};

// Topic configuration
export const KAFKA_TOPICS = {
  LEAD_CREATED: 'lead.created',
  LEAD_VALIDATED: 'lead.validated',
  LEAD_SCORED: 'lead.scored',
  LEAD_MATCHED: 'lead.matched',
  LEAD_SOLD: 'lead.sold',
  DEAD_LETTER: 'lead.dlq'
} as const;

// Kafka client configuration
const createKafkaClient = (): Kafka => {
  const config: any = {
    clientId: KAFKA_CLIENT_ID,
    brokers: KAFKA_BROKERS,
    logLevel: logLevel.INFO,
    retry: {
      initialRetryTime: 100,
      retries: 8,
      maxRetryTime: 30000,
      factor: 2
    }
  };

  // Add SSL if configured
  if (SSL_CONFIG.cert && SSL_CONFIG.key) {
    config.ssl = SSL_CONFIG;
  }

  // Add SASL if configured
  if (SASL_CONFIG.username && SASL_CONFIG.password) {
    config.sasl = SASL_CONFIG;
  }

  return new Kafka(config);
};

// Producer configuration
export const createProducer = async (kafka: Kafka): Promise<Producer> => {
  const producer = kafka.producer({
    allowAutoTopicCreation: false,
    transactionTimeout: 30000,
    idempotent: true
  });

  await producer.connect();

  // Configure producer events
  producer.on('producer.connect', () => {
    logger.info('Producer connected successfully');
  });

  producer.on('producer.disconnect', () => {
    logger.error('Producer disconnected');
  });

  producer.on('producer.network.request_timeout', (payload) => {
    logger.error('Producer network timeout', payload);
  });

  return producer;
};

// Consumer configuration
export const createConsumer = async (kafka: Kafka): Promise<Consumer> => {
  const consumer = kafka.consumer({
    groupId: KAFKA_CONSUMER_GROUP,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxBytes: 1048576, // 1MB
    maxWaitTimeInMs: 500,
    retry: {
      initialRetryTime: 100,
      retries: 8
    }
  });

  await consumer.connect();

  // Configure consumer events
  consumer.on('consumer.connect', () => {
    logger.info('Consumer connected successfully');
  });

  consumer.on('consumer.disconnect', () => {
    logger.error('Consumer disconnected');
  });

  consumer.on('consumer.group_join', () => {
    logger.info('Consumer joined group successfully');
  });

  consumer.on('consumer.crash', (error) => {
    logger.error('Consumer crashed', error);
  });

  return consumer;
};

// Health check function
export const createHealthCheck = async (
  producer: Producer,
  consumer: Consumer
): Promise<boolean> => {
  try {
    // Check producer connection
    const producerHealth = await producer.send({
      topic: KAFKA_TOPICS.LEAD_CREATED,
      messages: [{ 
        key: 'health-check',
        value: JSON.stringify({ timestamp: Date.now() })
      }]
    });

    // Check consumer connection
    const consumerHealth = await consumer.describeGroup();

    // Check broker connectivity
    const connected = producer.connected && consumer.connected;

    if (!connected || !producerHealth || !consumerHealth) {
      logger.error('Kafka health check failed', {
        producer: producer.connected,
        consumer: consumer.connected,
        producerHealth,
        consumerHealth
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error during Kafka health check', error);
    return false;
  }
};

// Main initialization function
export const initializeKafka = async (): Promise<{
  producer: Producer;
  consumer: Consumer;
}> => {
  try {
    const kafka = createKafkaClient();
    const producer = await createProducer(kafka);
    const consumer = await createConsumer(kafka);

    // Configure producer for optimal performance
    await producer.send({
      topic: KAFKA_TOPICS.LEAD_CREATED,
      compression: CompressionTypes.Snappy,
      messages: []
    });

    // Subscribe consumer to relevant topics
    await consumer.subscribe({
      topics: Object.values(KAFKA_TOPICS),
      fromBeginning: false
    });

    return { producer, consumer };
  } catch (error) {
    logger.error('Failed to initialize Kafka', error);
    throw error;
  }
};

export default {
  initializeKafka,
  KAFKA_TOPICS,
  createHealthCheck
};