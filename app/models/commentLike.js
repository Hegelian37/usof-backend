const Model = require('../model.js');

const db = require('../../config/db');

class CommentLike extends Model {
    static tableName = 'comment_likes';

    constructor({ id = null, user_id = null, comment_id = null, type = 'like', created_at = null } = {}) {
        super({ id, user_id, comment_id, type, created_at });
    }

    static async getByCommentId(commentId) {
        const [rows] = await db.query(`
            SELECT cl.*, u.login as author_login FROM comment_likes cl
            LEFT JOIN users u ON cl.user_id = u.id
            WHERE cl.comment_id = ?
            ORDER BY cl.created_at DESC
        `, [commentId]);
        return rows;
    }

    static async findByUserAndComment(userId, commentId) {
        const [rows] = await db.query(
            'SELECT * FROM comment_likes WHERE user_id = ? AND comment_id = ?',
            [userId, commentId]
        );
        return rows.length > 0 ? new this(rows[0]) : null;
    }
}

module.exports = CommentLike;