import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export class ApiError extends Error implements AppError {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(statusCode: number, message: string, code?: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { statusCode = 500, message, code } = error;

  if (!error.isOperational) {
    logger.error('Unexpected Error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    statusCode = 500;
    message = '서버 내부 오류가 발생했습니다';
    code = 'INTERNAL_SERVER_ERROR';
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    success: false,
    error: {
      code: code || 'UNKNOWN_ERROR',
      message,
      ...(isDevelopment && { stack: error.stack }),
      ...(isDevelopment && { details: error })
    }
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new ApiError(404, `경로를 찾을 수 없습니다: ${req.originalUrl}`, 'NOT_FOUND');
  next(error);
};

export const validationErrorHandler = (error: any) => {
  if (error.name === 'ZodError') {
    const message = error.errors.map((err: any) => 
      `${err.path.join('.')}: ${err.message}`
    ).join(', ');
    
    return new ApiError(400, `입력 데이터 검증 실패: ${message}`, 'VALIDATION_ERROR');
  }

  return error;
};