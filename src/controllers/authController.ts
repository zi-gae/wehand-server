import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { ResponseHelper } from '../utils/response';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export const authController = {
  // 11.1 이메일 로그인
  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, '이메일과 비밀번호는 필수입니다', 'MISSING_CREDENTIALS');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      logger.warn('Login failed:', { email, error: error.message });
      throw new ApiError(401, '이메일 또는 비밀번호가 올바르지 않습니다', 'INVALID_CREDENTIALS');
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name, nickname, profile_image_url')
      .eq('id', data.user.id)
      .single();

    if (userError) {
      logger.error('User data fetch error:', userError);
    }

    if (!data.session || !data.user) {
      throw new ApiError(500, '로그인 세션 생성 실패', 'SESSION_CREATION_ERROR');
    }

    logger.info('User logged in:', { userId: data.user.id, email });

    return ResponseHelper.success(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: userData?.name || null,
        nickname: userData?.nickname || null,
        profileImage: userData?.profile_image_url || null
      }
    });
  }),

  // 11.2 토큰 갱신
  refresh: asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ApiError(400, '리프레시 토큰이 필요합니다', 'MISSING_REFRESH_TOKEN');
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error || !data.session || !data.user) {
      logger.warn('Token refresh failed:', { error: error?.message });
      throw new ApiError(401, '유효하지 않은 리프레시 토큰입니다', 'INVALID_REFRESH_TOKEN');
    }

    return ResponseHelper.success(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });
  }),

  // 11.3 카카오 로그인
  kakaoLogin: asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body;

    if (!code) {
      throw new ApiError(400, '카카오 인증 코드가 필요합니다', 'MISSING_AUTH_CODE');
    }

    try {
      // 카카오 토큰 교환
      const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.KAKAO_CLIENT_ID!,
          client_secret: process.env.KAKAO_CLIENT_SECRET!,
          code,
          redirect_uri: process.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/auth/kakao/callback'
        })
      });

      if (!tokenResponse.ok) {
        throw new ApiError(400, '유효하지 않은 인증 코드입니다', 'INVALID_AUTH_CODE');
      }

      const tokenData = await tokenResponse.json() as any;

      // 카카오 사용자 정보 조회
      const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      if (!userResponse.ok) {
        throw new ApiError(500, '카카오 사용자 정보 조회 실패', 'KAKAO_USER_INFO_ERROR');
      }

      const kakaoUser = await userResponse.json() as any;
      const email = kakaoUser.kakao_account?.email;
      const name = kakaoUser.kakao_account?.profile?.nickname;
      const profileImage = kakaoUser.kakao_account?.profile?.profile_image_url;

      if (!email) {
        throw new ApiError(400, '카카오 계정에서 이메일 정보를 가져올 수 없습니다', 'MISSING_EMAIL');
      }

      // Supabase에서 기존 사용자 확인
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('email', email)
        .single();

      let isNewUser = false;
      let userData = existingUser;

      if (!existingUser) {
        // 새 사용자 생성 (Supabase Auth)
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password: Math.random().toString(36) // 임시 비밀번호
        });

        if (signUpError) {
          logger.error('Kakao signup error:', signUpError);
          throw new ApiError(500, '카카오 회원가입 처리 중 오류가 발생했습니다', 'SIGNUP_ERROR');
        }

        // 사용자 정보 저장
        const { data: newUserData, error: insertError } = await supabase
          .from('users')
          .insert({
            id: signUpData.user!.id,
            email,
            name: name || email.split('@')[0],
            provider: 'kakao',
            provider_id: kakaoUser.id.toString(),
            profile_image_url: profileImage
          })
          .select()
          .single();

        if (insertError) {
          logger.error('User insert error:', insertError);
          throw new ApiError(500, '사용자 정보 저장 실패', 'USER_INSERT_ERROR');
        }

        userData = newUserData;
        isNewUser = true;
      }

      // Supabase 세션 생성
      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
        email,
        password: Math.random().toString(36) // 실제로는 별도 처리 필요
      });

      logger.info('Kakao login successful:', { userId: userData?.id, email, isNewUser });

      return ResponseHelper.success(res, {
        accessToken: tokenData.access_token, // 실제로는 Supabase JWT 토큰 사용
        refreshToken: tokenData.refresh_token,
        user: {
          id: userData?.id,
          email,
          name: userData?.name,
          profileImage,
          isNewUser
        }
      });

    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Kakao login error:', error);
      throw new ApiError(500, '카카오 로그인 처리 중 오류가 발생했습니다', 'KAKAO_LOGIN_ERROR');
    }
  }),

  // 11.4 로그아웃
  logout: asyncHandler(async (req: Request, res: Response) => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error('Logout error:', error);
      throw new ApiError(500, '로그아웃 처리 중 오류가 발생했습니다', 'LOGOUT_ERROR');
    }

    logger.info('User logged out:', { userId: req.user?.id });

    return ResponseHelper.success(res, null, '로그아웃되었습니다');
  }),

  // 회원가입
  signup: asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      throw new ApiError(400, '이메일, 비밀번호, 이름은 필수입니다', 'MISSING_REQUIRED_FIELDS');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name
        }
      }
    });

    if (error) {
      logger.warn('Signup failed:', { email, error: error.message });
      
      if (error.message.includes('already registered')) {
        throw new ApiError(409, '이미 가입된 이메일입니다', 'EMAIL_ALREADY_EXISTS');
      }
      
      throw new ApiError(400, error.message, 'SIGNUP_ERROR');
    }

    if (data.user) {
      // 사용자 테이블에 정보 저장
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email,
          name,
          provider: 'email'
        });

      if (insertError) {
        logger.error('User insert error:', insertError);
      }
    }

    logger.info('User signed up:', { userId: data.user?.id, email });

    return ResponseHelper.created(res, {
      message: '회원가입이 완료되었습니다. 이메일 인증을 확인해주세요.',
      user: {
        id: data.user?.id,
        email
      }
    });
  }),

  // 현재 사용자 정보 조회
  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, '인증이 필요합니다', 'AUTHENTICATION_REQUIRED');
    }

    const { data: userData, error } = await supabase
      .from('users')
      .select(`
        id, email, name, nickname, location, bio, profile_image_url,
        ntrp, experience_years, favorite_style, created_at,
        total_matches, wins, losses, win_rate
      `)
      .eq('id', req.user.id)
      .single();

    if (error) {
      logger.error('User fetch error:', error);
      throw new ApiError(404, '사용자 정보를 찾을 수 없습니다', 'USER_NOT_FOUND');
    }

    return ResponseHelper.success(res, userData);
  })
};