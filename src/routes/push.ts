import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { ApiError } from "../utils/errors";
import { 
  sendPushToUser, 
  sendChatNotification, 
  sendMatchApprovalNotification,
  sendMatchStartNotification,
  sendCommunityNotification,
  removeFCMToken
} from "../services/pushNotificationService";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Push
 *     description: 푸시 알림 관련 API (내부 서비스용)
 */

/**
 * @swagger
 * /api/push/send:
 *   post:
 *     summary: 개별 사용자에게 푸시 알림 전송 (관리자용)
 *     description: |
 *       특정 사용자에게 커스텀 푸시 알림을 전송합니다.
 *       
 *       **주의사항:**
 *       - 관리자 권한이 필요합니다
 *       - 사용자가 FCM 토큰을 등록해야 알림이 전송됩니다
 *       - 사용자의 알림 설정이 활성화되어 있어야 합니다
 *     tags: [Push]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, title, body]
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: 수신자 사용자 ID
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               title:
 *                 type: string
 *                 description: 알림 제목
 *                 example: "매치 참가가 승인되었습니다"
 *               body:
 *                 type: string
 *                 description: 알림 내용
 *                 example: "강남 테니스 코트 매치에 참가가 승인되었습니다."
 *               icon:
 *                 type: string
 *                 description: 알림 아이콘 URL
 *                 example: "/icons/match.png"
 *               image:
 *                 type: string
 *                 description: 알림 이미지 URL
 *                 example: "https://example.com/match-banner.jpg"
 *               data:
 *                 type: object
 *                 description: 추가 데이터
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [chat, match, community, system]
 *                     example: "match"
 *                   targetId:
 *                     type: string
 *                     example: "match-123"
 *               clickAction:
 *                 type: string
 *                 description: 클릭 시 이동할 경로
 *                 example: "/matching/123"
 *     responses:
 *       200:
 *         description: 푸시 알림 전송 성공
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
 *                     sent:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "푸시 알림이 전송되었습니다"
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 필요
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 사용자를 찾을 수 없음
 */
