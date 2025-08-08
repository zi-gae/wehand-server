import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { createServer } from "http";
import { Server } from "socket.io";

// 개발 환경에서만 SSL 검증 비활성화 (보안상 프로덕션에서는 사용 금지)
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// 미들웨어 및 설정
import {
  corsOptions,
  helmetConfig,
  rateLimitConfig,
  requestLogger,
} from "./middleware/security";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { logger } from "./config/logger";
import { swaggerSpec } from "./config/swagger";

// 라우터
import routes from "./routes";
import { authenticateSocket } from "./middleware/auth";

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'https://wehand.tennis'
    ],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// 보안 미들웨어
app.use(helmetConfig);
app.use(cors(corsOptions));
app.use(rateLimitConfig);

// 요청 로깅
if (process.env.NODE_ENV === "production") {
  app.use(
    morgan("combined", {
      stream: { write: (message) => logger.info(message.trim()) },
    })
  );
} else {
  app.use(morgan("dev"));
  app.use(requestLogger);
}

// 압축 및 파싱
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 헬스 체크
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "WeHand Tennis Server API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Swagger Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "WeHand Tennis API",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: "none",
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  })
);

// Swagger JSON endpoint
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// API 라우터
app.use("/api", routes);

// 404 핸들러
app.use(notFoundHandler);

// 에러 핸들러 (마지막에 위치)
app.use(errorHandler);

// Socket.io 설정
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('인증 토큰이 필요합니다'));
    }
    
    const user = await authenticateSocket(token);
    socket.data.user = user;
    socket.data.userId = user.id;
    
    logger.info(`Socket 인증 성공: ${user.nickname} (${user.id})`);
    next();
  } catch (error: any) {
    logger.warn(`Socket 인증 실패: ${error.message}`);
    next(new Error('인증에 실패했습니다'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  logger.info(`사용자 연결됨: ${user.nickname} (${socket.id})`);
  
  // 채팅방 입장
  socket.on('join-chat-room', (roomId) => {
    socket.join(`chat-${roomId}`);
    logger.info(`${user.nickname}이 채팅방 ${roomId}에 입장`);
    
    // 다른 사용자들에게 입장 알림
    socket.to(`chat-${roomId}`).emit('user-joined', {
      userId: user.id,
      nickname: user.nickname,
      timestamp: new Date().toISOString()
    });
  });
  
  // 채팅방 퇴장
  socket.on('leave-chat-room', (roomId) => {
    socket.leave(`chat-${roomId}`);
    logger.info(`${user.nickname}이 채팅방 ${roomId}에서 퇴장`);
    
    // 다른 사용자들에게 퇴장 알림
    socket.to(`chat-${roomId}`).emit('user-left', {
      userId: user.id,
      nickname: user.nickname,
      timestamp: new Date().toISOString()
    });
  });
  
  // 타이핑 상태 전송
  socket.on('typing-start', (roomId) => {
    socket.to(`chat-${roomId}`).emit('user-typing', {
      userId: user.id,
      nickname: user.nickname,
      isTyping: true
    });
  });
  
  socket.on('typing-stop', (roomId) => {
    socket.to(`chat-${roomId}`).emit('user-typing', {
      userId: user.id,
      nickname: user.nickname,
      isTyping: false
    });
  });
  
  // 메시지 읽음 상태 업데이트
  socket.on('message-read', (data) => {
    socket.to(`chat-${data.roomId}`).emit('message-read-by', {
      userId: user.id,
      messageId: data.messageId,
      timestamp: new Date().toISOString()
    });
  });
  
  // 연결 해제
  socket.on('disconnect', () => {
    logger.info(`사용자 연결 해제됨: ${user.nickname} (${socket.id})`);
  });
  
  // 에러 처리
  socket.on('error', (error) => {
    logger.error(`Socket error for user ${user.nickname}:`, error);
  });
});

// 서버 시작
server.listen(PORT, () => {
  logger.info(`🎾 WeHand Tennis Server가 포트 ${PORT}에서 실행 중입니다`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Database: Supabase`);
  logger.info(`📚 API 문서: http://localhost:${PORT}/api-docs`);
  logger.info(`🔗 WebSocket: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM 신호를 받았습니다. 서버를 종료합니다...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT 신호를 받았습니다. 서버를 종료합니다...");
  process.exit(0);
});

export { app, server, io };
