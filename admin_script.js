// --- CONFIGURATION ---
const API_URL = "https://backpcu-production.up.railway.app"; 

// --- GLOBAL DATA STORE ---
let globalInventory = [];
let globalLogs = [];
let selectedRepItemName = '';
let chartInstance = null; // Chart.js instance

// --- additional globals for stagnant rotation ---
let stagnantRotateInterval = null;

// helper: produce yyyy-mm-dd for consistent date-only comparisons
function dateOnly(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

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
    let cleaned = String(str).replace(/"/g, '').replace(/'/g, ''); 
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
    const target = document.getElementById(`tab-${id}`);
    if (target) target.style.display = 'block';
    
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
    // A. CATEGORY BREAKDOWN CARDS (group by category)
    const catGrid = document.getElementById('categoryGrid');
    const categories = {};
    
    inv.forEach(i => {
        if (!categories[i.category]) categories[i.category] = 0;
        categories[i.category] += i.qty;
    });

    // compute number of distinct item names per category
    const itemsPerCategory = {};
    inv.forEach(i => {
        if (!itemsPerCategory[i.category]) itemsPerCategory[i.category] = new Set();
        itemsPerCategory[i.category].add(i.item_name);
    });

    catGrid.innerHTML = '';
    for (const [catName, totalQty] of Object.entries(categories)) {
        const distinctCount = itemsPerCategory[catName] ? itemsPerCategory[catName].size : 0;
        catGrid.innerHTML += `
            <div class="cat-card" onclick="switchTab('inventory'); filterInventoryByCategory('${catName.replace(/'/g,"\\'")}')">
                <div class="cat-title" title="${catName}">${catName}</div>
                <div class="cat-meta">
                    <div class="cat-count">${totalQty}</div>
                    <div class="cat-items">${distinctCount} item${distinctCount !== 1 ? 's' : ''}</div>
                </div>
            </div>`;
    }

    // B. STAGNANT ITEMS ALERT (> 2 Days WITHOUT 'OUT' activity)
    const stagnantBox = document.getElementById('stagnantBox');
    const stagnantList = document.getElementById('stagnantItems');
    // remove previous warning text (we'll re-add if needed)
    const oldWarning = stagnantBox.querySelector('.stagnant-warning');
    if (oldWarning) oldWarning.remove();

    stagnantList.innerHTML = '';

    const now = new Date();
    const twoDaysAgoISO = dateOnly(new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000)));

    // Build a map of last OUT timestamp per item from globalLogs
    const lastOutMap = {};
    globalLogs.forEach(l => {
        if (l.action_type === 'OUT') {
            const key = l.item_name_snapshot;
            const ts = new Date(l.timestamp);
            if (!lastOutMap[key] || new Date(lastOutMap[key]) < ts) {
                lastOutMap[key] = ts.toISOString();
            }
        }
    });

    const stagnantItems = [];

    inv.forEach(i => {
        if (i.qty <= 0) return;
        const lastOutISO = lastOutMap[i.item_name];
        let isStagnant = false;
        if (!lastOutISO) {
            const lastUpd = i.last_updated_at ? dateOnly(i.last_updated_at) : null;
            if (!lastUpd || lastUpd <= twoDaysAgoISO) isStagnant = true;
        } else {
            if (dateOnly(lastOutISO) <= twoDaysAgoISO) isStagnant = true;
        }

        if (isStagnant) {
            stagnantItems.push({
                name: i.item_name,
                category: i.category,
                qty: i.qty,
                lastOut: lastOutISO || i.last_updated_at || 'N/A'
            });
        }
    });

    if (stagnantItems.length === 0) {
        stagnantBox.style.display = 'none';
        if (stagnantRotateInterval) { clearInterval(stagnantRotateInterval); stagnantRotateInterval = null; }
    } else {
        stagnantBox.style.display = 'block';

        const warningHtml = `<div class="stagnant-warning"><i class="fas fa-exclamation-circle"></i> Warning: No STOCK OUT recorded in the last 2 days for ${stagnantItems.length} item(s). Showing one at a time.</div>`;
        stagnantBox.insertAdjacentHTML('afterbegin', warningHtml);

        const badges = stagnantItems.map(si => {
            const title = `Category: ${si.category} • Last OUT: ${dateOnly(si.lastOut)}`;
            return `<div class="stagnant-badge" title="${title}"><i class="fas fa-clock"></i> ${si.name} (${si.qty})</div>`;
        });

        let index = 0;
        stagnantList.innerHTML = badges[index];

        if (stagnantRotateInterval) clearInterval(stagnantRotateInterval);
        stagnantRotateInterval = setInterval(() => {
            index = (index + 1) % badges.length;
            stagnantList.style.opacity = 0;
            setTimeout(() => {
                stagnantList.innerHTML = badges[index];
                stagnantList.style.opacity = 1;
            }, 220);
        }, 2000);
    }

    // C. PENDING DAMAGE TABLE
    const dTable = document.getElementById('damageTable');
    dTable.innerHTML = '';
    if (dmg.length === 0) {
        dTable.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">✅ No Pending Issues</td></tr>';
    } else {
        dmg.forEach(d => {
            const typeBadge = d.damage_type === 'DAMAGE' ? '<span style="color:#ff4d4d;font-weight:bold">DAMAGE</span>' : '<span style="color:#ffb300;font-weight:bold">SHORTAGE</span>';
            const safeNote = cleanString(d.note || 'No note provided.');

            dTable.innerHTML += `
                <tr onclick="showDamageDetails(${d.id}, 
                                  '${d.item_name.replace(/'/g,"\\'")}', 
                                  '${d.category.replace(/'/g,"\\'")}', 
                                  ${d.damage_qty}, 
                                  '${(d.reported_by || '').replace(/'/g,"\\'")}', 
                                  '${d.reported_at}', 
                                  '${safeNote.replace(/'/g,"\\'")}')">
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

    // Utility: inclusive date range check for timestamps (date-only)
    const inRange = (timestamp) => {
        if(!dateFrom && !dateTo) return true;
        const d = dateOnly(timestamp); // yyyy-mm-dd
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
    };

    chartContainer.style.display = 'none';
    kpiGrid.style.display = 'none';

    // Toggle Active Buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(event) event.target.classList.add('active');
    else {
        const fallback = document.querySelector(`[onclick="loadReport('${type}', event)"]`);
        if (fallback) fallback.classList.add('active');
    }

    document.getElementById('itemReportSearch').style.display = (type === 'ITEM') ? 'block' : 'none';

    if (type === 'NORMAL') {
        const catTotals = {};
        globalInventory.forEach(i => {
            if ( (dateFrom || dateTo) && i.last_updated_at) {
                if (!inRange(i.last_updated_at)) return;
            }
            if (!catTotals[i.category]) catTotals[i.category] = 0;
            catTotals[i.category] += i.qty;
        });

        let html = `<table class="glass-table"><thead><tr><th>Category</th><th>Total Qty</th></tr></thead><tbody>`;
        if (Object.keys(catTotals).length === 0) {
            html += `<tr><td colspan="2" style="text-align:center; padding:18px;">No categories found for selected range</td></tr>`;
        } else {
            for (const [cat, total] of Object.entries(catTotals)) {
                html += `<tr style="cursor:pointer" onclick="loadCategoryItems('${cat.replace(/'/g,"\\'")}')"><td style="font-weight:600">${cat}</td><td style="font-weight:700">${total}</td></tr>`;
            }
        }
        html += `</tbody></table>`;
        output.innerHTML = html;
        chartContainer.style.display = 'none';
    } else if (type === 'ADVANCE') {
        const filtered = globalLogs.filter(l => inRange(l.timestamp));

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
            const date = dateOnly(log.timestamp);
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
        const filtered = globalLogs.filter(l => l.item_name_snapshot === selectedRepItemName && inRange(l.timestamp));

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
    try {
        const res = await fetch(`${API_URL}/api/admin/add-item`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
        if(res.ok) { alert("✅ Item Added!"); document.getElementById('addItemForm').reset(); fetchData(); } 
        else { const j=await res.json(); alert("⚠️ " + j.error); }
    } catch (err) {
        alert("Server Error");
    }
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
    document.getElementById('modalNote').innerText = note; 
    
    document.getElementById('modalReplaceBtn').onclick = () => { resolve(id, 'REPLACE'); hideModal(); };
    document.getElementById('modalRemoveBtn').onclick = () => { resolve(id, 'REMOVE'); hideModal(); };

    modal.style.display = 'flex';
}

function hideModal() {
    const modal = document.getElementById('damageModal');
    modal.style.display = 'none';
} 

// Called when user clicks a category row in the NORMAL view
function loadCategoryItems(categoryName) {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;

    function inRangeDate(ts) {
        if(!dateFrom && !dateTo) return true;
        const d = dateOnly(ts);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
    }

    const items = globalInventory.filter(i => i.category === categoryName && (i.last_updated_at ? inRangeDate(i.last_updated_at) : true));
    const output = document.getElementById('reportOutput');

    if (items.length === 0) {
        output.innerHTML = `<p style="text-align:center; padding:18px;">No items found for <strong>${categoryName}</strong> in the selected date range.</p>`;
        return;
    }

    let html = `<h4 style="color:#00f2ff; margin-bottom:8px;">${categoryName} — Items (Total: ${items.reduce((s,i) => s + i.qty, 0)})</h4>`;
    html += `<table class="glass-table"><thead><tr><th>Item</th><th>Qty</th><th>Last Updated</th></tr></thead><tbody>`;
    items.forEach(it => {
        html += `<tr><td style="font-weight:600">${it.item_name}</td><td style="font-weight:700">${it.qty}</td><td>${it.last_updated_at ? new Date(it.last_updated_at).toLocaleString() : 'N/A'}</td></tr>`;
    });
    html += `</tbody></table>`;

    html = `<div style="margin-bottom:12px;"><button onclick="loadReport('NORMAL', null)" class="tab-btn" style="width:120px">← Back</button></div>` + html;
    output.innerHTML = html;
}
