-- WeHand Tennis App Database Schema
-- Supabase PostgreSQL

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- for location data

-- =============================================
-- 1. Users & Authentication Tables
-- =============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    nickname TEXT UNIQUE,
    location TEXT, -- 지역 (서울시 강남구)
    bio TEXT,
    profile_image_url TEXT,
    
    -- Tennis specific info
    ntrp DECIMAL(2,1), -- NTRP rating (1.0 - 7.0)
    experience_years INTEGER, -- 구력 (년)
    favorite_style TEXT, -- 플레이 스타일 (공격적 베이스라인)
    
    -- Statistics
    total_matches INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0.0,
    ranking INTEGER,
    total_reviews INTEGER DEFAULT 0,
    positive_reviews INTEGER DEFAULT 0,
    negative_reviews INTEGER DEFAULT 0,
    review_ntrp DECIMAL(2,1),
    
    -- OAuth provider info
    provider TEXT, -- 'email', 'kakao', 'apple'
    provider_id TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- User preferences
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification settings
    match_notifications BOOLEAN DEFAULT true,
    chat_notifications BOOLEAN DEFAULT true,
    marketing_notifications BOOLEAN DEFAULT false,
    
    -- App settings
    theme TEXT DEFAULT 'light', -- 'light', 'dark', 'system'
    language TEXT DEFAULT 'ko',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. Location & Venues Tables
-- =============================================

-- Regions table
CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'city', 'province', 'district'
    parent_id UUID REFERENCES regions(id),
    code TEXT UNIQUE, -- administrative code
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tennis venues
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    region_id UUID REFERENCES regions(id),
    location GEOGRAPHY(POINT, 4326), -- PostGIS point for lat/lng
    
    -- Venue details
    courts JSONB, -- ["1번 코트", "2번 코트"]
    amenities JSONB, -- ["주차장", "샤워실", "락커"]
    price_range TEXT, -- "15,000-25,000원"
    contact_phone TEXT,
    website TEXT,
    
    -- Operating hours
    operating_hours JSONB, -- {"monday": "06:00-22:00", ...}
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- =============================================
-- 3. Match Related Tables
-- =============================================

-- Match status enum
CREATE TYPE match_status AS ENUM (
    'recruiting',    -- 모집중
    'full',         -- 모집완료
    'confirmed',    -- 확정
    'in_progress',  -- 진행중
    'completed',    -- 완료
    'cancelled'     -- 취소
);

-- Game type enum
CREATE TYPE game_type AS ENUM (
    'singles',      -- 단식
    'mens_doubles', -- 남복
    'womens_doubles', -- 여복
    'mixed_doubles' -- 혼복
);

-- Matches table
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    
    -- Host info
    host_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Match details
    game_type game_type NOT NULL,
    venue_id UUID REFERENCES venues(id),
    court TEXT, -- 코트명 (1번 코트)
    
    -- DateTime
    match_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Participants
    max_participants INTEGER NOT NULL,
    current_participants INTEGER DEFAULT 1, -- host included
    
    -- Requirements
    recruit_ntrp_min DECIMAL(2,1),
    recruit_ntrp_max DECIMAL(2,1),
    recruit_experience_min INTEGER,
    recruit_experience_max INTEGER,
    
    -- Pricing
    price INTEGER, -- 원 단위
    price_currency TEXT DEFAULT 'KRW',
    
    -- Match rules and info
    rules JSONB, -- ["매너를 지켜주세요", ...]
    equipment JSONB, -- ["라켓", "테니스공"]
    parking_info TEXT,
    
    -- Status
    status match_status DEFAULT 'recruiting',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT valid_participants CHECK (current_participants <= max_participants),
    CONSTRAINT valid_ntrp_range CHECK (recruit_ntrp_min <= recruit_ntrp_max),
    CONSTRAINT valid_time CHECK (start_time < end_time)
);

