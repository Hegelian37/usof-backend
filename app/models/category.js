const Model = require('../model.js');

class Category extends Model {
    static tableName = 'categories';
    static uniqueFields = ['title'];

    constructor({ id = null, title = null, descript = null, created_at = null } = {}) {
        super({ id, title, descript, created_at });
    }

    async getPosts(page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        const [rows] = await db.query(`
            SELECT p.*, u.login as author_login FROM posts p
            INNER JOIN post_categories pc ON p.id = pc.post_id
            LEFT JOIN users u ON p.user_id = u.id
            WHERE pc.category_id = ? AND p.status = 'active'
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [this.attributes.id, limit, offset]);
        return rows;
    }
}

module.exports = Category;