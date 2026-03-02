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
    const shelf = await Shelf.findByIdAndUpdate(req.params.id, req.body, {
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
