import { Router } from "express";
import { profileController } from "../controllers/profileController";
import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /api/profile/me:
 *   get:
 *     summary: 내 프로필 조회
 *     description: 로그인한 사용자의 상세 프로필 정보, 통계, 리뷰 정보를 조회합니다
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
 *             example:
 *               success: true
 *               data:
 *                 userInfo:
 *                   id: "024ba6dd-ea6f-41be-8411-96624bff34b8"
 *                   email: "user@example.com"
 *                   name: "김테니스"
 *                   nickname: "tennis_king"
 *                   location: "서울시 강남구"
 *                   bio: "테니스를 사랑하는 주말 플레이어입니다"
 *                   profileImageUrl: "https://example.com/profile.jpg"
 *                   gender: "male"
 *                   ntrp: 4.0
 *                   experienceYears: 5
 *                   favoriteStyle: "공격형"
 *                   createdAt: "2024-01-01T00:00:00Z"
 *                   updatedAt: "2024-01-20T12:00:00Z"
 *                 stats:
 *                   totalMatches: 47
 *                   wins: 32
 *                   losses: 15
 *                   winRate: 68
 *                   ranking: null
 *                 reviews:
 *                   totalReviews: 23
 *                   totalRatingSum: 95
 *                   avgNtrp: 4.2
 *                   avgRating: 4.1
 *                   comments:
 *                     - comment: "정말 좋은 매치였습니다!"
 *                       nickname: "tennis_lover"
 *                       createdAt: "2024-01-20T14:30:00Z"
 *                     - comment: "실력도 좋고 매너도 훌륭해요"
 *                       nickname: "match_master"
 *                       createdAt: "2024-01-19T10:15:00Z"
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 사용자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "USER_NOT_FOUND"
 *                 message: "사용자를 찾을 수 없습니다"
 */
router.get("/me", requireAuth, profileController.getMyProfile);

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
router.put("/me", requireAuth, profileController.updateProfile);

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
router.get("/users/:userId", profileController.getUserProfile);

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
router.get("/my-matches", requireAuth, profileController.getMyMatches);

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
router.get("/my-reviews", requireAuth, profileController.getMyReviews);

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
router.get("/users/:userId/reviews", profileController.getUserReviews);

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
router.get("/bookmarks", requireAuth, profileController.getBookmarkedMatches);

export default router;
