import { Router } from 'express';
import { matchController } from '../controllers/matchController';
import { requireAuth, optionalAuth } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/matches:
 *   get:
 *     summary: 매치 목록 조회 (필터링/검색)
 *     tags: [Matches]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 검색어
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: 지역 필터
 *       - in: query
 *         name: game_type
 *         schema:
 *           type: string
 *           enum: [singles, mens_doubles, womens_doubles, mixed_doubles]
 *         description: 게임 유형
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 매치 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Match'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 */
router.get('/', optionalAuth, matchController.getMatches);

/**
 * @swagger
 * /api/matches:
 *   post:
 *     summary: 매치 생성
 *     tags: [Matches]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMatchRequest'
 *     responses:
 *       201:
 *         description: 매치 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     message:
 *                       type: string
 *                       example: 매치가 생성되었습니다
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', requireAuth, matchController.createMatch);

/**
 * @swagger
 * /api/matches/{matchId}:
 *   get:
 *     summary: 매치 상세 정보 조회
 *     tags: [Matches]
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     responses:
 *       200:
 *         description: 매치 상세 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Match'
 *       404:
 *         description: 매치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:matchId', optionalAuth, matchController.getMatchDetail);

/**
 * @swagger
 * /api/matches/{matchId}/join:
 *   post:
 *     summary: 매치 참가 신청
 *     tags: [Matches]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/JoinMatchRequest'
 *     responses:
 *       201:
 *         description: 매치 참가 신청 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: 잘못된 요청 (이미 참가, 정원 초과 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 매치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:matchId/join', requireAuth, matchController.joinMatch);

/**
 * @swagger
 * /api/matches/{matchId}/share:
 *   post:
 *     summary: 매치 공유
 *     tags: [Matches]
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     responses:
 *       200:
 *         description: 매치 공유 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     shareUrl:
 *                       type: string
 *                       format: uri
 *                       example: 'https://wehand.tennis/matches/550e8400-e29b-41d4-a716-446655440201'
 *                       description: '공유 URL'
 *                     message:
 *                       type: string
 *                       example: '매치 공유 링크가 생성되었습니다'
 *       404:
 *         description: 매치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:matchId/share', matchController.shareMatch);

/**
 * @swagger
 * /api/matches/{matchId}/bookmark:
 *   post:
 *     summary: 매치 북마크 추가
 *     tags: [Matches]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     responses:
 *       200:
 *         description: 매치 북마크 추가 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: 이미 북마크된 매치
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 매치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: 매치 북마크 삭제
 *     tags: [Matches]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     responses:
 *       200:
 *         description: 매치 북마크 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 매치 또는 북마크를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:matchId/bookmark', requireAuth, matchController.bookmarkMatch);
router.delete('/:matchId/bookmark', requireAuth, matchController.unbookmarkMatch);

/**
 * @swagger
 * /api/matches/{matchId}/chat:
 *   post:
 *     summary: 매치 단체 채팅방 생성/참가
 *     tags: [Matches]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     responses:
 *       201:
 *         description: 채팅방 생성/참가 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     chatRoomId:
 *                       type: string
 *                       format: uuid
 *                       description: '채팅방 ID'
 *                     message:
 *                       type: string
 *                       example: '매치 채팅방에 참가했습니다'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 매치 참가자가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 매치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:matchId/chat', requireAuth, matchController.createMatchChat);

export default router;