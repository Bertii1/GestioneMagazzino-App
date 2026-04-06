import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env, isProd } from './config/env';
import { logger } from './config/logger';
import { connectDB } from './config/db';
import { seedAdmin } from './config/seed';
import authRoutes from './routes/auth';
import warehouseRoutes from './routes/warehouses';
import shelfRoutes from './routes/shelves';
import productRoutes from './routes/products';
import transcribeRoutes from './routes/transcribe';
import visionRoutes from './routes/vision';
import userRoutes from './routes/users';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Trust proxy (necessario dietro Caddy/Nginx per rate-limit e IP reali)
if (isProd) app.set('trust proxy', 1);

// Sicurezza HTTP headers
app.use(helmet());

// CORS — in produzione solo origini esplicite
app.use(cors({
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map(o => o.trim()),
  credentials: true,
}));

// Rate limiting globale
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: isProd ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Troppe richieste, riprova tra qualche minuto.' },
}));

// Rate limiting stretto su auth (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 15 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Troppi tentativi di accesso, riprova tra 15 minuti.' },
});

app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/shelves', shelfRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transcribe', transcribeRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'gestione-magazzino', timestamp: new Date().toISOString() });
});

// Error handler (deve essere l'ultimo middleware)
app.use(errorHandler);

// Avvio server
const start = async () => {
  await connectDB();
  await seedAdmin();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server avviato');
  });
};

start().catch((err) => {
  logger.fatal({ err }, 'Errore avvio server');
  process.exit(1);
});

export default app;
