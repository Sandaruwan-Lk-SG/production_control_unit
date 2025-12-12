// script.js (enhanced)
// --- CONFIGURATION ---
const API_URL = "https://finalbackendpcu-production.up.railway.app";

// --- HELPERS ---
const byId = (id) => document.getElementById(id);
const errorMsgEl = byId('errorMsg');
const loginBtn = byId('loginBtn');
const usernameEl = byId('username');
const passwordEl = byId('password');

function showError(message) {
  errorMsgEl.innerText = message;
  errorMsgEl.classList.add('visible');
  // a11y: ensure screen readers announce it
  errorMsgEl.setAttribute('role', 'alert');
  errorMsgEl.focus?.();
}

function hideError() {
  errorMsgEl.innerText = '';
  errorMsgEl.classList.remove('visible');
  errorMsgEl.removeAttribute('role');
}

function setBusy(isBusy) {
  if (isBusy) {
    loginBtn.disabled = true;
    loginBtn.setAttribute('aria-busy', 'true');
    loginBtn.dataset.orig = loginBtn.innerText;
    loginBtn.innerText = 'Checking…';
    loginBtn.style.opacity = '0.7';
  } else {
    loginBtn.disabled = false;
    loginBtn.removeAttribute('aria-busy');
    loginBtn.innerText = loginBtn.dataset.orig || 'Log In';
    loginBtn.style.opacity = '1';
  }
}

function resetOnFail() {
  setBusy(false);
  // clear password for safety & focus it for retry
  passwordEl.value = '';
  passwordEl.focus();
}

// small wrapper to parse JSON safely
async function tryParseJSON(response) {
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return response.json().catch(() => null);
  }
  return null;
}

// --- LOGIN HANDLER ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const usernameIn = usernameEl.value.trim();
  const passwordIn = passwordEl.value;

  if (!usernameIn || !passwordIn) {
    showError('Please enter Username & Password');
    return;
  }

  setBusy(true);

  // setup fetch timeout
  const controller = new AbortController();
  const timeoutMs = 10000; // 10s
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({ username: usernameIn, password: passwordIn })
    });

    clearTimeout(timeoutId);
    const data = await tryParseJSON(res);

    if (res.ok) {
      // success path
      // validate presence of token (defensive)
      if (!data || !data.token) {
        showError('Server response malformed. Contact admin.');
        resetOnFail();
        return;
      }

      // Save session info (consider HttpOnly cookies server-side for higher security)
      localStorage.setItem('token', data.token);
      if (data.role) localStorage.setItem('userRole', data.role);
      if (data.username) localStorage.setItem('username', data.username);

      // redirect according to role (safe fallback)
      const role = data.role || localStorage.getItem('userRole') || 'user';
      if (role === 'admin') {
        window.location.href = 'admin_dashboard.html';
      } else {
        window.location.href = 'user_dashboard.html';
      }
    } else {
      // handle common failure codes with friendly messages
      switch (res.status) {
        case 400:
          // Bad Request (validation)
          showError((data && (data.error || data.message)) || 'Invalid request. Check input.');
          break;
        case 401:
        case 403:
          // Unauthorized / Forbidden -> wrong credentials
          showError('Username හෝ Password වැරදියි. කරුණාකර නැවත උත්සාහ කරන්න.');
          break;
        case 429:
          showError('Too many attempts. Please wait a moment and try again.');
          break;
        case 500:
        default:
          showError((data && (data.error || data.message)) || 'Server error. Please try again later.');
      }
      resetOnFail();
    }
  } catch (err) {
    clearTimeout(timeoutId);
    // distinguish abort (timeout) from network errors
    if (err.name === 'AbortError') {
      showError('Request timed out. Check your internet connection and try again.');
    } else {
      console.error('Login Error:', err);
      showError('Connection Error! Check Internet.');
    }
    resetOnFail();
  }
});
