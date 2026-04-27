import { Router } from 'express';
import { getShelf, updateShelf, deleteShelf } from '../controllers/shelfController';
import { protect, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/:id', getShelf);
router.put('/:id', requireAdmin, updateShelf);
router.delete('/:id', requireAdmin, deleteShelf);

export default router;
