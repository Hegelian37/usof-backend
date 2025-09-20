let currentPage = 1;
let totalPages = 1;
let posts = [];
let categories = [];
let currentPostId = null;
let currentUser = null;
let editingCommentId = null;
let editingPostId = null;

// URL manipulation functions
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        post: urlParams.get('post'),
        page: urlParams.get('page'),
        sort: urlParams.get('sort'),
        category: urlParams.get('category'),
        dateFrom: urlParams.get('dateFrom'),
        dateTo: urlParams.get('dateTo'),
        favorites: urlParams.get('favorites')
    };
}

function updateUrl(params) {
    const url = new URL(window.location);
    
    // Clear all existing params first
    url.search = '';
    
    // Add new params
    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== '' && params[key] !== undefined) {
            url.searchParams.set(key, params[key]);
        }
    });
    
    window.history.pushState({}, '', url.toString());
}

function updateUrlForPost(postId) {
    updateUrl({ post: postId });
}

function updateUrlForList(params = {}) {
    const urlParams = {
        page: params.page || currentPage,
        sort: params.sort || document.getElementById('sort-select')?.value,
        category: params.category || document.getElementById('category-filter')?.value,
        dateFrom: params.dateFrom || document.getElementById('date-from')?.value,
        dateTo: params.dateTo || document.getElementById('date-to')?.value
    };
    
    // Only include non-empty values
    const cleanParams = {};
    Object.keys(urlParams).forEach(key => {
        if (urlParams[key] && urlParams[key] !== '' && urlParams[key] !== '1') {
            cleanParams[key] = urlParams[key];
        }
    });
    
    updateUrl(cleanParams);
}

function clearUrlParams() {
    window.history.pushState({}, '', window.location.pathname);
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Reset all global state first
        currentPage = 1;
        totalPages = 1;
        posts = [];
        categories = [];
        currentPostId = null;
        currentUser = null;
        editingCommentId = null;
        editingPostId = null;
        
        // Check authentication
        const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }

        const userData = await response.json();
        currentUser = await loadUserData(userData.userId);

        await loadCategories();
        
        // Check URL parameters and load appropriate view
        const urlParams = getUrlParams();
        
        // Restore filter states from URL ONLY if elements exist
        const restoreFilters = () => {
            const sortSelect = document.getElementById('sort-select');
            const categoryFilter = document.getElementById('category-filter');
            const dateFrom = document.getElementById('date-from');
            const dateTo = document.getElementById('date-to');
            
            if (urlParams.sort && sortSelect) {
                sortSelect.value = urlParams.sort;
            }
            if (urlParams.category && categoryFilter) {
                categoryFilter.value = urlParams.category;
            }
            if (urlParams.dateFrom && dateFrom) {
                dateFrom.value = urlParams.dateFrom;
            }
            if (urlParams.dateTo && dateTo) {
                dateTo.value = urlParams.dateTo;
            }
            if (urlParams.page) {
                currentPage = parseInt(urlParams.page) || 1;
            }
        };
        
        if (urlParams.post) {
            // Load specific post
            await showQuestion(parseInt(urlParams.post), false);
        } else if (urlParams.favorites === 'true') {
            // Load favorites view
            showFavorites();
        } else {
            // Restore filters and load posts list
            restoreFilters();
            await loadPosts();
        }
        
        await loadStats();
    } catch (error) {
        console.error('Initialization error:', error);
        // Don't redirect on initialization errors, show error message instead
        const questionsList = document.getElementById('questions-list');
        if (questionsList) {
            questionsList.innerHTML = `
                <div class="loading" style="color: red;">
                    Initialization failed: ${error.message}
                    <br><button onclick="location.reload()" class="btn btn-primary" style="margin-top: 10px;">Reload Page</button>
                </div>
            `;
        }
    }
});

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

// Handle browser back/forward buttons
window.addEventListener('popstate', async () => {
    try {
        // Clean up any editing state when navigating via browser buttons
        if (editingPostId) {
            editingPostId = null;
        }
        if (editingCommentId) {
            editingCommentId = null;
        }
        
        const urlParams = getUrlParams();
        
        if (urlParams.post) {
            await showQuestion(parseInt(urlParams.post), false);
        } else if (urlParams.favorites === 'true') {
            showFavorites();
        } else {
            showQuestionsList(false);
            // Restore filters and reload - with error handling
            if (urlParams.page) {
                currentPage = parseInt(urlParams.page) || 1;
            }
            
            // Add small delay to ensure DOM is ready after navigation
            setTimeout(async () => {
                try {
                    await loadPosts();
                } catch (error) {
                    console.error('Failed to load posts after navigation:', error);
                }
            }, 100);
        }
    } catch (error) {
        console.error('Navigation error:', error);
        // Force reload if navigation fails completely
        location.reload();
    }
});

