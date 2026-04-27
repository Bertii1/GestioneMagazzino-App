import { Router } from 'express';
import { getActivityLogs } from '../controllers/activityController';
import { protect, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(protect, requireAdmin);
router.get('/', getActivityLogs);

export default router;
