CREATE VIEW user_ratings_view AS
SELECT 
    u.id AS user_id,
    COALESCE(SUM(CASE WHEN pl.type = 'like' THEN 1 ELSE -1 END), 0) +
    COALESCE(SUM(CASE WHEN cl.type = 'like' THEN 1 ELSE -1 END), 0) AS calculated_rating
FROM 
    users u
LEFT JOIN 
    post_likes pl ON u.id = pl.user_id
LEFT JOIN 
    comment_likes cl ON u.id = cl.user_id
GROUP BY 
    u.id;