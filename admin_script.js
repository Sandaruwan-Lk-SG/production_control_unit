const API_URL = "https://backpcu-production.up.railway.app"; 
let globalInventory = [];
let globalLogs = [];

window.onload = function() {
    if (!localStorage.getItem('token') || localStorage.getItem('userRole') !== 'admin') {
        window.location.href = 'index.html';
    } else {
        fetchData();
        setInterval(fetchData, 5000); 
    }
};

function getHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }; }
function logout() { localStorage.clear(); window.location.href = 'index.html'; }

function switchTab(id) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById(`tab-${id}`).style.display = 'block';
    
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
    // Highlight logic omitted for brevity, works via click
    
    if(id === 'inventory') renderInventoryList('');
    if(id === 'reports') fetchLogs(); // Load logs when tab opens
}

// --- DATA FETCHING ---
async function fetchData() {
    try {
        const resInv = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`, { headers: getHeaders() });
        globalInventory = await resInv.json();

        const resDmg = await fetch(`${API_URL}/api/admin/stats?type=DAMAGES`, { headers: getHeaders() });
        const damages = await resDmg.json();

        updateDashboardUI(globalInventory, damages);
    } catch (e) { console.error(e); }
}

function updateDashboardUI(inv, dmg) {
    // 1. OVERVIEW CARDS (Total Only - No List)
    const catGrid = document.getElementById('categorySummaryGrid');
    const grouped = {};
    
    inv.forEach(i => {
        if (!grouped[i.category]) grouped[i.category] = { qty: 0, items: 0 };
        grouped[i.category].qty += i.qty;
        grouped[i.category].items += 1;
    });

    catGrid.innerHTML = '';
    for (const [cat, data] of Object.entries(grouped)) {
        let icon = 'fa-box';
        if(cat.includes('Packing')) icon = 'fa-box-open';
        
        catGrid.innerHTML += `
            <div class="summary-card" style="height:auto; min-height:120px;">
                <div class="card-head">
                    <span class="card-cat-title">${cat}</span>
                    <i class="fas ${icon} card-icon"></i>
                </div>
                <div class="card-body">
                    <div class="stat-main">
                        <div class="stat-val">${data.qty}</div>
                        <div class="stat-lbl">Total Units</div>
                    </div>
                    <div class="stat-sub">
                        <span class="sub-val">${data.items}</span>
                        <div class="sub-lbl">Item Types</div>
                    </div>
                </div>
            </div>`;
    }

    // 2. STAGNANT ITEMS
    const alertBox = document.getElementById('stagnantBox');
    const alertList = document.getElementById('stagnantItems');
    const now = new Date();
    let hasStagnant = false;
    alertList.innerHTML = '';

    inv.forEach(i => {
        const diff = Math.ceil(Math.abs(now - new Date(i.last_updated_at)) / (86400000));
        if(diff > 2 && i.qty > 0) {
            hasStagnant = true;
            alertList.innerHTML += `<span class="stagnant-tag">${i.item_name} (${diff}d)</span>`;
        }
    });
    alertBox.style.display = hasStagnant ? 'block' : 'none';

    // 3. DAMAGES
    const dTable = document.getElementById('damageTable');
    dTable.innerHTML = '';
    if(dmg.length===0) dTable.innerHTML = '<tr><td colspan="5" style="text-align:center">No Issues</td></tr>';
    else {
        dmg.forEach(d => {
            dTable.innerHTML += `<tr><td>${new Date(d.reported_at).toLocaleDateString()}</td><td>${d.item_name}</td><td>${d.damage_type}</td><td>${d.damage_qty}</td>
            <td><button class="btn-action btn-approve" onclick="resolve(${d.id},'REPLACE')">R</button><button class="btn-action btn-reject" onclick="resolve(${d.id},'REMOVE')">X</button></td></tr>`;
        });
    }

    if(document.getElementById('tab-inventory').style.display === 'block') {
        renderInventoryList(document.getElementById('inventorySearchInput').value);
    }
}

// --- SMART SEARCH LOGIC (FIXED) ---
const opInput = document.getElementById('opSearch');
const opDrop = document.getElementById('opDropdown');

opInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    opDrop.innerHTML = '';
    if(val.length < 1) { opDrop.style.display='none'; return; }

    const matches = globalInventory.filter(i => i.item_name.toLowerCase().includes(val));
    if(matches.length > 0) {
        opDrop.style.display = 'block';
        matches.forEach(m => {
            const d = document.createElement('div');
            d.className = 'search-item';
            d.innerHTML = `${m.item_name} <small style="color:#aaa">(${m.category})</small>`;
            d.onclick = () => {
                opInput.value = m.item_name;
                document.getElementById('selectedItemId').value = m.id;
                opDrop.style.display = 'none';
            };
            opDrop.appendChild(d);
        });
    } else opDrop.style.display = 'none';
});

// Hide dropdown when clicking outside
document.addEventListener('click', (e) => {
    if(!opInput.contains(e.target) && !opDrop.contains(e.target)) opDrop.style.display = 'none';
});

// --- INVENTORY LIST (Total Qty View) ---
document.getElementById('inventorySearchInput').addEventListener('input', (e) => {
    renderInventoryList(e.target.value.toLowerCase());
});

function renderInventoryList(searchVal) {
    const tbody = document.getElementById('inventoryTable');
    tbody.innerHTML = '';
    
    // Grouping by Name & Category
    const grouped = {};
    globalInventory.forEach(i => {
        const key = i.category + "|" + i.item_name;
        if(!grouped[key]) grouped[key] = { cat: i.category, name: i.item_name, qty: 0 };
        grouped[key].qty += i.qty;
    });

    Object.values(grouped).forEach(i => {
        if(searchVal && !i.name.toLowerCase().includes(searchVal)) return;
        
        let status = i.qty <= 0 ? '<span style="color:red">Out</span>' : (i.qty < 5 ? '<span style="color:orange">Low</span>' : '<span style="color:#00e676">Good</span>');
        tbody.innerHTML += `<tr><td>${i.cat}</td><td>${i.name}</td><td>${i.qty}</td><td>${status}</td></tr>`;
    });
}

// --- ADVANCED REPORT LOGIC (DATE/MONTH/YEAR) ---
async function fetchLogs() {
    const res = await fetch(`${API_URL}/api/admin/stats?type=ADVANCE`, { headers: getHeaders() });
    globalLogs = await res.json();
}

// 1. Show/Hide Date Inputs based on Selection
function toggleDateInputs() {
    const type = document.getElementById('reportFilterType').value;
    document.getElementById('dateRangeInput').style.display = (type === 'RANGE') ? 'block' : 'none';
    document.getElementById('monthInput').style.display = (type === 'MONTH') ? 'block' : 'none';
}

// 2. Main Report Generation
let currentReportView = 'NORMAL'; // Default view

function viewReportType(type) {
    currentReportView = type;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    generateReport(); // Re-run with current filters
}

function generateReport() {
    const filterType = document.getElementById('reportFilterType').value;
    const output = document.getElementById('reportOutput');
    
    // Filter Function
    const filterData = (timestamp) => {
        const date = new Date(timestamp);
        if (filterType === 'ALL') return true;
        
        if (filterType === 'RANGE') {
            const start = document.getElementById('dateStart').value;
            const end = document.getElementById('dateEnd').value;
            if(!start || !end) return true;
            const d = date.toISOString().split('T')[0];
            return d >= start && d <= end;
        }
        
        if (filterType === 'MONTH') {
            const mPicker = document.getElementById('monthPicker').value; // YYYY-MM
            if(!mPicker) return true;
            const dStr = date.toISOString().slice(0, 7); // Get YYYY-MM
            return dStr === mPicker;
        }
    };

    if (currentReportView === 'NORMAL') {
        // STOCK SUMMARY (Does not use date filter usually, but we can if logs are involved)
        // For Stock Summary, we just show current inventory as is
        renderInventoryList('');
        output.innerHTML = document.querySelector('#tab-inventory .table-wrapper').innerHTML;
    
    } else {
        // TRANSACTION LOGS (Uses Filter)
        const filteredLogs = globalLogs.filter(l => filterData(l.timestamp));
        
        let html = `<table class="glass-table"><tr><th>Date</th><th>Action</th><th>Item</th><th>Qty</th><th>User</th></tr>`;
        filteredLogs.forEach(l => {
            let c = l.action_type==='IN'?'#00ff88':(l.action_type==='OUT'?'orange':'red');
            html += `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td style="color:${c}">${l.action_type}</td><td>${l.item_name_snapshot}</td><td>${l.qty_changed}</td><td>${l.user_name}</td></tr>`;
        });
        output.innerHTML = html + '</table>';
    }
}

// --- OPERATIONS ---
document.getElementById('addItemForm').addEventListener('submit', async(e)=>{
    e.preventDefault(); 
    const data = { item_name: document.getElementById('itemName').value, sku: document.getElementById('itemSku').value, category: document.getElementById('itemCategory').value, size: document.getElementById('itemSize').value };
    const res = await fetch(`${API_URL}/api/admin/add-item`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    if(res.ok) { alert("Added!"); document.getElementById('addItemForm').reset(); fetchData(); }
});

async function performStockOp() {
    const id=document.getElementById('selectedItemId').value; const qty=document.getElementById('opQty').value;
    const type=document.getElementById('opType').value;
    if(id&&qty) {
        const ep = type==='IN'?'/api/inventory/in':'/api/inventory/out';
        await fetch(`${API_URL}${ep}`, { method:'POST', headers:getHeaders(), body:JSON.stringify({ item_id:id, qty:qty, selected_employee:'ADMIN', category:'Admin Op' }) });
        alert("Updated!"); fetchData();
    }
}

async function resolve(id, dec) {
    if(confirm('Confirm?')) {
        await fetch(`${API_URL}/api/admin/resolve-damage`, { method:'POST', headers:getHeaders(), body:JSON.stringify({ report_id:id, decision:dec }) });
        fetchData();
    }
}
