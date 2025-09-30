import { Request, Response } from "express";
import { AuthRequest } from "../types/auth";
import { supabase } from "../lib/supabase";
import { ApiError } from "../utils/errors";
import { logger } from "../config/logger";
import { NotificationService } from "../services/notificationService";
import {
  FeaturedPostService,
  FeaturedPost,
} from "../services/featuredPostService";
import { z } from "zod";

// 하위호환성을 위한 데이터 변환 함수들
const addCamelCaseFields = (post: any) => {
  return {
    ...post,
    // snake_case -> camelCase 매핑 추가
    likes_count: post.likes,
    likesCount: post.likes,
    commentsCount: post.comments_count,
    viewsCount: post.views || 0,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    author: post.author
      ? {
          ...post.author,
          profileImageUrl: post.author.profile_image_url,
          profile_image_url: post.author.profile_image_url,
        }
      : null,
  };
};

const addCommentCamelCaseFields = (comment: any) => {
  return {
    ...comment,
    likes_count: comment.likes,
    likesCount: comment.likes,
    createdAt: comment.created_at,
    author: comment.author
      ? {
          ...comment.author,
          profileImageUrl: comment.author.profile_image_url,
          profile_image_url: comment.author.profile_image_url,
        }
      : null,
  };
};

// Validation schemas
const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  category: z.enum([
    "free",
    "tips",
    "equipment",
    "match",
    "question",
    "announcement",
  ]),
  images: z.array(z.string()).max(10).optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  parent_id: z.string().uuid().optional(),
});

const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  images: z.array(z.string()).max(10).optional(),
});

