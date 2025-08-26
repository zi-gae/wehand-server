import { Router } from "express";
import { blockController } from "../controllers/blockController";
import { requireAuth } from "../middleware/auth";

const router = Router();

// 모든 차단 관련 라우트는 인증 필요
router.use(requireAuth);

/**
 * @swagger
 * /blocks/users/{userId}:
 *   post:
 *     tags: [Blocks]
 *     summary: 사용자 차단
 *     description: 특정 사용자를 차단합니다
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: 차단할 사용자 ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       description: 차단 요청 정보
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BlockUserRequest'
 *     responses:
 *       200:
 *         description: 차단 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         message:
 *                           type: string
 *                           example: "김테니스님을 차단했습니다"
 *                         blockId:
 *                           type: string
 *                           format: uuid
 *                           description: "생성된 차단 기록 ID"
 *       400:
 *         description: 잘못된 요청 (자기 자신 차단, 사용자 ID 누락 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               self_block:
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "SELF_BLOCK_NOT_ALLOWED"
 *                     message: "자기 자신을 차단할 수 없습니다"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: 사용자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: 이미 차단된 사용자
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "ALREADY_BLOCKED"
 *                 message: "이미 차단된 사용자입니다"
 */
router.post("/users/:userId", blockController.blockUser);

/**
 * @swagger
 * /blocks/users/{userId}:
 *   delete:
 *     tags: [Blocks]
 *     summary: 사용자 차단 해제
 *     description: 특정 사용자에 대한 차단을 해제합니다
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: 차단 해제할 사용자 ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 차단 해제 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         message:
 *                           type: string
 *                           example: "김테니스님의 차단을 해제했습니다"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: 차단 관계를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "BLOCK_NOT_FOUND"
 *                 message: "차단 관계를 찾을 수 없습니다"
 */
router.delete("/users/:userId", blockController.unblockUser);

/**
 * @swagger
 * /blocks/users:
 *   get:
 *     tags: [Blocks]
 *     summary: 차단한 사용자 목록 조회
 *     description: 현재 사용자가 차단한 사용자 목록을 페이지네이션으로 조회합니다
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         description: "페이지 번호 (기본값: 1)"
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         description: "페이지당 항목 수 (기본값: 20)"
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: 차단한 사용자 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/BlockedUsersResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/users", blockController.getBlockedUsers);

/**
 * @swagger
 * /blocks/status/{userId}:
 *   get:
 *     tags: [Blocks]
 *     summary: 특정 사용자와의 차단 상태 확인
 *     description: 현재 사용자와 특정 사용자 간의 차단 상태를 확인합니다
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: 확인할 사용자 ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 차단 상태 확인 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/BlockStatusResponse'
 *       400:
 *         description: 잘못된 요청 (사용자 ID 누락)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/status/:userId", blockController.checkBlockStatus);

/**
 * @swagger
 * /blocks/reasons:
 *   get:
 *     tags: [Blocks]
 *     summary: 차단 사유 목록 조회
 *     description: 사용자 차단 시 사용할 수 있는 사유 목록을 조회합니다
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 차단 사유 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         reasons:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/BlockReason'
 *                           example:
 *                             - code: "spam"
 *                               label: "스팸/광고"
 *                             - code: "harassment"
 *                               label: "괴롭힘/욕설"
 *                             - code: "inappropriate_behavior"
 *                               label: "부적절한 행동"
 *                             - code: "fake_profile"
 *                               label: "가짜 프로필"
 *                             - code: "no_show"
 *                               label: "노쇼/약속 불이행"
 *                             - code: "other"
 *                               label: "기타"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/reasons", blockController.getBlockReasons);

export default router;
