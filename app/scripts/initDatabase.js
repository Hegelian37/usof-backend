// Large file with database - well, data - initialization
// Gotta just move the data seeding code into another file -- later
// Post and category descriptions are made by ChatGPT for testing

// TO DO later: Advanced feature - post styling!

const fs = require('fs').promises; // Line to import the file system module
const path = require('path'); // Line to import the path module

const mysql = require('mysql2/promise');
const Config = require('../../config/config.json');

// Creating a connection to the db
const db = require('../../config/db');

const ensureDatabase = async () => {
    const connection = await mysql.createConnection({
        host: Config.host,
        user: Config.user,
        password: Config.password
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${Config.database}\``);
    await connection.end();
};

const createTables = async () => {
    try {
        console.log('Starting database migration...');

        const sqlFilePath = path.join(__dirname, '..', '..', '/database/db.sql');
        const sqlContent = await fs.readFile(sqlFilePath, 'utf8');

        // Split by ; but ignore comments/empty lines
        const statements = sqlContent
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length);

        for (const stmt of statements) {
            await db.query(stmt);
        }

        // await db.query(sqlContent);
        
        console.log('Database tables created or updated successfully!');

    } catch (error) {
        console.error('Error during database migration:', error);
    }
};

const bcrypt = require('bcrypt'); // hashing my beloved
// const crypto = require('crypto');

