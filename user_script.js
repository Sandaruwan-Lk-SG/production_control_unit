// --- CONFIGURATION ---
const API_URL = "https://backpcu-production.up.railway.app"; 

// --- INITIALIZATION ---
window.onload = function() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');

    // Login වී නොමැති නම් එළියට දාන්න
    if (!token) {
        window.location.href = 'index.html';
    } else {
        // Login වී ඇත්නම් Employee නම් ටික පූරණය කරන්න
        loadEmployees();
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

// --- TAB NAVIGATION ---
function switchTab(id) {
    // Hide all sections
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    // Show selected section
    document.getElementById(`tab-${id}`).style.display = 'block';
    
    // Reset Sidebar Active State
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
    // Find the clicked li and make it active (Simple approximation)
    const activeBtn = document.querySelector(`li[onclick="switchTab('${id}')"]`);
    if(activeBtn) activeBtn.classList.add('active');

    // If "Stock List" tab is selected, load the data
    if(id === 'list') {
        loadUserInventory();
    }
}

// --- 1. LOAD EMPLOYEES ---
async function loadEmployees() {
    try {
        const res = await fetch(`${API_URL}/api/inventory/employees`, { headers: getHeaders() });
        const employees = await res.json();
        
        const select = document.getElementById('employeeName');
        select.innerHTML = '<option value="">-- Select Your Name --</option>';
        employees.forEach(emp => {
            select.innerHTML += `<option value="${emp.full_name}">${emp.full_name}</option>`;
        });
    } catch (e) {
        console.error("Employee Load Error", e);
        alert("Failed to load employee names. Please refresh.");
    }
}

// --- 2. STOCK LIST LOGIC (USER VIEW) ---
let userInventoryData = [];

async function loadUserInventory() {
    const tbody = document.getElementById('userInventoryTable');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Loading Stock Data...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/api/inventory/list`, { headers: getHeaders() });
        userInventoryData = await res.json(); // Store globally for searching
        renderUserTable(userInventoryData);
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Connection Error</td></tr>';
    }
}

function renderUserTable(data) {
    const tbody = document.getElementById('userInventoryTable');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">No Items Found</td></tr>';
        return;
    }

    data.forEach(i => {
        let status = '';
        if (i.qty <= 0) status = '<span style="color:#ff4d4d; font-weight:bold;">Out</span>';
        else if (i.qty < 5) status = '<span style="color:#ffb300; font-weight:bold;">Low</span>';
        else status = '<span style="color:#00e676; font-weight:bold;">Good</span>';

        tbody.innerHTML += `
            <tr>
                <td style="color:#aaa; font-size:12px;">${i.item_name} <br> <span style="color:#00f2ff">${i.category}</span></td>
                <td>${i.size || '-'}</td>
                <td style="font-size:1.1em; font-weight:bold; color:white;">${i.qty}</td>
                <td>${status}</td>
            </tr>
        `;
    });
}

// Search Logic for Stock List
document.getElementById('userListSearch').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const filtered = userInventoryData.filter(i => 
        i.item_name.toLowerCase().includes(val) || 
        i.category.toLowerCase().includes(val)
    );
    renderUserTable(filtered);
});


// --- 3. SMART SEARCH LOGIC (REUSABLE) ---
// This handles the dropdown search for In, Out, and Damage tabs
function setupSearch(inputId, dropdownId, boxId, nameId, catId, hiddenId, stockId = null, catInputId = null) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    
    input.addEventListener('input', async (e) => {
        const val = e.target.value;
        if(val.length < 1) { dropdown.style.display = 'none'; return; }

        try {
            const res = await fetch(`${API_URL}/api/inventory/search?query=${val}`, { headers: getHeaders() });
            const items = await res.json();
            
            dropdown.innerHTML = '';
            if(items.length > 0) {
                dropdown.style.display = 'block';
                items.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'dropdown-item';
                    div.innerHTML = `${item.item_name} <small>(${item.category})</small>`;
                    
                    div.onclick = () => {
                        // 1. Fill Input & Hidden Fields
                        input.value = item.item_name;
                        document.getElementById(hiddenId).value = item.id;
                        
                        // 2. Show Selected Box Details
                        document.getElementById(nameId).innerText = item.item_name;
                        if(catId) document.getElementById(catId).innerText = item.category;
                        document.getElementById(boxId).style.display = 'block';
                        
                        // 3. For Stock OUT: Check Qty & Line Order
                        if(stockId) document.getElementById(stockId).innerText = item.qty;
                        
                        if(catInputId) {
                            const catInput = document.getElementById(catInputId);
                            catInput.value = item.category;
                            
                            // Line Order Trigger
                            const lineBox = document.getElementById('lineOrderBox');
                            if(item.category === 'Line Order') {
                                lineBox.style.display = 'block';
                            } else {
                                lineBox.style.display = 'none';
                                document.getElementById('lineNumber').value = ''; // clear line number
                            }
                        }

                        // 4. Hide Dropdown
                        dropdown.style.display = 'none';
                    };
                    dropdown.appendChild(div);
                });
            } else {
                dropdown.style.display = 'none';
            }
        } catch(e) { console.error(e); }
    });
    
    // Hide dropdown if clicked outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// Initialize Search for tabs
setupSearch('inSearch', 'inDropdown', 'inSelectedBox', 'inItemName', 'inItemCat', 'inItemId');
setupSearch('outSearch', 'outDropdown', 'outSelectedBox', 'outItemName', 'outItemCat', 'outItemId', 'outCurrentQty', 'outCategory');
setupSearch('dmgSearch', 'dmgDropdown', 'dmgSelectedBox', 'dmgItemName', null, 'dmgItemId');


// --- 4. SUBMIT TRANSACTION (IN / OUT) ---
async function submitTransaction(type) {
    const employee = document.getElementById('employeeName').value;
    if(!employee) return alert("⚠️ Please select your name at the top!");

    const prefix = type === 'IN' ? 'in' : 'out';
    const itemId = document.getElementById(`${prefix}ItemId`).value;
    const qty = document.getElementById(`${prefix}Qty`).value;
    
    if(!itemId || !qty || qty <= 0) return alert("⚠️ Select an item and enter a valid quantity.");

    // Prepare Data
    const body = {
        item_id: itemId,
        qty: qty,
        selected_employee: employee,
        category: type === 'IN' ? 'Stock In' : document.getElementById('outCategory').value
    };

    // Special Checks for OUT
    if(type === 'OUT') {
        const currentQty = parseInt(document.getElementById('outCurrentQty').innerText);
        if(parseInt(qty) > currentQty) {
            return alert(`❌ Stock Not Available! Max: ${currentQty}`);
        }

        // Line Order Check
        if(body.category === 'Line Order') {
            const lineNo = document.getElementById('lineNumber').value;
            if(!lineNo) return alert("⚠️ Line Number is required for Line Orders!");
            body.line_number = lineNo;
        }
    } else {
        // Optional Size for IN
        const size = document.getElementById('inSize').value;
        if(size) body.size = size;
    }

    // Button Animation
    const btn = event.target;
    const oldText = btn.innerHTML;
    btn.innerHTML = "Processing...";
    btn.disabled = true;

    try {
        const endpoint = type === 'IN' ? '/api/inventory/in' : '/api/inventory/out';
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
        });

        const result = await res.json();

        if(res.ok) {
            alert(`✅ Success: Stock ${type} Complete!`);
            location.reload(); // Refresh page to clear forms
        } else {
            alert("❌ Error: " + (result.error || "Transaction Failed"));
        }
    } catch(e) {
        alert("❌ Server Connection Error");
    }
    
    // Reset Button
    btn.innerHTML = oldText;
    btn.disabled = false;
}


// --- 5. SUBMIT DAMAGE REPORT ---
async function submitDamage() {
    const employee = document.getElementById('employeeName').value;
    if(!employee) return alert("⚠️ Please select your name!");

    const itemId = document.getElementById('dmgItemId').value;
    const type = document.getElementById('dmgType').value;
    const qty = document.getElementById('dmgQty').value;
    const note = document.getElementById('dmgNote').value;

    if(!itemId || !qty || qty <= 0) return alert("⚠️ Select item and enter quantity.");

    if(!confirm("⚠️ Are you sure? This will remove stock immediately and notify Admins.")) return;

    try {
        const res = await fetch(`${API_URL}/api/inventory/report`, {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({
                item_id: itemId, qty: qty, type: type, 
                selected_employee: employee, note: note
            })
        });
        
        const result = await res.json();

        if(res.ok) {
            alert("✅ Report Submitted to Admin!");
            location.reload();
        } else {
            alert("❌ Error: " + result.error);
        }
    } catch(e) { alert("Server Error"); }
}
