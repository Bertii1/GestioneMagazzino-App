import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export const connectDB = async (): Promise<void> => {
  await mongoose.connect(env.MONGODB_URI);
  logger.info({ host: mongoose.connection.host }, 'MongoDB connesso');
};
