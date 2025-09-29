import { Router } from "express";
import { matchController } from "../controllers/matchController";
import { requireAuth, optionalAuth } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /api/matches:
 *   get:
 *     summary: 매치 목록 조회 (필터링/검색)
 *     tags: [Matches]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 검색어
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: 단일 지역 필터 (하위 호환성)
 *       - in: query
 *         name: regions
 *         schema:
 *           oneOf:
 *             - type: string
 *               description: 콤마로 구분된 지역 리스트
 *               example: "서울 강남구,서울 서초구,경기도 성남시"
 *             - type: array
 *               items:
 *                 type: string
 *               description: 지역 배열
 *         description: 여러 지역 필터 (OR 조건으로 검색)
 *         examples:
 *           string:
 *             value: "서울 강남구,서울 서초구"
 *           array:
 *             value: ["서울 강남구", "서울 서초구"]
 *       - in: query
 *         name: court
 *         schema:
 *           type: string
 *         description: 단일 코트명 필터 (하위 호환성)
 *         example: "1코트"
 *       - in: query
 *         name: courts
 *         schema:
 *           oneOf:
 *             - type: string
 *               description: 콤마로 구분된 코트명 리스트
 *               example: "1코트,2코트,센터코트"
 *             - type: array
 *               items:
 *                 type: string
 *               description: 코트명 배열
 *         description: 여러 코트명 필터 (OR 조건으로 검색, 대소문자 구분 없음)
 *         examples:
 *           string:
 *             value: "1코트,2코트"
 *           array:
 *             value: ["1코트", "2코트", "센터코트"]
 *       - in: query
 *         name: venue_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 단일 테니스장 ID 필터
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: query
 *         name: venue_ids
 *         schema:
 *           oneOf:
 *             - type: string
 *               description: 콤마로 구분된 테니스장 ID 리스트
 *               example: "550e8400-e29b-41d4-a716-446655440000,550e8400-e29b-41d4-a716-446655440001"
 *             - type: array
 *               items:
 *                 type: string
 *                 format: uuid
 *               description: 테니스장 ID 배열
 *         description: 여러 테니스장 ID 필터 (OR 조건으로 검색)
 *         examples:
 *           string:
 *             value: "550e8400-e29b-41d4-a716-446655440000,550e8400-e29b-41d4-a716-446655440001"
 *           array:
 *             value: ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"]
 *       - in: query
 *         name: game_type
 *         schema:
 *           type: string
 *           enum: [singles, mens_doubles, womens_doubles, mixed_doubles]
 *         description: 게임 유형
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 특정 날짜 (YYYY-MM-DD, 하위 호환성)
 *       - in: query
 *         name: date_start
 *         schema:
 *           type: string
 *           format: date
 *         description: 시작 날짜 (YYYY-MM-DD, 날짜 범위 검색)
 *         example: "2024-01-01"
 *       - in: query
 *         name: date_end
 *         schema:
 *           type: string
 *           format: date
 *         description: 종료 날짜 (YYYY-MM-DD, 날짜 범위 검색)
 *         example: "2024-01-31"
 *       - in: query
 *         name: time_start
 *         schema:
 *           type: string
 *           pattern: '^([01]\d|2[0-3]):([0-5]\d)$'
 *         description: 시작 시간 범위 시작 (HH:MM)
 *         example: "09:00"
 *       - in: query
 *         name: time_end
 *         schema:
 *           type: string
 *           pattern: '^([01]\d|2[0-3]):([0-5]\d)$'
 *         description: 시작 시간 범위 종료 (HH:MM)
 *         example: "18:00"
 *       - in: query
 *         name: ntrp_min
 *         schema:
 *           type: number
 *           minimum: 1.0
 *           maximum: 7.0
 *         description: 최소 NTRP 레벨
 *       - in: query
 *         name: ntrp_max
 *         schema:
 *           type: number
 *           minimum: 1.0
 *           maximum: 7.0
 *         description: 최대 NTRP 레벨
 *       - in: query
 *         name: experience_min
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: 최소 구력 (년)
 *       - in: query
 *         name: experience_max
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: 최대 구력 (년)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [latest, distance, price]
 *           default: latest
 *         description: 정렬 기준 (latest=최신순, distance=거리순, price=가격순)
 *       - in: query
 *         name: user_lat
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: 사용자 위도 (거리순 정렬 시 필수)
 *       - in: query
 *         name: user_lng
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: 사용자 경도 (거리순 정렬 시 필수)
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
 *           default: 10
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 매치 목록 조회 성공
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
 *                       title:
 *                         type: string
 *                       location:
 *                         type: string
 *                       court:
 *                         type: string
 *                       date:
 *                         type: string
 *                       startTime:
 *                         type: string
 *                       endTime:
 *                         type: string
 *                       participants:
 *                         type: string
 *                         example: "2/4"
 *                       gameType:
 *                         type: string
 *                       level:
 *                         type: string
 *                       price:
 *                         type: string
 *                       status:
 *                         type: string
 *                       hostName:
 *                         type: string
 *                       hostId:
 *                         type: string
 *                         format: uuid
 *                         description: "호스트 사용자 ID"
 *                       description:
 *                         type: string
 *                       distance:
 *                         type: string
 *                         nullable: true
 *                         example: "1.2km"
 *                         description: "사용자 위치에서의 거리 (거리순 정렬 시에만 제공)"
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 */
router.get("/", optionalAuth, matchController.getMatches);

