const Model = require('../model.js');

const db = require('../../config/db');

class Comment extends Model {
    static tableName = 'comments';

    constructor({ id = null, post_id = null, user_id = null, content = null, status = 'active', created_at = null, updated_at = null } = {}) {
        super({ id, post_id, user_id, content, status, created_at, updated_at });
    }

    // Modified to accept admin parameter
    static async getByPostId(postId, includeInactive = false, userId = null) {
        let statusCondition = '';
        const queryParams = [postId];
        
        if (!includeInactive) {
            if (userId) {
                statusCondition = "AND (c.status = 'active' OR c.user_id = ?)";
                queryParams.push(userId);
            } else {
                statusCondition = "AND c.status = 'active'";
            }
        }
        
        const [rows] = await db.query(`
            SELECT c.*, u.login as author_login, u.full_name as author_name
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ? ${statusCondition}
            ORDER BY c.created_at DESC
        `, queryParams);
        return rows.map(row => new this(row));
    }

    // New method to get all comments with optional filtering
    static async getAllComments(includeInactive = false, limit = null, offset = null) {
        const statusCondition = includeInactive ? '' : "WHERE c.status = 'active'";
        const limitCondition = limit ? `LIMIT ${limit}` : '';
        const offsetCondition = offset ? `OFFSET ${offset}` : '';
        
        const [rows] = await db.query(`
            SELECT c.*, u.login as author_login, u.full_name as author_name, 
                   p.title as post_title
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN posts p ON c.post_id = p.id
            ${statusCondition}
            ORDER BY c.created_at DESC
            ${limitCondition} ${offsetCondition}
        `);
        return rows;
    }

    // Get total count of comments
    static async getCount(includeInactive = false) {
        const statusCondition = includeInactive ? '' : "WHERE status = 'active'";
        
        const [rows] = await db.query(`
            SELECT COUNT(*) as total FROM comments ${statusCondition}
        `);
        return rows[0].total;
    }
}

module.exports = Comment;