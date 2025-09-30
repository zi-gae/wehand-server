import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(1000),
  message_type: z.enum(["text", "image", "system"]).default("text"),
});

export const createChatRoomSchema = z.object({
  type: z.enum(["private", "match"]),
  participant_ids: z.array(z.string().uuid()).min(1).optional(),
  match_id: z.string().uuid().optional(),
  name: z.string().max(100).optional(),
});
