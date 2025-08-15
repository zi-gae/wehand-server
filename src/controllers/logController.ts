import { Request, Response } from "express";
import { logger } from "../config/logger";

export const logFromClient = async (req: Request, res: Response) => {
  try {
    const { level = "info", message, data, error, userAgent, timestamp } = req.body;
    
    // 클라이언트 정보 추가
    const clientInfo = {
      ip: req.ip,
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: userAgent || req.headers["user-agent"],
      timestamp: timestamp || new Date().toISOString(),
    };

    // 로그 레벨에 따라 로깅
    const logMessage = `[CLIENT] ${message}`;
    const logData = {
      ...clientInfo,
      data,
      error,
      userId: req.userId || "anonymous",
    };

    switch (level) {
      case "error":
        logger.error(logMessage, logData);
        break;
      case "warn":
        logger.warn(logMessage, logData);
        break;
      case "debug":
        logger.debug(logMessage, logData);
        break;
      default:
        logger.info(logMessage, logData);
    }

    // 콘솔에도 출력 (개발 환경)
    if (process.env.NODE_ENV !== "production") {
      console.log(`📱 [${level.toUpperCase()}] ${message}`, {
        data,
        error,
        ...clientInfo,
      });
    }

    res.status(200).json({ 
      success: true, 
      message: "로그가 기록되었습니다" 
    });
  } catch (error) {
    logger.error("클라이언트 로깅 처리 중 오류:", error);
    res.status(500).json({ 
      success: false, 
      error: "로그 기록 실패" 
    });
  }
};