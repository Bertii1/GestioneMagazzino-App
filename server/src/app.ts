import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import authRoutes from './routes/auth';
import warehouseRoutes from './routes/warehouses';
import shelfRoutes from './routes/shelves';
import productRoutes from './routes/products';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware globali
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/shelves', shelfRoutes);
app.use('/api/products', productRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'gestione-magazzino', timestamp: new Date().toISOString() });
});

// Error handler (deve essere l'ultimo middleware)
app.use(errorHandler);

// Avvio server
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
};

start().catch((err) => {
  console.error('Errore avvio server:', err);
  process.exit(1);
});

export default app;
