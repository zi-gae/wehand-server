import swaggerJSDoc from "swagger-jsdoc";
import { Options } from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "WeHand Tennis API",
    version: "1.0.0",
    description: "WeHand 테니스 매칭 앱 API 문서",
    contact: {
      name: "WeHand Team",
      email: "support@wehand.tennis",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "개발 서버",
    },
    {
      url: "https://api.wehand.tennis",
      description: "프로덕션 서버",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Supabase JWT 토큰을 입력하세요",
      },
    },
    schemas: {
      // =============================================
      // 공통 응답 스키마
      // =============================================
      SuccessResponse: {
        type: "object",
        required: ["success"],
        properties: {
          success: {
            type: "boolean",
            example: true,
            description: "요청 성공 여부",
          },
          data: {
            type: "object",
            description: "응답 데이터 (성공 시 포함)",
          },
          message: {
            type: "string",
            description: "성공 메시지 (선택적)",
            example: "요청이 성공적으로 처리되었습니다",
          },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: {
            type: "boolean",
            example: false,
            description: "요청 실패를 나타냄",
          },
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: {
                type: "string",
                example: "ERROR_CODE",
                description: "에러 코드 (프로그래밍 처리용)",
              },
              message: {
                type: "string",
                example: "오류 메시지",
                description: "사용자에게 표시할 에러 메시지",
              },
              details: {
                type: "object",
                description: "추가 에러 정보 (개발 환경에서만 표시)",
              },
            },
          },
        },
      },
      PaginationInfo: {
        type: "object",
        required: [
          "page",
          "limit",
          "total",
          "totalPages",
          "hasNext",
          "hasPrev",
        ],
        properties: {
          page: {
            type: "integer",
            example: 1,
            description: "현재 페이지 번호 (1부터 시작)",
          },
          limit: {
            type: "integer",
            example: 10,
            description: "페이지당 항목 수",
          },
          total: {
            type: "integer",
            example: 100,
            description: "전체 항목 수",
          },
          totalPages: {
            type: "integer",
            example: 10,
            description: "전체 페이지 수",
          },
          hasNext: {
            type: "boolean",
            example: true,
            description: "다음 페이지 존재 여부",
          },
          hasPrev: {
            type: "boolean",
            example: false,
            description: "이전 페이지 존재 여부",
          },
        },
      },

      // =============================================
      // 사용자 관련 스키마
      // =============================================
      User: {
        type: "object",
        required: ["id", "email"],
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "550e8400-e29b-41d4-a716-446655440000",
            description: "사용자 고유 ID (UUID)",
          },
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
            description: "사용자 이메일 주소",
          },
          name: {
            type: "string",
            example: "김테니스",
            description: "사용자 실명",
          },
          nickname: {
            type: "string",
            example: "TennisKing",
            description: "사용자 닉네임 (고유값)",
            maxLength: 20,
          },
          location: {
            type: "string",
            example: "서울시 강남구",
            description: "사용자 활동 지역",
          },
          bio: {
            type: "string",
            example: "테니스를 사랑하는 주말 플레이어입니다",
            description: "자기소개",
            maxLength: 500,
          },
          profileImageUrl: {
            type: "string",
            format: "uri",
            example: "https://example.com/profile.jpg",
            description: "프로필 이미지 URL",
          },
          gender: {
            type: "string",
            enum: ["male", "female", "other"],
            example: "male",
            description: "성별 (male, female, other)",
          },
          ntrp: {
            type: "number",
            format: "float",
            minimum: 1.0,
            maximum: 7.0,
            example: 4.0,
            description: "NTRP 레벨 (1.0-7.0)",
          },
          experience_years: {
            type: "integer",
            minimum: 0,
            maximum: 50,
            example: 5,
            description: "테니스 경력 (년)",
          },
          favorite_style: {
            type: "string",
            example: "공격적 베이스라인",
            description: "선호하는 플레이 스타일",
          },
          total_reviews: {
            type: "integer",
            example: 12,
            description: "받은 리뷰 총 개수",
          },
          positive_reviews: {
            type: "integer",
            example: 9,
            description: "긍정적 리뷰 수",
          },
          negative_reviews: {
            type: "integer",
            example: 3,
            description: "부정적 리뷰 수",
          },
          review_ntrp: {
            type: "number",
            example: 4.2,
            description: "리뷰 기반 평균 NTRP",
          },
        },
      },

      UserProfile: {
        type: "object",
        properties: {
          userInfo: {
            $ref: "#/components/schemas/User",
          },
          stats: {
            type: "object",
            required: ["totalMatches", "wins", "losses", "winRate"],
            properties: {
              totalMatches: {
                type: "integer",
                example: 47,
                description: "총 경기 수",
              },
              wins: {
                type: "integer",
                example: 32,
                description: "승리 수",
              },
              losses: {
                type: "integer",
                example: 15,
                description: "패배 수",
              },
              winRate: {
                type: "number",
                example: 68,
                description: "승률 (%)",
              },
              ranking: {
                type: "integer",
                example: 127,
                description: "전체 랭킹",
              },
            },
          },
          reviews: {
            type: "object",
            properties: {
              totalReviews: {
                type: "integer",
                example: 23,
                description: "받은 리뷰 총 개수",
              },
              positiveReviews: {
                type: "integer",
                example: 19,
                description: "긍정적 리뷰 수",
              },
              negativeReviews: {
                type: "integer",
                example: 4,
                description: "부정적 리뷰 수",
              },
              avgRating: {
                type: "number",
                example: 4.1,
                description: "평균 평점",
              },
            },
          },
        },
      },

      // =============================================
      // 매치 관련 스키마
      // =============================================
      Match: {
        type: "object",
        required: [
          "id",
          "title",
          "location",
          "court",
          "date",
          "startTime",
          "endTime",
          "gameType",
          "status",
        ],
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "매치 고유 ID",
          },
          title: {
            type: "string",
            example: "즐거운 주말 단식 매치",
            description: "매치 제목",
            maxLength: 100,
          },
          location: {
            type: "string",
            example: "올림픽공원 테니스장",
            description: "테니스장 이름",
          },
          court: {
            type: "string",
            example: "1번 코트",
            description: "코트 번호/이름",
          },
          address: {
            type: "string",
            example: "서울특별시 송파구 올림픽로 424",
            description: "테니스장 주소",
          },
          date: {
            type: "string",
            example: "01/15",
            description: "경기 날짜 (MM/DD 형식)",
          },
          startTime: {
            type: "string",
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
            example: "14:00",
            description: "시작 시간 (HH:MM)",
          },
          endTime: {
            type: "string",
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
            example: "16:00",
            description: "종료 시간 (HH:MM)",
          },
          participants: {
            type: "string",
            example: "2/4",
            description: "참가자 현황 (현재/최대)",
          },
          gameType: {
            type: "string",
            enum: ["단식", "남복", "여복", "혼복"],
            example: "단식",
            description: "경기 유형",
          },
          level: {
            type: "string",
            example: "중급",
            description: "레벨 (초급/초중급/중급/중상급/상급)",
          },
          price: {
            type: "string",
            example: "20,000원",
            description: "참가비 (무료 또는 금액)",
          },
          status: {
            type: "string",
            enum: ["recruiting", "full", "confirmed", "completed", "cancelled"],
            example: "recruiting",
            description:
              "매치 상태 (recruiting: 모집중, full: 마감, confirmed: 확정, completed: 완료, cancelled: 취소)",
          },
          hostName: {
            type: "string",
            example: "김테니스",
            description: "호스트 이름",
          },
          hostId: {
            type: "string",
            format: "uuid",
            example: "550e8400-e29b-41d4-a716-446655440000",
            description: "호스트 사용자 ID",
          },
          hostNtrp: {
            type: "string",
            example: "4.0",
            description: "호스트 NTRP 레벨",
          },
          hostExperience: {
            type: "string",
            example: "3년",
            description: "호스트 경력",
          },
          description: {
            type: "string",
            example: "함께 즐겁게 테니스 해요!",
            description: "매치 설명",
            maxLength: 1000,
          },
          distance: {
            type: "string",
            example: "1.2km",
            description: "사용자 위치로부터의 거리",
          },
          rules: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["매너를 지켜주세요", "시간을 꼭 지켜주세요"],
            description: "매치 규칙/주의사항",
          },
          equipment: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["라켓", "테니스공", "수건"],
            description: "필요 장비 목록",
          },
          parking: {
            type: "string",
            example: "2시간 무료주차 가능",
            description: "주차 정보",
          },
          amenities: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["샤워실", "락커", "매점"],
            description: "편의시설 목록",
          },
          confirmedParticipants: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                  description: "참가자 ID",
                },
                name: {
                  type: "string",
                  example: "김테니스",
                  description: "참가자 이름",
                },
                ntrp: {
                  type: "string",
                  example: "4.0",
                  description: "참가자 NTRP 레벨",
                },
                experience: {
                  type: "string",
                  example: "3년",
                  description: "참가자 경력",
                },
                isHost: {
                  type: "boolean",
                  example: false,
                  description: "호스트 여부",
                },
              },
            },
            description: "확정된 참가자 목록",
          },
        },
      },

      CreateMatchRequest: {
        type: "object",
        required: [
          "title",
          "game_type",
          "venue_id",
          "court",
          "match_date",
          "start_time",
          "end_time",
          "max_participants",
        ],
        properties: {
          title: {
            type: "string",
            minLength: 1,
            maxLength: 100,
            example: "즐거운 주말 단식",
            description: "매치 제목 (필수, 1-100자)",
          },
          description: {
            type: "string",
            maxLength: 1000,
            example: "함께 즐겁게 테니스 해요!",
            description: "매치 상세 설명 (선택, 최대 1000자)",
          },
          game_type: {
            type: "string",
            enum: [
              "singles",
              "mens_doubles",
              "womens_doubles",
              "mixed_doubles",
            ],
            example: "singles",
            description:
              "게임 유형 (필수) - singles: 단식, mens_doubles: 남복, womens_doubles: 여복, mixed_doubles: 혼복",
          },
          venue_id: {
            type: "string",
            format: "uuid",
            example: "550e8400-e29b-41d4-a716-446655440101",
            description: "테니스장 ID (필수, UUID 형식)",
          },
          court: {
            type: "string",
            minLength: 1,
            maxLength: 50,
            example: "1번 코트",
            description: "코트 번호/이름 (필수, 1-50자)",
          },
          match_date: {
            type: "string",
            format: "date",
            example: "2024-01-15",
            description: "경기 날짜 (필수, YYYY-MM-DD 형식)",
          },
          start_time: {
            type: "string",
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
            example: "14:00",
            description: "시작 시간 (필수, HH:MM 형식)",
          },
          end_time: {
            type: "string",
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
            example: "16:00",
            description: "종료 시간 (필수, HH:MM 형식)",
          },
          max_participants: {
            type: "integer",
            minimum: 2,
            maximum: 8,
            example: 2,
            description: "최대 참가자 수 (필수, 2-8명)",
          },
          recruit_ntrp_min: {
            type: "number",
            format: "float",
            minimum: 1.0,
            maximum: 7.0,
            example: 3.0,
            description: "모집 최소 NTRP 레벨 (선택, 1.0-7.0)",
          },
          recruit_ntrp_max: {
            type: "number",
            format: "float",
            minimum: 1.0,
            maximum: 7.0,
            example: 4.5,
            description: "모집 최대 NTRP 레벨 (선택, 1.0-7.0)",
          },
          recruit_experience_min: {
            type: "integer",
            minimum: 0,
            example: 2,
            description: "모집 최소 경력 (선택, 년 단위)",
          },
          recruit_experience_max: {
            type: "integer",
            minimum: 0,
            example: 5,
            description: "모집 최대 경력 (선택, 년 단위)",
          },
          price: {
            type: "integer",
            minimum: 0,
            example: 20000,
            description: "참가비 (선택, 원 단위, 0=무료)",
          },
          rules: {
            type: "array",
            maxItems: 10,
            items: {
              type: "string",
              maxLength: 200,
            },
            example: ["매너를 지켜주세요", "시간을 꼭 지켜주세요"],
            description: "매치 규칙 (선택, 최대 10개, 각 200자 이내)",
          },
          equipment: {
            type: "array",
            maxItems: 20,
            items: {
              type: "string",
              maxLength: 100,
            },
            example: ["라켓", "테니스공"],
            description: "필요 장비 목록 (선택, 최대 20개)",
          },
          parking_info: {
            type: "string",
            maxLength: 200,
            example: "2시간 무료주차 가능",
            description: "주차 정보 (선택, 최대 200자)",
          },
        },
      },

      JoinMatchRequest: {
        type: "object",
        properties: {
          message: {
            type: "string",
            maxLength: 500,
            example: "잘 부탁드립니다!",
            description: "참가 신청 메시지 (선택, 최대 500자)",
          },
        },
      },

      // =============================================
      // 인증 관련 스키마
      // =============================================
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
            description: "이메일 주소 (필수)",
          },
          password: {
            type: "string",
            format: "password",
            minLength: 6,
            example: "password123",
            description: "비밀번호 (필수, 최소 6자)",
          },
        },
      },

      SignupRequest: {
        type: "object",
        required: ["email", "password", "name"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "newuser@example.com",
            description: "이메일 주소 (필수)",
          },
          password: {
            type: "string",
            format: "password",
            minLength: 6,
            example: "securePassword123",
            description: "비밀번호 (필수, 최소 6자)",
          },
          name: {
            type: "string",
            minLength: 1,
            maxLength: 50,
            example: "김테니스",
            description: "실명 (필수, 1-50자)",
          },
        },
      },

      LoginResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          data: {
            type: "object",
            required: ["accessToken", "refreshToken", "user"],
            properties: {
              accessToken: {
                type: "string",
                example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                description: "JWT 액세스 토큰",
              },
              refreshToken: {
                type: "string",
                example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                description: "JWT 리프레시 토큰",
              },
              user: {
                $ref: "#/components/schemas/User",
              },
            },
          },
        },
      },

      RefreshTokenRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            description: "리프레시 토큰 (필수)",
          },
        },
      },

      KakaoLoginRequest: {
        type: "object",
        required: ["code"],
        properties: {
          code: {
            type: "string",
            example: "kakao_auth_code_from_callback",
            description: "카카오 OAuth 인증 코드 (필수)",
          },
        },
      },

      // =============================================
      // 지역/테니스장 관련 스키마
      // =============================================
      Region: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "지역 ID",
          },
          name: {
            type: "string",
            example: "서울시",
            description: "지역명",
          },
          type: {
            type: "string",
            enum: ["city", "province", "district"],
            description: "지역 유형 (city: 시, province: 도, district: 구/군)",
          },
          districts: {
            oneOf: [
              {
                type: "array",
                items: {
                  type: "string",
                },
                description: "하위 구/군 목록 (시의 경우)",
              },
              {
                type: "object",
                additionalProperties: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
                description: "하위 시/구 목록 (도의 경우)",
              },
            ],
          },
        },
      },

      Venue: {
        type: "object",
        required: ["id", "name", "address"],
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "테니스장 ID",
          },
          name: {
            type: "string",
            example: "올림픽공원 테니스장",
            description: "테니스장 이름",
          },
          address: {
            type: "string",
            example: "서울특별시 송파구 올림픽로 424",
            description: "테니스장 주소",
          },
          courts: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["1번 코트", "2번 코트", "3번 코트"],
            description: "코트 목록",
          },
          amenities: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["주차장", "샤워실", "락커"],
            description: "편의시설 목록",
          },
          priceRange: {
            type: "string",
            example: "15,000-25,000원",
            description: "가격대 정보",
          },
          phone: {
            type: "string",
            example: "02-410-1114",
            description: "연락처",
          },
          website: {
            type: "string",
            format: "uri",
            description: "웹사이트 URL",
          },
          operatingHours: {
            type: "object",
            additionalProperties: {
              type: "string",
            },
            example: {
              monday: "06:00-22:00",
              tuesday: "06:00-22:00",
            },
            description: "운영 시간",
          },
          distance: {
            type: "string",
            example: "1.2km",
            description: "사용자 위치로부터의 거리 (근처 검색 시)",
          },
        },
      },

      // =============================================
      // 홈페이지 관련 스키마
      // =============================================
      HomeResponse: {
        type: "object",
        properties: {
          user: {
            type: "object",
            required: ["name", "greeting", "motivationMessage"],
            properties: {
              name: {
                type: "string",
                example: "김테니스",
                description: "사용자 이름",
              },
              greeting: {
                type: "string",
                example: "좋은 아침이에요",
                description: "시간대별 인사말",
              },
              motivationMessage: {
                type: "string",
                example: "오늘도 화이팅!",
                description: "동기부여 메시지",
              },
            },
          },
          upcomingMatches: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Match",
            },
            description: "다가오는 매치 목록",
          },
        },
      },

      // =============================================
      // 커뮤니티 관련 스키마
      // =============================================
      Post: {
        type: "object",
        required: ["id", "title", "content", "category", "created_at"],
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "게시글 ID",
          },
          title: {
            type: "string",
            example: "테니스 입문자를 위한 팁",
            description: "게시글 제목",
          },
          content: {
            type: "string",
            example:
              "테니스를 처음 시작하는 분들에게 도움이 될 만한 팁들을 공유합니다.",
            description: "게시글 내용",
          },
          category: {
            type: "string",
            enum: [
              "free",
              "tips",
              "equipment",
              "match",
              "question",
              "announcement",
            ],
            example: "tip",
            description: "게시글 카테고리",
          },
          images: {
            type: "array",
            items: {
              type: "string",
              format: "uri",
            },
            description: "첨부 이미지 URL 목록",
          },
          likes_count: {
            type: "integer",
            example: 15,
            description: "좋아요 수",
          },
          comments_count: {
            type: "integer",
            example: 8,
            description: "댓글 수",
          },
          views_count: {
            type: "integer",
            example: 127,
            description: "조회수",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "생성일시",
          },
          author: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              nickname: {
                type: "string",
                example: "TennisLover",
              },
              profile_image_url: {
                type: "string",
                format: "uri",
              },
            },
          },
        },
      },

      PostDetail: {
        allOf: [
          { $ref: "#/components/schemas/Post" },
          {
            type: "object",
            properties: {
              isLiked: {
                type: "boolean",
                example: false,
                description: "현재 사용자의 좋아요 여부",
              },
            },
          },
        ],
      },

      CreatePostRequest: {
        type: "object",
        required: ["title", "content", "category"],
        properties: {
          title: {
            type: "string",
            minLength: 1,
            maxLength: 200,
            example: "테니스 입문자를 위한 팁",
            description: "게시글 제목 (필수, 1-200자)",
          },
          content: {
            type: "string",
            minLength: 1,
            maxLength: 5000,
            example:
              "테니스를 처음 시작하는 분들에게 도움이 될 만한 팁들을 공유합니다.",
            description: "게시글 내용 (필수, 1-5000자)",
          },
          category: {
            type: "string",
            enum: [
              "free",
              "tips",
              "equipment",
              "match",
              "question",
              "announcement",
            ],
            example: "tips",
            description: "게시글 카테고리 (필수)",
          },
          images: {
            type: "array",
            maxItems: 10,
            items: {
              type: "string",
              format: "uri",
            },
            example: ["https://example.com/image1.jpg"],
            description: "첨부 이미지 URL 목록 (선택, 최대 10개)",
          },
        },
      },

      UpdatePostRequest: {
        type: "object",
        properties: {
          title: {
            type: "string",
            minLength: 1,
            maxLength: 200,
            description: "게시글 제목 (선택)",
          },
          content: {
            type: "string",
            minLength: 1,
            maxLength: 5000,
            description: "게시글 내용 (선택)",
          },
          images: {
            type: "array",
            maxItems: 10,
            items: {
              type: "string",
              format: "uri",
            },
            description: "첨부 이미지 URL 목록 (선택)",
          },
        },
      },

      Comment: {
        type: "object",
        required: ["id", "content", "created_at"],
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "댓글 ID",
          },
          content: {
            type: "string",
            example: "좋은 정보 감사합니다!",
            description: "댓글 내용",
          },
          likes_count: {
            type: "integer",
            example: 3,
            description: "좋아요 수",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "생성일시",
          },
          author: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              nickname: {
                type: "string",
                example: "TennisPlayer",
              },
              profile_image_url: {
                type: "string",
                format: "uri",
              },
            },
          },
          replies: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Comment",
            },
            description: "대댓글 목록",
          },
        },
      },

      CreateCommentRequest: {
        type: "object",
        required: ["content"],
        properties: {
          content: {
            type: "string",
            minLength: 1,
            maxLength: 1000,
            example: "좋은 정보 감사합니다!",
            description: "댓글 내용 (필수, 1-1000자)",
          },
          parent_id: {
            type: "string",
            format: "uuid",
            description: "부모 댓글 ID (대댓글인 경우, 선택)",
          },
        },
      },

      // =============================================
      // 프로필 관련 스키마
      // =============================================
      UpdateProfileRequest: {
        type: "object",
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: 50,
            example: "김테니스",
            description: "실명 (선택, 1-50자)",
          },
          nickname: {
            type: "string",
            minLength: 2,
            maxLength: 20,
            example: "TennisKing2024",
            description: "닉네임 (선택, 2-20자, 고유값)",
          },
          location: {
            type: "string",
            maxLength: 100,
            example: "서울시 강남구",
            description: "활동 지역 (선택, 최대 100자)",
          },
          bio: {
            type: "string",
            maxLength: 500,
            example: "테니스를 사랑하는 주말 플레이어입니다.",
            description: "자기소개 (선택, 최대 500자)",
          },
          profile_image_url: {
            type: "string",
            format: "uri",
            example: "https://example.com/profile.jpg",
            description: "프로필 이미지 URL (선택)",
          },
          ntrp: {
            type: "number",
            format: "float",
            minimum: 1.0,
            maximum: 7.0,
            example: 4.0,
            description: "NTRP 레벨 (선택, 1.0-7.0)",
          },
          experience_years: {
            type: "integer",
            minimum: 0,
            maximum: 50,
            example: 5,
            description: "테니스 경력 (선택, 년 단위, 0-50)",
          },
          favorite_style: {
            type: "string",
            maxLength: 100,
            example: "공격적 베이스라인",
            description: "선호하는 플레이 스타일 (선택)",
          },
          height: {
            type: "number",
            minimum: 100,
            maximum: 250,
            example: 175,
            description: "키 (선택, cm 단위)",
          },
          weight: {
            type: "number",
            minimum: 30,
            maximum: 200,
            example: 70,
            description: "몸무게 (선택, kg 단위)",
          },
          phone: {
            type: "string",
            maxLength: 20,
            example: "010-1234-5678",
            description: "전화번호 (선택)",
          },
        },
      },

      MatchParticipation: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "참가 기록 ID",
          },
          status: {
            type: "string",
            enum: ["pending", "confirmed", "cancelled"],
            description: "참가 상태",
          },
          joined_at: {
            type: "string",
            format: "date-time",
            description: "참가 신청일시",
          },
          match: {
            $ref: "#/components/schemas/Match",
          },
        },
      },

      // =============================================
      // 리뷰 관련 스키마
      // =============================================
      ReviewableMatch: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "매치 ID",
            example: "123e4567-e89b-12d3-a456-426614174000",
          },
          title: {
            type: "string",
            description: "매치 제목",
            example: "즐거운 주말 단식",
          },
          matchDate: {
            type: "string",
            format: "date",
            description: "매치 날짜",
            example: "2024-01-15",
          },
          location: {
            type: "string",
            description: "코트 이름",
            example: "강남테니스장",
          },
          address: {
            type: "string",
            description: "코트 주소",
            example: "서울시 강남구 테헤란로 123",
          },
          gameType: {
            type: "string",
            description: "경기 형태",
            example: "단식",
          },
          participants: {
            type: "array",
            items: {
              $ref: "#/components/schemas/ReviewableParticipant",
            },
            description: "참가자 목록",
          },
        },
        required: [
          "id",
          "title",
          "matchDate",
          "location",
          "gameType",
          "participants",
        ],
      },

      ReviewableParticipant: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "사용자 ID",
            example: "123e4567-e89b-12d3-a456-426614174001",
          },
          name: {
            type: "string",
            description: "사용자 이름",
            example: "김테니스",
          },
          nickname: {
            type: "string",
            description: "사용자 닉네임",
            example: "TennisKing",
          },
          ntrp: {
            type: "number",
            format: "float",
            minimum: 1.0,
            maximum: 7.0,
            description: "NTRP 레벨",
            example: 4.0,
          },
          hasReviewed: {
            type: "boolean",
            description: "이미 리뷰했는지 여부",
            example: false,
          },
        },
        required: ["id", "name", "ntrp", "hasReviewed"],
      },

      SubmitReviewRequest: {
        type: "object",
        properties: {
          revieweeId: {
            type: "string",
            format: "uuid",
            description: "리뷰 대상자 ID",
            example: "123e4567-e89b-12d3-a456-426614174001",
          },
          ntrp: {
            type: "number",
            format: "float",
            minimum: 1.0,
            maximum: 7.0,
            multipleOf: 0.5,
            description: "NTRP 레벨 평가 (0.5 단위)",
            example: 4.0,
          },
          isPositive: {
            type: "boolean",
            description: "긍정적 리뷰 여부 (true: 좋아요, false: 싫어요)",
            example: true,
          },
          comment: {
            type: "string",
            description: "리뷰 코멘트 (선택사항)",
            example: "매너가 좋으시고 실력도 뛰어나셔서 즐거운 경기였습니다.",
            maxLength: 500,
          },
        },
        required: ["revieweeId", "ntrp", "isPositive"],
      },

      Review: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "리뷰 ID",
          },
          rating: {
            type: "integer",
            minimum: 1,
            maximum: 5,
            example: 5,
            description: "평점 (1-5)",
          },
          comment: {
            type: "string",
            example: "매너가 좋으시고 실력도 뛰어나셔서 즐거운 경기였습니다.",
            description: "리뷰 내용",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "작성일시",
          },
          match: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              title: {
                type: "string",
                example: "즐거운 주말 단식",
              },
              match_date: {
                type: "string",
                format: "date",
              },
            },
          },
          reviewer: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              nickname: {
                type: "string",
                example: "TennisPlayer",
              },
              name: {
                type: "string",
                example: "김테니스",
              },
              profile_image_url: {
                type: "string",
                format: "uri",
                description: "프로필 이미지 URL",
              },
            },
          },
        },
      },

      UserReviewsResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          data: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Review",
            },
            description: "사용자가 받은 리뷰 목록",
          },
          pagination: {
            $ref: "#/components/schemas/PaginationInfo",
          },
        },
      },

      MatchBookmark: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "북마크 ID",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "북마크 생성일시",
          },
          match: {
            $ref: "#/components/schemas/Match",
          },
        },
      },

      // =============================================
      // 알림 관련 스키마
      // =============================================
      Notification: {
        type: "object",
        required: ["id", "type", "title", "message", "is_read", "created_at"],
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "알림 ID",
          },
          type: {
            type: "string",
            enum: ["match", "chat", "community", "system", "marketing"],
            example: "community",
            description: "알림 유형",
          },
          title: {
            type: "string",
            example: "게시글에 좋아요를 받았습니다",
            description: "알림 제목",
          },
          message: {
            type: "string",
            example:
              'TennisLover님이 "테니스 초보자 가이드" 게시글에 좋아요를 눌렀습니다.',
            description: "알림 내용",
          },
          action_data: {
            type: "object",
            description: "알림 관련 추가 데이터 (JSON 객체)",
            example: {
              type: "navigate",
              screen: "PostDetail",
              params: {
                postId: "12345678-1234-1234-1234-123456789012",
              },
            },
          },
          post_id: {
            type: "string",
            format: "uuid",
            description: "관련 게시글 ID (커뮤니티 알림인 경우)",
            example: "12345678-1234-1234-1234-123456789012",
          },
          match_id: {
            type: "string",
            format: "uuid",
            description: "관련 매치 ID (매치 알림인 경우)",
          },
          chat_room_id: {
            type: "string",
            format: "uuid",
            description: "관련 채팅방 ID (채팅 알림인 경우)",
          },
          is_read: {
            type: "boolean",
            example: false,
            description: "읽음 여부",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "알림 생성일시",
          },
        },
      },

      UpdateFcmTokenRequest: {
        type: "object",
        required: ["fcmToken"],
        properties: {
          fcmToken: {
            type: "string",
            minLength: 1,
            example: "dA1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuVwXyZ...",
            description: "Firebase Cloud Messaging 토큰 (필수)",
          },
          deviceType: {
            type: "string",
            enum: ["ios", "android", "web"],
            example: "web",
            default: "web",
            description: "디바이스 유형 (선택, 기본값: web)",
          },
          deviceInfo: {
            type: "object",
            description: "디바이스 추가 정보 (선택)",
            properties: {
              userAgent: {
                type: "string",
                example: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
                description: "브라우저 User Agent",
              },
              platform: {
                type: "string",
                example: "MacIntel",
                description: "플랫폼 정보",
              },
              language: {
                type: "string",
                example: "ko-KR",
                description: "언어 설정",
              },
            },
          },
        },
      },

      NotificationSettings: {
        type: "object",
        properties: {
          push_enabled: {
            type: "boolean",
            example: true,
            description: "푸시 알림 전체 활성화 여부",
          },
          match_notifications: {
            type: "boolean",
            example: true,
            description:
              "매치 관련 알림 활성화 여부 (참가 승인/거부, 매치 시작 등)",
          },
          chat_notifications: {
            type: "boolean",
            example: true,
            description: "채팅 메시지 알림 활성화 여부",
          },
          community_notifications: {
            type: "boolean",
            example: true,
            description:
              "커뮤니티 알림 활성화 여부 (게시글 좋아요, 댓글, 대댓글)",
          },
          marketing_notifications: {
            type: "boolean",
            example: false,
            description: "마케팅 및 프로모션 알림 활성화 여부",
          },
        },
      },

      UpdateNotificationSettingsRequest: {
        type: "object",
        properties: {
          push_enabled: {
            type: "boolean",
            description: "푸시 알림 전체 활성화 여부 (선택)",
          },
          match_notifications: {
            type: "boolean",
            description:
              "매치 관련 알림 활성화 여부 (선택) - 참가 승인/거부, 매치 시작 등",
          },
          chat_notifications: {
            type: "boolean",
            description: "채팅 메시지 알림 활성화 여부 (선택)",
          },
          community_notifications: {
            type: "boolean",
            description:
              "커뮤니티 알림 활성화 여부 (선택) - 게시글 좋아요, 댓글, 대댓글",
          },
          marketing_notifications: {
            type: "boolean",
            description: "마케팅 및 프로모션 알림 활성화 여부 (선택)",
          },
        },
      },

      // =============================================
      // 채팅 관련 스키마
      // =============================================
      ChatRoom: {
        type: "object",
        required: ["id", "type"],
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "채팅방 ID",
          },
          name: {
            type: "string",
            example: "즐거운 주말 단식 채팅",
            description: "채팅방 이름",
          },
          type: {
            type: "string",
            enum: ["private", "match"],
            example: "match",
            description: "채팅방 유형",
          },
          match: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              title: {
                type: "string",
                example: "즐거운 주말 단식",
              },
              match_date: {
                type: "string",
                format: "date",
              },
            },
            description: "매치 채팅방인 경우 매치 정보",
          },
          host: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              nickname: {
                type: "string",
                example: "HostPlayer",
              },
              profile_image_url: {
                type: "string",
                format: "uri",
              },
            },
            description: "매치 채팅방인 경우 호스트 정보",
          },
          otherParticipant: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              nickname: {
                type: "string",
                example: "TennisPlayer",
              },
              profile_image_url: {
                type: "string",
                format: "uri",
              },
            },
            description: "1:1 채팅방인 경우 상대방 정보",
          },
          lastMessage: {
            $ref: "#/components/schemas/ChatMessage",
          },
          unreadCount: {
            type: "integer",
            example: 3,
            description: "읽지 않은 메시지 수",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "마지막 업데이트 일시",
          },
        },
      },

      ChatRoomDetail: {
        allOf: [
          { $ref: "#/components/schemas/ChatRoom" },
          {
            type: "object",
            properties: {
              participants: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    user: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          format: "uuid",
                        },
                        nickname: {
                          type: "string",
                          example: "TennisPlayer",
                        },
                        profile_image: {
                          type: "string",
                          format: "uri",
                        },
                      },
                    },
                    joined_at: {
                      type: "string",
                      format: "date-time",
                      description: "채팅방 참가일시",
                    },
                  },
                },
                description: "채팅방 참가자 목록",
              },
            },
          },
        ],
      },

      CreateChatRoomRequest: {
        type: "object",
        required: ["type"],
        properties: {
          type: {
            type: "string",
            enum: ["private", "match"],
            example: "private",
            description: "채팅방 유형 (필수)",
          },
          participant_ids: {
            type: "array",
            items: {
              type: "string",
              format: "uuid",
            },
            minItems: 1,
            example: ["550e8400-e29b-41d4-a716-446655440002"],
            description: "참가자 ID 목록 (1:1 채팅의 경우 필수)",
          },
          match_id: {
            type: "string",
            format: "uuid",
            example: "550e8400-e29b-41d4-a716-446655440101",
            description: "매치 ID (매치 채팅방의 경우 필수)",
          },
          name: {
            type: "string",
            maxLength: 100,
            example: "그룹 채팅방",
            description: "채팅방 이름 (선택)",
          },
        },
      },

      ChatMessage: {
        type: "object",
        required: ["id", "content", "message_type", "created_at"],
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "메시지 ID",
          },
          content: {
            type: "string",
            example: "안녕하세요! 매치 잘 부탁드립니다.",
            description: "메시지 내용",
          },
          message_type: {
            type: "string",
            enum: ["text", "image", "system"],
            example: "text",
            description: "메시지 유형",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "메시지 생성일시",
          },
          reply_to: {
            type: "string",
            format: "uuid",
            description: "답글 대상 메시지 ID",
          },
          sender: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              nickname: {
                type: "string",
                example: "TennisPlayer",
              },
              profile_image_url: {
                type: "string",
                format: "uri",
              },
            },
            description: "메시지 발신자 정보",
          },
          reply_message: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              content: {
                oneOf: [
                  {
                    type: "string",
                    example: "네, 저도 잘 부탁드립니다!",
                  },
                  {
                    type: "object",
                    properties: {
                      participantId: {
                        type: "string",
                        example: "123e4567-e89b-12d3-a456-426614174001",
                      },
                      participantName: { type: "string", example: "김테니스" },
                      type: {
                        type: "string",
                        enum: ["approve_request", "cancel_approval"],
                        example: "approve_request",
                      },
                    },
                    required: ["participantId", "participantName", "type"],
                    example: {
                      participantId: "123e4567-e89b-12d3-a456-426614174001",
                      participantName: "김테니스",
                      type: "approve_request",
                    },
                  },
                ],
              },
              sender: {
                type: "object",
                properties: {
                  nickname: {
                    type: "string",
                    example: "TennisLover",
                  },
                },
              },
            },
            description: "답글 대상 메시지 정보",
          },
        },
      },

      SendMessageRequest: {
        type: "object",
        required: ["content"],
        properties: {
          content: {
            type: "string",
            minLength: 1,
            maxLength: 1000,
            example: "안녕하세요! 매치 잘 부탁드립니다.",
            description: "메시지 내용 (필수, 1-1000자)",
          },
          message_type: {
            type: "string",
            enum: ["text", "image", "system"],
            default: "text",
            description: "메시지 유형 (기본값: text)",
          },
          reply_to: {
            type: "string",
            format: "uuid",
            description: "답글 대상 메시지 ID (선택)",
          },
        },
      },
    },
  },
  tags: [
    {
      name: "Auth",
      description: "인증 관련 API - 로그인, 회원가입, 토큰 관리",
    },
    {
      name: "Home",
      description: "홈페이지 API - 개인화된 홈 화면 데이터",
    },
    {
      name: "Matches",
      description: "매치 관련 API - 매치 생성, 조회, 참가 신청",
    },
    {
      name: "Regions",
      description: "지역 정보 API - 지역 목록 및 계층 구조",
    },
    {
      name: "Venues",
      description: "테니스장 API - 테니스장 검색 및 상세 정보",
    },
    {
      name: "Community",
      description: "커뮤니티 API - 게시글, 댓글, 좋아요",
    },
    {
      name: "Profile",
      description: "프로필 API - 사용자 프로필 및 통계",
    },
    {
      name: "Notifications",
      description: "알림 API - 푸시 알림 및 인앱 알림",
    },
    {
      name: "Chat",
      description: "채팅 API - 실시간 채팅 및 채팅방 관리",
    },
    {
      name: "Review",
      description: "리뷰 API - 매치 리뷰 작성 및 조회",
    },
  ],
};

const options: Options = {
  swaggerDefinition,
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);
