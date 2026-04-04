import { Router } from 'express';
import { protect, requireAdmin } from '../middleware/auth';
import { listUsers, deleteUser, resetUserPassword } from '../controllers/userController';

const router = Router();

// Tutte le route richiedono autenticazione admin
router.use(protect, requireAdmin);

router.get('/', listUsers);
router.delete('/:id', deleteUser);
router.post('/:id/reset-password', resetUserPassword);

export default router;
