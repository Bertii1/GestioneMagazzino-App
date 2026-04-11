import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import multer from 'multer';
import Product from '../models/Product';
import { AuthRequest } from '../middleware/auth';

const MAX_PHOTOS = 5;
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'products');

// Assicura che la directory esista all'avvio
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const id = crypto.randomBytes(12).toString('hex');
    cb(null, `${req.params.id}-${id}${ext}`);
  },
});

const fileFilter = (_req: AuthRequest, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo immagini sono consentite'));
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('photo');

export const addPhoto = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      // Rimuovi il file appena caricato
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(404).json({ message: 'Prodotto non trovato' });
      return;
    }

    if (product.photos.length >= MAX_PHOTOS) {
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(400).json({ message: `Massimo ${MAX_PHOTOS} foto per prodotto` });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'File immagine mancante' });
      return;
    }

    const filename = req.file.filename;
    product.photos.push(filename);
    await product.save();

    res.status(201).json({ filename, photos: product.photos });
  } catch (err) {
    next(err);
  }
};

export const deletePhoto = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id, filename } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ message: 'Prodotto non trovato' });
      return;
    }

    const idx = product.photos.indexOf(filename);
    if (idx === -1) {
      res.status(404).json({ message: 'Foto non trovata' });
      return;
    }

    product.photos.splice(idx, 1);
    await product.save();

    // Rimuovi il file da disco
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ photos: product.photos });
  } catch (err) {
    next(err);
  }
};
