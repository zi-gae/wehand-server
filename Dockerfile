# Node.js 18 LTS 사용
FROM node:18-alpine

# 시스템 패키지 업데이트로 취약점 최소화
RUN apk update && apk upgrade

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치 (개발 의존성 포함)
RUN npm install

# 소스 코드 복사
COPY . .

# 파일 확인 및 TypeScript 빌드
RUN ls -la && npx tsc -p tsconfig.json

# 프로덕션 의존성만 설치 (node_modules 제거 후 재설치)
RUN rm -rf node_modules && npm install --omit=dev

# 포트 설정
EXPOSE 3000

# 애플리케이션 시작
CMD ["npm", "start"]