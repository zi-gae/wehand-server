import { Request, Response } from "express";
import { supabase } from "../../lib/supabase";
import { ResponseHelper } from "../../utils/response";
import { ApiError, asyncHandler } from "../../middleware/errorHandler";
import { uuidSchema } from "../../utils/validation";
import { logger } from "../../config/logger";

// 3.4 매치 단체 채팅방 생성 또는 참가
export const createMatchChat = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
  }

  const matchId = uuidSchema.parse(req.params.matchId);
  const userId = req.user.id;

  // 매치 존재 확인
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, host_id, title")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new ApiError(404, "매치를 찾을 수 없습니다", "MATCH_NOT_FOUND");
  }

  // 기존 채팅방 확인
  const { data: existingChat } = await supabase
    .from("chat_rooms")
    .select("id, name, type, match_id")
    .eq("match_id", matchId)
    .eq("type", "match")
    .single();

  if (existingChat) {
    // 이미 채팅방이 존재하는 경우, 사용자가 참가자인지 확인
    const { data: existingParticipation } = await supabase
      .from("chat_participants")
      .select("id")
      .eq("room_id", existingChat.id)
      .eq("user_id", userId)
      .single();

    if (!existingParticipation) {
      // 참가자가 아니면 추가
      await supabase.from("chat_participants").insert({
        room_id: existingChat.id,
        user_id: userId,
        role: "member",
      });
    }

    return ResponseHelper.success(res, {
      chatRoomId: existingChat.id,
      success: true,
      message: "채팅방에 참가했습니다",
      chatRoom: {
        id: existingChat.id,
        name: existingChat.name,
        type: existingChat.type,
        matchId: existingChat.match_id,
      },
    });
  }

  // 채팅방이 없는 경우 새로 생성
  const { data: chatRoom, error: chatError } = await supabase
    .from("chat_rooms")
    .insert({
      name: `🎾 ${match.title} 채팅방`,
      type: "match",
      match_id: matchId,
    })
    .select("id, name, type, match_id")
    .single();

  if (chatError) {
    logger.error("Chat room creation error:", chatError);
    throw new ApiError(
      500,
      "채팅방 생성 중 오류가 발생했습니다",
      "CHAT_CREATION_ERROR"
    );
  }

  // 채팅방 생성자를 member로 추가
  await supabase.from("chat_participants").insert({
    room_id: chatRoom.id,
    user_id: userId,
    role: "member",
  });

  // 매치 호스트를 채팅방에 admin으로 추가 (생성자가 호스트가 아닌 경우)
  if (match.host_id !== userId) {
    await supabase.from("chat_participants").insert({
      room_id: chatRoom.id,
      user_id: match.host_id,
      role: "admin",
    });
  } else {
    // 호스트가 생성한 경우 admin 권한 부여
    await supabase
      .from("chat_participants")
      .update({ role: "admin" })
      .eq("room_id", chatRoom.id)
      .eq("user_id", userId);
  }

  // 확정된 모든 참가자들을 채팅방에 추가
  const { data: confirmedParticipants } = await supabase
    .from("match_participants")
    .select("user_id")
    .eq("match_id", matchId)
    .eq("status", "confirmed")
    .neq("is_host", true); // 호스트 제외 (이미 추가됨)

  if (confirmedParticipants && confirmedParticipants.length > 0) {
    const participantsToAdd = confirmedParticipants
      .filter((p) => p.user_id !== userId) // 생성자 제외 (이미 추가됨)
      .map((p) => ({
        room_id: chatRoom.id,
        user_id: p.user_id,
        role: "member",
      }));

    if (participantsToAdd.length > 0) {
      const { error: participantsError } = await supabase
        .from("chat_participants")
        .insert(participantsToAdd);

      if (participantsError) {
        logger.error(
          "Failed to add confirmed participants to chat:",
          participantsError
        );
        // 에러가 발생해도 채팅방 생성 자체는 성공으로 처리
      }
    }
  }

  logger.info("Match chat created:", { chatRoomId: chatRoom.id, matchId });

  return ResponseHelper.success(res, {
    chatRoomId: chatRoom.id,
    success: true,
    message: "채팅방이 생성되었습니다",
    chatRoom: {
      id: chatRoom.id,
      name: chatRoom.name,
      type: chatRoom.type,
      matchId: chatRoom.match_id,
      participants: match.host_id === userId ? 1 : 2,
    },
  });
});

