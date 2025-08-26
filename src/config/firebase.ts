import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config();

// Firebase Admin SDK 초기화
const initializeFirebase = () => {
  try {
    // 서비스 계정 키 파일 경로 (환경변수 또는 파일 경로)
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
      // 서비스 계정 키 파일 사용
      const serviceAccount = require(path.resolve(serviceAccountPath));

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // 환경변수에서 직접 서비스 계정 키 읽기 (프로덕션용)
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      );

      console.log(
        "@@@serviceAccount",
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // 기본 애플리케이션 자격증명 사용 (Google Cloud 환경)
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }

    console.log("Firebase Admin SDK 초기화 성공");
  } catch (error) {
    console.error("Firebase Admin SDK 초기화 실패:", error);
    // Firebase가 초기화되지 않아도 서버는 계속 실행되도록 함
  }
};

// 초기화
initializeFirebase();

// Firebase Messaging 인스턴스
export const messaging = admin.messaging();

// Firebase Auth 인스턴스 (필요시 사용)
export const auth = admin.auth();

export default admin;
