# WeHand Tennis Database Schema

이 디렉토리는 WeHand 테니스 앱의 데이터베이스 스키마와 관련 파일들을 포함합니다.

## 파일 구조

- `schema.sql` - 전체 데이터베이스 스키마 정의
- `sample-data.sql` - 개발/테스트용 샘플 데이터
- `README.md` - 이 파일

## 데이터베이스 구조 개요

### 주요 테이블

1. **Users & Authentication**
   - `users` - 사용자 정보 (Supabase Auth 확장)
   - `user_preferences` - 사용자 설정

2. **Location & Venues**
   - `regions` - 지역 정보 (시/도/구)
   - `venues` - 테니스장 정보

3. **Match System**
   - `matches` - 매치 정보
   - `match_participants` - 매치 참가자
   - `match_results` - 경기 결과
   - `match_reviews` - 매치 리뷰
   - `match_bookmarks` - 매치 북마크

4. **Community**
   - `posts` - 게시글
   - `comments` - 댓글 (중첩 구조 지원)
   - `post_likes` - 게시글 좋아요
   - `post_bookmarks` - 게시글 북마크
   - `comment_likes` - 댓글 좋아요

5. **Chat System**
   - `chat_rooms` - 채팅방
   - `chat_participants` - 채팅 참여자
   - `messages` - 메시지
   - `message_reads` - 메시지 읽음 상태

6. **Notifications**
   - `notifications` - 알림
   - `push_tokens` - 푸시 알림 토큰

### 주요 특징

- **UUID 기반 ID**: 모든 테이블에서 UUID 사용
- **Row Level Security (RLS)**: Supabase 보안 정책 적용
- **PostGIS 지원**: 위치 기반 검색을 위한 지리 정보 처리
- **자동 트리거**: 타임스탬프 업데이트, 카운트 자동 관리
- **성능 최적화**: 필요한 인덱스 생성
- **View 제공**: 복잡한 조회를 위한 뷰 생성

## 설치 및 설정

### 1. Supabase 프로젝트에서 스키마 적용

```sql
-- Supabase SQL Editor에서 실행
-- 1. 먼저 schema.sql 내용을 실행
-- 2. 필요시 sample-data.sql 실행 (개발/테스트용)
```

### 2. 환경변수 설정

`.env` 파일에 다음 변수들이 설정되어 있는지 확인:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=your_postgresql_connection_string
```

## API 스펙과 매핑

이 스키마는 `API_SPEC.md`에 정의된 모든 API 요구사항을 지원합니다:

- **인증**: Supabase Auth와 통합
- **매치 시스템**: 생성, 검색, 참가, 결과 관리
- **커뮤니티**: 게시글, 댓글, 좋아요, 북마크
- **실시간 채팅**: WebSocket 지원을 위한 구조
- **알림 시스템**: Push 알림 및 인앱 알림
- **지역/장소**: PostGIS 기반 위치 검색

## 보안 고려사항

- **RLS 정책**: 사용자 데이터 접근 제한
- **인증 검증**: Supabase Auth 기반
- **데이터 검증**: 제약 조건 및 트리거
- **민감 정보 보호**: 개인정보 필드 보안

## 성능 최적화

- **인덱스**: 자주 조회되는 컬럼에 인덱스 생성
- **뷰**: 복잡한 조인 쿼리 최적화
- **트리거**: 실시간 카운트 업데이트
- **파티셔닝**: 대용량 데이터 처리 고려

## 개발 팁

1. **타입 정의**: TypeScript에서 사용할 타입 정의 생성 권장
2. **마이그레이션**: 스키마 변경 시 마이그레이션 스크립트 작성
3. **백업**: 정기적인 데이터베이스 백업
4. **모니터링**: 쿼리 성능 모니터링

## 문의사항

스키마 관련 질문이나 개선사항이 있으면 팀에 문의해주세요.