async function loadUserData(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`, { credentials: 'same-origin' });
        if (response.ok) {
            const data = await response.json();
            const user = data.user;
            
            document.getElementById('username').textContent = user.full_name || user.login;
            document.getElementById('user-rating').textContent = user.rating || 0;
            
            // Add profile picture to the profile button area
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
            
            // Show admin panel if user is admin
            if (user.status === 'admin') {
                document.getElementById('admin-panel').style.display = 'block';
            }
            
            return user;
        }
    } catch (error) {
        console.error('Failed to load user data:', error);
    }
    return null;
}

async function loadCategories() {
    try {
        const response = await fetch('/api/categories', { credentials: 'same-origin' });
        if (response.ok) {
            const data = await response.json();
            categories = data.categories;
            
            // Update category filter dropdown
            const categoryFilter = document.getElementById('category-filter');
            if (categoryFilter) {
                categoryFilter.innerHTML = '<option value="">All Categories</option>' +
                    categories.map(cat => `<option value="${cat.id}">${cat.title}</option>`).join('');
            }
            
            // Update categories select for new posts
            const categoriesSelect = document.getElementById('categories-select');
            if (categoriesSelect) {
                categoriesSelect.innerHTML = categories.map(cat => 
                    `<option value="${cat.id}">${cat.title}</option>`).join('');
            }
            
            // Update sidebar categories list
            const sidebarCategories = document.getElementById('sidebar-categories');
            if (sidebarCategories) {
                sidebarCategories.innerHTML = categories.map(cat => 
                    `<li><a href="#" onclick="filterByCategory(${cat.id})">${cat.title}</a></li>`).join('');
            }
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
        // Show error in sidebar if loading fails
        const sidebarCategories = document.getElementById('sidebar-categories');
        if (sidebarCategories) {
            sidebarCategories.innerHTML = '<li style="color: red;">Failed to load categories</li>';
        }
    }
}

async function checkIfAdmin() {
    if (!currentUser) {
        try {
            // Try to reload current user if not available
            const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
            if (response.ok) {
                const userData = await response.json();
                currentUser = await loadUserData(userData.userId);
            }
        } catch (error) {
            console.warn('Failed to check user status:', error);
            return false;
        }
    }
    return currentUser && currentUser.status === 'admin';
}

async function loadPosts() {
    try {
        // Ensure DOM elements exist before proceeding
        const sortSelect = document.getElementById('sort-select');
        const categoryFilter = document.getElementById('category-filter');
        const dateFrom = document.getElementById('date-from');
        const dateTo = document.getElementById('date-to');
        const questionsList = document.getElementById('questions-list');
        
        if (!sortSelect || !categoryFilter || !dateFrom || !dateTo || !questionsList) {
            console.warn('Required DOM elements not found, retrying...');
            // Wait a bit and retry once
            await new Promise(resolve => setTimeout(resolve, 100));
            return loadPosts();
        }

        const sortBy = sortSelect.value || 'likes';
        const categoryId = categoryFilter.value || '';
        const dateFromValue = dateFrom.value || '';
        const dateToValue = dateTo.value || '';
        
        let url = `/api/posts?page=${currentPage}&sortBy=${sortBy}`;
        
        // Add admin view parameter for admin users
        const isAdmin = await checkIfAdmin();
        if (isAdmin) {
            url += `&status=admin_view`;
        }
        
        if (categoryId) url += `&categories=${categoryId}`;
        if (dateFromValue) url += `&dateFrom=${dateFromValue}`;
        if (dateToValue) url += `&dateTo=${dateToValue}`;

        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        posts = data.posts || [];
        totalPages = data.pagination?.totalPages || 1;
        
        renderPosts();
        renderPagination();
        
        // Update URL with current filters
        updateUrlForList();
    } catch (error) {
        console.error('Failed to load posts:', error);
        const questionsList = document.getElementById('questions-list');
        if (questionsList) {
            questionsList.innerHTML = `
                <div class="loading" style="color: red;">
                    Failed to load questions: ${error.message}
                    <br><button onclick="loadPosts()" class="btn btn-primary" style="margin-top: 10px;">Retry</button>
                </div>
            `;
        }
    }
}

// Delete a post
async function deletePost(postId) {
    // Determine if user is admin or post owner for appropriate messaging
    const isAdmin = currentUser && currentUser.status === 'admin';
    let confirmMessage;
    
    if (isAdmin) {
        confirmMessage = 'Are you sure you want to delete this post? This action cannot be undone and will remove the post and all its comments permanently.';
    } else {
        confirmMessage = 'Are you sure you want to delete your post? This action cannot be undone and will remove your post and all its comments permanently.';
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            // Show success message
            alert('Post deleted successfully.');
            
            // Navigate back to the main posts list
            showQuestionsList(true);
            
            // Reload posts to reflect the deletion
            await loadPosts();
            
            // Clear the current post reference
            currentPostId = null;
        } else {
            const error = await response.json();
            alert(error.message || 'Failed to delete post');
        }
    } catch (error) {
        console.error('Failed to delete post:', error);
        alert('Failed to delete post. Please try again.');
    }
}

// Toggle favorite status of a post
async function toggleFavorite(postId) {
    try {
        // First check current favorite status
        const statusResponse = await fetch(`/api/posts/${postId}/favorite-status`, {
            credentials: 'same-origin'
        });
        
        if (!statusResponse.ok) {
            throw new Error('Failed to check favorite status');
        }
        
        const statusData = await statusResponse.json();
        const isFavorited = statusData.isFavorited;
        
        // Toggle the favorite status
        const method = isFavorited ? 'DELETE' : 'POST';
        const url = `/api/favorites/${postId}`;
        
        const response = await fetch(url, {
            method: method,
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // Update the favorite button appearance
            updateFavoriteButton(postId, !isFavorited);
            
            // Show feedback to user
            const action = !isFavorited ? 'added to' : 'removed from';
            console.log(`Post ${action} favorites`);
            
            // Optional: show a brief notification
            showNotification(`Post ${action} favorites!`);
        } else {
            const error = await response.json();
            alert(error.message || 'Failed to update favorites');
        }
    } catch (error) {
        console.error('Failed to toggle favorite:', error);
        alert('Failed to update favorites');
    }
}

// Update the appearance of favorite button
function updateFavoriteButton(postId, isFavorited) {
    const button = document.querySelector(`[data-favorite-post="${postId}"]`);
    if (button) {
        button.classList.toggle('favorited', isFavorited);
        button.title = isFavorited ? 'Remove from favorites' : 'Add to favorites';
        button.innerHTML = isFavorited ? '★' : '☆'; // Filled/empty star
    }
}

// Load user's favorite posts
async function loadFavorites(page = 1) {
    try {
        const response = await fetch(`/api/favorites?page=${page}&limit=10`, {
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        renderFavoritesPosts(data.posts);
        renderFavoritesPagination(data.pagination);
        
        return data; // Return the data for success handling
    } catch (error) {
        console.error('Failed to load favorites:', error);
        throw error; // Re-throw to be caught by showFavorites
    }
}

// Render favorites posts (similar to regular posts but with favorited date)
function renderFavoritesPosts(posts) {
    const container = document.getElementById('favorites-list') || document.getElementById('questions-list');
    
    if (posts.length === 0) {
        container.innerHTML = '<div class="loading">No favorite posts yet</div>';
        return;
    }

    container.innerHTML = posts.map(post => {
        const likesCount = (post.likes_count || 0) - (post.dislikes_count || 0);
        const commentsCount = post.comments_count || 0;
        const excerpt = post.content ? post.content.substring(0, 150) + '...' : '';
        
        return `
            <div class="question-item">
                <div class="question-stats">
                    <div class="stat stat-votes">${likesCount} votes</div>
                    <div class="stat stat-answers">${commentsCount} comments</div>
                </div>
                <div class="question-content">
                    <h3 class="question-title" onclick="showQuestion(${post.id})">
                        ${post.title}
                    </h3>
                    <div class="question-excerpt">${excerpt}</div>
                    <div class="question-tags" id="tags-${post.id}">
                        <!-- Tags loaded separately -->
                    </div>
                    <div class="question-meta">
                        <div class="author-info">
                            asked ${new Date(post.created_at).toLocaleDateString()} by 
                            <strong>${post.author_login || 'Unknown'}</strong>
                            ${post.author_rating ? `<span class="author-rating">(${post.author_rating})</span>` : ''}
                            <span style="color: #666; margin-left: 10px;">
                                • favorited ${new Date(post.favorited_at).toLocaleDateString()}
                            </span>
                        </div>
                        <div class="post-actions">
                            <button class="favorite-btn favorited" 
                                    data-favorite-post="${post.id}" 
                                    onclick="toggleFavorite(${post.id})" 
                                    title="Remove from favorites">★</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Load tags for each post
    posts.forEach(async (post) => {
        try {
            const response = await fetch(`/api/posts/${post.id}/categories`, { credentials: 'same-origin' });
            if (response.ok) {
                const data = await response.json();
                const tagsDiv = document.getElementById(`tags-${post.id}`);
                if (tagsDiv) {
                    tagsDiv.innerHTML = data.categories.map(cat => 
                        `<span class="tag">${cat.title}</span>`).join('');
                }
            }
        } catch (error) {
            console.error('Failed to load post categories:', error);
        }
    });
}

