import { Request, Response } from "express";
import { supabase } from "../../lib/supabase";
import { ResponseHelper } from "../../utils/response";
import { ApiError, asyncHandler } from "../../middleware/errorHandler";
import { uuidSchema } from "../../utils/validation";
import { logger } from "../../config/logger";
import {
  formatMatchDate,
  formatGameType,
  formatNtrpLevel,
  formatExperienceLevel,
  formatPrice,
} from "./utils";

// 3.1 매치 상세 정보 조회
export const getMatchDetail = asyncHandler(async (req: Request, res: Response) => {
  const matchId = uuidSchema.parse(req.params.matchId);

  const { data: match, error } = await supabase
    .from("matches")
    .select(
      `
        id, title, host_id, court, match_date, start_time, end_time,
        max_participants, game_type, status,
        description, price,
        recruit_ntrp_min, recruit_ntrp_max, recruit_experience_min, recruit_experience_max,
        rules, equipment, parking_info,
        venues(name, address, region, amenities),
        users!host_id(name, ntrp, experience_years, nickname)
      `
    )
    .eq("id", matchId)
    .single();

  if (error || !match) {
    logger.error("Match detail fetch error:", error);
    throw new ApiError(404, "매치를 찾을 수 없습니다", "MATCH_NOT_FOUND");
  }

  // 확정된 참가자 조회
  const { data: participants } = await supabase
    .from("match_participants")
    .select(
      `
        user_id, is_host,
        users!inner(id, name, ntrp, experience_years, nickname)
      `
    )
    .eq("match_id", matchId)
    .eq("status", "confirmed");

  const confirmedParticipants =
    participants?.map((p: any) => ({
      id: p.users.id,
      name: p.users.name,
      ntrp: p.users.ntrp?.toString() || "미설정",
      experience: p.users.experience_years
        ? `${p.users.experience_years}년`
        : "미설정",
      isHost: p.is_host,
      nickname: p.users.nickname || "",
    })) || [];

  // 실제 확정된 참가자 수 계산 (호스트 제외)
  const current_participants =
    participants?.filter((p) => !p.is_host).length || 0;
  // 최대 참가자 수에서도 호스트 제외 (단, 최소 1은 보장)
  const maxParticipantsExcludingHost = match.max_participants;

  // 조인된 데이터를 안전하게 추출
  const venue =
    match.venues &&
    (Array.isArray(match.venues) ? match.venues[0] : match.venues);
  const host =
    match.users &&
    (Array.isArray(match.users) ? match.users[0] : match.users);

  const formattedMatch = {
    id: match.id,
    title: match.title,
    hostId: match.host_id, // 추가된 host_id
    location: venue?.name || "",
    court: match.court,
    address: venue?.address || "",
    date: formatMatchDate(match.match_date),
    startTime: match.start_time.substring(0, 5),
    endTime: match.end_time.substring(0, 5),
    participants: `${current_participants}/${maxParticipantsExcludingHost}`,
    gameType: formatGameType(match.game_type),
    level: formatNtrpLevel(match.recruit_ntrp_min, match.recruit_ntrp_max),
    experience: formatExperienceLevel(
      match.recruit_experience_min,
      match.recruit_experience_max
    ),
    price: match.price ? formatPrice(match.price) : "무료",
    status: match.status,
    hostName: host?.name || "",
    hostNtrp: host?.ntrp?.toString() || "미설정",
    hostNickname: host?.nickname || "",
    hostExperience: host?.experience_years
      ? `${host.experience_years}년`
      : "미설정",
    description: match.description || "",
    rules: match.rules || [],
    equipment: match.equipment || [],
    parking: match.parking_info || "",
    amenities: venue?.amenities || [],
    confirmedParticipants,
  };

  // 하위호환성을 위해 camelCase 필드 추가
  const transformedMatch = {
    ...formattedMatch,
    // snake_case -> camelCase 매핑 추가
    game_type: formattedMatch.gameType,
    start_time: formattedMatch.startTime,
    end_time: formattedMatch.endTime,
    host_id: match.host_id,
    host_name: formattedMatch.hostName,
    host_ntrp: formattedMatch.hostNtrp,
    host_nickname: formattedMatch.hostNickname,
    host_experience: formattedMatch.hostExperience,
    confirmed_participants:
      formattedMatch.confirmedParticipants?.map((p: any) => ({
        ...p,
        is_host: p.isHost,
      })) || [],
  };

  return ResponseHelper.success(res, transformedMatch);
});