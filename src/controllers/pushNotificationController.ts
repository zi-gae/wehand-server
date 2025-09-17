import { Request, Response } from "express";
import { pushNotificationService } from "../services/pushNotificationService";
import { z } from "zod";

// 요청 스키마 정의
const sendNotificationSchema = z.object({
  userId: z.string().uuid().optional(),
  userIds: z.array(z.string().uuid()).optional(),
  title: z.string(),
  body: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.string()).optional(),
  imageUrl: z.string().url().optional(),
  priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
  channel: z.string().optional(),
});

const registerTokenSchema = z.object({
  token: z.string(),
  platform: z.enum(["ios", "android", "web"]),
  deviceInfo: z.record(z.string(), z.any()).optional(),
});

const topicSubscriptionSchema = z.object({
  tokens: z.array(z.string()),
  topic: z.string(),
});

export class PushNotificationController {
  // 단일 사용자에게 알림 전송
  async sendToUser(req: Request, res: Response) {
    try {
      const validatedData = sendNotificationSchema.parse(req.body);

      if (!validatedData.userId) {
        return res.status(400).json({
          success: false,
          message: "userId가 필요합니다.",
        });
      }

      const result = await pushNotificationService.sendToUser(
        validatedData.userId,
        {
          title: validatedData.title,
          body: validatedData.body,
          type: validatedData.type,
          data: validatedData.data,
          imageUrl: validatedData.imageUrl,
          priority: validatedData.priority,
          channel: validatedData.channel,
        }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("알림 전송 실패:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "잘못된 요청 형식",
          errors: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        message: "알림 전송 중 오류가 발생했습니다.",
      });
    }
  }

  // 여러 사용자에게 알림 전송
  async sendToMultipleUsers(req: Request, res: Response) {
    try {
      const validatedData = sendNotificationSchema.parse(req.body);

      if (!validatedData.userIds || validatedData.userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "userIds 배열이 필요합니다.",
        });
      }

      const result = await pushNotificationService.sendToMultipleUsers(
        validatedData.userIds,
        {
          title: validatedData.title,
          body: validatedData.body,
          type: validatedData.type,
          data: validatedData.data,
          imageUrl: validatedData.imageUrl,
          priority: validatedData.priority,
          channel: validatedData.channel,
        }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("다중 알림 전송 실패:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "잘못된 요청 형식",
          errors: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        message: "알림 전송 중 오류가 발생했습니다.",
      });
    }
  }

  // 토픽 기반 알림 전송
  async sendToTopic(req: Request, res: Response) {
    try {
      const { topic, ...notificationData } = req.body;
      const validatedData = sendNotificationSchema.parse(notificationData);

      if (!topic) {
        return res.status(400).json({
          success: false,
          message: "topic이 필요합니다.",
        });
      }

      const result = await pushNotificationService.sendToTopic(topic, {
        title: validatedData.title,
        body: validatedData.body,
        type: validatedData.type,
        data: validatedData.data,
        imageUrl: validatedData.imageUrl,
        priority: validatedData.priority,
        channel: validatedData.channel,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("토픽 알림 전송 실패:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "잘못된 요청 형식",
          errors: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        message: "알림 전송 중 오류가 발생했습니다.",
      });
    }
  }

  // 디바이스 토큰 등록
  async registerToken(req: Request, res: Response) {
    try {
      const validatedData = registerTokenSchema.parse(req.body);
      const userId = (req as any).user?.id; // 인증 미들웨어에서 설정된 사용자 ID

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "인증이 필요합니다.",
        });
      }

      console.log("Registering token for user:", userId, validatedData);
      const result = await pushNotificationService.registerDeviceToken(
        userId,
        validatedData.token,
        validatedData.platform,
        validatedData.deviceInfo
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("토큰 등록 실패:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "잘못된 요청 형식",
          errors: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        message: "토큰 등록 중 오류가 발생했습니다.",
      });
    }
  }

  // 토픽 구독
  async subscribeToTopic(req: Request, res: Response) {
    try {
      const validatedData = topicSubscriptionSchema.parse(req.body);

      const result = await pushNotificationService.subscribeToTopic(
        validatedData.tokens,
        validatedData.topic
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("토픽 구독 실패:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "잘못된 요청 형식",
          errors: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        message: "토픽 구독 중 오류가 발생했습니다.",
      });
    }
  }

  // 토픽 구독 해제
  async unsubscribeFromTopic(req: Request, res: Response) {
    try {
      const validatedData = topicSubscriptionSchema.parse(req.body);

      const result = await pushNotificationService.unsubscribeFromTopic(
        validatedData.tokens,
        validatedData.topic
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("토픽 구독 해제 실패:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "잘못된 요청 형식",
          errors: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        message: "토픽 구독 해제 중 오류가 발생했습니다.",
      });
    }
  }

  // 비즈니스 로직 기반 알림 예시 - 매치 생성 알림
  async sendMatchCreatedNotification(matchData: any) {
    try {
      // 해당 지역의 사용자들 조회
      const userIds = await this.getUsersInRegion(matchData.region);

      if (userIds.length > 0) {
        await pushNotificationService.sendToMultipleUsers(userIds, {
          title: "새로운 매치가 등록되었습니다!",
          body: `${matchData.venue_name}에서 ${matchData.date} ${matchData.time}에 경기가 있습니다.`,
          type: "match_created",
          data: {
            matchId: matchData.id,
            venueId: matchData.venue_id,
            date: matchData.date,
            time: matchData.time,
          },
          priority: "high",
          channel: "matches",
        });
      }
    } catch (error) {
      console.error("매치 생성 알림 전송 실패:", error);
    }
  }

  // 비즈니스 로직 기반 알림 예시 - 매치 참가 신청 알림
  async sendMatchJoinRequestNotification(
    matchOwnerId: string,
    requestData: any
  ) {
    try {
      await pushNotificationService.sendToUser(matchOwnerId, {
        title: "매치 참가 신청이 있습니다",
        body: `${requestData.userName}님이 매치 참가를 신청했습니다.`,
        type: "match_join_request",
        data: {
          matchId: requestData.matchId,
          requestId: requestData.requestId,
          userId: requestData.userId,
        },
        priority: "urgent",
        channel: "matches",
      });
    } catch (error) {
      console.error("매치 참가 신청 알림 전송 실패:", error);
    }
  }

  // 헬퍼 메서드 - 지역 사용자 조회
  private async getUsersInRegion(region: string): Promise<string[]> {
    // Supabase에서 해당 지역 사용자 조회 로직
    // 실제 구현시 적절한 쿼리로 대체
    return [];
  }
}

export const pushNotificationController = new PushNotificationController();