function renderFavoritesPagination(pagination) {
    const paginationContainer = document.getElementById('favorites-pagination');
    if (!paginationContainer || !pagination) return;
    
    const { currentPage, totalPages } = pagination;
    let paginationHTML = '';

    /* if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    } */

    paginationHTML += `<button class="page-btn" onclick="loadFavorites(${currentPage - 1})"
        ${currentPage === 1 ? 'disabled' : ''}><</button>`;

    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        paginationHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="loadFavorites(${i})">${i}</button>`;
    }

    paginationHTML += `<button class="page-btn" onclick="loadFavorites(${currentPage + 1})"
        ${currentPage === totalPages ? 'disabled' : ''}>></button>`;

    paginationContainer.innerHTML = paginationHTML;
}

// Show simple notification
function showNotification(message) {
    // Create or update notification element
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 10px 15px;
            border-radius: 4px;
            z-index: 1000;
            transition: opacity 0.3s;
        `;
        document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.style.opacity = '1';
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
    }, 3000);
}

function addFavoriteButtonToPost(postId, isFavorited = false) {
    return `
        <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" 
                data-favorite-post="${postId}" 
                onclick="toggleFavorite(${postId})" 
                title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}">
            ${isFavorited ? '★' : '☆'}
        </button>
    `;
}

