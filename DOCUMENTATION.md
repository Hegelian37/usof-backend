# USOF BACKEND Documentation

## CBL: Engage
The task for the next two individual challenges is creation of a collegial problem-solving resource, a website drawing inspiration from StackOverflow in structure and purpose.  

I identified that the main problem of knowledge exchange is accessibility and simplicity – to put it simply, people lack much-needed information and time to digest this information. That’s where fellow peers are expected to come to the rescue – after all, it is much simpler to think with leading questions or outright advice.  

The example of StackOverflow we are told to examine is indeed telling. APIs allow multiple clients to use the same backend with less technical difficulties and hiccups, consolidating the entire communication process within a coherent network that secures a stable, structured, and well-defined flow.  

---

## CBL: Investigate
I initially proceeded to answer the guiding questions:

1. **How to simplify the procedure of counseling?**  
   By providing clear categories, search tools, and a simple interface for asking and answering questions. Automation (e.g., suggestions or FAQs) can also reduce complexity.

2. **Which of the skills that you acquired during the Half Marathon could be useful in this challenge?**  
   Skills like handling requests/responses, database design, authentication, experience with Node.js and Express will all be useful.

3. **What resources of knowledge sharing do you know?**  
   StackOverflow, Quora, Reddit communities, Slack groups, GitHub Discussions, and official documentation portals.

4. **What are the disadvantages of APIs?**  
   They can be complex to design, require strong security, may introduce performance overhead, and depend on versioning and documentation.

5. **Which advantage of APIs is also a disadvantage?**  
   Flexibility: APIs allow integration with many clients, but that also increases maintenance and security risks.

6. **What do you think is more useful — a knowledge-sharing website or official documentation?**  
   Both are useful in their own way: documentation gives authoritative reference, while community websites provide practical, real-world answers and discussions.

7. **What makes StackOverflow so popular?**  
   A reputation system, large community, searchable answers, peer moderation, and fast responses.

8. **What functionality will make your website better? How can it be improved?**  
   Features like email verification, role-based access, post moderation, favorites, profile customization, and advanced filtering will make it better.

9. **How can you make a product unique and useful?**  
   By focusing on usability, personalization, community engagement, and features not commonly available elsewhere.

10. **What profit can you get from USOF?**  
    Not direct financial profit, but educational value and improved productivity.

---

### Investigate Summary
In preparation for the challenge, I explored information to answer the questions and skim through activities to define the scope of my solution. To simplify the procedure of counseling or knowledge sharing, I concluded that clear categorization and search features are essential.  

From the Half Marathon, skills such as setting up APIs, handling routes, and working with databases are directly applicable. Existing knowledge-sharing resources like StackOverflow and Quora informed my vision.  

I saw that APIs, while powerful for enabling multi-platform access, can be complex to secure and maintain – an advantage that is simultaneously a disadvantage. Compared with official documentation, a community platform is often more dynamic and user-friendly, which explains StackOverflow’s popularity: quick answers, reputation system, and active moderation all aid users in their collective effort of research and development.  

I could use Trello for task formulation and decomposition, but I preferred to adhere to the good old pencil and paper for planning.  

To make my website better, I planned role-based access, post moderation, and extra features like favorites section and profile personalization. A unique product must balance simplicity with personalization, giving users tangible value such as improved productivity and knowledge digestion.  

After investigating, I chose **MySQL** for its relational structure I am already familiar with, and confirmed the necessity of a separate admin panel. These preparations ensured my project supports both basic and creative features without major future rewrites.  

---

