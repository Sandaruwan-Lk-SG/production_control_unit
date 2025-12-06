// ... (කලින් තිබ්බ API_URL සහ Data Fetching කෑලි එහෙමම තියන්න) ...
const API_URL = "https://backpcu-production.up.railway.app"; 
let globalInventory = [];

window.onload = function() {
    if (!localStorage.getItem('token') || localStorage.getItem('userRole') !== 'admin') {
        window.location.href = 'index.html';
    } else {
        fetchData();
        setInterval(fetchData, 5000); 
    }
};

// --- PORTAL ANIMATION LOGIC (NEW) ---
function enterPortal(tabId) {
    const portal = document.getElementById('portal-view');
    const dashboard = document.getElementById('dashboard-interface');

    // 1. Add Zoom Class (Animation Starts)
    portal.classList.add('portal-zoom-active');

    // 2. Wait 0.8s, then switch views
    setTimeout(() => {
        portal.style.display = 'none'; // Hide Portal completely
        dashboard.style.display = 'flex'; // Show Dashboard
        
        // Small delay to fade in dashboard
        setTimeout(() => { dashboard.style.opacity = '1'; }, 50);
        
        // Open the requested tab
        switchTab(tabId);
    }, 800);
}

function exitPortal() {
    const portal = document.getElementById('portal-view');
    const dashboard = document.getElementById('dashboard-interface');

    // 1. Hide Dashboard
    dashboard.style.opacity = '0';
    
    setTimeout(() => {
        dashboard.style.display = 'none';
        portal.style.display = 'flex'; // Show Portal
        
        // 2. Remove Zoom Class (Animation Reverses/Resets)
        setTimeout(() => {
            portal.classList.remove('portal-zoom-active');
        }, 50);
    }, 500);
}

// ... (පහල තියෙන Helper Functions, Search Logic, Fetch Data එහෙමම තියන්න) ...
// ... (switchTab එකේදී sidebar active වෙන කෑල්ල විතරක් පොඩ්ඩක් බලන්න) ...

function switchTab(id) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById(`tab-${id}`).style.display = 'block';
    
    // Sidebar update
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
    const btn = document.getElementById(`nav-${id}`);
    if(btn) btn.classList.add('active');

    if(id === 'inventory') renderInventorySummary('');
    // ...
}

// ... (ඉතුරු JS කෝඩ් එක මම කලින් දුන්න එකමයි - Search, Add Item, Reports, etc.) ...
// (කලින් දුන්න ෆුල් කෝඩ් එකේ පහල ටික මෙතනට පේස්ට් කරන්න)