async function loadPostFavoriteStatus(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}/favorite-status`, {
            credentials: 'same-origin'
        });
        if (response.ok) {
            const data = await response.json();
            return data.isFavorited;
        }
    } catch (error) {
        console.error('Failed to load favorite status:', error);
    }
    return false;
}

async function loadFavoriteStatusForPosts() {
    if (!currentUser) return;
    
    // Load favorite status for all visible posts
    for (const post of posts) {
        try {
            const isFavorited = await loadPostFavoriteStatus(post.id);
            updateFavoriteButton(post.id, isFavorited);
        } catch (error) {
            console.error(`Failed to load favorite status for post ${post.id}:`, error);
        }
    }
}

function renderPosts() {
    const questionsList = document.getElementById('questions-list');
    
    if (posts.length === 0) {
        questionsList.innerHTML = '<div class="loading">No questions found</div>';
        return;
    }

    const isAdmin = currentUser && currentUser.status === 'admin';

    questionsList.innerHTML = posts.map(post => {
        const likesCount = (post.likes_count || 0) - (post.dislikes_count || 0);
        const commentsCount = post.comments_count || 0;
        const excerpt = post.content ? post.content.substring(0, 150) + '...' : '';
        
        // Status indicators for admin/owner view
        let statusIndicator = '';
        if (isAdmin || (currentUser && post.user_id === currentUser.id)) {
            if (post.status === 'inactive') {
                statusIndicator = '<span style="color: red; font-size: 12px;">[INACTIVE]</span> ';
            } else if (post.status === 'locked') {
                statusIndicator = '<span style="color: orange; font-size: 12px;">[LOCKED]</span> ';
            }
        }
        
        // Create rating display with tooltip
        const ratingDisplay = `<span class="rating-tooltip-container">
            <span class="rating-hover" data-type="post" data-id="${post.id}">${likesCount}</span>
            <div class="rating-tooltip">
                <div class="tooltip-loading">Loading votes...</div>
            </div>
        </span>`;
        
        return `
            <div class="question-item ${post.status === 'inactive' ? 'inactive-post' : ''} ${post.status === 'locked' ? 'locked-post' : ''}">
                <div class="question-stats">
                    <div class="stat stat-votes">${ratingDisplay} votes</div>
                    <div class="stat stat-answers">${commentsCount} comments</div>
                </div>
                <div class="question-content">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h3 class="question-title" onclick="showQuestion(${post.id})" style="flex: 1; cursor: pointer;">
                            ${statusIndicator}${post.title}
                        </h3>
                        <div class="post-actions">
                            <button class="favorite-btn" 
                                    data-favorite-post="${post.id}" 
                                    onclick="toggleFavorite(${post.id})" 
                                    title="Add to favorites">☆</button>
                        </div>
                    </div>
                    <div class="question-excerpt">${excerpt}</div>
                    <div class="question-tags" id="tags-${post.id}">
                        <!-- Tags loaded separately -->
                    </div>
                    <div class="question-meta">
                        <div class="author-info">
                            asked ${new Date(post.created_at).toLocaleDateString()} by 
                            <strong>${post.author_login || 'Unknown'}</strong>
                            <span class="author-rating">(${post.author_rating || 0})</span>
                            ${isAdmin ? `<span style="margin-left: 10px; font-size: 11px; color: #666;">Status: ${post.status}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Initialize tooltips and load favorite status (existing code)...
    initializeTooltips();
    loadFavoriteStatusForPosts();

    // Load tags for each post (existing code)...
    posts.forEach(async (post) => {
        try {
            const response = await fetch(`/api/posts/${post.id}/categories`, { credentials: 'same-origin' });
            if (response.ok) {
                const data = await response.json();
                const tagsDiv = document.getElementById(`tags-${post.id}`);
                if (tagsDiv) {
                    tagsDiv.innerHTML = data.categories.map(cat => 
                        `<span class="tag">${cat.title}</span>`).join('');
                }
            }
        } catch (error) {
            console.error('Failed to load post categories:', error);
        }
    });
}

// Add CSS for inactive posts
const additionalCSS = `
.inactive-post {
    opacity: 0.7;
    background-color: #f9f9f9;
    border-left: 3px solid #dc3545;
}
`;

// Add the CSS to the page
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

function renderPagination() {
    const pagination = document.getElementById('pagination');
    let paginationHTML = '';

    paginationHTML += `<button class="page-btn" onclick="goToPage(${currentPage - 1})"
        ${currentPage === 1 ? 'disabled' : ''}><</button>`;

    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        paginationHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    paginationHTML += `<button class="page-btn" onclick="goToPage(${currentPage + 1})"
        ${currentPage === totalPages ? 'disabled' : ''}>></button>`;

    pagination.innerHTML = paginationHTML;
}

function goToPage(page) {
    currentPage = page;
    loadPosts();
}

async function showQuestion(postId, updateUrl = true) {
    currentPostId = postId;
    
    try {
        // Load post details
        const postResponse = await fetch(`/api/posts/${postId}`, { credentials: 'same-origin' });
        if (!postResponse.ok) return;
        
        const postData = await postResponse.json();
        
        // Load current user's vote on this post
        let userPostVote = null;
        if (currentUser) {
            try {
                const postLikesResponse = await fetch(`/api/posts/${postId}/like`, { credentials: 'same-origin' });
                if (postLikesResponse.ok) {
                    const postLikesData = await postLikesResponse.json();
                    userPostVote = postLikesData.likes.find(like => like.user_id === currentUser.id);
                }
            } catch (error) {
                console.error('Failed to load post likes:', error);
            }
        }
        
        // Load comments with likes
        const commentsResponse = await fetch(`/api/posts/${postId}/comments`, { credentials: 'same-origin' });
        let comments = [];
        if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            comments = commentsData.comments;
            
            // Load likes for each comment
            for (let comment of comments) {
                try {
                    const likesResponse = await fetch(`/api/comments/${comment.id}/like`, { credentials: 'same-origin' });
                    if (likesResponse.ok) {
                        const likesData = await likesResponse.json();
                        comment.likes = likesData.likes;
                        comment.userLike = likesData.likes.find(like => like.user_id === currentUser?.id);
                    }
                } catch (error) {
                    console.error('Failed to load comment likes:', error);
                }
            }
        }

        renderQuestionDetail(postData, comments, userPostVote);
        
        document.getElementById('questions-view').style.display = 'none';
        document.getElementById('question-detail').style.display = 'block';
        
        // Update URL to show current post
        if (updateUrl) {
            updateUrlForPost(postId);
        }
    } catch (error) {
        console.error('Failed to load question:', error);
    }
}

function renderQuestionDetail(post, comments, userPostVote) {
    const likesCount = (post.likes_count || 0) - (post.dislikes_count || 0);
    const commentsCount = post.comments_count || 0;
    const isAdmin = currentUser && currentUser.status === 'admin';
    const isOwner = currentUser && currentUser.id === post.user_id;
    
    // Check if current user can edit/delete this post
    const canEditPost = isOwner || isAdmin;
    const canDeletePost = isOwner || isAdmin;
    
    // Check if voting is allowed (not locked)
    const canVote = post.status !== 'locked';
    
    // Determine vote button states
    const isLiked = userPostVote && userPostVote.type === 'like';
    const isDisliked = userPostVote && userPostVote.type === 'dislike';
    
    // Status indicator
    let statusIndicator = '';
    if (post.status === 'inactive') {
        statusIndicator = '<span style="color: red; font-size: 14px;">[INACTIVE]</span> ';
    } else if (post.status === 'locked') {
        statusIndicator = '<span style="color: orange; font-size: 14px;">[LOCKED]</span> ';
    }
    
    const ratingDisplay = `<span class="rating-tooltip-container">
        <span class="rating-hover" data-type="post" data-id="${post.id}">${likesCount}</span>
        <div class="rating-tooltip">
            <div class="tooltip-loading">Loading votes...</div>
        </div>
    </span>`;
    
    // Create lock/unlock button for owners and admins
    const lockPostButton = canEditPost ? `
        <button onclick="togglePostLock(${post.id}, '${post.status === 'locked' ? 'active' : 'locked'}')" 
                class="btn ${post.status === 'locked' ? 'btn-warning' : 'btn-warning'}">
            ${post.status === 'locked' ? 'Unlock Post' : 'Lock Post'}
        </button>
    ` : '';
    
    document.getElementById('question-content').innerHTML = `
        <div style="display: flex; gap: 20px;">
            <div class="question-voting">
                <button class="vote-btn ${isLiked ? 'voted liked' : ''} ${!canVote ? 'disabled' : ''}" 
                        onclick="${canVote ? `votePost(${post.id}, 'like')` : ''}" 
                        title="${!canVote ? 'Post is locked' : (isLiked ? 'Remove like' : 'Like this post')}"
                        ${!canVote ? 'disabled' : ''}>▲</button>
                <div class="vote-score">${ratingDisplay}</div>
                <button class="vote-btn ${isDisliked ? 'voted disliked' : ''} ${!canVote ? 'disabled' : ''}" 
                        onclick="${canVote ? `votePost(${post.id}, 'dislike')` : ''}"
                        title="${!canVote ? 'Post is locked' : (isDisliked ? 'Remove dislike' : 'Dislike this post')}"
                        ${!canVote ? 'disabled' : ''}>▼</button>
            </div>
            <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <h1 style="flex: 1;">
                        ${statusIndicator}${post.title}
                    </h1>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                        <button class="favorite-btn" 
                                data-favorite-post="${post.id}" 
                                onclick="toggleFavorite(${post.id})" 
                                title="Add to favorites"
                                style="font-size: 20px; background: none; border: none; cursor: pointer;">☆</button>
                        ${lockPostButton}
                        ${canEditPost && !isAdmin ? `<button onclick="showEditPost(${post.id}, '${post.title.replace(/'/g, '\\\'').replace(/"/g, '&quot;')}', \`${post.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)" class="btn btn-secondary">Edit Post</button>` : ''}
                        ${canEditPost ? `
                            <button onclick="togglePostStatus(${post.id}, '${post.status === 'inactive' ? 'active' : 'inactive'}')" 
                                    class="btn ${post.status === 'inactive' ? 'btn-success' : 'btn-warning'}">
                                ${post.status === 'inactive' ? 'Activate Post' : 'Deactivate Post'}
                            </button>
                        ` : ''}
                        ${canDeletePost ? `<button onclick="deletePost(${post.id})" class="btn btn-danger" style="background: #dc3545; color: white;">Delete Post</button>` : ''}
                    </div>
                </div>
                ${post.status === 'locked' ? '<div class="lock-notice">🔒 This post is locked. Voting and new comments are disabled.</div>' : ''}
                <div style="margin: 20px 0; line-height: 1.6;">${post.content}</div>
                <div class="question-meta">
                    <div>
                        asked ${new Date(post.created_at).toLocaleDateString()} by 
                        <strong>${post.author_login || 'Unknown'}</strong>
                        | ${commentsCount} comments
                        ${post.updated_at && post.updated_at !== post.created_at ? 
                            `<span style="font-style: italic; color: #666;"> (edited ${new Date(post.updated_at).toLocaleDateString()})</span>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;

    renderComments(comments);
    initializeTooltips();
    
    // Load and set favorite status for this specific post
    loadPostFavoriteStatus(post.id).then(isFavorited => {
        updateFavoriteButton(post.id, isFavorited);
    });
}

// New functions for post and comment locking
async function togglePostLock(postId, newStatus) {
    const action = newStatus === 'locked' ? 'lock' : 'unlock';
    let message;
    
    if (newStatus === 'locked') {
        message = 'Are you sure you want to lock this post? Users will still be able to see it, but they won\'t be able to vote on it or add new comments.';
    } else {
        message = 'Are you sure you want to unlock this post? Users will be able to vote and comment again.';
    }
    
    if (!confirm(message)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            // Reload the question to show updated status
            showQuestion(postId, false);
            // Also reload the posts list if we're viewing it
            if (document.getElementById('questions-view').style.display !== 'none') {
                loadPosts();
            }
        } else {
            const error = await response.json();
            alert(error.message || `Failed to ${action} post`);
        }
    } catch (error) {
        console.error(`Failed to ${action} post:`, error);
        alert(`Failed to ${action} post`);
    }
}

async function toggleCommentLock(commentId, newStatus) {
    const action = newStatus === 'locked' ? 'lock' : 'unlock';
    let message;
    
    if (newStatus === 'locked') {
        message = 'Are you sure you want to lock this comment? Users will still be able to see it, but they won\'t be able to vote on it.';
    } else {
        message = 'Are you sure you want to unlock this comment? Users will be able to vote on it again.';
    }
    
    if (!confirm(message)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/comments/${commentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            // Reload the question to update comments list
            showQuestion(currentPostId, false);
        } else {
            const error = await response.json();
            alert(error.message || `Failed to ${action} comment`);
        }
    } catch (error) {
        console.error(`Failed to ${action} comment:`, error);
        alert(`Failed to ${action} comment`);
    }
}

function renderComments(comments) {
    const commentsList = document.getElementById('comments-list');
    const isAdmin = currentUser && currentUser.status === 'admin';
    
    // Check if the post is locked to disable new comments
    const postLocked = document.querySelector('.lock-notice') !== null;
    
    commentsList.innerHTML = comments.map(comment => {
        const likes = comment.likes || [];
        const likesCount = likes.filter(like => like.type === 'like').length;
        const dislikesCount = likes.filter(like => like.type === 'dislike').length;
        const score = likesCount - dislikesCount;
        
        const userLike = comment.userLike;
        const isLiked = userLike && userLike.type === 'like';
        const isDisliked = userLike && userLike.type === 'dislike';
        
        const isOwner = currentUser && comment.user_id === currentUser.id;
        const canEdit = isOwner && !isAdmin;
        const canDelete = isOwner || isAdmin;
        const canToggleStatus = isOwner || isAdmin;
        
        // Check if voting is allowed (comment not locked)
        const canVoteOnComment = comment.status !== 'locked';

        const commentDate = new Date(comment.created_at);
        const updatedDate = comment.updated_at && comment.updated_at !== comment.created_at ? 
            new Date(comment.updated_at) : null;
        
        const formattedDateTime = commentDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Status indicator
        let statusBadge = '';
        if (comment.status === 'inactive') {
            statusBadge = '<span class="status-badge inactive">INACTIVE</span>';
        } else if (comment.status === 'locked') {
            statusBadge = '<span class="status-badge locked">LOCKED</span>';
        }
        
        // Create lock/unlock button for comment owners and admins
        const lockCommentButton = canToggleStatus ? `
            <button class="comment-btn ${comment.status === 'locked' ? 'unlock' : 'lock'}" 
                    onclick="toggleCommentLock(${comment.id}, '${comment.status === 'locked' ? 'active' : 'locked'}')">
                ${comment.status === 'locked' ? 'Unlock' : 'Lock'}
            </button>
        ` : '';
        
        const ratingDisplay = `<span class="rating-tooltip-container">
            <span class="rating-hover" data-type="comment" data-id="${comment.id}">${score}</span>
            <div class="rating-tooltip">
                <div class="tooltip-loading">Loading votes...</div>
            </div>
        </span>`;
        
        const profilePicUrl = getProfilePictureUrl(comment.author_profile_picture, comment.author_login);
        
        return `
            <div class="comment ${comment.status === 'inactive' ? 'inactive' : ''} ${comment.status === 'locked' ? 'locked' : ''}" id="comment-${comment.id}">
                <div class="comment-header">
                    <div class="comment-author-info">
                        <img src="${profilePicUrl}" alt="${comment.author_login || 'User'}" class="comment-profile-pic">
                        <div class="comment-author-details">
                            <span class="comment-author">${comment.author_login || 'Unknown'}</span>
                            <div class="comment-timestamp">
                                ${formattedDateTime}
                                ${updatedDate ? `<span style="font-style: italic;"> (edited ${updatedDate.toLocaleDateString()})</span>` : ''}
                                ${statusBadge}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="comment-content">${comment.content}</div>
                <div class="comment-actions">
                    <div class="comment-voting">
                        <button class="comment-vote-btn ${isLiked ? 'liked' : ''} ${!canVoteOnComment ? 'disabled' : ''}" 
                                onclick="${canVoteOnComment ? `voteComment(${comment.id}, 'like')` : ''}"
                                title="${!canVoteOnComment ? 'Comment is locked' : ''}"
                                ${!canVoteOnComment ? 'disabled' : ''}>↑</button>
                        <span class="comment-score">${ratingDisplay}</span>
                        <button class="comment-vote-btn ${isDisliked ? 'disliked' : ''} ${!canVoteOnComment ? 'disabled' : ''}" 
                                onclick="${canVoteOnComment ? `voteComment(${comment.id}, 'dislike')` : ''}"
                                title="${!canVoteOnComment ? 'Comment is locked' : ''}"
                                ${!canVoteOnComment ? 'disabled' : ''}>↓</button>
                    </div>
                    <div class="comment-admin-actions">
                        ${lockCommentButton}
                        ${canEdit && comment.status !== 'locked' ? `<button class="comment-btn" onclick="showEditComment(${comment.id}, \`${comment.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">Edit</button>` : ''}
                        ${canToggleStatus ? `
                            <button class="comment-btn ${comment.status === 'inactive' ? 'activate' : 'deactivate'}" 
                                    onclick="toggleCommentStatus(${comment.id}, '${comment.status === 'inactive' ? 'active' : 'inactive'}')">
                                ${comment.status === 'inactive' ? 'Activate' : 'Deactivate'}
                            </button>
                        ` : ''}
                        ${canDelete ? `<button class="comment-btn delete" onclick="deleteComment(${comment.id})">Delete</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Update comment form to show if locked
    const commentForm = document.querySelector('.comment-form');
    if (commentForm) {
        const commentInput = document.getElementById('comment-input');
        const commentButton = commentForm.querySelector('button');
        
        if (postLocked) {
            commentInput.disabled = true;
            commentInput.placeholder = 'Comments are disabled on locked posts';
            commentButton.disabled = true;
            commentButton.textContent = 'Comments Disabled';
            commentButton.title = 'This post is locked';
        } else {
            commentInput.disabled = false;
            commentInput.placeholder = 'Add a comment...';
            commentButton.disabled = false;
            commentButton.textContent = 'Add Comment';
            commentButton.title = '';
        }
    }
    
    initializeTooltips();
}

function showFavorites() {
    // Clean up any editing state first
    if (editingPostId) {
        editingPostId = null;
    }
    if (editingCommentId) {
        editingCommentId = null;
    }
    
    // Reset current post
    currentPostId = null;
    
    // Hide other views
    document.getElementById('questions-view').style.display = 'none';
    document.getElementById('question-detail').style.display = 'none';
    
    // Show favorites view (create if doesn't exist)
    let favoritesView = document.getElementById('favorites-view');
    if (!favoritesView) {
        // Create favorites view dynamically
        const container = document.querySelector('.container .main-content');
        favoritesView = document.createElement('div');
        favoritesView.id = 'favorites-view';
        favoritesView.innerHTML = `
            <div class="question-header">
                <h1>My Favorite Posts</h1>
                <button onclick="showQuestionsList()" class="btn btn-secondary">← Back to All Questions</button>
            </div>
            
            <div class="questions-list" id="favorites-list">
                <div class="loading">Loading favorites...</div>
            </div>
            
            <div class="pagination" id="favorites-pagination"></div>
        `;
        container.appendChild(favoritesView);
    }
    
    favoritesView.style.display = 'block';
    
    // Load favorites - with error handling
    loadFavorites().catch(error => {
        console.error('Failed to load favorites:', error);
        const favoritesList = document.getElementById('favorites-list');
        if (favoritesList) {
            favoritesList.innerHTML = `
                <div class="loading" style="color: red;">
                    Failed to load favorites: ${error.message}
                    <br><button onclick="loadFavorites()" class="btn btn-primary" style="margin-top: 10px;">Retry</button>
                </div>
            `;
        }
    });
    
    // Update URL to show favorites view
    updateUrl({ favorites: 'true' });
}

function showQuestionsList(updateUrl = true) {
    // Clean up edit state first
    if (editingPostId) {
        editingPostId = null;
    }
    if (editingCommentId) {
        editingCommentId = null;
    }
    
    // Reset current post
    currentPostId = null;
    
    // Show/hide views
    const questionDetail = document.getElementById('question-detail');
    const questionsView = document.getElementById('questions-view');
    const favoritesView = document.getElementById('favorites-view');
    
    if (questionDetail) questionDetail.style.display = 'none';
    if (favoritesView) favoritesView.style.display = 'none';
    if (questionsView) questionsView.style.display = 'block';
    
    // Clear post parameter from URL
    if (updateUrl) {
        clearUrlParams();
        // Restore list URL with current filters
        updateUrlForList();
    }

    // Ensure posts are loaded if we're now viewing the list
    if (questionsView && questionsView.style.display !== 'none') {
        // Always reload posts to reflect any changes
        loadPosts();
    }
}

// Show edit form for a comment
function showEditComment(commentId, currentContent) {
    // Cancel any existing edits safely
    if (editingCommentId && editingCommentId !== commentId) {
        try {
            cancelEditComment();
        } catch (error) {
            console.warn('Could not cancel previous comment edit, continuing...', error);
        }
    }
    
    if (editingPostId) {
        try {
            cancelEditPost();
        } catch (error) {
            console.warn('Could not cancel post edit, continuing...', error);
        }
    }
    
    editingCommentId = commentId;

    const commentDiv = document.getElementById(`comment-${commentId}`);
    const contentDiv = commentDiv.querySelector('.comment-content');
    
    // Store original content
    contentDiv.dataset.originalContent = currentContent;
    
    // Replace content with textarea
    contentDiv.innerHTML = `
        <div class="edit-comment-form">
            <textarea id="edit-comment-textarea" rows="3" style="width: 100%; margin-bottom: 10px;">${currentContent}</textarea>
            <div class="edit-comment-actions">
                <button onclick="saveEditComment()" class="btn btn-primary" style="margin-right: 10px;">Save</button>
                <button onclick="cancelEditComment()" class="btn btn-secondary">Cancel</button>
            </div>
        </div>
    `;
}

// Save edited comment
async function saveEditComment() {
    if (!editingCommentId) return;
    
    const textarea = document.getElementById('edit-comment-textarea');
    const newContent = textarea.value.trim();
    
    if (!newContent) {
        alert('Comment content cannot be empty');
        return;
    }
    
    try {
        const response = await fetch(`/api/comments/${editingCommentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: newContent }),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            // Reload the question to show updated comment
            showQuestion(currentPostId, false);
            editingCommentId = null;
        } else {
            const error = await response.json();
            alert(error.message || 'Failed to update comment');
        }
    } catch (error) {
        console.error('Failed to update comment:', error);
        alert('Failed to update comment');
    }
}

