import { Request, Response } from "express";
import { supabase } from "../../lib/supabase";
import { ResponseHelper } from "../../utils/response";
import { ApiError, asyncHandler } from "../../middleware/errorHandler";
import { uuidSchema, matchJoinSchema } from "../../utils/validation";
import { logger } from "../../config/logger";

// 1.2 / 매치 참가 신청
export const joinMatch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
  }

  const matchId = uuidSchema.parse(req.params.matchId);
  const { message } = matchJoinSchema.parse(req.body);
  const userId = req.user.id;

  // 매치 존재 및 상태 확인
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, host_id, max_participants, current_participants, status")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new ApiError(404, "매치를 찾을 수 없습니다", "MATCH_NOT_FOUND");
  }

  if (match.host_id === userId) {
    throw new ApiError(
      400,
      "자신이 호스트인 매치에는 참가 신청할 수 없습니다",
      "CANNOT_JOIN_OWN_MATCH"
    );
  }

  if (match.status !== "recruiting") {
    throw new ApiError(
      400,
      "모집 중인 매치가 아닙니다",
      "MATCH_NOT_RECRUITING"
    );
  }

  if (match.current_participants - 1 >= match.max_participants) {
    throw new ApiError(400, "이미 마감된 매치입니다", "MATCH_FULL");
  }

  // 기존 참가 신청 확인
  const { data: existingParticipation } = await supabase
    .from("match_participants")
    .select("id, status")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingParticipation) {
    const statusMessage: Record<string, string> = {
      pending: "이미 참가 신청한 매치입니다",
      confirmed: "이미 참가 확정된 매치입니다",
      rejected: "참가 신청이 거절된 매치입니다",
    };
    return ResponseHelper.success(
      res,
      null,
      statusMessage[existingParticipation.status] ||
        "이미 참가 신청한 매치입니다"
    );
  }

  // 참가 신청 저장
  const { error: insertError } = await supabase
    .from("match_participants")
    .insert({
      match_id: matchId,
      user_id: userId,
      join_message: message || null,
      status: "pending", // 호스트 승인 필요
    });

  if (insertError) {
    logger.error("Match join error:", insertError);
    throw new ApiError(
      500,
      "참가 신청 처리 중 오류가 발생했습니다",
      "JOIN_ERROR"
    );
  }

  logger.info("User joined match:", { userId, matchId });

  return ResponseHelper.success(res, null, "참가 신청이 완료되었습니다");
});