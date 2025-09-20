let currentTab = 'users';
let users = [];
let posts = [];
let categories = [];
let comments = [];

// Helper functions for pfps
function getProfilePictureUrl(profilePicture, fallbackLogin) {
    if (profilePicture) {
        // If it's a full URL (starts with http/https), use as is
        if (profilePicture.startsWith('http')) {
            return profilePicture;
        }
        // Otherwise, assume it's a relative path to uploads folder
        return `/uploads/profile_pictures/${profilePicture}`;
    }
    // Fallback to a default avatar or gravatar-style service
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackLogin || 'User')}&background=0D8ABC&color=fff&size=40`;
}

// Add global state for sort direction
let sortDirection = {
    users: 'asc',
    posts: 'asc',
    categories: 'asc',
    comments: 'asc'
};

// Pagination state for each tab
let pagination = {
    users: { page: 1, limit: 10, total: 0, totalPages: 0 },
    posts: { page: 1, limit: 10, total: 0, totalPages: 0 },
    categories: { page: 1, limit: 10, total: 0, totalPages: 0 },
    comments: { page: 1, limit: 10, total: 0, totalPages: 0 }
};

function sortTable(tableId, columnIndex) {
    const table = document.getElementById(tableId);
    const headers = table.querySelectorAll('th');
    const sortKey = headers[columnIndex].getAttribute('data-sort-key');

    if (!sortKey) return;

    let currentData = [];
    let renderFunction;

    switch(tableId) {
        case 'users-table':
            currentData = users;
            renderFunction = renderUsersTable;
            break;
        case 'posts-table':
            currentData = posts;
            renderFunction = renderPostsTable;
            break;
        case 'categories-table':
            currentData = categories;
            renderFunction = renderCategoriesTable;
            break;
        case 'comments-table':
            currentData = comments;
            renderFunction = renderAllComments;
            break;
        default:
            return;
    }

    const direction = sortDirection[tableId] === 'asc' ? 'desc' : 'asc';
    sortDirection[tableId] = direction;
    
    // The comments array is a paginated slice of all comments, so we need to sort the full array first
    if (tableId === 'comments-table' && window.allComments) {
        currentData = window.allComments;
    }

    currentData.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        // Handle nested properties for special cases like `likes_count`
        if (sortKey === 'likes_count') {
            valA = (a.likes_count || 0) - (a.dislikes_count || 0);
            valB = (b.likes_count || 0) - (b.dislikes_count || 0);
        }
        
        // Handle cases where `post_title` or `author_login` might not be a direct property
        if (sortKey === 'post_title') {
            valA = a.post_title || `Post #${a.post_id}`;
            valB = b.post_title || `Post #${b.post_id}`;
        }

        if (sortKey === 'author_login') {
            valA = a.author_login || 'Unknown';
            valB = b.author_login || 'Unknown';
        }

        // Convert values for proper comparison (numbers, strings, dates)
        if (!isNaN(Date.parse(valA)) && !isNaN(Date.parse(valB))) {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        } else if (!isNaN(parseFloat(valA)) && !isNaN(parseFloat(valB))) {
            valA = parseFloat(valA);
            valB = parseFloat(valB);
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) {
            return direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Re-apply pagination after sorting for comments
    if (tableId === 'comments-table') {
        const start = (pagination.comments.page - 1) * pagination.comments.limit;
        const end = start + pagination.comments.limit;
        comments = currentData.slice(start, end);
    }

    renderFunction();
}

// Tab Management
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');
    
    currentTab = tabName;
    loadTabData(tabName);
}

async function loadTabData(tabName) {
    try {
        switch(tabName) {
            case 'users':
                await loadUsers();
                break;
            case 'posts':
                await loadPosts();
                break;
            case 'categories':
                await loadCategories();
                break;
            case 'comments':
                await loadAllComments();
                break;
        }
    } catch (error) {
        console.error('Failed to load ' + tabName + ':', error);
    }
}

