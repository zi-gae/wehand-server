import { Router } from "express";
import { chatController } from "../controllers/chatController";
import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /api/chat/rooms:
 *   get:
 *     summary: 채팅방 목록 조회
 *     tags: [Chat]
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
 *           default: 20
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 채팅방 목록 조회 성공
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
 *                     $ref: '#/components/schemas/ChatRoom'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/rooms", requireAuth, chatController.getChatRooms);

/**
 * @swagger
 * /api/chat/rooms:
 *   post:
 *     summary: 채팅방 생성
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateChatRoomRequest'
 *     responses:
 *       201:
 *         description: 채팅방 생성 성공
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
 *                       example: 채팅방이 생성되었습니다
 *       400:
 *         description: 입력값 오류
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
router.post("/rooms", requireAuth, chatController.createChatRoom);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}:
 *   get:
 *     summary: 채팅방 상세 정보 조회
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 채팅방 ID
 *     responses:
 *       200:
 *         description: 채팅방 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ChatRoomDetail'
 *       403:
 *         description: 접근 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/rooms/:chatRoomId", requireAuth, chatController.getChatRoom);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}/messages:
 *   get:
 *     summary: 메시지 목록 조회
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 채팅방 ID
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
 *           default: 50
 *         description: 페이지 크기
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 특정 메시지 ID 이전 메시지 조회 (무한 스크롤용)
 *     responses:
 *       200:
 *         description: 메시지 목록 조회 성공
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
 *                     $ref: '#/components/schemas/ChatMessage'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       403:
 *         description: 접근 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/rooms/:chatRoomId/messages",
  requireAuth,
  chatController.getMessages
);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}/messages/all:
 *   get:
 *     summary: 채팅방의 모든 메시지 조회 (페이지네이션 없음)
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 채팅방 ID
 *     responses:
 *       200:
 *         description: 모든 메시지 조회 성공
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
 *                     $ref: '#/components/schemas/ChatMessage'
 *       403:
 *         description: 접근 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/rooms/:chatRoomId/messages/all",
  requireAuth,
  chatController.getAllMessages
);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}/messages:
 *   post:
 *     summary: 메시지 전송
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 채팅방 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *     responses:
 *       201:
 *         description: 메시지 전송 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ChatMessage'
 *       400:
 *         description: 입력값 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 접근 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/rooms/:chatRoomId/messages",
  requireAuth,
  chatController.sendMessage
);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}/read:
 *   post:
 *     summary: 메시지 읽음 처리
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 채팅방 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messageId:
 *                 type: string
 *                 format: uuid
 *                 description: 마지막으로 읽은 메시지 ID
 *             required:
 *               - messageId
 *     responses:
 *       200:
 *         description: 메시지 읽음 처리 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         description: 접근 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/rooms/:chatRoomId/read",
  requireAuth,
  chatController.markMessagesAsRead
);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}/leave:
 *   post:
 *     summary: 채팅방 나가기
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 채팅방 ID
 *     responses:
 *       200:
 *         description: 채팅방 나가기 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         description: 접근 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/rooms/:chatRoomId/leave",
  requireAuth,
  chatController.leaveChatRoom
);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}/join:
 *   post:
 *     summary: 채팅방 참가
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 채팅방 ID
 *     responses:
 *       200:
 *         description: 채팅방 참가 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: 잘못된 요청 (이미 참가중, 정원 초과 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 접근 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/rooms/:chatRoomId/join",
  requireAuth,
  chatController.joinChatRoom
);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}/approve:
 *   post:
 *     summary: 매치 참가자 승인 (호스트 전용)
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 채팅방 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: 승인할 참가자의 사용자 ID
 *             required:
 *               - userId
 *     responses:
 *       200:
 *         description: 참가자 승인 성공
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
 *                     message:
 *                       type: string
 *                       example: 참가자가 승인되었습니다
 *                     participantId:
 *                       type: string
 *                       format: uuid
 *                     matchId:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: 잘못된 요청 (정원 초과, 유효하지 않은 상태 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 호스트가 아니거나 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 채팅방 또는 참가 신청을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/rooms/:chatRoomId/approve",
  requireAuth,
  chatController.approveMatchParticipant
);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}/cancel-approval:
 *   post:
 *     summary: 매치 참가자 승인 취소 (호스트 전용)
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 채팅방 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: 승인을 취소할 참가자의 사용자 ID
 *             required:
 *               - userId
 *     responses:
 *       200:
 *         description: 참가자 승인 취소 성공
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
 *                     message:
 *                       type: string
 *                       example: 참가 승인이 취소되었습니다
 *                     participantId:
 *                       type: string
 *                       format: uuid
 *                     matchId:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: 잘못된 요청 (이미 pending 상태, 유효하지 않은 상태 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 호스트가 아니거나 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 채팅방 또는 참가자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/rooms/:chatRoomId/cancel-approval",
  requireAuth,
  chatController.cancelMatchApproval
);

export default router;
