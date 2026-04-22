import { Router } from 'express';
import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

collectDefaultMetrics({ prefix: 'magazzino_' });

export const httpRequestsTotal = new Counter({
  name: 'magazzino_http_requests_total',
  help: 'Totale richieste HTTP',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDuration = new Histogram({
  name: 'magazzino_http_request_duration_seconds',
  help: 'Durata richieste HTTP in secondi',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

const router = Router();

router.get('/', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;
