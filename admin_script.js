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
    // 1. CATEGORY BREAKDOWN CARDS (අලුත් ක්‍රමය)
    const catGrid = document.getElementById('categoryGrid');
    const categories = { 
        'Packing': 0, 'Insole': 0, 'Sole': 0, 
        'Upper': 0, 'Cut Insole': 0, 'Cut Upper': 0, 'Line Order': 0 
    };

    inv.forEach(i => {
        if (categories[i.category] !== undefined) {
            categories[i.category] += i.qty;
        } else {
            // ලිස්ට් එකේ නැති අලුත් කැටගරි එකක් නම්
            categories[i.category] = i.qty;
        }
    });

    catGrid.innerHTML = '';
    for (const [catName, totalQty] of Object.entries(categories)) {
        catGrid.innerHTML += `
            <div class="cat-card">
                <div class="cat-title">${catName}</div>
                <div class="cat-count">${totalQty}</div>
            </div>
        `;
    }

    // 2. STAGNANT ITEMS ALERT (දවස් 2ක් පරණ බඩු)
    const stagnantBox = document.getElementById('stagnantBox');
    const stagnantList = document.getElementById('stagnantItems');
    stagnantList.innerHTML = '';
    
    const now = new Date();
    let hasStagnant = false;

    inv.forEach(i => {
        // අන්තිමට Update වුනු වෙලාව (In හෝ Out කරපු)
        const lastUpdate = new Date(i.last_updated_at); 
        // දවස් ගණන
        const diffTime = Math.abs(now - lastUpdate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        // දවස් 2කට වඩා වැඩිනම් සහ Stock එකේ බඩු තියෙනවා නම් (0 ට වඩා වැඩි)
        if (diffDays > 2 && i.qty > 0) {
            hasStagnant = true;
            stagnantList.innerHTML += `
                <div class="stagnant-badge" title="Last Active: ${diffDays} days ago">
                    <i class="fas fa-clock"></i> ${i.item_name} (${i.qty})
                </div>
            `;
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

    // 4. INVENTORY TABLE
    if(document.getElementById('tab-inventory').style.display === 'block') {
        const iTable = document.getElementById('inventoryTable');
        iTable.innerHTML = '';
        inv.forEach(i => {
            let status = i.qty <= 0 ? 'Out' : (i.qty < 5 ? 'Low' : 'Ok');
            iTable.innerHTML += `<tr><td>${i.category}</td><td>${i.item_name}</td><td>${i.size||'-'}</td><td>${i.qty}</td><td>${status}</td>
            <td><button onclick="manualUpdate(${i.id}, ${i.qty})" class="btn-action">Edit</button></td></tr>`;
        });
    }
}

// --- SEARCH & OPERATIONS LOGIC (Keep same as before) ---
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
async function manualUpdate(id, curr) {
    const q = prompt("New Qty:", curr);
    if(q) { await fetch(`${API_URL}/api/admin/manual-update`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ item_id: id, new_qty: q }) }); fetchData(); }
}
