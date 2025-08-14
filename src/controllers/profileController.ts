import { Request, Response } from "express";
import { AuthRequest } from "../types/auth";
import { supabase } from "../lib/supabase";
import { ApiError } from "../utils/errors";
import { logger } from "../config/logger";
import { z } from "zod";

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  nickname: z.string().min(2).max(20).optional(),
  location: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  profile_image_url: z.string().url().optional(),
  ntrp: z.number().min(1.0).max(7.0).optional(),
  experience_years: z.number().min(0).max(50).optional(),
  favorite_style: z.string().max(100).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

// 내 프로필 조회
export const getMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    console.log("내 프로필 조회 요청:", { userId });
    const { data: user, error } = await supabase
      .from("users")
      .select(
        `
      id,
      email,
      name,
      nickname,
      location,
      bio,
      profile_image_url,
      gender,
      ntrp,
      experience_years,
      favorite_style,
      created_at,
      updated_at
      `
      )
      .eq("id", userId)
      .single();

    if (error || !user) {
      logger.error("사용자 조회 실패:", { userId, error });
      throw new ApiError(404, "사용자를 찾을 수 없습니다", "USER_NOT_FOUND");
    }

    // 통계 정보 조회
    const [
      { data: matches, error: matchesError },
      { data: wins, error: winsError },
      { data: reviews, error: reviewsError },
    ] = await Promise.all([
      // 총 매치 수
      supabase
        .from("match_participants")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "confirmed"),

      // 승리 수
      supabase
        .from("match_results")
        .select("id", { count: "exact", head: true })
        .eq("winner_id", userId),

      // 리뷰 정보
      supabase.from("match_reviews").select("rating").eq("reviewee_id", userId),
    ]);

    if (matchesError || winsError || reviewsError) {
      logger.error("통계 정보 조회 실패:", {
        matchesError,
        winsError,
        reviewsError,
      });
    }

    const totalMatches = matches?.length || 0;
    const totalWins = wins?.length || 0;
    const winRate =
      totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

    // 리뷰 분석
    const totalReviews = reviews?.length || 0;
    const positiveReviews = reviews?.filter((r) => r.rating >= 4).length || 0;
    const negativeReviews = reviews?.filter((r) => r.rating < 3).length || 0;
    const avgRating =
      totalReviews > 0 && reviews
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
        : null;

    res.json({
      success: true,
      data: {
        userInfo: user,
        stats: {
          totalMatches,
          wins: totalWins,
          losses: totalMatches - totalWins,
          winRate,
          ranking: null, // TODO: 랭킹 시스템 구현 후 업데이트
        },
        reviews: {
          totalReviews,
          positiveReviews,
          negativeReviews,
          avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        },
      },
    });
  } catch (error: any) {
    logger.error("내 프로필 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 프로필 수정
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const validation = updateProfileSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ApiError(400, "입력값이 올바르지 않습니다", "VALIDATION_ERROR");
    }

    // 닉네임 중복 확인
    if (validation.data.nickname) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("nickname", validation.data.nickname)
        .neq("id", userId)
        .single();

      if (existingUser) {
        throw new ApiError(
          400,
          "이미 사용 중인 닉네임입니다",
          "NICKNAME_EXISTS"
        );
      }
    }

    const updateData = {
      ...validation.data,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId);

    if (error) {
      throw new ApiError(
        500,
        "프로필 수정 실패",
        "DATABASE_ERROR",
        true,
        error
      );
    }

    res.json({
      success: true,
      data: {
        message: "프로필이 수정되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("프로필 수정 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 다른 사용자 프로필 조회
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { data: user, error } = await supabase
      .from("users")
      .select(
        `
        id,
        name,
        nickname,
        location,
        bio,
        profile_image_url,
        gender,
        ntrp,
        experience_years,
        favorite_style,
        created_at
      `
      )
      .eq("id", userId)
      .single();

    if (error || !user) {
      throw new ApiError(404, "사용자를 찾을 수 없습니다", "USER_NOT_FOUND");
    }

    // 공개 통계 정보 조회
    const [{ data: matches }, { data: wins }, { data: reviews }] =
      await Promise.all([
        supabase
          .from("match_participants")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "confirmed"),

        supabase
          .from("match_results")
          .select("id", { count: "exact", head: true })
          .eq("winner_id", userId),

        supabase
          .from("match_reviews")
          .select("rating")
          .eq("reviewee_id", userId),
      ]);

    const totalMatches = matches?.length || 0;
    const totalWins = wins?.length || 0;
    const winRate =
      totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

    const totalReviews = reviews?.length || 0;
    const positiveReviews = reviews?.filter((r) => r.rating >= 4).length || 0;
    const negativeReviews = reviews?.filter((r) => r.rating < 3).length || 0;
    const avgRating =
      totalReviews > 0 && reviews
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
        : null;

    res.json({
      success: true,
      data: {
        userInfo: user,
        stats: {
          totalMatches,
          wins: totalWins,
          losses: totalMatches - totalWins,
          winRate,
        },
        reviews: {
          totalReviews,
          positiveReviews,
          negativeReviews,
          avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        },
      },
    });
  } catch (error: any) {
    logger.error("사용자 프로필 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 내 매치 기록 조회
export const getMyMatches = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { status, type = "all", page = "1", limit = "10" } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from("match_participants")
      .select(
        `
        id,
        status,
        joined_at,
        match:match_id(
          id,
          title,
          game_type,
          match_date,
          start_time,
          end_time,
          status,
          venue:venue_id(
            name,
            address
          )
        )
      `
      )
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    // 상태 필터
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // 타입 필터 (upcoming: 예정된 매치, past: 지난 매치)
    if (type === "upcoming") {
      query = query.gte(
        "match.match_date",
        new Date().toISOString().split("T")[0]
      );
    } else if (type === "past") {
      query = query.lt(
        "match.match_date",
        new Date().toISOString().split("T")[0]
      );
    }

    const { data: matchParticipants, error, count } = await query;

    if (error) {
      throw new ApiError(
        500,
        "매치 기록 조회 실패",
        "DATABASE_ERROR",
        true,
        error
      );
    }

    const totalPages = Math.ceil((count || 0) / Number(limit));

    res.json({
      success: true,
      data: matchParticipants,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error: any) {
    logger.error("내 매치 기록 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 내가 받은 리뷰 조회
export const getMyReviews = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { page = "1", limit = "10" } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const {
      data: reviews,
      error,
      count,
    } = await supabase
      .from("match_reviews")
      .select(
        `
        id,
        rating,
        comment,
        created_at,
        reviewer:reviewer_id(
          id,
          nickname,
          name,
          profile_image_url
        ),
        match:match_id(
          id,
          title,
          match_date
        )
      `,
        { count: "exact" }
      )
      .eq("reviewee_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      throw new ApiError(500, "리뷰 조회 실패", "DATABASE_ERROR", true, error);
    }

    const totalPages = Math.ceil((count || 0) / Number(limit));

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error: any) {
    logger.error("내 리뷰 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 북마크한 매치 조회
export const getBookmarkedMatches = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { page = "1", limit = "10" } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const {
      data: bookmarks,
      error,
      count,
    } = await supabase
      .from("match_bookmarks")
      .select(
        `
        id,
        created_at,
        match:match_id(
          id,
          title,
          game_type,
          match_date,
          start_time,
          end_time,
          status,
          current_participants,
          max_participants,
          venue:venue_id(
            name,
            address
          ),
          host:host_id(
            nickname,
            ntrp
          )
        )
      `,
        { count: "exact" }
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      throw new ApiError(
        500,
        "북마크 조회 실패",
        "DATABASE_ERROR",
        true,
        error
      );
    }

    const totalPages = Math.ceil((count || 0) / Number(limit));

    res.json({
      success: true,
      data: bookmarks,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error: any) {
    logger.error("북마크 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};


// 특정 사용자의 리뷰 조회 (공개)
export const getUserReviews = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = "1", limit = "10" } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const {
      data: reviews,
      error,
      count,
    } = await supabase
      .from("match_reviews")
      .select(
        `
        id,
        rating,
        comment,
        created_at,
        reviewer:reviewer_id(
          id,
          nickname,
          name,
          profile_image_url
        ),
        match:match_id(
          id,
          title,
          match_date
        )
      `,
        { count: "exact" }
      )
      .eq("reviewee_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      throw new ApiError(500, "리뷰 조회 실패", "DATABASE_ERROR", true, error);
    }

    const totalPages = Math.ceil((count || 0) / Number(limit));

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error: any) {
    logger.error("사용자 리뷰 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

export const profileController = {
  getMyProfile,
  updateProfile,
  getUserProfile,
  getMyMatches,
  getMyReviews,
  getUserReviews,
  getBookmarkedMatches,
};
