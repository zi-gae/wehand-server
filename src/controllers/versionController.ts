import { Request, Response } from "express";
import { ResponseHelper } from "../utils/response";
import { asyncHandler } from "../middleware/errorHandler";
import { logger } from "../config/logger";

export const versionController = {
  // 버전 체크 엔드포인트
  checkVersion: asyncHandler(async (req: Request, res: Response) => {
    logger.info("Version check requested");

    // 버전 정보 설정 (이 값들은 환경변수나 설정 파일에서 관리하는 것이 좋습니다)
    const versionInfo = {
      minimumVersion: "1.4.5", // 최소 필수 버전
      latestVersion: "1.4.5", // 최신 버전
      forceUpdate: true, // 강제 업데이트 여부
      updateUrl: undefined,
      message:
        "새로운 버전이 출시되었습니다. 업데이트하여 더 나은 경험을 즐겨보세요!", // 업데이트 메시지 (선택사항)
    };

    // 클라이언트에서 현재 버전을 전달받은 경우 처리
    const clientVersion = req.query.version as string;
    if (clientVersion) {
      logger.info(`Client version: ${clientVersion}`);

      // 버전 비교 로직 (필요한 경우)
      const isUpdateRequired =
        compareVersions(clientVersion, versionInfo.minimumVersion) < 0;
      const isUpdateAvailable =
        compareVersions(clientVersion, versionInfo.latestVersion) < 0;

      // 강제 업데이트가 필요한 경우
      if (isUpdateRequired) {
        versionInfo.forceUpdate = true;
        versionInfo.message =
          "필수 업데이트가 있습니다. 계속 사용하려면 업데이트가 필요합니다.";
      }
    }

    return ResponseHelper.success(res, versionInfo);
  }),
};

// 버전 비교 함수 (major.minor.patch 형식)
function compareVersions(version1: string, version2: string): number {
  const v1Parts = version1.split(".").map(Number);
  const v2Parts = version2.split(".").map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part < v2Part) return -1;
    if (v1Part > v2Part) return 1;
  }

  return 0;
}
