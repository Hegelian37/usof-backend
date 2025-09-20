const form = document.getElementById('loginForm');
const message = document.getElementById('message');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = form.elements['login'].value;
    const password = form.elements['password'].value;

    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password })
    });

    const data = await response.json();
    message.textContent = data.message;

    if (response.ok) {
        // Redirect on successful login
        window.location.href = '/main.html';
    }
});