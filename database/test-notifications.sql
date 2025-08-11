-- 기존 notifications 테이블을 활용한 커뮤니티 알림 테스트

-- 1. 테스트용 사용자 데이터 확인/생성
-- (실제 auth.users 테이블에 사용자가 있다고 가정)

-- 2. 테스트 게시글 생성
INSERT INTO posts (id, title, content, category, author_id, is_active, is_deleted)
VALUES 
  ('test-post-1', '테니스 초보자 가이드', '테니스를 처음 시작하는 분들을 위한 기본 가이드입니다.', 'tips', 'user-1-uuid', true, false),
  ('test-post-2', '좋은 라켓 추천해주세요', '초보자용 라켓을 찾고 있습니다.', 'equipment', 'user-2-uuid', true, false)
ON CONFLICT (id) DO NOTHING;

-- 3. 테스트 댓글 생성
INSERT INTO comments (id, post_id, author_id, content, is_active, is_deleted)
VALUES 
  ('test-comment-1', 'test-post-1', 'user-2-uuid', '좋은 정보 감사합니다!', true, false)
ON CONFLICT (id) DO NOTHING;

-- 4. 사용자 선호도 설정 (알림 허용)
INSERT INTO user_preferences (user_id, match_notifications, chat_notifications, marketing_notifications)
VALUES 
  ('user-1-uuid', true, true, false),
  ('user-2-uuid', true, true, false)
ON CONFLICT (user_id) DO UPDATE SET
  match_notifications = EXCLUDED.match_notifications,
  chat_notifications = EXCLUDED.chat_notifications,
  marketing_notifications = EXCLUDED.marketing_notifications;

-- 5. 테스트 알림 데이터 직접 생성 (API 테스트용)
INSERT INTO notifications (user_id, type, title, message, post_id, action_data)
VALUES 
  (
    'user-1-uuid', 
    'community', 
    '게시글에 좋아요를 받았습니다',
    'TestUser님이 "테니스 초보자 가이드" 게시글에 좋아요를 눌렀습니다.',
    'test-post-1',
    '{"type": "navigate", "screen": "PostDetail", "params": {"postId": "test-post-1"}}'::jsonb
  ),
  (
    'user-1-uuid',
    'community',
    '게시글에 댓글이 달렸습니다', 
    'TestCommenter님이 "테니스 초보자 가이드" 게시글에 댓글을 남겼습니다: "좋은 정보 감사합니다!"',
    'test-post-1',
    '{"type": "navigate", "screen": "PostDetail", "params": {"postId": "test-post-1"}}'::jsonb
  ),
  (
    'user-2-uuid',
    'community',
    '댓글에 답글이 달렸습니다',
    'TestReplier님이 회원님의 댓글에 답글을 남겼습니다: "저도 그렇게 생각합니다!"',
    'test-post-1', 
    '{"type": "navigate", "screen": "PostDetail", "params": {"postId": "test-post-1"}}'::jsonb
  );

-- 6. 알림 조회 테스트 쿼리
-- 특정 사용자의 커뮤니티 알림 조회
SELECT 
  id,
  type,
  title,
  message,
  post_id,
  action_data,
  is_read,
  created_at
FROM notifications 
WHERE user_id = 'user-1-uuid' 
  AND type = 'community'
ORDER BY created_at DESC;

-- 읽지 않은 알림 개수
SELECT COUNT(*) as unread_count
FROM notifications 
WHERE user_id = 'user-1-uuid' 
  AND is_read = false;

-- 알림 타입별 개수
SELECT 
  type,
  COUNT(*) as count,
  COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count
FROM notifications 
WHERE user_id = 'user-1-uuid'
GROUP BY type;
