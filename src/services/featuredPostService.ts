import { supabase } from "../lib/supabase";
import { logger } from "../config/logger";
import { pushNotificationController } from "../controllers/pushNotificationController";

// 타입 정의
export interface Author {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

export interface PostWithAuthor {
  id: string;
  title: string;
  content: string;
  category: string;
  attachments: any; // JSONB 타입
  likes: number;
  comments_count: number;
  views: number;
  created_at: string;
  author: Author;
}

export interface FeaturedPostMetrics {
  likes: number;
  comments: number;
  views: number;
  score: number;
}

export interface FeaturedPost {
  id: string;
  featured_at: string;
  expires_at: string;
  featured_type: string;
  metrics: FeaturedPostMetrics | null;
  post: PostWithAuthor | null;
}

export class FeaturedPostService {
  // 일일 인기 게시글 선정 (크론잡에서 실행)
  static async selectDailyFeaturedPosts() {
    try {
      // 지난 24시간 동안의 게시글 중 인기 게시글 선정
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // 인기도 계산: 좋아요 * 2 + 댓글 * 3 + 조회수
      const { data: topPosts, error } = await supabase
        .from("posts")
        .select(
          `
          id,
          title,
          content,
          category,
          likes,
          comments_count,
          views,
          author:author_id(
            id,
            nickname,
            profile_image_url
          )
        `
        )
        .gte("created_at", yesterday.toISOString())
        .eq("is_active", true)
        .eq("is_deleted", false)
        .order("likes", { ascending: false })
        .limit(5); // 상위 5개 선정

      if (error) {
        logger.error("인기 게시글 조회 실패:", error);
        return;
      }

      // 인기도 점수 계산 및 최고 점수 게시글 선택
      const postsWithScore = topPosts.map((post) => ({
        ...post,
        score:
          (post.likes || 0) * 2 +
          (post.comments_count || 0) * 3 +
          (post.views || 0),
      }));

      postsWithScore.sort((a, b) => b.score - a.score);
      const featuredPost = postsWithScore[0];

      if (!featuredPost) {
        logger.info("선정할 인기 게시글이 없습니다.");
        return;
      }

      // 기존 인기 게시글 해제
      await supabase
        .from("featured_posts")
        .update({ expires_at: new Date().toISOString() })
        .eq("featured_type", "daily")
        .lt("expires_at", new Date().toISOString());

      await supabase
        .from("posts")
        .update({ is_featured: false, featured_until: null })
        .eq("is_featured", true)
        .lt("featured_until", new Date().toISOString());

      // 새로운 인기 게시글 등록
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24시간 노출

      const { error: insertError } = await supabase
        .from("featured_posts")
        .insert({
          post_id: featuredPost.id,
          expires_at: expiresAt.toISOString(),
          featured_type: "daily",
          metrics: {
            likes: featuredPost.likes,
            comments: featuredPost.comments_count,
            views: featuredPost.views,
            score: featuredPost.score,
          },
        });

      if (insertError) {
        logger.error("인기 게시글 등록 실패:", insertError);
        return;
      }

      // posts 테이블 업데이트
      await supabase
        .from("posts")
        .update({
          is_featured: true,
          featured_until: expiresAt.toISOString(),
        })
        .eq("id", featuredPost.id);

      // 전체 사용자에게 푸시 알림 발송
      await pushNotificationController.sendFeaturedPostNotification(
        featuredPost
      );

      logger.info(`일일 인기 게시글 선정 완료: ${featuredPost.title}`);
    } catch (error) {
      logger.error("인기 게시글 선정 중 오류:", error);
    }
  }

  /**
   * 현재 활성화된 인기 게시글 목록을 조회합니다.
   * @returns {Promise<FeaturedPost[]>} 인기 게시글 배열
   */
  static async getCurrentFeaturedPosts(): Promise<FeaturedPost[]> {
    try {
      const { data, error } = await supabase
        .from("featured_posts")
        .select(
          `
          id,
          featured_at,
          expires_at,
          featured_type,
          metrics,
          post:post_id(
            id,
            title,
            content,
            category,
            attachments,
            likes,
            comments_count,
            views,
            created_at,
            author:author_id(
              id,
              nickname,
              profile_image_url
            )
          )
        `
        )
        .gt("expires_at", new Date().toISOString())
        .order("featured_at", { ascending: false });

      if (error) {
        logger.error("인기 게시글 조회 실패:", error);
        return [];
      }

      return (data as unknown as FeaturedPost[]) || [];
    } catch (error) {
      logger.error("인기 게시글 조회 중 오류:", error);
      return [];
    }
  }
}
