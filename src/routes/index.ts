import { Router } from 'express';
import { ResponseHelper } from '../utils/response';

// 라우터 임포트
import authRoutes from './auth';
import homeRoutes from './home';
import matchRoutes from './matches';
import regionRoutes from './regions';
import venueRoutes from './venues';
import communityRoutes from './community';
import profileRoutes from './profile';
import notificationRoutes from './notifications';
import chatRoutes from './chat';

const router = Router();

// 헬스 체크 엔드포인트
router.get('/health', (req, res) => {
  ResponseHelper.success(res, {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  }, 'WeHand Tennis Server is healthy');
});

// API 버전 정보
router.get('/version', (req, res) => {
  ResponseHelper.success(res, {
    version: '1.0.0',
    api_version: 'v1',
    build_date: '2024-01-07',
    features: [
      'Authentication (Supabase)',
      'Match Management',
      'Community Posts',
      'Real-time Chat',
      'Push Notifications',
      'Location-based Search'
    ]
  }, 'WeHand Tennis API Version Information');
});

// API 라우터 등록
router.use('/auth', authRoutes);
router.use('/home', homeRoutes);
router.use('/matches', matchRoutes);
router.use('/regions', regionRoutes);
router.use('/venues', venueRoutes);
router.use('/community', communityRoutes);
router.use('/profile', profileRoutes);
router.use('/notifications', notificationRoutes);
router.use('/chat', chatRoutes);

export default router;