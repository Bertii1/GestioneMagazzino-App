import { Router } from 'express';
import { protect } from '../middleware/auth';
import { uploadImage, identifyProduct } from '../controllers/visionController';

const router = Router();

router.post('/identify', protect, uploadImage.single('image'), identifyProduct);

export default router;
