import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { ResponseHelper } from "../utils/response";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { logger } from "../config/logger";

export const authController = {
  // 11.1 이메일 로그인
  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(
        400,
        "이메일과 비밀번호는 필수입니다",
        "MISSING_CREDENTIALS"
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.warn("Login failed:", { email, error: error.message });
      throw new ApiError(
        401,
        "이메일 또는 비밀번호가 올바르지 않습니다",
        "INVALID_CREDENTIALS"
      );
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, name, nickname, profile_image_url")
      .eq("id", data.user.id)
      .single();

    if (userError) {
      logger.error("User data fetch error:", userError);
    }

    if (!data.session || !data.user) {
      throw new ApiError(
        500,
        "로그인 세션 생성 실패",
        "SESSION_CREATION_ERROR"
      );
    }

    logger.info("User logged in:", { userId: data.user.id, email });

    return ResponseHelper.success(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: userData?.name || null,
        nickname: userData?.nickname || null,
        profileImage: userData?.profile_image_url || null,
      },
    });
  }),

  // 11.2 토큰 갱신
  refresh: asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ApiError(
        400,
        "리프레시 토큰이 필요합니다",
        "MISSING_REFRESH_TOKEN"
      );
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      logger.warn("Token refresh failed:", { error: error?.message });
      throw new ApiError(
        401,
        "유효하지 않은 리프레시 토큰입니다",
        "INVALID_REFRESH_TOKEN"
      );
    }

    return ResponseHelper.success(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  }),

  // 11.4 로그아웃
  logout: asyncHandler(async (req: Request, res: Response) => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error("Logout error:", error);
      throw new ApiError(
        500,
        "로그아웃 처리 중 오류가 발생했습니다",
        "LOGOUT_ERROR"
      );
    }

    logger.info("User logged out:", { userId: req.user?.id });

    return ResponseHelper.success(res, null, "로그아웃되었습니다");
  }),

  // 회원가입
  signup: asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      throw new ApiError(
        400,
        "이메일, 비밀번호, 이름은 필수입니다",
        "MISSING_REQUIRED_FIELDS"
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error) {
      logger.warn("Signup failed:", { email, error: error.message });

      if (error.message.includes("already registered")) {
        throw new ApiError(
          409,
          "이미 가입된 이메일입니다",
          "EMAIL_ALREADY_EXISTS"
        );
      }

      throw new ApiError(400, error.message, "SIGNUP_ERROR");
    }

    if (data.user) {
      // 사용자 테이블에 정보 저장
      const { error: insertError } = await supabase.from("users").insert({
        id: data.user.id,
        email,
        name,
        provider: "email",
      });

      if (insertError) {
        logger.error("User insert error:", insertError);
      }
    }

    logger.info("User signed up:", { userId: data.user?.id, email });

    return ResponseHelper.created(res, {
      message: "회원가입이 완료되었습니다. 이메일 인증을 확인해주세요.",
      user: {
        id: data.user?.id,
        email,
      },
    });
  }),

  // 현재 사용자 정보 조회
  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
    }

    const { data: userData, error } = await supabase
      .from("users")
      .select(
        `
        id, email, name, nickname, location, bio, profile_image_url,
        ntrp, experience_years, favorite_style, created_at,
        total_matches, wins, losses, win_rate,
        total_reviews, positive_reviews, negative_reviews, review_ntrp
      `
      )
      .eq("id", req.user.id)
      .single();

    if (error) {
      logger.error("User fetch error:", error);
      throw new ApiError(
        404,
        "사용자 정보를 찾을 수 없습니다",
        "USER_NOT_FOUND"
      );
    }

    return ResponseHelper.success(res, userData);
  }),
};
