// --- CONFIGURATION ---
const API_URL = "https://backpcu-production.up.railway.app"; 

// --- GLOBAL DATA STORE ---
let globalInventory = [];
let globalLogs = [];
let selectedRepItemName = '';
let chartInstance = null; // Chart.js instance

// --- 1. INITIALIZATION ---
window.onload = function() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');

    if (!token || role !== 'admin') {
        window.location.href = 'index.html';
    } else {
        fetchData(); 
        setInterval(fetchData, 5000); 
    }
    switchTab('overview'); 
};

// --- HELPER FUNCTIONS ---

/**
 * ⭐️ NEW HELPER: Cleans a string to be safely passed into an HTML onclick attribute.
 * Removes line breaks, tabs, and quotes that would break the JavaScript call.
 */
function cleanString(str) {
    if (!str) return '';
    // 1. Double quotes (") and Single quotes (') ඉවත් කිරීම.
    let cleaned = String(str).replace(/"/g, '').replace(/'/g, ''); 
    // 2. Line breaks සහ tabs ඉවත් කිරීම (onclick attribute එක කැඩීම වැලැක්වීමට).
    cleaned = cleaned.replace(/(\r\n|\n|\r|\t)/gm, ' '); 
    return cleaned.trim();
}


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
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById(`tab-${id}`).style.display = 'block';
    
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
    const activeBtn = document.querySelector(`li[onclick="switchTab('${id}')"]`);
    if(activeBtn) activeBtn.classList.add('active');

    if(id === 'inventory') {
        document.getElementById('inventorySearchInput').value = ''; 
        renderInventorySummary(globalInventory);
    }
    if(id === 'reports') {
        const defaultBtn = document.querySelector('.tab-btn.active');
        if (defaultBtn) defaultBtn.click();
    }
}

