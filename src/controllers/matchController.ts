import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { ResponseHelper, createPagination } from "../utils/response";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import {
  matchCreateSchema,
  matchJoinSchema,
  matchFilterSchema,
  uuidSchema,
} from "../utils/validation";
import {
  formatDate,
  formatPrice,
  calculateDistance,
  sanitizeString,
} from "../utils/helpers";
import { logger } from "../config/logger";

export const matchController = {
  // 2.1 매치 목록 조회 (필터링/검색)
  getMatches: asyncHandler(async (req: Request, res: Response) => {
    const filters = matchFilterSchema.parse(req.query);
    const {
      page,
      limit,
      search,
      region,
      game_type,
      date,
      ntrp_min,
      ntrp_max,
      experience_min,
      experience_max,
      sort,
    } = filters;

    let query = supabase.from("active_matches").select(
      `
    id, title, venue_name, venue_address, court, match_date, start_time, end_time,
    max_participants, current_participants, game_type, status,
    host_name, host_ntrp, host_experience, description, price,
    recruit_ntrp_min, recruit_ntrp_max, recruit_experience_min, recruit_experience_max,
    created_at
  `,
      { count: "exact" }
    );

    // 검색어 필터
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,venue_name.ilike.%${search}%`
      );
    }

    // 지역 필터
    if (region) {
      query = query.ilike("venue_address", `%${region}%`);
    }

    // 게임 타입 필터
    if (game_type) {
      query = query.eq("game_type", game_type);
    }

    // 날짜 필터
    if (date) {
      query = query.eq("match_date", date);
    } else {
      // 기본적으로 오늘 이후 매치만
      query = query.gte("match_date", formatDate(new Date(), "date"));
    }

    // NTRP 레벨 필터
    if (ntrp_min || ntrp_max) {
      if (ntrp_min) query = query.gte("recruit_ntrp_max", ntrp_min);
      if (ntrp_max) query = query.lte("recruit_ntrp_min", ntrp_max);
    }

    // 경력 필터
    if (experience_min || experience_max) {
      if (experience_min)
        query = query.gte("recruit_experience_max", experience_min);
      if (experience_max)
        query = query.lte("recruit_experience_min", experience_max);
    }

    // 정렬
    switch (sort) {
      case "distance":
        // 거리순 정렬은 클라이언트에서 처리 (사용자 위치 필요)
        query = query.order("created_at", { ascending: false });
        break;
      case "price":
        query = query.order("price", { ascending: true });
        break;
      default: // 'latest'
        query = query.order("created_at", { ascending: false });
        break;
    }

    // 페이징 적용
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: matches, error, count } = await query;

    if (error) {
      logger.error("Match list fetch error:", error);
      throw new ApiError(500, "매치 목록 조회 실패", "MATCH_LIST_FETCH_ERROR");
    }

    // 데이터 포맷팅
    const formattedMatches =
      matches?.map((match) => ({
        id: match.id,
        title: match.title,
        location: match.venue_name,
        court: match.court,
        date: formatMatchDate(match.match_date),
        startTime: match.start_time.substring(0, 5),
        endTime: match.end_time.substring(0, 5),
        participants: `${match.current_participants}/${match.max_participants}`,
        gameType: formatGameType(match.game_type),
        level: formatNtrpLevel(match.recruit_ntrp_min, match.recruit_ntrp_max),
        price: match.price ? formatPrice(match.price) : "무료",
        status: match.status,
        hostName: match.host_name,
        description: match.description || "",
        distance: null, // 클라이언트에서 계산
      })) || [];

    const pagination = createPagination(page, limit, count || 0);

    return ResponseHelper.successWithPagination(
      res,
      formattedMatches,
      pagination
    );
  }),

  // 3.1 매치 상세 정보 조회
  getMatchDetail: asyncHandler(async (req: Request, res: Response) => {
    const matchId = uuidSchema.parse(req.params.matchId);

    const { data: match, error } = await supabase
      .from("active_matches")
      .select(
        `
        id, title, venue_name, venue_address, court, match_date, start_time, end_time,
        max_participants, current_participants, game_type, status,
        host_name, host_ntrp, host_experience, description, price,
        recruit_ntrp_min, recruit_ntrp_max, recruit_experience_min, recruit_experience_max,
        rules, equipment, parking_info, amenities
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
        users!inner(id, name, ntrp, experience_years)
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
      })) || [];

    const formattedMatch = {
      id: match.id,
      title: match.title,
      location: match.venue_name,
      court: match.court,
      address: match.venue_address,
      date: formatMatchDate(match.match_date),
      startTime: match.start_time.substring(0, 5),
      endTime: match.end_time.substring(0, 5),
      participants: `${match.current_participants}/${match.max_participants}`,
      gameType: formatGameType(match.game_type),
      level: formatNtrpLevel(match.recruit_ntrp_min, match.recruit_ntrp_max),
      price: match.price ? formatPrice(match.price) : "무료",
      status: match.status,
      hostName: match.host_name,
      hostNtrp: match.host_ntrp?.toString() || "미설정",
      hostExperience: match.host_experience
        ? `${match.host_experience}년`
        : "미설정",
      description: match.description || "",
      rules: match.rules || [],
      equipment: match.equipment || [],
      parking: match.parking_info || "",
      amenities: match.amenities || [],
      confirmedParticipants,
    };

    return ResponseHelper.success(res, formattedMatch);
  }),

  // 1.2 / 매치 참가 신청
  joinMatch: asyncHandler(async (req: Request, res: Response) => {
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

    if (match.current_participants >= match.max_participants) {
      throw new ApiError(400, "이미 마감된 매치입니다", "MATCH_FULL");
    }

    // 기존 참가 신청 확인
    const { data: existingParticipation } = await supabase
      .from("match_participants")
      .select("id, status")
      .eq("match_id", matchId)
      .eq("user_id", userId)
      .single();

    if (existingParticipation) {
      const statusMessage: Record<string, string> = {
        pending: "이미 참가 신청한 매치입니다",
        confirmed: "이미 참가 확정된 매치입니다",
        rejected: "참가 신청이 거절된 매치입니다",
      };
      throw new ApiError(
        409,
        statusMessage[existingParticipation.status] ||
          "이미 참가 신청한 매치입니다",
        "ALREADY_APPLIED"
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
  }),

  // 4.1 매치 생성
  createMatch: asyncHandler(async (req: Request, res: Response) => {
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
  }),

  // 3.2 매치 공유
  shareMatch: asyncHandler(async (req: Request, res: Response) => {
    const matchId = uuidSchema.parse(req.params.matchId);

    const { data: match, error } = await supabase
      .from("matches")
      .select("id, title, game_type, price")
      .eq("id", matchId)
      .single();

    if (error || !match) {
      throw new ApiError(404, "매치를 찾을 수 없습니다", "MATCH_NOT_FOUND");
    }

    const shareData = {
      shareUrl: `https://wehand.tennis/matches/${match.id}`,
      title: match.title,
      description: `${formatGameType(match.game_type)} • ${
        match.price ? formatPrice(match.price) : "무료"
      }`,
    };

    return ResponseHelper.success(res, shareData);
  }),

  // 3.3 매치 북마크
  bookmarkMatch: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
    }

    const matchId = uuidSchema.parse(req.params.matchId);
    const userId = req.user.id;

    // 기존 북마크 확인
    const { data: existingBookmark } = await supabase
      .from("match_bookmarks")
      .select("id")
      .eq("match_id", matchId)
      .eq("user_id", userId)
      .single();

    if (existingBookmark) {
      throw new ApiError(409, "이미 북마크된 매치입니다", "ALREADY_BOOKMARKED");
    }

    const { error } = await supabase.from("match_bookmarks").insert({
      match_id: matchId,
      user_id: userId,
    });

    if (error) {
      throw new ApiError(
        500,
        "북마크 저장 중 오류가 발생했습니다",
        "BOOKMARK_ERROR"
      );
    }

    return ResponseHelper.success(res, null, "북마크에 추가되었습니다");
  }),

  // 3.3 매치 북마크 해제
  unbookmarkMatch: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
    }

    const matchId = uuidSchema.parse(req.params.matchId);
    const userId = req.user.id;

    const { error } = await supabase
      .from("match_bookmarks")
      .delete()
      .eq("match_id", matchId)
      .eq("user_id", userId);

    if (error) {
      throw new ApiError(
        500,
        "북마크 해제 중 오류가 발생했습니다",
        "UNBOOKMARK_ERROR"
      );
    }

    return ResponseHelper.success(res, null, "북마크에서 제거되었습니다");
  }),

  // 3.4 매치 단체 채팅방 생성
  createMatchChat: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
    }

    const matchId = uuidSchema.parse(req.params.matchId);
    const { type, name, participants } = req.body;
    const userId = req.user.id;

    // 매치 존재 및 참가자 확인
    const { data: participation } = await supabase
      .from("match_participants")
      .select("id")
      .eq("match_id", matchId)
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .single();

    if (!participation) {
      throw new ApiError(
        403,
        "매치 참가자만 채팅방을 생성할 수 있습니다",
        "NOT_MATCH_PARTICIPANT"
      );
    }

    // 기존 채팅방 확인
    const { data: existingChat } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("match_id", matchId)
      .eq("type", "match")
      .single();

    if (existingChat) {
      return ResponseHelper.error(
        res,
        "CHAT_ALREADY_EXISTS",
        "이미 채팅방이 존재합니다",
        409
      );
    }

    // 채팅방 생성
    const { data: chatRoom, error: chatError } = await supabase
      .from("chat_rooms")
      .insert({
        name: name || `🎾 ${req.params.matchId} 매치 채팅방`,
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

    // 매치 참가자들을 채팅방에 추가
    const { data: matchParticipants } = await supabase
      .from("match_participants")
      .select("user_id")
      .eq("match_id", matchId)
      .eq("status", "confirmed");

    if (matchParticipants && matchParticipants.length > 0) {
      const chatParticipants = matchParticipants.map((p) => ({
        room_id: chatRoom.id,
        user_id: p.user_id,
        role: p.user_id === userId ? "admin" : "member",
      }));

      await supabase.from("chat_participants").insert(chatParticipants);
    }

    logger.info("Match chat created:", { chatRoomId: chatRoom.id, matchId });

    return ResponseHelper.success(res, {
      chatRoomId: chatRoom.id,
      success: true,
      message: "단체 채팅방이 생성되었습니다",
      chatRoom: {
        id: chatRoom.id,
        name: chatRoom.name,
        type: chatRoom.type,
        matchId: chatRoom.match_id,
        participants: matchParticipants?.length || 1,
      },
    });
  }),
};

// 유틸리티 함수들 (홈 컨트롤러와 동일)
function formatMatchDate(dateString: string): string {
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${month}/${day}`;
}

function formatGameType(gameType: string): string {
  const typeMap: Record<string, string> = {
    singles: "단식",
    mens_doubles: "남복",
    womens_doubles: "여복",
    mixed_doubles: "혼복",
  };
  return typeMap[gameType] || gameType;
}

function formatNtrpLevel(minNtrp?: number, maxNtrp?: number): string {
  if (!minNtrp && !maxNtrp) return "모든 레벨";
  if (minNtrp === maxNtrp) return `${minNtrp}`;
  if (!minNtrp) return `~${maxNtrp}`;
  if (!maxNtrp) return `${minNtrp}~`;

  const avgNtrp = (minNtrp + maxNtrp) / 2;
  if (avgNtrp <= 2.5) return "초급";
  if (avgNtrp <= 3.5) return "초중급";
  if (avgNtrp <= 4.5) return "중급";
  if (avgNtrp <= 5.5) return "중상급";
  return "상급";
}