// Cancel comment editing
function cancelEditComment() {
    if (!editingCommentId) return;
    
    try {
        const commentDiv = document.getElementById(`comment-${editingCommentId}`);
        if (commentDiv) {
            const contentDiv = commentDiv.querySelector('.comment-content');
            if (contentDiv && contentDiv.dataset.originalContent) {
                contentDiv.innerHTML = contentDiv.dataset.originalContent;
            }
        }
    } catch (error) {
        console.warn('Error cancelling comment edit:', error);
    } finally {
        editingCommentId = null;
    }
}

// Toggle post status (activate/deactivate)
async function togglePostStatus(postId, newStatus) {
    const action = newStatus === 'active' ? 'activate' : 'deactivate';
    const consequence = newStatus === 'active' ? 'visible to all users' : 'hidden from other users';
    
    if (!confirm(`Are you sure you want to ${action} your post? It will be ${consequence}.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            // Reload the question to show updated status
            showQuestion(postId, false);
            // Also reload the posts list if we're viewing it
            if (document.getElementById('questions-view').style.display !== 'none') {
                loadPosts();
            }
        } else {
            const error = await response.json();
            alert(error.message || `Failed to ${action} post`);
        }
    } catch (error) {
        console.error(`Failed to ${action} post:`, error);
        alert(`Failed to ${action} post`);
    }
}

// Show edit form for a post
async function showEditPost(postId, currentTitle, currentContent) {
    // Cancel any existing edits - but don't fail if elements don't exist
    if (editingPostId && editingPostId !== postId) {
        try {
            cancelEditPost();
        } catch (error) {
            console.warn('Could not cancel previous edit, continuing...', error);
        }
    }

    if (editingCommentId) {
        try {
            cancelEditComment();
        } catch (error) {
            console.warn('Could not cancel comment edit, continuing...', error);
        }
    }
    
    editingPostId = postId;
    
    // Get current categories for this post
    let currentCategories = [];
    try {
        const response = await fetch(`/api/posts/${postId}/categories`, { 
            credentials: 'same-origin' 
        });
        if (response.ok) {
            const data = await response.json();
            currentCategories = data.categories.map(cat => cat.id);
        }
    } catch (error) {
        console.error('Failed to load current categories:', error);
    }
    
    const questionContent = document.getElementById('question-content');
    
    // Store original content
    questionContent.dataset.originalTitle = currentTitle;
    questionContent.dataset.originalContent = currentContent;
    questionContent.dataset.originalCategories = JSON.stringify(currentCategories);
    
    // Build categories options
    const categoryOptions = categories.map(cat => 
        `<option value="${cat.id}" ${currentCategories.includes(cat.id) ? 'selected' : ''}>${cat.title}</option>`
    ).join('');
    
    // Replace with edit form
    questionContent.innerHTML = `
        <div class="edit-post-form" style="padding: 20px; background: #f8f9fa; border-radius: 5px;">
            <h3>Edit Post</h3>
            <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Title</label>
                <input type="text" id="edit-post-title" value="${currentTitle.replace(/"/g, '&quot;')}" 
                    style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 3px;">
            </div>
            <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Content</label>
                <textarea id="edit-post-content" rows="8" 
                        style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 3px;">${currentContent}</textarea>
            </div>
            <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Categories</label>
                <select id="edit-categories-select" multiple style="width: 100%; min-height: 100px; padding: 8px; border: 1px solid #ccc; border-radius: 3px;">
                    ${categoryOptions}
                </select>
                <div class="selected-categories" id="selected-categories"></div>
                <small style="color: #666; font-size: 12px;">Hold Ctrl (Cmd on Mac) to select multiple categories</small>
            </div>
            <div class="edit-post-actions">
                <button onclick="saveEditPost()" class="btn btn-primary" style="margin-right: 10px;">Save Changes</button>
                <button onclick="cancelEditPost()" class="btn btn-secondary">Cancel</button>
            </div>
        </div>
    `;
    
    // Initialize category display
    updateSelectedCategoriesDisplay();
    
    // Add change listener
    document.getElementById('edit-categories-select').addEventListener('change', updateSelectedCategoriesDisplay);
}

// Save edited post
async function saveEditPost() {
    if (!editingPostId) return;
    
    const titleInput = document.getElementById('edit-post-title');
    const contentTextarea = document.getElementById('edit-post-content');
    const categoriesSelect = document.getElementById('edit-categories-select');
    
    const newTitle = titleInput.value.trim();
    const newContent = contentTextarea.value.trim();
    const selectedCategories = Array.from(categoriesSelect.selectedOptions)
        .map(option => parseInt(option.value));
    
    if (!newTitle || !newContent) {
        alert('Title and content cannot be empty');
        return;
    }
    
    if (selectedCategories.length === 0) {
        if (!confirm('No categories selected. Continue without categories?')) {
            return;
        }
    }
    
    try {
        const response = await fetch(`/api/posts/${editingPostId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title: newTitle, 
                content: newContent,
                categories: selectedCategories
            }),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            // Reload the question to show updated post
            showQuestion(editingPostId, false);
            editingPostId = null;
        } else {
            const error = await response.json();
            alert(error.message || 'Failed to update post');
        }
    } catch (error) {
        console.error('Failed to update post:', error);
        alert('Failed to update post');
    }
}

