import { Router } from "express";
import { communityController } from "../controllers/communityController";
import { requireAuth, optionalAuth } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /api/community/posts/featured:
 *   get:
 *     summary: 인기 게시글 조회
 *     description: 현재 선정된 인기 게시글 목록을 조회합니다. 24시간마다 자동으로 선정됩니다.
 *     tags: [Community]
 *     responses:
 *       200:
 *         description: 인기 게시글 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       featured_at:
 *                         type: string
 *                         format: date-time
 *                       expires_at:
 *                         type: string
 *                         format: date-time
 *                       featured_type:
 *                         type: string
 *                         example: daily
 *                       metrics:
 *                         type: object
 *                         properties:
 *                           likes:
 *                             type: number
 *                           comments:
 *                             type: number
 *                           views:
 *                             type: number
 *                           score:
 *                             type: number
 *                       post:
 *                         $ref: '#/components/schemas/Post'
 */
router.get("/posts/featured", communityController.getFeaturedPosts);

/**
 * @swagger
 * /api/community/posts:
 *   get:
 *     summary: 게시글 목록 조회
 *     tags: [Community]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [all, free, tips, equipment, match, question, announcement]
 *         description: 카테고리 필터 (all=전체, free=자유게시판, tips=팁/기술, equipment=장비, match=경기후기, question=질문, announcement=공지사항)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 검색어 (제목, 내용 검색)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [latest, popular, comments]
 *           default: latest
 *         description: 정렬 방식
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 게시글 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Post'
 *                 featuredPosts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FeaturedPost'
 *                   description: 인기 게시글 목록 (첫 페이지이고 필터가 없는 경우에만 포함)
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 */
router.get("/posts", communityController.getPosts);

/**
 * @swagger
 * /api/community/posts:
 *   post:
 *     summary: 게시글 작성
 *     tags: [Community]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePostRequest'
 *     responses:
 *       201:
 *         description: 게시글 작성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     message:
 *                       type: string
 *                       example: 게시글이 작성되었습니다
 */
router.post("/posts", requireAuth, communityController.createPost);

/**
 * @swagger
 * /api/community/posts/{postId}:
 *   get:
 *     summary: 게시글 상세 조회
 *     tags: [Community]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 ID
 *     responses:
 *       200:
 *         description: 게시글 상세 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PostDetail'
 *       404:
 *         description: 게시글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/posts/:postId", optionalAuth, communityController.getPost);

/**
 * @swagger
 * /api/community/posts/{postId}:
 *   put:
 *     summary: 게시글 수정
 *     tags: [Community]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePostRequest'
 *     responses:
 *       200:
 *         description: 게시글 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 게시글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/posts/:postId", requireAuth, communityController.updatePost);

/**
 * @swagger
 * /api/community/posts/{postId}:
 *   delete:
 *     summary: 게시글 삭제
 *     tags: [Community]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 ID
 *     responses:
 *       200:
 *         description: 게시글 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 게시글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/posts/:postId", requireAuth, communityController.deletePost);

/**
 * @swagger
 * /api/community/posts/{postId}/like:
 *   post:
 *     summary: 게시글 좋아요
 *     description: |
 *       게시글에 좋아요를 추가합니다.
 *
 *       **알림 기능:**
 *       - 자신의 게시글이 아닌 경우, 게시글 작성자에게 알림이 발송됩니다.
 *       - 알림 타입: `community`
 *       - 알림 제목: "게시글에 좋아요를 받았습니다"
 *       - 알림 내용: "{닉네임}님이 "{게시글 제목}" 게시글에 좋아요를 눌렀습니다."
 *       - 사용자의 커뮤니티 알림 설정에 따라 발송 여부가 결정됩니다.
 *     tags: [Community]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 ID
 *     responses:
 *       200:
 *         description: 좋아요 추가 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: 이미 좋아요한 게시글
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/posts/:postId/like", requireAuth, communityController.likePost);

/**
 * @swagger
 * /api/community/posts/{postId}/like:
 *   delete:
 *     summary: 게시글 좋아요 취소
 *     tags: [Community]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 ID
 *     responses:
 *       200:
 *         description: 좋아요 취소 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.delete(
  "/posts/:postId/like",
  requireAuth,
  communityController.unlikePost
);

/**
 * @swagger
 * /api/community/posts/{postId}/comments:
 *   get:
 *     summary: 댓글 목록 조회
 *     tags: [Community]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 댓글 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Comment'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 */
router.get("/posts/:postId/comments", communityController.getComments);

/**
 * @swagger
 * /api/community/posts/{postId}/comments:
 *   post:
 *     summary: 댓글 작성
 *     description: |
 *       게시글에 댓글을 작성합니다. 대댓글 작성도 가능합니다.
 *
 *       **알림 기능:**
 *       - **일반 댓글**: 자신의 게시글이 아닌 경우, 게시글 작성자에게 알림이 발송됩니다.
 *         - 알림 타입: `community`
 *         - 알림 제목: "게시글에 댓글이 달렸습니다"
 *         - 알림 내용: "{닉네임}님이 "{게시글 제목}" 게시글에 댓글을 남겼습니다: "{댓글 내용 50자}""
 *
 *       - **대댓글**: 자신의 댓글이 아닌 경우, 부모 댓글 작성자에게 알림이 발송됩니다.
 *         - 알림 타입: `community`
 *         - 알림 제목: "댓글에 답글이 달렸습니다"
 *         - 알림 내용: "{닉네임}님이 회원님의 댓글에 답글을 남겼습니다: "{답글 내용 50자}""
 *
 *       - 사용자의 커뮤니티 알림 설정에 따라 발송 여부가 결정됩니다.
 *     tags: [Community]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 게시글 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCommentRequest'
 *           examples:
 *             댓글:
 *               summary: 일반 댓글 작성
 *               value:
 *                 content: "좋은 정보 감사합니다!"
 *             대댓글:
 *               summary: 대댓글 작성
 *               value:
 *                 content: "저도 그렇게 생각합니다."
 *                 parent_id: "12345678-1234-1234-1234-123456789012"
 *     responses:
 *       201:
 *         description: 댓글 작성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     message:
 *                       type: string
 *                       example: 댓글이 작성되었습니다
 */
router.post(
  "/posts/:postId/comments",
  requireAuth,
  communityController.createComment
);

/**
 * @swagger
 * /api/community/comments/{commentId}:
 *   delete:
 *     summary: 댓글 삭제
 *     tags: [Community]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 댓글 ID
 *     responses:
 *       200:
 *         description: 댓글 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 댓글을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  "/comments/:commentId",
  requireAuth,
  communityController.deleteComment
);

export default router;
