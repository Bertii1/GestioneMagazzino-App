import { Router } from 'express';
import { body } from 'express-validator';
import {
  getWarehouses,
  getWarehouse,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from '../controllers/warehouseController';
import { getShelvesByWarehouse, createShelf } from '../controllers/shelfController';
import { protect, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/', getWarehouses);
router.get('/:id', getWarehouse);

router.post(
  '/',
  requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Nome magazzino obbligatorio'),
    body('gridWidth').isInt({ min: 1 }).withMessage('gridWidth deve essere >= 1'),
    body('gridHeight').isInt({ min: 1 }).withMessage('gridHeight deve essere >= 1'),
  ],
  createWarehouse
);

router.put('/:id', requireAdmin, updateWarehouse);
router.delete('/:id', requireAdmin, deleteWarehouse);

// Scaffali annidati
router.get('/:warehouseId/shelves', getShelvesByWarehouse);
router.post(
  '/:warehouseId/shelves',
  [
    body('code').trim().notEmpty().withMessage('Codice scaffale obbligatorio'),
    body('x').isInt({ min: 0 }).withMessage('x deve essere >= 0'),
    body('y').isInt({ min: 0 }).withMessage('y deve essere >= 0'),
    body('levels').isInt({ min: 1 }).withMessage('levels deve essere >= 1'),
  ],
  createShelf
);

export default router;
