const Category = require('../models/category');
const User = require('../models/user');

const db = require('../../config/db');

class CategoryController {
    // GET /api/categories - Get all categories -- now with pagination!
    static async getAllCategories(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;

            const [totalCountRows] = await db.query('SELECT COUNT(*) AS total FROM categories');
            const totalItems = totalCountRows[0].total;
            const totalPages = Math.ceil(totalItems / limit);

            const [rows] = await db.query(`
                SELECT * FROM categories 
                ORDER BY title
                LIMIT ? OFFSET ?
            `, [limit, offset]);
            
            res.json({ 
                categories: rows,
                pagination: {
                    totalItems,
                    totalPages,
                    currentPage: page,
                    itemsPerPage: limit
                }
            });
        } catch (error) {
            res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
        }
    }

    // GET /api/categories/:category_id - Get specific category
    static async getCategory(req, res) {
        try {
            const categoryId = req.params.category_id;
            const category = await Category.find(categoryId);
            
            if (!category) {
                return res.status(404).json({ message: 'Category not found' });
            }

            res.json({ category: category.attributes });
        } catch (error) {
            res.status(500).json({ message: 'Failed to fetch category', error: error.message });
        }
    }

    // GET /api/categories/:category_id/posts - Get category posts
    static async getCategoryPosts(req, res) {
        try {
            const categoryId = req.params.category_id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            const category = await Category.find(categoryId);
            if (!category) {
                return res.status(404).json({ message: 'Category not found' });
            }

            const posts = await category.getPosts(page, limit);
            res.json({ posts });
        } catch (error) {
            res.status(500).json({ message: 'Failed to fetch category posts', error: error.message });
        }
    }

    // POST /api/categories - Create category (admin only)
    static async createCategory(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const user = await User.find(req.session.userId);
            if (!user || user.attributes.status !== 'admin') {
                return res.status(403).json({ message: 'Admin privileges required' });
            }

            const { title, descript } = req.body;
            
            if (!title) {
                return res.status(400).json({ message: 'Title is required' });
            }

            const category = new Category({ title, descript });
            await category.save();

            res.status(201).json({ message: 'Category created successfully', category: category.attributes });
        } catch (error) {
            res.status(500).json({ message: 'Failed to create category', error: error.message });
        }
    }

    // PATCH /api/categories/:category_id - Update category (admin only)
    static async updateCategory(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const user = await User.find(req.session.userId);
            if (!user || user.attributes.status !== 'admin') {
                return res.status(403).json({ message: 'Admin privileges required' });
            }

            const categoryId = req.params.category_id;
            const category = await Category.find(categoryId);

            if (!category) {
                return res.status(404).json({ message: 'Category not found' });
            }

            const { title, descript } = req.body;

            if (title) category.attributes.title = title;
            if (descript !== undefined) category.attributes.descript = descript;

            await category.save();
            res.json({ message: 'Category updated successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Failed to update category', error: error.message });
        }
    }

    // DELETE /api/categories/:category_id - Delete category (admin only)
    static async deleteCategory(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const user = await User.find(req.session.userId);
            if (!user || user.attributes.status !== 'admin') {
                return res.status(403).json({ message: 'Admin privileges required' });
            }

            const categoryId = req.params.category_id;
            const category = await Category.find(categoryId);

            if (!category) {
                return res.status(404).json({ message: 'Category not found' });
            }

            await category.delete();
            res.json({ message: 'Category deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Failed to delete category', error: error.message });
        }
    }
}

module.exports = CategoryController;