import { Router } from "express";
import { versionController } from "../controllers/versionController";

const router = Router();

/**
 * @swagger
 * /version-check:
 *   get:
 *     summary: 앱 버전 체크
 *     description: 클라이언트 앱의 버전을 확인하고 업데이트 필요 여부를 반환합니다.
 *     tags: [Version]
 *     parameters:
 *       - in: query
 *         name: version
 *         schema:
 *           type: string
 *           example: "1.2.0"
 *         description: 현재 클라이언트 앱 버전 (선택사항)
 *     responses:
 *       200:
 *         description: 버전 정보 조회 성공
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
 *                   required:
 *                     - minimumVersion
 *                     - latestVersion
 *                     - forceUpdate
 *                   properties:
 *                     minimumVersion:
 *                       type: string
 *                       example: "1.3.0"
 *                       description: 최소 필수 버전
 *                     latestVersion:
 *                       type: string
 *                       example: "1.5.0"
 *                       description: 최신 버전
 *                     forceUpdate:
 *                       type: boolean
 *                       example: false
 *                       description: 강제 업데이트 필요 여부
 *                     updateUrl:
 *                       type: string
 *                       example: "https://apps.apple.com/app/yourapp"
 *                       description: 업데이트 URL (선택사항)
 *                     message:
 *                       type: string
 *                       example: "새로운 버전이 출시되었습니다. 업데이트하여 더 나은 경험을 즐겨보세요!"
 *                       description: 업데이트 안내 메시지 (선택사항)
 *             examples:
 *               forceUpdateRequired:
 *                 summary: 강제 업데이트 필요
 *                 value:
 *                   success: true
 *                   data:
 *                     minimumVersion: "1.4.0"
 *                     latestVersion: "1.4.0"
 *                     forceUpdate: true
 *                     updateUrl: "https://apps.apple.com/app/yourapp"
 *                     message: "필수 업데이트가 있습니다. 계속 사용하려면 업데이트가 필요합니다."
 *               optionalUpdate:
 *                 summary: 선택적 업데이트 가능
 *                 value:
 *                   success: true
 *                   data:
 *                     minimumVersion: "1.3.0"
 *                     latestVersion: "1.5.0"
 *                     forceUpdate: false
 *                     updateUrl: "https://apps.apple.com/app/yourapp"
 *                     message: "새로운 버전이 출시되었습니다. 업데이트하여 더 나은 경험을 즐겨보세요!"
 *               upToDate:
 *                 summary: 최신 버전 사용 중
 *                 value:
 *                   success: true
 *                   data:
 *                     minimumVersion: "1.3.0"
 *                     latestVersion: "1.5.0"
 *                     forceUpdate: false
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", versionController.checkVersion);

export default router;
