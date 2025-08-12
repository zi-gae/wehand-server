import { Router } from "express";
import { notificationController } from "../controllers/notificationController";
import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     NotificationCountSummary:
 *       type: object
 *       description: |
 *         **알림 개수 조회 API 가이드**
 *
 *         이 서비스는 3가지 알림 개수 조회 API를 제공합니다:
 *
 *         1. **전체 알림 개수** (`/api/notifications/unread-count`)
 *            - 모든 타입의 읽지 않은 알림 개수
 *            - 사용처: 앱 아이콘 배지, 전체 알림 표시
 *
 *         2. **채팅 메시지 개수** (`/api/notifications/unread-chat-count`)
 *            - 실제 채팅 메시지의 읽지 않은 개수
 *            - 사용처: 채팅 탭 배지, 채팅 아이콘 표시
 *            - 주의: 알림이 아닌 실제 메시지 테이블에서 계산
 *
 *         3. **타입별 알림 개수** (`/api/notifications/unread-count-by-type`)
 *            - 채팅 알림 vs 게시판 알림으로 구분
 *            - 사용처: 탭별 개별 배지, 세분화된 알림 관리
 *
 *         **채팅 메시지 vs 채팅 알림의 차이:**
 *         - 채팅 메시지: 실제 채팅방의 메시지 (messages 테이블)
 *         - 채팅 알림: 푸시 알림용 레코드 (notifications 테이블, type='chat')
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: 알림 목록 조회
 *     description: |
 *       사용자의 알림 목록을 조회합니다.
 *
 *       **알림 타입별 설명:**
 *       - `match`: 매치 관련 알림 (참가 승인, 거부, 시작 등)
 *       - `chat`: 채팅 메시지 알림
 *       - `community`: 커뮤니티 알림 (게시글 좋아요, 댓글, 대댓글)
 *       - `system`: 시스템 공지사항
 *       - `marketing`: 마케팅 알림
 *
 *       **커뮤니티 알림 종류:**
 *       - 게시글 좋아요: 다른 사용자가 내 게시글에 좋아요를 누른 경우
 *       - 댓글 알림: 다른 사용자가 내 게시글에 댓글을 작성한 경우
 *       - 대댓글 알림: 다른 사용자가 내 댓글에 답글을 작성한 경우
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, match, chat, community, system]
 *           default: all
 *         description: |
 *           알림 타입 필터
 *           - `all`: 모든 알림
 *           - `match`: 매치 관련 알림만
 *           - `chat`: 채팅 알림만
 *           - `community`: 커뮤니티 알림만 (좋아요, 댓글, 대댓글)
 *           - `system`: 시스템 알림만
 *       - in: query
 *         name: unread_only
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: false
 *         description: 읽지 않은 알림만 조회
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
 *           default: 20
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 알림 목록 조회 성공
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
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", requireAuth, notificationController.getNotifications);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: 전체 읽지 않은 알림 개수 조회
 *     description: |
 *       사용자의 모든 읽지 않은 알림 개수를 조회합니다.
 *
 *       **포함되는 알림:**
 *       - 채팅 알림 (type: 'chat')
 *       - 게시판 알림 (type: 'community', 'match', 'system' 등)
 *       - 모든 타입의 읽지 않은 알림
 *
 *       **사용 예시:**
 *       - 앱 아이콘에 표시할 전체 배지 개수
 *       - 알림 탭의 총 알림 개수
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 전체 읽지 않은 알림 개수 조회 성공
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
 *                     unreadCount:
 *                       type: integer
 *                       example: 8
 *                       description: 전체 읽지 않은 알림 개수 (채팅 + 게시판 알림)
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/unread-count", requireAuth, notificationController.getUnreadCount);

