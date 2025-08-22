import { Router } from "express";
import { pushNotificationController } from "../controllers/pushNotificationController";
import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Push Notifications
 *   description: 푸시 알림 관리 API
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterTokenRequest:
 *       type: object
 *       required:
 *         - token
 *         - platform
 *       properties:
 *         token:
 *           type: string
 *           description: FCM 디바이스 토큰
 *         platform:
 *           type: string
 *           enum: [ios, android, web]
 *           description: 플랫폼 종류
 *         deviceInfo:
 *           type: object
 *           description: 디바이스 추가 정보
 *
 *     SendNotificationRequest:
 *       type: object
 *       required:
 *         - title
 *         - body
 *         - type
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *           description: 수신 사용자 ID (단일 전송 시)
 *         userIds:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: 수신 사용자 ID 목록 (다중 전송 시)
 *         title:
 *           type: string
 *           description: 알림 제목
 *         body:
 *           type: string
 *           description: 알림 내용
 *         type:
 *           type: string
 *           description: 알림 타입 (match_created, chat_message 등)
 *         data:
 *           type: object
 *           description: 추가 데이터
 *         imageUrl:
 *           type: string
 *           format: uri
 *           description: 이미지 URL
 *         priority:
 *           type: string
 *           enum: [urgent, high, normal, low]
 *           description: 알림 우선순위
 *         channel:
 *           type: string
 *           description: 알림 채널
 *
 *     TopicNotificationRequest:
 *       type: object
 *       required:
 *         - topic
 *         - title
 *         - body
 *         - type
 *       properties:
 *         topic:
 *           type: string
 *           description: 토픽 이름
 *         title:
 *           type: string
 *           description: 알림 제목
 *         body:
 *           type: string
 *           description: 알림 내용
 *         type:
 *           type: string
 *           description: 알림 타입
 *         data:
 *           type: object
 *           description: 추가 데이터
 *         imageUrl:
 *           type: string
 *           format: uri
 *           description: 이미지 URL
 *         priority:
 *           type: string
 *           enum: [urgent, high, normal, low]
 *           description: 알림 우선순위
 *         channel:
 *           type: string
 *           description: 알림 채널
 *
 *     TopicSubscriptionRequest:
 *       type: object
 *       required:
 *         - tokens
 *         - topic
 *       properties:
 *         tokens:
 *           type: array
 *           items:
 *             type: string
 *           description: FCM 토큰 목록
 *         topic:
 *           type: string
 *           description: 구독/해제할 토픽 이름
 */

/**
 * @swagger
 * /api/push-notifications/register-token:
 *   post:
 *     summary: FCM 디바이스 토큰 등록
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterTokenRequest'
 *     responses:
 *       200:
 *         description: 토큰 등록 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post("/register-token", requireAuth, (req, res) =>
  pushNotificationController.registerToken(req, res)
);

/**
 * @swagger
 * /api/push-notifications/send-to-user:
 *   post:
 *     summary: 단일 사용자에게 푸시 알림 전송
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendNotificationRequest'
 *           examples:
 *             matchCreated:
 *               summary: 매치 생성 알림
 *               value:
 *                 userId: "123e4567-e89b-12d3-a456-426614174000"
 *                 title: "새로운 매치가 등록되었습니다!"
 *                 body: "서울 강남구에서 오늘 저녁 경기가 있습니다."
 *                 type: "match_created"
 *                 data:
 *                   matchId: "match123"
 *                   venueId: "venue456"
 *                 priority: "high"
 *                 channel: "matches"
 *     responses:
 *       200:
 *         description: 알림 전송 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     successCount:
 *                       type: number
 *                     failureCount:
 *                       type: number
 *                     failedTokens:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post("/send-to-user", requireAuth, (req, res) =>
  pushNotificationController.sendToUser(req, res)
);

/**
 * @swagger
 * /api/push-notifications/send-to-multiple:
 *   post:
 *     summary: 여러 사용자에게 푸시 알림 전송
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendNotificationRequest'
 *           examples:
 *             announcement:
 *               summary: 공지사항 알림
 *               value:
 *                 userIds: ["user1", "user2", "user3"]
 *                 title: "중요 공지사항"
 *                 body: "서비스 점검이 예정되어 있습니다."
 *                 type: "announcement"
 *                 priority: "high"
 *                 channel: "system"
 *     responses:
 *       200:
 *         description: 알림 전송 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     successful:
 *                       type: number
 *                     failed:
 *                       type: number
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post("/send-to-multiple", requireAuth, (req, res) =>
  pushNotificationController.sendToMultipleUsers(req, res)
);

/**
 * @swagger
 * /api/push-notifications/send-to-topic:
 *   post:
 *     summary: 토픽 구독자에게 푸시 알림 전송
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TopicNotificationRequest'
 *           examples:
 *             regionalUpdate:
 *               summary: 지역별 업데이트
 *               value:
 *                 topic: "seoul-matches"
 *                 title: "서울 지역 새로운 매치"
 *                 body: "오늘 저녁 강남구에서 매치가 있습니다."
 *                 type: "regional_update"
 *                 priority: "normal"
 *                 channel: "matches"
 *     responses:
 *       200:
 *         description: 알림 전송 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     messageId:
 *                       type: string
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post("/send-to-topic", requireAuth, (req, res) =>
  pushNotificationController.sendToTopic(req, res)
);

/**
 * @swagger
 * /api/push-notifications/subscribe-topic:
 *   post:
 *     summary: 토픽 구독
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TopicSubscriptionRequest'
 *           examples:
 *             subscribeMatches:
 *               summary: 매치 알림 구독
 *               value:
 *                 tokens: ["token1", "token2"]
 *                 topic: "all-matches"
 *     responses:
 *       200:
 *         description: 구독 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     successCount:
 *                       type: number
 *                     failureCount:
 *                       type: number
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post("/subscribe-topic", requireAuth, (req, res) =>
  pushNotificationController.subscribeToTopic(req, res)
);

/**
 * @swagger
 * /api/push-notifications/unsubscribe-topic:
 *   post:
 *     summary: 토픽 구독 해제
 *     tags: [Push Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TopicSubscriptionRequest'
 *           examples:
 *             unsubscribeMatches:
 *               summary: 매치 알림 구독 해제
 *               value:
 *                 tokens: ["token1", "token2"]
 *                 topic: "all-matches"
 *     responses:
 *       200:
 *         description: 구독 해제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     successCount:
 *                       type: number
 *                     failureCount:
 *                       type: number
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post("/unsubscribe-topic", requireAuth, (req, res) =>
  pushNotificationController.unsubscribeFromTopic(req, res)
);

export default router;
