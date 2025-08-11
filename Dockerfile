# 멀티 스테이지 빌드 - 빌드 단계
FROM node:20-alpine AS builder

WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 모든 의존성 설치 (devDependencies 포함)
RUN npm ci

# 소스 코드 복사
COPY . .

# TypeScript 컴파일
RUN npm run build

# 멀티 스테이지 빌드 - 프로덕션 단계
FROM node:20-alpine AS production

WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production && npm cache clean --force

# 빌드된 JavaScript 파일 복사
COPY --from=builder /app/dist ./dist

# non-root 사용자 생성
RUN addgroup -g 1001 -S nodejs
RUN adduser -S wehand -u 1001

# 앱 소유권을 wehand 사용자에게 변경
USER wehand

# 포트 노출
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 앱 실행
CMD ["npm", "start"]