import { Router } from "express";
import { logFromClient } from "../controllers/logController";
import { optionalAuth } from "../middleware/auth";

const router = Router();

// 클라이언트 로깅 엔드포인트 (인증 선택적)
router.post("/client", optionalAuth, logFromClient);

export default router;