/**
 * @swagger
 * /api/matches:
 *   post:
 *     summary: 매치 생성
 *     tags: [Matches]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMatchRequest'
 *     responses:
 *       201:
 *         description: 매치 생성 성공
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
 *                       example: 매치가 생성되었습니다
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", requireAuth, matchController.createMatch);

/**
 * @swagger
 * /api/matches/{matchId}:
 *   get:
 *     summary: 매치 상세 정보 조회
 *     tags: [Matches]
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     responses:
 *       200:
 *         description: 매치 상세 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Match'
 *       404:
 *         description: 매치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:matchId", optionalAuth, matchController.getMatchDetail);

/**
 * @swagger
 * /api/matches/{matchId}/join:
 *   post:
 *     summary: 매치 참가 신청
 *     tags: [Matches]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/JoinMatchRequest'
 *     responses:
 *       201:
 *         description: 매치 참가 신청 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: 잘못된 요청 (이미 참가, 정원 초과 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 매치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/:matchId/join", requireAuth, matchController.joinMatch);

/**
 * @swagger
 * /api/matches/{matchId}/share:
 *   post:
 *     summary: 매치 공유
 *     tags: [Matches]
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     responses:
 *       200:
 *         description: 매치 공유 성공
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
 *                     shareUrl:
 *                       type: string
 *                       format: uri
 *                       example: 'https://wehand.tennis/matches/550e8400-e29b-41d4-a716-446655440201'
 *                       description: '공유 URL'
 *                     message:
 *                       type: string
 *                       example: '매치 공유 링크가 생성되었습니다'
 *       404:
 *         description: 매치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/:matchId/share", matchController.shareMatch);

/**
 * @swagger
 * /api/matches/{matchId}/bookmark:
 *   post:
 *     summary: 매치 북마크 추가
 *     tags: [Matches]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     responses:
 *       200:
 *         description: 매치 북마크 추가 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: 이미 북마크된 매치
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 매치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: 매치 북마크 삭제
 *     tags: [Matches]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     responses:
 *       200:
 *         description: 매치 북마크 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 매치 또는 북마크를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/:matchId/bookmark", requireAuth, matchController.bookmarkMatch);
router.delete(
  "/:matchId/bookmark",
  requireAuth,
  matchController.unbookmarkMatch
);

/**
 * @swagger
 * /api/matches/{matchId}/chat:
 *   post:
 *     summary: 매치 단체 채팅방 생성/참가
 *     tags: [Matches]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     responses:
 *       201:
 *         description: 채팅방 생성/참가 성공
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
 *                     chatRoomId:
 *                       type: string
 *                       format: uuid
 *                       description: '채팅방 ID'
 *                     message:
 *                       type: string
 *                       example: '매치 채팅방에 참가했습니다'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 매치 참가자가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 매치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/:matchId/chat", requireAuth, matchController.createMatchChat);

/**
 * @swagger
 * /api/matches/{matchId}/chat/private:
 *   post:
 *     summary: 매치 호스트와 1:1 채팅방 생성
 *     tags: [Matches]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매치 ID
 *     responses:
 *       201:
 *         description: 1:1 채팅방 생성 성공
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
 *                     chatRoomId:
 *                       type: string
 *                       format: uuid
 *                       description: '채팅방 ID'
 *                     message:
 *                       type: string
 *                       example: '1:1 채팅방이 생성되었습니다'
 *       400:
 *         description: 자신과는 채팅방 생성 불가
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 매치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/:matchId/chat/private",
  requireAuth,
  matchController.createPrivateChat
);

/**
 * @swagger
 * /api/matches/{matchId}:
 *   delete:
 *     summary: 매치 삭제
 *     tags: [Matches]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 삭제할 매치 ID
 *     responses:
 *       200:
 *         description: 매치 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "매치가 삭제되었습니다"
 *       400:
 *         description: 삭제 불가한 매치 상태 또는 참가자 존재
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               active_match:
 *                 summary: 진행 중인 매치
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "CANNOT_DELETE_ACTIVE_MATCH"
 *                     message: "진행 중이거나 완료된 매치는 삭제할 수 없습니다"
 *               has_participants:
 *                 summary: 참가자가 있는 매치
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "CANNOT_DELETE_MATCH_WITH_PARTICIPANTS"
 *                     message: "참가자가 있는 매치는 삭제할 수 없습니다. 먼저 매치를 취소해주세요"
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 삭제 권한 없음 (호스트가 아님)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "INSUFFICIENT_PERMISSION"
 *                 message: "매치 삭제 권한이 없습니다"
 *       404:
 *         description: 매치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "MATCH_DELETION_ERROR"
 *                 message: "매치 삭제 중 오류가 발생했습니다"
 */
router.delete("/:matchId", requireAuth, matchController.deleteMatch);

export default router;
