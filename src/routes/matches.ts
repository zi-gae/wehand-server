import { Router } from 'express';
import { matchController } from '../controllers/matchController';
import { requireAuth, optionalAuth } from '../middleware/auth';

const router = Router();

// 2.1 매치 목록 조회 (필터링/검색) - 인증 선택적
router.get('/', optionalAuth, matchController.getMatches);

// 4.1 매치 생성 (인증 필요)
router.post('/', requireAuth, matchController.createMatch);

// 3.1 매치 상세 정보 조회 - 인증 선택적
router.get('/:matchId', optionalAuth, matchController.getMatchDetail);

// 1.2 매치 참가 신청 (인증 필요)
router.post('/:matchId/join', requireAuth, matchController.joinMatch);

// 3.2 매치 공유
router.post('/:matchId/share', matchController.shareMatch);

// 3.3 매치 북마크 (인증 필요)
router.post('/:matchId/bookmark', requireAuth, matchController.bookmarkMatch);
router.delete('/:matchId/bookmark', requireAuth, matchController.unbookmarkMatch);

// 3.4 매치 단체 채팅방 생성 (인증 필요)
router.post('/:matchId/chat', requireAuth, matchController.createMatchChat);

export default router;