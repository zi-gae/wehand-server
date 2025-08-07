import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { ApiError } from './errorHandler';
import { logger } from '../config/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
        role?: string;
      };
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, '인증 토큰이 필요합니다', 'MISSING_TOKEN');
    }

    const token = authHeader.substring(7);
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      logger.warn('Invalid token attempt:', { 
        token: token.substring(0, 20) + '...', 
        error: error?.message,
        ip: req.ip 
      });
      throw new ApiError(401, '유효하지 않은 토큰입니다', 'INVALID_TOKEN');
    }

    // 사용자 정보를 데이터베이스에서 가져오기
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name, nickname')
      .eq('id', user.id)
      .single();

    if (userError) {
      logger.error('User lookup error:', { userId: user.id, error: userError });
      throw new ApiError(404, '사용자 정보를 찾을 수 없습니다', 'USER_NOT_FOUND');
    }

    req.user = {
      id: user.id,
      email: user.email || userData.email,
      name: userData.name,
      role: user.role || 'user'
    };

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      logger.error('Auth middleware error:', error);
      next(new ApiError(500, '인증 처리 중 오류가 발생했습니다', 'AUTH_ERROR'));
    }
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!error && user) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, name, nickname')
        .eq('id', user.id)
        .single();

      if (userData) {
        req.user = {
          id: user.id,
          email: user.email || userData.email,
          name: userData.name,
          role: user.role || 'user'
        };
      }
    }

    next();
  } catch (error) {
    logger.warn('Optional auth error:', error);
    next();
  }
};

export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, '인증이 필요합니다', 'AUTHENTICATION_REQUIRED');
    }

    if (!allowedRoles.includes(req.user.role || 'user')) {
      throw new ApiError(403, '접근 권한이 없습니다', 'INSUFFICIENT_PERMISSIONS');
    }

    next();
  };
};