-- User Blocks Schema
-- 사용자 차단 기능을 위한 테이블 추가

-- =============================================
-- User Blocks Table
-- =============================================

-- User blocks table (사용자 차단)
CREATE TABLE user_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- 차단한 사용자
    blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- 차단당한 사용자
    
    -- 차단 사유 (선택사항)
    reason TEXT, -- 'spam', 'harassment', 'inappropriate_behavior', 'other'
    reason_detail TEXT, -- 상세 사유
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 제약조건
    CONSTRAINT no_self_block CHECK (blocker_id != blocked_id),
    UNIQUE(blocker_id, blocked_id)
);

-- =============================================
-- Indexes for Performance
-- =============================================

CREATE INDEX idx_user_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked_id ON user_blocks(blocked_id);
CREATE INDEX idx_user_blocks_created_at ON user_blocks(created_at);

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신이 차단한 목록만 볼 수 있음
CREATE POLICY user_blocks_own_blocks ON user_blocks 
    FOR ALL USING (auth.uid() = blocker_id);

-- =============================================
-- Views for Common Queries
-- =============================================

-- 사용자별 차단 목록 뷰 (차단한 사용자 정보 포함)
CREATE VIEW user_blocked_list AS
SELECT 
    ub.id,
    ub.blocker_id,
    ub.blocked_id,
    ub.reason,
    ub.reason_detail,
    ub.created_at,
    u.name AS blocked_user_name,
    u.nickname AS blocked_user_nickname,
    u.profile_image_url AS blocked_user_profile_image
FROM user_blocks ub
JOIN users u ON ub.blocked_id = u.id
WHERE u.is_active = true;

-- =============================================
-- Functions for Block Validation
-- =============================================

-- 두 사용자 간 차단 관계 확인 함수
CREATE OR REPLACE FUNCTION is_user_blocked(blocker_uuid UUID, blocked_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_blocks 
        WHERE blocker_id = blocker_uuid 
        AND blocked_id = blocked_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 양방향 차단 확인 함수 (A가 B를 차단했거나 B가 A를 차단한 경우)
CREATE OR REPLACE FUNCTION is_blocked_either_way(user1_uuid UUID, user2_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_blocks 
        WHERE (blocker_id = user1_uuid AND blocked_id = user2_uuid)
        OR (blocker_id = user2_uuid AND blocked_id = user1_uuid)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;