// Helper function for category display
function updateSelectedCategoriesDisplay() {
    const select = document.getElementById('edit-categories-select');
    const display = document.getElementById('selected-categories');
    
    if (!select || !display) return;
    
    const selectedOptions = Array.from(select.selectedOptions);
    
    if (selectedOptions.length === 0) {
        display.innerHTML = '<span style="color: #666; font-style: italic;">No categories selected</span>';
        return;
    }
    
    display.innerHTML = selectedOptions.map(option => `
        <span class="selected-category">
            ${option.textContent}
            <span class="remove-category" onclick="removeCategory(${option.value})" title="Remove category">×</span>
        </span>
    `).join('');
}

function removeCategory(categoryId) {
    const select = document.getElementById('edit-categories-select');
    if (select) {
        const option = select.querySelector(`option[value="${categoryId}"]`);
        if (option) {
            option.selected = false;
            updateSelectedCategoriesDisplay();
        }
    }
}

// Cancel post editing
function cancelEditPost() {
    if (!editingPostId) return;
    
    // Reload the question to restore original view
    try {
        // Only reload if we're still viewing the same post
        if (currentPostId === editingPostId) {
            showQuestion(editingPostId, false);
        }
    } catch (error) {
        console.warn('Error cancelling post edit:', error);
    } finally {
        editingPostId = null;
    }
}

