let currentUser = null;

// Helper function to get profile picture URL
function getProfilePictureUrl(profilePicture, fallbackLogin) {
    if (profilePicture) {
        if (profilePicture.startsWith('http')) {
            return profilePicture;
        }
        return `/uploads/profile_pictures/${profilePicture}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackLogin || 'User')}&background=0D8ABC&color=fff&size=120`;
}

// Logout function
function doLogout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        .then(() => {
            window.location.href = '/login.html';
        })
        .catch(err => console.error(err));
}

// Show message function
function showMessage(text, type = 'success') {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = '';
    }, 5000);
}

// Load user data
async function loadUserData() {
    try {
        // Get current user from session
        const sessionResponse = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'same-origin'
        });

        if (!sessionResponse.ok) {
            throw new Error('Not authenticated');
        }

        const sessionData = await sessionResponse.json();
        const userId = sessionData.userId;

        // Fetch detailed user data
        const userResponse = await fetch(`/api/users/${userId}`, {
            method: 'GET',
            credentials: 'same-origin'
        });

        if (!userResponse.ok) {
            throw new Error('Failed to load user data');
        }

        const userData = await userResponse.json();
        currentUser = userData.user;

        document.getElementById('header-user-rating').textContent = currentUser.rating || 0;
        
        // Update UI
        document.getElementById('header-username').textContent = currentUser.full_name || currentUser.login;
        document.getElementById('username').textContent = currentUser.login;
        document.getElementById('full-name').textContent = currentUser.full_name || 'Not set';
        document.getElementById('email').textContent = currentUser.email;
        document.getElementById('status').textContent = currentUser.status;
        document.getElementById('user-rating').textContent = currentUser.rating || 0;
        document.getElementById('posts-count').textContent = currentUser.posts_count || 0;
        document.getElementById('comments-count').textContent = currentUser.comments_count || 0;
        document.getElementById('member-since').textContent = new Date(currentUser.created_at).toLocaleDateString();
        
        // Update profile picture
        const profilePicUrl = getProfilePictureUrl(currentUser.profile_picture, currentUser.login);
        document.getElementById('current-profile-pic').src = profilePicUrl;
        
        // Show remove button if user has a custom profile picture
        if (currentUser.profile_picture) {
            document.getElementById('remove-picture-btn').style.display = 'inline-block';
        }
        
        // Show admin panel if user is admin
        if (currentUser.status === 'admin') {
            document.getElementById('admin-panel').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error loading user data:', error);
        showMessage('Failed to load user data. Redirecting to login...', 'error');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
    }
}

// Name display - replace legacy stuff
document.getElementById('profile-picture-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    let displayElement = document.querySelector('.file-name-display');
    
    // Create display element if it doesn't exist
    if (!displayElement) {
        displayElement = document.createElement('div');
        displayElement.className = 'file-name-display';
        e.target.parentNode.parentNode.appendChild(displayElement);
    }
    
    if (file) {
        displayElement.textContent = `Selected: ${file.name}`;
        displayElement.style.display = 'block';
    } else {
        displayElement.style.display = 'none';
    }
});

// Open edit modal
function openEditModal() {
    if (!currentUser) return;
    
    // Populate form with current data
    document.getElementById('edit-full-name').value = currentUser.full_name || '';
    document.getElementById('edit-email').value = currentUser.email || '';
    
    // Reset password fields
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    
    // Show modal
    document.getElementById('edit-profile-modal').style.display = 'block';
}

// Close edit modal
function closeEditModal() {
    document.getElementById('edit-profile-modal').style.display = 'none';
}

// Handle edit profile form submission
// Handle edit profile form submission - QUICK FRONTEND FIX
document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    // Get basic info
    data.full_name = formData.get('full_name');
    data.email = formData.get('email');
    
    // Handle password change - only if fields are filled
    const currentPassword = formData.get('current_password');
    const newPassword = formData.get('new_password');
    const confirmPassword = formData.get('confirm_password');
    
    // Check if user wants to change password
    if (currentPassword || newPassword || confirmPassword) {
        if (!currentPassword || !newPassword || !confirmPassword) {
            showMessage('All password fields are required when changing password', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showMessage('New passwords do not match', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            showMessage('New password must be at least 6 characters long', 'error');
            return;
        }
        
        // QUICK FIX: Send both field name formats to match backend expectations
        data.password = newPassword;  // What backend currently expects
        data.confirmPassword = confirmPassword;  // For backend validation
        data.current_password = currentPassword;  // For future backend validation
    }
    
    try {
        const response = await fetch(`/api/users/${currentUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            const updatedData = await response.json();
            showMessage('Profile updated successfully!');
            
            // Update current user data
            currentUser.full_name = data.full_name;
            currentUser.email = data.email;
            
            // Update UI
            document.getElementById('header-username').textContent = currentUser.full_name || currentUser.login;
            document.getElementById('full-name').textContent = currentUser.full_name || 'Not set';
            document.getElementById('email').textContent = currentUser.email;
            
            // Close modal
            closeEditModal();
        } else {
            const error = await response.json();
            console.error('Server error response:', error);
            showMessage(error.message || 'Failed to update profile', 'error');
        }
    } catch (error) {
        console.error('Update error:', error);
        showMessage('Failed to update profile', 'error');
    }
});

// Handle profile picture upload
document.getElementById('profile-pic-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('profile-picture-input');
    const file = fileInput.files[0];
    let displayElement = document.querySelector('.file-name-display');
    
    if (!file) {
        showMessage('Please select a file', 'error');
        return;
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showMessage('File too large. Maximum size is 5MB.', 'error');
        return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        showMessage('Invalid file type. Please upload JPEG, JPG, PNG, or GIF images only.', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('profile_picture', file);
    
    try {
        const response = await fetch('/api/users/pfp', {
            method: 'PATCH',
            body: formData,
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            const data = await response.json();
            showMessage('Profile picture updated successfully!');
            
            // Update the profile picture display
            const newProfilePicUrl = getProfilePictureUrl(data.profile_picture, currentUser.login);
            document.getElementById('current-profile-pic').src = newProfilePicUrl;
            
            // Show remove button
            document.getElementById('remove-picture-btn').style.display = 'inline-block';
            
            // Clear file input
            fileInput.value = '';
            
            // Update current user data
            currentUser.profile_picture = data.profile_picture;
            
            // Remove the selected tip
            displayElement.style.display = 'none';
        } else {
            const error = await response.json();
            showMessage(error.message || 'Failed to upload profile picture', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showMessage('Failed to upload profile picture', 'error');
    }
});

// Handle profile picture removal
document.getElementById('remove-picture-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to remove your profile picture?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${currentUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile_picture: null }),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            showMessage('Profile picture removed successfully!');
            
            // Update the profile picture display to default
            const defaultProfilePicUrl = getProfilePictureUrl(null, currentUser.login);
            document.getElementById('current-profile-pic').src = defaultProfilePicUrl;
            
            // Hide remove button
            document.getElementById('remove-picture-btn').style.display = 'none';
            
            // Update current user data
            currentUser.profile_picture = null;
        } else {
            const error = await response.json();
            showMessage(error.message || 'Failed to remove profile picture', 'error');
        }
    } catch (error) {
        console.error('Remove error:', error);
        showMessage('Failed to remove profile picture', 'error');
    }
});

// Edit profile button event listener
document.getElementById('edit-profile-btn').addEventListener('click', openEditModal);

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('edit-profile-modal')) {
        closeEditModal();
    }
});

// Close modal with escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeEditModal();
    }
});

// Initialize page
document.addEventListener('DOMContentLoaded', loadUserData);