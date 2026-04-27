import path from 'path';
import fs from 'fs';
import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import Product from '../models/Product';
import ProductCatalog from '../models/ProductCatalog';
import { AuthRequest } from '../middleware/auth';

const isInternalBarcode = (code: string): boolean => code.startsWith('INT-');

const upsertCatalogEntry = async (body: Record<string, unknown>): Promise<void> => {
  const barcode = typeof body.barcode === 'string' ? body.barcode.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!barcode || !name || isInternalBarcode(barcode)) return;

  const update: Record<string, unknown> = { barcode, name };
  if (typeof body.description === 'string' && body.description.trim()) update.description = body.description.trim();
  if (typeof body.color === 'string' && body.color.trim()) update.color = body.color.trim();
  if (typeof body.brand === 'string' && body.brand.trim()) update.brand = body.brand.trim();
  if (typeof body.category === 'string' && body.category.trim()) update.category = body.category.trim();

  await ProductCatalog.findOneAndUpdate(
    { barcode },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const getBrands = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brands = await Product.distinct('brand', { brand: { $nin: [null, ''] } });
    res.json(brands.sort((a: string, b: string) => a.localeCompare(b)));
  } catch (err) {
    next(err);
  }
};

export const getCategories = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await Product.distinct('category', { category: { $nin: [null, ''] } });
    res.json(categories.sort((a: string, b: string) => a.localeCompare(b)));
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
    if (q) {
      const qStr = (q as string).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = { $regex: qStr, $options: 'i' };
      filter.$or = [{ name: regex }, { brand: regex }, { description: regex }, { category: regex }];
    }

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

export const getCatalogByBarcode = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const entry = await ProductCatalog.findOne({ barcode: req.params.barcode });
    if (!entry) {
      res.status(404).json({ message: 'Barcode non trovato nel catalogo interno' });
      return;
    }
    res.json(entry);
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
    await upsertCatalogEntry(req.body);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, color, brand, category, condition, photos, details, warehouseId, shelfId, level, slot, quantity } = req.body;
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (color !== undefined) update.color = color;
    if (brand !== undefined) update.brand = brand;
    if (category !== undefined) update.category = category;
    if (condition !== undefined) update.condition = condition;
    if (photos !== undefined) update.photos = photos;
    if (details !== undefined) update.details = details;
    if (warehouseId !== undefined) update.warehouseId = warehouseId;
    if (shelfId !== undefined) update.shelfId = shelfId;
    if (level !== undefined) update.level = level;
    if (slot !== undefined) update.slot = slot;
    if (quantity !== undefined) update.quantity = quantity;
    const product = await Product.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      res.status(404).json({ message: 'Prodotto non trovato' });
      return;
    }
    await upsertCatalogEntry({
      barcode: product.barcode,
      name: product.name,
      description: product.description,
      color: product.color,
      brand: product.brand,
      category: product.category,
    });
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
