const API_URL = "https://backpcu-production.up.railway.app"; 

// --- Global Data Store (ෆිල්ටර් කරන්න ලේසි වෙන්න) ---
let globalInventory = [];
let globalLogs = [];

// --- Init ---
window.onload = function() {
    if (localStorage.getItem('userRole') !== 'admin' || !localStorage.getItem('token')) {
        window.location.href = 'index.html';
    } else {
        fetchData(); // මුලින්ම Data ගන්න
        // LIVE UPDATE: සෑම තත්පර 5කට වරක් Data අලුත් කරන්න
        setInterval(fetchData, 5000); 
    }
};

function getAuthHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` };
}

// --- Navigation ---
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    
    // Reports Tab එකට ආවම Logs ගන්න
    if(id === 'reports') fetchLogs(); 
}

function logout() { localStorage.clear(); window.location.href = 'index.html'; }

// --- 1. CORE DATA FETCHING (Live) ---
async function fetchData() {
    try {
        const res = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`, { headers: getAuthHeaders() });
        if(!res.ok) return; // Error එකක් නම් නිකන් ඉන්න (Login out නොකර)
        
        globalInventory = await res.json();
        updateDashboardCards();
        
        // Active Filter එක අනුව Table එක update කරන්න
        const activeCard = document.querySelector('.glass-card.active-filter');
        if(activeCard) {
            // දැනට Filter එකක් දාලා නම් ඒකම තියන්න
            // (Code එක සංකීර්ණ නොවෙන්න අපි Default Table එක refresh කරමු, filter එක අයින් වෙයි Live update එකේදී. 
            // නමුත් User experience එකට අපි දැනට Default all පෙන්නමු)
             if(!activeCard.classList.contains('filtered-mode')) renderInventoryTable(globalInventory);
        } else {
            renderInventoryTable(globalInventory);
        }

    } catch (e) { console.error("Live Update Error", e); }
}

// --- 2. DASHBOARD INTERACTIVITY ---
function updateDashboardCards() {
    document.getElementById('totalItems').innerText = globalInventory.length;
    document.getElementById('lowStock').innerText = globalInventory.filter(i => i.qty < 5 && i.qty > 0).length;
    document.getElementById('outStock').innerText = globalInventory.filter(i => i.qty <= 0).length;
}

// කාඩ් එක Click කලහම වැඩ කරන කොටස
function filterDashboard(type, cardElement) {
    // 1. Visual Effect
    document.querySelectorAll('.glass-card').forEach(c => c.classList.remove('active-filter', 'filtered-mode'));
    cardElement.classList.add('active-filter', 'filtered-mode');

    // 2. Filter Logic
    let filteredData = [];
    if (type === 'ALL') filteredData = globalInventory;
    else if (type === 'LOW') filteredData = globalInventory.filter(i => i.qty < 5 && i.qty > 0);
    else if (type === 'OUT') filteredData = globalInventory.filter(i => i.qty <= 0);

    // 3. Render
    renderInventoryTable(filteredData);
}

function renderInventoryTable(data) {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';
    data.forEach(item => {
        let status = item.qty <= 0 ? '<span style="color:red">Out of Stock</span>' : 
                     (item.qty < 5 ? '<span style="color:orange">Low Stock</span>' : '<span style="color:#00e676">In Stock</span>');
        tbody.innerHTML += `<tr><td>${item.category}</td><td>${item.item_name}</td><td>${item.size||'-'}</td><td>${item.qty}</td><td>${status}</td></tr>`;
    });
}

// --- 3. ADD ITEM (With Error Handling) ---
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const oldText = btn.innerText;
    btn.innerText = "Checking...";

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
            fetchData(); // Refresh immediately
        } else {
            alert("⚠️ " + result.error); // Duplicate Error එක මෙතනින් එයි
        }
    } catch (e) { alert("Error!"); }
    btn.innerText = oldText;
});

// --- 4. ADVANCED REPORTS ---
async function fetchLogs() {
    try {
        const res = await fetch(`${API_URL}/api/admin/stats?type=ADVANCE`, { headers: getAuthHeaders() });
        globalLogs = await res.json();
        generateNormalReport(); // Default view
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

// A. Normal Report (Grouped by Category)
function generateNormalReport() {
    const container = document.getElementById('normalReportContent');
    container.innerHTML = '';

    // Grouping Logic
    const categories = {};
    globalInventory.forEach(item => {
        if(!categories[item.category]) categories[item.category] = [];
        categories[item.category].push(item);
    });

    // Create Tables per Category
    for (const [cat, items] of Object.entries(categories)) {
        let html = `<h4 style="color:#23a2f6; margin-top:15px; border-bottom:1px solid #555;">${cat}</h4>`;
        html += `<table class="glass-table" style="width:100%">`;
        items.forEach(i => {
            html += `<tr><td width="50%">${i.item_name}</td><td width="20%">${i.size||'-'}</td><td>Qty: <strong>${i.qty}</strong></td></tr>`;
        });
        html += `</table>`;
        container.innerHTML += html;
    }
}

// B. Advance Report (Full Log)
function generateAdvanceReport() {
    const tbody = document.getElementById('advanceReportTable');
    tbody.innerHTML = '';
    globalLogs.forEach(log => {
        let color = log.action_type === 'IN' ? 'green' : (log.action_type === 'OUT' ? 'orange' : 'red');
        tbody.innerHTML += `
            <tr>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td style="color:${color}">${log.action_type}</td>
                <td>${log.item_name_snapshot}</td>
                <td>${log.qty_changed}</td>
                <td>${log.user_name}</td>
                <td>${log.line_number || log.category}</td>
            </tr>`;
    });
}

// C. Item History Search
function searchItemHistory() {
    const query = document.getElementById('historySearchInput').value.toLowerCase();
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    if(query.length < 2) return;

    // Filter logs for this item name
    const matches = globalLogs.filter(l => l.item_name_snapshot.toLowerCase().includes(query));

    matches.forEach(log => {
        tbody.innerHTML += `
            <tr>
                <td>${new Date(log.timestamp).toLocaleDateString()} ${new Date(log.timestamp).toLocaleTimeString()}</td>
                <td>${log.action_type}</td>
                <td>${log.qty_changed}</td>
                <td>${log.user_name}</td>
                <td>Details: ${log.line_number || '-'}</td>
            </tr>`;
    });
    
    if(matches.length === 0) tbody.innerHTML = '<tr><td colspan="5">No history found for this item</td></tr>';
}
