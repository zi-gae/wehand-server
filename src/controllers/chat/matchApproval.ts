import { Response } from "express";
import { io } from "../../app";
import { logger } from "../../config/logger";
import { supabase } from "../../lib/supabase";
import { createChatMessageNotifications } from "../../services/chatNotificationService";
import { AuthRequest } from "../../types/auth";
import { ApiError } from "../../utils/errors";

export const approveMatchParticipant = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { chatRoomId } = req.params;
    const currentUserId = req.userId!;

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

    const isHost = match.host_id === currentUserId;
    const participantUserId = isHost ? otherUserId : currentUserId;
    const hostUserId = isHost ? currentUserId : otherUserId;

    if (!isHost) {
      throw new ApiError(
        403,
        "매치 호스트만 참가자를 승인할 수 있습니다",
        "NOT_HOST"
      );
    }

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

    if (match.current_participants - 1 >= match.max_participants) {
      throw new ApiError(400, "매치 정원이 이미 마감되었습니다", "MATCH_FULL");
    }

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

    const { error: matchUpdateError } = await supabase
      .from("matches")
      .update({
        current_participants: match.current_participants + 1,
      })
      .eq("id", match.id);

    if (matchUpdateError) {
      throw new ApiError(500, "매치 정보 업데이트 실패", "MATCH_UPDATE_ERROR");
    }

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

    const { data: approvedUser } = await supabase
      .from("users")
      .select("nickname")
      .eq("id", participantUserId)
      .single();

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

export const cancelMatchApproval = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const currentUserId = req.userId!;

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

    if (match.host_id !== currentUserId) {
      throw new ApiError(
        403,
        "매치 호스트만 참가 확정을 취소할 수 있습니다",
        "NOT_HOST"
      );
    }

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

    const { error: matchUpdateError } = await supabase
      .from("matches")
      .update({
        current_participants: Math.max(0, match.current_participants - 1),
      })
      .eq("id", match.id);

    if (matchUpdateError) {
      throw new ApiError(500, "매치 정보 업데이트 실패", "MATCH_UPDATE_ERROR");
    }

    const { data: cancelledUser } = await supabase
      .from("users")
      .select("nickname")
      .eq("id", participantUserId)
      .single();

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