const seedDatabase = async () => {
    try {
        console.log('Seeding database with test data...');

        // Check if data already exists
        const [existingUsers] = await db.query('SELECT COUNT(*) as count FROM users');
        if (existingUsers[0].count > 0) {
            console.log('Database already has data, skipping seed...');
            return;
        }

        const saltRounds = 12;

        // Now hashed
        const users = [
            { 
                login: 'admin', 
                password: await bcrypt.hash('admin123', saltRounds),
                full_name: 'System Administrator', 
                email: 'admin@usof.com', 
                profile_picture: 'pfp-3.jpg', 
                status: 'admin', 
                email_confirmed: true 
            },
            { 
                login: 'john_doe', 
                password: await bcrypt.hash('password123', saltRounds),
                full_name: 'John Doe', 
                email: 'john@example.com', 
                profile_picture: 'pfp-2.jpg', 
                status: 'user', 
                email_confirmed: true 
            },
            { 
                login: 'jane_smith', 
                password: await bcrypt.hash('password123', saltRounds),
                full_name: 'Jane Smith', 
                email: 'jane@example.com', 
                profile_picture: 'pfp-1.jpg', 
                status: 'user', 
                email_confirmed: true 
            },
            { 
                login: 'mike_wilson', 
                password: await bcrypt.hash('password123', saltRounds),
                full_name: 'Mike Wilson', 
                email: 'mike@example.com', 
                profile_picture: 'pfp-2.jpg', 
                status: 'user', 
                email_confirmed: true 
            },
            { 
                login: 'sarah_jones', 
                password: await bcrypt.hash('password123', saltRounds),
                full_name: 'Sarah Jones', 
                email: 'sarah@example.com', 
                profile_picture: 'pfp-1.jpg', 
                status: 'user', 
                email_confirmed: true 
            },
            { 
                login: 'alex_brown', 
                password: await bcrypt.hash('password123', saltRounds),
                full_name: 'Alex Brown', 
                email: 'alex@example.com', 
                profile_picture: 'pfp-3.jpg', 
                status: 'user', 
                email_confirmed: true 
            },
            { 
                login: 'dev_guru', 
                password: await bcrypt.hash('password123', saltRounds),
                full_name: 'Dev Guru', 
                email: 'devguru@example.com', 
                profile_picture: 'pfp-2.jpg', 
                status: 'user', 
                email_confirmed: true 
            },
            { 
                login: 'code_ninja', 
                password: await bcrypt.hash('password123', saltRounds),
                full_name: 'Code Ninja', 
                email: 'ninja@example.com', 
                profile_picture: 'pfp-3.jpg', 
                status: 'user', 
                email_confirmed: true
            }
        ];

        for (const user of users) {
            await db.query(
                'INSERT INTO users (login, password, full_name, email, profile_picture, status, email_confirmed) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [user.login, user.password, user.full_name, user.email, user.profile_picture, user.status, user.email_confirmed]
            );
        }

        // Seed categories with proper descriptions
        const categories = [
            { title: 'JavaScript', description: 'Questions about JavaScript programming, ES6+, frameworks, and web development' },
            { title: 'Python', description: 'Python programming, data science, web development with Django/Flask' },
            { title: 'Node.js', description: 'Server-side JavaScript, npm packages, Express.js, and backend development' },
            { title: 'React', description: 'React.js library, hooks, components, state management, and frontend development' },
            { title: 'Database', description: 'SQL, NoSQL, MySQL, PostgreSQL, MongoDB, database design and optimization' },
            { title: 'Web Development', description: 'HTML, CSS, responsive design, web standards, and frontend technologies' },
            { title: 'Mobile Development', description: 'React Native, Flutter, iOS, Android, mobile app development' },
            { title: 'DevOps', description: 'Docker, CI/CD, deployment, cloud services, infrastructure as code' },
            { title: 'Machine Learning', description: 'ML algorithms, data analysis, AI, neural networks, data science' },
            { title: 'General Programming', description: 'Programming concepts, algorithms, data structures, best practices' },
            { title: 'CSS', description: 'Cascading Style Sheets, animations, flexbox, grid, responsive design' },
            { title: 'API Development', description: 'REST APIs, GraphQL, API design, documentation, testing' }
        ];

        for (const category of categories) {
            await db.query(
                'INSERT INTO categories (title, descript) VALUES (?, ?)',
                [category.title, category.description]
            );
        }

        // Seed posts with more variety and realistic content
        const posts = [
            {
                user_id: 2, // john_doe
                title: 'How to handle async/await in JavaScript properly?',
                content: `I'm having trouble understanding how async/await works in JavaScript. I keep getting Promise pending errors and I'm not sure about the execution flow.

Here's my current code:
\`\`\`javascript
async function fetchData() {
    const response = fetch('api/data');
    const data = response.json();
    return data;
}
\`\`\`

What am I doing wrong? Can someone explain the proper way to handle asynchronous operations?`,
                status: 'active'
            },
            {
                user_id: 3, // jane_smith
                title: 'Best practices for Python virtual environments in team projects',
                content: `Our team is working on a Python project and we're having dependency conflicts. What are the best practices for managing Python virtual environments in a team setting?

Should we use:
- venv
- pipenv  
- poetry
- conda

What's the difference and which one would you recommend for a Django project with 5 developers?`,
                status: 'active'
            },
            {
                user_id: 4, // mike_wilson
                title: 'Express.js middleware order - does it matter?',
content: `I'm building a REST API with Express.js and I'm confused about middleware order. Does the order in which I define middleware functions matter?

Currently I have:
\`\`\`javascript
app.use(cors());
app.use(express.json());
app.use(authMiddleware);
app.use('/api/posts', postRoutes);
\`\`\`

Is this correct? What happens if I change the order?`,
                status: 'active'
            },
            {
                user_id: 5, // sarah_jones
                title: 'React hooks vs class components - when to use what?',
                content: `I'm working on a React project and I'm still confused about when to use hooks vs class components. 

Are there any performance differences? When would you still choose class components over functional components with hooks?

Also, is it okay to mix both approaches in the same project?`,
                status: 'active'
            },
            {
                user_id: 6, // alex_brown
                title: 'MySQL indexing strategies for large datasets',
                content: `I have a MySQL table with over 1 million records and queries are getting slow. I know I need to add indexes, but I'm not sure about the best strategy.

My most common queries are:
- SELECT by user_id and created_at range
- SELECT by status and category
- Full-text search on title and content

What indexing strategy would you recommend? Are there any pitfalls I should be aware of?`,
                status: 'active'
            },
            {
                user_id: 2, // john_doe
                title: 'CSS Grid vs Flexbox - practical use cases',
                content: `I understand the basics of both CSS Grid and Flexbox, but I'm still not sure when to use which one in practice.

Can someone provide real-world examples of when Grid is better than Flexbox and vice versa?

Is it okay to use both in the same layout?`,
                status: 'active'
            },
            {
                user_id: 7, // dev_guru
                title: 'React Native vs Flutter - 2024 comparison',
                content: `I need to choose a cross-platform mobile framework for a new project. The app will have:
- Real-time chat
- Push notifications  
- Camera integration
- Offline support

What are the current pros and cons of React Native vs Flutter? Which one has better performance and developer experience in 2024?`,
                status: 'active'
            },
            {
                user_id: 4, // mike_wilson
                title: 'Docker container optimization tips',
                content: `My Docker images are getting quite large (over 1GB) and build times are slow. What are some practical tips for optimizing Docker containers?

I'm working with a Node.js application. Currently using:
\`\`\`dockerfile
FROM node:18
COPY . .
RUN npm install
\`\`\`

Any suggestions for improvement?`,
                status: 'active'
            },
            {
                user_id: 3, // jane_smith
                title: 'API rate limiting implementation strategies',
                content: `I'm building a REST API and need to implement rate limiting to prevent abuse. What are the different strategies and which one would you recommend?

I've heard about:
- Token bucket
- Sliding window
- Fixed window

The API will serve mobile apps and web clients with different rate limits.`,
                status: 'active'
            },
            {
                user_id: 5, // sarah_jones
                title: 'Handling authentication in SPAs securely',
                content: `What's the most secure way to handle authentication in Single Page Applications?

I'm considering:
- JWT tokens in localStorage
- HTTP-only cookies
- Session-based auth

What are the security implications of each approach? Is JWT really stateless and secure?`,
                status: 'inactive' // Test inactive post
            },
            {
                user_id: 6, // alex_brown  
                title: 'Microservices vs Monolith - decision criteria',
                content: `Our team is debating whether to refactor our monolithic application into microservices. The app has about 100k daily active users.

What criteria should we consider when making this decision? What are the real-world trade-offs you've experienced?`,
                status: 'active'
            },
            {
                user_id: 7, // dev_guru
                title: 'GraphQL vs REST API - performance comparison',
                content: `I'm designing a new API and considering GraphQL vs REST. The frontend needs flexible data fetching and we want to minimize over-fetching.

Has anyone done performance comparisons? What are the real benefits and drawbacks of GraphQL in production?`,
                status: 'active'
            }
        ];

        for (const post of posts) {
            await db.query(
                'INSERT INTO posts (user_id, title, content, status) VALUES (?, ?, ?, ?)',
                [post.user_id, post.title, post.content, post.status]
            );
        }

        // Seed post-category relationships
        const postCategories = [
            { post_id: 1, category_id: 1 }, // JavaScript
            { post_id: 2, category_id: 2 }, // Python
            { post_id: 3, category_id: 3 }, // Node.js
            { post_id: 3, category_id: 12 }, // API Development
            { post_id: 4, category_id: 4 }, // React
            { post_id: 5, category_id: 5 }, // Database
            { post_id: 6, category_id: 6 }, // Web Development
            { post_id: 6, category_id: 11 }, // CSS
            { post_id: 7, category_id: 7 }, // Mobile Development
            { post_id: 8, category_id: 8 }, // DevOps
            { post_id: 8, category_id: 3 }, // Node.js
            { post_id: 9, category_id: 12 }, // API Development
            { post_id: 10, category_id: 1 }, // JavaScript
            { post_id: 10, category_id: 6 }, // Web Development
            { post_id: 11, category_id: 10 }, // General Programming
            { post_id: 12, category_id: 12 }, // API Development
        ];

        for (const pc of postCategories) {
            await db.query(
                'INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)',
                [pc.post_id, pc.category_id]
            );
        }

        // Seed comments with more realistic content
        const comments = [
            {
                post_id: 1,
                user_id: 3, // jane_smith
                content: `You're missing the \`await\` keyword! Here's the corrected version:

\`\`\`javascript
async function fetchData() {
    try {
        const response = await fetch('api/data');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}
\`\`\`

Remember: \`await\` pauses the execution until the Promise resolves.`,
                status: 'active'
            },
            {
                post_id: 1,
                user_id: 5, // sarah_jones
                content: 'Great explanation! Also remember that async functions always return a Promise, so you need to await them when calling: `const result = await fetchData();`',
                status: 'active'
            },
            {
                post_id: 1,
                user_id: 7, // dev_guru
                content: 'Another tip: always use try-catch blocks with async/await for proper error handling. The Promise.catch() method won\'t work the same way.',
                status: 'active'
            },
            {
                post_id: 2,
                user_id: 4, // mike_wilson
                content: `I'd recommend **poetry** for team projects. It handles dependency resolution better than pip and creates reproducible builds.

Setup:
\`\`\`bash
curl -sSL https://install.python-poetry.org | python3 -
poetry init
poetry add django
poetry install
\`\`\`

The \`pyproject.toml\` file makes dependencies much clearer than requirements.txt.`,
                status: 'active'
            },
            {
                post_id: 2,
                user_id: 6, // alex_brown
                content: 'We use pipenv in our team and it works great. The Pipfile.lock ensures everyone has exactly the same versions. Poetry is good too, just pick one and stick with it!',
                status: 'active'
            },
            {
                post_id: 3,
                user_id: 6, // alex_brown
                content: `Yes, middleware order is **crucial** in Express! Middleware executes top-to-bottom, so:

1. \`cors()\` should be first for preflight requests
2. \`express.json()\` before routes that need body parsing  
3. \`authMiddleware\` before protected routes
4. Routes last
5. Error handling middleware at the very end

Your order looks correct!`,
                status: 'active'
            },
            {
                post_id: 4,
                user_id: 2, // john_doe
                content: `Hooks are generally preferred for new development. Benefits:
- Better performance with React.memo()
- Easier testing
- Less boilerplate
- Better code reuse with custom hooks

Only use class components if you need error boundaries or specific lifecycle methods that don't have hook equivalents.`,
                status: 'active'
            },
            {
                post_id: 4,
                user_id: 7, // dev_guru  
                content: 'You can definitely mix both in the same project! Many large apps do this during migration. Just be consistent within each component.',
                status: 'active'
            },
            {
                post_id: 5,
                user_id: 3, // jane_smith - FIXED: was user_ID (typo)
                content: `For your use cases, I'd suggest:

1. **Composite index** on (user_id, created_at) for the first query
2. **Composite index** on (status, category) for filtering  
3. **Full-text index** on title and content for search

\`\`\`sql
ALTER TABLE posts ADD FULLTEXT(title, content);
CREATE INDEX idx_user_date ON posts(user_id, created_at);
CREATE INDEX idx_status_category ON posts(status, category);
\`\`\`

Monitor your slow query log to see which indexes are actually being used!`,
                status: 'active'
            },
            {
                post_id: 6,
                user_id: 4, // mike_wilson
                content: `**Grid** for 2D layouts (think entire page layouts, card grids)
**Flexbox** for 1D layouts (navigation bars, centering content)

Example: Use Grid for your main page layout, then Flexbox inside grid areas for component alignment. They work great together!`,
                status: 'active'
            },
            {
                post_id: 7,
                user_id: 5, // sarah_jones - FIXED: was missing user_id  
                content: `For your requirements, I'd lean towards **Flutter**:

✅ Better performance (compiled to native)
✅ Excellent camera integration  
✅ Great offline support
✅ Single codebase, truly native performance

React Native is good too, but Flutter has caught up significantly and dart is actually quite nice to work with.`,
                status: 'active'
            },
            {
                post_id: 8,
                user_id: 3, // jane_smith
                content: `Here are key optimizations:

\`\`\`dockerfile
FROM node:18-alpine  # Use Alpine for smaller base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production  # Faster, more reliable
COPY . .
RUN npm run build  # If you have a build step
EXPOSE 3000
CMD ["npm", "start"]
\`\`\`

Also use .dockerignore to exclude node_modules, .git, etc.`,
                status: 'active'
            },
            {
                post_id: 9,
                user_id: 7, // dev_guru
                content: `For your use case, **sliding window** is probably best:

- More accurate than fixed window
- Prevents traffic spikes  
- Works well with different client types

Consider using Redis for storing counters. Libraries like express-rate-limit make implementation easy.`,
                status: 'active'
            },
            {
                post_id: 11,
                user_id: 2, // john_doe
                content: `Consider these factors:
- Team size (microservices need more DevOps expertise)
- Deployment complexity
- Data consistency requirements
- Development velocity

With 100k DAU, you might be at the sweet spot where microservices could help, but don't underestimate the operational overhead.`,
                status: 'active'
            },
            {
                post_id: 12,
                user_id: 4, // mike_wilson
                content: `For your requirements, I'd recommend GraphQL if you have:

- Complex data relationships
- Multiple frontend clients with different needs
- Need for flexible queries

Stick with REST if you have:
- Simple, predictable data access patterns
- Heavy caching requirements
- Team unfamiliarity with GraphQL

Performance-wise, both can be optimized well. The choice depends more on your use case and team expertise.`,
                status: 'active'
            }
        ];

        for (const comment of comments) {
            await db.query(
                'INSERT INTO comments (post_id, user_id, content, status) VALUES (?, ?, ?, ?)',
                [comment.post_id, comment.user_id, comment.content, comment.status]
            );
        }

        // Seed comment likes - FIXED: removed typo and ensured all comment IDs exist
        const commentLikes = [
            { user_id: 2, comment_id: 1, type: 'like' },
            { user_id: 4, comment_id: 1, type: 'like' },
            { user_id: 6, comment_id: 1, type: 'like' },
            { user_id: 7, comment_id: 1, type: 'like' }, // Popular first comment
            
            { user_id: 3, comment_id: 2, type: 'like' },
            { user_id: 6, comment_id: 2, type: 'like' },
            
            { user_id: 2, comment_id: 3, type: 'like' },
            { user_id: 5, comment_id: 3, type: 'like' },
            
            { user_id: 5, comment_id: 4, type: 'like' },
            { user_id: 7, comment_id: 4, type: 'like' },
            { user_id: 2, comment_id: 4, type: 'dislike' },
            
            { user_id: 6, comment_id: 5, type: 'like' },
            
            { user_id: 2, comment_id: 6, type: 'like' },
            { user_id: 4, comment_id: 6, type: 'like' },
            { user_id: 5, comment_id: 6, type: 'like' },
            
            { user_id: 3, comment_id: 7, type: 'like' },
            { user_id: 6, comment_id: 7, type: 'like' },
            
            { user_id: 4, comment_id: 8, type: 'like' },
            { user_id: 6, comment_id: 8, type: 'like' },
            
            { user_id: 2, comment_id: 9, type: 'like' },
            { user_id: 5, comment_id: 9, type: 'like' },
            
            { user_id: 3, comment_id: 10, type: 'like' },
            { user_id: 7, comment_id: 10, type: 'like' },
            
            { user_id: 4, comment_id: 11, type: 'like' },
            { user_id: 6, comment_id: 11, type: 'like' },
            
            { user_id: 2, comment_id: 12, type: 'like' },
            { user_id: 5, comment_id: 12, type: 'dislike' },
            
            { user_id: 3, comment_id: 13, type: 'like' },
            
            { user_id: 7, comment_id: 14, type: 'like' }, // FIXED: changed from 15 to 14
            { user_id: 2, comment_id: 15, type: 'like' }  // Now comment 15 exists
        ];

        for (const like of commentLikes) {
            await db.query(
                'INSERT INTO comment_likes (user_id, comment_id, type) VALUES (?, ?, ?)',
                [like.user_id, like.comment_id, like.type]
            );
        }

        // Seed post likes with more variety
        const postLikes = [
            // Post 1 - JavaScript async/await question (5 likes)
            { user_id: 2, post_id: 1, type: 'like' },
            { user_id: 3, post_id: 1, type: 'like' },
            { user_id: 4, post_id: 1, type: 'like' },
            { user_id: 5, post_id: 1, type: 'like' },
            { user_id: 7, post_id: 1, type: 'like' },
            
            // Post 2 - Python virtual environments (3 likes, 1 dislike)
            { user_id: 2, post_id: 2, type: 'like' },
            { user_id: 4, post_id: 2, type: 'like' },
            { user_id: 6, post_id: 2, type: 'like' },
            { user_id: 7, post_id: 2, type: 'dislike' },
            
            // Post 3 - Express middleware (3 likes)
            { user_id: 3, post_id: 3, type: 'like' },
            { user_id: 5, post_id: 3, type: 'like' },
            { user_id: 6, post_id: 3, type: 'like' },
            
            // Post 4 - React hooks vs class components (2 likes, 1 dislike)
            { user_id: 2, post_id: 4, type: 'like' },
            { user_id: 3, post_id: 4, type: 'like' },
            { user_id: 6, post_id: 4, type: 'dislike' },
            
            // Post 5 - MySQL indexing (2 likes)
            { user_id: 4, post_id: 5, type: 'like' },
            { user_id: 7, post_id: 5, type: 'like' },
            
            // Post 6 - CSS Grid vs Flexbox (2 likes)
            { user_id: 3, post_id: 6, type: 'like' },
            { user_id: 5, post_id: 6, type: 'like' },
            
            // Post 7 - React Native vs Flutter (2 likes, 1 dislike)
            { user_id: 2, post_id: 7, type: 'like' },
            { user_id: 4, post_id: 7, type: 'like' },
            { user_id: 6, post_id: 7, type: 'dislike' },
            
            // Post 8 - Docker optimization (2 likes)
            { user_id: 5, post_id: 8, type: 'like' },
            { user_id: 7, post_id: 8, type: 'like' },
            
            // Post 9 - API rate limiting (2 likes)
            { user_id: 3, post_id: 9, type: 'like' },
            { user_id: 6, post_id: 9, type: 'like' },
            
            // Post 10 - SPA authentication (inactive post, 1 like)
            { user_id: 4, post_id: 10, type: 'like' },
            
            // Post 11 - Microservices vs Monolith (1 like, 1 dislike)
            { user_id: 4, post_id: 11, type: 'like' },
            { user_id: 5, post_id: 11, type: 'dislike' },
            
            // Post 12 - GraphQL vs REST (2 likes)
            { user_id: 2, post_id: 12, type: 'like' },
            { user_id: 3, post_id: 12, type: 'like' }
        ];

        for (const like of postLikes) {
            await db.query(
                'INSERT INTO post_likes (user_id, post_id, type) VALUES (?, ?, ?)',
                [like.user_id, like.post_id, like.type]
            );
        }

        console.log('Database seeded successfully with comprehensive test data!');
    } catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    }
};

const initializeDatabase = async () => {
    try {
        await ensureDatabase();   // create database if it doesn't exist
        await createTables();     // create tables
        await seedDatabase();     // seeding with comprehensive data
        console.log('Database initialization complete!');
    } catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }
};

// Run initialization if this file is executed directly
if (require.main === module) {
    initializeDatabase().then(() => {
        process.exit(0);
    });
}

module.exports = { createTables, seedDatabase, initializeDatabase };
