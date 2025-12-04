// ඔයාගේ Backend Link එක
const API_URL = "https://backpcu-production.up.railway.app"; 

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameIn = document.getElementById('username').value;
    const passwordIn = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    const loginBtn = document.getElementById('loginBtn');

    // Button Animation
    loginBtn.innerText = "Checking...";
    loginBtn.style.opacity = "0.7";
    errorMsg.innerText = "";

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: usernameIn, password: passwordIn })
        });

        const data = await response.json();

        if (response.ok) {
            // ✅ Login Success!

            // 1. Token එක සහ විස්තර Save කරගන්න (ඉතා වැදගත්)
            localStorage.setItem('token', data.token); 
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('username', data.username);

            // 2. Role එක අනුව පිටුව මාරු කරන්න
            if(data.role === 'admin') {
                window.location.href = 'admin_dashboard.html';
            } else {
                window.location.href = 'user_dashboard.html';
            }
        } else {
            // Login Failed
            errorMsg.innerText = data.error || "Login Failed!";
            resetButton();
        }

    } catch (err) {
        console.error(err);
        errorMsg.innerText = "Server Connection Error!";
        resetButton();
    }

    function resetButton() {
        loginBtn.innerText = "Log In";
        loginBtn.style.opacity = "1";
    }
});
