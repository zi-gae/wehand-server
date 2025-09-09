import { supabase } from "../lib/supabase";
import { logger } from "../config/logger";

interface ChatNotificationParams {
  chatRoomId: string;
  senderId?: string | null; // 시스템 메시지의 경우 null/undefined
  title?: string | null;
  messageId: string;
  content: string;
  type?:
    | "chat"
    | "system"
    | "match_approval_cancel"
    | "match_approval_request"
    | "match_approval_confirm";
}

export async function createChatMessageNotifications(
  params: ChatNotificationParams
) {
  const { chatRoomId, senderId, title, messageId, content, type } = params;

  // 활성 참가자 조회
  const { data: participants, error: partErr } = await supabase
    .from("chat_participants")
    .select("user_id")
    .eq("room_id", chatRoomId)
    .eq("is_active", true);

  if (partErr) {
    logger.error("알림 생성용 참가자 조회 실패:", partErr);
    return;
  }

  // 시스템 메시지는 보낸 사용자가 없으므로 모두 대상으로, 일반 메시지는 본인 제외
  const targetIds =
    participants
      ?.map((p) => p.user_id)
      .filter((id) => !senderId || id !== senderId) || [];
  if (!targetIds.length) return;

  // 사용자 preference 조회 (chat_notifications == false 인 사용자 제외)
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("user_id, chat_notifications")
    .in("user_id", targetIds);

  const allowed = new Set(
    targetIds.filter((id) => {
      const pref = prefs?.find((p) => p.user_id === id);
      // 설정 없거나 true(기본)면 허용, false면 제외
      return !(pref && pref.chat_notifications === false);
    })
  );
  if (!allowed.size) return;

  const shortContent =
    content.length > 80 ? content.slice(0, 77) + "..." : content;

  const rows = Array.from(allowed).map((userId) => ({
    user_id: userId,
    type,
    title: title || (senderId ? "새 메시지" : "시스템 알림"),
    message: shortContent,
    action_data: {
      chatRoomId,
      messageId,
    },
    is_read: false,
  }));

  const { error: insErr } = await supabase.from("notifications").insert(rows);

  if (insErr) {
    logger.error("채팅 알림 insert 실패:", insErr);
  }
}
