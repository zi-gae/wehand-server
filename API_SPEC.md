# WeHand Tennis App API 스펙

이 문서는 WeHand 테니스 매칭 앱에서 필요한 API 스펙을 정리합니다.

## API 기본 정보

- Base URL: `https://api.wehand.tennis/v1`
- 인증: Bearer Token (JWT)
- 응답 형식: JSON

---

## 1. HomePage 관련 API

### 1.1 홈 화면 데이터 조회

```
GET /home
```

**Response:**

```json
{
  "user": {
    "name": "김테니스",
    "greeting": "좋은 아침이에요",
    "motivationMessage": "오늘도 화이팅!"
  },
  "upcomingMatches": [
    {
      "id": 1,
      "title": "즐거운 주말 복식",
      "location": "올림픽공원 테니스장",
      "court": "1번 코트",
      "date": "01/15",
      "startTime": "14:00",
      "endTime": "16:00",
      "participants": "3/4",
      "gameType": "복식",
      "level": "초중급",
      "price": "20,000원",
      "status": "recruiting",
      "hostName": "김테니스",
      "description": "즐거운 주말 복식 경기입니다"
    }
  ]
}
```

### 1.2 매치 참가 신청

```
POST /matches/{matchId}/join
```

**Request Body:**

```json
{
  "message": "참가 신청 메시지"
}
```

**Response:**

```json
{
  "success": true,
  "message": "참가 신청이 완료되었습니다"
}
```

---

## 2. MatchingPage 관련 API

### 2.1 매치 목록 조회 (필터링/검색)

```
GET /matches?search={query}&region={region}&gameType={gameType}&date={date}&timeSlots={slots}&ntrpMin={min}&ntrpMax={max}&experienceMin={min}&experienceMax={max}&sort={sortBy}
```

**Parameters:**

- search: 검색어
- region: 지역 필터
- gameType: 게임 유형 (단식, 남복, 여복, 혼복)
- date: 날짜 (YYYY-MM-DD)
- timeSlots: 시간대 (comma separated)
- ntrpMin, ntrpMax: NTRP 레벨 범위
- experienceMin, experienceMax: 구력 범위 (년)
- sort: 정렬 (latest, distance, price)

**Response:**

```json
{
  "matches": [
    {
      "id": 1,
      "title": "즐거운 주말 단식 매치",
      "location": "올림픽공원 테니스장",
      "court": "1번 코트",
      "date": "01/15",
      "startTime": "14:00",
      "endTime": "16:00",
      "participants": "1/2",
      "gameType": "단식",
      "level": "중급",
      "price": "20,000원",
      "status": "recruiting",
      "hostName": "김테니스",
      "description": "함께 즐겁게 단식 경기해요!",
      "distance": "1.2km"
    }
  ],
  "total": 10
}
```

### 2.2 지역 데이터 조회

```
GET /regions
```

**Response:**

```json
{
  "regions": {
    "서울시": {
      "type": "city",
      "districts": ["강남구", "서초구", "송파구", "...]
    },
    "경기도": {
      "type": "province",
      "districts": {
        "수원시": ["영통구", "장안구", "권선구", "팔달구"],
        "성남시": ["분당구", "중원구", "수정구"]
      }
    }
  }
}
```

---

## 3. MatchDetailPage 관련 API

### 3.1 매치 상세 정보 조회

```
GET /matches/{matchId}
```

**Response:**

```json
{
  "id": 1,
  "title": "즐거운 주말 단식 매치",
  "location": "올림픽공원 테니스장",
  "court": "1번 코트",
  "address": "서울특별시 송파구 올림픽로 424",
  "date": "01/15",
  "startTime": "14:00",
  "endTime": "16:00",
  "participants": "2/2",
  "gameType": "단식",
  "level": "중급",
  "price": "20,000원",
  "status": "full",
  "hostName": "김테니스",
  "hostNtrp": "4.0",
  "hostExperience": "3년",
  "description": "즐겁고 건전한 테니스 경기를 하실 분을 모집합니다!",
  "rules": [
    "매너를 지켜주세요",
    "시간을 꼭 지켜주세요",
    "안전사고 주의해주세요"
  ],
  "equipment": ["라켓", "테니스공", "수건"],
  "parking": "2시간 무료주차 가능",
  "amenities": ["샤워실", "락커", "매점", "휴게실"],
  "confirmedParticipants": [
    {
      "id": 1,
      "name": "김테니스",
      "ntrp": "4.0",
      "experience": "3년",
      "isHost": true
    }
  ]
}
```

### 3.2 매치 공유

```
POST /matches/{matchId}/share
```

**Response:**

```json
{
  "shareUrl": "https://wehand.tennis/matches/1",
  "title": "즐거운 주말 단식 매치",
  "description": "단식 • 중급 • 20,000원..."
}
```

### 3.3 매치 북마크

```
POST /matches/{matchId}/bookmark
DELETE /matches/{matchId}/bookmark
```

### 3.4 매치 단체 채팅방 생성

```
POST /matches/{matchId}/chat
```

**Request Body:**

