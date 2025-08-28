import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { ResponseHelper } from "../utils/response";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { formatDate, formatPrice } from "../utils/helpers";
import { logger } from "../config/logger";

export const homeController = {
  // 1.1 홈 화면 데이터 조회
  getHomeData: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
    }

    const userId = req.user.id;
    const now = new Date();
    const currentHour = now.getHours();

    // 시간대별 인사말 생성
    let greeting = "안녕하세요";
    if (currentHour < 12) {
      greeting = "좋은 아침이에요";
    } else if (currentHour < 18) {
      greeting = "좋은 오후예요";
    } else {
      greeting = "좋은 저녁이에요";
    }

    // 동기부여 메시지 (랜덤)
    const motivationMessages = [
      "오늘도 화이팅!",
      "테니스로 건강한 하루 보내세요!",
      "새로운 도전을 기다리고 있어요",
      "완벽한 테니스 날씨네요!",
      "오늘 경기에서 멋진 플레이 기대해요",
    ];
    const motivationMessage =
      motivationMessages[Math.floor(Math.random() * motivationMessages.length)];

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("name, nickname")
      .eq("id", userId)
      .single();

    if (userError) {
      logger.error(`사용자 정보 조회 실패: ${userError.details}`);
      throw new ApiError(
        404,
        "사용자 정보를 찾을 수 없습니다",
        "USER_NOT_FOUND"
      );
    }

    // 다가오는 매치 조회 (호스트이거나 참가자인 미래 매치만)
    const currentDate = formatDate(now, "date");
    const currentTime = now.toTimeString().substring(0, 8); // HH:MM:SS

    console.log(`현재 날짜: ${currentDate}, 현재 시간: ${currentTime}`);

    // OR 조건들을 and(...) 묶음으로 조합해 과거 매치 제외
    const participatingIdsCsv = await getUserParticipatingMatches(userId); // 빈 문자열이면 참가자 조건 생략
    const orClauses: string[] = [
      // 호스트 & 미래
      `and(host_id.eq.${userId},match_date.gt.${currentDate})`,
      `and(host_id.eq.${userId},match_date.eq.${currentDate},start_time.gt.${currentTime})`,
    ];
    if (participatingIdsCsv) {
      orClauses.push(
        `and(id.in.(${participatingIdsCsv}),match_date.gt.${currentDate})`,
        `and(id.in.(${participatingIdsCsv}),match_date.eq.${currentDate},start_time.gt.${currentTime})`
      );
    }

    const { data: upcomingMatches, error: matchError } = await supabase
      .from("active_matches")
      .select(
        `
        id, title, venue_name, court, match_date, start_time, end_time,
        max_participants, game_type, status,
        host_name, host_ntrp, host_experience, description, price,
        recruit_ntrp_min, recruit_ntrp_max
      `
      )
      .or(orClauses.join(","))
      .order("match_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(10);

    if (matchError) {
      throw new ApiError(500, "매치 정보 조회 실패", "MATCH_FETCH_ERROR");
    }

    // 각 매치의 확정된 참가자 수 조회
    const matchIds = upcomingMatches?.map((match: any) => match.id) || [];
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

    // 매치 데이터 포맷팅
    const formattedMatches =
      upcomingMatches?.map((match) => {
        const actualParticipants = participantCounts.get(match.id) || 0; // 확정 참가자 수 (호스트 제외)
        const maxParticipantsExcludingHost = match.max_participants; // 이미 호스트 제외된 값이라 가정
        return {
          id: match.id,
          title: match.title,
          location: match.venue_name,
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
          hostName: match.host_name,
          description: match.description || "",
        };
      }) || [];

    return ResponseHelper.success(res, {
      user: {
        name: userData.name || userData.nickname || "테니스 플레이어",
        greeting,
        motivationMessage,
      },
      upcomingMatches: formattedMatches,
    });
  }),
};

// 사용자가 참가 중인 매치 ID 목록 조회
async function getUserParticipatingMatches(userId: string): Promise<string> {
  const { data } = await supabase
    .from("match_participants")
    .select("match_id")
    .eq("user_id", userId)
    .eq("status", "confirmed");

  if (!data || data.length === 0) return ""; // 빈 문자열이면 상위에서 조건 생략

  return data.map((p) => p.match_id).join(",");
}

// 날짜 포맷팅 (MM/DD)
function formatMatchDate(dateString: string): string {
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${month}/${day}`;
}

// 게임 타입 한글 변환
function formatGameType(gameType: string): string {
  const typeMap: Record<string, string> = {
    singles: "단식",
    mens_doubles: "남복",
    womens_doubles: "여복",
    mixed_doubles: "혼복",
  };
  return typeMap[gameType] || gameType;
}

// NTRP 레벨 포맷팅
function formatNtrpLevel(minNtrp?: number, maxNtrp?: number): string {
  if (!minNtrp && !maxNtrp) return "모든 레벨";
  if (minNtrp === maxNtrp) return `${minNtrp}`;
  if (!minNtrp) return `~${maxNtrp}`;
  if (!maxNtrp) return `${minNtrp}~`;

  return `${minNtrp}~${maxNtrp}`;
}