// Vote on a comment (like/dislike)
async function voteComment(commentId, type) {
    try {
        const response = await fetch(`/api/comments/${commentId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type }),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            const result = await response.json();
            showQuestion(currentPostId, false);
        } else {
            const error = await response.json();
            // Show specific error message for locked comments
            if (error.message.includes('locked')) {
                alert('This comment is locked and cannot be voted on.');
            } else {
                alert(error.message || 'Failed to vote on comment');
            }
        }
    } catch (error) {
        console.error('Failed to vote on comment:', error);
        alert('Failed to vote on comment');
    }
}

// Delete a comment
async function deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/comments/${commentId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            // Reload the question to update comments list
            showQuestion(currentPostId, false);
        } else {
            const error = await response.json();
            alert(error.message || 'Failed to delete comment');
        }
    } catch (error) {
        console.error('Failed to delete comment:', error);
        alert('Failed to delete comment');
    }
}

// Toggle comment status (activate/deactivate)
async function toggleCommentStatus(commentId, newStatus) {
    const action = newStatus === 'active' ? 'activate' : 'deactivate';
    const actionConsequence = newStatus === 'active' ? 'revealed to' : 'hidden from';
    
    // Check if the current user is an admin
    if (currentUser && currentUser.status === 'admin') {
        message = `Are you sure you want to ${action} this comment? This action affects the comment's visibility for all users.`;
    } else {
        message = `Are you sure you want to ${action} your comment? It will be ${actionConsequence} all users.`;
    }

    if (!confirm(message)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/comments/${commentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            // Reload the question to update comments list
            showQuestion(currentPostId, false);
        } else {
            const error = await response.json();
            alert(error.message || `Failed to ${action} comment`);
        }
    } catch (error) {
        console.error(`Failed to ${action} comment:`, error);
        alert(`Failed to ${action} comment`);
    }
}

async function votePost(postId, type) {
    try {
        const response = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type }),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            const result = await response.json();
            showQuestion(postId, false);
        } else {
            const error = await response.json();
            // Show specific error message for locked posts
            if (error.message.includes('locked')) {
                alert('This post is locked and cannot be voted on.');
            } else {
                alert(error.message || 'Failed to vote');
            }
        }
    } catch (error) {
        console.error('Failed to vote:', error);
        alert('Failed to vote');
    }
}

