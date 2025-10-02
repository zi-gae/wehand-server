import { Request, Response } from "express";
import { supabase } from "../../lib/supabase";
import { ResponseHelper, createPagination } from "../../utils/response";
import { ApiError, asyncHandler } from "../../middleware/errorHandler";
import { matchFilterSchema } from "../../utils/validation";
import { formatDate, calculateDistance } from "../../utils/helpers";
import { logger } from "../../config/logger";
import {
  convertToOfficialRegionName,
  formatMatchDate,
  formatGameType,
  formatNtrpLevel,
  formatExperienceLevel,
  formatPrice,
} from "./utils";

// 2.1 매치 목록 조회 (필터링/검색)
export const getMatches = asyncHandler(async (req: Request, res: Response) => {
  console.log("원본 쿼리 파라미터:", req.query);

  // Express에서 regions[], courts[], venue_ids[] 형식의 쿼리 파라미터 처리
  const queryObj = { ...req.query };

  // regions[] 키가 있다면 regions 키로 변환
  if (queryObj["regions[]"] !== undefined) {
    const regionsValue = queryObj["regions[]"];
    queryObj.regions = regionsValue;
    delete queryObj["regions[]"];
  }

  // courts[] 키가 있다면 courts 키로 변환
  if (queryObj["courts[]"] !== undefined) {
    const courtsValue = queryObj["courts[]"];
    queryObj.courts = courtsValue;
    delete queryObj["courts[]"];
  }

  // venue_ids[] 키가 있다면 venue_ids 키로 변환
  if (queryObj["venue_ids[]"] !== undefined) {
    const venueIdsValue = queryObj["venue_ids[]"];
    queryObj.venue_ids = venueIdsValue;
    delete queryObj["venue_ids[]"];
  }

  console.log("쿼리 파라미터 변환:", queryObj);
  const filters = matchFilterSchema.parse(queryObj);
  console.log("Zod로 파싱된 필터:", filters);

  const {
    page,
    limit,
    search,
    region,
    regions,
    game_type,
    date,
    date_start,
    date_end,
    time_start,
    time_end,
    ntrp_min,
    ntrp_max,
    experience_min,
    experience_max,
    sort,
    user_lat,
    user_lng,
    court,
    courts, // 여러 코트 필터 추가
    venue_id,
    venue_ids, // venue ID 필터 추가
  } = filters;

  console.log("DEBUG - Received filters:", req.query);

  let query: any;

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
          venues!inner(id, name, address, location, region),
          users!host_id(name, ntrp, experience_years)
        `,
        { count: "exact" }
      )
      .in("status", ["recruiting", "full", "confirmed"]);
  } else {
    // 기본 matches 테이블 조회 (host_id 포함)
    if (region || regions) {
      // region 또는 regions 필터가 있을 때는 venues를 inner join하고 필터 조건 추가
      query = supabase
        .from("matches")
        .select(
          `
          id, title, host_id, venue_id, court, match_date, start_time, end_time,
          max_participants, current_participants, game_type, status,
          description, price,
          recruit_ntrp_min, recruit_ntrp_max, recruit_experience_min, recruit_experience_max,
          created_at,
          venues!inner(name, address, region),
          users(name, ntrp, experience_years)
        `,
          { count: "exact" }
        )
        .in("status", ["recruiting", "full", "confirmed"]);

      // 지역 리스트로 필터링
      if (regions && regions.length > 0) {
        // 여러 지역을 각각 or 조건으로 적용
        const convertedRegions = regions.map(convertToOfficialRegionName);

        console.log("DEBUG - regions 배열:", regions);
        console.log("DEBUG - Filtering by regions:", regions);
        console.log("DEBUG - Converted regions:", convertedRegions);

        // regions 배열을 저장하여 나중에 JavaScript에서 필터링
        (query as any)._regionsFilter = convertedRegions;
      } else if (region) {
        // 단일 지역 필터 (하위 호환성) - 변환된 지역명 사용
        const convertedRegion = convertToOfficialRegionName(region);
        console.log("DEBUG - Filtering by single region:", region);
        console.log("DEBUG - Converted region:", convertedRegion);
        query = query.ilike("venues.region", `%${convertedRegion}%`);
      }
    } else {
      0;
      query = supabase
        .from("matches")
        .select(
          `
          id, title, host_id, venue_id, court, match_date, start_time, end_time,
          max_participants, current_participants, game_type, status,
          description, price,
          recruit_ntrp_min, recruit_ntrp_max, recruit_experience_min, recruit_experience_max,
          created_at,
          venues(name, address, region),
          users(name, ntrp, experience_years)
        `,
          { count: "exact" }
        )
        .in("status", ["recruiting", "full", "confirmed"]);
    }
  }

  // 검색어 필터
  if (search) {
    // matches 테이블 필드만 검색 (venues.name은 별도 처리 필요)
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  // 단일 코트 필터 (하위 호환성)
  if (court && !courts) {
    query = query.ilike("court", `%${court}%`);
  }

  // Venue ID 필터
  if (venue_ids && venue_ids.length > 0) {
    query = query.in("venue_id", venue_ids);
  } else if (venue_id) {
    query = query.eq("venue_id", venue_id);
  }

  // 지역 필터는 쿼리 생성 후 적용하지 않고, select 시점에 처리

  // 게임 타입 필터
  if (game_type) {
    query = query.eq("game_type", game_type);
  }

  // 날짜 필터
  if (date_start && date_end) {
    // 날짜 범위로 필터링
    query = query.gte("match_date", date_start).lte("match_date", date_end);
  } else if (date_start) {
    // 시작 날짜만 있는 경우
    query = query.gte("match_date", date_start);
  } else if (date_end) {
    // 종료 날짜만 있는 경우
    query = query.lte("match_date", date_end);
  } else if (date) {
    // 특정 날짜만 필터링 (하위 호환성)
    query = query.eq("match_date", date);
  } else {
    // 기본적으로 오늘 이후 매치만
    query = query.gte("match_date", formatDate(new Date(), "date"));
  }

  // 시간 필터
  if (time_start && time_end) {
    // 시간 범위로 필터링 (시작 시간 기준)
    query = query.gte("start_time", time_start).lte("start_time", time_end);
  } else if (time_start) {
    // 시작 시간만 있는 경우
    query = query.gte("start_time", time_start);
  } else if (time_end) {
    // 종료 시간만 있는 경우
    query = query.lte("start_time", time_end);
  }

  // NTRP 레벨 필터
  if (ntrp_min || ntrp_max) {
    if (ntrp_min) query = query.gte("recruit_ntrp_max", ntrp_min);
    if (ntrp_max) query = query.lte("recruit_ntrp_min", ntrp_max);
  }

  // 구력 필터
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
      case "deadline":
        // 마감 임박순: 날짜와 시간 기준 오름차순 정렬
        query = query
          .order("match_date", { ascending: true })
          .order("start_time", { ascending: true });
        break;
      default: // 'latest'
        query = query.order("created_at", { ascending: false });
        break;
    }
  }

  // 페이징 적용 (regions 또는 courts 필터가 있을 때는 나중에 JavaScript에서 처리)
  const shouldApplyPaginationLater =
    (regions && regions.length > 0) || (courts && courts.length > 0);

  if (!shouldApplyPaginationLater) {
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
  }

  const { data: matches, error, count } = await query;

  console.log("DEBUG - Final query result:", {
    count,
    hasRegions: !!regions,
    regionsLength: regions ? regions.length : 0,
    hasRegion: !!region,
    hasCourts: !!courts,
    courtsLength: courts ? courts.length : 0,
    hasCourt: !!court,
    matchesCount: matches ? matches.length : 0,
  });

  if (matches && matches.length > 0) {
    console.log("DEBUG - First match venue:", matches[0].venues);
  }

  if (region) {
    console.log("Final matches after all filters:", matches, region);
    // query = query.filter("venues.region", "ilike", `%${region}%`);
  }

  if (error) {
    logger.error("Match list fetch error:", error);
    throw new ApiError(500, "매치 목록 조회 실패", "MATCH_LIST_FETCH_ERROR");
  }

  let processedMatches = matches || [];
  let totalFilteredCount = processedMatches.length;

  // regions 필터링 (JavaScript에서 후처리)
  if (regions && regions.length > 0) {
    const convertedRegions = regions.map(convertToOfficialRegionName);
    processedMatches = processedMatches.filter((match: any) => {
      const venueRegion =
        match.venues?.region ||
        (Array.isArray(match.venues) ? match.venues[0]?.region : "");

      return convertedRegions.some(
        (region) => venueRegion && venueRegion.includes(region)
      );
    });

    console.log("DEBUG - After regions filter:", {
      originalCount: matches?.length || 0,
      filteredCount: processedMatches.length,
      regions: convertedRegions,
    });
  }

  // courts 필터링 (JavaScript에서 후처리)
  if (courts && courts.length > 0) {
    processedMatches = processedMatches.filter((match: any) => {
      const matchCourt = match.court || "";

      return courts.some(
        (court) =>
          matchCourt && matchCourt.toLowerCase().includes(court.toLowerCase())
      );
    });

    console.log("DEBUG - After courts filter:", {
      beforeFilterCount: processedMatches.length,
      courts: courts,
    });
  }

  // 필터링 후 총 개수 업데이트
  totalFilteredCount = processedMatches.length;

  // 현재 시간 기준으로 시작 시간이 지난 매치 필터링
  const now = new Date();
  const currentDate = now.toISOString().split("T")[0]; // yyyy-mm-dd
  const currentTime = now.toTimeString().split(" ")[0]; // hh:mm:ss

  processedMatches = processedMatches.filter((match: any) => {
    // 매치 날짜가 오늘보다 미래인 경우 포함
    if (match.match_date > currentDate) {
      return true;
    }
    // 매치 날짜가 오늘인 경우, 시작 시간이 현재 시간 이후인지 확인
    if (match.match_date === currentDate) {
      return match.start_time > currentTime;
    }
    // 매치 날짜가 과거인 경우 제외
    return false;
  });

  console.log("DEBUG - After time filter:", {
    beforeFilter: totalFilteredCount,
    afterFilter: processedMatches.length,
    currentDate,
    currentTime,
  });

  // 시간 필터 후 총 개수 재계산
  totalFilteredCount = processedMatches.length;

  // JavaScript 레벨에서 페이지네이션 적용 (regions 또는 courts 필터가 있는 경우)
  if (shouldApplyPaginationLater) {
    const offset = (page - 1) * limit;
    processedMatches = processedMatches.slice(offset, offset + limit);

    console.log("DEBUG - After pagination:", {
      totalFilteredCount,
      afterPagination: processedMatches.length,
      page,
      limit,
    });
  }

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
    matchesWithDistance.sort((a: any, b: any) => {
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
        location: match.court,
        court: match.court,
        date: formatMatchDate(match.match_date),
        startTime: match.start_time.substring(0, 5),
        endTime: match.end_time.substring(0, 5),
        participants: `${actualParticipants}/${maxParticipantsExcludingHost}`,
        gameType: formatGameType(match.game_type),
        level: formatNtrpLevel(match.recruit_ntrp_min, match.recruit_ntrp_max),
        experience: formatExperienceLevel(
          match.recruit_experience_min,
          match.recruit_experience_max
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
        hostNickname: match.host_nickname || "",
        description: match.description || "",
        distance: distance ? `${distance.toFixed(1)}km` : null,
      };
    }) || [];

  // 페이지네이션 계산 (필터링이 적용된 경우 필터링된 개수 사용)
  const finalCount = shouldApplyPaginationLater
    ? totalFilteredCount
    : count || 0;
  const pagination = createPagination(page, limit, finalCount);

  // 하위호환성을 위해 camelCase 필드 추가
  const transformedMatches = formattedMatches.map((match: any) => ({
    ...match,
    // snake_case -> camelCase 매핑 추가
    game_type: match.gameType,
    start_time: match.startTime,
    end_time: match.endTime,
    host_id: match.hostId,
    host_name: match.hostName,
    host_nickname: match.hostNickname,
  }));

  return ResponseHelper.successWithPagination(
    res,
    transformedMatches,
    pagination
  );
});
