import { Request, Response } from "express";
import { supabase } from "../../lib/supabase";
import { ResponseHelper } from "../../utils/response";
import { ApiError, asyncHandler } from "../../middleware/errorHandler";
import { uuidSchema } from "../../utils/validation";
import { formatPrice } from "../../utils/helpers";
import { formatGameType } from "./utils";

// 3.2 매치 공유
export const shareMatch = asyncHandler(async (req: Request, res: Response) => {
  const matchId = uuidSchema.parse(req.params.matchId);

  const { data: match, error } = await supabase
    .from("matches")
    .select("id, title, game_type, price")
    .eq("id", matchId)
    .single();

  if (error || !match) {
    throw new ApiError(404, "매치를 찾을 수 없습니다", "MATCH_NOT_FOUND");
  }

  const shareData = {
    shareUrl: `https://wehand.tennis/matches/${match.id}`,
    title: match.title,
    description: `${formatGameType(match.game_type)} • ${
      match.price ? formatPrice(match.price) : "무료"
    }`,
  };

  return ResponseHelper.success(res, shareData);
});