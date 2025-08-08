import { Router } from 'express';
import { locationController } from '../controllers/locationController';

const router = Router();

/**
 * @swagger
 * /api/regions:
 *   get:
 *     summary: 지역 데이터 조회
 *     tags: [Regions]
 *     responses:
 *       200:
 *         description: 지역 데이터 조회 성공
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
 *                     regions:
 *                       type: object
 *                       additionalProperties:
 *                         $ref: '#/components/schemas/Region'
 *                       example:
 *                         서울시:
 *                           type: city
 *                           districts: ["강남구", "서초구", "송파구"]
 *                         경기도:
 *                           type: province
 *                           districts:
 *                             수원시: ["영통구", "장안구", "권선구", "팔달구"]
 *                             성남시: ["분당구", "중원구", "수정구"]
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', locationController.getRegions);

export default router;