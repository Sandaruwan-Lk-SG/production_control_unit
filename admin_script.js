const API_URL = "https://backpcu-production.up.railway.app"; 

// Data Cache
let globalInventory = [];
let globalLogs = [];
let selectedRepItemName = '';

// --- INIT ---
window.onload = function() {
    if (localStorage.getItem('userRole') !== 'admin' || !localStorage.getItem('token')) {
        window.location.href = 'index.html';
    } else {
        fetchData();
        setInterval(fetchData, 5000); // Live Update
    }
};

function getHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }; }
function logout() { localStorage.clear(); window.location.href = 'index.html'; }
function switchTab(id) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById(`tab-${id}`).style.display = 'block';
    
    // Inventory Tab එකට ආවම ඔක්කොම ලෝඩ් කරන්න (සර්ච් එක ක්ලියර් කරලා)
    if(id === 'inventory') {
        document.getElementById('inventorySearchInput').value = '';
        renderInventorySummary(globalInventory);
    }
    if(id === 'reports') fetchLogs(); 
}

// --- CORE DATA FETCHING ---
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
    // 1. CATEGORY BREAKDOWN
    const catGrid = document.getElementById('categoryGrid');
    const categories = {};
    inv.forEach(i => {
        if (!categories[i.category]) categories[i.category] = 0;
        categories[i.category] += i.qty;
    });

    catGrid.innerHTML = '';
    for (const [catName, totalQty] of Object.entries(categories)) {
        catGrid.innerHTML += `
            <div class="cat-card">
                <div class="cat-title">${catName}</div>
                <div class="cat-count">${totalQty}</div>
            </div>`;
    }

    // 2. STAGNANT ITEMS (> 2 Days)
    const stagnantBox = document.getElementById('stagnantBox');
    const stagnantList = document.getElementById('stagnantItems');
    stagnantList.innerHTML = '';
    const now = new Date();
    let hasStagnant = false;

    inv.forEach(i => {
        const lastUpdate = new Date(i.last_updated_at); 
        const diffDays = Math.ceil(Math.abs(now - lastUpdate) / (1000 * 60 * 60 * 24)); 
        if (diffDays > 2 && i.qty > 0) {
            hasStagnant = true;
            stagnantList.innerHTML += `<div class="stagnant-badge"><i class="fas fa-clock"></i> ${i.item_name} (${i.qty})</div>`;
        }
    });
    stagnantBox.style.display = hasStagnant ? 'block' : 'none';

    // 3. DAMAGE TABLE
    const dTable = document.getElementById('damageTable');
    dTable.innerHTML = '';
    if(dmg.length === 0) {
        dTable.innerHTML = '<tr><td colspan="6" style="text-align:center">✅ No Pending Issues</td></tr>';
    } else {
        dmg.forEach(d => {
            dTable.innerHTML += `<tr><td>${new Date(d.reported_at).toLocaleDateString()}</td><td>${d.item_name}</td><td>${d.damage_type}</td><td>${d.damage_qty}</td><td>${d.reported_by}</td>
            <td><button class="btn-action btn-approve" onclick="resolve(${d.id},'REPLACE')">Replace</button><button class="btn-action btn-reject" onclick="resolve(${d.id},'REMOVE')">Remove</button></td></tr>`;
        });
    }

    // 4. INVENTORY SUMMARY LIVE UPDATE
    // If user is currently looking at inventory tab, update it live (respecting search)
    if(document.getElementById('tab-inventory').style.display === 'block') {
        const searchVal = document.getElementById('inventorySearchInput').value.toLowerCase();
        const filtered = searchVal ? globalInventory.filter(i => i.item_name.toLowerCase().includes(searchVal)) : globalInventory;
        renderInventorySummary(filtered);
    }
}

// --- INVENTORY SUMMARY & SEARCH LOGIC ---
document.getElementById('inventorySearchInput').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const filtered = globalInventory.filter(i => i.item_name.toLowerCase().includes(val) || i.category.toLowerCase().includes(val));
    renderInventorySummary(filtered);
});

function renderInventorySummary(data) {
    const tbody = document.getElementById('inventoryTable');
    tbody.innerHTML = '';
    
    // Group Data by Name & Category (Sum Qty)
    const grouped = {};
    data.forEach(i => {
        const key = i.category + "|" + i.item_name;
        if(!grouped[key]) grouped[key] = { category: i.category, name: i.item_name, total: 0 };
        grouped[key].total += i.qty;
    });

    const summaryList = Object.values(grouped);

    if(summaryList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">No Items Found</td></tr>';
        return;
    }

    summaryList.forEach(i => {
        let status = i.total <= 0 ? '<span style="color:#ff4d4d; font-weight:bold">Out of Stock</span>' : 
                     (i.total < 10 ? '<span style="color:#ffb300; font-weight:bold">Low Stock</span>' : '<span style="color:#00e676; font-weight:bold">Good</span>');
        
        tbody.innerHTML += `
            <tr>
                <td>${i.category}</td>
                <td style="font-weight:500; color: white;">${i.name}</td>
                <td style="font-size: 1.1em; font-weight: bold;">${i.total}</td>
                <td>${status}</td>
            </tr>`;
    });
}