async function submitComment() {
    if (!currentPostId) return;
    
    const content = document.getElementById('comment-input').value.trim();
    if (!content) return;

    try {
        const response = await fetch(`/api/posts/${currentPostId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            document.getElementById('comment-input').value = '';
            showQuestion(currentPostId, false);
        } else {
            const error = await response.json();
            // Show specific error message for locked posts
            if (error.message.includes('locked')) {
                alert('This post is locked and new comments cannot be added.');
            } else {
                alert(error.message || 'Failed to post comment');
            }
        }
    } catch (error) {
        console.error('Failed to post comment:', error);
        alert('Failed to post comment');
    }
}

function showNewPostForm() {
    document.getElementById('new-post-form').style.display = 'block';
}

function hideNewPostForm() {
    document.getElementById('new-post-form').style.display = 'none';
    document.getElementById('post-form').reset();
}

// Function to load likes data for tooltip
async function loadLikesForTooltip(type, id) {
    try {
        const response = await fetch(`/api/${type}s/${id}/like`, { credentials: 'same-origin' });
        if (response.ok) {
            const data = await response.json();
            return data;
        }
        throw new Error('Failed to fetch likes');
    } catch (error) {
        console.error('Failed to load likes:', error);
        throw error;
    }
}

// Function to render tooltip content
function renderTooltipContent(likes) {
    if (!likes || likes.length === 0) {
        return '<div class="tooltip-loading">No votes yet</div>';
    }

    const likeUsers = likes.filter(like => like.type === 'like');
    const dislikeUsers = likes.filter(like => like.type === 'dislike');

    let content = '';

    if (likeUsers.length > 0) {
        content += `
            <div class="tooltip-section">
                <div class="tooltip-title">Liked by (${likeUsers.length}):</div>
                <div class="tooltip-users">
                    ${likeUsers.map(user => user.author_login || 'Unknown').join(', ')}
                </div>
            </div>
        `;
    }

    if (dislikeUsers.length > 0) {
        content += `
            <div class="tooltip-section">
                <div class="tooltip-title dislikes">Disliked by (${dislikeUsers.length}):</div>
                <div class="tooltip-users">
                    ${dislikeUsers.map(user => user.author_login || 'Unknown').join(', ')}
                </div>
            </div>
        `;
    }

    return content || '<div class="tooltip-loading">No votes</div>';
}

// Initialize tooltips
function initializeTooltips() {
    const tooltipElements = document.querySelectorAll('.rating-hover:not(.tooltip-initialized)');
    
    tooltipElements.forEach(element => {
        element.classList.add('tooltip-initialized');
        let tooltipLoaded = false;
        
        element.addEventListener('mouseenter', async function() {
            if (tooltipLoaded) return;
            
            const type = this.dataset.type;
            const id = this.dataset.id;
            const tooltip = this.nextElementSibling;
            
            try {
                const data = await loadLikesForTooltip(type, id);
                tooltip.innerHTML = renderTooltipContent(data.likes);
                tooltipLoaded = true;
            } catch (error) {
                tooltip.innerHTML = '<div class="tooltip-loading">Failed to load votes</div>';
                console.error('Failed to load likes:', error);
            }
        });
    });
}

async function loadStats() {
    try {
        // Fetch the total number of questions
        const postsResponse = await fetch('/api/posts', { credentials: 'same-origin' });
        if (postsResponse.ok) {
            const postsData = await postsResponse.json();
            document.getElementById('total-questions').textContent = postsData.pagination.totalItems;
        } else {
            document.getElementById('total-questions').textContent = '-';
        }

        // Fetch the total number of users
        const usersResponse = await fetch('/api/users/count', { credentials: 'same-origin' });
        if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            document.getElementById('total-users').textContent = usersData.totalUsers;
        } else {
            document.getElementById('total-users').textContent = '-';
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
        document.getElementById('total-users').textContent = '-';
        document.getElementById('total-questions').textContent = '-';
    }
}

function filterByCategory(categoryId) {
    // Prevent any default link behavior by handling this entirely in JS
    event.preventDefault();
    
    // Ensure we're in the main questions view first
    showQuestionsList(false);
    
    // Set the filter
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.value = categoryId;
    }
    currentPage = 1;
    
    // Load posts with the new filter
    loadPosts();
}

async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Handle new post form submission
document.getElementById('post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const selectedCategories = Array.from(document.getElementById('categories-select').selectedOptions)
        .map(option => parseInt(option.value));
    
    const postData = {
        title: formData.get('title'),
        content: formData.get('content'),
        categories: selectedCategories
    };

    try {
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            hideNewPostForm();
            loadPosts(); // Reload posts to show the new one
            alert('Question posted successfully!');
        } else {
            const error = await response.json();
            alert(error.message || 'Failed to post question');
        }
    } catch (error) {
        console.error('Failed to post question:', error);
        alert('Failed to post question');
    }
});