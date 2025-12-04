const API_URL = "https://backpcu-production.up.railway.app"; 

// Global Data
let globalInventory = [];
let globalLogs = [];

// --- Init & Live Update ---
window.onload = function() {
    const role = localStorage.getItem('userRole');
    const token = localStorage.getItem('token');

    if (role !== 'admin' || !token) {
        window.location.href = 'index.html';
    } else {
        fetchData(); // Initial Load
        loadPendingRequests(); // Check Damages
        // Live Update every 5 seconds
        setInterval(() => {
            fetchData();
            loadPendingRequests();
        }, 5000);
    }
};

function getAuthHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` };
}

function logout() { localStorage.clear(); window.location.href = 'index.html'; }

// --- Navigation ---
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
    const activeBtn = document.querySelector(`li[onclick="showSection('${id}')"]`);
    if(activeBtn) activeBtn.classList.add('active');

    if(id === 'reports') fetchLogs(); 
    if(id === 'inventory') renderInventoryTable(globalInventory);
}

// --- 1. CORE DATA & DASHBOARD ---
async function fetchData() {
    try {
        const res = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`, { headers: getAuthHeaders() });
        if(!res.ok) return;
        
        globalInventory = await res.json();
        
        // Update Cards
        document.getElementById('totalItems').innerText = globalInventory.length;
        document.getElementById('lowStock').innerText = globalInventory.filter(i => i.qty < 5 && i.qty > 0).length;

        // Only update table if we are in 'inventory' or 'overview' and not filtered
        if(document.getElementById('inventory').style.display === 'block') {
             renderInventoryTable(globalInventory);
        }
    } catch (e) { console.error("Live Update Error", e); }
}

function filterDashboard(type, card) {
    showSection('inventory'); // Switch to table view
    let data = globalInventory;
    if (type === 'LOW') data = globalInventory.filter(i => i.qty < 5 && i.qty > 0);
    renderInventoryTable(data);
}

function renderInventoryTable(data) {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';
    data.forEach(item => {
        let status = item.qty <= 0 ? '<span style="color:red">Out</span>' : 
                     (item.qty < 5 ? '<span style="color:orange">Low</span>' : '<span style="color:#00e676">In Stock</span>');
        tbody.innerHTML += `<tr><td>${item.category}</td><td>${item.item_name}</td><td>${item.size||'-'}</td><td>${item.qty}</td><td>${status}</td></tr>`;
    });
}

// --- 2. ADD ITEM ---
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const oldText = btn.innerText;
    btn.innerText = "Saving...";

    const itemData = {
        item_name: document.getElementById('itemName').value,
        sku: document.getElementById('itemSku').value,
        category: document.getElementById('itemCategory').value,
        size: document.getElementById('itemSize').value
    };

    try {
        const res = await fetch(`${API_URL}/api/admin/add-item`, { 
            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(itemData) 
        });
        const result = await res.json();

        if (res.ok) {
            alert("✅ " + result.message);
            document.getElementById('addItemForm').reset();
            fetchData();
        } else {
            alert("⚠️ " + result.error);
        }
    } catch (e) { alert("Server Error"); }
    btn.innerText = oldText;
});

// --- 3. REQUESTS (DAMAGES) ---
async function loadPendingRequests() {
    try {
        const res = await fetch(`${API_URL}/api/admin/stats?type=DAMAGES`, { headers: getAuthHeaders() });
        const reqs = await res.json();
        
        document.getElementById('reqCount').innerText = reqs.length;
        document.getElementById('pendingDamages').innerText = reqs.length;
        
        const tbody = document.getElementById('requestsTableBody');
        tbody.innerHTML = '';
        
        if(reqs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No Pending Issues</td></tr>';
            return;
        }

        reqs.forEach(r => {
            const type = r.damage_type === 'DAMAGE' ? '<b style="color:red">DAMAGE</b>' : '<b style="color:orange">SHORTAGE</b>';
            tbody.innerHTML += `
                <tr>
                    <td>${new Date(r.reported_at).toLocaleDateString()}</td>
                    <td>${r.item_name}</td>
                    <td>${type}</td>
                    <td>${r.damage_qty}</td>
                    <td>${r.reported_by}</td>
                    <td>
                        <button class="btn-action btn-approve" onclick="resolveIssue(${r.id}, 'REPLACE')">Replace</button>
                        <button class="btn-action btn-reject" onclick="resolveIssue(${r.id}, 'REMOVE')">Remove</button>
                    </td>
                </tr>`;
        });
    } catch (e) { console.error(e); }
}

async function resolveIssue(id, decision) {
    if(!confirm(`Confirm ${decision}?`)) return;
    try {
        const res = await fetch(`${API_URL}/api/admin/resolve-damage`, {
            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ report_id: id, decision })
        });
        if(res.ok) { alert("Done!"); loadPendingRequests(); fetchData(); }
        else alert("Error");
    } catch(e) { alert("Error"); }
}

// --- 4. REPORTS ---
async function fetchLogs() {
    try {
        const res = await fetch(`${API_URL}/api/admin/stats?type=ADVANCE`, { headers: getAuthHeaders() });
        globalLogs = await res.json();
        generateNormalReport();
    } catch(e) { console.error(e); }
}

function switchReport(type) {
    document.querySelectorAll('.report-view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`report-${type}`).style.display = 'block';
    event.target.classList.add('active');
    
    if(type === 'normal') generateNormalReport();
    if(type === 'advance') generateAdvanceReport();
}

function generateNormalReport() {
    const container = document.getElementById('normalReportContent');
    container.innerHTML = '';
    const cats = {};
    globalInventory.forEach(i => {
        if(!cats[i.category]) cats[i.category] = [];
        cats[i.category].push(i);
    });

    for (const [cat, items] of Object.entries(cats)) {
        let html = `<h4 style="color:#23a2f6; margin-top:10px; border-bottom:1px solid #555;">${cat}</h4><table class="glass-table" style="width:100%">`;
        items.forEach(i => html += `<tr><td width="60%">${i.item_name}</td><td>Qty: <strong>${i.qty}</strong></td></tr>`);
        html += `</table>`;
        container.innerHTML += html;
    }
}

function generateAdvanceReport() {
    const tbody = document.getElementById('advanceReportTable');
    tbody.innerHTML = '';
    globalLogs.forEach(l => {
        let c = l.action_type === 'IN' ? 'green' : (l.action_type === 'OUT' ? 'orange' : 'red');
        tbody.innerHTML += `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td style="color:${c}">${l.action_type}</td><td>${l.item_name_snapshot}</td><td>${l.qty_changed}</td><td>${l.user_name}</td></tr>`;
    });
}

function searchItemHistory() {
    const q = document.getElementById('historySearchInput').value.toLowerCase();
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    if(q.length < 2) return;

    const matches = globalLogs.filter(l => l.item_name_snapshot.toLowerCase().includes(q));
    matches.forEach(l => {
        tbody.innerHTML += `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td>${l.action_type}</td><td>${l.qty_changed}</td><td>${l.user_name}</td></tr>`;
    });
}
