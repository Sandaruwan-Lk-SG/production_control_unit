// ඔයාගේ Railway URL එක මෙතනට දාන්න (අවසානයේ / ස්ලෑෂ් එක නැතුව)
// ඔයාගේ Backend Link එක
const API_URL = "https://backpcu-production.up.railway.app"; 

document.getElementById('loginForm').addEventListener('submit', async (e) => {
@@ -9,9 +9,10 @@ document.getElementById('loginForm').addEventListener('submit', async (e) => {
    const errorMsg = document.getElementById('errorMsg');
    const loginBtn = document.getElementById('loginBtn');

    // Button Animation (Loading...)
    // Button Animation
    loginBtn.innerText = "Checking...";
    loginBtn.style.opacity = "0.7";
    errorMsg.innerText = "";

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
@@ -25,29 +26,32 @@ document.getElementById('loginForm').addEventListener('submit', async (e) => {
        const data = await response.json();

        if (response.ok) {
            // Login සාර්ථකයි!
            // Token එක අපි HTTPOnly Cookie එකක් විදියට Server එකෙන් එවන නිසා 
            // මෙතන අමුතුවෙන් Save කරන්න දෙයක් නෑ.
            
            // Role එක අනුව පිටුව මාරු කිරීම (අපි ඊළඟට හදන පිටුවලට)
            localStorage.setItem('userRole', data.role); // Role එක විතරක් මතක තියාගමු UI වෙනස්කම් වලට
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
            // Login අසාර්ථකයි
            // Login Failed
            errorMsg.innerText = data.error || "Login Failed!";
            loginBtn.innerText = "Log In";
            loginBtn.style.opacity = "1";
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
