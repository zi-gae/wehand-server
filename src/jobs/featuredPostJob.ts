import cron from "node-cron";
import { FeaturedPostService } from "../services/featuredPostService";
import { logger } from "../config/logger";

// 매일 오후 7시와 오후 11시 30분에 인기 게시글 선정
export const startFeaturedPostJob = () => {
  // 매일 오후 7시 (19:00)
  cron.schedule("0 19 * * *", async () => {
    logger.info("인기 게시글 선정 작업 시작 (오후 7시)");
    await FeaturedPostService.selectDailyFeaturedPosts();
  });

  // 매일 오전 11시 30분 (11:30)
  cron.schedule("30 11 * * *", async () => {
    logger.info("인기 게시글 선정 작업 시작 (오전 11시 30분)");
    await FeaturedPostService.selectDailyFeaturedPosts();
  });

  logger.info("인기 게시글 선정 크론잡 2개 등록됨 (오후 7시, 오전 11시 30분)");
};