// --- 2. CORE DATA FETCHING (DASHBOARD) ---
async function fetchData() {
    try {
        const resInv = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`, { headers: getHeaders() });
        globalInventory = await resInv.json();

        const resDmg = await fetch(`${API_URL}/api/admin/stats?type=DAMAGES`, { headers: getHeaders() });
        const damages = await resDmg.json();
        
        const resLogs = await fetch(`${API_URL}/api/admin/stats?type=ADVANCE`, { headers: getHeaders() });
        globalLogs = await resLogs.json(); 

        updateDashboardUI(globalInventory, damages);
        updateLastActivity(); 

    } catch (e) { console.error("Data Load Error", e); }
}

function updateLastActivity() {
    const lastActivityElement = document.getElementById('lastActivityInfo');
    if(!lastActivityElement) return;

    if (globalLogs.length > 0) {
        const lastLog = globalLogs[0]; 
        const time = new Date(lastLog.timestamp).toLocaleString();
        lastActivityElement.innerHTML = `
            <i class="fas fa-history"></i> <strong>Last Activity:</strong> ${lastLog.item_name_snapshot} (${lastLog.action_type}) by ${lastLog.user_name} at ${time}
        `;
    } else {
         lastActivityElement.innerHTML = `<i class="fas fa-history"></i> No recent activity found.`;
    }
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
            <div class="cat-card" onclick="switchTab('inventory'); filterInventoryByCategory('${catName}')">
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
            
            // ⭐️ Note එක safe කිරීමට cleanString භාවිත කරන්න
            const safeNote = cleanString(d.note || 'No note provided.');

            dTable.innerHTML += `
                <tr onclick="showDamageDetails(${d.id}, 
                                  '${d.item_name}', 
                                  '${d.category}', 
                                  ${d.damage_qty}, 
                                  '${d.reported_by}', 
                                  '${d.reported_at}', 
                                  '${safeNote}')">
                    <td>${new Date(d.reported_at).toLocaleDateString()}</td>
                    <td>${d.item_name} <br><small>${d.category}</small></td>
                    <td>${typeBadge}</td>
                    <td style="font-size:1.1em; font-weight:bold">${d.damage_qty}</td>
                    <td>${d.reported_by}</td>
                    <td>
                        <button class="btn-action btn-approve" onclick="event.stopPropagation(); resolve(${d.id},'REPLACE')">Replace</button>
                        <button class="btn-action btn-reject" onclick="event.stopPropagation(); resolve(${d.id},'REMOVE')">Remove</button>
                    </td>
                </tr>`;
        });
    }

    // D. LIVE UPDATE INVENTORY LIST
    if(document.getElementById('tab-inventory').style.display === 'block') {
        const searchVal = document.getElementById('inventorySearchInput').value.toLowerCase();
        const filtered = searchVal ? globalInventory.filter(i => 
            i.item_name.toLowerCase().includes(searchVal) || 
            i.category.toLowerCase().includes(searchVal)
        ) : globalInventory;
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

function filterInventoryByCategory(categoryName) {
    const searchInput = document.getElementById('inventorySearchInput');
    searchInput.value = categoryName; 
    const filtered = globalInventory.filter(i => i.category.toLowerCase().includes(categoryName.toLowerCase()));
    renderInventorySummary(filtered);
}


function renderInventorySummary(data) {
    const tbody = document.getElementById('inventoryTable');
    tbody.innerHTML = '';
    
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
        
        // Size column removed from summary table
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

        const uniqueItems = Array.from(new Set(globalInventory.map(i => i.item_name)));
        const matches = uniqueItems.filter(name => name.toLowerCase().includes(val));
        
        if(matches.length > 0) {
            dropdown.style.display = 'block';
            matches.forEach(name => {
                const item = globalInventory.find(i => i.item_name === name); 
                const div = document.createElement('div');
                div.className = 'dropdown-item';
                div.innerHTML = `${name} <small>(${item.category})</small>`;
                div.onclick = () => { 
                    input.value = name; 
                    dropdown.style.display = 'none'; 
                    onSelect(item); 
                };
                dropdown.appendChild(div);
            });
        } else { 
            dropdown.style.display = 'none'; 
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

setupSmartSearch('opSearch', 'opDropdown', (item) => { 
    document.getElementById('selectedItemId').value = item.id; 
});
setupSmartSearch('repItemSearch', 'repDropdown', (item) => { 
    selectedRepItemName = item.item_name; 
    loadReport('ITEM', null); 
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
            document.getElementById('opSearch').value = '';
            document.getElementById('opQty').value = '';
        } else { 
            const j = await res.json(); 
            alert("Error: " + j.error); 
        }
    } catch(e) { alert("Server Error"); }
}

// --- 6. REPORTS SYSTEM ---

function loadReport(type, event) {
    const output = document.getElementById('reportOutput');
    const chartContainer = document.getElementById('chartContainer');
    const kpiGrid = document.getElementById('kpiGrid');
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    chartContainer.style.display = 'none';
    kpiGrid.style.display = 'none';
    
    // Toggle Active Buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(event) event.target.classList.add('active');
    else document.querySelector(`[onclick="loadReport('${type}', event)"]`).classList.add('active');

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
        
        chartContainer.style.display = 'block';
        const chartData = {
            labels: Object.keys(grouped),
            datasets: [{
                data: Object.keys(grouped).map(cat => grouped[cat].reduce((sum, item) => sum + item.qty, 0)),
                backgroundColor: ['#00f2ff', '#ffb300', '#00e676', '#ff4d4d', '#1845ad', '#ff0055', '#AAAAAA'],
            }]
        };
        renderChart('pie', chartData, 'Inventory Breakdown by Category');

        let html = '';
        for(const [cat, items] of Object.entries(grouped)) {
            html += `<h4 style="color:#00f2ff; margin-top:15px; border-bottom:1px solid #333">${cat} (Total: ${items.reduce((sum, item) => sum + item.qty, 0)})</h4><table class="glass-table"><tr><th>Item</th><th>Qty</th></tr>`;
            items.forEach(x => html += `<tr><td>${x.item_name}</td><td>${x.qty}</td></tr>`);
            html += `</table>`;
        }
        output.innerHTML = html;

    } else if (type === 'ADVANCE') {
        const filtered = globalLogs.filter(l => isInRange(l.timestamp));
        
        kpiGrid.style.display = 'grid';
        chartContainer.style.display = 'block';
        
        const totalIn = filtered.filter(l => l.action_type === 'IN').reduce((sum, l) => sum + l.qty_changed, 0);
        const totalOut = filtered.filter(l => l.action_type === 'OUT').reduce((sum, l) => sum + l.qty_changed, 0);
        const netChange = totalIn - totalOut;

        document.getElementById('kpiIn').innerText = totalIn;
        document.getElementById('kpiOut').innerText = totalOut;
        document.getElementById('kpiNet').innerText = netChange;
        document.getElementById('kpiNet').style.color = netChange >= 0 ? '#00e676' : '#ff4d4d';


        const dailyData = filtered.reduce((acc, log) => {
            const date = new Date(log.timestamp).toLocaleDateString('en-US');
            if (!acc[date]) acc[date] = { IN: 0, OUT: 0 };
            acc[date][log.action_type] += log.qty_changed;
            return acc;
        }, {});

        const dates = Object.keys(dailyData).sort((a, b) => new Date(a) - new Date(b));
        const chartData = {
            labels: dates,
            datasets: [
                {
                    label: 'Stock IN',
                    data: dates.map(date => dailyData[date].IN),
                    borderColor: '#00e676',
                    tension: 0.1
                },
                {
                    label: 'Stock OUT',
                    data: dates.map(date => dailyData[date].OUT),
                    borderColor: '#ff4d4d',
                    tension: 0.1
                }
            ]
        };
        renderChart('line', chartData, 'Daily Stock Movement');

        let html = `<table class="glass-table"><tr><th>Date/Time</th><th>Action</th><th>Item</th><th>Qty</th><th>User</th></tr>`;
        filtered.forEach(l => {
            let color = l.action_type==='IN'?'#00ff88':(l.action_type==='OUT'?'orange':'red');
            html += `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td style="color:${color}">${l.action_type}</td><td>${l.item_name_snapshot}</td><td>${l.qty_changed}</td><td>${l.user_name}</td></tr>`;
        });
        output.innerHTML = html + '</table>';

    } else if (type === 'ITEM') {
        if(!selectedRepItemName) { output.innerHTML = '<p style="text-align:center">Please search and select an item above.</p>'; return; }
        const filtered = globalLogs.filter(l => l.item_name_snapshot === selectedRepItemName && isInRange(l.timestamp));
        
        chartContainer.style.display = 'block';
        const historyData = filtered.map(l => ({ 
            x: new Date(l.timestamp).toLocaleString(), 
            y: l.action_type === 'IN' ? l.qty_changed : -l.qty_changed 
        }));

        const chartData = {
            labels: historyData.map(d => d.x),
            datasets: [{
                label: 'Qty Change',
                data: historyData.map(d => d.y),
                backgroundColor: historyData.map(d => d.y > 0 ? '#00e676' : '#ff4d4d'),
                type: 'bar',
            }]
        };
        renderChart('bar', chartData, `History: ${selectedRepItemName}`);
        
        let html = `<h3>History: ${selectedRepItemName}</h3><table class="glass-table"><tr><th>Date/Time</th><th>Action</th><th>Qty</th><th>User</th></tr>`;
        filtered.forEach(l => { html += `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td>${l.action_type}</td><td>${l.qty_changed}</td><td>${l.user_name}</td></tr>`; });
        output.innerHTML = html + '</table>';
    }
}

function renderChart(type, data, title) {
    if (chartInstance) {
        chartInstance.destroy(); 
    }
    const ctx = document.getElementById('reportChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: type,
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, color: 'white', font: { size: 16 } },
                legend: { labels: { color: 'white' } }
            },
            scales: {
                x: { ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                y: { ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });
}


// --- 7. OTHER ACTIONS (Add, Resolve, Modal) ---
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        item_name: document.getElementById('itemName').value,
        sku: document.getElementById('itemSku').value,
        category: document.getElementById('itemCategory').value,
        size: '' 
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

// Damage Modal Functions
function showDamageDetails(id, item, category, qty, by, date, note) {
    const modal = document.getElementById('damageModal');
    
    document.getElementById('modalTitle').innerText = `${item} (${category})`;
    document.getElementById('modalDate').innerText = new Date(date).toLocaleString();
    document.getElementById('modalQty').innerText = qty;
    document.getElementById('modalBy').innerText = by;
    // ⭐️ පිරිසිදු කළ Note එක මෙහි පෙන්වයි
    document.getElementById('modalNote').innerText = note; 
    
    document.getElementById('modalReplaceBtn').onclick = () => { resolve(id, 'REPLACE'); hideModal(); };
    document.getElementById('modalRemoveBtn').onclick = () => { resolve(id, 'REMOVE'); hideModal(); };

    modal.style.display = 'flex';
}

function hideModal() {
    document.getElementById('damageModal').style.display = 'none';
}
