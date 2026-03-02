import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe, qrLogin, getQrToken, regenerateQrToken } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

router.post(
  '/register',
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

router.get('/me', protect, getMe);

router.post('/qr-login', qrLogin);
router.get('/qr-token', protect, getQrToken);
router.post('/qr-token/regenerate', protect, regenerateQrToken);

export default router;