// 3.5 매치 호스트와 1:1 채팅방 생성
export const createPrivateChat = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
  }

  const matchId = uuidSchema.parse(req.params.matchId);
  const userId = req.user.id;

  // 매치 정보 조회
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, host_id, title")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new ApiError(404, "매치를 찾을 수 없습니다", "MATCH_NOT_FOUND");
  }

  // 자기 자신과는 채팅방 생성 불가
  if (match.host_id === userId) {
    throw new ApiError(
      400,
      "자신과는 채팅방을 생성할 수 없습니다",
      "CANNOT_CHAT_WITH_SELF"
    );
  }

  // 기존 1:1 채팅방 확인 (같은 매치에 대한 채팅방만)
  const { data: existingChats } = await supabase
    .from("chat_rooms")
    .select(
      `
        id,
        name,
        type,
        match_id,
        chat_participants!inner(user_id)
      `
    )
    .eq("type", "private")
    .eq("match_id", matchId);

  // 두 사용자가 모두 참여한 채팅방 찾기
  let existingPrivateChat = null;
  if (existingChats) {
    for (const chat of existingChats) {
      const participants = chat.chat_participants as any[];
      const userIds = participants.map((p: any) => p.user_id);
      if (
        userIds.length === 2 &&
        userIds.includes(userId) &&
        userIds.includes(match.host_id)
      ) {
        existingPrivateChat = chat;
        break;
      }
    }
  }

  if (existingPrivateChat) {
    return ResponseHelper.success(res, {
      chatRoomId: existingPrivateChat.id,
      success: true,
      message: "기존 채팅방으로 이동합니다",
      chatRoom: {
        id: existingPrivateChat.id,
        name: existingPrivateChat.name,
        type: existingPrivateChat.type,
      },
    });
  }

  // 호스트 정보 조회
  const { data: hostData } = await supabase
    .from("users")
    .select("name, nickname")
    .eq("id", match.host_id)
    .single();

  const { data: userData } = await supabase
    .from("users")
    .select("name, nickname")
    .eq("id", userId)
    .single();

  // 새로운 1:1 채팅방 생성
  const { data: chatRoom, error: chatError } = await supabase
    .from("chat_rooms")
    .insert({
      name: `${match.title} | ${hostData?.nickname || hostData?.name} & ${
        userData?.nickname || userData?.name
      }`,
      type: "private",
      match_id: matchId,
    })
    .select("id, name, type")
    .single();

  if (chatError) {
    logger.error("Private chat room creation error:", chatError);
    throw new ApiError(
      500,
      "채팅방 생성 중 오류가 발생했습니다",
      "CHAT_CREATION_ERROR"
    );
  }

  // 두 사용자를 채팅방에 추가
  await supabase.from("chat_participants").insert([
    {
      room_id: chatRoom.id,
      user_id: userId,
      role: "member",
    },
    {
      room_id: chatRoom.id,
      user_id: match.host_id,
      role: "member",
    },
  ]);

  logger.info("Private chat created:", {
    chatRoomId: chatRoom.id,
    users: [userId, match.host_id],
  });

  return ResponseHelper.success(res, {
    chatRoomId: chatRoom.id,
    success: true,
    message: "1:1 채팅방이 생성되었습니다",
    chatRoom: {
      id: chatRoom.id,
      name: chatRoom.name,
      type: chatRoom.type,
      participants: 2,
    },
  });
});