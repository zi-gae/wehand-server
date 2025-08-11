import { NotificationService } from "../services/notificationService";
import { logger } from "../config/logger";

/**
 * 커뮤니티 알림 기능 테스트 헬퍼
 * 이 파일은 개발/테스트 용도로만 사용
 */
export class NotificationTestHelper {
  /**
   * 좋아요 알림 테스트
   */
  static async testLikeNotification() {
    try {
      await NotificationService.createPostLikeNotification(
        "test-post-1",
        "테니스 초보자 가이드",
        "user-1-uuid",
        "TestLiker"
      );
      logger.info("좋아요 알림 테스트 완료");
    } catch (error) {
      logger.error("좋아요 알림 테스트 실패:", error);
    }
  }

  /**
   * 댓글 알림 테스트
   */
  static async testCommentNotification() {
    try {
      await NotificationService.createCommentNotification(
        "test-post-1",
        "테니스 초보자 가이드",
        "user-1-uuid",
        "TestCommenter",
        "정말 유용한 정보네요! 테니스 배우는데 도움이 많이 될 것 같습니다."
      );
      logger.info("댓글 알림 테스트 완료");
    } catch (error) {
      logger.error("댓글 알림 테스트 실패:", error);
    }
  }

  /**
   * 대댓글 알림 테스트
   */
  static async testReplyNotification() {
    try {
      await NotificationService.createReplyNotification(
        "test-post-1",
        "테니스 초보자 가이드",
        "user-2-uuid",
        "TestReplier",
        "저도 그렇게 생각합니다! 추가로 도움이 필요하시면 언제든 말씀해주세요."
      );
      logger.info("대댓글 알림 테스트 완료");
    } catch (error) {
      logger.error("대댓글 알림 테스트 실패:", error);
    }
  }

  /**
   * 모든 알림 테스트 실행
   */
  static async runAllTests() {
    logger.info("커뮤니티 알림 기능 테스트 시작");

    await this.testLikeNotification();
    await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms 대기

    await this.testCommentNotification();
    await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms 대기

    await this.testReplyNotification();

    logger.info("커뮤니티 알림 기능 테스트 완료");
  }
}
