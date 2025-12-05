// --- CONFIGURATION ---
const API_URL = "https://backpcu-production.up.railway.app"; 

// --- GLOBAL DATA STORE ---
let globalInventory = [];
let globalLogs = [];
let selectedRepItemName = '';

// --- 1. INITIALIZATION ---
window.onload = function() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');

    // Login වී නොමැති නම් හෝ Admin නොවේ නම්
    if (!token || role !== 'admin') {
        window.location.href = 'index.html';
    } else {
        fetchData(); // මුලින්ම දත්ත ගන්න
        // Live Update (සෑම තත්පර 5කට වරක්)
        setInterval(fetchData, 5000); 
    }
};

// --- HELPER FUNCTIONS ---
function getHeaders() {
    return { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${localStorage.getItem('token')}` 
    };
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

function switchTab(id) {
    // Hide all sections
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    // Show selected section
    document.getElementById(`tab-${id}`).style.display = 'block';
    
    // Sidebar Active State
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
    // Find the clicked li (Visual only)
    const activeBtn = document.querySelector(`li[onclick="switchTab('${id}')"]`);
    if(activeBtn) activeBtn.classList.add('active');

    // Tab Specific Actions
    if(id === 'inventory') {
        document.getElementById('inventorySearchInput').value = ''; // Clear search
        renderInventorySummary(globalInventory);
    }
    if(id === 'reports') fetchLogs(); 
}

// --- 2. CORE DATA FETCHING (DASHBOARD) ---
async function fetchData() {
    try {
        // 1. Inventory Data
        const resInv = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`, { headers: getHeaders() });
        globalInventory = await resInv.json();

        // 2. Pending Damages
        const resDmg = await fetch(`${API_URL}/api/admin/stats?type=DAMAGES`, { headers: getHeaders() });
        const damages = await resDmg.json();

        updateDashboardUI(globalInventory, damages);
    } catch (e) { console.error("Data Load Error", e); }
}

function updateDashboardUI(inv, dmg) {
    // A. CATEGORY BREAKDOWN CARDS
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

    // B. STAGNANT ITEMS ALERT (> 2 Days)
    const stagnantBox = document.getElementById('stagnantBox');
    const stagnantList = document.getElementById('stagnantItems');
    stagnantList.innerHTML = '';
    const now = new Date();
    let hasStagnant = false;

    inv.forEach(i => {
        const lastUpdate = new Date(i.last_updated_at);
        const diffDays = Math.ceil(Math.abs(now - lastUpdate) / (1000 * 60 * 60 * 24)); 
        
        // Stock තියෙනවා නම් සහ දවස් 2කට වඩා පරණ නම්
        if (diffDays > 2 && i.qty > 0) {
            hasStagnant = true;
            stagnantList.innerHTML += `
                <div class="stagnant-badge" title="Last Active: ${diffDays} days ago">
                    <i class="fas fa-clock"></i> ${i.item_name} (${i.qty})
                </div>`;
        }
    });
    stagnantBox.style.display = hasStagnant ? 'block' : 'none';

    // C. PENDING DAMAGE TABLE
    const dTable = document.getElementById('damageTable');
    dTable.innerHTML = '';
    if(dmg.length === 0) {
        dTable.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">✅ No Pending Issues</td></tr>';
    } else {
        dmg.forEach(d => {
            const typeBadge = d.damage_type === 'DAMAGE' ? '<span style="color:#ff4d4d;font-weight:bold">DAMAGE</span>' : '<span style="color:#ffb300;font-weight:bold">SHORTAGE</span>';
            dTable.innerHTML += `
                <tr>
                    <td>${new Date(d.reported_at).toLocaleDateString()}</td>
                    <td>${d.item_name} <br><small>${d.category}</small></td>
                    <td>${typeBadge}</td>
                    <td style="font-size:1.1em; font-weight:bold">${d.damage_qty}</td>
                    <td>${d.reported_by}</td>
                    <td>
                        <button class="btn-action btn-approve" onclick="resolve(${d.id},'REPLACE')">Replace</button>
                        <button class="btn-action btn-reject" onclick="resolve(${d.id},'REMOVE')">Remove</button>
                    </td>
                </tr>`;
        });
    }

    // D. LIVE UPDATE INVENTORY LIST (Only if user is looking at it)
    if(document.getElementById('tab-inventory').style.display === 'block') {
        const searchVal = document.getElementById('inventorySearchInput').value.toLowerCase();
        const filtered = searchVal ? globalInventory.filter(i => i.item_name.toLowerCase().includes(searchVal)) : globalInventory;
        renderInventorySummary(filtered);
    }
}

// --- 3. INVENTORY SUMMARY LIST LOGIC (Grouping) ---
document.getElementById('inventorySearchInput').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const filtered = globalInventory.filter(i => 
        i.item_name.toLowerCase().includes(val) || 
        i.category.toLowerCase().includes(val)
    );
    renderInventorySummary(filtered);
});

