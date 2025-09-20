const form = document.getElementById('resetForm');
const message = document.getElementById('message');

// Get the token from the URL path
const pathParts = window.location.pathname.split('/');
const token = pathParts[pathParts.length - 1];

if (!token) {
    message.textContent = 'Invalid reset link.';
    message.style.color = 'red';
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = form.elements['password'].value;
    const confirmPassword = form.elements['confirmPassword'].value;

    if (password !== confirmPassword) {
        message.textContent = 'Passwords do not match.';
        message.style.color = 'red';
        return;
    }

    if (password.length < 6) {
        message.textContent = 'Password must be at least 6 characters long.';
        message.style.color = 'red';
        return;
    }

    try {
        const response = await fetch(`/api/auth/password-reset/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, confirmPassword })
        });

        const data = await response.json();
        
        if (response.ok) {
            message.textContent = data.message + ' Redirecting to login...';
            message.style.color = 'green';
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = '/login.html?reset=success';
            }, 2000);
        } else {
            message.textContent = data.message;
            message.style.color = 'red';
        }
    } catch (error) {
        message.textContent = 'An error occurred. Please try again.';
        message.style.color = 'red';
    }
});

// Check if token is valid when page loads
window.addEventListener('load', () => {
    if (!token) {
        message.textContent = 'Invalid or expired reset link.';
        message.style.color = 'red';
        form.style.display = 'none';
    }
});