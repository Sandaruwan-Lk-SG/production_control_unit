const API_URL = "https://backpcu-production.up.railway.app"; 
let globalInventory = [];

// --- INIT ---
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
    if(id === 'inventory') renderInventorySummary('');
    if(id === 'reports') loadReport('NORMAL');
}

// --- DATA FETCHING ---
async function fetchData() {
    try {
        const resInv = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`, { headers: getHeaders() });
        globalInventory = await resInv.json();
        updateDashboardUI(globalInventory);
    } catch (e) { console.error(e); }
}

function updateDashboardUI(inv) {
    // 1. CATEGORY BREAKDOWN (Summary Only)
    const container = document.getElementById('categorySummaryGrid');
    
    // Group Data
    const grouped = {};
    inv.forEach(i => {
        if (!grouped[i.category]) grouped[i.category] = { totalQty: 0, subTypes: 0 };
        grouped[i.category].totalQty += i.qty;
        grouped[i.category].subTypes += 1; // Assuming each row is a unique Item Type
    });

    let html = '';
    for (const [cat, data] of Object.entries(grouped)) {
        // Icon logic
        let icon = 'fa-box';
        if(cat.includes('Packing')) icon = 'fa-box-open';
        if(cat.includes('Sole')) icon = 'fa-shoe-prints';

        html += `
            <div class="summary-card">
                <div class="card-head">
                    <span class="card-cat-title">${cat}</span>
                    <i class="fas ${icon} card-icon"></i>
                </div>
                <div class="card-body">
                    <div class="stat-main">
                        <div class="stat-val">${data.totalQty}</div>
                        <div class="stat-lbl">Total Stock</div>
                    </div>
                    <div class="stat-sub">
                        <span class="sub-val">${data.subTypes}</span>
                        <div class="sub-lbl">Types</div>
                    </div>
                </div>
            </div>`;
    }
    container.innerHTML = html;

    // 2. STAGNANT ITEMS ALERT (> 2 Days)
    const alertBox = document.getElementById('stagnantBox');
    const alertList = document.getElementById('stagnantItems');
    const now = new Date();
    let hasStagnant = false;
    let alertHtml = '';

    inv.forEach(i => {
        const lastUpdate = new Date(i.last_updated_at);
        const diffDays = Math.ceil(Math.abs(now - lastUpdate) / (1000 * 60 * 60 * 24));
        if (i.qty > 0 && diffDays > 2) {
            hasStagnant = true;
            alertHtml += `<div class="stagnant-tag"><i class="fas fa-history"></i> ${i.item_name} (${diffDays}d)</div>`;
        }
    });

    if (hasStagnant) {
        alertList.innerHTML = alertHtml;
        alertBox.style.display = 'block';
    } else {
        alertBox.style.display = 'none';
    }

    if(document.getElementById('tab-inventory').style.display === 'block') {
        renderInventorySummary(document.getElementById('inventorySearchInput').value);
    }
}

// --- INVENTORY LIST ---
document.getElementById('inventorySearchInput').addEventListener('input', (e) => {
    renderInventorySummary(e.target.value.toLowerCase());
});

function renderInventorySummary(searchVal) {
    const tbody = document.getElementById('inventoryTable');
    tbody.innerHTML = '';
    const grouped = {};
    globalInventory.forEach(i => {
        const key = i.category + "|" + i.item_name;
        if(!grouped[key]) grouped[key] = { cat: i.category, name: i.item_name, tot: 0 };
        grouped[key].tot += i.qty;
    });

    Object.values(grouped).forEach(i => {
        if(searchVal && !i.name.toLowerCase().includes(searchVal)) return;
        let status = i.tot <= 0 ? '<span style="color:#ff4d4d">Out</span>' : (i.tot < 10 ? '<span style="color:orange">Low</span>' : '<span style="color:#00e676">Good</span>');
        tbody.innerHTML += `<tr><td>${i.cat}</td><td>${i.name}</td><td>${i.tot}</td><td>${status}</td></tr>`;
    });
}

// --- OPERATIONS ---
const opInput = document.getElementById('opSearch');
const opDrop = document.getElementById('opDropdown');
opInput.addEventListener('input', (e)=>{
    const v=e.target.value.toLowerCase(); opDrop.innerHTML='';
    if(v.length<1){opDrop.style.display='none';return;}
    const m=globalInventory.filter(i=>i.item_name.toLowerCase().includes(v));
    if(m.length>0){
        opDrop.style.display='block';
        m.forEach(i=>{
            const d=document.createElement('div'); d.className='dropdown-item'; d.innerHTML=`${i.item_name} <small>(${i.category})</small>`;
            d.onclick=()=>{opInput.value=i.item_name; document.getElementById('selectedItemId').value=i.id; opDrop.style.display='none';};
            opDrop.appendChild(d);
        });
    } else opDrop.style.display='none';
});

async function performStockOp() {
    const id=document.getElementById('selectedItemId').value; const qty=document.getElementById('opQty').value;
    const type=document.getElementById('opType').value;
    if(id&&qty) {
        const ep = type==='IN'?'/api/inventory/in':'/api/inventory/out';
        await fetch(`${API_URL}${ep}`, { method:'POST', headers:getHeaders(), body:JSON.stringify({ item_id:id, qty:qty, selected_employee:'ADMIN', category:'Admin Op' }) });
        alert("Success"); fetchData();
    }
}

document.getElementById('addItemForm').addEventListener('submit', async(e)=>{
    e.preventDefault(); 
    const data = {
        item_name: document.getElementById('itemName').value,
        sku: document.getElementById('itemSku').value,
        category: document.getElementById('itemCategory').value,
        size: document.getElementById('itemSize').value
    };
    const res = await fetch(`${API_URL}/api/admin/add-item`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    if(res.ok) { alert("Added!"); document.getElementById('addItemForm').reset(); fetchData(); }
});

async function loadReport(type) {
    const output = document.getElementById('reportOutput');
    output.innerHTML = 'Loading...';
    if (type === 'NORMAL') {
        renderInventorySummary('');
        output.innerHTML = document.querySelector('#tab-inventory .table-wrapper').innerHTML;
    } else {
        const res = await fetch(`${API_URL}/api/admin/stats?type=ADVANCE`, { headers: getHeaders() });
        const logs = await res.json();
        let html = `<table class="glass-table"><tr><th>Time</th><th>Action</th><th>Item</th><th>Qty</th><th>User</th></tr>`;
        logs.slice(0, 100).forEach(l => {
            let c = l.action_type==='IN'?'#00ff88':(l.action_type==='OUT'?'orange':'red');
            html += `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td style="color:${c}">${l.action_type}</td><td>${l.item_name_snapshot}</td><td>${l.qty_changed}</td><td>${l.user_name}</td></tr>`;
        });
        output.innerHTML = html + '</table>';
    }
}
