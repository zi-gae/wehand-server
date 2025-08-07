import { Router } from 'express';
import { authController } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { authRateLimit } from '../middleware/security';

const router = Router();

// 인증 관련 엔드포인트에 레이트 리미팅 적용
router.use(authRateLimit);

// 11.1 이메일 로그인
router.post('/login', authController.login);

// 11.2 토큰 갱신
router.post('/refresh', authController.refresh);

// 11.3 카카오 로그인
router.post('/kakao', authController.kakaoLogin);

// 11.4 로그아웃 (인증 필요)
router.post('/logout', requireAuth, authController.logout);

// 회원가입
router.post('/signup', authController.signup);

// 현재 사용자 정보 조회 (인증 필요)
router.get('/me', requireAuth, authController.me);

export default router;