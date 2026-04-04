import { Request, Response, NextFunction } from 'express';
import { isProd } from '../config/env';
import { logger } from '../config/logger';

export interface AppError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = err.statusCode || 500;
  const message = err.message || 'Errore interno del server';

  logger.error({ err, statusCode: status }, err.message);

  res.status(status).json({
    message: isProd && status === 500 ? 'Errore interno del server' : message,
  });
};
