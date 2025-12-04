const API_URL = "https://backpcu-production.up.railway.app"; 

// Global Data
let inventoryData = [];

// --- Init ---
window.onload = function() {
    if (!localStorage.getItem('token') || localStorage.getItem('userRole') !== 'admin') {
        window.location.href = 'index.html';
    } else {
        fetchInitialData();
        setInterval(fetchInitialData, 5000); // Live Update
    }
};

function getHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` };
}
function logout() { localStorage.clear(); window.location.href = 'index.html'; }
function switchTab(id) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById(`tab-${id}`).style.display = 'block';
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
}

// --- CORE DATA FETCHING ---
async function fetchInitialData() {
    try {
        const resInv = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`, { headers: getHeaders() });
        inventoryData = await resInv.json();

        const resDmg = await fetch(`${API_URL}/api/admin/stats?type=DAMAGES`, { headers: getHeaders() });
        const damages = await resDmg.json();

        updateDashboard(inventoryData, damages);
    } catch (err) { console.error(err); }
}

function updateDashboard(inv, dmg) {
    // 1. CATEGORY BREAKDOWN (New Feature)
    const catGrid = document.getElementById('categoryGrid');
    const categories = {};
    
    // දත්ත වෙන් කරගැනීම
    inv.forEach(i => {
        if (!categories[i.category]) {
            categories[i.category] = { total: 0, low: 0, out: 0, items: 0 };
        }
        categories[i.category].items += 1; // අයිටම් වර්ග ගණන
        categories[i.category].total += i.qty; // මුළු බඩු ගණන
        if (i.qty > 0 && i.qty < 5) categories[i.category].low += 1;
        if (i.qty <= 0) categories[i.category].out += 1;
    });

    // Grid එක හැදීම
    catGrid.innerHTML = '';
    for (const [cat, data] of Object.entries(categories)) {
        let statusColor = data.low > 0 ? 'orange' : (data.out > 0 ? 'red' : '#00f2ff');
        catGrid.innerHTML += `
            <div class="cat-card" style="border-left: 4px solid ${statusColor}">
                <div>
                    <h4>${cat}</h4>
                    <span class="cat-stat">Types: ${data.items}</span> | 
                    <span class="cat-stat" style="color:${data.out>0?'red':'#aaa'}">Out: ${data.out}</span>
                </div>
                <div class="cat-count">${data.total}</div>
            </div>
        `;
    }

    // 2. STAGNANT ITEMS CHECK (> 2 Days) (New Feature)
    const stagnantContainer = document.getElementById('stagnantContainer');
    const stagnantList = document.getElementById('stagnantList');
    stagnantList.innerHTML = '';
    
    const now = new Date();
    let hasStagnant = false;

    inv.forEach(i => {
        // අන්තිමට Update වුනු වෙලාව
        const lastUpdate = new Date(i.last_updated_at);
        // දවස් ගණන බැලීම (Time Difference)
        const diffTime = Math.abs(now - lastUpdate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        // දවස් 2කට වඩා වැඩි නම් සහ Stock තියෙනවා නම් (Stock 0 නම් අවුලක් නෑනේ)
        if (diffDays > 2 && i.qty > 0) {
            hasStagnant = true;
            stagnantList.innerHTML += `
                <span class="stagnant-item" title="Last Active: ${diffDays} days ago">
                    ${i.item_name} (${i.qty}) - ${diffDays} Days
                </span>
            `;
        }
    });

    stagnantContainer.style.display = hasStagnant ? 'block' : 'none';


    // 3. DAMAGE TABLE RENDER
    const dmgBody = document.getElementById('damageTable');
    if(dmg.length === 0) {
        dmgBody.innerHTML = '<tr><td colspan="6" style="text-align:center">✅ No Pending Issues</td></tr>';
    } else {
        dmgBody.innerHTML = '';
        dmg.forEach(d => {
            dmgBody.innerHTML += `
                <tr>
                    <td>${new Date(d.reported_at).toLocaleDateString()}</td>
                    <td>${d.item_name}</td>
                    <td style="color:${d.damage_type==='DAMAGE'?'red':'orange'}">${d.damage_type}</td>
                    <td>${d.damage_qty}</td>
                    <td>${d.reported_by}</td>
                    <td>
                        <button class="btn-resolve approve" onclick="resolveIssue(${d.id}, 'REPLACE')">Replace</button>
                        <button class="btn-resolve reject" onclick="resolveIssue(${d.id}, 'REMOVE')">Remove</button>
                    </td>
                </tr>`;
        });
    }

    // Inventory Table Update (if visible)
    if(document.getElementById('tab-inventory').style.display === 'block') {
        renderInventory(inv);
    }
}

// --- Other Logic (Search, Add Item, Reports) ---
// (මේ කොටස් පරණ විදියටම තියන්න, මම කෙටියෙන් දාන්නම්)

const searchInput = document.getElementById('smartSearch');
const resultsBox = document.getElementById('searchResults');

searchInput.addEventListener('keyup', (e) => {
    const val = e.target.value.toLowerCase();
    resultsBox.innerHTML = '';
    if(val.length < 1) { resultsBox.style.display = 'none'; renderInventory(inventoryData); return; }

    const matches = inventoryData.filter(i => i.item_name.toLowerCase().includes(val) || (i.sku && i.sku.toLowerCase().includes(val)));
    
    if(matches.length > 0) {
        resultsBox.style.display = 'block';
        matches.forEach(m => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.innerHTML = `<b>${m.item_name}</b> <small>${m.category}</small>`;
            div.onclick = () => {
                searchInput.value = m.item_name;
                resultsBox.style.display = 'none';
                renderInventory([m]);
            };
            resultsBox.appendChild(div);
        });
    } else { resultsBox.style.display = 'none'; }
});

