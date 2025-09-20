const Post = require('../models/post');
const Comment = require('../models/comment');
const PostLike = require('../models/postLike');
const User = require('../models/user');

const db = require('../../config/db');

class PostController {
    // GET /api/posts - Get all posts with pagination and filtering
    static async getAllPosts(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const sortBy = req.query.sortBy || 'likes';
            const order = req.query.order || 'DESC';
            
            const filters = {};
            if (req.query.categories) {
                filters.categories = Array.isArray(req.query.categories) ? 
                    req.query.categories.map(id => parseInt(id)) : [parseInt(req.query.categories)];
            }
            if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
            if (req.query.dateTo) filters.dateTo = req.query.dateTo;
            if (req.query.status) filters.status = req.query.status;

            // Check if user is admin to show all posts including inactive
            if (req.session.userId) {
                const user = await User.find(req.session.userId);
                if (user && user.attributes.status === 'admin' && req.query.status === 'admin_view') {
                    filters.status = 'admin_view';
                }
            }

            // Build the query
            let baseQuery = `
                SELECT p.*, u.login as author_login, u.full_name as author_name,
                    COALESCE(COUNT(DISTINCT CASE WHEN pl.type = 'like' THEN pl.id END), 0) as likes_count,
                    COALESCE(COUNT(DISTINCT CASE WHEN pl.type = 'dislike' THEN pl.id END), 0) as dislikes_count,
                    COALESCE(COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END), 0) as comments_count,
                    (
                        SELECT COALESCE(SUM(CASE WHEN post_likes.type = 'like' THEN 1 WHEN post_likes.type = 'dislike' THEN -1 END), 0) 
                        FROM post_likes 
                        INNER JOIN posts ON post_likes.post_id = posts.id 
                        WHERE posts.user_id = u.id
                    ) +
                    (
                        SELECT COALESCE(SUM(CASE WHEN comment_likes.type = 'like' THEN 1 WHEN comment_likes.type = 'dislike' THEN -1 END), 0) 
                        FROM comment_likes 
                        INNER JOIN comments ON comment_likes.comment_id = comments.id 
                        WHERE comments.user_id = u.id
                    ) as author_rating
                FROM posts p
                LEFT JOIN users u ON p.user_id = u.id
                LEFT JOIN post_likes pl ON p.id = pl.post_id
                LEFT JOIN comments c ON p.id = c.post_id
            `;
            
            const conditions = [];
            const params = [];

            // Status filter (users can only see active posts)
            if (filters.status !== 'admin_view') {
                if (req.session.userId) {
                    conditions.push('(p.status = ? OR p.user_id = ?)');
                    params.push('active', req.session.userId);
                } else {
                    conditions.push('p.status = ?');
                    params.push('active');
                }
            }

            // Category filter
            if (filters.categories && filters.categories.length > 0) {
                const categoryPlaceholders = filters.categories.map(() => '?').join(',');
                baseQuery += ` INNER JOIN post_categories pc ON p.id = pc.post_id`;
                conditions.push(`pc.category_id IN (${categoryPlaceholders})`);
                params.push(...filters.categories);
            }

            // Date filters
            if (filters.dateFrom) {
                conditions.push('p.created_at >= ?');
                params.push(filters.dateFrom);
            }
            if (filters.dateTo) {
                conditions.push('p.created_at <= ?');
                params.push(filters.dateTo);
            }

            if (conditions.length > 0) {
                baseQuery += ' WHERE ' + conditions.join(' AND ');
            }

            baseQuery += ' GROUP BY p.id, u.id, u.login, u.full_name';

            // Get total count for pagination
            let countQuery = `
                SELECT COUNT(DISTINCT p.id) as total
                FROM posts p
                LEFT JOIN users u ON p.user_id = u.id
            `;

            if (filters.categories && filters.categories.length > 0) {
                countQuery += ` INNER JOIN post_categories pc ON p.id = pc.post_id`;
            }

            const countConditions = [];
            const countParams = [];

            if (filters.status !== 'admin_view') {
                if (req.session.userId) {
                    countConditions.push('(p.status = ? OR p.user_id = ?)');
                    countParams.push('active', req.session.userId);
                } else {
                    countConditions.push('p.status = ?');
                    countParams.push('active');
                }
            }

            if (filters.categories && filters.categories.length > 0) {
                const categoryPlaceholders = filters.categories.map(() => '?').join(',');
                countConditions.push(`pc.category_id IN (${categoryPlaceholders})`);
                countParams.push(...filters.categories);
            }

            if (filters.dateFrom) {
                countConditions.push('p.created_at >= ?');
                countParams.push(filters.dateFrom);
            }
            if (filters.dateTo) {
                countConditions.push('p.created_at <= ?');
                countParams.push(filters.dateTo);
            }

            if (countConditions.length > 0) {
                countQuery += ' WHERE ' + countConditions.join(' AND ');
            }

            const [countResult] = await db.query(countQuery, countParams);
            const total = countResult[0]?.total || 0;

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
            
            res.json({
                posts: rows,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit
                }
            });
        } catch (error) {
            console.error('Get posts error:', error);
            res.status(500).json({ message: 'Failed to fetch posts', error: error.message });
        }
    }

    // GET /api/posts/:post_id - Get specific post
    static async getPost(req, res) {
        try {
            const postId = req.params.post_id;
            
            const [rows] = await db.query(`
                SELECT p.*, u.login as author_login, u.full_name as author_name,
                    COALESCE(COUNT(DISTINCT CASE WHEN pl.type = 'like' THEN pl.id END), 0) as likes_count,
                    COALESCE(COUNT(DISTINCT CASE WHEN pl.type = 'dislike' THEN pl.id END), 0) as dislikes_count,
                    COALESCE(COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END), 0) as comments_count,
                    (
                        SELECT COALESCE(SUM(CASE WHEN post_likes.type = 'like' THEN 1 WHEN post_likes.type = 'dislike' THEN -1 END), 0) 
                        FROM post_likes 
                        INNER JOIN posts ON post_likes.post_id = posts.id 
                        WHERE posts.user_id = u.id
                    ) +
                    (
                        SELECT COALESCE(SUM(CASE WHEN comment_likes.type = 'like' THEN 1 WHEN comment_likes.type = 'dislike' THEN -1 END), 0) 
                        FROM comment_likes 
                        INNER JOIN comments ON comment_likes.comment_id = comments.id 
                        WHERE comments.user_id = u.id
                    ) as author_rating
                FROM posts p
                LEFT JOIN users u ON p.user_id = u.id
                LEFT JOIN post_likes pl ON p.id = pl.post_id
                LEFT JOIN comments c ON p.id = c.post_id
                WHERE p.id = ?
                GROUP BY p.id, u.id
            `, [postId]);
            
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Post not found' });
            }

            const post = rows[0];

            // Check if user can view this post (inactive posts only visible to author and admins)
            if (post.status === 'inactive') {
                if (!req.session.userId) {
                    return res.status(404).json({ message: 'Post not found' });
                }

                const user = await User.find(req.session.userId);
                const isAdmin = user && user.attributes.status === 'admin';
                const isOwner = post.user_id === req.session.userId;
                
                if (!isAdmin && !isOwner) {
                    return res.status(404).json({ message: 'Post not found' });
                }
            }

            // Get categories for this post
            const [categoryRows] = await db.query(`
                SELECT c.* FROM categories c
                INNER JOIN post_categories pc ON c.id = pc.category_id
                WHERE pc.post_id = ?
            `, [postId]);

            res.json({ ...post, categories: categoryRows });
        } catch (error) {
            console.error('Get post error:', error);
            res.status(500).json({ message: 'Failed to fetch post', error: error.message });
        }
    }

    // POST /api/posts - Create new post
    static async createPost(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const { title, content, categories = [] } = req.body;
            
            if (!title || !content) {
                return res.status(400).json({ message: 'Title and content are required' });
            }

            // Insert post
            const [result] = await db.query(
                'INSERT INTO posts (user_id, title, content, status) VALUES (?, ?, ?, ?)',
                [req.session.userId, title, content, 'active']
            );

            const postId = result.insertId;

            // Add categories
            if (categories.length > 0) {
                const categoryValues = categories.map(catId => [postId, catId]);
                await db.query('INSERT INTO post_categories (post_id, category_id) VALUES ?', [categoryValues]);
            }

            res.status(201).json({ 
                message: 'Post created successfully', 
                post: { id: postId, title, content, status: 'active' }
            });
        } catch (error) {
            console.error('Create post error:', error);
            res.status(500).json({ message: 'Failed to create post', error: error.message });
        }
    }

    // PATCH /api/posts/:post_id - Update post
    static async updatePost(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const postId = req.params.post_id;
            const post = await Post.find(postId);

            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            const user = await User.find(req.session.userId);
            
            // Check permissions
            const isOwner = post.attributes.user_id === req.session.userId;
            const isAdmin = user && user.attributes.status === 'admin';

            if (!isOwner && !isAdmin) {
                return res.status(403).json({ message: 'Permission denied' });
            }

            const { title, content, categories, status } = req.body;

            // Users can fully alter their posts
            if (isOwner && !isAdmin) {
                if (title) post.attributes.title = title;
                if (content) post.attributes.content = content;
                // Allow users to change their post status including 'locked'
                if (status && ['active', 'inactive', 'locked'].includes(status)) {
                    post.attributes.status = status;
                }
                if (categories) {
                    await db.query('DELETE FROM post_categories WHERE post_id = ?', [postId]);
                    if (categories.length > 0) {
                        const categoryValues = categories.map(catId => [postId, catId]);
                        await db.query('INSERT INTO post_categories (post_id, category_id) VALUES ?', [categoryValues]);
                    }
                }
            }

            // Admins can update everything including status
            if (isAdmin) {
                if (title) post.attributes.title = title;
                if (content) post.attributes.content = content;
                if (status && ['active', 'inactive', 'locked'].includes(status)) {
                    post.attributes.status = status;
                }
                if (categories) {
                    await db.query('DELETE FROM post_categories WHERE post_id = ?', [postId]);
                    if (categories.length > 0) {
                        const categoryValues = categories.map(catId => [postId, catId]);
                        await db.query('INSERT INTO post_categories (post_id, category_id) VALUES ?', [categoryValues]);
                    }
                }
            }

            await post.save();
            res.json({ message: 'Post updated successfully' });
        } catch (error) {
            console.error('Update post error:', error);
            res.status(500).json({ message: 'Failed to update post', error: error.message });
        }
    }

    // DELETE /api/posts/:post_id - Delete post
    static async deletePost(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const postId = req.params.post_id;
            const post = await Post.find(postId);

            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            const user = await User.find(req.session.userId);
            const isOwner = post.attributes.user_id === req.session.userId;
            const isAdmin = user && user.attributes.status === 'admin';

            if (!isOwner && !isAdmin) {
                return res.status(403).json({ message: 'Permission denied' });
            }

            await post.delete();
            res.json({ message: 'Post deleted successfully' });
        } catch (error) {
            console.error('Delete post error:', error);
            res.status(500).json({ message: 'Failed to delete post', error: error.message });
        }
    }

    // Helper function to check if user is admin
    static async isUserAdmin(userId) {
        if (!userId) return false;
        const user = await User.find(userId);
        return user && user.attributes.status === 'admin';
    }

    // GET /api/posts/:post_id/comments - Get post comments
    static async getPostComments(req, res) {
        try {
            const postId = req.params.post_id;
            
            // Check if post exists
            const post = await Post.find(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            // Check if user is admin to show inactive comments
            const isAdmin = await PostController.isUserAdmin(req.session.userId);
            
            // Get comments with author info - including inactive ones for admins
            let statusCondition = '';
            if (!isAdmin) {
                if (req.session.userId) {
                    statusCondition = "AND (c.status = 'active' OR c.user_id = ?)";
                    // Will need req.session.userId to the query parameters
                } else {
                    statusCondition = "AND c.status = 'active'";
                }
            }
            
            const queryParams = [postId];
            if (!isAdmin && req.session.userId) {
                queryParams.push(req.session.userId);
            }

            const [comments] = await db.query(`
                SELECT c.*, 
                    u.login as author_login, 
                    u.full_name as author_name,
                    u.profile_picture as author_profile_picture
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.post_id = ? ${statusCondition}
                ORDER BY c.created_at DESC
            `, queryParams);
            
            res.json({ comments });
        } catch (error) {
            console.error('Failed to fetch post comments:', error);
            res.status(500).json({ 
                message: 'Failed to fetch comments', 
                error: error.message 
            });
        }
    }

    // NEW: GET /api/comments - Get all comments (for admin panel)
    static async getAllComments(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const isAdmin = await PostController.isUserAdmin(req.session.userId);
            if (!isAdmin) {
                return res.status(403).json({ message: 'Admin access required' });
            }

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;

            // Get all comments including inactive ones for admins
            const comments = await Comment.getAllComments(true, limit, offset);
            const total = await Comment.getCount(true);

            res.json({
                comments,
                pagination: {
                    page,
                    limit,
                    totalItems: total,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            res.status(500).json({ 
                message: 'Failed to fetch comments', 
                error: error.message 
            });
        }
    }

    // POST /api/posts/:post_id/comments - Create comment
    static async createComment(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const postId = req.params.post_id;
            const { content } = req.body;

            if (!content) {
                return res.status(400).json({ message: 'Content is required' });
            }

            // Check if post exists
            const post = await Post.find(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            // Check if post is active or locked
            if (post.attributes.status === 'inactive') {
                return res.status(404).json({ message: 'Post not found or inactive' });
            }

            // Prevent commenting on locked posts
            if (post.attributes.status === 'locked') {
                return res.status(403).json({ message: 'This post is locked and new comments cannot be added' });
            }

            const [result] = await db.query(
                'INSERT INTO comments (post_id, user_id, content, status) VALUES (?, ?, ?, ?)',
                [postId, req.session.userId, content, 'active']
            );

            res.status(201).json({ 
                message: 'Comment created successfully', 
                comment: { id: result.insertId, post_id: postId, content, status: 'active' }
            });
        } catch (error) {
            console.error('Create comment error:', error);
            res.status(500).json({ message: 'Failed to create comment', error: error.message });
        }
    }

    // GET /api/posts/:post_id/categories - Get post categories
    static async getPostCategories(req, res) {
        try {
            const postId = req.params.post_id;
            
            // First check if post exists
            const post = await Post.find(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            const [rows] = await db.query(`
                SELECT c.* FROM categories c
                INNER JOIN post_categories pc ON c.id = pc.category_id
                WHERE pc.post_id = ?
            `, [postId]);

            res.json({ categories: rows });
        } catch (error) {
            console.error('Get post categories error:', error);
            res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
        }
    }

    // GET /api/posts/:post_id/like - Get post likes
    static async getPostLikes(req, res) {
        try {
            const postId = req.params.post_id;
            const [rows] = await db.query(`
                SELECT pl.*, u.login as author_login FROM post_likes pl
                LEFT JOIN users u ON pl.user_id = u.id
                WHERE pl.post_id = ?
                ORDER BY pl.created_at DESC
            `, [postId]);
            
            res.json({ likes: rows });
        } catch (error) {
            console.error('Get post likes error:', error);
            res.status(500).json({ message: 'Failed to fetch likes', error: error.message });
        }
    }

    // POST /api/posts/:post_id/like - Create/Update/Remove post like
    static async createPostLike(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const postId = req.params.post_id;
            const { type = 'like' } = req.body;

            if (!['like', 'dislike'].includes(type)) {
                return res.status(400).json({ message: 'Invalid like type' });
            }

            // Check if post exists
            const post = await Post.find(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            // Check if post is locked
            if (post.attributes.status === 'locked') {
                return res.status(403).json({ message: 'This post is locked and cannot be voted on' });
            }

            // Check if post is inactive (existing logic)
            if (post.attributes.status === 'inactive') {
                const user = await User.find(req.session.userId);
                const isAdmin = user && user.attributes.status === 'admin';
                const isOwner = post.attributes.user_id === req.session.userId;
                
                if (!isAdmin && !isOwner) {
                    return res.status(404).json({ message: 'Post not found' });
                }
            }

            // Rest of the existing voting logic...
            const [existingRows] = await db.query(
                'SELECT * FROM post_likes WHERE user_id = ? AND post_id = ?',
                [req.session.userId, postId]
            );

            if (existingRows.length > 0) {
                const existingLike = existingRows[0];
                
                if (existingLike.type === type) {
                    await db.query(
                        'DELETE FROM post_likes WHERE user_id = ? AND post_id = ?',
                        [req.session.userId, postId]
                    );
                    res.json({ message: 'Vote removed successfully', action: 'removed' });
                } else {
                    await db.query(
                        'UPDATE post_likes SET type = ? WHERE user_id = ? AND post_id = ?',
                        [type, req.session.userId, postId]
                    );
                    res.json({ message: 'Vote updated successfully', action: 'updated' });
                }
            } else {
                await db.query(
                    'INSERT INTO post_likes (user_id, post_id, type) VALUES (?, ?, ?)',
                    [req.session.userId, postId, type]
                );
                res.status(201).json({ message: 'Vote created successfully', action: 'created' });
            }
        } catch (error) {
            console.error('Create post like error:', error);
            res.status(500).json({ message: 'Failed to process vote', error: error.message });
        }
    }

    // DELETE /api/posts/:post_id/like - Delete like
    static async deletePostLike(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const postId = req.params.post_id;
            
            const [result] = await db.query(
                'DELETE FROM post_likes WHERE user_id = ? AND post_id = ?',
                [req.session.userId, postId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Like not found' });
            }

            res.json({ message: 'Like deleted successfully' });
        } catch (error) {
            console.error('Delete post like error:', error);
            res.status(500).json({ message: 'Failed to delete like', error: error.message });
        }
    }
}

module.exports = PostController;