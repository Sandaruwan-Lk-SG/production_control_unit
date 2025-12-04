const API_URL = "https://backpcu-production.up.railway.app"; 

// Data Cache
let globalInventory = [];
let globalLogs = [];
let selectedRepItemName = ''; // For specific item report

// --- INIT ---
window.onload = function() {
    if (localStorage.getItem('userRole') !== 'admin' || !localStorage.getItem('token')) {
        window.location.href = 'index.html';
    } else {
        fetchData(); // Initial Load
        setInterval(fetchData, 5000); // Live Update
    }
};

function getHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }; }
function logout() { localStorage.clear(); window.location.href = 'index.html'; }
function switchTab(id) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById(`tab-${id}`).style.display = 'block';
    if(id === 'reports') fetchLogs(); 
}

// --- CORE DATA ---
async function fetchData() {
    try {
        const resInv = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`, { headers: getHeaders() });
        globalInventory = await resInv.json();

        const resDmg = await fetch(`${API_URL}/api/admin/stats?type=DAMAGES`, { headers: getHeaders() });
        const damages = await resDmg.json();

        updateUI(globalInventory, damages);
    } catch (e) { console.error(e); }
}

function updateUI(inv, dmg) {
    // Stats
    document.getElementById('statTotal').innerText = inv.length;
    document.getElementById('statLow').innerText = inv.filter(i => i.qty < 5 && i.qty > 0).length;
    document.getElementById('statReq').innerText = dmg.length;

    // Damage Table
    const dTable = document.getElementById('damageTable');
    dTable.innerHTML = '';
    dmg.forEach(d => {
        dTable.innerHTML += `<tr><td>${new Date(d.reported_at).toLocaleDateString()}</td><td>${d.item_name}</td><td>${d.damage_type}</td><td>${d.damage_qty}</td><td>${d.reported_by}</td>
        <td><button class="btn-action btn-approve" onclick="resolve(${d.id},'REPLACE')">Replace</button><button class="btn-action btn-reject" onclick="resolve(${d.id},'REMOVE')">Remove</button></td></tr>`;
    });

    // Inventory Table
    const iTable = document.getElementById('inventoryTable');
    if(document.getElementById('tab-inventory').style.display === 'block') {
        iTable.innerHTML = '';
        inv.forEach(i => {
            let status = i.qty <= 0 ? 'Out' : (i.qty < 5 ? 'Low' : 'Ok');
            iTable.innerHTML += `<tr><td>${i.category}</td><td>${i.item_name}</td><td>${i.size||'-'}</td><td>${i.qty}</td><td>${status}</td>
            <td><button onclick="manualUpdate(${i.id}, ${i.qty})" class="btn-action">Edit</button></td></tr>`;
        });
    }
}

// --- 1. SMART SEARCH LOGIC (Reusable) ---
function setupSmartSearch(inputId, dropdownId, onSelect) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    input.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        dropdown.innerHTML = '';
        if(val.length < 1) { dropdown.style.display = 'none'; return; }

        const matches = globalInventory.filter(i => i.item_name.toLowerCase().includes(val) || (i.sku && i.sku.toLowerCase().includes(val)));
        
        if(matches.length > 0) {
            dropdown.style.display = 'block';
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'dropdown-item';
                div.innerHTML = `${m.item_name} <small>(${m.category})</small>`;
                div.onclick = () => {
                    input.value = m.item_name;
                    dropdown.style.display = 'none';
                    onSelect(m);
                };
                dropdown.appendChild(div);
            });
        } else { dropdown.style.display = 'none'; }
    });
}

// Setup searches for Operations & Reports
setupSmartSearch('opSearch', 'opDropdown', (item) => {
    document.getElementById('selectedItemId').value = item.id;
});
setupSmartSearch('repItemSearch', 'repDropdown', (item) => {
    selectedRepItemName = item.item_name; // Store for filtering
    loadReport('ITEM'); // Refresh report immediately
});

// --- 2. ADMIN STOCK OPERATIONS (In/Out) ---
async function performStockOp() {
    const id = document.getElementById('selectedItemId').value;
    const type = document.getElementById('opType').value;
    const qty = document.getElementById('opQty').value;
    
    if(!id || !qty) return alert("Select item and enter quantity");

    // We reuse the existing user APIs but as Admin
    const endpoint = type === 'IN' ? '/api/inventory/in' : '/api/inventory/out';
    const body = { 
        item_id: id, qty: qty, 
        selected_employee: 'ADMIN', // Hardcoded for Admin actions
        category: 'Admin Op' 
    };

    try {
        const res = await fetch(`${API_URL}${endpoint}`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
        if(res.ok) { alert("Stock Updated!"); fetchData(); }
        else { const j = await res.json(); alert(j.error); }
    } catch(e) { alert("Error"); }
}

// --- 3. REPORTS WITH DATE FILTER ---
async function fetchLogs() {
    const res = await fetch(`${API_URL}/api/admin/stats?type=ADVANCE`, { headers: getHeaders() });
    globalLogs = await res.json();
}

function loadReport(type) {
    const output = document.getElementById('reportOutput');
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    // Helper to check date range
    const isInRange = (timestamp) => {
        if(!dateFrom && !dateTo) return true;
        const date = new Date(timestamp).toISOString().split('T')[0];
        if(dateFrom && date < dateFrom) return false;
        if(dateTo && date > dateTo) return false;
        return true;
    };

    document.getElementById('itemReportSearch').style.display = (type === 'ITEM') ? 'block' : 'none';

    if (type === 'NORMAL') {
        // Summary View (Ignores date mostly, shows current stock, or could calculate snapshot)
        // For simplicity, we show CURRENT stock grouped by category as requested
        const grouped = {};
        globalInventory.forEach(i => {
            if(!grouped[i.category]) grouped[i.category] = [];
            grouped[i.category].push(i);
        });
        
        let html = '';
        for(const [cat, items] of Object.entries(grouped)) {
            html += `<h4 style="color:#00f2ff; margin-top:15px;">${cat}</h4><table class="glass-table"><tr><th>Item</th><th>Size</th><th>Qty</th></tr>`;
            items.forEach(x => html += `<tr><td>${x.item_name}</td><td>${x.size||'-'}</td><td>${x.qty}</td></tr>`);
            html += `</table>`;
        }
        output.innerHTML = html;

    } else if (type === 'ADVANCE') {
        // Full Logs Filtered by Date
        const filtered = globalLogs.filter(l => isInRange(l.timestamp));
        let html = `<table class="glass-table"><tr><th>Date</th><th>Action</th><th>Item</th><th>Qty</th><th>User</th></tr>`;
        filtered.forEach(l => {
            let color = l.action_type==='IN'?'#00ff88':(l.action_type==='OUT'?'orange':'red');
            html += `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td style="color:${color}">${l.action_type}</td><td>${l.item_name_snapshot}</td><td>${l.qty_changed}</td><td>${l.user_name}</td></tr>`;
        });
        output.innerHTML = html + '</table>';

    } else if (type === 'ITEM') {
        // Specific Item + Date Range
        if(!selectedRepItemName) { output.innerHTML = '<p>Please search and select an item above.</p>'; return; }
        
        const filtered = globalLogs.filter(l => 
            l.item_name_snapshot === selectedRepItemName && 
            isInRange(l.timestamp)
        );
        
        let html = `<h3>History for: ${selectedRepItemName}</h3><table class="glass-table"><tr><th>Date</th><th>Action</th><th>Qty Change</th><th>User</th></tr>`;
        filtered.forEach(l => {
            html += `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td>${l.action_type}</td><td>${l.qty_changed}</td><td>${l.user_name}</td></tr>`;
        });
        output.innerHTML = html + '</table>';
    }
}

// --- 4. OTHER ACTIONS ---
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        item_name: document.getElementById('itemName').value,
        sku: document.getElementById('itemSku').value,
        category: document.getElementById('itemCategory').value,
        size: document.getElementById('itemSize').value
    };
    const res = await fetch(`${API_URL}/api/admin/add-item`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    if(res.ok) { alert("Item Added!"); document.getElementById('addItemForm').reset(); fetchData(); }
    else { const j=await res.json(); alert(j.error); }
});

async function resolve(id, decision) {
    if(!confirm('Confirm?')) return;
    await fetch(`${API_URL}/api/admin/resolve-damage`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ report_id: id, decision }) });
    loadPendingRequests(); fetchData();
}

async function manualUpdate(id, curr) {
    const qty = prompt("New Qty:", curr);
    if(qty) {
        await fetch(`${API_URL}/api/admin/manual-update`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ item_id: id, new_qty: qty }) });
        fetchData();
    }
}
