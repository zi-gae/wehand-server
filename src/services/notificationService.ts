import { supabase } from "../lib/supabase";
import { logger } from "../config/logger";

export class NotificationService {
  /**
   * 게시글 좋아요 알림
   */
  static async createPostLikeNotification(
    postId: string,
    postTitle: string,
    authorId: string,
    likerNickname: string
  ) {
    try {
      // 사용자 알림 설정 확인
      const shouldSend = await this.checkNotificationSettings(
        authorId,
        "community"
      );
      if (!shouldSend) return;

      const { error } = await supabase.from("notifications").insert({
        user_id: authorId,
        type: "community",
        title: "게시글에 좋아요를 받았습니다",
        message: `"${postTitle}" 게시글에 좋아요를 눌렀습니다.`,
        post_id: postId,
        action_data: {
          type: "navigate",
          screen: "PostDetail",
          params: { postId },
        },
      });

      if (error) {
        logger.error("게시글 좋아요 알림 생성 실패:", error);
      } else {
        logger.info(`게시글 좋아요 알림 생성 성공: ${authorId}`);
      }
    } catch (error) {
      logger.error("게시글 좋아요 알림 처리 중 오류:", error);
    }
  }

  /**
   * 댓글 알림
   */
  static async createCommentNotification(
    postId: string,
    postTitle: string,
    authorId: string,
    commenterNickname: string,
    commentContent: string
  ) {
    try {
      // 사용자 알림 설정 확인
      const shouldSend = await this.checkNotificationSettings(
        authorId,
        "community"
      );
      if (!shouldSend) return;

      // 댓글 내용이 길면 자르기
      const truncatedContent =
        commentContent.length > 50
          ? commentContent.substring(0, 50) + "..."
          : commentContent;

      const { error } = await supabase.from("notifications").insert({
        user_id: authorId,
        type: "community",
        title: "게시글에 댓글이 달렸습니다",
        message: `${commenterNickname}님이 "${postTitle}" 게시글에 댓글을 남겼습니다: "${truncatedContent}"`,
        post_id: postId,
        action_data: {
          type: "navigate",
          screen: "PostDetail",
          params: { postId },
        },
      });

      if (error) {
        logger.error("댓글 알림 생성 실패:", error);
      } else {
        logger.info(`댓글 알림 생성 성공: ${authorId}`);
      }
    } catch (error) {
      logger.error("댓글 알림 처리 중 오류:", error);
    }
  }

  /**
   * 대댓글 알림
   */
  static async createReplyNotification(
    postId: string,
    postTitle: string,
    parentCommentAuthorId: string,
    replierNickname: string,
    replyContent: string
  ) {
    try {
      // 사용자 알림 설정 확인
      const shouldSend = await this.checkNotificationSettings(
        parentCommentAuthorId,
        "community"
      );
      if (!shouldSend) return;

      // 대댓글 내용이 길면 자르기
      const truncatedContent =
        replyContent.length > 50
          ? replyContent.substring(0, 50) + "..."
          : replyContent;

      const { error } = await supabase.from("notifications").insert({
        user_id: parentCommentAuthorId,
        type: "community",
        title: "댓글에 답글이 달렸습니다",
        message: `회원님의 댓글에 답글을 남겼습니다: "${truncatedContent}"`,
        post_id: postId,
        action_data: {
          type: "navigate",
          screen: "PostDetail",
          params: { postId },
        },
      });

      if (error) {
        logger.error("대댓글 알림 생성 실패:", error);
      } else {
        logger.info(`대댓글 알림 생성 성공: ${parentCommentAuthorId}`);
      }
    } catch (error) {
      logger.error("대댓글 알림 처리 중 오류:", error);
    }
  }

  /**
   * 사용자의 알림 설정 확인
   */
  private static async checkNotificationSettings(
    userId: string,
    type: string
  ): Promise<boolean> {
    try {
      const { data: preferences } = await supabase
        .from("user_preferences")
        .select(
          "match_notifications, chat_notifications, marketing_notifications"
        )
        .eq("user_id", userId)
        .single();

      // 설정이 없으면 기본적으로 알림 발송 (community는 기본 true)
      if (!preferences) {
        return type !== "marketing";
      }

      // community 타입은 일반적으로 match_notifications 설정을 따름
      // 또는 별도 community_notifications 설정이 있다면 사용
      switch (type) {
        case "match":
          return preferences.match_notifications ?? true;
        case "chat":
          return preferences.chat_notifications ?? true;
        case "community":
          return preferences.match_notifications ?? true; // community는 match 설정을 따름
        case "marketing":
          return preferences.marketing_notifications ?? false;
        case "system":
          return true; // 시스템 알림은 항상 발송
        default:
          return true;
      }
    } catch (error) {
      logger.error("알림 설정 확인 실패:", error);
      return true; // 오류 시 기본적으로 발송
    }
  }

  /**
   * 매치 관련 알림 (기존 기능 유지)
   */
  static async createMatchNotification(
    userId: string,
    title: string,
    message: string,
    matchId: string,
    actionData?: any
  ) {
    try {
      const shouldSend = await this.checkNotificationSettings(userId, "match");
      if (!shouldSend) return;

      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        type: "match",
        title,
        message,
        match_id: matchId,
        action_data: actionData || {
          type: "navigate",
          screen: "MatchDetail",
          params: { matchId },
        },
      });

      if (error) {
        logger.error("매치 알림 생성 실패:", error);
      }
    } catch (error) {
      logger.error("매치 알림 처리 중 오류:", error);
    }
  }
}
