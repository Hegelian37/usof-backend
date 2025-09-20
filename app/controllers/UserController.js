const User = require('../models/user');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');

const db = require('../../config/db');

// Configure multer for profile picture uploads -- helper functions
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/profile_pictures/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'pfp-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, JPG, PNG, GIF) are allowed'));
        }
    }
});

class UserController {
    // GET /api/users - Get all users (admin only)
    static async getAllUsers(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const currentUser = await User.find(req.session.userId);
            if (!currentUser || currentUser.attributes.status !== 'admin') {
                return res.status(403).json({ message: 'Admin privileges required' });
            }

            const [rows] = await db.query(`
                SELECT 
                    id, login, full_name, email, status, profile_picture, 
                    email_confirmed, created_at,
                    (SELECT COALESCE(SUM(CASE WHEN pl.type = 'like' THEN 1 WHEN pl.type = 'dislike' THEN -1 END), 0) 
                     FROM post_likes pl 
                     INNER JOIN posts p ON pl.post_id = p.id 
                     WHERE p.user_id = users.id) +
                    (SELECT COALESCE(SUM(CASE WHEN cl.type = 'like' THEN 1 WHEN cl.type = 'dislike' THEN -1 END), 0) 
                     FROM comment_likes cl 
                     INNER JOIN comments c ON cl.comment_id = c.id 
                     WHERE c.user_id = users.id) as rating,
                    (SELECT COUNT(*) FROM posts WHERE user_id = users.id AND status = 'active') as posts_count,
                    (SELECT COUNT(*) FROM comments WHERE user_id = users.id AND status = 'active') as comments_count
                FROM users 
                ORDER BY created_at DESC
            `);

            res.json({ users: rows });
        } catch (error) {
            console.error('Get all users error:', error);
            res.status(500).json({ 
                message: 'Failed to fetch users', 
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
            });
        }
    }

    // GET /api/users/count - Get total user count (public)
    static async getUserCount(req, res) {
        try {
            const [rows] = await db.query(`
                SELECT COUNT(*) AS user_count
                FROM users
            `);

            const count = rows[0].user_count;

            res.json({ totalUsers: count });
        } catch (error) {
            console.error('Get user count error:', error);
            res.status(500).json({
                message: 'Failed to fetch user count',
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
            });
        }
    }

    // GET /api/users/:user_id - Get specific user
    static async getUser(req, res) {
        try {
            const userId = parseInt(req.params.user_id);
            
            if (isNaN(userId)) {
                return res.status(400).json({ message: 'Invalid user ID' });
            }

            const [rows] = await db.query(`
                SELECT 
                    id, login, full_name, email, status, profile_picture, 
                    email_confirmed, created_at,
                    (SELECT COALESCE(SUM(CASE WHEN pl.type = 'like' THEN 1 WHEN pl.type = 'dislike' THEN -1 END), 0) 
                     FROM post_likes pl 
                     INNER JOIN posts p ON pl.post_id = p.id 
                     WHERE p.user_id = users.id) +
                    (SELECT COALESCE(SUM(CASE WHEN cl.type = 'like' THEN 1 WHEN cl.type = 'dislike' THEN -1 END), 0) 
                     FROM comment_likes cl 
                     INNER JOIN comments c ON cl.comment_id = c.id 
                     WHERE c.user_id = users.id) as rating,
                    (SELECT COUNT(*) FROM posts WHERE user_id = users.id AND status = 'active') as posts_count,
                    (SELECT COUNT(*) FROM comments WHERE user_id = users.id AND status = 'active') as comments_count
                FROM users 
                WHERE id = ?
            `, [userId]);

            if (rows.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Remove sensitive information if not the user themselves or admin
            const user = rows[0];
            const isOwn = req.session.userId === userId;
            const currentUser = req.session.userId ? await User.find(req.session.userId) : null;
            const isAdmin = currentUser && currentUser.attributes.status === 'admin';

            if (!isOwn && !isAdmin) {
                delete user.email;
                delete user.email_confirmed;
            }

            res.json({ user });
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({ 
                message: 'Failed to fetch user', 
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
            });
        }
    }

    // POST /api/users - Create user (admin only)
    static async createUser(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const currentUser = await User.find(req.session.userId);
            if (!currentUser || currentUser.attributes.status !== 'admin') {
                return res.status(403).json({ message: 'Admin privileges required' });
            }

            const { login, password, confirmPassword, full_name, email, role = 'user' } = req.body;

            // Validation
            if (!login || !password || !email) {
                return res.status(400).json({ message: 'Login, password, and email are required' });
            }

            if (password !== confirmPassword) {
                return res.status(400).json({ message: 'Passwords do not match' });
            }

            if (!['user', 'admin'].includes(role)) {
                return res.status(400).json({ message: 'Invalid role. Must be "user" or "admin"' });
            }

            // Check if user already exists
            const existingUserByLogin = await User.findByField('login', login);
            if (existingUserByLogin) {
                return res.status(409).json({ message: 'Login already exists' });
            }

            const existingUserByEmail = await User.findByField('email', email);
            if (existingUserByEmail) {
                return res.status(409).json({ message: 'Email already registered' });
            }

            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const newUser = new User({
                login,
                password: hashedPassword,
                full_name: full_name || login,
                email,
                status: role,
                email_confirmed: true // Admin-created users are auto-confirmed
            });

            await newUser.save();
            
            const createdUser = { ...newUser.attributes };
            delete createdUser.password; // Don't return password

            res.status(201).json({ 
                message: 'User created successfully', 
                user: createdUser 
            });
        } catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({ 
                message: 'Failed to create user', 
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
            });
        }
    }

    // PATCH /api/users/pfp - Upload user profile picture
    static async uploadPfp(req, res) {
        upload.single('profile_picture')(req, res, async (err) => {
            try {
                if (!req.session.userId) {
                    return res.status(401).json({ message: 'Authentication required' });
                }

                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
                    }
                    return res.status(400).json({ message: err.message });
                } else if (err) {
                    return res.status(400).json({ message: err.message });
                }

                if (!req.file) {
                    return res.status(400).json({ message: 'No file uploaded' });
                }

                const user = await User.find(req.session.userId);
                if (!user) {
                    return res.status(404).json({ message: 'User not found' });
                }

                user.attributes.profile_picture = `${req.file.filename}`;
                await user.save();

                res.json({ 
                    message: 'Profile picture uploaded successfully',
                    profile_picture: user.attributes.profile_picture
                });
            } catch (error) {
                console.error('Upload profile picture error:', error);
                res.status(500).json({ 
                    message: 'Failed to upload profile picture', 
                    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
                });
            }
        });
    }

    // PATCH /api/users/:user_id - Update user data
    static async updateUser(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const userId = parseInt(req.params.user_id);
            
            if (isNaN(userId)) {
                return res.status(400).json({ message: 'Invalid user ID' });
            }

            const user = await User.find(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const currentUser = await User.find(req.session.userId);
            const isSelf = userId === req.session.userId;
            const isAdmin = currentUser && currentUser.attributes.status === 'admin';

            if (!isSelf && !isAdmin) {
                return res.status(403).json({ message: 'Permission denied' });
            }

            const { login, full_name, email, status, password, confirmPassword, profile_picture } = req.body;

            // Profile picture removal/update (self or admin)
            if (profile_picture !== undefined) {
                user.attributes.profile_picture = profile_picture; // null to remove, or new path
            }

            // Password update
            if (password) {
                if (password !== confirmPassword) {
                    return res.status(400).json({ message: 'Passwords do not match' });
                }
                if (password.length < 6) {
                    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
                }
                
                const saltRounds = 12;
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                user.attributes.password = hashedPassword;
            }

            // Basic info updates (both self and admin)
            if (login && login !== user.attributes.login) {
                // Check if login already exists
                const existingUser = await User.findByField('login', login);
                if (existingUser && existingUser.attributes.id !== userId) {
                    return res.status(409).json({ message: 'Login already exists' });
                }
                user.attributes.login = login;
            }

            if (full_name !== undefined) {
                user.attributes.full_name = full_name || user.attributes.login;
            }

            if (email && email !== user.attributes.email) {
                // Check if email already exists
                const existingUser = await User.findByField('email', email);
                if (existingUser && existingUser.attributes.id !== userId) {
                    return res.status(409).json({ message: 'Email already registered' });
                }
                user.attributes.email = email;
                // Reset email confirmation if email changed
                if (!isAdmin) {
                    user.attributes.email_confirmed = false;
                    // In a real app, send new confirmation email here
                }
            }

            // Admin-only updates
            if (isAdmin && status && ['user', 'admin'].includes(status)) {
                user.attributes.status = status;
            }

            await user.save();
            
            // If profile picture was removed, provide a success message
            if (profile_picture === null) {
                return res.json({ 
                    message: 'Profile picture removed successfully',
                    profile_picture: null 
                });
            }
            
            res.json({ message: 'User updated successfully' });
        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({ 
                message: 'Failed to update user', 
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
            });
        }
    }

    // DELETE /api/users/:user_id - Delete user (admin only)
    static async deleteUser(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const currentUser = await User.find(req.session.userId);
            if (!currentUser || currentUser.attributes.status !== 'admin') {
                return res.status(403).json({ message: 'Admin privileges required' });
            }

            const userId = parseInt(req.params.user_id);
            
            if (isNaN(userId)) {
                return res.status(400).json({ message: 'Invalid user ID' });
            }

            if (userId === req.session.userId) {
                return res.status(400).json({ message: 'Cannot delete your own account' });
            }

            const user = await User.find(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            await user.delete();
            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({ 
                message: 'Failed to delete user', 
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
            });
        }
    }

    // GET /api/user - Get current user data (legacy endpoint for compatibility)
    static async getUserData(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Not authenticated' });
            }
            
            // Redirect to the new endpoint
            return UserController.getUser({ 
                ...req, 
                params: { user_id: req.session.userId.toString() } 
            }, res);
        } catch (error) {
            console.error('Get user data error:', error);
            res.status(500).json({ 
                message: 'Failed to fetch user data', 
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
            });
        }
    }
}

module.exports = UserController;