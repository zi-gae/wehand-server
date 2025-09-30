import { Response } from "express";
import { z } from "zod";
import { io } from "../app";
import { logger } from "../config/logger";
import { supabase } from "../lib/supabase";
import { createChatMessageNotifications } from "../services/chatNotificationService";
import { AuthRequest } from "../types/auth";
import { ApiError } from "../utils/errors";
import { safeJsonParse } from "../utils/safeJsonParse";
import { snakeToCamel } from "../utils/snakeToCamel";
import { KeysToCamelCase } from "../utils/types";

// Validation schemas
const sendMessageSchema = z.object({
  content: z.string().min(1).max(1000),
  message_type: z.enum(["text", "image", "system"]).default("text"),
});

const createChatRoomSchema = z.object({
  type: z.enum(["private", "match"]),
  participant_ids: z.array(z.string().uuid()).min(1).optional(),
  match_id: z.string().uuid().optional(),
  name: z.string().max(100).optional(),
});

// 채팅방 목록 조회
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

    // 각 채팅방의 상세 정보를 별도로 조회
    const processedRooms = await Promise.all(
      (chatRooms || []).map(async (participant: any) => {
        // last_read_message_id가 null인 경우 제외

        // 채팅방 기본 정보 조회
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

        // 매치 정보 조회 (매치 채팅방인 경우)
        let matchInfo = null;
        let hostInfo = null;
        if (room.match_id) {
          const { data: match } = await supabase
            .from("matches")
            .select("id, title, match_date, host_id")
            .eq("id", room.match_id)
            .single();
          matchInfo = match;

          // 호스트 정보 조회
          if (match?.host_id) {
            const { data: host } = await supabase
              .from("users")
              .select("id, nickname, profile_image_url")
              .eq("id", match.host_id)
              .single();
            hostInfo = host;
          }
        }

        // 최신 메시지 조회
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

        // 발신자 정보 조회 (메시지가 있는 경우)
        let senderInfo = null;
        if (lastMessage?.sender_id) {
          const { data: sender } = await supabase
            .from("users")
            .select("id, nickname, profile_image_url")
            .eq("id", lastMessage.sender_id)
            .single();
          senderInfo = sender;
        }

        // 1:1 채팅의 경우 상대방 정보 조회
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

        // notifications 테이블에서 읽지 않은 알림 수 계산
        // action_data의 chatRoomId를 올바르게 조회
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
          host: { ...hostInfo, profileImageUrl: hostInfo?.profile_image_url }, // 호스트 정보 추가
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

    // null 값 필터링 및 lastMessage가 없는 채팅방 제거 후 최신순 정렬
    const validRooms = processedRooms
      .filter((room) => room !== null && room?.lastMessage !== null)
      .sort((a, b) => {
        // 마지막 메시지가 있는 경우 해당 시간 기준으로 정렬
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

// 채팅방 생성
export const createChatRoom = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const validation = createChatRoomSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ApiError(400, "입력값이 올바르지 않습니다", "VALIDATION_ERROR");
    }

    const { type, participant_ids, match_id, name } = validation.data;

    // 매치 채팅방의 경우 중복 생성 방지
    if (type === "match" && match_id) {
      const { data: existingRoom } = await supabase
        .from("chat_rooms")
        .select("id")
        .eq("type", "match")
        .eq("match_id", match_id)
        .single();

      if (existingRoom) {
        // 기존 채팅방에 사용자 추가 (참가하지 않은 경우)
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

    // 1:1 채팅방의 경우 기존 채팅방 확인
    if (type === "private" && participant_ids && participant_ids.length === 1) {
      const otherUserId = participant_ids[0];

      // 기존 1:1 채팅방 찾기
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

    // 새 채팅방 생성
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

    // 참가자 추가
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
      // 채팅방 삭제 후 에러 반환
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

// 채팅방 상세 정보 조회
export const getChatRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    // 채팅방 참가 여부 확인
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

    // 해당 채팅방과 관련된 읽지 않은 알림들을 읽음 처리
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

    // 채팅방 정보 조회
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

    // 매치 정보 조회 (매치 채팅방인 경우)
    let matchInfo = null;
    let hostInfo = null;
    if (chatRoom.match_id) {
      const { data: match } = await supabase
        .from("matches")
        .select("id, title, match_date, host_id")
        .eq("id", chatRoom.match_id)
        .single();

      matchInfo = match;

      // 호스트 정보 조회
      if (match?.host_id) {
        const { data: host } = await supabase
          .from("users")
          .select("id, nickname, profile_image_url")
          .eq("id", match.host_id)
          .single();
        hostInfo = host;
      }
    }

    // 참가자 목록 조회
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

export const getAllMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    // 채팅방 참가 여부 확인
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

    // 해당 채팅방과 관련된 읽지 않은 알림들을 읽음 처리
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

    // 모든 메시지 조회
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

// 메시지 목록 조회
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;
    const {
      page = "1",
      limit = "50",
      before, // 특정 메시지 ID 이전 메시지 조회 (무한 스크롤용)
    } = req.query;

    // 채팅방 참가 여부 확인
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

    // 해당 채팅방과 관련된 읽지 않은 알림들을 읽음 처리
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

    // 특정 메시지 이전 메시지 조회 (무한 스크롤)
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

    // 메시지를 시간순으로 정렬 (오래된 것부터)

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

// 메시지 전송
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    const validation = sendMessageSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ApiError(400, "입력값이 올바르지 않습니다", "VALIDATION_ERROR");
    }

    // 채팅방 참가 여부 확인
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

    // system 메시지에서 metadata 파싱
    let metadata = null;
    if (message_type === "system" && content.startsWith("{")) {
      try {
        metadata = JSON.parse(content);
      } catch (e) {
        // JSON이 아닌 경우 그대로 처리
      }
    }

    // 메시지 전송
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

    // 채팅방 업데이트 시간 갱신
    await supabase
      .from("chat_rooms")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chatRoomId);

    // 메시지 알림 생성 (system 포함)
    if (message) {
      let senderNickname = "알 수 없음";
      let notificationContent = message.content;

      if (message.message_type === "system") {
        senderNickname = "SYSTEM";

        // system 메시지의 경우 metadata에서 사용자 친화적인 메시지 생성
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
              // metadata에서 메시지 추출 시도
              notificationContent =
                metadata.message || metadata.text || "시스템 메시지";
          }
        } else {
          // metadata가 없는 경우 content에서 JSON 파싱 시도
          try {
            if (message.content.startsWith("{")) {
              const contentObj = JSON.parse(message.content);
              notificationContent =
                contentObj.message || contentObj.text || "시스템 메시지";
            }
          } catch (e) {
            // JSON 파싱 실패 시 원본 content 사용
            notificationContent = message.content;
          }
        }
      } else {
        // 일반 메시지인 경우
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

    // 읽지 않은 메시지는 last_read_message_id 기반으로 계산됩니다
    // (chat_participants 테이블의 last_read_message_id 컬럼 활용)
    const roomName = `chat-${chatRoomId}`;
    const subscribers = io.sockets.adapter.rooms.get(roomName)?.size ?? 0;
    logger.info(
      `emit new-message to ${roomName} (subscribers: ${subscribers})`
    );
    // 실시간 메시지 전송 (Socket.io)
    io.to(`chat-${chatRoomId}`).emit("new-message", {
      id: message.id,
      content: message.content,
      messageType: message.message_type,
      metadata: message.metadata,
      sender: message.sender,
      timestamp: message.created_at,
      chatRoomId: chatRoomId,
    });

    // 채팅방 목록 업데이트 이벤트 전송
    // 채팅방에 참여한 모든 사용자들의 ID 조회
    const { data: participants } = await supabase
      .from("chat_participants")
      .select("user_id")
      .eq("room_id", chatRoomId)
      .eq("is_active", true);

    if (participants && participants.length > 0) {
      // 각 참가자에게 채팅방 업데이트 이벤트 전송
      participants.forEach((participant) => {
        // 사용자별 개인 채널로 전송 (채팅방 목록 페이지에서 받을 수 있도록)
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

// 메시지 읽음 처리
export const markMessagesAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;
    const { messageId } = req.body;

    // 채팅방 참가 여부 확인 (chat_participants 테이블 사용)
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

    // messageId가 제공된 경우 last_read_message_id 업데이트
    if (messageId) {
      // 메시지가 해당 채팅방의 메시지인지 확인
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

      // last_read_message_id 업데이트
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

      // 메시지 읽음 기록 추가
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

      // 실시간 읽음 상태 브로드캐스트
      io.to(`chat-${chatRoomId}`).emit("message-read-by", {
        userId,
        messageId,
        timestamp: new Date().toISOString(),
      });

      // 해당 부분을 다음과 같이 수정
      // 현재 코드를 다음과 같이 수정해보세요
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

// 채팅방 참가
export const joinChatRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    // 채팅방 존재 여부 확인
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

    // 이미 참가한 상태인지 확인
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

      // 비활성 상태인 경우 다시 활성화
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
      // 정원 확인
      if (chatRoom.current_participants >= chatRoom.max_participants) {
        throw new ApiError(400, "채팅방 정원이 초과되었습니다", "ROOM_FULL");
      }

      // 새로운 참가자 추가
      const { error } = await supabase.from("chat_participants").insert({
        room_id: chatRoomId,
        user_id: userId,
        role: "member",
        is_active: true,
      });

      if (error) {
        throw new ApiError(500, "채팅방 참가 실패", "DATABASE_ERROR");
      }

      // 현재 참가자 수 업데이트
      await supabase
        .from("chat_rooms")
        .update({
          current_participants: chatRoom.current_participants + 1,
        })
        .eq("id", chatRoomId);
    }

    // 참가 시스템 메시지 전송 및 브로드캐스트
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

    // 실시간 입장 알림 및 시스템 메시지 브로드캐스트
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

// 채팅방 삭제
export const deleteChatRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    // 채팅방 정보 조회
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

    // 매치 채팅방인 경우 호스트 권한 확인
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
      // 1:1 채팅방인 경우 참가자 권한 확인
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

    // 채팅방 삭제 시스템 메시지 전송
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

    // 실시간 삭제 알림 브로드캐스트
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

    // 모든 참가자 비활성화
    await supabase
      .from("chat_participants")
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
      })
      .eq("room_id", chatRoomId);

    // 채팅방 soft delete (실제로는 비활성화)
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

// 채팅방 나가기
export const leaveChatRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    // 채팅방 참가 여부 확인
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

    // 참가자 비활성화 (삭제 대신 is_active를 false로)
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

    // 나가기 시스템 메시지 전송 및 브로드캐스트
    const { data: user } = await supabase
      .from("users")
      .select("nickname")
      .eq("id", userId)
      .single();

    const { data: systemMessage } = await supabase
      .from("messages")
      .insert({
        room_id: chatRoomId,
        sender_id: null, // 시스템 메시지
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

// 1:1 채팅방에서 매치 참가 확정 (채팅방 기반)
export const approveMatchParticipant = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { chatRoomId } = req.params;
    const currentUserId = req.userId!;

    // 채팅방 정보 및 매치 정보 조회
    const { data: chatRoom } = await supabase
      .from("chat_rooms")
      .select(
        `
        id, type, match_id,
        matches!inner(id, host_id, max_participants, current_participants)
      `
      )
      .eq("id", chatRoomId)
      .single();

    if (!chatRoom) {
      throw new ApiError(
        404,
        "채팅방을 찾을 수 없습니다",
        "CHATROOM_NOT_FOUND"
      );
    }

    // 1:1 채팅방이 아닌 경우 에러
    if (chatRoom.type !== "private") {
      throw new ApiError(
        400,
        "1:1 채팅방에서만 확정 처리가 가능합니다",
        "INVALID_CHATROOM_TYPE"
      );
    }

    if (!chatRoom.matches) {
      throw new ApiError(
        404,
        "매치 정보를 찾을 수 없습니다",
        "MATCH_NOT_FOUND"
      );
    }

    const match = Array.isArray(chatRoom.matches)
      ? chatRoom.matches[0]
      : chatRoom.matches;

    // 채팅방 참가자 조회 (나와 상대방)
    const { data: participants } = await supabase
      .from("chat_participants")
      .select("user_id")
      .eq("room_id", chatRoomId)
      .eq("is_active", true);

    if (!participants || participants.length !== 2) {
      throw new ApiError(
        400,
        "올바른 1:1 채팅방이 아닙니다",
        "INVALID_PARTICIPANTS"
      );
    }

    // 상대방 ID 찾기
    const otherUserId = participants.find(
      (p) => p.user_id !== currentUserId
    )?.user_id;
    if (!otherUserId) {
      throw new ApiError(
        400,
        "상대방을 찾을 수 없습니다",
        "OTHER_USER_NOT_FOUND"
      );
    }

    // 호스트와 참가자 구분
    const isHost = match.host_id === currentUserId;
    const participantUserId = isHost ? otherUserId : currentUserId;
    const hostUserId = isHost ? currentUserId : otherUserId;

    // 호스트만 승인 가능
    if (!isHost) {
      throw new ApiError(
        403,
        "매치 호스트만 참가자를 승인할 수 있습니다",
        "NOT_HOST"
      );
    }

    // 참가자 신청 상태 확인
    const { data: participation } = await supabase
      .from("match_participants")
      .select("id, status")
      .eq("match_id", match.id)
      .eq("user_id", participantUserId)
      .maybeSingle();

    if (!participation) {
      throw new ApiError(
        404,
        "참가 신청을 찾을 수 없습니다",
        "PARTICIPATION_NOT_FOUND"
      );
    }

    if (participation.status !== "pending") {
      throw new ApiError(
        400,
        "대기 중인 참가 신청만 승인할 수 있습니다",
        "INVALID_STATUS"
      );
    }

    // 매치 정원 확인
    if (match.current_participants - 1 >= match.max_participants) {
      throw new ApiError(400, "매치 정원이 이미 마감되었습니다", "MATCH_FULL");
    }

    // 참가 승인 처리
    const { error: approvalError } = await supabase
      .from("match_participants")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", participation.id);

    if (approvalError) {
      throw new ApiError(500, "참가 승인 처리 실패", "APPROVAL_ERROR");
    }

    // 매치 참가자 수 업데이트
    const { error: matchUpdateError } = await supabase
      .from("matches")
      .update({
        current_participants: match.current_participants + 1,
      })
      .eq("id", match.id);

    if (matchUpdateError) {
      throw new ApiError(500, "매치 정보 업데이트 실패", "MATCH_UPDATE_ERROR");
    }

    // 승인된 참가자를 채팅방에 추가
    const { data: existingChatParticipant } = await supabase
      .from("chat_participants")
      .select("id")
      .eq("room_id", chatRoomId)
      .eq("user_id", participantUserId)
      .single();

    if (!existingChatParticipant) {
      await supabase.from("chat_participants").insert({
        room_id: chatRoomId,
        user_id: participantUserId,
        role: "member",
      });
    }

    // 승인 시스템 메시지 전송 및 브로드캐스트
    const { data: approvedUser } = await supabase
      .from("users")
      .select("nickname")
      .eq("id", participantUserId)
      .single();

    // 확정 완료 메시지 전송
    const approvalMetadata = {
      type: "approval_confirm",
      participantId: participantUserId,
      participantName: approvedUser?.nickname || "사용자",
    };

    const { data: systemMessage } = await supabase
      .from("messages")
      .insert({
        room_id: chatRoomId,
        sender_id: null,
        content: JSON.stringify(approvalMetadata),
        message_type: "system",
        metadata: approvalMetadata,
      })
      .select("id, content, message_type, metadata, created_at")
      .single();

    // 실시간 알림 (Socket.io)
    io.to(`chat-${chatRoomId}`).emit("participant-approved", {
      participantId: participantUserId,
      participantName: approvedUser?.nickname,
      matchId: match.id,
    });

    if (systemMessage) {
      io.to(`chat-${chatRoomId}`).emit("new-message", {
        id: systemMessage.id,
        content: systemMessage.content,
        messageType: systemMessage.message_type,
        metadata: systemMessage.metadata,
        sender: null,
        timestamp: systemMessage.created_at,
        chatRoomId: chatRoomId,
      });
    }

    // 매치 참가 확정 알림 생성
    createChatMessageNotifications({
      chatRoomId,
      senderId: null,
      title: "매치 참가 확정",
      messageId: systemMessage?.id || "",
      content: `${
        approvedUser?.nickname || "사용자"
      }님의 매치 참가가 확정되었습니다.`,
      type: "match_approval_confirm",
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        message: "참가자가 승인되었습니다",
        participantId: participantUserId,
        matchId: match.id,
      },
    });
  } catch (error: any) {
    logger.error("참가자 승인 실패:", error);

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

// 매치 참가 확정 취소 (호스트 전용, 채팅방 기반)
export const cancelMatchApproval = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const currentUserId = req.userId!;

    // 채팅방 정보 및 매치 정보 조회
    const { data: chatRoom } = await supabase
      .from("chat_rooms")
      .select(
        `
        id, type, match_id,
        matches!inner(id, host_id, max_participants, current_participants)
      `
      )
      .eq("id", chatRoomId)
      .single();

    if (!chatRoom) {
      throw new ApiError(
        404,
        "채팅방을 찾을 수 없습니다",
        "CHATROOM_NOT_FOUND"
      );
    }

    // 1:1 채팅방이 아닌 경우 에러
    if (chatRoom.type !== "private") {
      throw new ApiError(
        400,
        "1:1 채팅방에서만 확정 취소가 가능합니다",
        "INVALID_CHATROOM_TYPE"
      );
    }

    if (!chatRoom.matches) {
      throw new ApiError(
        404,
        "매치 정보를 찾을 수 없습니다",
        "MATCH_NOT_FOUND"
      );
    }

    const match = Array.isArray(chatRoom.matches)
      ? chatRoom.matches[0]
      : chatRoom.matches;

    // 호스트 권한 확인
    if (match.host_id !== currentUserId) {
      throw new ApiError(
        403,
        "매치 호스트만 참가 확정을 취소할 수 있습니다",
        "NOT_HOST"
      );
    }

    // 채팅방 참가자 조회 (나와 상대방)
    const { data: participants } = await supabase
      .from("chat_participants")
      .select("user_id")
      .eq("room_id", chatRoomId)
      .eq("is_active", true);

    if (!participants || participants.length !== 2) {
      throw new ApiError(
        400,
        "올바른 1:1 채팅방이 아닙니다",
        "INVALID_PARTICIPANTS"
      );
    }

    // 상대방 ID 찾기
    const participantUserId = participants.find(
      (p) => p.user_id !== currentUserId
    )?.user_id;
    if (!participantUserId) {
      throw new ApiError(
        400,
        "상대방을 찾을 수 없습니다",
        "OTHER_USER_NOT_FOUND"
      );
    }

    // 참가자 상태 확인
    const { data: participation } = await supabase
      .from("match_participants")
      .select("id, status")
      .eq("match_id", match.id)
      .eq("user_id", participantUserId)
      .single();

    if (!participation) {
      throw new ApiError(
        404,
        "참가 신청을 찾을 수 없습니다",
        "PARTICIPATION_NOT_FOUND"
      );
    }

    if (participation.status !== "confirmed") {
      throw new ApiError(
        400,
        "확정된 참가 신청만 취소할 수 있습니다",
        "INVALID_STATUS"
      );
    }

    // 참가 취소 처리 (confirmed -> pending으로 변경)
    const { error: cancellationError } = await supabase
      .from("match_participants")
      .update({
        status: "pending",
        confirmed_at: null,
      })
      .eq("id", participation.id);

    if (cancellationError) {
      throw new ApiError(500, "참가 취소 처리 실패", "CANCELLATION_ERROR");
    }

    // 매치 참가자 수 업데이트
    const { error: matchUpdateError } = await supabase
      .from("matches")
      .update({
        current_participants: Math.max(0, match.current_participants - 1),
      })
      .eq("id", match.id);

    if (matchUpdateError) {
      throw new ApiError(500, "매치 정보 업데이트 실패", "MATCH_UPDATE_ERROR");
    }

    // 취소 시스템 메시지 전송 및 브로드캐스트
    const { data: cancelledUser } = await supabase
      .from("users")
      .select("nickname")
      .eq("id", participantUserId)
      .single();

    // 확정 취소 메시지 전송
    const cancellationMetadata = {
      type: "approval_cancel",
      participantId: participantUserId,
      participantName: cancelledUser?.nickname || "사용자",
    };

    const { data: systemMessage } = await supabase
      .from("messages")
      .insert({
        room_id: chatRoomId,
        sender_id: null,
        content: JSON.stringify(cancellationMetadata),
        message_type: "system",
        metadata: cancellationMetadata,
      })
      .select("id, content, message_type, metadata, created_at")
      .single();

    // 실시간 알림 (Socket.io)
    io.to(`chat-${chatRoomId}`).emit("participant-approval-cancelled", {
      participantId: participantUserId,
      participantName: cancelledUser?.nickname,
      matchId: match.id,
    });

    if (systemMessage) {
      io.to(`chat-${chatRoomId}`).emit("new-message", {
        id: systemMessage.id,
        content: systemMessage.content,
        messageType: systemMessage.message_type,
        metadata: systemMessage.metadata,
        sender: null,
        timestamp: systemMessage.created_at,
        chatRoomId: chatRoomId,
      });
    }

    // 매치 참가 확정 취소 알림 생성
    createChatMessageNotifications({
      chatRoomId,
      senderId: null,
      title: "매치 참가 확정 취소",
      messageId: systemMessage?.id || "",
      content: `${
        cancelledUser?.nickname || "사용자"
      }님의 매치 참가 확정이 취소되었습니다.`,
      type: "match_approval_cancel",
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        message: "참가 확정이 취소되었습니다",
        participantId: participantUserId,
        matchId: match.id,
      },
    });
  } catch (error: any) {
    logger.error("참가 확정 취소 실패:", error);

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

export const chatController = {
  getChatRooms,
  createChatRoom,
  getChatRoom,
  getMessages,
  getAllMessages,
  sendMessage,
  markMessagesAsRead,
  joinChatRoom,
  leaveChatRoom,
  approveMatchParticipant,
  cancelMatchApproval,
  deleteChatRoom,
};
