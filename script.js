// --- 4. SMART SEARCH (Fixed for Dropdown Click Issue) ---
function setupSmartSearch(inputId, dropdownId, onSelect) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    
    // 1. Type කරනකොට ලිස්ට් එක පෙන්නන්න
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
                
                // Click Event එක
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

    // 2. 🔥 THE FIX: Focus නැති වුනාම (Blur), ලිස්ට් එක හංගන්න තත්පරයක් ඉන්න
    // මේක නිසා ඔයාට Click කරන්න වෙලාව හම්බෙනවා
    input.addEventListener('blur', () => {
        setTimeout(() => {
            dropdown.style.display = 'none';
        }, 200); // මිලි තත්පර 200ක delay එකක්
    });

    // 3. ආයේ බොක්ස් එක click කරාම ලිස්ට් එක පෙන්නන්න
    input.addEventListener('focus', () => {
        if(input.value.length > 0) {
            dropdown.style.display = 'block';
        }
    });
}