function renderInventorySummary(data) {
    const tbody = document.getElementById('inventoryTable');
    tbody.innerHTML = '';
    
    // Group Data by Name & Category (Summing Qty)
    const grouped = {};
    data.forEach(i => {
        const key = i.category + "|" + i.item_name;
        if(!grouped[key]) {
            grouped[key] = { category: i.category, name: i.item_name, total: 0 };
        }
        grouped[key].total += i.qty;
    });

    const summaryList = Object.values(grouped);

    if(summaryList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">No Items Found</td></tr>';
        return;
    }

    summaryList.forEach(i => {
        let status = '';
        if (i.total <= 0) status = '<span style="color:#ff4d4d; font-weight:bold">Out of Stock</span>';
        else if (i.total < 10) status = '<span style="color:#ffb300; font-weight:bold">Low Stock</span>';
        else status = '<span style="color:#00e676; font-weight:bold">Good</span>';
        
        tbody.innerHTML += `
            <tr>
                <td>${i.category}</td>
                <td style="font-weight:500; color: white;">${i.name}</td>
                <td style="font-size: 1.1em; font-weight: bold;">${i.total}</td>
                <td>${status}</td>
            </tr>`;
    });
}

// --- 4. SMART SEARCH (Dropdown Logic) ---
function setupSmartSearch(inputId, dropdownId, onSelect) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    
    input.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        dropdown.innerHTML = '';
        
        if(val.length < 1) { dropdown.style.display = 'none'; return; }

        const matches = globalInventory.filter(i => 
            i.item_name.toLowerCase().includes(val) || 
            (i.sku && i.sku.toLowerCase().includes(val))
        );
        
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
        } else { 
            dropdown.style.display = 'none'; 
        }
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// Setup searches
setupSmartSearch('opSearch', 'opDropdown', (item) => { 
    document.getElementById('selectedItemId').value = item.id; 
});
setupSmartSearch('repItemSearch', 'repDropdown', (item) => { 
    selectedRepItemName = item.item_name; 
    loadReport('ITEM'); 
});

// --- 5. STOCK OPERATIONS (Admin) ---
async function performStockOp() {
    const id = document.getElementById('selectedItemId').value;
    const type = document.getElementById('opType').value;
    const qty = document.getElementById('opQty').value;
    
    if(!id || !qty) return alert("Please select an item and enter quantity");

    const body = { 
        item_id: id, 
        qty: qty, 
        selected_employee: 'ADMIN', 
        category: 'Admin Op' 
    };
    
    const endpoint = type === 'IN' ? '/api/inventory/in' : '/api/inventory/out';

    try {
        const res = await fetch(`${API_URL}${endpoint}`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
        if(res.ok) { 
            alert(`Stock ${type} Successful!`); 
            fetchData(); 
            // Reset fields
            document.getElementById('opSearch').value = '';
            document.getElementById('opQty').value = '';
        } else { 
            const j = await res.json(); 
            alert("Error: " + j.error); 
        }
    } catch(e) { alert("Server Error"); }
}

// --- 6. REPORTS SYSTEM ---
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

    // Toggle Item Search Bar
    document.getElementById('itemReportSearch').style.display = (type === 'ITEM') ? 'block' : 'none';
    
    // Toggle Active Buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    if (type === 'NORMAL') {
        const grouped = {};
        globalInventory.forEach(i => { if(!grouped[i.category]) grouped[i.category]=[]; grouped[i.category].push(i); });
        let html = '';
        for(const [cat, items] of Object.entries(grouped)) {
            html += `<h4 style="color:#00f2ff; margin-top:15px; border-bottom:1px solid #333">${cat}</h4><table class="glass-table"><tr><th>Item</th><th>Size</th><th>Qty</th></tr>`;
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
        if(!selectedRepItemName) { output.innerHTML = '<p style="text-align:center">Please search and select an item above.</p>'; return; }
        const filtered = globalLogs.filter(l => l.item_name_snapshot === selectedRepItemName && isInRange(l.timestamp));
        let html = `<h3>History: ${selectedRepItemName}</h3><table class="glass-table"><tr><th>Date</th><th>Action</th><th>Qty</th><th>User</th></tr>`;
        filtered.forEach(l => { html += `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td>${l.action_type}</td><td>${l.qty_changed}</td><td>${l.user_name}</td></tr>`; });
        output.innerHTML = html + '</table>';
    }
}

// --- 7. OTHER ACTIONS (Add, Resolve) ---
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        item_name: document.getElementById('itemName').value,
        sku: document.getElementById('itemSku').value,
        category: document.getElementById('itemCategory').value,
        size: document.getElementById('itemSize').value
    };
    const res = await fetch(`${API_URL}/api/admin/add-item`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    if(res.ok) { alert("✅ Item Added!"); document.getElementById('addItemForm').reset(); fetchData(); } 
    else { const j=await res.json(); alert("⚠️ " + j.error); }
});

async function resolve(id, decision) {
    if(!confirm(`Are you sure you want to ${decision}?`)) return;
    try {
        const res = await fetch(`${API_URL}/api/admin/resolve-damage`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify({ report_id: id, decision: decision })
        });
        if(res.ok) { alert("Done!"); fetchData(); } else { alert("Error"); }
    } catch(e) { alert("Server Error"); }
}
