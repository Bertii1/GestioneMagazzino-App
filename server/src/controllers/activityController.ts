import { Response, NextFunction } from 'express';
import ActivityLog from '../models/ActivityLog';
import { AuthRequest } from '../middleware/auth';

export const getActivityLogs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const filter: Record<string, unknown> = {};

    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.entity) filter.entity = req.query.entity;

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page, limit });
  } catch (err) {
    next(err);
  }
};
