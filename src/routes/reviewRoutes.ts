import { Router } from "express";
import { reviewController } from "../controllers/reviewController";
import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /api/reviews/reviewable:
 *   get:
 *     summary: 리뷰 가능한 매치 목록 조회
 *     description: 사용자가 참가했던 완료된 매치 중 아직 리뷰하지 않은 참가자가 있는 매치 목록을 조회합니다.
 *     tags:
 *       - Review
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 리뷰 가능한 매치 목록 조회 성공
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
 *                     $ref: '#/components/schemas/ReviewableMatch'
 *             example:
 *               success: true
 *               data:
 *                 - id: "123e4567-e89b-12d3-a456-426614174000"
 *                   title: "즐거운 주말 단식"
 *                   matchDate: "2024-01-15"
 *                   location: "강남테니스장"
 *                   address: "서울시 강남구 테헤란로 123"
 *                   gameType: "단식"
 *                   participants:
 *                     - id: "123e4567-e89b-12d3-a456-426614174001"
 *                       name: "김테니스"
 *                       nickname: "TennisKing"
 *                       ntrp: 4.0
 *                       hasReviewed: false
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "AUTHENTICATION_REQUIRED"
 *                 message: "인증이 필요합니다"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// 리뷰 가능한 매치 목록 조회
router.get("/reviewable", requireAuth, reviewController.getReviewableMatches);

/**
 * @swagger
 * /api/reviews/matches/{matchId}:
 *   post:
 *     summary: 리뷰 제출
 *     description: 특정 매치의 참가자에 대한 리뷰를 제출합니다.
 *     tags:
 *       - Review
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         description: 매치 ID
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitReviewRequest'
 *           example:
 *             revieweeId: "123e4567-e89b-12d3-a456-426614174001"
 *             ntrp: 4.0
 *             isPositive: true
 *             comment: "매너가 좋으시고 실력도 뛰어나셔서 즐거운 경기였습니다."
 *     responses:
 *       200:
 *         description: 리뷰 제출 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   nullable: true
 *                   example: null
 *                 message:
 *                   type: string
 *                   example: "리뷰가 제출되었습니다"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               not_completed:
 *                 summary: 매치가 아직 종료되지 않음
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "MATCH_NOT_COMPLETED"
 *                     message: "아직 종료되지 않은 매치입니다"
 *               cannot_review_self:
 *                 summary: 자기 자신 리뷰 시도
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "CANNOT_REVIEW_SELF"
 *                     message: "자기 자신을 리뷰할 수 없습니다"
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "NOT_PARTICIPANT"
 *                 message: "매치 참가자만 리뷰할 수 있습니다"
 *       404:
 *         description: 매치 또는 리뷰 대상자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               match_not_found:
 *                 summary: 매치를 찾을 수 없음
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "MATCH_NOT_FOUND"
 *                     message: "매치를 찾을 수 없습니다"
 *               reviewee_not_participant:
 *                 summary: 리뷰 대상자가 매치 참가자가 아님
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "REVIEWEE_NOT_PARTICIPANT"
 *                     message: "리뷰 대상이 매치 참가자가 아닙니다"
 *       409:
 *         description: 이미 리뷰 작성함
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "ALREADY_REVIEWED"
 *                 message: "이미 리뷰를 작성했습니다"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// 리뷰 제출
router.post("/matches/:matchId", requireAuth, reviewController.submitReview);

/**
 * @swagger
 * /api/reviews/users/{userId}:
 *   get:
 *     summary: 사용자가 받은 리뷰 조회
 *     description: 특정 사용자가 받은 모든 리뷰를 최신순으로 조회합니다.
 *     tags:
 *       - Review
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: 사용자 ID
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174001"
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
 *             example:
 *               success: true
 *               data:
 *                 - id: "123e4567-e89b-12d3-a456-426614174002"
 *                   rating: 5
 *                   comment: "매너가 좋으시고 실력도 뛰어나셔서 즐거운 경기였습니다."
 *                   createdAt: "2024-01-15T10:30:00Z"
 *                   match:
 *                     id: "123e4567-e89b-12d3-a456-426614174000"
 *                     title: "즐거운 주말 단식"
 *                     date: "2024-01-15"
 *                   reviewer:
 *                     id: "123e4567-e89b-12d3-a456-426614174003"
 *                     name: "TennisPlayer"
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// 사용자가 받은 리뷰 조회
router.get("/users/:userId", requireAuth, reviewController.getUserReviews);

export default router;
