import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { env } from '../config/env';
import { logActivity, getIp } from '../utils/activityLogger';

const signToken = (id: string, tokenVersion: number): string =>
  jwt.sign({ id, tokenVersion }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

/**
 * Registrazione utente — solo admin può creare nuovi utenti.
 * Il middleware protect + requireAdmin sono applicati nella route.
 */
export const register = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'operator',
      mustChangePassword: true,
    });

    if (req.user) {
      await logActivity(req.user, getIp(req), 'create_user', { entity: 'user', entityId: String(user._id), entityName: user.name });
    }
    res.status(201).json({ user });
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

    const token = signToken(user.id as string, user.tokenVersion);
    await logActivity(user, getIp(req), 'login');
    res.json({
      token,
      user,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user!._id).select('+password');

    if (!user) {
      res.status(404).json({ message: 'Utente non trovato' });
      return;
    }

    if (!await user.comparePassword(currentPassword)) {
      res.status(400).json({ message: 'Password attuale non corretta' });
      return;
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    await logActivity(user, getIp(req), 'change_password');
    const newToken = signToken(user.id as string, user.tokenVersion);
    res.json({ message: 'Password aggiornata con successo', token: newToken });
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
    const user = await User.findOne({ loginToken: token }).select('+loginToken');
    if (!user) {
      res.status(401).json({ message: 'QR code non valido o scaduto' });
      return;
    }
    const jwtToken = signToken(user.id as string, user.tokenVersion);
    await logActivity(user, getIp(req), 'qr_login');
    res.json({
      token: jwtToken,
      user,
      mustChangePassword: user.mustChangePassword,
    });
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

export const logout = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await logActivity(req.user!, getIp(req), 'logout');
    await User.findByIdAndUpdate(req.user!._id, { $inc: { tokenVersion: 1 } });
    res.json({ message: 'Logout effettuato con successo' });
  } catch (err) {
    next(err);
  }
};
