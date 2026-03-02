import { Router } from 'express';
import { getShelf, updateShelf, deleteShelf } from '../controllers/shelfController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/:id', getShelf);
router.put('/:id', updateShelf);
router.delete('/:id', deleteShelf);

export default router;
