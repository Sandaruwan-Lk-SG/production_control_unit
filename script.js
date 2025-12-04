// ඔයාගේ Railway URL එක මෙතනට දාන්න (අවසානයේ / ස්ලෑෂ් එක නැතුව)
const API_URL = "https://backpcu-production.up.railway.app"; 

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameIn = document.getElementById('username').value;
    const passwordIn = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    const loginBtn = document.getElementById('loginBtn');

    // Button Animation (Loading...)
    loginBtn.innerText = "Checking...";
    loginBtn.style.opacity = "0.7";

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
            // Login සාර්ථකයි!
            // Token එක අපි HTTPOnly Cookie එකක් විදියට Server එකෙන් එවන නිසා 
            // මෙතන අමුතුවෙන් Save කරන්න දෙයක් නෑ.
            
            // Role එක අනුව පිටුව මාරු කිරීම (අපි ඊළඟට හදන පිටුවලට)
            localStorage.setItem('userRole', data.role); // Role එක විතරක් මතක තියාගමු UI වෙනස්කම් වලට
            localStorage.setItem('username', data.username);

            if(data.role === 'admin') {
                window.location.href = 'admin_dashboard.html';
            } else {
                window.location.href = 'user_dashboard.html';
            }
        } else {
            // Login අසාර්ථකයි
            errorMsg.innerText = data.error || "Login Failed!";
            loginBtn.innerText = "Log In";
            loginBtn.style.opacity = "1";
        }

    } catch (err) {
        console.error(err);
        errorMsg.innerText = "Server Connection Error!";
        loginBtn.innerText = "Log In";
        loginBtn.style.opacity = "1";
    }
});
