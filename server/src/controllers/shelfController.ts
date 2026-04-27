import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import Shelf from '../models/Shelf';
import { AuthRequest } from '../middleware/auth';

export const getShelvesByWarehouse = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shelves = await Shelf.find({ warehouseId: req.params.warehouseId }).sort({ code: 1 });
    res.json(shelves);
  } catch (err) {
    next(err);
  }
};

export const getShelf = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shelf = await Shelf.findById(req.params.id).populate('warehouseId', 'name');
    if (!shelf) {
      res.status(404).json({ message: 'Scaffale non trovato' });
      return;
    }
    res.json(shelf);
  } catch (err) {
    next(err);
  }
};

export const createShelf = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const shelf = await Shelf.create({
      ...req.body,
      warehouseId: req.params.warehouseId,
    });
    res.status(201).json(shelf);
  } catch (err) {
    next(err);
  }
};

export const updateShelf = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, name, x, y, levels, capacity } = req.body;
    const update: Record<string, unknown> = {};
    if (code !== undefined) update.code = code;
    if (name !== undefined) update.name = name;
    if (x !== undefined) update.x = x;
    if (y !== undefined) update.y = y;
    if (levels !== undefined) update.levels = levels;
    if (capacity !== undefined) update.capacity = capacity;
    const shelf = await Shelf.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!shelf) {
      res.status(404).json({ message: 'Scaffale non trovato' });
      return;
    }
    res.json(shelf);
  } catch (err) {
    next(err);
  }
};

export const deleteShelf = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shelf = await Shelf.findByIdAndDelete(req.params.id);
    if (!shelf) {
      res.status(404).json({ message: 'Scaffale non trovato' });
      return;
    }
    res.json({ message: 'Scaffale eliminato' });
  } catch (err) {
    next(err);
  }
};
