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
 *     summary: 매치 참가자 승인 (호스트 전용, 1:1 채팅방 기반)
 *     description: 1:1 채팅방에서 매치 호스트가 상대방 참가자를 승인합니다. 채팅방 참가자를 자동으로 식별하므로 별도의 사용자 ID 입력이 불필요합니다.
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
 *         description: 1:1 채팅방 ID (매치와 연관된 private 타입 채팅방)
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
 *                       description: 승인된 참가자의 사용자 ID
 *                     matchId:
 *                       type: string
 *                       format: uuid
 *                       description: 관련 매치 ID
 *       400:
 *         description: 잘못된 요청 (1:1 채팅방이 아님, 정원 초과, 유효하지 않은 상태 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidChatRoomType:
 *                 summary: 잘못된 채팅방 타입
 *                 value:
 *                   success: false
 *                   error:
 *                     code: INVALID_CHATROOM_TYPE
 *                     message: 1:1 채팅방에서만 확정 처리가 가능합니다
 *               matchFull:
 *                 summary: 매치 정원 초과
 *                 value:
 *                   success: false
 *                   error:
 *                     code: MATCH_FULL
 *                     message: 매치 정원이 이미 마감되었습니다
 *               invalidStatus:
 *                 summary: 유효하지 않은 참가 상태
 *                 value:
 *                   success: false
 *                   error:
 *                     code: INVALID_STATUS
 *                     message: 대기 중인 참가 신청만 승인할 수 있습니다
 *       403:
 *         description: 호스트가 아니거나 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: NOT_HOST
 *                 message: 매치 호스트만 참가자를 승인할 수 있습니다
 *       404:
 *         description: 채팅방, 매치 또는 참가 신청을 찾을 수 없음
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
 *     summary: 매치 참가자 승인 취소 (호스트 전용, 1:1 채팅방 기반)
 *     description: 1:1 채팅방에서 매치 호스트가 상대방 참가자의 확정을 취소합니다. 채팅방 참가자를 자동으로 식별하므로 별도의 사용자 ID 입력이 불필요합니다.
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
 *         description: 1:1 채팅방 ID (매치와 연관된 private 타입 채팅방)
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
 *                       example: 참가 확정이 취소되었습니다
 *                     participantId:
 *                       type: string
 *                       format: uuid
 *                       description: 취소된 참가자의 사용자 ID
 *                     matchId:
 *                       type: string
 *                       format: uuid
 *                       description: 관련 매치 ID
 *       400:
 *         description: 잘못된 요청 (1:1 채팅방이 아님, 이미 pending 상태, 유효하지 않은 상태 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidChatRoomType:
 *                 summary: 잘못된 채팅방 타입
 *                 value:
 *                   success: false
 *                   error:
 *                     code: INVALID_CHATROOM_TYPE
 *                     message: 1:1 채팅방에서만 확정 취소가 가능합니다
 *               invalidStatus:
 *                 summary: 유효하지 않은 참가 상태
 *                 value:
 *                   success: false
 *                   error:
 *                     code: INVALID_STATUS
 *                     message: 확정된 참가 신청만 취소할 수 있습니다
 *       403:
 *         description: 호스트가 아니거나 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: NOT_HOST
 *                 message: 매치 호스트만 참가 확정을 취소할 수 있습니다
 *       404:
 *         description: 채팅방, 매치 또는 참가 신청을 찾을 수 없음
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

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}:
 *   delete:
 *     summary: 채팅방 삭제
 *     description: 채팅방을 삭제합니다. 매치 채팅방의 경우 호스트만 삭제 가능하고, 1:1 채팅방의 경우 참가자 모두 삭제 가능합니다. 실제로는 soft delete로 처리되며, 시스템 메시지가 추가됩니다.
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
 *         description: 채팅방 삭제 성공
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
 *                       example: 채팅방이 삭제되었습니다
 *                     roomId:
 *                       type: string
 *                       format: uuid
 *                       description: 삭제된 채팅방 ID
 *       400:
 *         description: 잘못된 요청 (이미 삭제된 채팅방 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: CHATROOM_ALREADY_INACTIVE
 *                 message: 이미 삭제된 채팅방입니다
 *       403:
 *         description: 권한 없음 (매치 채팅방에서 호스트가 아닌 경우 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notHost:
 *                 summary: 매치 채팅방 호스트가 아님
 *                 value:
 *                   success: false
 *                   error:
 *                     code: NOT_HOST
 *                     message: 매치 채팅방은 호스트만 삭제할 수 있습니다
 *               notParticipant:
 *                 summary: 채팅방 참가자가 아님
 *                 value:
 *                   success: false
 *                   error:
 *                     code: NOT_PARTICIPANT
 *                     message: 채팅방 참가자만 삭제할 수 있습니다
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: CHATROOM_NOT_FOUND
 *                 message: 채팅방을 찾을 수 없습니다
 */
router.delete("/rooms/:chatRoomId", requireAuth, chatController.deleteChatRoom);

export default router;
