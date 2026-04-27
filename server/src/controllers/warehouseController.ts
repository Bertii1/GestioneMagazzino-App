import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import Warehouse from '../models/Warehouse';
import { AuthRequest } from '../middleware/auth';
import { logActivity, getIp } from '../utils/activityLogger';

export const getWarehouses = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const warehouses = await Warehouse.find().sort({ createdAt: -1 });
    res.json(warehouses);
  } catch (err) {
    next(err);
  }
};

export const getWarehouse = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      res.status(404).json({ message: 'Magazzino non trovato' });
      return;
    }
    res.json(warehouse);
  } catch (err) {
    next(err);
  }
};

export const createWarehouse = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const warehouse = await Warehouse.create(req.body);
    await logActivity(req.user!, getIp(req), 'create_warehouse', { entity: 'warehouse', entityId: String(warehouse._id), entityName: warehouse.name });
    res.status(201).json(warehouse);
  } catch (err) {
    next(err);
  }
};

export const updateWarehouse = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, gridWidth, gridHeight } = req.body;
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (gridWidth !== undefined) update.gridWidth = gridWidth;
    if (gridHeight !== undefined) update.gridHeight = gridHeight;
    const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!warehouse) {
      res.status(404).json({ message: 'Magazzino non trovato' });
      return;
    }
    await logActivity(req.user!, getIp(req), 'update_warehouse', { entity: 'warehouse', entityId: String(warehouse._id), entityName: warehouse.name });
    res.json(warehouse);
  } catch (err) {
    next(err);
  }
};

export const deleteWarehouse = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const warehouse = await Warehouse.findByIdAndDelete(req.params.id);
    if (!warehouse) {
      res.status(404).json({ message: 'Magazzino non trovato' });
      return;
    }
    await logActivity(req.user!, getIp(req), 'delete_warehouse', { entity: 'warehouse', entityId: String(warehouse._id), entityName: warehouse.name });
    res.json({ message: 'Magazzino eliminato' });
  } catch (err) {
    next(err);
  }
};
