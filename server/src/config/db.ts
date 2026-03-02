import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI non definita nel file .env');

  await mongoose.connect(uri);
  console.log('MongoDB connesso:', mongoose.connection.host);
};
