import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';

// 미들웨어 및 설정
import { corsOptions, helmetConfig, rateLimitConfig, requestLogger } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './config/logger';

// 라우터
import routes from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 보안 미들웨어
app.use(helmetConfig);
app.use(cors(corsOptions));
app.use(rateLimitConfig);

// 요청 로깅
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
} else {
  app.use(morgan('dev'));
  app.use(requestLogger);
}

// 압축 및 파싱
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 헬스 체크
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'WeHand Tennis Server API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API 라우터
app.use('/api', routes);

// 404 핸들러
app.use(notFoundHandler);

// 에러 핸들러 (마지막에 위치)
app.use(errorHandler);

// 서버 시작
app.listen(PORT, () => {
  logger.info(`🎾 WeHand Tennis Server가 포트 ${PORT}에서 실행 중입니다`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Database: Supabase`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM 신호를 받았습니다. 서버를 종료합니다...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT 신호를 받았습니다. 서버를 종료합니다...');
  process.exit(0);
});

export default app;