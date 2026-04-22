import { Router } from 'express';
import { getVersion, updateVersion } from '../controllers/versionController';

const router = Router();

router.get('/', getVersion);
router.put('/', updateVersion);

export default router;
