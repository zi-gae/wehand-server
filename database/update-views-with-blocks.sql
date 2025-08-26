-- Update existing views to respect user blocks
-- 차단된 사용자들을 고려하여 기존 뷰들 업데이트

-- =============================================
-- Drop and recreate active_matches view
-- =============================================

DROP VIEW IF EXISTS active_matches;

-- Active matches with venue info (차단된 사용자 제외)
CREATE VIEW active_matches AS
SELECT 
    m.*,
    v.name AS venue_name,
    v.address AS venue_address,
    v.amenities AS amenities,
    u.name AS host_name,
    u.ntrp AS host_ntrp,
    u.experience_years AS host_experience
FROM matches m
JOIN venues v ON m.venue_id = v.id
JOIN users u ON m.host_id = u.id
WHERE m.status IN ('recruiting', 'full', 'confirmed')
-- 현재 사용자가 차단한 호스트의 매치는 제외
AND NOT EXISTS (
    SELECT 1 FROM user_blocks ub 
    WHERE ub.blocker_id = auth.uid() 
    AND ub.blocked_id = m.host_id
)
-- 호스트가 현재 사용자를 차단한 매치도 제외
AND NOT EXISTS (
    SELECT 1 FROM user_blocks ub 
    WHERE ub.blocker_id = m.host_id 
    AND ub.blocked_id = auth.uid()
);

-- =============================================
-- Drop and recreate post_stats view
-- =============================================

DROP VIEW IF EXISTS post_stats;

-- Post engagement stats (차단된 사용자 제외)
CREATE VIEW post_stats AS
SELECT 
    p.id,
    p.title,
    p.author_id,
    p.category,
    p.created_at,
    p.views,
    COUNT(DISTINCT pl.user_id) AS likes_count,
    COUNT(DISTINCT c.id) AS comments_count,
    COUNT(DISTINCT pb.user_id) AS bookmarks_count
FROM posts p
LEFT JOIN post_likes pl ON p.id = pl.post_id
    -- 차단된 사용자의 좋아요 제외
    AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub 
        WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = pl.user_id)
        OR (ub.blocker_id = pl.user_id AND ub.blocked_id = auth.uid())
    )
LEFT JOIN comments c ON p.id = c.post_id AND c.is_active = true
    -- 차단된 사용자의 댓글 제외
    AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub 
        WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = c.author_id)
        OR (ub.blocker_id = c.author_id AND ub.blocked_id = auth.uid())
    )
LEFT JOIN post_bookmarks pb ON p.id = pb.post_id
    -- 차단된 사용자의 북마크 제외
    AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub 
        WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = pb.user_id)
        OR (ub.blocker_id = pb.user_id AND ub.blocked_id = auth.uid())
    )
WHERE p.is_active = true AND p.is_deleted = false
-- 차단된 사용자가 작성한 게시글 제외
AND NOT EXISTS (
    SELECT 1 FROM user_blocks ub 
    WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = p.author_id)
    OR (ub.blocker_id = p.author_id AND ub.blocked_id = auth.uid())
)
GROUP BY p.id, p.title, p.author_id, p.category, p.created_at, p.views;

-- =============================================
-- Add new RLS policies for existing tables considering blocks
-- =============================================

-- Posts: 차단된 사용자의 게시글은 보이지 않도록
DROP POLICY IF EXISTS posts_read_public ON posts;
CREATE POLICY posts_read_public ON posts FOR SELECT USING (
    is_active = true 
    AND is_deleted = false
    -- 차단된 사용자의 게시글 제외
    AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub 
        WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = posts.author_id)
        OR (ub.blocker_id = posts.author_id AND ub.blocked_id = auth.uid())
    )
);

-- Comments: 차단된 사용자의 댓글은 보이지 않도록
DROP POLICY IF EXISTS comments_read_public ON comments;
CREATE POLICY comments_read_public ON comments FOR SELECT USING (
    is_active = true 
    AND is_deleted = false
    -- 차단된 사용자의 댓글 제외
    AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub 
        WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = comments.author_id)
        OR (ub.blocker_id = comments.author_id AND ub.blocked_id = auth.uid())
    )
);

-- Match participants: 차단된 사용자와의 매치 참여 제한
CREATE POLICY match_participants_block_check ON match_participants FOR INSERT WITH CHECK (
    -- 매치 호스트와 차단 관계가 없어야 함
    NOT EXISTS (
        SELECT 1 FROM user_blocks ub 
        JOIN matches m ON match_participants.match_id = m.id
        WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = m.host_id)
        OR (ub.blocker_id = m.host_id AND ub.blocked_id = auth.uid())
    )
);

-- =============================================
-- Helper functions for block checks in application layer
-- =============================================

-- 사용자가 특정 매치에 참여할 수 있는지 확인하는 함수
CREATE OR REPLACE FUNCTION can_join_match(user_uuid UUID, match_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    host_uuid UUID;
BEGIN
    -- 매치의 호스트 ID 가져오기
    SELECT host_id INTO host_uuid FROM matches WHERE id = match_uuid;
    
    -- 호스트와 차단 관계 확인
    RETURN NOT is_blocked_either_way(user_uuid, host_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자가 특정 채팅방에 참여할 수 있는지 확인하는 함수
CREATE OR REPLACE FUNCTION can_join_chat_room(user_uuid UUID, room_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    match_uuid UUID;
    host_uuid UUID;
    participant_record RECORD;
BEGIN
    -- 채팅방이 매치 관련인지 확인
    SELECT match_id INTO match_uuid FROM chat_rooms WHERE id = room_uuid AND type = 'match';
    
    IF match_uuid IS NOT NULL THEN
        -- 매치 채팅방인 경우 호스트와 차단 관계 확인
        SELECT host_id INTO host_uuid FROM matches WHERE id = match_uuid;
        IF is_blocked_either_way(user_uuid, host_uuid) THEN
            RETURN FALSE;
        END IF;
        
        -- 다른 참여자들과 차단 관계 확인
        FOR participant_record IN 
            SELECT cp.user_id FROM chat_participants cp 
            WHERE cp.room_id = room_uuid AND cp.is_active = true
        LOOP
            IF is_blocked_either_way(user_uuid, participant_record.user_id) THEN
                RETURN FALSE;
            END IF;
        END LOOP;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;