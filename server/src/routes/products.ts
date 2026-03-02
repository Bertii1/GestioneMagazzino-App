import { Router } from 'express';
import { body } from 'express-validator';
import {
  getProducts,
  getProduct,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

// Ricerca per barcode (prima della route /:id per evitare conflitti)
router.get('/barcode/:barcode', getProductByBarcode);

router.get('/', getProducts);
router.get('/:id', getProduct);

router.post(
  '/',
  [
    body('barcode').trim().notEmpty().withMessage('Barcode obbligatorio'),
    body('name').trim().notEmpty().withMessage('Nome prodotto obbligatorio'),
    body('warehouseId').notEmpty().withMessage('warehouseId obbligatorio'),
    body('shelfId').notEmpty().withMessage('shelfId obbligatorio'),
    body('level').isInt({ min: 1 }).withMessage('level deve essere >= 1'),
    body('quantity').isInt({ min: 0 }).withMessage('quantity deve essere >= 0'),
  ],
  createProduct
);

router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