/**
 * @swagger
 * /api/notifications/unread-chat-count:
 *   get:
 *     summary: 읽지 않은 채팅 메시지 개수 조회
 *     description: |
 *       사용자의 모든 채팅방에서 읽지 않은 메시지의 총 개수를 조회합니다.
 *
 *       **계산 방식:**
 *       - 사용자가 참여 중인 모든 활성 채팅방을 조회
 *       - 각 채팅방의 마지막 읽은 메시지(last_read_message_id) 이후의 메시지 개수 계산
 *       - 마지막 읽은 메시지가 없는 경우, 해당 채팅방의 모든 메시지를 읽지 않은 것으로 계산
 *       - 모든 채팅방의 읽지 않은 메시지 개수를 합산
 *
 *       **사용 예시:**
 *       - 채팅 탭에 표시할 배지 개수
 *       - 채팅 아이콘의 읽지 않은 메시지 표시
 *       - 실제 채팅 메시지만 계산 (알림과는 별개)
 *
 *       **주의사항:**
 *       - 이 API는 실제 채팅 메시지 테이블(messages)에서 직접 계산합니다
 *       - 알림 테이블의 채팅 알림과는 다른 개념입니다
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 읽지 않은 채팅 메시지 개수 조회 성공
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
 *                     count:
 *                       type: integer
 *                       description: 읽지 않은 채팅 메시지 개수
 *                       example: 5
 *             examples:
 *               success:
 *                 summary: 성공적인 응답
 *                 value:
 *                   success: true
 *                   data:
 *                     count: 12
 *               no_unread:
 *                 summary: 읽지 않은 메시지가 없는 경우
 *                 value:
 *                   success: true
 *                   data:
 *                     count: 0
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/unread-chat-count",
  requireAuth,
  notificationController.getUnreadChatCount
);

/**
 * @swagger
 * /api/notifications/unread-count-by-type:
 *   get:
 *     summary: 타입별 읽지 않은 알림 개수 조회
 *     description: |
 *       채팅 알림과 게시판 알림을 구분하여 읽지 않은 알림 개수를 조회합니다.
 *
 *       **알림 타입 구분:**
 *       - **채팅 알림**: `type = 'chat'`인 알림
 *         - 채팅 메시지 알림
 *         - 시스템 메시지 알림 (입장, 퇴장 등)
 *       - **게시판 알림**: `type != 'chat'`인 모든 알림
 *         - 커뮤니티 알림 (`type = 'community'`): 게시글 좋아요, 댓글, 대댓글
 *         - 매치 알림 (`type = 'match'`): 참가 승인, 거부, 시작 등
 *         - 시스템 알림 (`type = 'system'`): 공지사항, 업데이트 등
 *         - 마케팅 알림 (`type = 'marketing'`): 프로모션, 이벤트 등
 *
 *       **사용 예시:**
 *       - 탭별로 다른 배지 표시 (채팅 탭 vs 알림 탭)
 *       - 알림 설정에 따른 개별 관리
 *       - 사용자 경험 개선을 위한 세분화된 알림 표시
 *
 *       **응답 데이터:**
 *       - `totalCount`: 전체 읽지 않은 알림 개수 (채팅 + 게시판)
 *       - `chatNotificationCount`: 채팅 알림만의 개수
 *       - `boardNotificationCount`: 게시판 알림만의 개수
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 타입별 읽지 않은 알림 개수 조회 성공
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
 *                     totalCount:
 *                       type: integer
 *                       description: 전체 읽지 않은 알림 개수 (채팅 + 게시판)
 *                       example: 8
 *                     chatNotificationCount:
 *                       type: integer
 *                       description: 채팅 알림 개수 (type = 'chat')
 *                       example: 3
 *                     boardNotificationCount:
 *                       type: integer
 *                       description: 게시판 알림 개수 (커뮤니티, 매치, 시스템 등)
 *                       example: 5
 *             examples:
 *               mixed_notifications:
 *                 summary: 다양한 알림이 있는 경우
 *                 value:
 *                   success: true
 *                   data:
 *                     totalCount: 15
 *                     chatNotificationCount: 7
 *                     boardNotificationCount: 8
 *               only_chat:
 *                 summary: 채팅 알림만 있는 경우
 *                 value:
 *                   success: true
 *                   data:
 *                     totalCount: 5
 *                     chatNotificationCount: 5
 *                     boardNotificationCount: 0
 *               no_notifications:
 *                 summary: 알림이 없는 경우
 *                 value:
 *                   success: true
 *                   data:
 *                     totalCount: 0
 *                     chatNotificationCount: 0
 *                     boardNotificationCount: 0
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/unread-count-by-type",
  requireAuth,
  notificationController.getUnreadCountByType
);

/**
 * @swagger
 * /api/notifications/{notificationId}/read:
 *   post:
 *     summary: 알림 읽음 처리
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 알림 ID
 *     responses:
 *       200:
 *         description: 알림 읽음 처리 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 알림을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/:notificationId/read",
  requireAuth,
  notificationController.markAsRead
);

/**
 * @swagger
 * /api/notifications/read-all:
 *   post:
 *     summary: 모든 알림 읽음 처리
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 모든 알림 읽음 처리 성공
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
 */
router.post("/read-all", requireAuth, notificationController.markAllAsRead);

