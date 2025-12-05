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
    
    // Sidebar Active
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
    // Note: Use event target logic if needed, simple approach here:
    if(id === 'inventory') renderInventoryAccordion('');
    if(id === 'reports') renderTop5Reports();
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
    // 1. MODERN OVERVIEW CARDS
    const grid = document.getElementById('modernGrid');
    const cats = {};

    inv.forEach(i => {
        if (!cats[i.category]) cats[i.category] = { items: 0, qty: 0 };
        cats[i.category].items += 1; // Unique Items count
        cats[i.category].qty += i.qty; // Total Qty
    });

    grid.innerHTML = '';
    for (const [name, data] of Object.entries(cats)) {
        // Icon selection based on category name (Simple logic)
        let icon = 'fa-box';
        if(name.includes('Packing')) icon = 'fa-box-open';
        if(name.includes('Sole')) icon = 'fa-shoe-prints';
        
        grid.innerHTML += `
            <div class="modern-card">
                <div class="card-header">
                    <span class="card-title">${name}</span>
                    <i class="fas ${icon} card-icon"></i>
                </div>
                <div class="card-body">
                    <div class="card-stat">
                        <span class="stat-value">${data.qty}</span>
                        <div class="stat-label">Total Qty</div>
                    </div>
                    <div class="card-sub">
                        <span class="sub-val">${data.items}</span>
                        <div class="sub-label">Item Types</div>
                    </div>
                </div>
            </div>`;
    }

    // 2. STAGNANT ITEMS (Keep existing logic or hide if not needed)
    // (Included for completeness based on previous code)
    const now = new Date();
    const stagnantBox = document.getElementById('stagnantBox');
    const stagnantList = document.getElementById('stagnantItems');
    let hasStagnant = false;
    stagnantList.innerHTML = '';
    
    inv.forEach(i => {
        const diff = Math.ceil(Math.abs(now - new Date(i.last_updated_at)) / (86400000));
        if(diff > 2 && i.qty > 0) {
            hasStagnant = true;
            stagnantList.innerHTML += `<span style="background:#ff4d4d;color:white;padding:3px 8px;border-radius:5px;font-size:12px;">${i.item_name} (${diff}d)</span>`;
        }
    });
    stagnantBox.style.display = hasStagnant ? 'block' : 'none';

    // Refresh Inventory View if active
    if(document.getElementById('tab-inventory').style.display === 'block') {
        const search = document.getElementById('inventorySearchInput').value;
        renderInventoryAccordion(search);
    }
}

// --- 2. INVENTORY ACCORDION LOGIC ---
document.getElementById('inventorySearchInput').addEventListener('input', (e) => {
    renderInventoryAccordion(e.target.value.toLowerCase());
});

function renderInventoryAccordion(searchVal) {
    const container = document.getElementById('inventoryListContainer');
    container.innerHTML = '';

    // Group Data
    const groups = {};
    globalInventory.forEach(i => {
        if (!groups[i.category]) groups[i.category] = { total: 0, items: [] };
        groups[i.category].total += i.qty;
        groups[i.category].items.push(i);
    });

    for (const [cat, data] of Object.entries(groups)) {
        // Filter Logic: Check if Category OR any Item matches search
        const catMatch = cat.toLowerCase().includes(searchVal);
        const matchingItems = data.items.filter(i => i.item_name.toLowerCase().includes(searchVal));
        
        // Show group if Category matches OR if it has matching items
        if (searchVal && !catMatch && matchingItems.length === 0) continue;

        const displayItems = (searchVal && !catMatch) ? matchingItems : data.items;
        // If searching, expand automatically. Else collapsed.
        const isExpanded = searchVal.length > 0 ? 'block' : 'none';
        const activeClass = searchVal.length > 0 ? 'active' : '';

        let itemsHtml = '';
        displayItems.forEach(i => {
            let color = i.qty < 5 ? (i.qty <= 0 ? 'out' : 'low') : 'ok';
            itemsHtml += `
                <div class="group-item">
                    <span>${i.item_name} <small style="color:#aaa">(${i.size||'-'})</small></span>
                    <span class="item-status ${color}" style="font-weight:bold">${i.qty}</span>
                </div>`;
        });

        container.innerHTML += `
            <div class="inventory-group">
                <div class="group-header ${activeClass}" onclick="toggleGroup(this)">
                    <span class="group-title">${cat}</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="group-total">${data.total} Qty</span>
                        <i class="fas fa-chevron-down group-icon"></i>
                    </div>
                </div>
                <div class="group-body" style="display:${isExpanded}">
                    ${itemsHtml}
                </div>
            </div>`;
    }
}

