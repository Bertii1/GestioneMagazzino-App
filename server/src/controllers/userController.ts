import { Response, NextFunction } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { logActivity, getIp } from '../utils/activityLogger';

export const listUsers = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (id === String(req.user!._id)) {
      res.status(400).json({ message: 'Non puoi eliminare il tuo stesso account' });
      return;
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      res.status(404).json({ message: 'Utente non trovato' });
      return;
    }

    await logActivity(req.user!, getIp(req), 'delete_user', { entity: 'user', entityId: String(user._id), entityName: user.name });
    res.json({ message: 'Utente eliminato' });
  } catch (err) {
    next(err);
  }
};

export const resetUserPassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ message: 'La password deve avere almeno 6 caratteri' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'Utente non trovato' });
      return;
    }

    user.password = newPassword;
    user.mustChangePassword = true;
    await user.save();

    await logActivity(req.user!, getIp(req), 'reset_password', { entity: 'user', entityId: String(user._id), entityName: user.name });
    res.json({ message: 'Password reimpostata — l\'utente dovrà cambiarla al prossimo accesso' });
  } catch (err) {
    next(err);
  }
};
