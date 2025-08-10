import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { ResponseHelper } from "../utils/response";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { z } from "zod";
import { logger } from "../config/logger";

// Request 타입 확장
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// 리뷰 제출 스키마
const submitReviewSchema = z.object({
  revieweeId: z.string().uuid("유효하지 않은 사용자 ID입니다"),
  ntrp: z.number().min(1.0).max(7.0).multipleOf(0.5),
  isPositive: z.boolean(),
  comment: z.string().optional(),
});

export const reviewController = {
  // 리뷰 가능한 매치 목록 조회
  getReviewableMatches: asyncHandler(
    async (req: AuthRequest, res: Response) => {
      if (!req.user) {
        throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
      }

      const userId = req.user.id;
      const now = new Date().toISOString();

      // 현재 시간보다 이전에 종료된 매치 중 사용자가 참가한 매치 조회
      const { data: participatedMatches, error: matchError } = await supabase
        .from("match_participants")
        .select(
          `
        match_id,
        matches!inner(
          id,
          title,
          match_date,
          start_time,
          end_time,
          game_type,
          venues(name, address)
        )
      `
        )
        .eq("user_id", userId)
        .eq("status", "confirmed");

      if (matchError) {
        logger.error("Failed to fetch participated matches:", matchError);
        throw new ApiError(500, "매치 조회 실패", "MATCH_FETCH_ERROR");
      }

      if (!participatedMatches || participatedMatches.length === 0) {
        return ResponseHelper.success(res, []);
      }

      // 종료된 매치만 필터링
      const completedMatches = participatedMatches.filter((p: any) => {
        const match = p.matches;
        const matchDateTime = new Date(`${match.match_date} ${match.end_time}`);
        return matchDateTime < new Date(now);
      });

      // 각 매치의 참가자 목록과 리뷰 상태 조회
      const reviewableMatches = await Promise.all(
        completedMatches.map(async (p: any) => {
          const match = p.matches;
          const venue = Array.isArray(match.venues)
            ? match.venues[0]
            : match.venues;

          // 해당 매치의 모든 확정된 참가자 조회
          const { data: allParticipants } = await supabase
            .from("match_participants")
            .select(
              `
            user_id,
            users!inner(id, name, nickname, ntrp)
          `
            )
            .eq("match_id", match.id)
            .eq("status", "confirmed")
            .neq("user_id", userId); // 자기 자신 제외

          // 이미 리뷰한 참가자 확인
          const { data: existingReviews } = await supabase
            .from("match_reviews")
            .select("reviewee_id")
            .eq("match_id", match.id)
            .eq("reviewer_id", userId);

          const reviewedUserIds =
            existingReviews?.map((r) => r.reviewee_id) || [];

          // 참가자 정보 포맷팅
          const participants =
            allParticipants?.map((ap: any) => {
              const user = Array.isArray(ap.users) ? ap.users[0] : ap.users;
              return {
                id: user.id,
                name: user.name,
                nickname: user.nickname,
                ntrp: user.ntrp,
                hasReviewed: reviewedUserIds.includes(user.id),
              };
            }) || [];

          // 아직 리뷰하지 않은 참가자가 있는 경우만 반환
          const hasUnreviewedParticipants = participants.some(
            (p) => !p.hasReviewed
          );

          if (!hasUnreviewedParticipants) {
            return null;
          }

          return {
            id: match.id,
            title: match.title,
            matchDate: match.match_date,
            location: venue?.name || "",
            address: venue?.address || "",
            gameType: formatGameType(match.game_type),
            participants,
          };
        })
      );

      // null 값 제거
      const filteredMatches = reviewableMatches.filter((m) => m !== null);

      return ResponseHelper.success(res, filteredMatches);
    }
  ),

  // 리뷰 제출
  submitReview: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
    }

    const { matchId } = req.params;
    const reviewData = submitReviewSchema.parse(req.body);
    const reviewerId = req.user.id;

    // 매치 존재 확인
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, match_date, end_time")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      throw new ApiError(404, "매치를 찾을 수 없습니다", "MATCH_NOT_FOUND");
    }

    // 매치가 종료되었는지 확인
    const matchEndTime = new Date(`${match.match_date} ${match.end_time}`);
    if (matchEndTime > new Date()) {
      throw new ApiError(
        400,
        "아직 종료되지 않은 매치입니다",
        "MATCH_NOT_COMPLETED"
      );
    }

    // 리뷰어가 매치 참가자인지 확인
    const { data: reviewerParticipation } = await supabase
      .from("match_participants")
      .select("id")
      .eq("match_id", matchId)
      .eq("user_id", reviewerId)
      .eq("status", "confirmed")
      .single();

    if (!reviewerParticipation) {
      throw new ApiError(
        403,
        "매치 참가자만 리뷰할 수 있습니다",
        "NOT_PARTICIPANT"
      );
    }

    // 리뷰 대상이 매치 참가자인지 확인
    const { data: revieweeParticipation } = await supabase
      .from("match_participants")
      .select("id")
      .eq("match_id", matchId)
      .eq("user_id", reviewData.revieweeId)
      .eq("status", "confirmed")
      .single();

    if (!revieweeParticipation) {
      throw new ApiError(
        404,
        "리뷰 대상이 매치 참가자가 아닙니다",
        "REVIEWEE_NOT_PARTICIPANT"
      );
    }

    // 자기 자신 리뷰 방지
    if (reviewerId === reviewData.revieweeId) {
      throw new ApiError(
        400,
        "자기 자신을 리뷰할 수 없습니다",
        "CANNOT_REVIEW_SELF"
      );
    }

    // 중복 리뷰 확인
    const { data: existingReview } = await supabase
      .from("match_reviews")
      .select("id")
      .eq("match_id", matchId)
      .eq("reviewer_id", reviewerId)
      .eq("reviewee_id", reviewData.revieweeId)
      .single();

    if (existingReview) {
      throw new ApiError(409, "이미 리뷰를 작성했습니다", "ALREADY_REVIEWED");
    }

    // 리뷰 저장
    const { error: insertError } = await supabase.from("match_reviews").insert({
      match_id: matchId,
      reviewer_id: reviewerId,
      reviewee_id: reviewData.revieweeId,
      rating: reviewData.isPositive ? 5 : 2, // 좋아요는 5점, 싫어요는 2점
      comment: reviewData.comment || null,
    });

    if (insertError) {
      logger.error("Failed to insert review:", insertError);
      throw new ApiError(500, "리뷰 저장 실패", "REVIEW_INSERT_ERROR");
    }

    // 리뷰 대상자의 통계 업데이트
    await updateUserReviewStats(
      reviewData.revieweeId,
      reviewData.ntrp,
      reviewData.isPositive
    );

    logger.info("Review submitted:", {
      matchId,
      reviewerId,
      revieweeId: reviewData.revieweeId,
    });

    return ResponseHelper.success(res, null, "리뷰가 제출되었습니다");
  }),

  // 사용자가 받은 리뷰 조회
  getUserReviews: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;

    const { data: reviews, error } = await supabase
      .from("match_reviews")
      .select(
        `
        id,
        rating,
        comment,
        created_at,
        matches!inner(id, title, match_date),
        users!reviewer_id(id, name, nickname)
      `
      )
      .eq("reviewee_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch user reviews:", error);
      throw new ApiError(500, "리뷰 조회 실패", "REVIEW_FETCH_ERROR");
    }

    const formattedReviews =
      reviews?.map((review: any) => {
        const match = Array.isArray(review.matches)
          ? review.matches[0]
          : review.matches;
        const reviewer = Array.isArray(review.users)
          ? review.users[0]
          : review.users;

        return {
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.created_at,
          match: {
            id: match?.id,
            title: match?.title,
            date: match?.match_date,
          },
          reviewer: {
            id: reviewer?.id,
            name: reviewer?.nickname || reviewer?.name,
          },
        };
      }) || [];

    return ResponseHelper.success(res, formattedReviews);
  }),
};

