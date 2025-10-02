import { Request, Response } from "express";
import { supabase } from "../../lib/supabase";
import { ResponseHelper } from "../../utils/response";
import { ApiError, asyncHandler } from "../../middleware/errorHandler";
import { uuidSchema } from "../../utils/validation";
import { logger } from "../../config/logger";

// 4.2 매치 삭제
export const deleteMatch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
  }

  const matchId = uuidSchema.parse(req.params.matchId);
  const userId = req.user.id;

  // 매치 존재 및 호스트 권한 확인
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, host_id, status, title")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new ApiError(404, "매치를 찾을 수 없습니다", "MATCH_NOT_FOUND");
  }

  // 호스트만 삭제 가능
  if (match.host_id !== userId) {
    throw new ApiError(
      403,
      "매치 삭제 권한이 없습니다",
      "INSUFFICIENT_PERMISSION"
    );
  }

  // 진행 중이거나 완료된 매치는 삭제 불가
  if (match.status === "in_progress" || match.status === "completed") {
    throw new ApiError(
      400,
      "진행 중이거나 완료된 매치는 삭제할 수 없습니다",
      "CANNOT_DELETE_ACTIVE_MATCH"
    );
  }

  // 참가자가 있는 경우 확인된 참가자 수 조회
  const { data: participants } = await supabase
    .from("match_participants")
    .select("user_id")
    .eq("match_id", matchId)
    .eq("status", "confirmed")
    .neq("is_host", true); // 호스트 제외

  if (participants && participants.length > 0) {
    throw new ApiError(
      400,
      "참가자가 있는 매치는 삭제할 수 없습니다. 먼저 매치를 취소해주세요",
      "CANNOT_DELETE_MATCH_WITH_PARTICIPANTS"
    );
  }

  // 매치 관련 데이터 삭제 (CASCADE로 자동 삭제되지만 명시적으로 처리)
  try {
    // 1. 매치 참가자 삭제 (호스트 포함)
    await supabase
      .from("match_participants")
      .delete()
      .eq("match_id", matchId);

    // 2. 매치 북마크 삭제
    await supabase.from("match_bookmarks").delete().eq("match_id", matchId);

    // 3. 매치 관련 채팅방은 삭제하지만 메시지는 보존
    // 먼저 채팅방의 match_id를 null로 설정하여 매치와의 연결만 해제
    await supabase
      .from("chat_rooms")
      .update({ match_id: null })
      .eq("match_id", matchId);

    // 4. 매치 관련 알림 삭제
    await supabase.from("notifications").delete().eq("match_id", matchId);

    // 5. 매치 삭제
    const { error: deleteError } = await supabase
      .from("matches")
      .delete()
      .eq("id", matchId);

    if (deleteError) {
      throw deleteError;
    }

    logger.info("Match deleted:", {
      matchId,
      hostId: userId,
      title: match.title,
    });

    return ResponseHelper.success(res, null, "매치가 삭제되었습니다");
  } catch (error) {
    logger.error("Match deletion error:", error);
    throw new ApiError(
      500,
      "매치 삭제 중 오류가 발생했습니다",
      "MATCH_DELETION_ERROR"
    );
  }
});