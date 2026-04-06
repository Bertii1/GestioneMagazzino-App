import pino, { type LoggerOptions } from 'pino';
import { isProd } from './env';

const opts: LoggerOptions = { level: isProd ? 'info' : 'debug' };

if (!isProd) {
  try {
    require.resolve('pino-pretty');
    opts.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' },
    };
  } catch {
    // pino-pretty non installato (produzione) — usa output JSON
  }
}

export const logger = pino(opts);
