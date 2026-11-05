import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../common/utils/logger.js';

const MONGOOSE_OPTIONS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 50,
  minPoolSize: 10,
  autoIndex: config.NODE_ENV !== 'production', // Build indexes in dev/test, manage via scripts in prod
};

export async function connectDatabase(uri: string = config.MONGODB_URI): Promise<typeof mongoose> {
  mongoose.connection.on('connected', () => {
    logger.info(
      { host: mongoose.connection.host, name: mongoose.connection.name },
      'MongoDB connected successfully',
    );
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error encountered');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  try {
    const connection = await mongoose.connect(uri, MONGOOSE_OPTIONS);
    return connection;
  } catch (error) {
    logger.fatal({ error }, 'Failed to establish initial MongoDB connection');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected gracefully');
  }
}

export async function checkDatabaseHealth(): Promise<{
  isHealthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return { isHealthy: false, error: 'Database is not connected (readyState !== 1)' };
  }

  const start = Date.now();
  try {
    await mongoose.connection.db.admin().ping();
    const latencyMs = Date.now() - start;
    return { isHealthy: true, latencyMs };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Ping command failed';
    return { isHealthy: false, error: errorMsg };
  }
}