```json
{
  "type": "group",
  "name": "🎾 주말 단식 매치 채팅방",
  "participants": [1, 2, 3]
}
```

**Response:**

```json
{
  "chatRoomId": 123,
  "success": true,
  "message": "단체 채팅방이 생성되었습니다",
  "chatRoom": {
    "id": 123,
    "name": "🎾 주말 단식 매치 채팅방",
    "type": "match",
    "matchId": 1,
    "participants": 3
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "CHAT_ALREADY_EXISTS",
    "message": "이미 채팅방이 존재합니다"
  }
}
```

---

## 4. CreatePage 관련 API

### 4.1 매치 생성

```
POST /matches
```

**Request Body:**

```json
{
  "title": "즐거운 주말 단식",
  "gameType": "단식",
  "recruitNtrpRange": ["3.0", "4.5"],
  "recruitExperienceRange": ["2", "5"],
  "location": "올림픽공원 테니스장",
  "court": "1번 코트",
  "date": "2024-01-15",
  "startTime": "14:00",
  "endTime": "16:00",
  "maxParticipants": 2,
  "price": "20000",
  "description": "함께 즐겁게 테니스 해요!"
}
```

**Response:**

```json
{
  "id": 123,
  "success": true,
  "message": "매치가 생성되었습니다"
}
```

### 4.2 테니스장 검색

```
GET /venues?search={query}&region={region}
```

**Response:**

```json
{
  "venues": [
    {
      "id": 1,
      "name": "올림픽공원 테니스장",
      "address": "서울특별시 송파구 올림픽로 424",
      "courts": ["1번 코트", "2번 코트", "3번 코트"],
      "amenities": ["주차장", "샤워실", "락커"],
      "priceRange": "15,000-25,000원"
    }
  ]
}
```

---

## 5. BoardPage 관련 API

### 5.1 게시글 목록 조회

```
GET /posts?search={query}&category={category}&page={page}&limit={limit}
```

**Response:**

```json
{
  "posts": [
    {
      "id": 1,
      "title": "초보자를 위한 백핸드 스트로크 개선 팁",
      "content": "백핸드 스트로크를 향상시키는 핵심 포인트들을...",
      "author": "테니스마스터",
      "time": "2시간 전",
      "category": "free",
      "likes": 24,
      "comments": 12,
      "views": 156,
      "isHot": true,
      "isPinned": true
    }
  ],
  "totalPages": 10,
  "currentPage": 1
}
```

### 5.2 게시글 작성

```
POST /posts
```

**Request Body:**

```json
{
  "title": "게시글 제목",
  "content": "게시글 내용",
  "category": "free"
}
```

---

## 6. PostDetailPage 관련 API

### 6.1 게시글 상세 조회

```
GET /posts/{postId}
```

**Response:**

```json
{
  "post": {
    "id": 1,
    "title": "초보자를 위한 백핸드 스트로크 개선 팁",
    "content": "백핸드 스트로크를 향상시키는...",
    "author": "테니스마스터",
    "time": "2시간 전",
    "category": "tips",
    "likes": 24,
    "comments": 8,
    "views": 156,
    "isLiked": false,
    "isBookmarked": false
  },
  "comments": [
    {
      "id": 1,
      "author": "백핸드초보",
      "content": "정말 유용한 팁이네요!",
      "time": "1시간 전",
      "likes": 5,
      "isLiked": false,
      "replies": [
        {
          "id": 1,
          "author": "테니스마스터",
          "content": "도움이 되셨다니 기쁩니다!",
          "time": "45분 전",
          "likes": 2,
          "isLiked": false,
          "parentAuthor": "백핸드초보"
        }
      ]
    }
  ]
}
```

### 6.2 게시글 좋아요

```
POST /posts/{postId}/like
DELETE /posts/{postId}/like
```

### 6.3 댓글 작성

```
POST /posts/{postId}/comments
```

**Request Body:**

```json
{
  "content": "댓글 내용",
  "parentId": null // 대댓글인 경우 부모 댓글 ID
}
```

### 6.4 댓글 좋아요

```
POST /comments/{commentId}/like
DELETE /comments/{commentId}/like
```

---

## 7. ProfilePage 관련 API

### 7.1 프로필 정보 조회

```
GET /profile
```

**Response:**

```json
{
  "userInfo": {
    "name": "김테니스",
    "nickname": "TennisKing",
    "location": "서울시 강남구",
    "bio": "테니스를 사랑하는 주말 플레이어입니다.",
    "profileImage": null,
    "ntrp": 4.0,
    "experience": "5년",
    "favoriteStyle": "공격적 베이스라인",
    "joinDate": "2023년 3월"
  },
  "stats": {
    "totalMatches": 47,
    "wins": 32,
    "losses": 15,
    "winRate": 68,
    "ranking": 127
  },
  "reviews": {
    "totalReviews": 23,
    "positiveReviews": 19,
    "negativeReviews": 4,
    "reviewNtrp": 4.1
  }
}
```

### 7.2 프로필 수정

```
PUT /profile
```

**Request Body:**