router.post("/send", requireAuth, async (req, res) => {
  try {
    // TODO: 관리자 권한 체크
    const { userId, title, body, icon, image, data, clickAction } = req.body;
    
    const sent = await sendPushToUser(userId, {
      title,
      body,
      icon,
      image,
      data,
      clickAction
    });
    
    res.json({
      success: true,
      data: {
        sent,
        message: sent ? "푸시 알림이 전송되었습니다" : "전송할 수 있는 토큰이 없습니다"
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: "PUSH_SEND_ERROR",
        message: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/push/chat:
 *   post:
 *     summary: 채팅 메시지 푸시 알림 전송 (내부용)
 *     description: |
 *       새로운 채팅 메시지가 도착했을 때 수신자에게 푸시 알림을 전송합니다.
 *       
 *       **자동 전송 시점:**
 *       - 사용자가 오프라인일 때
 *       - 사용자가 해당 채팅방에 없을 때
 *       - 백그라운드 상태일 때
 *     tags: [Push]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipientId, senderName, message, chatRoomId]
 *             properties:
 *               recipientId:
 *                 type: string
 *                 format: uuid
 *                 description: 수신자 ID
 *               senderName:
 *                 type: string
 *                 description: 발신자 이름
 *                 example: "테니스매니아"
 *               message:
 *                 type: string
 *                 description: 메시지 내용 (미리보기용)
 *                 example: "내일 경기 잘 부탁드려요!"
 *               chatRoomId:
 *                 type: string
 *                 format: uuid
 *                 description: 채팅방 ID
 *     responses:
 *       200:
 *         description: 알림 전송 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { recipientId, senderName, message, chatRoomId } = req.body;
    
    await sendChatNotification(recipientId, senderName, message, chatRoomId);
    
    res.json({
      success: true,
      data: { message: "채팅 알림이 전송되었습니다" }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: "CHAT_PUSH_ERROR",
        message: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/push/match/approval:
 *   post:
 *     summary: 매치 참가 승인 알림 전송
 *     description: |
 *       매치 호스트가 참가 신청을 승인했을 때 신청자에게 알림을 전송합니다.
 *     tags: [Push]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, matchTitle, matchId]
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: 승인받은 사용자 ID
 *               matchTitle:
 *                 type: string
 *                 description: 매치 제목
 *                 example: "강남 주말 테니스"
 *               matchId:
 *                 type: string
 *                 format: uuid
 *                 description: 매치 ID
 *     responses:
 *       200:
 *         description: 알림 전송 성공
 */
router.post("/match/approval", requireAuth, async (req, res) => {
  try {
    const { userId, matchTitle, matchId } = req.body;
    
    await sendMatchApprovalNotification(userId, matchTitle, matchId);
    
    res.json({
      success: true,
      data: { message: "매치 승인 알림이 전송되었습니다" }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: "MATCH_APPROVAL_PUSH_ERROR",
        message: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/push/match/start:
 *   post:
 *     summary: 매치 시작 알림 전송
 *     description: |
 *       매치 시작 시간이 가까워졌을 때 참가자들에게 알림을 전송합니다.
 *       
 *       **전송 시점:**
 *       - 매치 시작 1시간 전
 *       - 매치 시작 30분 전 (선택)
 *     tags: [Push]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participants, matchTitle, matchId, startTime]
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: 참가자 ID 목록
 *               matchTitle:
 *                 type: string
 *                 description: 매치 제목
 *               matchId:
 *                 type: string
 *                 format: uuid
 *                 description: 매치 ID
 *               startTime:
 *                 type: string
 *                 description: 시작 시간
 *                 example: "14:00"
 *     responses:
 *       200:
 *         description: 알림 전송 성공
 */
router.post("/match/start", requireAuth, async (req, res) => {
  try {
    const { participants, matchTitle, matchId, startTime } = req.body;
    
    await sendMatchStartNotification(participants, matchTitle, matchId, startTime);
    
    res.json({
      success: true,
      data: { message: "매치 시작 알림이 전송되었습니다" }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: "MATCH_START_PUSH_ERROR",
        message: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/push/community:
 *   post:
 *     summary: 커뮤니티 알림 전송
 *     description: |
 *       게시글에 대한 댓글, 좋아요 등의 알림을 전송합니다.
 *     tags: [Push]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, type, actorName, postTitle, postId]
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: 알림 받을 사용자 ID
 *               type:
 *                 type: string
 *                 enum: [comment, like]
 *                 description: 알림 타입
 *               actorName:
 *                 type: string
 *                 description: 액션을 수행한 사용자 이름
 *                 example: "테니스러버"
 *               postTitle:
 *                 type: string
 *                 description: 게시글 제목
 *                 example: "초보자를 위한 백핸드 팁"
 *               postId:
 *                 type: string
 *                 format: uuid
 *                 description: 게시글 ID
 *     responses:
 *       200:
 *         description: 알림 전송 성공
 */
router.post("/community", requireAuth, async (req, res) => {
  try {
    const { userId, type, actorName, postTitle, postId } = req.body;
    
    await sendCommunityNotification(userId, type, actorName, postTitle, postId);
    
    res.json({
      success: true,
      data: { message: "커뮤니티 알림이 전송되었습니다" }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: "COMMUNITY_PUSH_ERROR",
        message: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/push/token:
 *   delete:
 *     summary: FCM 토큰 삭제
 *     description: |
 *       사용자의 FCM 토큰을 삭제/비활성화합니다.
 *       
 *       **사용 시점:**
 *       - 로그아웃 시
 *       - 푸시 알림 비활성화 시
 *       - 앱 삭제 시
 *     tags: [Push]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: 삭제할 FCM 토큰
 *     responses:
 *       200:
 *         description: 토큰 삭제 성공
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 필요
 */
router.delete("/token", requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { token } = req.body;
    
    if (!token) {
      throw new ApiError(400, "토큰이 필요합니다", "TOKEN_REQUIRED");
    }
    
    await removeFCMToken(userId, token);
    
    res.json({
      success: true,
      data: { message: "FCM 토큰이 삭제되었습니다" }
    });
  } catch (error: any) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: "TOKEN_DELETE_ERROR",
        message: error.message
      }
    });
  }
});

export default router;