// --- OPERATIONS SEARCH (Dropdown Style) ---
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
                div.onclick = () => { input.value = m.item_name; dropdown.style.display = 'none'; onSelect(m); };
                dropdown.appendChild(div);
            });
        } else { dropdown.style.display = 'none'; }
    });
}
setupSmartSearch('opSearch', 'opDropdown', (item) => { document.getElementById('selectedItemId').value = item.id; });
setupSmartSearch('repItemSearch', 'repDropdown', (item) => { selectedRepItemName = item.item_name; loadReport('ITEM'); });

async function performStockOp() {
    const id = document.getElementById('selectedItemId').value;
    const type = document.getElementById('opType').value;
    const qty = document.getElementById('opQty').value;
    if(!id || !qty) return alert("Select item and enter quantity");
    const body = { item_id: id, qty: qty, selected_employee: 'ADMIN', category: 'Admin Op' };
    const endpoint = type === 'IN' ? '/api/inventory/in' : '/api/inventory/out';
    try {
        const res = await fetch(`${API_URL}${endpoint}`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
        if(res.ok) { alert("Updated!"); fetchData(); } else { const j = await res.json(); alert(j.error); }
    } catch(e) { alert("Error"); }
}

// --- REPORTS ---
async function fetchLogs() {
    const res = await fetch(`${API_URL}/api/admin/stats?type=ADVANCE`, { headers: getHeaders() });
    globalLogs = await res.json();
}
function loadReport(type) {
    const output = document.getElementById('reportOutput');
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const isInRange = (timestamp) => {
        if(!dateFrom && !dateTo) return true;
        const date = new Date(timestamp).toISOString().split('T')[0];
        if(dateFrom && date < dateFrom) return false;
        if(dateTo && date > dateTo) return false;
        return true;
    };
    document.getElementById('itemReportSearch').style.display = (type === 'ITEM') ? 'block' : 'none';

    if (type === 'NORMAL') {
        const grouped = {};
        globalInventory.forEach(i => { if(!grouped[i.category]) grouped[i.category]=[]; grouped[i.category].push(i); });
        let html = '';
        for(const [cat, items] of Object.entries(grouped)) {
            html += `<h4 style="color:#00f2ff; margin-top:15px;">${cat}</h4><table class="glass-table"><tr><th>Item</th><th>Size</th><th>Qty</th></tr>`;
            items.forEach(x => html += `<tr><td>${x.item_name}</td><td>${x.size||'-'}</td><td>${x.qty}</td></tr>`);
            html += `</table>`;
        }
        output.innerHTML = html;
    } else if (type === 'ADVANCE') {
        const filtered = globalLogs.filter(l => isInRange(l.timestamp));
        let html = `<table class="glass-table"><tr><th>Date</th><th>Action</th><th>Item</th><th>Qty</th><th>User</th></tr>`;
        filtered.forEach(l => {
            let color = l.action_type==='IN'?'#00ff88':(l.action_type==='OUT'?'orange':'red');
            html += `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td style="color:${color}">${l.action_type}</td><td>${l.item_name_snapshot}</td><td>${l.qty_changed}</td><td>${l.user_name}</td></tr>`;
        });
        output.innerHTML = html + '</table>';
    } else if (type === 'ITEM') {
        if(!selectedRepItemName) { output.innerHTML = '<p>Search item above.</p>'; return; }
        const filtered = globalLogs.filter(l => l.item_name_snapshot === selectedRepItemName && isInRange(l.timestamp));
        let html = `<h3>History: ${selectedRepItemName}</h3><table class="glass-table"><tr><th>Date</th><th>Action</th><th>Qty</th><th>User</th></tr>`;
        filtered.forEach(l => { html += `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td>${l.action_type}</td><td>${l.qty_changed}</td><td>${l.user_name}</td></tr>`; });
        output.innerHTML = html + '</table>';
    }
}

// --- ADD ITEM & RESOLVE ---
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        item_name: document.getElementById('itemName').value,
        sku: document.getElementById('itemSku').value,
        category: document.getElementById('itemCategory').value,
        size: document.getElementById('itemSize').value
    };
    const res = await fetch(`${API_URL}/api/admin/add-item`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    if(res.ok) { alert("Added!"); document.getElementById('addItemForm').reset(); fetchData(); } else { const j=await res.json(); alert(j.error); }
});

async function resolve(id, dec) {
    if(!confirm('Confirm?')) return;
    await fetch(`${API_URL}/api/admin/resolve-damage`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ report_id: id, decision: dec }) });
    fetchData();
}
