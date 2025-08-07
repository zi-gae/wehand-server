import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { ResponseHelper } from '../utils/response';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { formatDate, formatPrice } from '../utils/helpers';

export const homeController = {
  // 1.1 홈 화면 데이터 조회
  getHomeData: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, '인증이 필요합니다', 'AUTHENTICATION_REQUIRED');
    }

    const userId = req.user.id;
    const now = new Date();
    const currentHour = now.getHours();

    // 시간대별 인사말 생성
    let greeting = '안녕하세요';
    if (currentHour < 12) {
      greeting = '좋은 아침이에요';
    } else if (currentHour < 18) {
      greeting = '좋은 오후예요';
    } else {
      greeting = '좋은 저녁이에요';
    }

    // 동기부여 메시지 (랜덤)
    const motivationMessages = [
      '오늘도 화이팅!',
      '테니스로 건강한 하루 보내세요!',
      '새로운 도전을 기다리고 있어요',
      '완벽한 테니스 날씨네요!',
      '오늘 경기에서 멋진 플레이 기대해요'
    ];
    const motivationMessage = motivationMessages[Math.floor(Math.random() * motivationMessages.length)];

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('name, nickname')
      .eq('id', userId)
      .single();

    if (userError) {
      throw new ApiError(404, '사용자 정보를 찾을 수 없습니다', 'USER_NOT_FOUND');
    }

    // 다가오는 매치 조회 (참가 중이거나 호스트인 매치)
    const { data: upcomingMatches, error: matchError } = await supabase
      .from('active_matches') // 뷰 사용
      .select(`
        id, title, venue_name, court, match_date, start_time, end_time,
        max_participants, current_participants, game_type, status,
        host_name, host_ntrp, host_experience, description, price,
        recruit_ntrp_min, recruit_ntrp_max
      `)
      .or(`host_id.eq.${userId},id.in.(${await getUserParticipatingMatches(userId)})`)
      .gte('match_date', formatDate(now, 'date'))
      .order('match_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(10);

    if (matchError) {
      throw new ApiError(500, '매치 정보 조회 실패', 'MATCH_FETCH_ERROR');
    }

    // 매치 데이터 포맷팅
    const formattedMatches = upcomingMatches?.map(match => ({
      id: match.id,
      title: match.title,
      location: match.venue_name,
      court: match.court,
      date: formatMatchDate(match.match_date),
      startTime: match.start_time.substring(0, 5), // HH:MM
      endTime: match.end_time.substring(0, 5),
      participants: `${match.current_participants}/${match.max_participants}`,
      gameType: formatGameType(match.game_type),
      level: formatNtrpLevel(match.recruit_ntrp_min, match.recruit_ntrp_max),
      price: match.price ? formatPrice(match.price) : '무료',
      status: match.status,
      hostName: match.host_name,
      description: match.description || ''
    })) || [];

    return ResponseHelper.success(res, {
      user: {
        name: userData.name || userData.nickname || '테니스 플레이어',
        greeting,
        motivationMessage
      },
      upcomingMatches: formattedMatches
    });
  })
};

// 사용자가 참가 중인 매치 ID 목록 조회
async function getUserParticipatingMatches(userId: string): Promise<string> {
  const { data } = await supabase
    .from('match_participants')
    .select('match_id')
    .eq('user_id', userId)
    .eq('status', 'confirmed');

  if (!data || data.length === 0) return '';
  
  return data.map(p => p.match_id).join(',');
}

// 날짜 포맷팅 (MM/DD)
function formatMatchDate(dateString: string): string {
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}/${day}`;
}

// 게임 타입 한글 변환
function formatGameType(gameType: string): string {
  const typeMap: Record<string, string> = {
    'singles': '단식',
    'mens_doubles': '남복',
    'womens_doubles': '여복',
    'mixed_doubles': '혼복'
  };
  return typeMap[gameType] || gameType;
}

// NTRP 레벨 포맷팅
function formatNtrpLevel(minNtrp?: number, maxNtrp?: number): string {
  if (!minNtrp && !maxNtrp) return '모든 레벨';
  if (minNtrp === maxNtrp) return `${minNtrp}`;
  if (!minNtrp) return `~${maxNtrp}`;
  if (!maxNtrp) return `${minNtrp}~`;
  
  // NTRP 범위에 따른 레벨명
  const avgNtrp = (minNtrp + maxNtrp) / 2;
  if (avgNtrp <= 2.5) return '초급';
  if (avgNtrp <= 3.5) return '초중급';
  if (avgNtrp <= 4.5) return '중급';
  if (avgNtrp <= 5.5) return '중상급';
  return '상급';
}