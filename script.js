// --- CONFIGURATION ---
const API_URL = "https://backpcu-production.up.railway.app"; 

// --- LOGIN EVENT LISTENER ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 

    // 1. Input ලබා ගැනීම සහ සුද්ද කිරීම (Mobile Space Fix)
    // .trim() මගින් නමේ අගට හෝ මුලට වැරදීමකින් වැදුණු Space ඉවත් කරයි.
    const usernameIn = document.getElementById('username').value.trim();
    const passwordIn = document.getElementById('password').value.trim();
    
    // UI Elements
    const errorMsg = document.getElementById('errorMsg');
    const loginBtn = document.getElementById('loginBtn');

    // Validation (හිස් නම් යවන්න එපා)
    if (!usernameIn || !passwordIn) {
        errorMsg.innerText = "Please enter Username & Password";
        return;
    }

    // Button Loading Animation
    loginBtn.innerText = "Checking...";
    loginBtn.style.opacity = "0.7";
    loginBtn.disabled = true;
    errorMsg.innerText = "";

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Cookie සහ Security දත්ත හුවමාරු කිරීමට මෙය වැදගත්
            credentials: 'include', 
            body: JSON.stringify({ 
                username: usernameIn, 
                password: passwordIn 
            })
        });

        // Response එක JSON ද බලන්න (Server Error වලදී HTML එන්න පුළුවන් නිසා)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Server Error (Not JSON)");
        }

        const data = await response.json();

        if (response.ok) {
            // ✅ Login සාර්ථකයි!
            
            // Token සහ විස්තර Save කරගන්න
            localStorage.setItem('token', data.token); 
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('username', data.username);

            // පිටුව මාරු කිරීම
            if(data.role === 'admin') {
                window.location.href = 'admin_dashboard.html';
            } else {
                window.location.href = 'user_dashboard.html';
            }
        } else {
            // ❌ Login අසාර්ථකයි
            errorMsg.innerText = data.error || "Login Failed! Check credentials.";
            resetButton();
        }

    } catch (err) {
        console.error("Login Error:", err);
        errorMsg.innerText = "Connection Error! Check Internet.";
        resetButton();
    }

    function resetButton() {
        loginBtn.innerText = "Log In";
        loginBtn.style.opacity = "1";
        loginBtn.disabled = false;
    }
});
