// --- CONFIGURATION ---
// ඔබේ Railway Backend Link එක
const API_URL = "https://backpcu-production.up.railway.app"; 

// --- LOGIN EVENT LISTENER ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Page refresh වීම නවත්වයි

    // Input අගයන් ලබා ගැනීම
    const usernameIn = document.getElementById('username').value;
    const passwordIn = document.getElementById('password').value;
    
    // UI Elements
    const errorMsg = document.getElementById('errorMsg');
    const loginBtn = document.getElementById('loginBtn');

    // 1. බොත්තම වෙනස් කිරීම (Loading Effect)
    loginBtn.innerText = "Checking...";
    loginBtn.style.opacity = "0.7";
    loginBtn.disabled = true;
    errorMsg.innerText = "";

    try {
        // 2. Backend එකට Request යැවීම
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username: usernameIn, 
                password: passwordIn 
            })
        });

        const data = await response.json();

        if (response.ok) {
            // ✅ Login සාර්ථකයි!

            // A. Token සහ විස්තර LocalStorage හි Save කරගන්න
            localStorage.setItem('token', data.token); 
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('username', data.username);

            // B. Role එක අනුව පිටුව මාරු කිරීම
            if(data.role === 'admin') {
                window.location.href = 'admin_dashboard.html';
            } else {
                window.location.href = 'user_dashboard.html';
            }
        } else {
            // ❌ Login අසාර්ථකයි (වැරදි Password/Username)
            errorMsg.innerText = data.error || "Login Failed!";
            resetButton();
        }

    } catch (err) {
        // Server එක හෝ Internet අවුලක් නම්
        console.error("Login Error:", err);
        errorMsg.innerText = "Server Connection Error!";
        resetButton();
    }

    // බොත්තම යථා තත්වයට පත් කිරීම
    function resetButton() {
        loginBtn.innerText = "Log In";
        loginBtn.style.opacity = "1";
        loginBtn.disabled = false;
    }
});
