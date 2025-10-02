import { Request, Response } from "express";
import { supabase } from "../../lib/supabase";
import { ResponseHelper } from "../../utils/response";
import { ApiError, asyncHandler } from "../../middleware/errorHandler";
import { uuidSchema } from "../../utils/validation";

// 3.3 매치 북마크
export const bookmarkMatch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
  }

  const matchId = uuidSchema.parse(req.params.matchId);
  const userId = req.user.id;

  // 기존 북마크 확인
  const { data: existingBookmark } = await supabase
    .from("match_bookmarks")
    .select("id")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .single();

  if (existingBookmark) {
    throw new ApiError(409, "이미 북마크된 매치입니다", "ALREADY_BOOKMARKED");
  }

  const { error } = await supabase.from("match_bookmarks").insert({
    match_id: matchId,
    user_id: userId,
  });

  if (error) {
    throw new ApiError(
      500,
      "북마크 저장 중 오류가 발생했습니다",
      "BOOKMARK_ERROR"
    );
  }

  return ResponseHelper.success(res, null, "북마크에 추가되었습니다");
});

// 3.3 매치 북마크 해제
export const unbookmarkMatch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "인증이 필요합니다", "AUTHENTICATION_REQUIRED");
  }

  const matchId = uuidSchema.parse(req.params.matchId);
  const userId = req.user.id;

  const { error } = await supabase
    .from("match_bookmarks")
    .delete()
    .eq("match_id", matchId)
    .eq("user_id", userId);

  if (error) {
    throw new ApiError(
      500,
      "북마크 해제 중 오류가 발생했습니다",
      "UNBOOKMARK_ERROR"
    );
  }

  return ResponseHelper.success(res, null, "북마크에서 제거되었습니다");
});