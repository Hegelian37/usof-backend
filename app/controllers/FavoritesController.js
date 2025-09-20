const db = require('../../config/db');

class FavoritesController {
    // POST /api/favorites/:post_id - Add post to favorites
    static async addToFavorites(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const postId = req.params.post_id;
            const userId = req.session.userId;

            // Check if post exists
            const [postRows] = await db.query('SELECT id FROM posts WHERE id = ?', [postId]);
            if (postRows.length === 0) {
                return res.status(404).json({ message: 'Post not found' });
            }

            // Try to add to favorites (will fail if already exists due to UNIQUE constraint, but meh)
            try {
                await db.query(
                    'INSERT INTO user_favorites (user_id, post_id) VALUES (?, ?)',
                    [userId, postId]
                );
                res.json({ message: 'Post added to favorites' });
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'Post already in favorites' });
                }
                throw error;
            }
        } catch (error) {
            res.status(500).json({ message: 'Failed to add to favorites', error: error.message });
        }
    }

    // DELETE /api/favorites/:post_id - Remove post from favorites
    static async removeFromFavorites(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const postId = req.params.post_id;
            const userId = req.session.userId;

            const [result] = await db.query(
                'DELETE FROM user_favorites WHERE user_id = ? AND post_id = ?',
                [userId, postId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Favorite not found' });
            }

            res.json({ message: 'Post removed from favorites' });
        } catch (error) {
            res.status(500).json({ message: 'Failed to remove from favorites', error: error.message });
        }
    }

    // GET /api/favorites - Get user's favorite posts
    static async getUserFavorites(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const userId = req.session.userId;

            // Get total count
            const [countRows] = await db.query(`
                SELECT COUNT(*) as total 
                FROM user_favorites uf 
                INNER JOIN posts p ON uf.post_id = p.id 
                WHERE uf.user_id = ? AND p.status = 'active'
            `, [userId]);
            const totalItems = countRows[0].total;
            const totalPages = Math.ceil(totalItems / limit);

            // Get favorite posts with details
            const [posts] = await db.query(`
                SELECT p.*, u.login as author_login,
                       uf.created_at as favorited_at,
                       (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.type = 'like') as likes_count,
                       (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.type = 'dislike') as dislikes_count,
                       (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.status = 'active') as comments_count
                FROM user_favorites uf
                INNER JOIN posts p ON uf.post_id = p.id
                LEFT JOIN users u ON p.user_id = u.id
                WHERE uf.user_id = ? AND p.status = 'active'
                ORDER BY uf.created_at DESC
                LIMIT ? OFFSET ?
            `, [userId, limit, offset]);

            res.json({
                posts,
                pagination: {
                    totalItems,
                    totalPages,
                    currentPage: page,
                    itemsPerPage: limit
                }
            });
        } catch (error) {
            res.status(500).json({ message: 'Failed to fetch favorites', error: error.message });
        }
    }

    // GET /api/posts/:post_id/favorite-status - Check if post is favorited by current user
    static async getFavoriteStatus(req, res) {
        try {
            if (!req.session.userId) {
                return res.json({ isFavorited: false });
            }

            const postId = req.params.post_id;
            const userId = req.session.userId;

            const [rows] = await db.query(
                'SELECT id FROM user_favorites WHERE user_id = ? AND post_id = ?',
                [userId, postId]
            );

            res.json({ isFavorited: rows.length > 0 });
        } catch (error) {
            res.status(500).json({ message: 'Failed to check favorite status', error: error.message });
        }
    }
}

module.exports = FavoritesController;