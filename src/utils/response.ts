import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: PaginationInfo;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class ResponseHelper {
  static success<T>(res: Response, data?: T, message?: string, statusCode = 200): Response<ApiResponse<T>> {
    return res.status(statusCode).json({
      success: true,
      ...(data !== undefined && { data }),
      ...(message && { message })
    });
  }

  static successWithPagination<T>(
    res: Response, 
    data: T[], 
    pagination: PaginationInfo, 
    message?: string, 
    statusCode = 200
  ): Response<ApiResponse<T[]>> {
    return res.status(statusCode).json({
      success: true,
      data,
      pagination,
      ...(message && { message })
    });
  }

  static created<T>(res: Response, data?: T, message?: string): Response<ApiResponse<T>> {
    return res.status(201).json({
      success: true,
      ...(data !== undefined && { data }),
      message: message || '성공적으로 생성되었습니다'
    });
  }

  static noContent(res: Response, message?: string): Response {
    return res.status(204).json({
      success: true,
      ...(message && { message })
    });
  }

  static error(
    res: Response, 
    code: string, 
    message: string, 
    statusCode = 500, 
    details?: any
  ): Response<ErrorResponse> {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        ...(details && isDevelopment && { details })
      }
    });
  }

  static badRequest(res: Response, message: string, code = 'BAD_REQUEST', details?: any): Response<ErrorResponse> {
    return ResponseHelper.error(res, code, message, 400, details);
  }

  static unauthorized(res: Response, message: string = '인증이 필요합니다', code = 'UNAUTHORIZED'): Response<ErrorResponse> {
    return ResponseHelper.error(res, code, message, 401);
  }

  static forbidden(res: Response, message: string = '접근 권한이 없습니다', code = 'FORBIDDEN'): Response<ErrorResponse> {
    return ResponseHelper.error(res, code, message, 403);
  }

  static notFound(res: Response, message: string = '리소스를 찾을 수 없습니다', code = 'NOT_FOUND'): Response<ErrorResponse> {
    return ResponseHelper.error(res, code, message, 404);
  }

  static conflict(res: Response, message: string, code = 'CONFLICT'): Response<ErrorResponse> {
    return ResponseHelper.error(res, code, message, 409);
  }

  static internalError(res: Response, message: string = '서버 내부 오류가 발생했습니다', code = 'INTERNAL_ERROR'): Response<ErrorResponse> {
    return ResponseHelper.error(res, code, message, 500);
  }
}

export const createPagination = (
  page: number, 
  limit: number, 
  total: number
): PaginationInfo => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};