// --- Configuration ---
const API_URL = "https://backpcu-production.up.railway.app"; 

// --- Authentication Check ---
window.onload = function() {
    const role = localStorage.getItem('userRole');
    const token = localStorage.getItem('token');

    // Token එක හෝ Admin බලය නැත්නම් එළියට දානවා
    if (role !== 'admin' || !token) {
        alert("⚠️ Access Denied! Please Login.");
        window.location.href = 'index.html';
    } else {
        loadDashboardStats();
    }
};

// --- Navigation ---
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(sec => sec.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';
    
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
    // Active class logic can be improved based on click, keeping simple for now
    
    if(sectionId === 'inventory') {
        loadInventory();
    }
}

function logout() {
    localStorage.clear(); // Token එක මකනවා
    window.location.href = 'index.html';
}

// --- API Helper (Token එක Header එකට දාන්න) ---
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}` // ✅ Token එක මෙතනින් යනවා
    };
}

// --- 1. Add Item Logic ---
const addItemForm = document.getElementById('addItemForm');
if (addItemForm) {
    addItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const itemData = {
            item_name: document.getElementById('itemName').value,
            sku: document.getElementById('itemSku').value,
            category: document.getElementById('itemCategory').value,
            size: document.getElementById('itemSize').value
        };

        const submitBtn = addItemForm.querySelector('button');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = "Saving...";

        try {
            const response = await fetch(`${API_URL}/api/admin/add-item`, {
                method: 'POST',
                headers: getAuthHeaders(), // Header එක යවනවා
                body: JSON.stringify(itemData)
            });

            const result = await response.json();

            if (response.ok) {
                alert("✅ Item Added Successfully!");
                addItemForm.reset();
                loadDashboardStats();
            } else {
                alert("❌ Error: " + (result.error || "Failed to add item"));
                if (response.status === 401 || response.status === 403) logout();
            }

        } catch (err) {
            console.error(err);
            alert("❌ Server Connection Error!");
        } finally {
            submitBtn.innerText = originalText;
        }
    });
}

// --- 2. Load Stats & Inventory ---
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`, {
            method: 'GET',
            headers: getAuthHeaders() // Header එක යවනවා
        });

        if (!response.ok) {
            if (response.status === 401) {
                logout(); // Token එක කල් ඉකුත් වී ඇත්නම් logout කරන්න
                return;
            }
            throw new Error("Failed to fetch data");
        }

        const data = await response.json();
        
        // Update Cards
        const totalItems = document.getElementById('totalItems');
        const lowStock = document.getElementById('lowStock');
        
        if(totalItems) totalItems.innerText = data.length;
        if(lowStock) lowStock.innerText = data.filter(item => item.qty < 5).length;

        // Update Inventory Table
        updateInventoryTable(data);

    } catch (error) {
        console.error("Stats Load Error:", error);
    }
}

function updateInventoryTable(data) {
    const tableBody = document.getElementById('inventoryTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No Items Found</td></tr>';
        return;
    }

    data.forEach(item => {
        let statusBadge = item.qty <= 0 ? '<span style="color: #ff4d4d;">Out of Stock</span>' : 
                          (item.qty < 5 ? '<span style="color: #ffcc00;">Low Stock</span>' : '<span style="color: #00e676;">In Stock</span>');

        const row = `
            <tr>
                <td>${item.category}</td>
                <td>${item.item_name} <br/><small style="color:#aaa;">${item.sku || ''}</small></td>
                <td>${item.size || '-'}</td>
                <td style="font-size: 1.1em;">${item.qty}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

function loadInventory() {
    loadDashboardStats();
}
