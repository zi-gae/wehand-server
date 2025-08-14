import { Router } from 'express';
import { profileController } from '../controllers/profileController';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/profile/me:
 *   get:
 *     summary: 내 프로필 조회
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 내 프로필 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', requireAuth, profileController.getMyProfile);

/**
 * @swagger
 * /api/profile/me:
 *   put:
 *     summary: 내 프로필 수정
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: 프로필 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: 입력값 오류 (닉네임 중복 등)
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
 */
router.put('/me', requireAuth, profileController.updateProfile);

/**
 * @swagger
 * /api/profile/users/{userId}:
 *   get:
 *     summary: 다른 사용자 프로필 조회
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 사용자 ID
 *     responses:
 *       200:
 *         description: 사용자 프로필 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       404:
 *         description: 사용자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/users/:userId', profileController.getUserProfile);

/**
 * @swagger
 * /api/profile/my-matches:
 *   get:
 *     summary: 내 매치 기록 조회
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, confirmed, cancelled]
 *           default: all
 *         description: 매치 상태 필터
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, upcoming, past]
 *           default: all
 *         description: 매치 시점 필터
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
 *           maximum: 50
 *           default: 10
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 내 매치 기록 조회 성공
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
 *                     $ref: '#/components/schemas/MatchParticipation'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/my-matches', requireAuth, profileController.getMyMatches);

/**
 * @swagger
 * /api/profile/my-reviews:
 *   get:
 *     summary: 내가 받은 리뷰 조회
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *           maximum: 50
 *           default: 10
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 내 리뷰 조회 성공
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
 *                     $ref: '#/components/schemas/Review'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/my-reviews', requireAuth, profileController.getMyReviews);

/**
 * @swagger
 * /api/profile/users/{userId}/reviews:
 *   get:
 *     summary: 특정 사용자가 받은 리뷰 조회
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 사용자 ID
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
 *           maximum: 50
 *           default: 10
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 사용자 리뷰 조회 성공
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
 *                     $ref: '#/components/schemas/Review'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       404:
 *         description: 사용자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/users/:userId/reviews', profileController.getUserReviews);


/**
 * @swagger
 * /api/profile/bookmarks:
 *   get:
 *     summary: 북마크한 매치 조회
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *           maximum: 50
 *           default: 10
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 북마크 조회 성공
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
 *                     $ref: '#/components/schemas/MatchBookmark'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/bookmarks', requireAuth, profileController.getBookmarkedMatches);

export default router;