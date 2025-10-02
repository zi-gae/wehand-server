import { Request, Response } from "express";
import { supabase } from "../../lib/supabase";
import { ResponseHelper } from "../../utils/response";
import { ApiError, asyncHandler } from "../../middleware/errorHandler";
import { matchCreateSchema } from "../../utils/validation";
import { sanitizeString } from "../../utils/helpers";
import { logger } from "../../config/logger";

// 4.1 매치 생성
export const createMatch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
  }

  const matchData = matchCreateSchema.parse(req.body);
  const userId = req.user.id;

  // 테니스장 존재 확인
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("id, name")
    .eq("id", matchData.venue_id)
    .single();

  if (venueError || !venue) {
    throw new ApiError(
      404,
      "선택한 테니스장을 찾을 수 없습니다",
      "VENUE_NOT_FOUND"
    );
  }

  // 매치 생성
  const { data: newMatch, error: insertError } = await supabase
    .from("matches")
    .insert({
      title: sanitizeString(matchData.title),
      description: matchData.description
        ? sanitizeString(matchData.description)
        : null,
      host_id: userId,
      game_type: matchData.game_type,
      venue_id: matchData.venue_id,
      court: sanitizeString(matchData.court),
      match_date: matchData.match_date,
      start_time: matchData.start_time,
      end_time: matchData.end_time,
      max_participants: matchData.max_participants,
      current_participants: 1, // 호스트 포함
      recruit_ntrp_min: matchData.recruit_ntrp_min || null,
      recruit_ntrp_max: matchData.recruit_ntrp_max || null,
      recruit_experience_min: matchData.recruit_experience_min || null,
      recruit_experience_max: matchData.recruit_experience_max || null,
      price: matchData.price || null,
      rules: matchData.rules || null,
      equipment: matchData.equipment || null,
      parking_info: matchData.parking_info || null,
      status: "recruiting",
    })
    .select("id")
    .single();

  if (insertError) {
    logger.error("Match creation error:", insertError);
    throw new ApiError(
      500,
      "매치 생성 중 오류가 발생했습니다",
      "MATCH_CREATION_ERROR"
    );
  }

  // 호스트를 참가자로 추가
  const { error: hostParticipationError } = await supabase
    .from("match_participants")
    .insert({
      match_id: newMatch.id,
      user_id: userId,
      status: "confirmed",
      is_host: true,
    });

  if (hostParticipationError) {
    logger.error("Host participation error:", hostParticipationError);
  }

  logger.info("Match created:", { matchId: newMatch.id, hostId: userId });

  return ResponseHelper.created(res, {
    id: newMatch.id,
    message: "매치가 생성되었습니다",
  });
});