// 인기 게시글 조회
export const getFeaturedPosts = async (req: Request, res: Response) => {
  try {
    const featuredPosts: FeaturedPost[] =
      await FeaturedPostService.getCurrentFeaturedPosts();

    res.json({
      success: true,
      data: featuredPosts,
    });
  } catch (error: any) {
    logger.error("인기 게시글 조회 실패:", error);

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 게시글 목록 조회
export const getPosts = async (req: Request, res: Response) => {
  try {
    const {
      category,
      search,
      sort = "latest",
      page = "1",
      limit = "10",
      includeFeatured = "true", // 인기 게시글 포함 여부
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from("posts")
      .select(
        `
        id,
        title,
        content,
        category,
        attachments,
        likes,
        comments_count,
        created_at,
        updated_at,
        author:author_id(
          id,
          nickname,
          profile_image_url
        )
      `
      )
      .eq("is_active", true)
      .eq("is_deleted", false)
      .range(offset, offset + Number(limit) - 1);

    // 카테고리 필터
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    // 검색
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    // 정렬
    if (sort === "latest") {
      query = query.order("created_at", { ascending: false });
    } else if (sort === "popular") {
      query = query.order("likes", { ascending: false });
    } else if (sort === "comments") {
      query = query.order("comments_count", { ascending: false });
    }

    const { data: posts, error, count } = await query;

    if (error) {
      logger.error("게시글 조회 실패:", error);
      throw new ApiError(
        500,
        "게시글 조회 실패",
        "DATABASE_ERROR",
        true,
        error
      );
    }

    // 총 개수 조회
    let countQuery = supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_deleted", false);

    if (category && category !== "all") {
      countQuery = countQuery.eq("category", category);
    }

    if (search) {
      countQuery = countQuery.or(
        `title.ilike.%${search}%,content.ilike.%${search}%`
      );
    }

    const { count: totalCount } = await countQuery;

    const totalPages = Math.ceil((totalCount || 0) / Number(limit));

    // 첫 페이지이고 includeFeatured가 true인 경우 인기 게시글 조회
    let featuredPosts: FeaturedPost[] = [];
    if (
      Number(page) === 1 &&
      includeFeatured === "true" &&
      !search &&
      !category
    ) {
      featuredPosts = await FeaturedPostService.getCurrentFeaturedPosts();
    }

    // 하위호환성을 위해 camelCase 필드 추가
    const transformedPosts = posts?.map(addCamelCaseFields) || [];
    const transformedFeaturedPosts = featuredPosts.map((post) =>
      addCamelCaseFields(post)
    );

    res.json({
      success: true,
      data: transformedPosts,
      featuredPosts: transformedFeaturedPosts, // 인기 게시글 별도 반환
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount || 0,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error: any) {
    logger.error("게시글 목록 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 게시글 상세 조회
export const getPost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as AuthRequest).userId;

    const { data: post, error } = await supabase
      .from("posts")
      .select(
        `
        id,
        title,
        content,
        category,
        attachments,
        likes,
        comments_count,
        views,
        created_at,
        updated_at,
        author:author_id(
          id,
          nickname,
          profile_image_url,
          ntrp,
          experience_years
        )
      `
      )
      .eq("id", postId)
      .eq("is_active", true)
      .eq("is_deleted", false)
      .single();

    if (error || !post) {
      throw new ApiError(404, "게시글을 찾을 수 없습니다", "POST_NOT_FOUND");
    }

    // 조회수 증가
    await supabase
      .from("posts")
      .update({
        views: (post.views || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    // 좋아요 여부 확인 (로그인한 경우)
    let isLiked = false;
    if (userId) {
      const { data: like } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .single();

      isLiked = !!like;
    }

    // 하위호환성을 위해 camelCase 필드 추가
    const transformedPost = addCamelCaseFields({
      ...post,
      views: (post.views || 0) + 1,
    });

    res.json({
      success: true,
      data: {
        ...transformedPost,
        isLiked,
      },
    });
  } catch (error: any) {
    logger.error("게시글 상세 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 게시글 작성
export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const validation = createPostSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ApiError(400, "입력값이 올바르지 않습니다", "VALIDATION_ERROR");
    }

    const { title, content, category, images } = validation.data;

    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        title,
        content,
        category,
        attachments: images
          ? images.map((url) => ({ type: "image", url }))
          : [],
        author_id: userId,
      })
      .select("id")
      .single();

    if (error) {
      throw new ApiError(
        500,
        "게시글 작성 실패",
        "DATABASE_ERROR",
        true,
        error
      );
    }

    res.status(201).json({
      success: true,
      data: {
        id: post.id,
        message: "게시글이 작성되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("게시글 작성 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 게시글 수정
export const updatePost = async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    const validation = updatePostSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ApiError(400, "입력값이 올바르지 않습니다", "VALIDATION_ERROR");
    }

    // 게시글 소유자 확인
    const { data: post, error: fetchError } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", postId)
      .single();

    if (fetchError || !post) {
      throw new ApiError(404, "게시글을 찾을 수 없습니다", "POST_NOT_FOUND");
    }

    if (post.author_id !== userId) {
      throw new ApiError(403, "게시글을 수정할 권한이 없습니다", "FORBIDDEN");
    }

    const updateData = {
      ...validation.data,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("posts")
      .update(updateData)
      .eq("id", postId);

    if (error) {
      throw new ApiError(
        500,
        "게시글 수정 실패",
        "DATABASE_ERROR",
        true,
        error
      );
    }

    res.json({
      success: true,
      data: {
        message: "게시글이 수정되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("게시글 수정 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 게시글 삭제
export const deletePost = async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    // 게시글 소유자 확인
    const { data: post, error: fetchError } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", postId)
      .single();

    if (fetchError || !post) {
      throw new ApiError(404, "게시글을 찾을 수 없습니다", "POST_NOT_FOUND");
    }

    if (post.author_id !== userId) {
      throw new ApiError(403, "게시글을 삭제할 권한이 없습니다", "FORBIDDEN");
    }

    const { error } = await supabase.from("posts").delete().eq("id", postId);

    if (error) {
      throw new ApiError(
        500,
        "게시글 삭제 실패",
        "DATABASE_ERROR",
        true,
        error
      );
    }

    res.json({
      success: true,
      data: {
        message: "게시글이 삭제되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("게시글 삭제 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 게시글 좋아요
export const likePost = async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    // 이미 좋아요 했는지 확인
    const { data: existingLike } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .single();

    if (existingLike) {
      throw new ApiError(400, "이미 좋아요한 게시글입니다", "ALREADY_LIKED");
    }

    // 게시글 정보와 작성자 정보 조회
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select(
        `
        id,
        title,
        author_id,
        author:author_id(
          nickname
        )
      `
      )
      .eq("id", postId)
      .single();

    if (postError || !post) {
      throw new ApiError(404, "게시글을 찾을 수 없습니다", "POST_NOT_FOUND");
    }

    // 좋아요한 사용자 정보 조회
    const { data: liker, error: likerError } = await supabase
      .from("users")
      .select("nickname")
      .eq("id", userId)
      .single();

    if (likerError || !liker) {
      throw new ApiError(404, "사용자를 찾을 수 없습니다", "USER_NOT_FOUND");
    }

    // 좋아요 추가
    const { error: likeError } = await supabase.from("post_likes").insert({
      post_id: postId,
      user_id: userId,
    });

    if (likeError) {
      throw new ApiError(
        500,
        "좋아요 추가 실패",
        "DATABASE_ERROR",
        true,
        likeError
      );
    }

    // 좋아요 수 증가
    const { error: updateError } = await supabase.rpc("increment_post_likes", {
      post_id: postId,
    });

    if (updateError) {
      // 좋아요 롤백
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);

      throw new ApiError(
        500,
        "좋아요 수 업데이트 실패",
        "DATABASE_ERROR",
        true,
        updateError
      );
    }

    // 자신의 게시글이 아닌 경우에만 알림 발송
    if (post.author_id !== userId) {
      await NotificationService.createPostLikeNotification(
        postId,
        post.title,
        post.author_id,
        liker.nickname
      );
    }

    res.json({
      success: true,
      data: {
        message: "게시글에 좋아요를 추가했습니다",
      },
    });
  } catch (error: any) {
    logger.error("게시글 좋아요 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 게시글 좋아요 취소
export const unlikePost = async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    // 좋아요 삭제
    const { error: deleteError } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);

    if (deleteError) {
      throw new ApiError(
        500,
        "좋아요 취소 실패",
        "DATABASE_ERROR",
        true,
        deleteError
      );
    }

    // 좋아요 수 감소
    const { error: updateError } = await supabase.rpc("decrement_post_likes", {
      post_id: postId,
    });

    if (updateError) {
      logger.error("좋아요 수 감소 실패:", updateError);
    }

    res.json({
      success: true,
      data: {
        message: "게시글 좋아요를 취소했습니다",
      },
    });
  } catch (error: any) {
    logger.error("게시글 좋아요 취소 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 댓글 목록 조회
export const getComments = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { page = "1", limit = "20" } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const {
      data: comments,
      error,
      count,
    } = await supabase
      .from("comments")
      .select(
        `
        id,
        content,
        likes,
        created_at,
        updated_at,
        parent_id,
        author:author_id(
          id,
          nickname,
          profile_image_url
        )
      `,
        { count: "exact" }
      )
      .eq("post_id", postId)
      .is("parent_id", null)
      .eq("is_active", true)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      throw new ApiError(500, "댓글 조회 실패", "DATABASE_ERROR", true, error);
    }

    // 각 댓글의 대댓글 조회
    const commentsWithReplies = await Promise.all(
      (comments || []).map(async (comment) => {
        const { data: replies } = await supabase
          .from("comments")
          .select(
            `
            id,
            content,
            likes,
            created_at,
            updated_at,
            author:author_id(
              id,
              nickname,
              profile_image_url
            )
          `
          )
          .eq("parent_id", comment.id)
          .eq("is_active", true)
          .eq("is_deleted", false)
          .order("created_at", { ascending: true });

        return {
          ...addCommentCamelCaseFields(comment),
          replies: (replies || []).map(addCommentCamelCaseFields),
        };
      })
    );

    const totalPages = Math.ceil((count || 0) / Number(limit));

    res.json({
      success: true,
      data: commentsWithReplies,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error: any) {
    logger.error("댓글 목록 조회 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 댓글 작성
export const createComment = async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    const validation = createCommentSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ApiError(400, "입력값이 올바르지 않습니다", "VALIDATION_ERROR");
    }

    const { content, parent_id } = validation.data;

    // 게시글 존재 확인 및 작성자 정보 조회
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select(
        `
        id,
        title,
        author_id,
        author:author_id(
          nickname
        )
      `
      )
      .eq("id", postId)
      .eq("is_active", true)
      .eq("is_deleted", false)
      .single();

    if (postError || !post) {
      throw new ApiError(404, "게시글을 찾을 수 없습니다", "POST_NOT_FOUND");
    }

    // 댓글 작성자 정보 조회
    const { data: commenter, error: commenterError } = await supabase
      .from("users")
      .select("nickname")
      .eq("id", userId)
      .single();

    if (commenterError || !commenter) {
      throw new ApiError(404, "사용자를 찾을 수 없습니다", "USER_NOT_FOUND");
    }

    let parentCommentAuthor = null;

    // 대댓글인 경우 부모 댓글 확인
    if (parent_id) {
      const { data: parentComment, error: parentError } = await supabase
        .from("comments")
        .select(
          `
          id,
          author_id,
          author:author_id(
            nickname
          )
        `
        )
        .eq("id", parent_id)
        .eq("post_id", postId)
        .single();

      if (parentError || !parentComment) {
        throw new ApiError(
          404,
          "부모 댓글을 찾을 수 없습니다",
          "PARENT_COMMENT_NOT_FOUND"
        );
      }

      parentCommentAuthor = parentComment;
    }

    const { data: comment, error } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        author_id: userId,
        content,
        parent_id: parent_id,
      })
      .select("id")
      .single();

    if (error) {
      throw new ApiError(500, "댓글 작성 실패", "DATABASE_ERROR", true, error);
    }

    // 알림 발송
    if (parent_id && parentCommentAuthor) {
      // 대댓글인 경우 - 부모 댓글 작성자에게 알림 (자신의 댓글이 아닌 경우에만)
      if (parentCommentAuthor.author_id !== userId) {
        await NotificationService.createReplyNotification(
          postId,
          post.title,
          parentCommentAuthor.author_id,
          commenter.nickname,
          content
        );
      }
    } else {
      // 일반 댓글인 경우 - 게시글 작성자에게 알림 (자신의 게시글이 아닌 경우에만)
      if (post.author_id !== userId) {
        await NotificationService.createCommentNotification(
          postId,
          post.title,
          post.author_id,
          commenter.nickname,
          content
        );
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: comment.id,
        message: "댓글이 작성되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("댓글 작성 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

// 댓글 삭제
export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId!;

    // 댓글 소유자 확인
    const { data: comment, error: fetchError } = await supabase
      .from("comments")
      .select("author_id, post_id, parent_id")
      .eq("id", commentId)
      .single();

    if (fetchError || !comment) {
      throw new ApiError(404, "댓글을 찾을 수 없습니다", "COMMENT_NOT_FOUND");
    }

    if (comment.author_id !== userId) {
      throw new ApiError(403, "댓글을 삭제할 권한이 없습니다", "FORBIDDEN");
    }

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      throw new ApiError(500, "댓글 삭제 실패", "DATABASE_ERROR", true, error);
    }

    res.json({
      success: true,
      data: {
        message: "댓글이 삭제되었습니다",
      },
    });
  } catch (error: any) {
    logger.error("댓글 삭제 실패:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류가 발생했습니다",
      },
    });
  }
};

export const communityController = {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  getComments,
  createComment,
  deleteComment,
  getFeaturedPosts, // 추가
};
