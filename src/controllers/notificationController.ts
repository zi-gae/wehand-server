import { Request, Response } from "express";
import { AuthRequest } from "../types/auth";
import { supabase } from "../lib/supabase";
import { ApiError } from "../utils/errors";
import { logger } from "../config/logger";
import { z } from "zod";

// Validation schemas
const updateFcmTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]),
  device_info: z.object({}).optional(),
});

const updateNotificationSettingsSchema = z.object({
  match_notifications: z.boolean().optional(),
  chat_notifications: z.boolean().optional(),
  marketing_notifications: z.boolean().optional(),
});

// 알림 목록 조회
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { type, unread_only = "false", page = "1", limit = "20" } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from("notifications")
      .select(
        `
        id,
        type,
        title,
        message,
        action_data,
        is_read,
        created_at
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    // 타입 필터
    if (type && type !== "all") {
      query = query.eq("type", type);
    }

    // 읽지 않은 알림만 필터
    if (unread_only === "true") {
      query = query.eq("is_read", false);
    }

    const { data: notifications, error, count } = await query;

    if (error) {
      throw new ApiError(500, "알림 조회 실패", "DATABASE_ERROR");
    }

    // 타입에 따라 message 처리
    const processedNotifications = (notifications || []).map((notification) => {
      let processedMessage = notification.message;

      if (notification.type === "system") {
        // system 타입인 경우 JSON 객체로 유지
        processedMessage = notification.message;
      } else {
        // 다른 타입인 경우 문자열로 처리
        if (typeof notification.message === "string") {
          processedMessage = notification.message;
        } else if (
          notification.message &&
          typeof notification.message === "object"
        ) {
          // JSONB에 문자열이 JSON 형태로 저장된 경우, 실제 문자열 값 추출
          processedMessage = notification.message;
        }
      }

      return {
        ...notification,
        message: processedMessage,
      };
    });

    const totalPages = Math.ceil((count || 0) / Number(limit));

    res.json({
      success: true,
      data: processedNotifications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error: any) {
    logger.error("알림 목록 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 읽지 않은 알림 개수 조회 (채팅 알림 + 게시판 알림)
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      throw new ApiError(
        500,
        "읽지 않은 알림 개수 조회 실패",
        "DATABASE_ERROR"
      );
    }

    res.json({
      success: true,
      data: {
        unreadCount: count || 0,
      },
    });
  } catch (error: any) {
    logger.error("읽지 않은 알림 개수 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 읽지 않은 알림 개수 조회 (채팅 알림)
export const getUnreadChatCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // 읽지 않은 채팅/시스템 타입 알림 개수 직접 조회
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("type", ["chat", "system"])
      .eq("is_read", false);

    if (error) {
      throw new ApiError(
        500,
        "읽지 않은 채팅 알림 개수 조회 실패",
        "DATABASE_ERROR"
      );
    }

    res.json({
      success: true,
      data: {
        count: count || 0,
      },
    });
  } catch (error: any) {
    logger.error("읽지 않은 채팅 메시지 개수 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 읽지 않은 알림 개수 조회 (타입별)
export const getUnreadCountByType = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // 채팅 알림 개수
    const { count: chatNotificationCount, error: chatError } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false)
      .eq("type", "chat");

    if (chatError) {
      throw new ApiError(500, "채팅 알림 개수 조회 실패", "DATABASE_ERROR");
    }

    // 게시판 알림 개수 (커뮤니티, 매치 등)
    const { count: boardNotificationCount, error: boardError } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false)
      .neq("type", "chat");

    if (boardError) {
      throw new ApiError(500, "게시판 알림 개수 조회 실패", "DATABASE_ERROR");
    }

    // 전체 알림 개수
    const totalCount =
      (chatNotificationCount || 0) + (boardNotificationCount || 0);

    res.json({
      success: true,
      data: {
        totalCount,
        chatNotificationCount: chatNotificationCount || 0,
        boardNotificationCount: boardNotificationCount || 0,
      },
    });
  } catch (error: any) {
    logger.error("타입별 알림 개수 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 알림 읽음 처리
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { notificationId } = req.params;

    // 알림 소유자 확인
    const { data: notification, error: fetchError } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("id", notificationId)
      .single();

    if (fetchError || !notification) {
      throw new ApiError(
        404,
        "알림을 찾을 수 없습니다",
        "NOTIFICATION_NOT_FOUND"
      );
    }

    if (notification.user_id !== userId) {
      throw new ApiError(403, "알림에 접근할 권한이 없습니다", "FORBIDDEN");
    }

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId);

    if (error) {
      throw new ApiError(500, "알림 읽음 처리 실패", "DATABASE_ERROR");
    }

    res.json({
      success: true,
      data: {
        message: "알림이 읽음 처리되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("알림 읽음 처리 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 모든 알림 읽음 처리
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      throw new ApiError(500, "모든 알림 읽음 처리 실패", "DATABASE_ERROR");
    }

    res.json({
      success: true,
      data: {
        message: "모든 알림이 읽음 처리되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("모든 알림 읽음 처리 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 알림 삭제
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { notificationId } = req.params;

    // 알림 소유자 확인
    const { data: notification, error: fetchError } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("id", notificationId)
      .single();

    if (fetchError || !notification) {
      throw new ApiError(
        404,
        "알림을 찾을 수 없습니다",
        "NOTIFICATION_NOT_FOUND"
      );
    }

    if (notification.user_id !== userId) {
      throw new ApiError(403, "알림을 삭제할 권한이 없습니다", "FORBIDDEN");
    }

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (error) {
      throw new ApiError(500, "알림 삭제 실패", "DATABASE_ERROR");
    }

    res.json({
      success: true,
      data: {
        message: "알림이 삭제되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("알림 삭제 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// FCM 토큰 등록/업데이트
export const updateFcmToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const validation = updateFcmTokenSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ApiError(400, "입력값이 올바르지 않습니다", "VALIDATION_ERROR");
    }

    const { token, platform, device_info } = validation.data;

    // 기존 토큰이 있는지 확인
    const { data: existingToken } = await supabase
      .from("push_tokens")
      .select("id")
      .eq("user_id", userId)
      .eq("token", token)
      .single();

    if (existingToken) {
      // 기존 토큰 업데이트
      const { error } = await supabase
        .from("push_tokens")
        .update({
          platform,
          device_info,
          is_active: true,
          updated_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .eq("id", existingToken.id);

      if (error) {
        throw new ApiError(500, "FCM 토큰 업데이트 실패", "DATABASE_ERROR");
      }
    } else {
      // 새 토큰 등록
      const { error } = await supabase.from("push_tokens").insert({
        user_id: userId,
        token,
        platform,
        device_info,
        is_active: true,
      });

      if (error) {
        throw new ApiError(500, "FCM 토큰 등록 실패", "DATABASE_ERROR");
      }
    }

    res.json({
      success: true,
      data: {
        message: "FCM 토큰이 등록/업데이트되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("FCM 토큰 등록/업데이트 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 알림 설정 조회
export const getNotificationSettings = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;

    const { data: settings, error } = await supabase
      .from("user_preferences")
      .select(
        `
        match_notifications,
        chat_notifications,
        marketing_notifications
      `
      )
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116: No rows returned
      throw new ApiError(500, "알림 설정 조회 실패", "DATABASE_ERROR");
    }

    // 기본 설정값 반환 (설정이 없는 경우)
    const defaultSettings = {
      match_notifications: true,
      chat_notifications: true,
      marketing_notifications: false,
    };

    res.json({
      success: true,
      data: settings || defaultSettings,
    });
  } catch (error: any) {
    logger.error("알림 설정 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 알림 설정 업데이트
export const updateNotificationSettings = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;

    const validation = updateNotificationSettingsSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ApiError(400, "입력값이 올바르지 않습니다", "VALIDATION_ERROR");
    }

    // 기존 설정이 있는지 확인
    const { data: existingSettings } = await supabase
      .from("user_preferences")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (existingSettings) {
      // 기존 설정 업데이트
      const { error } = await supabase
        .from("user_preferences")
        .update({
          ...validation.data,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        throw new ApiError(500, "알림 설정 업데이트 실패", "DATABASE_ERROR");
      }
    } else {
      // 새 설정 생성
      const { error } = await supabase.from("user_preferences").insert({
        user_id: userId,
        ...validation.data,
      });

      if (error) {
        throw new ApiError(500, "알림 설정 생성 실패", "DATABASE_ERROR");
      }
    }

    res.json({
      success: true,
      data: {
        message: "알림 설정이 업데이트되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("알림 설정 업데이트 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

export const notificationController = {
  getNotifications,
  getUnreadCount,
  getUnreadChatCount,
  getUnreadCountByType,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  updateFcmToken,
  getNotificationSettings,
  updateNotificationSettings,
};
