import { z } from "zod";

// 공통 스키마들
export const uuidSchema = z.string().uuid("올바른 UUID 형식이 아닙니다");

export const paginationSchema = z
  .object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 10)),
  })
  .refine((data) => {
    return data.page >= 1 && data.limit >= 1 && data.limit <= 100;
  }, "페이지는 1 이상, limit는 1-100 사이여야 합니다");

// 사용자 관련 스키마
export const userUpdateSchema = z.object({
  name: z
    .string()
    .min(1, "이름은 필수입니다")
    .max(50, "이름은 50자 이하여야 합니다"),
  nickname: z
    .string()
    .min(2, "닉네임은 2자 이상이어야 합니다")
    .max(20, "닉네임은 20자 이하여야 합니다")
    .optional(),
  location: z.string().max(100, "지역은 100자 이하여야 합니다").optional(),
  bio: z.string().max(500, "소개는 500자 이하여야 합니다").optional(),
  ntrp: z
    .number()
    .min(1.0)
    .max(7.0, "NTRP는 1.0-7.0 사이여야 합니다")
    .optional(),
  experience_years: z
    .number()
    .min(0)
    .max(50, "구력은 0-50년 사이여야 합니다")
    .optional(),
  favorite_style: z
    .string()
    .max(100, "플레이 스타일은 100자 이하여야 합니다")
    .optional(),
});

// 매치 관련 스키마
export const matchCreateSchema = z
  .object({
    title: z
      .string()
      .min(1, "제목은 필수입니다")
      .max(100, "제목은 100자 이하여야 합니다"),
    description: z
      .string()
      .max(1000, "설명은 1000자 이하여야 합니다")
      .optional(),
    game_type: z.enum([
      "singles",
      "mens_doubles",
      "womens_doubles",
      "mixed_doubles",
    ]),
    venue_id: uuidSchema,
    court: z
      .string()
      .min(1, "코트 정보는 필수입니다")
      .max(50, "코트 정보는 50자 이하여야 합니다"),
    match_date: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)"
      ),
    start_time: z
      .string()
      .regex(
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        "시작 시간 형식이 올바르지 않습니다 (HH:MM)"
      ),
    end_time: z
      .string()
      .regex(
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        "종료 시간 형식이 올바르지 않습니다 (HH:MM)"
      ),
    max_participants: z
      .number()
      .int()
      .min(1)
      .max(10, "참가자는 1-10명 사이여야 합니다"),
    recruit_ntrp_min: z.number().min(1.0).max(7.0).optional(),
    recruit_ntrp_max: z.number().min(1.0).max(7.0).optional(),
    recruit_experience_min: z.number().int().min(0).optional(),
    recruit_experience_max: z.number().int().min(0).optional(),
    price: z.number().int().min(0, "가격은 0 이상이어야 합니다").optional(),
    rules: z
      .array(z.string().max(200, "규칙은 각각 200자 이하여야 합니다"))
      .max(10, "규칙은 최대 10개까지 가능합니다")
      .optional(),
    equipment: z
      .array(z.string().max(100, "장비명은 각각 100자 이하여야 합니다"))
      .max(20, "장비는 최대 20개까지 가능합니다")
      .optional(),
    parking_info: z
      .string()
      .max(200, "주차 정보는 200자 이하여야 합니다")
      .optional(),
  })
  .refine((data) => {
    if (data.recruit_ntrp_min && data.recruit_ntrp_max) {
      return data.recruit_ntrp_min <= data.recruit_ntrp_max;
    }
    return true;
  }, "NTRP 최소값은 최대값보다 작거나 같아야 합니다")
  .refine((data) => {
    if (data.recruit_experience_min && data.recruit_experience_max) {
      return data.recruit_experience_min <= data.recruit_experience_max;
    }
    return true;
  }, "구력 최소값은 최대값보다 작거나 같아야 합니다");

export const matchJoinSchema = z.object({
  message: z
    .string()
    .max(500, "참가 신청 메시지는 500자 이하여야 합니다")
    .optional(),
});

export const matchFilterSchema = z.object({
  search: z.string().max(100, "검색어는 100자 이하여야 합니다").optional(),
  region: z.string().max(100, "지역은 100자 이하여야 합니다").optional(),
  regions: z
    .union([
      z.string().transform((val) => val.split(",")),
      z.array(z.string()),
    ])
    .optional(),
  game_type: z
    .enum(["singles", "mens_doubles", "womens_doubles", "mixed_doubles"])
    .optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다")
    .optional(),
  date_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "시작 날짜 형식이 올바르지 않습니다")
    .optional(),
  date_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "종료 날짜 형식이 올바르지 않습니다")
    .optional(),
  time_start: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "시작 시간 형식이 올바르지 않습니다 (HH:MM)")
    .optional(),
  time_end: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "종료 시간 형식이 올바르지 않습니다 (HH:MM)")
    .optional(),
  ntrp_min: z
    .string()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .optional(),
  ntrp_max: z
    .string()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .optional(),
  experience_min: z
    .string()
    .transform((val) => (val ? parseInt(val) : undefined))
    .optional(),
  experience_max: z
    .string()
    .transform((val) => (val ? parseInt(val) : undefined))
    .optional(),
  sort: z.enum(["latest", "distance", "price"]).optional(),
  user_lat: z
    .string()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .optional(),
  user_lng: z
    .string()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .optional(),
  ...paginationSchema.shape,
});

// 게시글 관련 스키마
export const postCreateSchema = z.object({
  title: z
    .string()
    .min(1, "제목은 필수입니다")
    .max(200, "제목은 200자 이하여야 합니다"),
  content: z
    .string()
    .min(1, "내용은 필수입니다")
    .max(10000, "내용은 10000자 이하여야 합니다"),
  category: z.enum([
    "free",
    "tips",
    "equipment",
    "match",
    "question",
    "announcement",
  ]),
});

export const commentCreateSchema = z.object({
  content: z
    .string()
    .min(1, "댓글 내용은 필수입니다")
    .max(1000, "댓글은 1000자 이하여야 합니다"),
  parent_id: uuidSchema.optional(),
});

// 채팅 관련 스키마
export const messageCreateSchema = z.object({
  content: z
    .string()
    .min(1, "메시지 내용은 필수입니다")
    .max(2000, "메시지는 2000자 이하여야 합니다"),
  type: z.enum(["text", "image", "file"]).default("text"),
});

export const chatRoomCreateSchema = z.object({
  type: z.enum(["match", "private"]),
  name: z.string().max(100, "채팅방 이름은 100자 이하여야 합니다").optional(),
  participants: z
    .array(uuidSchema)
    .min(1, "참가자는 최소 1명 이상이어야 합니다")
    .max(50, "참가자는 최대 50명까지 가능합니다"),
});

// 유효성 검사 헬퍼 함수
export const validateRequest = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): T => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues
          .map((err: any) => `${err.path.join(".")}: ${err.message}`)
          .join(", ");
        throw new Error(`입력 데이터 검증 실패: ${message}`);
      }
      throw error;
    }
  };
};