// 사용자 리뷰 통계 업데이트 함수
async function updateUserReviewStats(
  userId: string,
  ntrp: number,
  isPositive: boolean
) {
  try {
    // 현재 사용자 통계 조회
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("total_reviews, positive_reviews, negative_reviews, review_ntrp")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      logger.error("Failed to fetch user stats:", userError);
      return;
    }

    const totalReviews = (user.total_reviews || 0) + 1;
    const positiveReviews = user.positive_reviews || 0;
    const negativeReviews = user.negative_reviews || 0;

    const newPositiveReviews = isPositive
      ? positiveReviews + 1
      : positiveReviews;
    const newNegativeReviews = !isPositive
      ? negativeReviews + 1
      : negativeReviews;

    // NTRP 평균 계산 (기존 평균과 새 점수의 가중평균)
    const currentNtrp = user.review_ntrp || ntrp;
    const newNtrp = (currentNtrp * (totalReviews - 1) + ntrp) / totalReviews;

    // 통계 업데이트
    const { error: updateError } = await supabase
      .from("users")
      .update({
        total_reviews: totalReviews,
        positive_reviews: newPositiveReviews,
        negative_reviews: newNegativeReviews,
        review_ntrp: Math.round(newNtrp * 10) / 10, // 소수점 첫째자리까지
      })
      .eq("id", userId);

    if (updateError) {
      logger.error("Failed to update user stats:", updateError);
    }
  } catch (error) {
    logger.error("Error updating user review stats:", error);
  }
}

// 게임 타입 포맷팅
function formatGameType(gameType: string): string {
  const typeMap: Record<string, string> = {
    singles: "단식",
    mens_doubles: "남복",
    womens_doubles: "여복",
    mixed_doubles: "혼복",
  };
  return typeMap[gameType] || gameType;
}
