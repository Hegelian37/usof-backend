const { Comment, CommentLike } = require('../models');
const User = require('../models/user');

const db = require('../../config/db');

class CommentController {
    // Helper function to check if user is admin
    static async isUserAdmin(userId) {
        if (!userId) return false;
        const user = await User.find(userId);
        return user && user.attributes.status === 'admin';
    }

    // GET /api/comments/:comment_id - Get specific comment
    static async getComment(req, res) {
        try {
            const commentId = req.params.comment_id;
            const comment = await Comment.find(commentId);
            
            if (!comment) {
                return res.status(404).json({ message: 'Comment not found' });
            }

            // Check if user can see inactive comments (admin or owner)
            const isAdmin = await CommentController.isUserAdmin(req.session.userId);
            const isOwner = comment.attributes.user_id === req.session.userId;
            
            if (comment.attributes.status !== 'active' && !isAdmin && !isOwner) {
                return res.status(404).json({ message: 'Comment not found' });
            }

            res.json({ comment: comment.attributes });
        } catch (error) {
            res.status(500).json({ message: 'Failed to fetch comment', error: error.message });
        }
    }

    // GET /api/comments - Get all comments (admin only)
    static async getAllComments(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const isAdmin = await CommentController.isUserAdmin(req.session.userId);
            if (!isAdmin) {
                return res.status(403).json({ message: 'Admin access required' });
            }

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;

            // Direct query to get all comments with author info
            const [comments] = await db.query(`
                SELECT c.*, u.login as author_login, u.full_name as author_name, u.profile_picture as author_profile_picture,
                       p.title as post_title
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                LEFT JOIN posts p ON c.post_id = p.id
                ORDER BY c.created_at DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);

            const [totalResult] = await db.query('SELECT COUNT(*) as total FROM comments');
            const total = totalResult[0].total;

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
            console.error('Failed to fetch all comments:', error);
            res.status(500).json({ message: 'Failed to fetch comments', error: error.message });
        }
    }

    // PATCH /api/comments/:comment_id - Update comment
    static async updateComment(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const commentId = req.params.comment_id;
            const comment = await Comment.find(commentId);

            if (!comment) {
                return res.status(404).json({ message: 'Comment not found' });
            }

            const user = await User.find(req.session.userId);
            const isOwner = comment.attributes.user_id === req.session.userId;
            const isAdmin = user && user.attributes.status === 'admin';

            if (!isOwner && !isAdmin) {
                return res.status(403).json({ message: 'Permission denied' });
            }

            const { content, status } = req.body;
            let updated = false;

            // Allow owner to edit content
            if (isOwner && content !== undefined) {
                if (!content || content.trim() === '') {
                    return res.status(400).json({ message: 'Content cannot be empty' });
                }
                comment.attributes.content = content.trim();
                comment.attributes.updated_at = new Date();
                updated = true;
            }

            // Allow owner to change status
            if (isOwner && status !== undefined) {
                if (['active', 'inactive', 'locked'].includes(status)) {
                    comment.attributes.status = status;
                    updated = true;
                } else {
                    return res.status(400).json({ message: 'Invalid status provided' });
                }
            }
            
            // Allow admin to change status
            if (isAdmin && status !== undefined) {
                if (['active', 'inactive', 'locked'].includes(status)) {
                    comment.attributes.status = status;
                    updated = true;
                } else {
                    return res.status(400).json({ message: 'Invalid status provided' });
                }
            }

            if (!updated) {
                return res.status(400).json({ message: 'No valid fields to update' });
            }

            await comment.save();
            res.json({ message: 'Comment updated successfully', comment: comment.attributes });
        } catch (error) {
            console.error('Update comment error:', error);
            res.status(500).json({ message: 'Failed to update comment', error: error.message });
        }
    }

    // DELETE /api/comments/:comment_id - Delete comment
    static async deleteComment(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const commentId = req.params.comment_id;
            const comment = await Comment.find(commentId);

            if (!comment) {
                return res.status(404).json({ message: 'Comment not found' });
            }

            const user = await User.find(req.session.userId);
            const isOwner = comment.attributes.user_id === req.session.userId;
            const isAdmin = user && user.attributes.status === 'admin';

            if (!isOwner && !isAdmin) {
                return res.status(403).json({ message: 'Permission denied' });
            }

            await comment.delete();
            res.json({ message: 'Comment deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Failed to delete comment', error: error.message });
        }
    }

    // GET /api/comments/:comment_id/like - Get comment likes
    static async getCommentLikes(req, res) {
        try {
            const commentId = req.params.comment_id;
            
            // Check if comment exists and if user can access it
            const comment = await Comment.find(commentId);
            if (!comment) {
                return res.status(404).json({ message: 'Comment not found' });
            }

            const isAdmin = await CommentController.isUserAdmin(req.session.userId);
            const isOwner = comment.attributes.user_id === req.session.userId;
            
            if (comment.attributes.status !== 'active' && !isAdmin && !isOwner) {
                return res.status(404).json({ message: 'Comment not found' });
            }

            const likes = await CommentLike.getByCommentId(commentId);
            res.json({ likes });
        } catch (error) {
            res.status(500).json({ message: 'Failed to fetch likes', error: error.message });
        }
    }

    // POST /api/comments/:comment_id/like - Create/Update/Remove comment like
    static async createCommentLike(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const commentId = req.params.comment_id;
            const { type = 'like' } = req.body;

            if (!['like', 'dislike'].includes(type)) {
                return res.status(400).json({ message: 'Invalid like type' });
            }

            // Check if comment exists
            const comment = await Comment.find(commentId);
            if (!comment) {
                return res.status(404).json({ message: 'Comment not found' });
            }

            // Check if comment is locked
            if (comment.attributes.status === 'locked') {
                return res.status(403).json({ message: 'This comment is locked and cannot be voted on' });
            }

            // Check if user can access this comment (inactive comments)
            const isAdmin = await CommentController.isUserAdmin(req.session.userId);
            const isOwner = comment.attributes.user_id === req.session.userId;
            
            if (comment.attributes.status === 'inactive' && !isAdmin && !isOwner) {
                return res.status(404).json({ message: 'Comment not found' });
            }

            // Check if user already liked/disliked this comment
            const existingLike = await CommentLike.findByUserAndComment(req.session.userId, commentId);

            if (existingLike) {
                // If clicking the same type, remove the vote
                if (existingLike.attributes.type === type) {
                    await existingLike.delete();
                    res.json({ message: 'Vote removed successfully', action: 'removed' });
                } else {
                    // If clicking different type, update the vote
                    existingLike.attributes.type = type;
                    await existingLike.save();
                    res.json({ message: 'Vote updated successfully', action: 'updated' });
                }
            } else {
                // Create new like
                const like = new CommentLike({
                    user_id: req.session.userId,
                    comment_id: commentId,
                    type
                });
                await like.save();
                res.status(201).json({ message: 'Vote created successfully', action: 'created' });
            }
        } catch (error) {
            res.status(500).json({ message: 'Failed to process vote', error: error.message });
        }
    }

    // DELETE /api/comments/:comment_id/like - Delete comment like
    static async deleteCommentLike(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const commentId = req.params.comment_id;
            const like = await CommentLike.findByUserAndComment(req.session.userId, commentId);

            if (!like) {
                return res.status(404).json({ message: 'Like not found' });
            }

            await like.delete();
            res.json({ message: 'Like deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Failed to delete like', error: error.message });
        }
    }
}

module.exports = CommentController;