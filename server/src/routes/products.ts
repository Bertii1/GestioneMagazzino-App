import { Router } from 'express';
import { body } from 'express-validator';
import {
  getBrands,
  getProducts,
  getProduct,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController';
import { uploadMiddleware, addPhoto, deletePhoto } from '../controllers/productPhotoController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

// Lista marche distinte (prima delle route parametriche)
router.get('/brands', getBrands);

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
    body('condition').optional().isIn(['nuovo', 'usato', 'vuoto']).withMessage('condition deve essere: nuovo, usato o vuoto'),
  ],
  createProduct
);

router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

// Foto prodotto
router.post('/:id/photos', uploadMiddleware, addPhoto);
router.delete('/:id/photos/:filename', deletePhoto);

export default router;
