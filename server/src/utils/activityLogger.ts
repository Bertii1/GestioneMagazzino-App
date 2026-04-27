import { Request } from 'express';
import ActivityLog from '../models/ActivityLog';
import { IUser } from '../models/User';

export function getIp(req: Request): string {
  return String(req.ip ?? '').replace('::ffff:', '') || 'unknown';
}

export async function logActivity(
  user: Pick<IUser, '_id' | 'name' | 'email'>,
  ip: string,
  action: string,
  opts?: { entity?: string; entityId?: string; entityName?: string; details?: Record<string, unknown> }
): Promise<void> {
  try {
    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      action,
      ip,
      ...opts,
    });
  } catch {
    // Non bloccare l'operazione principale se il logging fallisce
  }
}
