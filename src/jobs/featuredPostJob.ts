import cron from "node-cron";
import { FeaturedPostService } from "../services/featuredPostService";
import { logger } from "../config/logger";

// 매일 오전 9시에 인기 게시글 선정
export const startFeaturedPostJob = () => {
  cron.schedule("0 9 * * *", async () => {
    logger.info("인기 게시글 선정 작업 시작");
    await FeaturedPostService.selectDailyFeaturedPosts();
  });

  logger.info("인기 게시글 선정 크론잡 등록됨");
};