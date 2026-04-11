import path from 'path';
import fs from 'fs';
import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import Product from '../models/Product';
import { AuthRequest } from '../middleware/auth';

export const getBrands = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brands = await Product.distinct('brand', { brand: { $nin: [null, ''] } });
    res.json(brands.sort((a: string, b: string) => a.localeCompare(b)));
  } catch (err) {
    next(err);
  }
};

export const getProducts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { warehouseId, shelfId, q } = req.query;
    const filter: Record<string, unknown> = {};

    if (warehouseId) filter.warehouseId = warehouseId;
    if (shelfId) filter.shelfId = shelfId;
    if (q) filter.$text = { $search: q as string };

    const products = await Product.find(filter)
      .populate('shelfId', 'code name x y')
      .populate('warehouseId', 'name')
      .sort({ name: 1 });

    res.json(products);
  } catch (err) {
    next(err);
  }
};

export const getProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('shelfId', 'code name x y levels')
      .populate('warehouseId', 'name gridWidth gridHeight');

    if (!product) {
      res.status(404).json({ message: 'Prodotto non trovato' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const getProductByBarcode = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode })
      .populate('shelfId', 'code name x y levels')
      .populate('warehouseId', 'name gridWidth gridHeight');

    if (!product) {
      res.status(404).json({ message: 'Prodotto non trovato' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      res.status(404).json({ message: 'Prodotto non trovato' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      res.status(404).json({ message: 'Prodotto non trovato' });
      return;
    }

    // Rimuovi foto da disco
    const uploadsDir = path.join(process.cwd(), 'uploads', 'products');
    for (const filename of product.photos) {
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.json({ message: 'Prodotto eliminato' });
  } catch (err) {
    next(err);
  }
};
