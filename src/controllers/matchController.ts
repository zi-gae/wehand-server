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
      user_lat,
      user_lng,
    } = filters;

    let query;

    // 거리순 정렬을 위해 venue location 정보가 필요한 경우
    if (sort === "distance" && user_lat && user_lng) {
      // matches와 venues를 직접 join하여 location 정보 포함
      query = supabase
        .from("matches")
        .select(
          `
          id, title, host_id, venue_id, court, match_date, start_time, end_time,
          max_participants, current_participants, game_type, status,
          description, price,
          recruit_ntrp_min, recruit_ntrp_max, recruit_experience_min, recruit_experience_max,
          created_at,
          venues!inner(id, name, address, location),
          users!host_id(name, ntrp, experience_years)
        `,
          { count: "exact" }
        )
        .in("status", ["recruiting", "full", "confirmed"]);
    } else {
      // 기본 matches 테이블 조회 (host_id 포함)
      query = supabase
        .from("matches")
        .select(
          `
        id, title, host_id, venue_id, court, match_date, start_time, end_time,
        max_participants, current_participants, game_type, status,
        description, price,
        recruit_ntrp_min, recruit_ntrp_max, recruit_experience_min, recruit_experience_max,
        created_at,
        venues(name, address),
        users(name, ntrp, experience_years)
      `,
          { count: "exact" }
        )
        .in("status", ["recruiting", "full", "confirmed"]);
    }

    // 검색어 필터
    if (search) {
      if (sort === "distance" && user_lat && user_lng) {
        // 거리순 정렬 시 venues 조인 구조에 맞게 검색
        query = query.or(
          `title.ilike.%${search}%,description.ilike.%${search}%,venues.name.ilike.%${search}%`
        );
      } else {
        // 기본 조회 시 venues 조인 구조에 맞게 검색
        query = query.or(
          `title.ilike.%${search}%,description.ilike.%${search}%,venues.name.ilike.%${search}%`
        );
      }
    }

    // 지역 필터
    if (region) {
      query = query.ilike("venues.address", `%${region}%`);
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

    // 정렬 (거리순이 아닌 경우)
    if (sort !== "distance" || !user_lat || !user_lng) {
      switch (sort) {
        case "price":
          query = query.order("price", { ascending: true });
          break;
        default: // 'latest'
          query = query.order("created_at", { ascending: false });
          break;
      }
    }

    // 페이징 적용
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: matches, error, count } = await query;

    if (error) {
      logger.error("Match list fetch error:", error);
      throw new ApiError(500, "매치 목록 조회 실패", "MATCH_LIST_FETCH_ERROR");
    }

    let processedMatches = matches || [];

    // 거리순 정렬이 요청된 경우 별도 처리
    if (sort === "distance" && user_lat && user_lng) {
      // 거리 계산을 위해 venue 좌표 정보 조회
      const venueQuery = supabase
        .from("venues")
        .select("id, ST_X(location) as longitude, ST_Y(location) as latitude");

      const { data: venueCoords } = await venueQuery;
      const venueCoordMap = new Map();

      if (venueCoords) {
        venueCoords.forEach((venue: any) => {
          venueCoordMap.set(venue.id, {
            longitude: venue.longitude,
            latitude: venue.latitude,
          });
        });
      }

      // 거리 계산 및 정렬
      const matchesWithDistance = processedMatches.map((match: any) => {
        const venueCoord = venueCoordMap.get(match.venue_id);
        let distance = null;

        if (venueCoord && venueCoord.latitude && venueCoord.longitude) {
          distance = calculateDistance(
            parseFloat(user_lat.toString()),
            parseFloat(user_lng.toString()),
            venueCoord.latitude,
            venueCoord.longitude
          );
        }

        return { ...match, calculated_distance: distance };
      });

      // 거리순으로 정렬
      matchesWithDistance.sort((a, b) => {
        const distA = a.calculated_distance ?? Infinity;
        const distB = b.calculated_distance ?? Infinity;
        return distA - distB;
      });

      processedMatches = matchesWithDistance;
    }

    // 각 매치의 확정된 참가자 수 조회
    const matchIds = processedMatches?.map((match: any) => match.id) || [];
    let participantCounts: Map<string, number> = new Map();

    if (matchIds.length > 0) {
      const { data: participantData } = await supabase
        .from("match_participants")
        .select("match_id")
        .in("match_id", matchIds)
        .eq("status", "confirmed")
        .eq("is_host", false); // 호스트 제외

      // 각 매치별 확정된 참가자 수 계산 (호스트 제외)
      participantData?.forEach((p: any) => {
        const currentCount = participantCounts.get(p.match_id) || 0;
        participantCounts.set(p.match_id, currentCount + 1);
      });
    }

    // 데이터 포맷팅
    const formattedMatches =
      processedMatches?.map((match: any) => {
        // 거리 정보가 계산된 경우 사용
        let distance: number | null = match.calculated_distance || null;

        // 실제 확정된 참가자 수 사용 (호스트 제외)
        const actualParticipants = participantCounts.get(match.id) || 0;
        // 최대 참가자 수에서도 호스트 제외 (단, 최소 1은 보장)
        const maxParticipantsExcludingHost = match.max_participants;

        return {
          id: match.id,
          title: match.title,
          hostId: match.host_id, // 추가된 host_id
          location:
            match.venue_name ||
            (match.venues &&
              (Array.isArray(match.venues)
                ? match.venues[0]?.name
                : match.venues?.name)) ||
            "",
          court: match.court,
          date: formatMatchDate(match.match_date),
          startTime: match.start_time.substring(0, 5),
          endTime: match.end_time.substring(0, 5),
          participants: `${actualParticipants}/${maxParticipantsExcludingHost}`,
          gameType: formatGameType(match.game_type),
          level: formatNtrpLevel(
            match.recruit_ntrp_min,
            match.recruit_ntrp_max
          ),
          price: match.price ? formatPrice(match.price) : "무료",
          status: match.status,
          hostName:
            match.host_name ||
            (match.users &&
              (Array.isArray(match.users)
                ? match.users[0]?.name
                : match.users?.name)) ||
            "",
          description: match.description || "",
          distance: distance ? `${distance.toFixed(1)}km` : null,
        };
      }) || [];

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
      .from("matches")
      .select(
        `
        id, title, host_id, court, match_date, start_time, end_time,
        max_participants, game_type, status,
        description, price,
        recruit_ntrp_min, recruit_ntrp_max, recruit_experience_min, recruit_experience_max,
        rules, equipment, parking_info,
        venues(name, address, amenities),
        users!host_id(name, ntrp, experience_years)
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
      price: match.price ? formatPrice(match.price) : "무료",
      status: match.status,
      hostName: host?.name || "",
      hostNtrp: host?.ntrp?.toString() || "미설정",
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

  // 3.4 매치 단체 채팅방 생성 또는 참가
  createMatchChat: asyncHandler(async (req: Request, res: Response) => {
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
  }),

  // 3.5 매치 호스트와 1:1 채팅방 생성
  createPrivateChat: asyncHandler(async (req: Request, res: Response) => {
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

    // 기존 1:1 채팅방 확인
    const { data: existingChats } = await supabase
      .from("chat_rooms")
      .select(
        `
        id,
        name,
        type,
        chat_participants!inner(user_id)
      `
      )
      .eq("type", "private");

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
        name: `${hostData?.nickname || hostData?.name} & ${
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