// Load Users with pagination
async function loadUsers(page = pagination.users.page) {
    try {
        const response = await fetch(`/api/users?page=${page}&limit=${pagination.users.limit}`, { 
            credentials: 'same-origin' 
        });
        
        if (response.ok) {
            const data = await response.json();
            users = data.users;
            pagination.users.page = page;
            pagination.users.total = data.pagination?.totalItems || users.length;
            pagination.users.totalPages = data.pagination?.totalPages || 1;
            renderUsersTable();
            renderUsersPagination();
            updateUsersInfo();
        } else {
            // Fallback to original API if pagination not supported
            const data = await response.json();
            users = data.users || [];
            renderUsersTable();
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

// Remove user profile picture (admin only)
async function removeUserProfilePicture(userId, username) {
    if (!confirm(`Are you sure you want to remove ${username}'s profile picture?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile_picture: null }),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            alert(`Profile picture removed for ${username}`);
            loadUsers(); // Reload users table
        } else {
            const error = await response.json();
            alert(error.message || 'Failed to remove profile picture');
        }
    } catch (error) {
        console.error('Failed to remove profile picture:', error);
        alert('Failed to remove profile picture');
    }
}

function renderUsersTable() {
    const tbody = document.querySelector('#users-table tbody');
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="loading">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => {
        // Generate profile picture URL
        const profilePicUrl = getProfilePictureUrl(user.profile_picture, user.login);
        const hasCustomPfp = user.profile_picture && !user.profile_picture.startsWith('https://ui-avatars.com');
        
        return `
            <tr>
                <td>${user.id}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${profilePicUrl}" alt="${user.login}" class="table-profile-pic" 
                             style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                        ${user.login}
                    </div>
                </td>
                <td>${user.full_name || '-'}</td>
                <td>${user.email}</td>
                <td><span class="status-${user.status === 'admin' ? 'active' : 'inactive'}">${user.status}</span></td>
                <td><span class="rating-${user.rating >= 0 ? 'positive' : 'negative'}">${user.rating || 0}</span></td>
                <td>${user.posts_count || 0}</td>
                <td>${user.comments_count || 0}</td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                    ${hasCustomPfp ? `<button onclick="removeUserProfilePicture(${user.id}, '${user.login.replace(/'/g, '\\\'')}')" class="btn btn-warning" style="margin-right: 5px;" title="Remove Profile Picture">Remove PFP</button>` : ''}
                    <button onclick="editUser(${user.id})" class="btn btn-edit">Edit</button>
                    <button onclick="deleteUser(${user.id})" class="btn btn-delete">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderUsersPagination() {
    const paginationDiv = document.getElementById('users-pagination');
    if (pagination.users.totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `<button class="page-btn" onclick="loadUsers(${pagination.users.page - 1})" 
        ${pagination.users.page === 1 ? 'disabled' : ''}><</button>`;
    
    // Page numbers
    const startPage = Math.max(1, pagination.users.page - 2);
    const endPage = Math.min(pagination.users.totalPages, pagination.users.page + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button class="page-btn" onclick="loadUsers(1)">1</button>`;
        if (startPage > 2) paginationHTML += '<span>...</span>';
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button class="page-btn ${i === pagination.users.page ? 'active' : ''}" 
            onclick="loadUsers(${i})">${i}</button>`;
    }
    
    if (endPage < pagination.users.totalPages) {
        if (endPage < pagination.users.totalPages - 1) paginationHTML += '<span>...</span>';
        paginationHTML += `<button class="page-btn" onclick="loadUsers(${pagination.users.totalPages})">${pagination.users.totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `<button class="page-btn" onclick="loadUsers(${pagination.users.page + 1})" 
        ${pagination.users.page === pagination.users.totalPages ? 'disabled' : ''}>></button>`;
    
    paginationDiv.innerHTML = paginationHTML;
}

function updateUsersInfo() {
    const start = (pagination.users.page - 1) * pagination.users.limit + 1;
    const end = Math.min(pagination.users.page * pagination.users.limit, pagination.users.total);
    document.getElementById('users-info').textContent = 
        `Showing ${start} to ${end} of ${pagination.users.total} entries`;
}

// Load Posts with pagination and comment counts
async function loadPosts(page = pagination.posts.page) {
    try {
        const response = await fetch(`/api/posts?status=admin_view&page=${page}&limit=${pagination.posts.limit}`, { 
            credentials: 'same-origin' 
        });
        
        if (response.ok) {
            const data = await response.json();
            posts = data.posts;
            pagination.posts.page = page;
            pagination.posts.total = data.pagination?.totalItems || posts.length;
            pagination.posts.totalPages = data.pagination?.totalPages || 1;
            renderPostsTable();
            renderPostsPagination();
            updatePostsInfo();
        }
    } catch (error) {
        console.error('Failed to load posts:', error);
    }
}

function renderPostsTable() {
    const tbody = document.querySelector('#posts-table tbody');
    if (posts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No posts found</td></tr>';
        return;
    }
    
    tbody.innerHTML = posts.map(post => `
        <tr>
            <td>${post.id}</td>
            <td>${post.title}</td>
            <td>${post.author_login || 'Unknown'}</td>
            <td><span class="status-${post.status}">${post.status}</span></td>
            <td>${(post.likes_count || 0) - (post.dislikes_count || 0)}</td>
            <td>${post.comments_count || 0}</td>
            <td>${new Date(post.created_at).toLocaleDateString()}</td>
            <td>
                <button onclick="togglePostStatus(${post.id}, '${post.status}')" class="btn btn-edit">
                    ${post.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button onclick="deletePost(${post.id})" class="btn btn-delete">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderPostsPagination() {
    const paginationDiv = document.getElementById('posts-pagination');
    if (pagination.posts.totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `<button class="page-btn" onclick="loadPosts(${pagination.posts.page - 1})" 
        ${pagination.posts.page === 1 ? 'disabled' : ''}><</button>`;
    
    const startPage = Math.max(1, pagination.posts.page - 2);
    const endPage = Math.min(pagination.posts.totalPages, pagination.posts.page + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button class="page-btn" onclick="loadPosts(1)">1</button>`;
        if (startPage > 2) paginationHTML += '<span>...</span>';
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button class="page-btn ${i === pagination.posts.page ? 'active' : ''}" 
            onclick="loadPosts(${i})">${i}</button>`;
    }
    
    if (endPage < pagination.posts.totalPages) {
        if (endPage < pagination.posts.totalPages - 1) paginationHTML += '<span>...</span>';
        paginationHTML += `<button class="page-btn" onclick="loadPosts(${pagination.posts.totalPages})">${pagination.posts.totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `<button class="page-btn" onclick="loadPosts(${pagination.posts.page + 1})" 
        ${pagination.posts.page === pagination.posts.totalPages ? 'disabled' : ''}>></button>`;
    
    paginationDiv.innerHTML = paginationHTML;
}

function updatePostsInfo() {
    const start = (pagination.posts.page - 1) * pagination.posts.limit + 1;
    const end = Math.min(pagination.posts.page * pagination.posts.limit, pagination.posts.total);
    document.getElementById('posts-info').textContent = 
        `Showing ${start} to ${end} of ${pagination.posts.total} entries`;
}

// Load Categories with pagination
async function loadCategories(page = pagination.categories.page) {
    try {
        const response = await fetch(`/api/categories?page=${page}&limit=${pagination.categories.limit}`, { 
            credentials: 'same-origin' 
        });
        
        if (response.ok) {
            const data = await response.json();
            categories = data.categories;
            pagination.categories.page = page;
            pagination.categories.total = data.pagination?.totalItems || categories.length;
            pagination.categories.totalPages = data.pagination?.totalPages || 1;
            renderCategoriesTable();
            renderCategoriesPagination();
            updateCategoriesInfo();
        } else {
            // Fallback
            const data = await response.json();
            categories = data.categories || [];
            renderCategoriesTable();
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

function renderCategoriesTable() {
    const tbody = document.querySelector('#categories-table tbody');
    if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No categories found</td></tr>';
        return;
    }
    
    tbody.innerHTML = categories.map(category => `
        <tr>
            <td>${category.id}</td>
            <td>${category.title}</td>
            <td>${category.descript || '-'}</td>
            <td>${new Date(category.created_at).toLocaleDateString()}</td>
            <td>
                <button onclick="editCategory(${category.id})" class="btn btn-edit">Edit</button>
                <button onclick="deleteCategory(${category.id})" class="btn btn-delete">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderCategoriesPagination() {
    const paginationDiv = document.getElementById('categories-pagination');
    if (pagination.categories.totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `<button class="page-btn" onclick="loadCategories(${pagination.categories.page - 1})" 
        ${pagination.categories.page === 1 ? 'disabled' : ''}><</button>`;
    
    const startPage = Math.max(1, pagination.categories.page - 2);
    const endPage = Math.min(pagination.categories.totalPages, pagination.categories.page + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button class="page-btn" onclick="loadCategories(1)">1</button>`;
        if (startPage > 2) paginationHTML += '<span>...</span>';
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button class="page-btn ${i === pagination.categories.page ? 'active' : ''}" 
            onclick="loadCategories(${i})">${i}</button>`;
    }
    
    if (endPage < pagination.categories.totalPages) {
        if (endPage < pagination.categories.totalPages - 1) paginationHTML += '<span>...</span>';
        paginationHTML += `<button class="page-btn" onclick="loadCategories(${pagination.categories.totalPages})">${pagination.categories.totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `<button class="page-btn" onclick="loadCategories(${pagination.categories.page + 1})" 
        ${pagination.categories.page === pagination.categories.totalPages ? 'disabled' : ''}>></button>`;
    
    paginationDiv.innerHTML = paginationHTML;
}

function updateCategoriesInfo() {
    const start = (pagination.categories.page - 1) * pagination.categories.limit + 1;
    const end = Math.min(pagination.categories.page * pagination.categories.limit, pagination.categories.total);
    document.getElementById('categories-info').textContent = 
        `Showing ${start} to ${end} of ${pagination.categories.total} entries`;
}

// Load All Comments with pagination
async function loadAllComments(page = pagination.comments.page) {
    try {
        // Use the new direct comments endpoint instead of loading through posts
        const response = await fetch(`/api/comments?page=${page}&limit=${pagination.comments.limit}`, { 
            credentials: 'same-origin' 
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Store the full comments array for sorting
            window.allComments = data.comments;
            comments = data.comments;
            
            pagination.comments.page = page;
            pagination.comments.total = data.pagination.totalItems;
            pagination.comments.totalPages = data.pagination.totalPages;
            
            renderAllComments();
            renderCommentsPagination();
        } else if (response.status === 403) {
            const commentsDiv = document.getElementById('comments-content');
            commentsDiv.innerHTML = '<div class="loading">Access denied. Admin privileges required.</div>';
        } else {
            throw new Error('Failed to load comments');
        }
    } catch (error) {
        console.error('Failed to load comments:', error);
        const commentsDiv = document.getElementById('comments-content');
        commentsDiv.innerHTML = '<div class="loading">Failed to load comments</div>';
    }
}

// Updated renderAllComments function to show proper status
function renderAllComments() {
    const commentsDiv = document.getElementById('comments-content');
    
    if (comments.length === 0) {
        commentsDiv.innerHTML = '<div class="loading">No comments found</div>';
        return;
    }

    let html = `
        <div class="table-controls">
            <div class="pagination-info">
                Showing ${(pagination.comments.page - 1) * pagination.comments.limit + 1} to 
                ${Math.min(pagination.comments.page * pagination.comments.limit, pagination.comments.total)} 
                of ${pagination.comments.total} comments
            </div>
        </div>
        <table class="data-table" id="comments-table">
            <thead>
                <tr>
                    <th onclick="sortTable('comments-table', 0)" data-sort-key="id">ID</th>
                    <th onclick="sortTable('comments-table', 1)" data-sort-key="post_title">Post</th>
                    <th onclick="sortTable('comments-table', 2)" data-sort-key="author_login">Author</th>
                    <th onclick="sortTable('comments-table', 3)" data-sort-key="content">Content</th>
                    <th onclick="sortTable('comments-table', 4)" data-sort-key="status">Status</th>
                    <th onclick="sortTable('comments-table', 5)" data-sort-key="created_at">Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${comments.map(comment => `
                    <tr class="${comment.status === 'inactive' ? 'inactive-row' : ''}">
                        <td>${comment.id}</td>
                        <td>${comment.post_title || `Post #${comment.post_id}`}</td>
                        <td>${comment.author_login || 'Unknown'}</td>
                        <td title="${comment.content}">${comment.content.substring(0, 100)}${comment.content.length > 100 ? '...' : ''}</td>
                        <td><span class="status-${comment.status}">${comment.status}</span></td>
                        <td>${new Date(comment.created_at).toLocaleDateString()}</td>
                        <td>
                            <button onclick="toggleCommentStatus(${comment.id}, '${comment.status}')" class="btn btn-edit">
                                ${comment.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onclick="deleteComment(${comment.id})" class="btn btn-delete">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="pagination" id="comments-pagination"></div>
    `;
    
    commentsDiv.innerHTML = html;
    renderCommentsPagination();
}

function renderCommentsPagination() {
    const paginationDiv = document.getElementById('comments-pagination');
    if (pagination.comments.totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let paginationHTML = '';

    // Previous button
    paginationHTML += `<button class="page-btn" onclick="loadAllComments(${pagination.comments.page - 1})" 
        ${pagination.comments.page === 1 ? 'disabled' : ''}><</button>`;

    const startPage = Math.max(1, pagination.comments.page - 2);
    const endPage = Math.min(pagination.comments.totalPages, pagination.comments.page + 2);

    if (startPage > 1) {
        paginationHTML += `<button class="page-btn" onclick="loadAllComments(1)">1</button>`;
        if (startPage > 2) paginationHTML += '<span>...</span>';
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button class="page-btn ${i === pagination.comments.page ? 'active' : ''}" 
            onclick="loadAllComments(${i})">${i}</button>`;
    }

    if (endPage < pagination.comments.totalPages) {
        if (endPage < pagination.comments.totalPages - 1) paginationHTML += '<span>...</span>';
        paginationHTML += `<button class="page-btn" onclick="loadAllComments(${pagination.comments.totalPages})">${pagination.comments.totalPages}</button>`;
    }

    // Next button
    paginationHTML += `<button class="page-btn" onclick="loadAllComments(${pagination.comments.page + 1})" 
        ${pagination.comments.page === pagination.comments.totalPages ? 'disabled' : ''}>></button>`;

    paginationDiv.innerHTML = paginationHTML;
}

// Load Comments for specific post (legacy function)
async function loadPostComments(postId) {
    if (!postId) return;
    
    const response = await fetch(`/api/posts/${postId}/comments`, { credentials: 'same-origin' });
    if (response.ok) {
        const data = await response.json();
        const commentsDiv = document.getElementById('comments-content');
        commentsDiv.innerHTML = `
            <h4>Comments for Post #${postId}</h4>
            <p><a href="#" onclick="loadAllComments()">â† View all comments</a></p>
            <table class="data-table">
                <thead>
                    <tr><th>ID</th><th>Author</th><th>Content</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${data.comments.map(comment => `
                        <tr>
                            <td>${comment.id}</td>
                            <td>${comment.author_login || 'Unknown'}</td>
                            <td>${comment.content.substring(0, 100)}${comment.content.length > 100 ? '...' : ''}</td>
                            <td><span class="status-${comment.status}">${comment.status}</span></td>
                            <td>${new Date(comment.created_at).toLocaleDateString()}</td>
                            <td>
                                <button onclick="toggleCommentStatus(${comment.id}, '${comment.status}')" class="btn btn-edit">
                                    ${comment.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                                <button onclick="deleteComment(${comment.id})" class="btn btn-delete">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

// Items per page change handlers
function changeUsersPerPage() {
    pagination.users.limit = parseInt(document.getElementById('users-per-page').value);
    pagination.users.page = 1;
    loadUsers();
}

function changePostsPerPage() {
    pagination.posts.limit = parseInt(document.getElementById('posts-per-page').value);
    pagination.posts.page = 1;
    loadPosts();
}

function changeCategoriesPerPage() {
    pagination.categories.limit = parseInt(document.getElementById('categories-per-page').value);
    pagination.categories.page = 1;
    loadCategories();
}

function changeCommentsPerPage() {
    pagination.comments.limit = parseInt(document.getElementById('comments-per-page').value);
    pagination.comments.page = 1;
    loadAllComments();
}

// Modal Management
function openUserModal(userId = null) {
    document.getElementById('user-modal').style.display = 'block';
    if (userId) {
        // Load user data for editing
        const user = users.find(u => u.id === userId);
        if (user) {
            document.getElementById('user-modal-title').textContent = 'Edit User';
            const form = document.getElementById('user-form');
            form.login.value = user.login;
            form.full_name.value = user.full_name || '';
            form.email.value = user.email;
            form.status.value = user.status;
            form.password.required = false;
            form.confirmPassword.required = false;
            form.dataset.userId = userId;
        }
    }
}

function openCategoryModal(categoryId = null) {
    document.getElementById('category-modal').style.display = 'block';
    if (categoryId) {
        const category = categories.find(c => c.id === categoryId);
        if (category) {
            document.getElementById('category-modal-title').textContent = 'Edit Category';
            const form = document.getElementById('category-form');
            form.title.value = category.title;
            form.descript.value = category.descript || '';
            form.dataset.categoryId = categoryId;
        }
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    // Reset forms
    document.querySelectorAll('form').forEach(form => {
        form.reset();
        delete form.dataset.userId;
        delete form.dataset.categoryId;
    });
}

// CRUD Operations
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'same-origin'
    });
    
    if (response.ok) {
        alert('User deleted successfully');
        loadUsers();
    } else {
        alert('Failed to delete user');
    }
}

async function togglePostStatus(postId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    const response = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'same-origin'
    });
    
    if (response.ok) {
        alert('Post status updated');
        loadPosts();
    } else {
        alert('Failed to update post status');
    }
}

async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        credentials: 'same-origin'
    });
    
    if (response.ok) {
        alert('Post deleted successfully');
        loadPosts();
    } else {
        alert('Failed to delete post');
    }
}

async function deleteCategory(categoryId) {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE',
        credentials: 'same-origin'
    });
    
    if (response.ok) {
        alert('Category deleted successfully');
        loadCategories();
    } else {
        alert('Failed to delete category');
    }
}

async function toggleCommentStatus(commentId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'same-origin'
    });
    
    if (response.ok) {
        alert('Comment status updated');
        if (currentTab === 'comments') {
            loadAllComments();
        }
    } else {
        alert('Failed to update comment status');
    }
}

async function deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'same-origin'
    });
    
    if (response.ok) {
        alert('Comment deleted successfully');
        if (currentTab === 'comments') {
            loadAllComments();
        }
    } else {
        alert('Failed to delete comment');
    }
}

function editUser(userId) {
    openUserModal(userId);
}

function editCategory(categoryId) {
    openCategoryModal(categoryId);
}

// Form Handlers
document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    if (data.password !== data.confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    const userId = e.target.dataset.userId;
    const url = userId ? `/api/users/${userId}` : '/api/users';
    const method = userId ? 'PATCH' : 'POST';
    
    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'same-origin'
    });
    
    if (response.ok) {
        alert(userId ? 'User updated successfully' : 'User created successfully');
        closeModal('user-modal');
        loadUsers();
    } else {
        const error = await response.json();
        alert(error.message || 'Failed to save user');
    }
});

document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    const categoryId = e.target.dataset.categoryId;
    const url = categoryId ? `/api/categories/${categoryId}` : '/api/categories';
    const method = categoryId ? 'PATCH' : 'POST';
    
    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'same-origin'
    });
    
    if (response.ok) {
        alert(categoryId ? 'Category updated successfully' : 'Category created successfully');
        closeModal('category-modal');
        loadCategories();
    } else {
        const error = await response.json();
        alert(error.message || 'Failed to save category');
    }
});

async function logout() {
    const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
    });
    
    if (response.ok) {
        window.location.href = '/login.html';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }
        
        const userData = await response.json();
        const userResponse = await fetch(`/api/users/${userData.userId}`, { credentials: 'same-origin' });
        if (userResponse.ok) {
            const data = await userResponse.json();
            const user = data.user;
            
            // Set the admin name
            document.getElementById('adminName').textContent = user.full_name || user.login;
            
            // Set the admin rating
            document.getElementById('user-rating').textContent = user.rating || 0;
            
            // Add profile picture to the admin profile button
            const userProfileDiv = document.getElementById('user-profile');
            if (userProfileDiv) {
                const profileBtn = userProfileDiv.querySelector('a');
                if (profileBtn) {
                    const profilePicUrl = getProfilePictureUrl(user.profile_picture, user.login);
                    profileBtn.innerHTML = `
                        <img src="${profilePicUrl}" alt="${user.login}" class="header-profile-pic">
                        Profile
                    `;
                }
            }
        }

        loadUsers();
    } catch (error) {
        console.error('Initialization error:', error);
        window.location.href = '/login.html';
    }
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});