function renderInventory(data) {
    const tbody = document.getElementById('inventoryTable');
    tbody.innerHTML = '';
    data.forEach(i => {
        let status = i.qty <= 0 ? '<span style="color:red">Out</span>' : (i.qty < 5 ? '<span style="color:orange">Low</span>' : '<span style="color:#00ff88">Ok</span>');
        tbody.innerHTML += `<tr><td>${i.category}</td><td>${i.item_name}</td><td>${i.size||'-'}</td><td>${i.qty}</td><td>${status}</td><td><button onclick="manualEdit(${i.id},${i.qty})" class="btn-resolve" style="background:#ddd;color:black">Edit</button></td></tr>`;
    });
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
    const result = await res.json();
    if(res.ok) { alert("Item Added!"); document.getElementById('addItemForm').reset(); fetchInitialData(); }
    else { alert(result.error); }
});

async function resolveIssue(id, decision) {
    if(!confirm('Confirm?')) return;
    await fetch(`${API_URL}/api/admin/resolve-damage`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ report_id: id, decision }) });
    fetchInitialData();
}

async function manualEdit(id, currentQty) {
    const newQty = prompt("New Qty:", currentQty);
    if(newQty && !isNaN(newQty)) {
        await fetch(`${API_URL}/api/admin/manual-update`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ item_id: id, new_qty: newQty }) });
        fetchInitialData();
    }
}

async function loadReports(type) {
    const container = document.getElementById('reportContent');
    container.innerHTML = 'Loading...';
    if(type === 'NORMAL') {
        const grouped = {};
        inventoryData.forEach(i => { if(!grouped[i.category]) grouped[i.category]=[]; grouped[i.category].push(i); });
        let html = '';
        for(const [cat, items] of Object.entries(grouped)) {
            html += `<h4 style="color:#00f2ff; margin-top:15px; border-bottom:1px solid #333">${cat}</h4><table class="glass-table">`;
            items.forEach(x => html += `<tr><td>${x.item_name}</td><td>${x.size||'-'}</td><td>${x.qty}</td></tr>`);
            html += `</table>`;
        }
        container.innerHTML = html;
    } else {
        const res = await fetch(`${API_URL}/api/admin/stats?type=ADVANCE`, { headers: getHeaders() });
        const logs = await res.json();
        let html = `<table class="glass-table"><tr><th>Time</th><th>Action</th><th>Item</th><th>Qty</th><th>User</th></tr>`;
        logs.forEach(l => {
            let c = l.action_type==='IN'?'#00ff88':(l.action_type==='OUT'?'orange':'red');
            html += `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td style="color:${c}">${l.action_type}</td><td>${l.item_name_snapshot}</td><td>${l.qty_changed}</td><td>${l.user_name}</td></tr>`;
        });
        html += `</table>`;
        container.innerHTML = html;
    }
}
