-- Update active_matches view to include amenities column
-- Run this in your Supabase SQL editor or database client

-- Drop the existing view
DROP VIEW IF EXISTS active_matches;

-- Recreate the view with amenities column
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