## CBL: Act: Basic
I have begun by transforming Task03 from Sprint09 of Marathon Web-Fullstack 2025 from a purely express-based app with hardcoded links to one with API basis. Result of this can be seen here: [GitHub Repo n Question](https://github.com/Hegelian37/usof-backend-inspiration-sp09tk03).  

Then I took this project and developed on it. First and foremost, of course, through defining the main structure of the `usof_web` database, the schema and every little detail. The database schema in question can be found within the file `db.sql`.  

Then I proceeded to copy and advance the API list provided in the task. In the end, it looked like this:  

### Authentication APIs
- POST /api/auth/register - User registration with email confirmation
- GET /api/auth/confirm-email/:token - Email confirmation via token
- POST /api/auth/login - User login
- POST /api/auth/logout - User logout
- POST /api/auth/password-reset - Request password reset email
- POST /api/auth/password-reset/:token - Confirm password reset with token
- GET /api/auth/password-reset/:token - Serve password reset HTML page
- GET /api/auth/me - Get current session user info

### User Management APIs
- GET /api/users - Get all users (admin only)
- GET /api/users/count - Get total user count (public)
- GET /api/users/:id - Get specific user data
- POST /api/users - Create new user (admin only)
- PATCH /api/users/pfp - Upload profile picture
- PATCH /api/users/:id - Update user data
- DELETE /api/users/:id - Delete user (admin only)

### Post Management APIs
- GET /api/posts - Get all posts with pagination and filtering
- GET /api/posts/:id - Get specific post
- POST /api/posts - Create new post
- PATCH /api/posts/:id - Update post
- DELETE /api/posts/:id - Delete post

### Post-Related APIs
- GET /api/posts/:id/comments - Get comments for a post
- POST /api/posts/:id/comments - Create comment on post
- GET /api/posts/:id/categories - Get post categories
- GET /api/posts/:id/like - Get post likes/dislikes
- POST /api/posts/:id/like - Vote on post (like/dislike)
- DELETE /api/posts/:id/like - Remove vote on post

### Category Management APIs
- GET /api/categories - Get all categories
- GET /api/categories/:id - Get specific category
- GET /api/categories/:id/posts - Get posts in category
- POST /api/categories - Create category (admin only)
- PATCH /api/categories/:id - Update category (admin only)
- DELETE /api/categories/:id - Delete category (admin only)

### Comment Management APIs
- GET /api/comments - Get all comments (admin only)
- GET /api/comments/:id - Get specific comment
- PATCH /api/comments/:id - Update comment
- DELETE /api/comments/:id - Delete comment

### Comment Voting APIs
- GET /api/comments/:id/like - Get comment likes/dislikes
- POST /api/comments/:id/like - Vote on comment (like/dislike)
- DELETE /api/comments/:id/like - Remove vote on comment

### Favorites APIs
- GET /api/favorites - Get user's favorite posts
- GET /api/posts/:id/favorite-status- Check if post is favorite
- POST /api/favorites/:id - Add post to favorites
- DELETE /api/favorites/:id - Remove post from favorites

### Statistics API
- GET /api/stats - Get platform statistics (posts, users, categories count)

### HTML Routes
- GET /login.html - Login page
- GET /register.html - Registration page
- GET /reminder.html - Password reset request page
- GET /main.html - Main application page (requires auth)
- GET /profile.html - User profile page
- GET /admin.html - Admin panel (requires admin privileges)
- GET / - Root redirect (to main or login based on auth status)

### Static File Routes
- GET /css/* - CSS files
- GET /js/* - JavaScript files
- GET /uploads/profile_pictures/* - Profile picture files

---

In the end, after all work, I got a program fully committing to the MVC pattern and following this generalized algorithm:

I. Application Initialization Sequence

Database Bootstrap (initDatabase.js)

1. Check MySQL connection availability
2. Execute schema creation from db.sql:
- Create users table with auth tokens and role system
- Create posts table with status enum (active/inactive/locked)
- Create categories table with junction table for many-to-many relationships
- Create comments table with hierarchical post association
- Create likes tables for both posts and comments with type enum
- Create user_favorites table for bookmarking functionality
3. Populate with test data (minimum 5 entries per table)
4. Set up foreign key constraints and indexes

Server Configuration (index.js)

1. Initialize Express middleware stack:
- Body parsing for JSON and URL-encoded data
- Session management with secure cookie settings
- Static file serving for uploads and frontend assets
2. Create upload directories for profile pictures
3. Mount route handlers with authentication middleware
4. Configure error handling and 404 responses
5. Start HTTP server on specified port

Right now authentication and authorization flow operates wholly on the email provided by ethereal.email. In case it ever runs out, the test email transporter data can be replaced in AuthController.js.

II. Authentication & Authorization Flow

Registration Process

POST /api/auth/register:
1. Validate input (unique login/email, password strength)
2. Hash password with bcrypt (12 salt rounds)
3. Generate email confirmation token (UUID)
4. Store user with email_confirmed=false
5. Send confirmation email with token link
6. Return success without auto-login

Email Confirmation

GET /api/auth/confirm-email/:token:
1. Find user by email_token in database
2. If found and not expired:
- Set email_confirmed=true
- Clear email_token
- Update user record
3. Redirect to login with success message

Login Process

POST /api/auth/login:
1. Accept login/email + password
2. Find user by login OR email field
3. Verify email_confirmed=true
4. Compare password with bcrypt
5. Create session with userId and userStatus
6. Return user data without password hash

Password Reset Flow

POST /api/auth/password-reset:
1. Generate secure reset token
2. Set expiration time (1 hour)
3. Store in reset_token and reset_token_expires fields
4. Send email with reset link

POST /api/auth/password-reset/:token:
1. Validate token exists and not expired
2. Hash new password
3. Update user record, clear reset tokens
4. Force logout all sessions for security
3. Content Management Algorithm

Post Creation & Management

POST /api/posts:
1. Validate authentication and required fields
2. Insert post record with status='active'
3. Process categories array:
- Validate category IDs exist
- Insert into post_categories junction table
4. Return created post with ID

PATCH /api/posts/:id:
1. Fetch existing post record
2. Check permissions (owner or admin)
3. Update allowed fields based on role:
- Users: title, content, categories, status
- Admins: all fields including force status changes
4. Handle category updates:
- Delete existing associations
- Insert new category relationships
5. Update timestamp and save

Post Retrieval with Complex Filtering

GET /api/posts:
1. Parse query parameters:
- page, limit (pagination)
- sortBy (likes/date), order (ASC/DESC)
- categories (array), dateFrom, dateTo
- status (admin_view for admins)

2. Build dynamic SQL query:
- Base JOIN with users for author info
- LEFT JOIN with post_likes for vote counts
- LEFT JOIN with comments for comment counts
- Conditional INNER JOIN with post_categories if filtering

3. Apply WHERE conditions:
- Status visibility rules (users see active + own inactive)
- Category filtering with IN clause
- Date range filtering
- Admin override for viewing all statuses

4. Aggregate vote counts:
- COUNT(CASE WHEN type='like') for likes
- COUNT(CASE WHEN type='dislike') for dislikes
- Calculate net score (likes - dislikes)
5. Apply sorting and pagination:
- ORDER BY calculated score or date
- LIMIT/OFFSET for pagination
6. Execute count query for pagination metadata
7. Return posts array with pagination info

III. Voting & Rating System

Vote Processing Algorithm

POST /api/posts/:id/like or /api/comments/:id/like:
1. Validate user authentication and content exists
2. Check if content is locked (prevent voting)
3. Query existing vote by user_id + content_id
4. Apply vote logic:
- No existing vote: INSERT new vote
- Same type clicked: DELETE vote (toggle off)
- Different type: UPDATE vote type (switch vote)
5. Return action performed (created/updated/removed)

Rating Calculation (real-time via SQL):
SELECT (
  (SELECT COALESCE(SUM(CASE WHEN pl.type='like' THEN 1 WHEN pl.type='dislike' THEN -1 END), 0)
   FROM post_likes pl INNER JOIN posts p ON pl.post_id=p.id WHERE p.user_id=users.id)
  +
  (SELECT COALESCE(SUM(CASE WHEN cl.type='like' THEN 1 WHEN cl.type='dislike' THEN -1 END), 0)
   FROM comment_likes cl INNER JOIN comments c ON cl.comment_id=c.id WHERE c.user_id=users.id)
) as rating

V. Comment Threading & Management

Comment Creation

POST /api/posts/:id/comments:
1. Validate post exists and is not locked
2. Validate post status (active or user owns it)
3. Insert comment with post_id reference
4. Set status='active' by default
5. Return created comment data

Comment Status Management

PATCH /api/comments/:id:
1. Check permissions (owner or admin)
2. Allow different operations by role:
- Owner: content, status (active/inactive)
- Admin: status (including locked state)
3. Track updated_at timestamp
4. Apply locking rules (locked comments can't be voted on)

VI. Admin Panel Data Management

User Management Interface

GET /api/users (admin only):
1. Validate admin privileges
2. Execute complex query with calculated fields:
- User rating from all votes
- Post count (active posts only)
- Comment count (active comments only)
3. Return paginated results with metadata
4. Support sorting by any column

POST /api/users (admin only):
1. Validate admin creating user
2. Check unique constraints (login, email)
3. Hash password, set email_confirmed=true
4. Create user with specified role
5. Return sanitized user data

Content Moderation Workflow

Status Toggle Operations:
1. Posts/Comments: active ↔ inactive
- Inactive: hidden from public, visible to owner/admin
- Active: visible to all users

2. Locking Mechanism: active/inactive → locked
- Locked content remains visible
- Prevents new votes and comments
- Special UI indicators for locked state
- Only owners and admins can lock/unlock  

Even though the task specified the creation of a backend, it couldn’t have been properly accessed and tested without creating some kind of underdeveloped frontend. For the testing purposes, the HTML and JS frontend code was expanded by me through inheritance and in accordance with the backend code, while the CSS was done by the LLMs for the sake of simplicity and speed – this shall be stripped and re-made by hand during the frontend challenge.

VII. Frontend State Management

Single Page Application Flow

Page Load Sequence:
1. Check authentication (/api/auth/me)
2. Load user data and update UI
3. Parse URL parameters for initial state
4. Load categories for filters
5. Determine initial view (post detail, favorites, or list)
6. Initialize appropriate content

Navigation State Management:
1. URL reflects current application state
2. Browser back/forward updates internal state
3. Clean up editing states on navigation
4. Preserve filter settings in URL parameters

Real-time UI Updates

Vote Button Interactions:
1. Send vote request to API
2. On success, reload content section
3. Update vote counts and button states
4. Show loading states during requests

Content Editing Flow:
1. Replace display elements with form controls
2. Populate forms with current content
3. Track editing state globally
4. Cancel operations restore original content
5. Save operations reload entire section

As an advanced creative feature, profile picture customization was made utilizing the experience with file upload and management I’ve got during the Half Marathon.

VIII. File Upload & Management

Profile Picture Handling
Multer Configuration:
1. Define storage destination and filename generation
2. Set file size limits (5MB)
3. Filter file types (images only)
4. Generate unique filenames with timestamps

Upload Process:
1. Validate file constraints before processing
2. Store file in public/uploads/profile_pictures/
3. Update user record with filename
4. Return relative path for frontend display
5. Provide fallback to generated avatar service

IX. Error Handling & Security

Input Validation Strategy
1. Server-side validation on all inputs
2. SQL injection prevention via prepared statements
3. XSS prevention through content sanitization
4. File upload restrictions and validation
5. Rate limiting considerations (structure in place)

Permission Enforcement

Middleware Chain:
1. requireAuth: validates session exists
2. requireAdmin: validates admin role
3. Resource-level: validates ownership or admin status
4. Status-based: enforces locked content rules
5. Degradation for unauthorized access

This algorithm provides basis for a production-ready collegial problem-solving platform with developed content management, real-time voting, and comprehensive administration tools while maintaining security and performance considerations throughout.

---

## CBL: Act: Creative
Beyond the basic requirements, I introduced additional features to improve usability. For example, I implemented a **Favorites system**, allowing users to save useful posts for later reference. I also added advanced sorting options (by popularity and date) to make browsing more efficient.  

Additionally, I developed **profile picture customization**, using experience with file upload and management from the Half Marathon. These creative extensions enhance the user experience by personalizing content discovery and making the platform more engaging.
