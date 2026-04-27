import 'dotenv/config';
import path from 'path';
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
import visionRoutes from './routes/vision';
import userRoutes from './routes/users';
import backupRoutes from './routes/backup';
import versionRoutes from './routes/version';
import activityRoutes from './routes/activity';
import { errorHandler } from './middleware/errorHandler';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import metricsRoutes from './routes/metrics';

const app = express();

// Trust proxy (necessario dietro Caddy/Nginx per rate-limit e IP reali)
if (isProd) app.set('trust proxy', 1);

// Sicurezza HTTP headers
app.use(helmet());

// CORS — in produzione solo origini esplicite
if (isProd && env.CORS_ORIGIN === '*') {
  logger.warn('CORS_ORIGIN=* in produzione: tutte le origini sono consentite');
}
app.use(cors({
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map(o => o.trim()),
  credentials: true,
}));

// Rate limiting globale
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: isProd ? 500 : 1000,
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
app.use(metricsMiddleware);

// File statici — foto prodotti (cache 7 giorni)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
}));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/shelves', shelfRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/version', versionRoutes);
app.use('/api/activity', activityRoutes);

// Metrics — solo rete interna Docker, bloccato da Caddy esternamente
app.use('/metrics', metricsRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'gestione-magazzino',
    minAppVersion: env.MIN_APP_VERSION,
    timestamp: new Date().toISOString(),
  });
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
