import { Response } from "express";
import { io } from "../../app";
import { logger } from "../../config/logger";
import { supabase } from "../../lib/supabase";
import { AuthRequest } from "../../types/auth";
import { ApiError } from "../../utils/errors";
import { safeJsonParse } from "../../utils/safeJsonParse";
import { snakeToCamel } from "../../utils/snakeToCamel";
import { KeysToCamelCase } from "../../utils/types";
import { createChatRoomSchema } from "./schemas";

export const getChatRooms = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { page = "1", limit = "20" } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const {
      data: chatRooms,
      error,
      count,
    } = await supabase
      .from("chat_participants")
      .select(
        `
        room_id,
        last_read_message_id
      `,
        { count: "exact" }
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      throw new ApiError(500, "채팅방 목록 조회 실패", "DATABASE_ERROR");
    }

    const processedRooms = await Promise.all(
      (chatRooms || []).map(async (participant: any) => {
        const { data: room } = await supabase
          .from("chat_rooms")
          .select(
            `
            id,
            name,
            type,
            created_at,
            updated_at,
            match_id
          `
          )
          .eq("id", participant.room_id)
          .single();

        if (!room) return null;

        let matchInfo = null;
        let hostInfo = null;
        if (room.match_id) {
          const { data: match } = await supabase
            .from("matches")
            .select("id, title, match_date, host_id")
            .eq("id", room.match_id)
            .single();
          matchInfo = match;

          if (match?.host_id) {
            const { data: host } = await supabase
              .from("users")
              .select("id, nickname, profile_image_url")
              .eq("id", match.host_id)
              .single();
            hostInfo = host;
          }
        }

        const { data: lastMessage } = await supabase
          .from("messages")
          .select(
            `
            id,
            content,
            message_type,
            created_at,
            sender_id
          `
          )
          .eq("room_id", room.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        let senderInfo = null;
        if (lastMessage?.sender_id) {
          const { data: sender } = await supabase
            .from("users")
            .select("id, nickname, profile_image_url")
            .eq("id", lastMessage.sender_id)
            .single();
          senderInfo = sender;
        }

        let otherParticipant = null;
        if (room.type === "private") {
          const { data: participants } = await supabase
            .from("chat_participants")
            .select("user_id")
            .eq("room_id", room.id)
            .eq("is_active", true)
            .neq("user_id", userId);

          if (participants && participants.length > 0) {
            const { data: user } = await supabase
              .from("users")
              .select("id, nickname, profile_image_url")
              .eq("id", participants[0].user_id)
              .single();
            otherParticipant = user;
          }
        }

        const { count: unreadCount } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false)
          .eq("type", "chat")
          .eq("action_data->>chatRoomId", room.id);

        return {
          id: room.id,
          name:
            room.type === "private" ? otherParticipant?.nickname : room.name,
          type: room.type,
          match: matchInfo,
          host: { ...hostInfo, profileImageUrl: hostInfo?.profile_image_url },
          otherParticipant: {
            ...otherParticipant,
            profileImageUrl: otherParticipant?.profile_image_url,
          },
          lastMessage: lastMessage
            ? {
                ...lastMessage,
                messageType: lastMessage.message_type,
                senderId: lastMessage.sender_id,
                content: safeJsonParse(lastMessage.content),
                sender: senderInfo,
              }
            : null,
          unreadCount: unreadCount || 0,
          updatedAt: room.updated_at,
        };
      })
    );

    const validRooms = processedRooms
      .filter((room) => room !== null && room?.lastMessage !== null)
      .sort((a, b) => {
        const timeA =
          a?.lastMessage?.created_at || a?.updatedAt || "1970-01-01";
        const timeB =
          b?.lastMessage?.created_at || b?.updatedAt || "1970-01-01";
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

    const totalPages = Math.ceil((count || 0) / Number(limit));

    const data = snakeToCamel<KeysToCamelCase<typeof validRooms>>(validRooms);

    res.json({
      success: true,
      data: data,
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
    logger.error("채팅방 목록 조회 실패:", error);

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

export const createChatRoom = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const validation = createChatRoomSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ApiError(400, "입력값이 올바르지 않습니다", "VALIDATION_ERROR");
    }

    const { type, participant_ids, match_id, name } = validation.data;

    if (type === "match" && match_id) {
      const { data: existingRoom } = await supabase
        .from("chat_rooms")
        .select("id")
        .eq("type", "match")
        .eq("match_id", match_id)
        .single();

      if (existingRoom) {
        const { data: participation } = await supabase
          .from("chat_participants")
          .select("id")
          .eq("room_id", existingRoom.id)
          .eq("user_id", userId)
          .eq("is_active", true)
          .single();

        if (!participation) {
          await supabase.from("chat_participants").insert({
            room_id: existingRoom.id,
            user_id: userId,
            is_active: true,
          });
        }

        return res.json({
          success: true,
          data: {
            id: existingRoom.id,
            message: "채팅방에 참가했습니다",
          },
        });
      }
    }

    if (type === "private" && participant_ids && participant_ids.length === 1) {
      const otherUserId = participant_ids[0];

      const { data: existingDirectRoom } = await supabase.rpc(
        "find_direct_chat_room",
        {
          user1_id: userId,
          user2_id: otherUserId,
        }
      );

      if (existingDirectRoom && existingDirectRoom.length > 0) {
        return res.json({
          success: true,
          data: {
            id: existingDirectRoom[0].id,
            message: "기존 채팅방으로 연결되었습니다",
          },
        });
      }
    }

    const { data: chatRoom, error } = await supabase
      .from("chat_rooms")
      .insert({
        type,
        name: name || null,
        match_id: match_id || null,
      })
      .select("id")
      .single();

    if (error) {
      throw new ApiError(500, "채팅방 생성 실패", "DATABASE_ERROR");
    }

    const participantsToAdd = [userId];
    if (participant_ids) {
      participantsToAdd.push(...participant_ids);
    }

    const participantInserts = participantsToAdd.map((participantId) => ({
      room_id: chatRoom.id,
      user_id: participantId,
      is_active: true,
    }));

    const { error: participantError } = await supabase
      .from("chat_participants")
      .insert(participantInserts);

    if (participantError) {
      await supabase.from("chat_rooms").delete().eq("id", chatRoom.id);

      throw new ApiError(500, "채팅방 참가자 추가 실패", "DATABASE_ERROR");
    }

    res.status(201).json({
      success: true,
      data: {
        id: chatRoom.id,
        message: "채팅방이 생성되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("채팅방 생성 실패:", error);

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

export const getChatRoom = async (req: AuthRequest, res: Response) => {
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

    const { data: chatRoom, error } = await supabase
      .from("chat_rooms")
      .select(
        `
        id,
        name,
        type,
        created_at,
        match_id
      `
      )
      .eq("id", chatRoomId)
      .single();

    if (error || !chatRoom) {
      throw new ApiError(
        404,
        "채팅방을 찾을 수 없습니다",
        "CHATROOM_NOT_FOUND"
      );
    }

    let matchInfo = null;
    let hostInfo = null;
    if (chatRoom.match_id) {
      const { data: match } = await supabase
        .from("matches")
        .select("id, title, match_date, host_id")
        .eq("id", chatRoom.match_id)
        .single();

      matchInfo = match;

      if (match?.host_id) {
        const { data: host } = await supabase
          .from("users")
          .select("id, nickname, profile_image_url")
          .eq("id", match.host_id)
          .single();
        hostInfo = host;
      }
    }

    const { data: participants } = await supabase
      .from("chat_participants")
      .select(
        `
        user:user_id(
          id,
          nickname,
          profile_image_url
        ),
        joined_at,
        role
      `
      )
      .eq("room_id", chatRoomId)
      .eq("is_active", true)
      .order("joined_at", { ascending: true });

    const responseData = {
      ...chatRoom,
      match: matchInfo,
      host: hostInfo,
      participants: participants || [],
    };

    const data =
      snakeToCamel<KeysToCamelCase<typeof responseData>>(responseData);

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    logger.error("채팅방 정보 조회 실패:", error);

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

export const deleteChatRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    const { data: chatRoom, error: roomError } = await supabase
      .from("chat_rooms")
      .select("id, type, match_id")
      .eq("id", chatRoomId)
      .single();

    if (roomError || !chatRoom) {
      throw new ApiError(
        404,
        "채팅방을 찾을 수 없습니다",
        "CHATROOM_NOT_FOUND"
      );
    }

    if (chatRoom.type === "match" && chatRoom.match_id) {
      const { data: match } = await supabase
        .from("matches")
        .select("host_id")
        .eq("id", chatRoom.match_id)
        .single();

      if (!match || match.host_id !== userId) {
        throw new ApiError(
          403,
          "매치 호스트만 채팅방을 삭제할 수 있습니다",
          "NOT_HOST"
        );
      }
    } else if (chatRoom.type === "private") {
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
          "채팅방 참가자만 삭제할 수 있습니다",
          "NOT_PARTICIPANT"
        );
      }
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
        content: `${user?.nickname || "사용자"}님이 채팅방을 삭제했습니다.`,
        message_type: "system",
      })
      .select("id, content, message_type, created_at")
      .single();

    io.to(`chat-${chatRoomId}`).emit("chatroom-deleted", {
      chatRoomId,
      deletedBy: userId,
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

    await supabase
      .from("chat_participants")
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
      })
      .eq("room_id", chatRoomId);

    const { error: deleteError } = await supabase
      .from("chat_rooms")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatRoomId);

    if (deleteError) {
      throw new ApiError(500, "채팅방 삭제 실패", "DATABASE_ERROR");
    }

    res.json({
      success: true,
      data: {
        message: "채팅방이 삭제되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("채팅방 삭제 실패:", error);

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
