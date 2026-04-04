import { Router } from 'express';
import { protect } from '../middleware/auth';
import { upload, transcribeAudio } from '../controllers/transcribeController';

const router = Router();

router.post('/', protect, upload.single('audio'), transcribeAudio);

export default router;
