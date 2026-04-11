import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { env } from '../config/env';
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /api/backup/dump
 * Esegue mongodump e streamma l'archivio gzip direttamente nella response.
 * Protetto da bearer token dedicato (BACKUP_API_KEY).
 */
router.get('/dump', (req: Request, res: Response): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!env.BACKUP_API_KEY) {
    res.status(503).json({ message: 'Backup non configurato: BACKUP_API_KEY mancante' });
    return;
  }

  if (!token || token !== env.BACKUP_API_KEY) {
    res.status(401).json({ message: 'Non autorizzato' });
    return;
  }

  const uri = env.MONGODB_URI;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `magazzino_${timestamp}.archive.gz`;

  logger.info('Avvio backup database...');

  const mongodump = spawn('mongodump', [
    `--uri=${uri}`,
    '--db=gestione_magazzino',
    '--archive',
    '--gzip',
  ]);

  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  mongodump.stdout.pipe(res);

  mongodump.stderr.on('data', (data: Buffer) => {
    logger.info({ output: data.toString().trim() }, 'mongodump');
  });

  mongodump.on('error', (err) => {
    logger.error({ err }, 'Errore avvio mongodump');
    if (!res.headersSent) {
      res.status(500).json({ message: 'Errore avvio mongodump' });
    }
  });

  mongodump.on('close', (code) => {
    if (code !== 0) {
      logger.error({ code }, 'mongodump terminato con errore');
      if (!res.headersSent) {
        res.status(500).json({ message: `mongodump exit code ${code}` });
      }
    } else {
      logger.info('Backup completato con successo');
    }
  });
});

export default router;
