import crypto from 'crypto';
import { Request, Response } from 'express';
import AppVersion from '../models/AppVersion';
import { env } from '../config/env';

const ALLOWED_PLATFORMS = new Set(['android', 'ios']);
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const ALLOWED_DOWNLOAD_HOSTS = new Set(['expo.dev', 'objects.githubusercontent.com', 'github.com']);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function isAllowedDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname;
    return [...ALLOWED_DOWNLOAD_HOSTS].some(allowed => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export const getVersion = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawPlatform = req.query.platform;
    const platform = typeof rawPlatform === 'string' && ALLOWED_PLATFORMS.has(rawPlatform)
      ? rawPlatform
      : 'android';

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
  } catch {
    res.status(500).json({ message: 'Errore interno' });
  }
};

export const updateVersion = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;

    if (!env.BACKUP_API_KEY || !token || !timingSafeEqual(token, env.BACKUP_API_KEY)) {
      res.status(401).json({ message: 'Non autorizzato' });
      return;
    }

    const { platform, version, buildNumber, downloadUrl, minVersion } = req.body;

    const resolvedPlatform = typeof platform === 'string' && ALLOWED_PLATFORMS.has(platform)
      ? platform
      : 'android';

    if (typeof version !== 'string' || !SEMVER_RE.test(version)) {
      res.status(400).json({ message: 'version non valida (es. 1.2.3)' });
      return;
    }

    if (typeof downloadUrl !== 'string' || !isAllowedDownloadUrl(downloadUrl)) {
      res.status(400).json({ message: 'downloadUrl non valido o dominio non autorizzato' });
      return;
    }

    const resolvedMinVersion = typeof minVersion === 'string' && SEMVER_RE.test(minVersion)
      ? minVersion
      : version;

    const resolvedBuildNumber = typeof buildNumber === 'number' && Number.isFinite(buildNumber)
      ? Math.floor(buildNumber)
      : 1;

    const doc = await AppVersion.findOneAndUpdate(
      { platform: resolvedPlatform },
      { version, buildNumber: resolvedBuildNumber, downloadUrl, minVersion: resolvedMinVersion },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: doc });
  } catch {
    res.status(500).json({ message: 'Errore interno' });
  }
};
