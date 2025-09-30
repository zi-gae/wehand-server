import { Response } from "express";
import { io } from "../../app";
import { logger } from "../../config/logger";
import { supabase } from "../../lib/supabase";
import { createChatMessageNotifications } from "../../services/chatNotificationService";
import { AuthRequest } from "../../types/auth";
import { ApiError } from "../../utils/errors";
import { safeJsonParse } from "../../utils/safeJsonParse";
import { snakeToCamel } from "../../utils/snakeToCamel";
import { KeysToCamelCase } from "../../utils/types";
import { sendMessageSchema } from "./schemas";

export const getAllMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    const { data: participation } = await supabase
      .from("chat_participants")
      .select("id")
      .eq("room_id", chatRoomId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!participation) {
      throw new ApiError(403, "채팅방에 접근할 권한이 없습니다", "FORBIDDEN");
    }

    await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("is_read", false)
      .or(
        `action_data->chatRoomId.eq."${chatRoomId}",chat_room_id.eq.${chatRoomId}`
      );

    const { data: messages, error } = await supabase
      .from("messages")
      .select(
        `
        id,
        content,
        message_type,
        metadata,
        created_at,
        sender:sender_id(
          id,
          nickname,
          profile_image_url
        )
      `
      )
      .eq("room_id", chatRoomId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new ApiError(500, "메시지 조회 실패", "DATABASE_ERROR");
    }

    const responseMessages = messages.map((message) => ({
      ...message,
      content: safeJsonParse(message.content),
    }));

    const data =
      snakeToCamel<KeysToCamelCase<typeof responseMessages>>(responseMessages);

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    logger.error("메시지 조회 실패:", error);

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

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;
    const { page = "1", limit = "50", before } = req.query;

    const { data: participation } = await supabase
      .from("chat_participants")
      .select("id")
      .eq("room_id", chatRoomId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!participation) {
      throw new ApiError(403, "채팅방에 접근할 권한이 없습니다", "FORBIDDEN");
    }

    await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("is_read", false)
      .or(
        `action_data->chatRoomId.eq."${chatRoomId}",chat_room_id.eq.${chatRoomId}`
      );

    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from("messages")
      .select(
        `
        id,
        content,
        message_type,
        metadata,
        created_at,
        sender:sender_id(
          id,
          nickname,
          profile_image_url
        )
      `,
        { count: "exact" }
      )
      .eq("room_id", chatRoomId)
      .order("created_at", { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (before) {
      const { data: beforeMessage } = await supabase
        .from("messages")
        .select("created_at")
        .eq("id", before)
        .single();

      if (beforeMessage) {
        query = query.lt("created_at", beforeMessage.created_at);
      }
    }

    const { data: messages, error, count } = await query;

    if (error) {
      console.error("메시지 조회 오류:", error);
      throw new ApiError(500, "메시지 조회 실패", "DATABASE_ERROR");
    }

    const sortedMessages = (messages || []).reverse();
    const data =
      snakeToCamel<KeysToCamelCase<typeof sortedMessages>>(sortedMessages);

    const totalPages = Math.ceil((count || 0) / Number(limit));

    res.json({
      success: true,
      data,
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
    logger.error("메시지 조회 실패:", error);

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

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    const validation = sendMessageSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ApiError(400, "입력값이 올바르지 않습니다", "VALIDATION_ERROR");
    }

    const { data: participation } = await supabase
      .from("chat_participants")
      .select("id")
      .eq("room_id", chatRoomId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!participation) {
      throw new ApiError(403, "채팅방에 접근할 권한이 없습니다", "FORBIDDEN");
    }

    const { content, message_type } = validation.data;

    let metadata = null;
    if (message_type === "system" && content.startsWith("{")) {
      try {
        metadata = JSON.parse(content);
      } catch (e) {}
    }

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        room_id: chatRoomId,
        sender_id: message_type === "system" ? null : userId,
        content,
        message_type,
        metadata,
      })
      .select(
        `
        id,
        content,
        message_type,
        metadata,
        created_at,
        sender:sender_id(
          id,
          nickname,
          profile_image_url
        )
      `
      )
      .single();

    if (error) {
      console.log("@@@메시지 전송 실패", error);
      throw new ApiError(500, "메시지 전송 실패", "DATABASE_ERROR");
    }

    await supabase
      .from("chat_rooms")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chatRoomId);

    if (message) {
      let senderNickname = "알 수 없음";
      let notificationContent = message.content;

      if (message.message_type === "system") {
        senderNickname = "SYSTEM";

        if (message.metadata) {
          const metadata = message.metadata;

          switch (metadata.type) {
            case "approval_request":
              senderNickname = "매치 승인 요청";
              notificationContent = `${metadata.participantName}님의 매치 참가 요청이 도착했습니다.`;
              break;
            case "user_joined":
              notificationContent = `새로운 사용자가 채팅방에 참가했습니다.`;
              break;
            case "user_left":
              notificationContent = `사용자가 채팅방을 나갔습니다.`;
              break;
            default:
              notificationContent =
                metadata.message || metadata.text || "시스템 메시지";
          }
        } else {
          try {
            if (message.content.startsWith("{")) {
              const contentObj = JSON.parse(message.content);
              notificationContent =
                contentObj.message || contentObj.text || "시스템 메시지";
            }
          } catch (e) {
            notificationContent = message.content;
          }
        }
      } else {
        senderNickname =
          (Array.isArray(message.sender)
            ? (message.sender[0] as { nickname?: string })?.nickname
            : (message.sender as { nickname?: string })?.nickname) ||
          "알 수 없음";
        notificationContent = message.content;
      }

      createChatMessageNotifications({
        chatRoomId,
        senderId: message.message_type === "system" ? null : userId,
        title: senderNickname,
        messageId: message.id,
        content: notificationContent,
        type:
          message.message_type === "system" ? "match_approval_request" : "chat",
      }).catch(() => {});
    }

    const roomName = `chat-${chatRoomId}`;
    const subscribers = io.sockets.adapter.rooms.get(roomName)?.size ?? 0;
    logger.info(
      `emit new-message to ${roomName} (subscribers: ${subscribers})`
    );

    io.to(`chat-${chatRoomId}`).emit("new-message", {
      id: message.id,
      content: message.content,
      messageType: message.message_type,
      metadata: message.metadata,
      sender: message.sender,
      timestamp: message.created_at,
      chatRoomId: chatRoomId,
    });

    const { data: participants } = await supabase
      .from("chat_participants")
      .select("user_id")
      .eq("room_id", chatRoomId)
      .eq("is_active", true);

    if (participants && participants.length > 0) {
      participants.forEach((participant) => {
        io.to(`user-${participant.user_id}`).emit("chat-room-updated", {
          chatRoomId: chatRoomId,
          lastMessage: {
            id: message.id,
            content: message.content,
            messageType: message.message_type,
            sender: message.sender,
            timestamp: message.created_at,
          },
          updatedAt: new Date().toISOString(),
        });
      });

      logger.info(
        `채팅방 업데이트 이벤트 전송: ${participants.length}명의 사용자에게 전송`
      );
    }

    logger.info(
      `실시간 메시지 전송: 채팅방 ${chatRoomId}, 메시지 ID ${message.id}`
    );

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error: any) {
    logger.error("메시지 전송 실패:", error);

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

export const markMessagesAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;
    const { messageId } = req.body;

    const { data: participation } = await supabase
      .from("chat_participants")
      .select("id")
      .eq("room_id", chatRoomId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!participation) {
      throw new ApiError(403, "채팅방에 접근할 권한이 없습니다", "FORBIDDEN");
    }

    if (messageId) {
      const { data: message } = await supabase
        .from("messages")
        .select("id")
        .eq("id", messageId)
        .eq("room_id", chatRoomId)
        .single();

      if (!message) {
        throw new ApiError(
          404,
          "메시지를 찾을 수 없습니다",
          "MESSAGE_NOT_FOUND"
        );
      }

      const { error } = await supabase
        .from("chat_participants")
        .update({
          last_read_message_id: messageId,
        })
        .eq("room_id", chatRoomId)
        .eq("user_id", userId);

      if (error) {
        throw new ApiError(500, "메시지 읽음 처리 실패", "DATABASE_ERROR");
      }

      await supabase.from("message_reads").upsert(
        {
          message_id: messageId,
          user_id: userId,
          read_at: new Date().toISOString(),
        },
        {
          onConflict: "message_id,user_id",
        }
      );

      io.to(`chat-${chatRoomId}`).emit("message-read-by", {
        userId,
        messageId,
        timestamp: new Date().toISOString(),
      });

      await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("is_read", false)
        .or(
          `action_data->>chatRoomId.eq.${chatRoomId},chat_room_id.eq.${chatRoomId}`
        );
    }

    res.json({
      success: true,
      data: {
        message: "메시지가 읽음 처리되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("메시지 읽음 처리 실패:", error);

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