```json
{
  "name": "김테니스",
  "nickname": "TennisKing",
  "location": "서울시 강남구",
  "bio": "테니스를 사랑하는 주말 플레이어입니다.",
  "ntrp": 4.0,
  "experience": "5년",
  "favoriteStyle": "공격적 베이스라인"
}
```

### 7.3 경기 기록 조회

```
GET /profile/matches?page={page}&limit={limit}
```

**Response:**

```json
{
  "matches": [
    {
      "id": 1,
      "title": "주말 단식 매치",
      "date": "2024-01-10",
      "result": "win",
      "opponent": "박라켓",
      "score": "6-4, 6-2"
    }
  ],
  "totalPages": 5
}
```

---

## 8. NotificationPage 관련 API

### 8.1 알림 목록 조회

```
GET /notifications?page={page}&limit={limit}
```

**Response:**

```json
{
  "notifications": [
    {
      "id": 1,
      "type": "match",
      "title": "매칭 신청이 승인되었습니다!",
      "message": "주말 단식 매치에 참가가 확정되었습니다.",
      "time": "5분 전",
      "isRead": false,
      "matchId": 1
    }
  ],
  "unreadCount": 3
}
```

### 8.2 알림 읽음 처리

```
POST /notifications/{notificationId}/read
POST /notifications/read-all
```

---

## 9. ChatListPage 관련 API

### 9.1 채팅방 목록 조회

```
GET /chats
```

**Response:**

```json
{
  "chatRooms": [
    {
      "id": 1,
      "type": "match",
      "name": "🎾 주말 단식 매치 채팅방",
      "lastMessage": "매치가 곧 시작됩니다!",
      "lastMessageTime": "방금 전",
      "unreadCount": 3,
      "matchId": 1,
      "participants": 2,
      "isAnnouncement": true
    }
  ]
}
```

---

## 10. ChatRoomPage 관련 API

### 10.1 채팅방 정보 조회

```
GET /chats/{roomId}
```

**Response:**

```json
{
  "chatRoom": {
    "id": 1,
    "name": "🎾 주말 단식 매치 채팅방",
    "type": "match",
    "participants": 2,
    "matchId": 1,
    "matchTitle": "주말 단식 매치"
  },
  "messages": [
    {
      "id": 1,
      "type": "system",
      "sender": "system",
      "content": "채팅방에 입장하셨습니다.",
      "timestamp": "14:00",
      "isOwn": false
    },
    {
      "id": 2,
      "type": "text",
      "sender": "김테니스",
      "content": "안녕하세요!",
      "timestamp": "14:05",
      "isOwn": false
    }
  ]
}
```

### 10.2 메시지 전송

```
POST /chats/{roomId}/messages
```

**Request Body:**

```json
{
  "content": "메시지 내용",
  "type": "text"
}
```

### 10.3 실시간 메시지 (WebSocket)

```
WebSocket: wss://api.wehand.tennis/ws/chats/{roomId}
```

**메시지 형식:**

```json
{
  "type": "message",
  "data": {
    "id": 123,
    "sender": "김테니스",
    "content": "안녕하세요!",
    "timestamp": "14:05",
    "type": "text"
  }
}
```

---

## 11. 인증 관련 API

### 11.1 로그인

```
POST /auth/login
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "accessToken": "jwt_token_here",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "김테니스"
  }
}
```

### 11.2 토큰 갱신

```
POST /auth/refresh
```

**Request Body:**

```json
{
  "refreshToken": "refresh_token_here"
}
```

### 11.3 카카오 로그인

```
POST /auth/kakao
```

**Request Body:**

```json
{
  "code": "kakao_auth_code_from_callback"
}
```

**Response:**

```json
{
  "accessToken": "jwt_token_here",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": 1001,
    "email": "user@kakao.com",
    "name": "김테니스",
    "profileImage": "https://k.kakaocdn.net/dn/profile.jpg",
    "isNewUser": true
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_AUTH_CODE",
    "message": "유효하지 않은 인증 코드입니다"
  }
}
```

### 11.4 로그아웃

```
POST /auth/logout
```

---

## 12. 공통 응답 형식

### 성공 응답

```json
{
  "success": true,
  "data": {...},
  "message": "성공 메시지"
}
```

### 오류 응답

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "오류 메시지"
  }
}
```

### 페이징 정보

```json
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## 13. 상태 코드

- `200` - 성공
- `201` - 생성 성공
- `400` - 잘못된 요청
- `401` - 인증 실패
- `403` - 권한 없음
- `404` - 리소스 없음
- `500` - 서버 오류

---

## 14. 실시간 기능

### WebSocket 연결

- 채팅: `wss://api.wehand.tennis/ws/chats/{roomId}`
- 알림: `wss://api.wehand.tennis/ws/notifications`
- 매치 상태: `wss://api.wehand.tennis/ws/matches/{matchId}`

### Push 알림

- FCM (Firebase Cloud Messaging) 사용
- 매치 승인/거부, 새 메시지, 매치 시작 알림 등

---

이 API 스펙은 WeHand 테니스 앱의 모든 페이지에서 필요한 기능들을 포괄적으로 정의합니다. 실제 구현 시에는 보안, 성능, 확장성을 고려하여 세부사항을 조정해야 합니다.