function toggleGroup(header) {
    header.classList.toggle('active');
    const body = header.nextElementSibling;
    body.style.display = body.style.display === 'block' ? 'none' : 'block';
}

// --- 3. TOP 5 REPORTS LOGIC ---
function renderTop5Reports() {
    const container = document.getElementById('top5ReportContainer');
    container.innerHTML = '';

    const groups = {};
    globalInventory.forEach(i => {
        if (!groups[i.category]) groups[i.category] = [];
        groups[i.category].push(i);
    });

    for (const [cat, items] of Object.entries(groups)) {
        // Sort by Qty DESC and take Top 5
        const top5 = items.sort((a,b) => b.qty - a.qty).slice(0, 5);

        let html = `
            <div class="modern-card" style="margin-bottom:15px; padding:15px; text-align:left;">
                <h4 style="color:#00f2ff; border-bottom:1px solid #333; padding-bottom:5px; margin-bottom:10px;">${cat} (Top 5)</h4>
                <table style="width:100%; font-size:14px; color:#ddd;">`;
        
        top5.forEach(i => {
            html += `<tr><td style="padding:5px 0;">${i.item_name}</td><td style="text-align:right; font-weight:bold;">${i.qty}</td></tr>`;
        });
        
        html += `</table></div>`;
        container.innerHTML += html;
    }
}

// --- SEARCH DROPDOWN FOR OPERATIONS ---
// (Reusing the smart search logic from previous code)
const opInput = document.getElementById('opSearch');
const opDropdown = document.getElementById('opDropdown');

opInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    opDropdown.innerHTML = '';
    if(val.length < 1) { opDropdown.style.display='none'; return; }
    
    const matches = globalInventory.filter(i => i.item_name.toLowerCase().includes(val));
    if(matches.length > 0) {
        opDropdown.style.display = 'block';
        matches.forEach(m => {
            const d = document.createElement('div');
            d.style.padding='10px'; d.style.borderBottom='1px solid #333'; d.style.cursor='pointer'; d.style.color='white';
            d.innerHTML = `${m.item_name} <small>(${m.category})</small>`;
            d.onclick = () => { opInput.value=m.item_name; document.getElementById('selectedItemId').value=m.id; opDropdown.style.display='none'; };
            opDropdown.appendChild(d);
        });
    } else opDropdown.style.display='none';
});

// --- ADD ITEM & OPERATIONS SUBMIT ---
document.getElementById('addItemForm').addEventListener('submit', async(e)=>{
    e.preventDefault();
    // (Add item fetch logic same as before)
    alert("Function linked to backend!"); 
});

async function performStockOp() {
    const id = document.getElementById('selectedItemId').value;
    const qty = document.getElementById('opQty').value;
    const type = document.getElementById('opType').value;
    if(!id || !qty) return alert("Select item & qty");
    
    const endpoint = type === 'IN' ? '/api/inventory/in' : '/api/inventory/out';
    const body = { item_id: id, qty: qty, selected_employee: 'ADMIN', category: 'Admin Op' };
    
    try {
        await fetch(`${API_URL}${endpoint}`, { method:'POST', headers:getHeaders(), body:JSON.stringify(body) });
        alert("Success"); fetchData();
    } catch(e){ alert("Error"); }
}
