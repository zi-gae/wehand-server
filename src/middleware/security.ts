import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

export const corsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://wehand.zigae.com",
    ];

    // iOS/Android 모바일 앱에서의 요청 허용
    const isMobileAppOrigin =
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.startsWith("capacitor://") ||
      origin.startsWith("file://") ||
      origin.includes("10.0.2.2") || // Android 에뮬레이터
      origin.includes("localhost");

    if (isMobileAppOrigin) {
      callback(null, true);
    } else {
      callback(new Error(`CORS 정책에 의해 차단된 요청입니다. ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://api.supabase.co",
        "wss://realtime.supabase.co",
      ],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

export const rateLimitConfig = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: process.env.NODE_ENV === "production" ? 1000 : 1000, // 요청 제한
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // 인증 시도 제한
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      message: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.",
    },
  },
});

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    console.log(
      `${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });

  next();
};
