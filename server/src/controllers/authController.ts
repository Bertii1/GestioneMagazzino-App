import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

const signToken = (id: string): string =>
  jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json({ message: 'Email già registrata' });
      return;
    }

    const user = await User.create({ name, email, password, role });
    const token = signToken(user.id as string);

    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ message: 'Credenziali non valide' });
      return;
    }

    const token = signToken(user.id as string);
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
};

export const qrLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ message: 'Token QR mancante' });
      return;
    }
    const user = await User.findOne({ loginToken: token });
    if (!user) {
      res.status(401).json({ message: 'QR code non valido o scaduto' });
      return;
    }
    const jwtToken = signToken(user.id as string);
    res.json({ token: jwtToken, user });
  } catch (err) {
    next(err);
  }
};

export const getQrToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id).select('+loginToken');
    res.json({ loginToken: user!.loginToken });
  } catch (err) {
    next(err);
  }
};

export const regenerateQrToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const newToken = crypto.randomBytes(32).toString('hex');
    await User.findByIdAndUpdate(req.user!._id, { loginToken: newToken });
    res.json({ loginToken: newToken });
  } catch (err) {
    next(err);
  }
};