/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   delete:
 *     summary: 알림 삭제
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 알림 ID
 *     responses:
 *       200:
 *         description: 알림 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 알림을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  "/:notificationId",
  requireAuth,
  notificationController.deleteNotification
);

/**
 * @swagger
 * /api/notifications/fcm-token:
 *   post:
 *     summary: FCM 토큰 등록/업데이트
 *     description: |
 *       Firebase Cloud Messaging(FCM) 푸시 알림을 위한 토큰을 등록하거나 업데이트합니다.
 *       
 *       **사용 시나리오:**
 *       - 사용자가 푸시 알림 권한을 허용했을 때
 *       - FCM 토큰이 갱신되었을 때 (24시간마다)
 *       - 새로운 디바이스에서 로그인했을 때
 *       
 *       **토큰 관리:**
 *       - 같은 토큰이 이미 존재하면 업데이트
 *       - 새로운 토큰이면 추가
 *       - 사용자당 여러 디바이스 토큰 지원
 *       
 *       **푸시 알림 타입:**
 *       - 채팅 메시지 알림
 *       - 매치 참가 승인/거부 알림
 *       - 매치 시작 알림
 *       - 커뮤니티 알림 (댓글, 좋아요)
 *       - 시스템 공지사항
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateFcmTokenRequest'
 *           examples:
 *             web:
 *               summary: 웹 브라우저에서 토큰 등록
 *               value:
 *                 fcmToken: "dA1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuVwXyZ..."
 *                 deviceType: "web"
 *                 deviceInfo:
 *                   userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)..."
 *                   platform: "MacIntel"
 *                   language: "ko-KR"
 *             mobile:
 *               summary: 모바일 앱에서 토큰 등록
 *               value:
 *                 fcmToken: "fCm_ToKeN_FrOm_MoBiLe_ApP..."
 *                 deviceType: "ios"
 *                 deviceInfo:
 *                   userAgent: "WeHand/1.0.0 (iPhone; iOS 17.0)"
 *                   platform: "iPhone14,2"
 *                   language: "ko-KR"
 *     responses:
 *       200:
 *         description: FCM 토큰 등록/업데이트 성공
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
 *                       example: "FCM 토큰이 등록/업데이트되었습니다"
 *       400:
 *         description: 입력값 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_token:
 *                 summary: 토큰 누락
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "TOKEN_REQUIRED"
 *                     message: "FCM 토큰이 필요합니다"
 *               invalid_device_type:
 *                 summary: 잘못된 디바이스 타입
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "VALIDATION_ERROR"
 *                     message: "입력값이 올바르지 않습니다"
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/fcm-token", requireAuth, notificationController.updateFcmToken);

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     summary: 알림 설정 조회
 *     description: |
 *       사용자의 알림 설정을 조회합니다.
 *
 *       **설정 항목:**
 *       - `match_notifications`: 매치 관련 알림 (참가 승인, 거부, 시작 등)
 *       - `chat_notifications`: 채팅 메시지 알림
 *       - `community_notifications`: 커뮤니티 알림 (게시글 좋아요, 댓글, 대댓글)
 *       - `marketing_notifications`: 마케팅 및 프로모션 알림
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 알림 설정 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/NotificationSettings'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/settings",
  requireAuth,
  notificationController.getNotificationSettings
);

/**
 * @swagger
 * /api/notifications/settings:
 *   put:
 *     summary: 알림 설정 업데이트
 *     description: |
 *       사용자의 알림 설정을 업데이트합니다.
 *
 *       **커뮤니티 알림 설정:**
 *       - `community_notifications`를 `false`로 설정하면 다음 알림이 발송되지 않습니다:
 *         - 게시글 좋아요 알림
 *         - 댓글 작성 알림
 *         - 대댓글 작성 알림
 *
 *       **업데이트 방식:**
 *       - 제공된 필드만 업데이트됩니다 (PATCH 방식)
 *       - 생략된 필드는 기존 값이 유지됩니다
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateNotificationSettingsRequest'
 *           examples:
 *             커뮤니티_알림_끄기:
 *               summary: 커뮤니티 알림만 끄기
 *               value:
 *                 community_notifications: false
 *             모든_알림_설정:
 *               summary: 모든 알림 설정 업데이트
 *               value:
 *                 match_notifications: true
 *                 chat_notifications: true
 *                 community_notifications: false
 *                 marketing_notifications: false
 *     responses:
 *       200:
 *         description: 알림 설정 업데이트 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
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
router.put(
  "/settings",
  requireAuth,
  notificationController.updateNotificationSettings
);

export default router;
