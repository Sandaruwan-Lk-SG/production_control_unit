const API_URL = "https://backpcu-production.up.railway.app"; 

// --- INIT ---
window.onload = function() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');

    // Login වෙලාද බලනවා (User කෙනෙක්ද කියලත් බලනවා)
    if (!token) {
        window.location.href = 'index.html';
    } else {
        loadEmployees(); // නම් ටික ගන්නවා
    }
};

function getHeaders() {
    return { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${localStorage.getItem('token')}` 
    };
}

function logout() { localStorage.clear(); window.location.href = 'index.html'; }

function switchTab(id) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById(`tab-${id}`).style.display = 'block';
    
    // Bottom Nav Active Color
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
    // Simple active check logic based on click context
    event.currentTarget.classList.add('active');
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
    } catch (e) { console.error("Employee Load Error", e); }
}

// --- 2. SMART SEARCH LOGIC (Reusable) ---
function setupSearch(inputId, dropdownId, boxId, nameId, catId, hiddenId, stockId = null, catInputId = null) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    
    input.addEventListener('input', async (e) => {
        const val = e.target.value;
        if(val.length < 1) { dropdown.style.display = 'none'; return; }

        // Backend එකෙන් Item හොයනවා
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
                        // Select Item Logic
                        input.value = item.item_name;
                        document.getElementById(hiddenId).value = item.id;
                        document.getElementById(nameId).innerText = item.item_name;
                        if(catId) document.getElementById(catId).innerText = item.category;
                        document.getElementById(boxId).style.display = 'block';
                        
                        // For Stock OUT - Check Qty & Category
                        if(stockId) document.getElementById(stockId).innerText = item.qty;
                        if(catInputId) {
                            const catInput = document.getElementById(catInputId);
                            catInput.value = item.category;
                            
                            // Line Order Logic
                            const lineBox = document.getElementById('lineOrderBox');
                            if(item.category === 'Line Order') {
                                lineBox.style.display = 'block';
                            } else {
                                lineBox.style.display = 'none';
                            }
                        }

                        dropdown.style.display = 'none';
                    };
                    dropdown.appendChild(div);
                });
            } else {
                dropdown.style.display = 'none';
            }
        } catch(e) { console.error(e); }
    });
}

// Setup Search for 3 Tabs
setupSearch('inSearch', 'inDropdown', 'inSelectedBox', 'inItemName', 'inItemCat', 'inItemId');
setupSearch('outSearch', 'outDropdown', 'outSelectedBox', 'outItemName', 'outItemCat', 'outItemId', 'outCurrentQty', 'outCategory');
setupSearch('dmgSearch', 'dmgDropdown', 'dmgSelectedBox', 'dmgItemName', null, 'dmgItemId');


// --- 3. SUBMIT TRANSACTION (IN / OUT) ---
async function submitTransaction(type) {
    const employee = document.getElementById('employeeName').value;
    if(!employee) return alert("⚠️ Please select your name first!");

    const prefix = type === 'IN' ? 'in' : 'out';
    const itemId = document.getElementById(`${prefix}ItemId`).value;
    const qty = document.getElementById(`${prefix}Qty`).value;
    
    if(!itemId || !qty || qty <= 0) return alert("⚠️ Please select item and enter valid quantity.");

    const body = {
        item_id: itemId,
        qty: qty,
        selected_employee: employee,
        category: type === 'IN' ? 'Stock In' : document.getElementById('outCategory').value
    };

    // Special Logic for OUT
    if(type === 'OUT') {
        const currentQty = parseInt(document.getElementById('outCurrentQty').innerText);
        if(parseInt(qty) > currentQty) {
            return alert(`⚠️ Error: Not enough stock! Available: ${currentQty}`);
        }

        // Line Order Check
        if(body.category === 'Line Order') {
            const lineNo = document.getElementById('lineNumber').value;
            if(!lineNo) return alert("⚠️ Please enter Line Number for Line Order!");
            body.line_number = lineNo; // Add line number to request
        }
    } else {
        // IN Logic (Size)
        const size = document.getElementById('inSize').value;
        // Size is mainly for new items, but we can log it if needed. 
        // For existing items, size is usually fixed.
    }

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
            alert(`✅ Stock ${type} Successful!`);
            location.reload(); // Refresh to clear form
        } else {
            alert("❌ Error: " + result.error);
        }
    } catch(e) {
        alert("Server Error");
    }
    btn.innerHTML = oldText;
    btn.disabled = false;
}

// --- 4. SUBMIT DAMAGE REPORT ---
async function submitDamage() {
    const employee = document.getElementById('employeeName').value;
    if(!employee) return alert("Select your name!");

    const itemId = document.getElementById('dmgItemId').value;
    const type = document.getElementById('dmgType').value;
    const qty = document.getElementById('dmgQty').value;

    if(!itemId || !qty) return alert("Select item and quantity.");

    if(!confirm("Are you sure you want to report this? Admins will be notified.")) return;

    try {
        const res = await fetch(`${API_URL}/api/inventory/report`, {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({
                item_id: itemId, qty: qty, type: type, selected_employee: employee
            })
        });
        
        if(res.ok) {
            alert("✅ Report Submitted to Admin!");
            location.reload();
        } else {
            alert("Error reporting issue.");
        }
    } catch(e) { alert("Server Error"); }
}
