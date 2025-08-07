import { Router } from 'express';
import { locationController } from '../controllers/locationController';

const router = Router();

// 2.2 지역 데이터 조회
router.get('/', locationController.getRegions);

export default router;