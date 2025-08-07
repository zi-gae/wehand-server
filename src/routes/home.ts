import { Router } from 'express';
import { homeController } from '../controllers/homeController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// 1.1 홈 화면 데이터 조회 (인증 필요)
router.get('/', requireAuth, homeController.getHomeData);

export default router;