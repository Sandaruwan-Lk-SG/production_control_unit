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

@@ -37,20 +43,12 @@
}

function updateUI(inv, dmg) {
    // 1. CATEGORY BREAKDOWN CARDS (අලුත් ක්‍රමය)
    // 1. CATEGORY BREAKDOWN
    const catGrid = document.getElementById('categoryGrid');
    const categories = { 
        'Packing': 0, 'Insole': 0, 'Sole': 0, 
        'Upper': 0, 'Cut Insole': 0, 'Cut Upper': 0, 'Line Order': 0 
    };
    const categories = {};
    inv.forEach(i => {
        if (categories[i.category] !== undefined) {
            categories[i.category] += i.qty;
        } else {
            // ලිස්ට් එකේ නැති අලුත් කැටගරි එකක් නම්
            categories[i.category] = i.qty;
        }
        if (!categories[i.category]) categories[i.category] = 0;
        categories[i.category] += i.qty;
    });

    catGrid.innerHTML = '';
@@ -59,36 +57,24 @@
            <div class="cat-card">
                <div class="cat-title">${catName}</div>
                <div class="cat-count">${totalQty}</div>
            </div>
        `;
            </div>`;
    }

    // 2. STAGNANT ITEMS ALERT (දවස් 2ක් පරණ බඩු)
    // 2. STAGNANT ITEMS (> 2 Days)
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
        const diffDays = Math.ceil(Math.abs(now - lastUpdate) / (1000 * 60 * 60 * 24)); 
        if (diffDays > 2 && i.qty > 0) {
            hasStagnant = true;
            stagnantList.innerHTML += `
                <div class="stagnant-badge" title="Last Active: ${diffDays} days ago">
                    <i class="fas fa-clock"></i> ${i.item_name} (${i.qty})
                </div>
            `;
            stagnantList.innerHTML += `<div class="stagnant-badge"><i class="fas fa-clock"></i> ${i.item_name} (${i.qty})</div>`;
        }
    });
    stagnantBox.style.display = hasStagnant ? 'block' : 'none';

    // 3. DAMAGE TABLE
@@ -103,19 +89,56 @@
        });
    }

    // 4. INVENTORY TABLE
    // 4. INVENTORY SUMMARY LIVE UPDATE
    // If user is currently looking at inventory tab, update it live (respecting search)
    if(document.getElementById('tab-inventory').style.display === 'block') {
        const iTable = document.getElementById('inventoryTable');
        iTable.innerHTML = '';
        inv.forEach(i => {
            let status = i.qty <= 0 ? 'Out' : (i.qty < 5 ? 'Low' : 'Ok');
            iTable.innerHTML += `<tr><td>${i.category}</td><td>${i.item_name}</td><td>${i.size||'-'}</td><td>${i.qty}</td><td>${status}</td>
            <td><button onclick="manualUpdate(${i.id}, ${i.qty})" class="btn-action">Edit</button></td></tr>`;
        });
        const searchVal = document.getElementById('inventorySearchInput').value.toLowerCase();
        const filtered = searchVal ? globalInventory.filter(i => i.item_name.toLowerCase().includes(searchVal)) : globalInventory;
        renderInventorySummary(filtered);
    }
}

// --- SEARCH & OPERATIONS LOGIC (Keep same as before) ---
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
@@ -152,11 +175,11 @@
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
@@ -168,7 +191,6 @@
        if(dateTo && date > dateTo) return false;
        return true;
    };
    document.getElementById('itemReportSearch').style.display = (type === 'ITEM') ? 'block' : 'none';

    if (type === 'NORMAL') {
@@ -198,6 +220,7 @@
    }
}

// --- ADD ITEM & RESOLVE ---
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
@@ -215,7 +238,3 @@
    await fetch(`${API_URL}/api/admin/resolve-damage`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ report_id: id, decision: dec }) });
    fetchData();
}
async function manualUpdate(id, curr) {
    const q = prompt("New Qty:", curr);
    if(q) { await fetch(`${API_URL}/api/admin/manual-update`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ item_id: id, new_qty: q }) }); fetchData(); }
}
