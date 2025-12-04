// --- 1. Configuration ---
// ඔබේ Railway Backend URL එක (අවසානයට / slash දාන්න එපා)
const API_URL = "https://backpcu-production.up.railway.app"; 

// --- 2. Authentication Check (පිටුව Load වන විට) ---
window.onload = function() {
    // LocalStorage එකෙන් බලනවා නම තියෙනවද කියලා (UI එකට විතරයි)
    const role = localStorage.getItem('userRole');

    if (role !== 'admin') {
        alert("⚠️ Access Denied! Admins Only.");
        window.location.href = 'index.html'; // Login පිටුවට යවන්න
    } else {
        // Admin කෙනෙක් නම් Dashboard Data ටික Load කරගන්න
        loadDashboardStats();
    }
};

// --- 3. Navigation Logic (Sidebar මාරු කිරීම) ---
function showSection(sectionId) {
    // 1. සියලුම Sections හංගන්න
    document.querySelectorAll('.section').forEach(sec => sec.style.display = 'none');
    
    // 2. අදාළ Section එක පෙන්වන්න
    document.getElementById(sectionId).style.display = 'block';
    
    // 3. Sidebar එකේ Active පාට මාරු කරන්න
    document.querySelectorAll('.glass-sidebar li').forEach(li => li.classList.remove('active'));
    // (Button එක Click කල තැනට Active class එක දාන්න)
    const activeLink = document.querySelector(`.glass-sidebar li[onclick="showSection('${sectionId}')"]`);
    if(activeLink) activeLink.classList.add('active');

    // 4. Inventory Tab එකට ආවොත් Table එක Refresh කරන්න
    if(sectionId === 'inventory') {
        loadInventory();
    }
}

// --- 4. Logout Function ---
function logout() {
    // Local Storage සුද්ද කරන්න
    localStorage.clear();
    // Login පිටුවට යවන්න
    window.location.href = 'index.html';
}


// --- 5. Add Item Logic (Data යැවීම) ---
const addItemForm = document.getElementById('addItemForm');

if (addItemForm) {
    addItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Form එකේ දත්ත ලබා ගැනීම
        const itemData = {
            item_name: document.getElementById('itemName').value,
            sku: document.getElementById('itemSku').value,
            category: document.getElementById('itemCategory').value,
            size: document.getElementById('itemSize').value
        };

        const submitBtn = addItemForm.querySelector('button');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = "Saving..."; // Button එක වෙනස් කරනවා

        try {
            // Backend එකට Request යැවීම
            const response = await fetch(`${API_URL}/api/admin/add-item`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(itemData),
                credentials: 'include' // <--- ඉතාම වැදගත්: Cookie එක යවන්න මේක ඕන
            });

            const result = await response.json();

            if (response.ok) {
                alert("✅ Item Added Successfully!");
                addItemForm.reset(); // Form එක හිස් කරන්න
                loadDashboardStats(); // උඩ තියෙන Numbers update කරන්න
            } else {
                // Error එකක් ආවොත්
                alert("❌ Error: " + (result.error || "Failed to add item"));
                
                // Login නැති ප්‍රශ්නයක් නම් එළියට දාන්න
                if (response.status === 401 || response.status === 403) {
                    window.location.href = 'index.html';
                }
            }

        } catch (err) {
            console.error(err);
            alert("❌ Server Connection Error!");
        } finally {
            submitBtn.innerText = originalText; // Button එක යථා තත්වයට
        }
    });
}


// --- 6. Load Data (Inventory Table & Stats) ---
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/api/admin/stats?type=NORMAL`, {
            method: 'GET',
            credentials: 'include' // <--- Cookie එක යවන්න
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.warn("Session Expired");
                window.location.href = 'index.html';
                return;
            }
            throw new Error("Failed to fetch data");
        }

        const data = await response.json();
        
        // --- 1. Dashboard Numbers Update ---
        updateDashboardCards(data);

        // --- 2. Inventory Table Update ---
        // (Inventory Tab එකේ තියෙන Table එකට Data දානවා)
        updateInventoryTable(data);

    } catch (error) {
        console.error("Stats Load Error:", error);
    }
}

// උඩ Function එකට උදව් කරන පොඩි Functions
function updateDashboardCards(data) {
    const totalItems = document.getElementById('totalItems');
    const lowStock = document.getElementById('lowStock');
    const damageCount = document.getElementById('damageCount');

    if(totalItems) totalItems.innerText = data.length; // මුළු ගණන
    
    // 5 ට වඩා අඩු ඒවා Low Stock ලෙස ගනිමු
    if(lowStock) lowStock.innerText = data.filter(item => item.qty < 5).length;
    
    // දැනට Damage ගණන ගන්න විදියක් නැති නිසා 0 තියමු (හෝ API එකෙන් එනවා නම් දාන්න)
    if(damageCount) damageCount.innerText = "0"; 
}

function updateInventoryTable(data) {
    const tableBody = document.getElementById('inventoryTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = ''; // පරණ දත්ත මකන්න

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No Items Found</td></tr>';
        return;
    }

    data.forEach(item => {
        // Status එක තීරණය කිරීම
        let statusBadge = '';
        if (item.qty <= 0) {
            statusBadge = '<span style="color: #ff4d4d; font-weight: bold;">Out of Stock</span>';
        } else if (item.qty < 5) {
            statusBadge = '<span style="color: #ffcc00; font-weight: bold;">Low Stock</span>';
        } else {
            statusBadge = '<span style="color: #00e676; font-weight: bold;">In Stock</span>';
        }

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

// Function to call specifically when clicking Inventory Tab
function loadInventory() {
    loadDashboardStats(); // එකම Data ටික නිසා මේකම Call කරමු
}
