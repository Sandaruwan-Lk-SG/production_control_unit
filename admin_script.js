// --- Configuration ---
const API_URL = "https://backpcu-production.up.railway.app"; 

// --- Auth & Setup ---
window.onload = function() {
    const role = localStorage.getItem('userRole');
    const token = localStorage.getItem('token');
    if (role !== 'admin' || !token) {
        window.location.href = 'index.html';
    } else {
        loadDashboardStats(); // Load numbers
        loadPendingRequests(); // Check for damages
    }
};

function getAuthHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` };
}

// --- Navigation ---
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(sec => sec.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
    
    // Refresh Data based on Tab
    if(sectionId === 'inventory') loadInventory();
    if(sectionId === 'requests') loadPendingRequests();
    if(sectionId === 'reports') loadActivityLogs();
}

function logout() { localStorage.clear(); window.location.href = 'index.html'; }

// --- 1. Dashboard & Inventory ---
async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`, { headers: getAuthHeaders() });
        const data = await res.json();
        
        document.getElementById('totalItems').innerText = data.length;
        document.getElementById('lowStock').innerText = data.filter(i => i.qty < 5).length;
        updateInventoryTable(data);
    } catch (e) { console.error(e); }
}

function updateInventoryTable(data) {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';
    data.forEach(item => {
        let status = item.qty < 5 ? (item.qty <= 0 ? '<span style="color:red">Out</span>' : '<span style="color:orange">Low</span>') : '<span style="color:green">OK</span>';
        tbody.innerHTML += `<tr><td>${item.category}</td><td>${item.item_name}</td><td>${item.size||'-'}</td><td>${item.qty}</td><td>${status}</td></tr>`;
    });
}

// --- 2. Add Item ---
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    // (කලින් කෝඩ් එකම මෙතන තියෙන්න ඕන - මම කෙටි කලා)
    const itemData = {
        item_name: document.getElementById('itemName').value,
        sku: document.getElementById('itemSku').value,
        category: document.getElementById('itemCategory').value,
        size: document.getElementById('itemSize').value
    };
    await fetch(`${API_URL}/api/admin/add-item`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(itemData) });
    alert("Item Added!");
    document.getElementById('addItemForm').reset();
});

// --- 3. Handle Requests (Damage Control) ---
async function loadPendingRequests() {
    // මේක Backend එකේ අලුත් API එකක් ඉල්ලනවා (damage reports). 
    // දැනට අපි ලොග් එකෙන් මේක ෆිල්ටර් කරගන්න හැටි හදමු, නැත්නම් Backend එකට පොඩි කෑල්ලක් දාන්න වෙනවා.
    // සරලව තියාගන්න, අපි Reports table එකෙන් Damage පෙන්නමු.
    
    // NOTE: Backend එකේ අපි 'damage_reports' table එකට වෙනම API එකක් හැදුවේ නෑ නේද?
    // ඒ නිසා අපි 'ADVANCE' stats වලින් දත්ත ගමු.
    
    try {
        const res = await fetch(`${API_URL}/api/admin/stats?type=ADVANCE`, { headers: getAuthHeaders() });
        const logs = await res.json();
        
        // Damage/Shortage විතරක් ෆිල්ටර් කරන්න
        const pending = logs.filter(l => l.action_type === 'DAMAGE' || l.action_type === 'SHORTAGE');
        
        document.getElementById('pendingDamages').innerText = pending.length;
        document.getElementById('reqCount').innerText = pending.length;
        
        const tbody = document.getElementById('requestsTableBody');
        tbody.innerHTML = '';
        
        if(pending.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No Pending Requests</td></tr>';
            return;
        }

        pending.forEach(req => {
            // Note: හරිනම් මෙතන Approve Button එක වැඩ කරන්න ID එක ඕන.
            // දැනට අපි View Only හදමු. 
            tbody.innerHTML += `
                <tr>
                    <td>${new Date(req.timestamp).toLocaleDateString()}</td>
                    <td>${req.item_name_snapshot}</td>
                    <td style="color:red">${req.action_type}</td>
                    <td>${req.qty_changed}</td>
                    <td>${req.user_name}</td>
                    <td>
                        <button class="btn-action btn-approve" onclick="alert('Feature coming soon')">Replace</button>
                        <button class="btn-action btn-reject" onclick="alert('Feature coming soon')">Remove</button>
                    </td>
                </tr>`;
        });
    } catch (e) { console.error(e); }
}

// --- 4. Logs History ---
async function loadActivityLogs() {
    try {
        const res = await fetch(`${API_URL}/api/admin/stats?type=ADVANCE`, { headers: getAuthHeaders() });
        const logs = await res.json();
        
        const tbody = document.getElementById('logsTableBody');
        tbody.innerHTML = '';
        
        logs.forEach(log => {
            let color = log.action_type === 'IN' ? 'green' : (log.action_type === 'OUT' ? 'orange' : 'red');
            tbody.innerHTML += `
                <tr>
                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                    <td>${log.user_name}</td>
                    <td style="color:${color}; font-weight:bold">${log.action_type}</td>
                    <td>${log.item_name_snapshot}</td>
                    <td>${log.qty_changed}</td>
                    <td>${log.line_number || '-'}</td>
                </tr>`;
        });
    } catch (e) { console.error(e); }
}
