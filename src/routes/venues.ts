import { Router } from "express";
import { locationController } from "../controllers/locationController";

const router = Router();

/**
 * @swagger
 * /api/venues:
 *   get:
 *     summary: 테니스장 검색
 *     tags: [Venues]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 검색 키워드 (테니스장 이름, 주소)
 *         example: '올림픽공원'
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: 지역 필터
 *         example: '서울시'
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *         description: 구/군 필터
 *         example: '송파구'
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
 *         description: 테니스장 검색 성공
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
 *                     $ref: '#/components/schemas/Venue'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", locationController.searchVenues);

/**
 * @swagger
 * /api/venues/all:
 *   get:
 *     summary: 모든 테니스장 조회
 *     tags: [Venues]
 *     parameters:
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
 *         description: 모든 테니스장 조회 성공
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
 *                     venues:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Venue'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationInfo'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/all", locationController.getAllVenues);

/**
 * @swagger
 * /api/venues/nearby:
 *   get:
 *     summary: 근처 테니스장 조회
 *     tags: [Venues]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *         description: 위도
 *         example: 37.5665
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *         description: 경도
 *         example: 127.0780
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 5
 *           minimum: 1
 *           maximum: 50
 *         description: 반경 (km)
 *         example: 10
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 최대 결과 수
 *     responses:
 *       200:
 *         description: 근처 테니스장 조회 성공
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
 *                     allOf:
 *                       - $ref: '#/components/schemas/Venue'
 *                       - type: object
 *                         properties:
 *                           distance:
 *                             type: string
 *                             example: '1.2km'
 *                             description: 현재 위치로부터의 거리
 *       400:
 *         description: 잘못된 요청 (위도/경도 누락)
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
 */
router.get("/nearby", locationController.getNearbyVenues);

/**
 * @swagger
 * /api/venues/{venueId}:
 *   get:
 *     summary: 테니스장 상세 정보 조회
 *     tags: [Venues]
 *     parameters:
 *       - in: path
 *         name: venueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 테니스장 ID
 *         example: '550e8400-e29b-41d4-a716-446655440101'
 *     responses:
 *       200:
 *         description: 테니스장 상세 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Venue'
 *                     - type: object
 *                       properties:
 *                         recentMatches:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Match'
 *                           description: '최근 이 테니스장에서 열린 매치들'
 *                         totalMatches:
 *                           type: integer
 *                           example: 47
 *                           description: '총 매치 수'
 *       404:
 *         description: 테니스장을 찾을 수 없음
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
 */
router.get("/:venueId", locationController.getVenueDetail);

export default router;
