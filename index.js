const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const app = express();

const { initializeDatabase } = require('./app/scripts/initDatabase.js');

// Import controllers
const AuthController = require('./app/controllers/AuthController');
const UserController = require('./app/controllers/UserController');
const PostController = require('./app/controllers/PostController');
const CategoryController = require('./app/controllers/CategoryController');
const CommentController = require('./app/controllers/CommentController');
const FavoritesController = require('./app/controllers/FavoritesController');

// Create necessary directories
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'profile_pictures');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'secretkey-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    next();
};

const requireAdmin = async (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    
    try {
        const User = require('./app/models/user');
        const user = await User.find(req.session.userId);
        if (!user || user.attributes.status !== 'admin') {
            return res.status(403).json({ message: 'Admin privileges required' });
        }
        req.currentUser = user;
        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// === AUTHENTICATION ROUTES ===
app.post('/api/auth/register', AuthController.register);
app.get('/api/auth/confirm-email/:token', AuthController.confirmEmail);
app.post('/api/auth/login', AuthController.login);
app.post('/api/auth/logout', AuthController.logout);
app.post('/api/auth/password-reset', AuthController.passwordReset);
app.post('/api/auth/password-reset/:confirm_token', AuthController.confirmPasswordReset);

// Add session check endpoint
app.get('/api/auth/me', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    res.json({ 
        userId: req.session.userId,
        userStatus: req.session.userStatus 
    });
});

// Endpoint for password reset
app.get('/api/auth/password-reset/:confirm_token', (req, res) => {
    res.sendFile(path.join(__dirname, 'app/views', 'reset-password.html'));
});

// Additional stats endpoint for the main page
app.get('/api/stats', async (req, res) => {
    try {
        const [postsCount] = await db.query('SELECT COUNT(*) as count FROM posts WHERE status = "active"');
        const [usersCount] = await db.query('SELECT COUNT(*) as count FROM users');
        const [categoriesCount] = await db.query('SELECT COUNT(*) as count FROM categories');
        
        res.json({
            posts: postsCount[0].count,
            users: usersCount[0].count,
            categories: categoriesCount[0].count
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch stats', error: error.message });
    }
});

/* Legacy auth routes
app.post('/api/login', AuthController.login);
app.post('/api/logout', AuthController.logout);
app.post('/api/register', AuthController.register);
app.post('/api/reminder', AuthController.passwordReset); */

// === USER ROUTES ===
app.get('/api/users', requireAdmin, UserController.getAllUsers);
app.get('/api/users/count', UserController.getUserCount); // For public stats
app.get('/api/users/:user_id', UserController.getUser); // Allow public access to user profiles
app.post('/api/users', requireAdmin, UserController.createUser);
app.patch('/api/users/pfp', requireAuth, UserController.uploadPfp);
app.patch('/api/users/:user_id', requireAuth, UserController.updateUser);
app.delete('/api/users/:user_id', requireAdmin, UserController.deleteUser);

// === POST ROUTES ===
app.get('/api/posts', PostController.getAllPosts);
app.get('/api/posts/:post_id', PostController.getPost);
app.post('/api/posts', requireAuth, PostController.createPost);
app.patch('/api/posts/:post_id', requireAuth, PostController.updatePost);
app.delete('/api/posts/:post_id', requireAuth, PostController.deletePost);

// Post Comments Routes
app.get('/api/posts/:post_id/comments', PostController.getPostComments);
app.post('/api/posts/:post_id/comments', requireAuth, PostController.createComment);

// Post Categories Routes
app.get('/api/posts/:post_id/categories', PostController.getPostCategories);

// Post Likes Routes
app.get('/api/posts/:post_id/like', PostController.getPostLikes);
app.post('/api/posts/:post_id/like', requireAuth, PostController.createPostLike);
app.delete('/api/posts/:post_id/like', requireAuth, PostController.deletePostLike);

// === CATEGORY ROUTES ===
app.get('/api/categories', CategoryController.getAllCategories);
app.get('/api/categories/:category_id', CategoryController.getCategory);
app.get('/api/categories/:category_id/posts', CategoryController.getCategoryPosts);
app.post('/api/categories', requireAdmin, CategoryController.createCategory);
app.patch('/api/categories/:category_id', requireAdmin, CategoryController.updateCategory);
app.delete('/api/categories/:category_id', requireAdmin, CategoryController.deleteCategory);

// === FAVORITES ROUTES ===
app.get('/api/favorites', FavoritesController.getUserFavorites);
app.get('/api/posts/:post_id/favorite-status', FavoritesController.getFavoriteStatus);
app.post('/api/favorites/:post_id', FavoritesController.addToFavorites);
app.delete('/api/favorites/:post_id', FavoritesController.removeFromFavorites);

// === COMMENT ROUTES ===
app.get('/api/comments', CommentController.getAllComments);
app.get('/api/comments/:comment_id', CommentController.getComment);
app.patch('/api/comments/:comment_id', requireAuth, CommentController.updateComment);
app.delete('/api/comments/:comment_id', requireAuth, CommentController.deleteComment);

// Comment Likes Routes
app.get('/api/comments/:comment_id/like', CommentController.getCommentLikes);
app.post('/api/comments/:comment_id/like', requireAuth, CommentController.createCommentLike);
app.delete('/api/comments/:comment_id/like', requireAuth, CommentController.deleteCommentLike);

// === HTML PAGE ROUTES ===
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'app/views', 'login.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'app/views', 'register.html'));
});

app.get('/reminder.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'app/views', 'reminder.html'));
});

app.get('/main.html', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'app/views', 'main.html'));
});

app.get('/profile.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'app/views', 'profile.html'));
});

app.get('/admin.html', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login.html');
    }
    
    try {
        const User = require('./app/models/user');
        const user = await User.find(req.session.userId);
        if (!user || user.attributes.status !== 'admin') {
            return res.status(403).sendFile(path.join(__dirname, 'app/views', '403.html'));
        }
        res.sendFile(path.join(__dirname, 'app/views', 'admin.html'));
    } catch (error) {
        console.error('Admin page error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Root redirect
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/main.html');
    } else {
        res.redirect('/login.html');
    }
});

/* API debugging endpoint (remove later)
app.get('/api/debug/routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            routes.push({
                method: Object.keys(middleware.route.methods)[0].toUpperCase(),
                path: middleware.route.path
            });
        }
    });
    res.json({ routes, session: req.session.userId ? 'authenticated' : 'anonymous' });
}); */

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    
    if (req.url.startsWith('/api/')) {
        res.status(500).json({ 
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'production' ? {} : err.message
        });
    } else {
        res.status(500).send('Internal Server Error');
    }
});

// 404 handler
app.use((req, res) => {
    //console.log(`404 - Route not found: ${req.method} ${req.url}`);
    
    if (req.url.startsWith('/api/')) {
        res.status(404).json({ 
            message: 'API endpoint not found',
            path: req.url,
            method: req.method
        });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'app/views', '404.html'));
    }
});

const PORT = process.env.PORT || 3000;

// Initialize database and start server
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

// module.exports = app;