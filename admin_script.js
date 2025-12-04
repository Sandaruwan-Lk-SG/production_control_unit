// --- Configuration ---
// ඔයාගේ Backend Link එක මෙතනට දාන්න (අගට / නැතුව)
const API_URL = "https://backpcu-production.up.railway.app"; 

// --- Authentication Check ---
// පිටුව Load වෙද්දිම Admin ද කියලා බලන්න
window.onload = function() {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin') {
        alert("Access Denied! Admins Only.");
        window.location.href = 'index.html';
    } else {
        // Admin නම් Data Load කරන්න
        loadDashboardStats();
    }
};

// --- Navigation Logic ---
function showSection(sectionId) {
    // සේරම Sections හංගන්න
    document.querySelectorAll('.section').forEach(sec => sec.style.display = 'none');
    // අවශ්‍ය එක පෙන්වන්න
    document.getElementById(sectionId).style.display = 'block';
    
    // Sidebar active class මාරු කරන්න
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
    event.currentTarget.classList.add('active');

    if(sectionId === 'inventory') {
        loadInventory();
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// --- API Calls ---

// 1. Load Dashboard Overview Stats
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } // Token එක යවන්න ඕන නම්
            // Note: අපි HTTPOnly Cookie පාවිච්චි කරන නිසා Headers වලට අමුතුවෙන් Token දාන්න ඕන නෑ browser එක ඒක auto කරනවා 'credentials: include' තිබ්බොත්.
            // නමුත් අපි fetch එකේ credentials: 'include' දාන්න ඕන.
        });
        
        // Fetch with Cookies
        // හැබැයි අපි දැනට සරලව තියමු. Backend එකේ Cookie middleware වැඩ කරනවා.
    } catch (error) {
        console.error("Stats Error:", error);
    }
}

// 2. Add Item Logic
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const itemData = {
        item_name: document.getElementById('itemName').value,
        sku: document.getElementById('itemSku').value,
        category: document.getElementById('itemCategory').value,
        size: document.getElementById('itemSize').value
    };

    try {
        // Backend එකට දත්ත යවමු
        // වැදගත්: fetch එකේ credentials: 'include' දාන්න Cookie එක යන්න.
        const response = await fetch(`${API_URL}/api/admin/add-item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData)
        });

        const result = await response.json();

        if (response.ok) {
            alert("✅ Item Added Successfully!");
            document.getElementById('addItemForm').reset();
            loadInventory(); // Table එක refresh කරන්න
        } else {
            alert("❌ Error: " + (result.error || "Failed to add item"));
        }

    } catch (err) {
        console.error(err);
        alert("Server Error!");
    }
});

// 3. Load Inventory Table
async function loadInventory() {
    const tableBody = document.getElementById('inventoryTableBody');
    tableBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`);
        const data = await response.json();

        tableBody.innerHTML = ''; // Clear loading

        // Cards Update කරමු
        document.getElementById('totalItems').innerText = data.length;
        // Low stock (උදාහරණයක් ලෙස 5ට අඩු)
        const lowStockCount = data.filter(item => item.qty < 5).length;
        document.getElementById('lowStock').innerText = lowStockCount;

        // Table එක පුරවමු
        data.forEach(item => {
            const row = `
                <tr>
                    <td>${item.category}</td>
                    <td>${item.item_name} <small style="color:#aaa;">(${item.sku || '-'})</small></td>
                    <td>${item.size || '-'}</td>
                    <td style="font-weight:bold; color: ${item.qty < 5 ? '#ff512f' : '#fff'};">${item.qty}</td>
                    <td>${item.qty > 0 ? 'In Stock' : 'Out of Stock'}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (err) {
        console.error(err);
        tableBody.innerHTML = '<tr><td colspan="5" style="color:red;">Failed to load data</td></tr>';
    }
}
