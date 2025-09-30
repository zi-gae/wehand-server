import { Response } from "express";
import { io } from "../../app";
import { logger } from "../../config/logger";
import { supabase } from "../../lib/supabase";
import { AuthRequest } from "../../types/auth";
import { ApiError } from "../../utils/errors";

export const joinChatRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    const { data: chatRoom } = await supabase
      .from("chat_rooms")
      .select("id, type, max_participants, current_participants")
      .eq("id", chatRoomId)
      .single();

    if (!chatRoom) {
      throw new ApiError(
        404,
        "채팅방을 찾을 수 없습니다",
        "CHATROOM_NOT_FOUND"
      );
    }

    const { data: existingParticipation } = await supabase
      .from("chat_participants")
      .select("id, is_active")
      .eq("room_id", chatRoomId)
      .eq("user_id", userId)
      .single();

    if (existingParticipation) {
      if (existingParticipation.is_active) {
        throw new ApiError(
          400,
          "이미 채팅방에 참가중입니다",
          "ALREADY_PARTICIPANT"
        );
      }

      const { error } = await supabase
        .from("chat_participants")
        .update({
          is_active: true,
          joined_at: new Date().toISOString(),
        })
        .eq("id", existingParticipation.id);

      if (error) {
        throw new ApiError(500, "채팅방 참가 실패", "DATABASE_ERROR");
      }
    } else {
      if (chatRoom.current_participants >= chatRoom.max_participants) {
        throw new ApiError(400, "채팅방 정원이 초과되었습니다", "ROOM_FULL");
      }

      const { error } = await supabase.from("chat_participants").insert({
        room_id: chatRoomId,
        user_id: userId,
        role: "member",
        is_active: true,
      });

      if (error) {
        throw new ApiError(500, "채팅방 참가 실패", "DATABASE_ERROR");
      }

      await supabase
        .from("chat_rooms")
        .update({
          current_participants: chatRoom.current_participants + 1,
        })
        .eq("id", chatRoomId);
    }

    const { data: user } = await supabase
      .from("users")
      .select("nickname")
      .eq("id", userId)
      .single();

    const { data: systemMessage } = await supabase
      .from("messages")
      .insert({
        room_id: chatRoomId,
        sender_id: null,
        content: `${user?.nickname || "사용자"}님이 채팅방에 참가했습니다.`,
        message_type: "system",
        system_event: "user_joined",
      })
      .select("id, content, message_type, created_at")
      .single();

    io.to(`chat-${chatRoomId}`).emit("user-joined", {
      userId,
      nickname: user?.nickname,
      timestamp: new Date().toISOString(),
    });

    if (systemMessage) {
      io.to(`chat-${chatRoomId}`).emit("new-message", {
        id: systemMessage.id,
        content: systemMessage.content,
        messageType: systemMessage.message_type,
        sender: null,
        timestamp: systemMessage.created_at,
        chatRoomId: chatRoomId,
      });
    }

    res.json({
      success: true,
      data: {
        message: "채팅방에 참가했습니다",
      },
    });
  } catch (error: any) {
    logger.error("채팅방 참가 실패:", error);

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

export const leaveChatRoom = async (req: AuthRequest, res: Response) => {
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
      throw new ApiError(
        403,
        "채팅방에 참가하지 않았습니다",
        "NOT_PARTICIPANT"
      );
    }

    const { error } = await supabase
      .from("chat_participants")
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
      })
      .eq("room_id", chatRoomId)
      .eq("user_id", userId);

    if (error) {
      throw new ApiError(500, "채팅방 나가기 실패", "DATABASE_ERROR");
    }

    const { data: user } = await supabase
      .from("users")
      .select("nickname")
      .eq("id", userId)
      .single();

    const { data: systemMessage } = await supabase
      .from("messages")
      .insert({
        room_id: chatRoomId,
        sender_id: null,
        content: `${user?.nickname || "사용자"}님이 채팅방을 나갔습니다.`,
        message_type: "system",
      })
      .select("id, content, message_type, created_at")
      .single();

    io.to(`chat-${chatRoomId}`).emit("user-left", {
      userId,
      nickname: user?.nickname,
      timestamp: new Date().toISOString(),
    });

    if (systemMessage) {
      io.to(`chat-${chatRoomId}`).emit("new-message", {
        id: systemMessage.id,
        content: systemMessage.content,
        messageType: systemMessage.message_type,
        sender: null,
        timestamp: systemMessage.created_at,
        chatRoomId: chatRoomId,
      });
    }

    res.json({
      success: true,
      data: {
        message: "채팅방을 나갔습니다",
      },
    });
  } catch (error: any) {
    logger.error("채팅방 나가기 실패:", error);

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
