import { Request, Response } from 'express';
import AppVersion from '../models/AppVersion';
import { env } from '../config/env';

export const getVersion = async (req: Request, res: Response): Promise<void> => {
  const platform = (req.query.platform as string) || 'android';
  const doc = await AppVersion.findOne({ platform });
  if (!doc) {
    res.json({ version: '1.0.0', minVersion: env.MIN_APP_VERSION, downloadUrl: null });
    return;
  }
  res.json({
    version: doc.version,
    buildNumber: doc.buildNumber,
    minVersion: doc.minVersion,
    downloadUrl: doc.downloadUrl,
  });
};

export const updateVersion = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  if (!env.BACKUP_API_KEY || !token || token !== env.BACKUP_API_KEY) {
    res.status(401).json({ message: 'Non autorizzato' });
    return;
  }

  const { platform = 'android', version, buildNumber, downloadUrl, minVersion } = req.body;

  if (!version || !downloadUrl) {
    res.status(400).json({ message: 'version e downloadUrl obbligatori' });
    return;
  }

  const doc = await AppVersion.findOneAndUpdate(
    { platform },
    { version, buildNumber: buildNumber ?? 1, downloadUrl, minVersion: minVersion || version },
    { upsert: true, new: true }
  );

  res.json({ success: true, data: doc });
};
