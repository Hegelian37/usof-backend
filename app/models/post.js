const Model = require('../model.js');

const db = require('../../config/db');

class Post extends Model {
    static tableName = 'posts';

    constructor({ id = null, user_id = null, title = null, content = null, status = 'active', created_at = null, updated_at = null } = {}) {
        super({ id, user_id, title, content, status, created_at, updated_at });
    }

    static async getAllWithPagination(page = 1, limit = 10, sortBy = 'likes', order = 'DESC', filters = {}) {
        let baseQuery = `
            SELECT p.*, u.login as author_login, u.full_name as author_name,
                   COUNT(DISTINCT CASE WHEN pl.type = 'like' THEN pl.id END) as likes_count,
                   COUNT(DISTINCT CASE WHEN pl.type = 'dislike' THEN pl.id END) as dislikes_count
            FROM posts p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN post_likes pl ON p.id = pl.post_id
        `;
        
        const conditions = [];
        const params = [];

        // Status filter (users can only see active posts)
        if (filters.status !== 'admin_view') {
            conditions.push('p.status = ?');
            params.push('active');
        }

        // Category filter
        if (filters.categories && filters.categories.length > 0) {
            const categoryPlaceholders = filters.categories.map(() => '?').join(',');
            baseQuery += ` INNER JOIN post_categories pc ON p.id = pc.post_id WHERE pc.category_id IN (${categoryPlaceholders})`;
            params.push(...filters.categories);
        }

        // Date filter
        if (filters.dateFrom) {
            conditions.push('p.created_at >= ?');
            params.push(filters.dateFrom);
        }
        if (filters.dateTo) {
            conditions.push('p.created_at <= ?');
            params.push(filters.dateTo);
        }

        if (conditions.length > 0) {
            baseQuery += (baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ') + conditions.join(' AND ');
        }

        baseQuery += ' GROUP BY p.id';

        // Sorting
        if (sortBy === 'likes') {
            baseQuery += ` ORDER BY (likes_count - dislikes_count) ${order}`;
        } else if (sortBy === 'date') {
            baseQuery += ` ORDER BY p.created_at ${order}`;
        }

        // Pagination
        const offset = (page - 1) * limit;
        baseQuery += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [rows] = await db.query(baseQuery, params);
        return rows.map(row => new this(row));
    }

    async getCategories() {
        const [rows] = await db.query(`
            SELECT c.* FROM categories c
            INNER JOIN post_categories pc ON c.id = pc.category_id
            WHERE pc.post_id = ?
        `, [this.attributes.id]);
        return rows;
    }

    async setCategories(categoryIds) {
        // Remove existing categories
        await db.query('DELETE FROM post_categories WHERE post_id = ?', [this.attributes.id]);
        
        // Add new categories
        if (categoryIds && categoryIds.length > 0) {
            const values = categoryIds.map(catId => [this.attributes.id, catId]);
            await db.query('INSERT INTO post_categories (post_id, category_id) VALUES ?', [values]);
        }
    }
}

module.exports = Post;