-- Match participants (many-to-many)
CREATE TABLE match_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Participation details
    status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected', 'cancelled'
    join_message TEXT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    
    -- Is host
    is_host BOOLEAN DEFAULT false,
    
    UNIQUE(match_id, user_id)
);

-- Match results (after completion)
CREATE TABLE match_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    
    -- Result details
    winner_id UUID REFERENCES users(id), -- null for draws
    loser_id UUID REFERENCES users(id),
    score JSONB, -- {"sets": [{"winner": 6, "loser": 4}, {"winner": 6, "loser": 2}]}
    duration_minutes INTEGER,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User reviews for matches
CREATE TABLE match_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    ntrp_evaluation DECIMAL(2,1) CHECK (ntrp_evaluation >= 1.0 AND ntrp_evaluation <= 7.0), -- NTRP level evaluation
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(match_id, reviewer_id, reviewee_id)
);

-- =============================================
-- 4. Community Tables (Posts & Comments)
-- =============================================

-- Post categories
CREATE TYPE post_category AS ENUM (
    'free',        -- 자유게시판
    'tips',        -- 팁/기술
    'equipment',   -- 장비
    'match',       -- 경기후기
    'question',    -- 질문
    'announcement' -- 공지사항
);

-- Posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Category and status
    category post_category NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    is_hot BOOLEAN DEFAULT false, -- auto-calculated based on engagement
    
    -- Engagement metrics
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    
    -- Media attachments
    attachments JSONB, -- [{"type": "image", "url": "...", "filename": "..."}]
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Post likes (many-to-many)
CREATE TABLE post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(post_id, user_id)
);

-- Post bookmarks
CREATE TABLE post_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(post_id, user_id)
);

-- Comments table (supports nested replies)
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    
    -- Nested structure
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    depth INTEGER DEFAULT 0, -- 0 for top-level, 1+ for replies
    
    -- Engagement
    likes INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_depth CHECK (depth >= 0 AND depth <= 3) -- limit nesting
);

-- Comment likes
CREATE TABLE comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(comment_id, user_id)
);

-- Match bookmarks
CREATE TABLE match_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(match_id, user_id)
);

-- =============================================
-- 5. Chat & Messaging Tables
-- =============================================

-- Chat room types
CREATE TYPE chat_room_type AS ENUM (
    'match',    -- 매치 관련 단체 채팅
    'private'   -- 개인 채팅
);

-- Chat rooms
CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT, -- 채팅방 이름 (단체 채팅용)
    type chat_room_type NOT NULL,
    
    -- Match-related chat info
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    
    -- Room settings
    is_active BOOLEAN DEFAULT true,
    max_participants INTEGER DEFAULT 50,
    current_participants INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Note: Unique constraint for match chats will be added separately
);

-- Add unique constraint for match chats (partial unique index)
CREATE UNIQUE INDEX idx_unique_match_chat ON chat_rooms(match_id) WHERE type = 'match';

-- Chat room participants
CREATE TABLE chat_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Participant role
    role TEXT DEFAULT 'member', -- 'admin', 'member'
    
    -- Status
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    
    -- Last read message (for unread count)
    last_read_message_id UUID,
    
    UNIQUE(room_id, user_id)
);

-- Chat messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Message content
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- 'text', 'system', 'image', 'file'
    
    -- Media attachments (if any)
    attachments JSONB, -- [{"type": "image", "url": "...", "filename": "..."}]
    
    -- System message info
    system_event TEXT, -- 'user_joined', 'user_left', 'match_created', etc.
    
    -- Message status
    is_edited BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Message read receipts (optional - for read status)
CREATE TABLE message_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(message_id, user_id)
);

-- =============================================
-- 6. Notifications Tables
-- =============================================

