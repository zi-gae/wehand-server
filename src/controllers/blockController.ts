import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { ResponseHelper } from "../utils/response";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { logger } from "../config/logger";
import { AuthenticatedRequest } from "../types/auth";

export const blockController = {
  // 사용자 차단
  blockUser: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId: blockedId } = req.params;
    const { reason, reasonDetail } = req.body;
    const blockerId = req.user?.id;

    if (!blockerId) {
      throw new ApiError(401, "인증이 필요합니다", "UNAUTHORIZED");
    }

    if (!blockedId) {
      throw new ApiError(400, "차단할 사용자 ID가 필요합니다", "MISSING_USER_ID");
    }

    if (blockerId === blockedId) {
      throw new ApiError(400, "자기 자신을 차단할 수 없습니다", "SELF_BLOCK_NOT_ALLOWED");
    }

    // 차단할 사용자가 존재하는지 확인
    const { data: targetUser, error: userError } = await supabase
      .from("users")
      .select("id, name, nickname")
      .eq("id", blockedId)
      .eq("is_active", true)
      .single();

    if (userError || !targetUser) {
      logger.warn("Block attempt on non-existent user:", { blockerId, blockedId });
      throw new ApiError(404, "사용자를 찾을 수 없습니다", "USER_NOT_FOUND");
    }

    // 이미 차단된 사용자인지 확인
    const { data: existingBlock, error: checkError } = await supabase
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", blockerId)
      .eq("blocked_id", blockedId)
      .single();

    if (checkError && checkError.code !== "PGRST116") { // PGRST116 = no rows found
      logger.error("Block check error:", checkError);
      throw new ApiError(500, "차단 상태 확인 중 오류가 발생했습니다", "BLOCK_CHECK_ERROR");
    }

    if (existingBlock) {
      throw new ApiError(409, "이미 차단된 사용자입니다", "ALREADY_BLOCKED");
    }

    // 사용자 차단 생성
    const { data: blockData, error: blockError } = await supabase
      .from("user_blocks")
      .insert({
        blocker_id: blockerId,
        blocked_id: blockedId,
        reason: reason || null,
        reason_detail: reasonDetail || null
      })
      .select()
      .single();

    if (blockError) {
      logger.error("Block creation error:", blockError);
      throw new ApiError(500, "사용자 차단 중 오류가 발생했습니다", "BLOCK_CREATION_ERROR");
    }

    logger.info("User blocked successfully:", { blockerId, blockedId, blockId: blockData.id });

    return ResponseHelper.success(res, {
      message: `${targetUser.nickname || targetUser.name}님을 차단했습니다`,
      blockId: blockData.id
    });
  }),

  // 사용자 차단 해제
  unblockUser: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId: blockedId } = req.params;
    const blockerId = req.user?.id;

    if (!blockerId) {
      throw new ApiError(401, "인증이 필요합니다", "UNAUTHORIZED");
    }

    if (!blockedId) {
      throw new ApiError(400, "차단 해제할 사용자 ID가 필요합니다", "MISSING_USER_ID");
    }

    // 차단 관계 확인 및 삭제
    const { data: blockData, error: deleteError } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", blockerId)
      .eq("blocked_id", blockedId)
      .select("id, blocked_id")
      .single();

    if (deleteError) {
      if (deleteError.code === "PGRST116") { // no rows found
        throw new ApiError(404, "차단 관계를 찾을 수 없습니다", "BLOCK_NOT_FOUND");
      }
      logger.error("Unblock error:", deleteError);
      throw new ApiError(500, "차단 해제 중 오류가 발생했습니다", "UNBLOCK_ERROR");
    }

    // 차단 해제된 사용자 정보 조회
    const { data: targetUser } = await supabase
      .from("users")
      .select("name, nickname")
      .eq("id", blockedId)
      .single();

    logger.info("User unblocked successfully:", { blockerId, blockedId });

    return ResponseHelper.success(res, {
      message: `${targetUser?.nickname || targetUser?.name || '사용자'}님의 차단을 해제했습니다`
    });
  }),

  // 차단한 사용자 목록 조회
  getBlockedUsers: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const blockerId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;

    if (!blockerId) {
      throw new ApiError(401, "인증이 필요합니다", "UNAUTHORIZED");
    }

    const offset = (Number(page) - 1) * Number(limit);

    // 차단한 사용자 목록 조회 (뷰 사용)
    const { data: blockedUsers, error: listError } = await supabase
      .from("user_blocked_list")
      .select("*")
      .eq("blocker_id", blockerId)
      .order("created_at", { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (listError) {
      logger.error("Blocked users list error:", listError);
      throw new ApiError(500, "차단 목록 조회 중 오류가 발생했습니다", "BLOCKED_LIST_ERROR");
    }

    // 총 차단된 사용자 수 조회
    const { count, error: countError } = await supabase
      .from("user_blocks")
      .select("*", { count: "exact", head: true })
      .eq("blocker_id", blockerId);

    if (countError) {
      logger.error("Blocked users count error:", countError);
    }

    return ResponseHelper.success(res, {
      blockedUsers: blockedUsers || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  }),

  // 특정 사용자와의 차단 상태 확인
  checkBlockStatus: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId: otherUserId } = req.params;
    const currentUserId = req.user?.id;

    if (!currentUserId) {
      throw new ApiError(401, "인증이 필요합니다", "UNAUTHORIZED");
    }

    if (!otherUserId) {
      throw new ApiError(400, "확인할 사용자 ID가 필요합니다", "MISSING_USER_ID");
    }

    // 양방향 차단 상태 확인
    const { data: blockStatus, error: statusError } = await supabase
      .rpc('is_blocked_either_way', {
        user1_uuid: currentUserId,
        user2_uuid: otherUserId
      });

    if (statusError) {
      logger.error("Block status check error:", statusError);
      throw new ApiError(500, "차단 상태 확인 중 오류가 발생했습니다", "BLOCK_STATUS_ERROR");
    }

    // 구체적인 차단 상태 확인
    const { data: myBlock } = await supabase
      .from("user_blocks")
      .select("id, reason, created_at")
      .eq("blocker_id", currentUserId)
      .eq("blocked_id", otherUserId)
      .single();

    const { data: theirBlock } = await supabase
      .from("user_blocks")
      .select("id, reason, created_at")
      .eq("blocker_id", otherUserId)
      .eq("blocked_id", currentUserId)
      .single();

    return ResponseHelper.success(res, {
      isBlocked: blockStatus === true,
      iBlockedThem: !!myBlock,
      theyBlockedMe: !!theirBlock,
      myBlock: myBlock ? {
        id: myBlock.id,
        reason: myBlock.reason,
        blockedAt: myBlock.created_at
      } : null,
      theirBlock: theirBlock ? {
        id: theirBlock.id,
        reason: theirBlock.reason,
        blockedAt: theirBlock.created_at
      } : null
    });
  }),

  // 차단 사유 목록 조회 (상수)
  getBlockReasons: asyncHandler(async (req: Request, res: Response) => {
    const blockReasons = [
      { code: 'spam', label: '스팸/광고' },
      { code: 'harassment', label: '괴롭힘/욕설' },
      { code: 'inappropriate_behavior', label: '부적절한 행동' },
      { code: 'fake_profile', label: '가짜 프로필' },
      { code: 'no_show', label: '노쇼/약속 불이행' },
      { code: 'other', label: '기타' }
    ];

    return ResponseHelper.success(res, {
      reasons: blockReasons
    });
  })
};