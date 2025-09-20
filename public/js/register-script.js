const form = document.getElementById('registerForm');
const message = document.getElementById('message');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        login: form.elements['login'].value,
        password: form.elements['password'].value,
        confirmPassword: form.elements['confirmPassword'].value,
        full_name: form.elements['full_name'].value,
        email: form.elements['email'].value
    };

    const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    });

    const data = await response.json();
    message.textContent = data.message;
});