-- Notification types
CREATE TYPE notification_type AS ENUM (
    'match',         -- 매치 관련 (승인, 거부, 시작 등)
    'chat',          -- 채팅 메시지
    'community',     -- 커뮤니티 (좋아요, 댓글 등)
    'system',        -- 시스템 알림
    'marketing'      -- 마케팅 알림
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification content
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Related entities (optional)
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    chat_room_id UUID REFERENCES chat_rooms(id) ON DELETE SET NULL,
    
    -- Action data (for deep linking)
    action_data JSONB, -- {"type": "navigate", "screen": "MatchDetail", "params": {...}}
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Push notification info
    is_pushed BOOLEAN DEFAULT false,
    pushed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE -- optional expiration
);

-- Push notification tokens (for FCM)
CREATE TABLE push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    token TEXT NOT NULL,
    platform TEXT NOT NULL, -- 'ios', 'android', 'web'
    device_info JSONB, -- device details
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, token)
);

-- =============================================
-- 7. Indexes for Performance
-- =============================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_nickname ON users(nickname);
CREATE INDEX idx_users_location ON users(location);
CREATE INDEX idx_users_ntrp ON users(ntrp);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Matches indexes
CREATE INDEX idx_matches_host_id ON matches(host_id);
CREATE INDEX idx_matches_venue_id ON matches(venue_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_game_type ON matches(game_type);
CREATE INDEX idx_matches_date_time ON matches(match_date, start_time);
CREATE INDEX idx_matches_created_at ON matches(created_at);
CREATE INDEX idx_matches_ntrp_range ON matches(recruit_ntrp_min, recruit_ntrp_max);

-- Match participants indexes
CREATE INDEX idx_match_participants_match_id ON match_participants(match_id);
CREATE INDEX idx_match_participants_user_id ON match_participants(user_id);
CREATE INDEX idx_match_participants_status ON match_participants(status);

-- Posts indexes
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_category ON posts(category);
CREATE INDEX idx_posts_created_at ON posts(created_at);
CREATE INDEX idx_posts_is_pinned ON posts(is_pinned);
CREATE INDEX idx_posts_is_hot ON posts(is_hot);
CREATE INDEX idx_posts_active ON posts(is_active, is_deleted);

-- Comments indexes
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);

-- Chat rooms indexes
CREATE INDEX idx_chat_rooms_match_id ON chat_rooms(match_id);
CREATE INDEX idx_chat_rooms_type ON chat_rooms(type);

-- Messages indexes
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Venues indexes (PostGIS spatial index)
CREATE INDEX idx_venues_location ON venues USING GIST(location);
CREATE INDEX idx_venues_region_id ON venues(region_id);

-- =============================================
-- 8. Views for Common Queries
-- =============================================

-- Active matches with venue info
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
WHERE m.status IN ('recruiting', 'full', 'confirmed');

-- User match history with results
CREATE VIEW user_match_history AS
SELECT 
    mp.user_id,
    m.id AS match_id,
    m.title,
    m.match_date,
    m.game_type,
    v.name AS venue_name,
    mp.status AS participation_status,
    CASE 
        WHEN mr.winner_id = mp.user_id THEN 'win'
        WHEN mr.loser_id = mp.user_id THEN 'loss'
        ELSE 'no_result'
    END AS result,
    mr.score
FROM match_participants mp
JOIN matches m ON mp.match_id = m.id
JOIN venues v ON m.venue_id = v.id
LEFT JOIN match_results mr ON m.id = mr.match_id;

-- Post engagement stats
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
LEFT JOIN comments c ON p.id = c.post_id AND c.is_active = true
LEFT JOIN post_bookmarks pb ON p.id = pb.post_id
WHERE p.is_active = true AND p.is_deleted = false
GROUP BY p.id, p.title, p.author_id, p.category, p.created_at, p.views;

-- =============================================
-- 9. Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY users_own_data ON users FOR ALL USING (auth.uid() = id);

-- Users can read public user info
CREATE POLICY users_public_read ON users FOR SELECT USING (true);

-- User preferences are private
CREATE POLICY user_preferences_own ON user_preferences FOR ALL USING (auth.uid() = user_id);

