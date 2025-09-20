const Model = require('../model.js');

const db = require('../../config/db');

class PostLike extends Model {
    static tableName = 'post_likes';

    constructor({ id = null, user_id = null, post_id = null, type = 'like', created_at = null } = {}) {
        super({ id, user_id, post_id, type, created_at });
    }

    static async getByPostId(postId) {
        const [rows] = await db.query(`
            SELECT pl.*, u.login as author_login FROM post_likes pl
            LEFT JOIN users u ON pl.user_id = u.id
            WHERE pl.post_id = ?
            ORDER BY pl.created_at DESC
        `, [postId]);
        return rows;
    }

    static async findByUserAndPost(userId, postId) {
        const [rows] = await db.query(
            'SELECT * FROM post_likes WHERE user_id = ? AND post_id = ?',
            [userId, postId]
        );
        return rows.length > 0 ? new this(rows[0]) : null;
    }
}

module.exports = PostLike;