import { Router } from 'express';
import { homeController } from '../controllers/homeController';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/home:
 *   get:
 *     summary: 홈 화면 데이터 조회
 *     tags: [Home]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 홈 화면 데이터 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/HomeResponse'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', requireAuth, homeController.getHomeData);

export default router;