-- Matches are publicly readable, authenticated users can create, only hosts can update/delete their matches
CREATE POLICY matches_read_public ON matches FOR SELECT USING (true);
CREATE POLICY matches_create_authenticated ON matches FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY matches_host_update ON matches FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY matches_host_delete ON matches FOR DELETE USING (auth.uid() = host_id);

-- Match participants can see their own participation
CREATE POLICY match_participants_own ON match_participants FOR ALL USING (auth.uid() = user_id);

-- Posts are publicly readable
CREATE POLICY posts_read_public ON posts FOR SELECT USING (is_active = true AND is_deleted = false);
CREATE POLICY posts_author_manage ON posts FOR ALL USING (auth.uid() = author_id);

-- Comments are publicly readable
CREATE POLICY comments_read_public ON comments FOR SELECT USING (is_active = true AND is_deleted = false);
CREATE POLICY comments_author_manage ON comments FOR ALL USING (auth.uid() = author_id);

-- Chat room participants can access their rooms
CREATE POLICY chat_participants_own_rooms ON chat_participants FOR ALL USING (auth.uid() = user_id);

-- Only chat participants can see messages
CREATE POLICY messages_participants_only ON messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM chat_participants cp 
        WHERE cp.room_id = messages.room_id 
        AND cp.user_id = auth.uid() 
        AND cp.is_active = true
    )
);

-- Users can send messages to rooms they're in
CREATE POLICY messages_participants_send ON messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM chat_participants cp 
        WHERE cp.room_id = messages.room_id 
        AND cp.user_id = auth.uid() 
        AND cp.is_active = true
    )
);

-- Notifications are private to users
CREATE POLICY notifications_own ON notifications FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 10. Triggers for Auto-updates
-- =============================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update match participant count
CREATE OR REPLACE FUNCTION update_match_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE matches 
        SET current_participants = (
            SELECT COUNT(*) FROM match_participants 
            WHERE match_id = NEW.match_id AND status = 'confirmed'
        )
        WHERE id = NEW.match_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE matches 
        SET current_participants = (
            SELECT COUNT(*) FROM match_participants 
            WHERE match_id = NEW.match_id AND status = 'confirmed'
        )
        WHERE id = NEW.match_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE matches 
        SET current_participants = (
            SELECT COUNT(*) FROM match_participants 
            WHERE match_id = OLD.match_id AND status = 'confirmed'
        )
        WHERE id = OLD.match_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER match_participant_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON match_participants
    FOR EACH ROW EXECUTE FUNCTION update_match_participant_count();

-- Function to update post engagement counts
CREATE OR REPLACE FUNCTION update_post_engagement()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'post_likes' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE posts SET likes = likes + 1 WHERE id = NEW.post_id;
            RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE posts SET likes = likes - 1 WHERE id = OLD.post_id;
            RETURN OLD;
        END IF;
    ELSIF TG_TABLE_NAME = 'comments' THEN
        IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
            UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
            RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
            IF OLD.is_active = true AND NEW.is_active = false THEN
                UPDATE posts SET comments_count = comments_count - 1 WHERE id = NEW.post_id;
            ELSIF OLD.is_active = false AND NEW.is_active = true THEN
                UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
            END IF;
            RETURN NEW;
        ELSIF TG_OP = 'DELETE' AND OLD.is_active = true THEN
            UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
            RETURN OLD;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_likes_engagement_trigger
    AFTER INSERT OR DELETE ON post_likes
    FOR EACH ROW EXECUTE FUNCTION update_post_engagement();

CREATE TRIGGER comments_engagement_trigger
    AFTER INSERT OR UPDATE OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_post_engagement();


    -- featured_posts 테이블 생성
CREATE TABLE featured_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  featured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  featured_type VARCHAR(50) DEFAULT 'daily', -- daily, weekly, special 등
  metrics JSONB, -- 선정 당시의 지표 (좋아요, 댓글, 조회수 등)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, featured_type)
);

-- posts 테이블에 인기 게시글 관련 컬럼 추가
ALTER TABLE posts ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN featured_until TIMESTAMP WITH TIME ZONE;