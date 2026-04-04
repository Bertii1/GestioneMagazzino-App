import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe, qrLogin, getQrToken, regenerateQrToken, changePassword } from '../controllers/authController';
import { protect, requireAdmin } from '../middleware/auth';

const router = Router();

// Registrazione — solo admin può creare nuovi utenti
router.post(
  '/register',
  protect,
  requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Nome obbligatorio'),
    body('email').isEmail().withMessage('Email non valida'),
    body('password').isLength({ min: 6 }).withMessage('Password minimo 6 caratteri'),
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email non valida'),
    body('password').notEmpty().withMessage('Password obbligatoria'),
  ],
  login
);

router.post(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Password attuale obbligatoria'),
    body('newPassword').isLength({ min: 6 }).withMessage('Nuova password minimo 6 caratteri'),
  ],
  changePassword
);

router.get('/me', protect, getMe);

router.post('/qr-login', qrLogin);
router.get('/qr-token', protect, getQrToken);
router.post('/qr-token/regenerate', protect, regenerateQrToken);

export default router;
