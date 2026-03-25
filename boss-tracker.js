// Embedded game data (for local file:// protocol compatibility)
const GAME_DATA = {
    "bosses": [
        { "name": "Extreme Kaling", "price": "6.03B", "value": 6030 },
        { "name": "Extreme First Adversary", "price": "5.88B", "value": 5880 },
        { "name": "Extreme Kalos the Guardian", "price": "5.2B", "value": 5200 },
        { "name": "Extreme Chosen Seren", "price": "4.24B", "value": 4240 },
        { "name": "Hard Baldrix", "price": "4.2B", "value": 4200 },
        { "name": "Hard Limbo", "price": "3.75B", "value": 3750 },
        { "name": "Hard Kaling", "price": "2.99B", "value": 2990 },
        { "name": "Hard First Adversary", "price": "2.94B", "value": 2940 },
        { "name": "Normal Baldrix", "price": "2.8B", "value": 2800 },
        { "name": "Chaos Kalos the Guardian", "price": "2.6B", "value": 2600 },
        { "name": "Normal Limbo", "price": "2.1B", "value": 2100 },
        { "name": "Normal Kaling", "price": "1.51B", "value": 1510 },
        { "name": "Extreme Lotus", "price": "1.4B", "value": 1400 },
        { "name": "Normal First Adversary", "price": "1.37B", "value": 1370 },
        { "name": "Normal Kalos the Guardian", "price": "1.3B", "value": 1300 },
        { "name": "Hard Chosen Seren", "price": "1.1B", "value": 1100 },
        { "name": "Easy Kaling", "price": "1.03B", "value": 1030 },
        { "name": "Easy First Adversary", "price": "985M", "value": 985 },
        { "name": "Easy Kalos the Guardian", "price": "937.5M", "value": 937.5 },
        { "name": "Normal Chosen Seren", "price": "889.02M", "value": 889.02 },
        { "name": "Hard Verus Hilla", "price": "762.11M", "value": 762.11 },
        { "name": "Hard Darknell", "price": "667.92M", "value": 667.92 },
        { "name": "Hard Will", "price": "621.81M", "value": 621.81 },
        { "name": "Chaos Guardian Angel Slime", "price": "600.58M", "value": 600.58 },
        { "name": "Normal Verus Hilla", "price": "581.88M", "value": 581.88 },
        { "name": "Chaos Gloom", "price": "563.95M", "value": 563.95 },
        { "name": "Hard Lucid", "price": "501M", "value": 501 },
        { "name": "Hard Damien", "price": "421.88M", "value": 421.88 },
        { "name": "Hard Lotus", "price": "414.68M", "value": 444.68 }
    ],
    "pitchedGear": [
        "Berserked",
        "Magic Eyepatch",
        {
            "name": "Black Heart / Total Control",
            "subOptions": ["Using TC", "Using BH"]
        },
        "Dreamy Belt",
        "Source of Suffering",
        "Genesis Badge",
        "Commanding Force Earring",
        "Endless Terror",
        "Cursed Spellbook",
        "Mitra's Rage"
    ],
    "noSparesItems": ["Cursed Spellbook", "Genesis Badge", "Mitra's Rage"]
};

// Global variables for game data
let bossDataFlat = GAME_DATA.bosses;
let pitchedGearData = GAME_DATA.pitchedGear;
let noSparesItems = GAME_DATA.noSparesItems;

/**
 * Sanitizes user input to prevent XSS attacks
 * @param {string} input - The user input to sanitize
 * @returns {string} Sanitized string safe for DOM insertion
 */
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// Parse boss data to extract difficulty and base name
function parseBossName(fullName) {
    const difficulties = ['Extreme', 'Hard', 'Chaos', 'Normal', 'Easy'];
    for (const diff of difficulties) {
        if (fullName.startsWith(diff + ' ')) {
            return {
                difficulty: diff,
                baseName: fullName.substring(diff.length + 1)
            };
        }
    }
    return { difficulty: null, baseName: fullName };
}

// Group bosses by base name
const bossGroups = {};
bossDataFlat.forEach(boss => {
    const parsed = parseBossName(boss.name);
    const baseName = parsed.baseName;
    
    if (!bossGroups[baseName]) {
        bossGroups[baseName] = {
            baseName: baseName,
            difficulties: {}
        };
    }
    
    if (parsed.difficulty) {
        bossGroups[baseName].difficulties[parsed.difficulty] = {
            fullName: boss.name,
            price: boss.price,
            value: boss.value
        };
    } else {
        // Boss with no difficulty prefix
        bossGroups[baseName].difficulties['Solo'] = {
            fullName: boss.name,
            price: boss.price,
            value: boss.value
        };
    }
});

// Create display list (one entry per boss group)
const bossData = Object.values(bossGroups).map(group => {
    // Get highest value difficulty as default
    const diffEntries = Object.entries(group.difficulties);
    const highestDiff = diffEntries.reduce((max, [diff, data]) =>
        data.value > max.value ? data : max
    , diffEntries[0][1]);
    
    return {
        baseName: group.baseName,
        difficulties: group.difficulties,
        defaultDifficulty: Object.keys(group.difficulties).find(d => group.difficulties[d] === highestDiff),
        // For backward compatibility
        name: highestDiff.fullName,
        price: highestDiff.price,
        value: highestDiff.value
    };
}).sort((a, b) => b.value - a.value); // Sort by highest value

let characters = [];
let activeCharacterId = null;
let nextCharacterId = 1;
let activeMainTab = 'bossCrystals';
let globalBlackHeartSpares = 0; // Global BH counter shared across all characters

// Main tab switching function
function switchMainTab(tabName) {
    activeMainTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Save active tab to localStorage
    saveToLocalStorage();
    
    // Render appropriate content
    if (tabName === 'bossCrystals') {
        renderCharacterTabs();
        renderMainContent();
    } else if (tabName === 'pitchTracker') {
        renderPitchCharacterTabs();
        renderPitchContent();
    } else if (tabName === 'bhHistory') {
        renderBHHistory();
    } else if (tabName === 'sellingStrategy') {
        renderSellingStrategy();
    }
}

// LocalStorage functions
function saveToLocalStorage() {
    const data = {
        characters: characters.map(char => {
            // Convert pitchedGearSubOptions Sets to Arrays for JSON
            const subOptionsObj = {};
            if (char.pitchedGearSubOptions) {
                for (const [key, value] of Object.entries(char.pitchedGearSubOptions)) {
                    subOptionsObj[key] = Array.from(value);
                }
            }
            
            return {
                id: char.id,
                name: char.name,
                selectedBosses: Array.from(char.selectedBosses),
                bossPartyCount: char.bossPartyCount || {},
                bossDifficulty: char.bossDifficulty || {},
                pitchedGear: Array.from(char.pitchedGear || new Set()),
                pitchedGearSubOptions: subOptionsObj,
                pitchedGearSpares: char.pitchedGearSpares || {},
                pitchHistory: char.pitchHistory || []
            };
        }),
        activeCharacterId: activeCharacterId,
        nextCharacterId: nextCharacterId,
        activeMainTab: activeMainTab,
        globalBlackHeartSpares: globalBlackHeartSpares
    };
    localStorage.setItem('bossTrackerData', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('bossTrackerData');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            characters = data.characters.map(char => {
                // Convert pitchedGearSubOptions Arrays back to Sets
                const subOptionsObj = {};
                if (char.pitchedGearSubOptions) {
                    for (const [key, value] of Object.entries(char.pitchedGearSubOptions)) {
                        subOptionsObj[key] = new Set(value);
                    }
                }
                
                return {
                    id: char.id,
                    name: char.name,
                    selectedBosses: new Set(char.selectedBosses),
                    bossPartyCount: char.bossPartyCount || {},
                    bossDifficulty: char.bossDifficulty || {},
                    pitchedGear: new Set(char.pitchedGear || []),
                    pitchedGearSubOptions: subOptionsObj,
                    pitchedGearSpares: char.pitchedGearSpares || {},
                    pitchHistory: char.pitchHistory || []
                };
            });
            activeCharacterId = data.activeCharacterId;
            nextCharacterId = data.nextCharacterId;
            activeMainTab = data.activeMainTab || 'bossCrystals';
            globalBlackHeartSpares = data.globalBlackHeartSpares || 0;
            return true;
        } catch (e) {
            console.error('Error loading saved data:', e);
            return false;
        }
    }
    return false;
}

function manualSave() {
    saveToLocalStorage();
    showSaveStatus();
}

function showSaveStatus() {
    const status = document.getElementById('saveStatus');
    status.classList.add('show');
    setTimeout(() => {
        status.classList.remove('show');
    }, 2000);
}

async function exportData() {
    const data = {
        characters: characters.map(char => ({
            id: char.id,
            name: char.name,
            selectedBosses: Array.from(char.selectedBosses),
            bossPartyCount: char.bossPartyCount || {},
            bossDifficulty: char.bossDifficulty || {}
        })),
        activeCharacterId: activeCharacterId,
        nextCharacterId: nextCharacterId,
        exportDate: new Date().toISOString(),
        version: '2.0'
    };

    const dataStr = JSON.stringify(data, null, 2);
    const suggestedName = `boss-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;

    // Try to use File System Access API (modern browsers)
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: suggestedName,
                types: [{
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            
            const writable = await handle.createWritable();
            await writable.write(dataStr);
            await writable.close();
            
            showSaveStatus();
            return;
        } catch (err) {
            // User cancelled or error occurred
            if (err.name !== 'AbortError') {
                console.error('Error saving file:', err);
            }
            return;
        }
    }
    
    // Fallback for older browsers
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showSaveStatus();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate data structure
            if (!data.characters || !Array.isArray(data.characters)) {
                alert('Invalid file format: Missing characters data');
                return;
            }

            // Confirm before overwriting
            if (!confirm('This will replace your current data. Continue?')) {
                return;
            }

            // Load the imported data
            characters = data.characters.map(char => ({
                id: char.id,
                name: char.name,
                selectedBosses: new Set(char.selectedBosses || []),
                bossPartyCount: char.bossPartyCount || {}
            }));
            activeCharacterId = data.activeCharacterId || (characters.length > 0 ? characters[0].id : null);
            nextCharacterId = data.nextCharacterId || (Math.max(...characters.map(c => c.id), 0) + 1);

            // Save to localStorage and render
            saveToLocalStorage();
            renderAll();
            
            alert('Data imported successfully!');
            showSaveStatus();
        } catch (error) {
            console.error('Import error:', error);
            alert('Error importing file: ' + error.message);
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

function addCharacter() {
    const newCharacter = {
        id: nextCharacterId++,
        name: `Character ${characters.length + 1}`,
        selectedBosses: new Set(),
        bossPartyCount: {}, // Store party count per boss
        bossDifficulty: {}, // Store difficulty per boss
        pitchedGear: new Set(), // Store pitched gear items
        pitchedGearSubOptions: {}, // Store sub-options for items with multiple choices
        pitchedGearSpares: {}, // Store spares count for gear items
        pitchHistory: [] // Store pitch history events
    };
    characters.push(newCharacter);
    activeCharacterId = newCharacter.id;
    saveToLocalStorage();
    renderAll();
}

function copyCurrentCharacter() {
    const currentChar = getActiveCharacter();
    if (!currentChar) {
        alert('No character to copy!');
        return;
    }

    // Create a copy with a new ID and name
    const copiedCharacter = {
        id: nextCharacterId++,
        name: `${currentChar.name} (Copy)`,
        selectedBosses: new Set(currentChar.selectedBosses),
        bossPartyCount: { ...currentChar.bossPartyCount }, // Copy party counts
        bossDifficulty: { ...currentChar.bossDifficulty }, // Copy difficulties
        pitchedGear: new Set(currentChar.pitchedGear), // Copy pitched gear
        pitchedGearSubOptions: { ...currentChar.pitchedGearSubOptions }, // Copy sub-options
        pitchedGearSpares: { ...currentChar.pitchedGearSpares }, // Copy spares
        pitchHistory: [...(currentChar.pitchHistory || [])] // Copy history
    };
    
    characters.push(copiedCharacter);
    activeCharacterId = copiedCharacter.id; // Switch to the new copy
    saveToLocalStorage();
    renderAll();
    
    showSaveStatus();
}

function reorganizeCharacters() {
    if (characters.length <= 1) {
        alert('Need at least 2 characters to reorganize!');
        return;
    }

    // Sort characters by total earnings (highest to lowest)
    characters.sort((a, b) => {
        const totalA = calculateTotal(a);
        const totalB = calculateTotal(b);
        return totalB - totalA;
    });

    saveToLocalStorage();
    renderAll();
    showSaveStatus();
}

function updateBossPartyCount(bossBaseName, count) {
    const character = getActiveCharacter();
    if (character) {
        const partyCount = Math.max(1, Math.min(6, parseInt(count) || 1));
        character.bossPartyCount[bossBaseName] = partyCount;
        saveToLocalStorage();
        refreshBossContainer();
        updateSummaryPanel();
        renderCharacterTabs();
    }
}

function getBossPartyCount(character, bossBaseName) {
    return character.bossPartyCount?.[bossBaseName] || 1;
}

function updateBossDifficulty(bossBaseName, difficulty) {
    const character = getActiveCharacter();
    if (character) {
        character.bossDifficulty[bossBaseName] = difficulty;
        saveToLocalStorage();
        refreshBossContainer();
        updateSummaryPanel();
        renderCharacterTabs();
    }
}

function getBossDifficulty(character, bossBaseName) {
    const boss = bossData.find(b => b.baseName === bossBaseName);
    if (!boss) return null;
    return character.bossDifficulty?.[bossBaseName] || boss.defaultDifficulty;
}

function getBossValue(bossBaseName, difficulty) {
    const boss = bossData.find(b => b.baseName === bossBaseName);
    if (!boss || !boss.difficulties[difficulty]) return 0;
    return boss.difficulties[difficulty].value;
}

function getBossPrice(bossBaseName, difficulty) {
    const boss = bossData.find(b => b.baseName === bossBaseName);
    if (!boss || !boss.difficulties[difficulty]) return '0M';
    return boss.difficulties[difficulty].price;
}

function deleteCharacter(id) {
    if (characters.length === 1) {
        alert("You must have at least one character!");
        return;
    }
    
    characters = characters.filter(c => c.id !== id);
    if (activeCharacterId === id) {
        activeCharacterId = characters[0].id;
    }
    saveToLocalStorage();
    renderAll();
}

function switchCharacter(id) {
    activeCharacterId = id;
    saveToLocalStorage();
    
    // Update both tab sets
    renderCharacterTabs();
    renderPitchCharacterTabs();
    
    // Update content based on active main tab
    if (activeMainTab === 'bossCrystals') {
        renderMainContent();
    } else if (activeMainTab === 'pitchTracker') {
        renderPitchContent();
    }
}

function getActiveCharacter() {
    return characters.find(c => c.id === activeCharacterId);
}

function updateCharacterName(name) {
    const character = getActiveCharacter();
    if (character) {
        character.name = sanitizeInput(name) || `Character ${characters.indexOf(character) + 1}`;
        saveToLocalStorage();
        renderCharacterTabs();
        renderPitchCharacterTabs();
    }
}

function renderCharacterTabs() {
    const container = document.getElementById('characterTabs');
    container.innerHTML = characters.map(char => {
        const total = calculateTotal(char);
        const sanitizedName = sanitizeInput(char.name);
        return `
            <div class="character-tab ${char.id === activeCharacterId ? 'active' : ''}"
                 onclick="switchCharacter(${char.id})">
                <div>
                    <div class="character-tab-name">${sanitizedName}</div>
                    <div class="character-tab-total">${formatValue(total)}</div>
                </div>
                <button class="delete-character-btn" onclick="event.stopPropagation(); deleteCharacter(${char.id})">✕</button>
            </div>
        `;
    }).join('');
}

function renderBosses(filter = '') {
    const character = getActiveCharacter();
    if (!character) return '';

    const filteredBosses = bossData
        .filter(boss => boss.baseName.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => {
            const diffA = getBossDifficulty(character, a.baseName);
            const diffB = getBossDifficulty(character, b.baseName);
            const partyA = getBossPartyCount(character, a.baseName);
            const partyB = getBossPartyCount(character, b.baseName);
            return (getBossValue(b.baseName, diffB) / partyB) - (getBossValue(a.baseName, diffA) / partyA);
        });

    return filteredBosses.map(boss => {
        const isSelected = character.selectedBosses.has(boss.baseName);
        const partyCount = getBossPartyCount(character, boss.baseName);
        const difficulty = getBossDifficulty(character, boss.baseName);
        const currentValue = getBossValue(boss.baseName, difficulty);
        const adjustedValue = currentValue / partyCount;
        const displayPrice = formatValue(adjustedValue);
        const difficulties = Object.keys(boss.difficulties);
        const sanitizedBossName = sanitizeInput(boss.baseName);
        
        return `
            <div class="boss-item ${isSelected ? 'selected' : ''}"
                 onclick="toggleBoss('${boss.baseName}')" data-boss="${boss.baseName}">
                <span class="boss-name">${sanitizedBossName}</span>
                <div style="display: flex; align-items: center; gap: 6px;">
                    ${isSelected && difficulties.length > 1 ? `
                        <select onchange="event.stopPropagation(); updateBossDifficulty('${boss.baseName}', this.value)"
                                onclick="event.stopPropagation()"
                                style="padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.9); color: #333; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                            ${difficulties.map(diff => `
                                <option value="${diff}" ${difficulty === diff ? 'selected' : ''} style="background: white; color: #333;">${diff}</option>
                            `).join('')}
                        </select>
                    ` : ''}
                    ${isSelected ? `
                        <select onchange="event.stopPropagation(); updateBossPartyCount('${boss.baseName}', this.value)"
                                onclick="event.stopPropagation()"
                                style="padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.9); color: #333; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                            <option value="1" ${partyCount === 1 ? 'selected' : ''} style="background: white; color: #333;">1</option>
                            <option value="2" ${partyCount === 2 ? 'selected' : ''} style="background: white; color: #333;">2</option>
                            <option value="3" ${partyCount === 3 ? 'selected' : ''} style="background: white; color: #333;">3</option>
                            <option value="4" ${partyCount === 4 ? 'selected' : ''} style="background: white; color: #333;">4</option>
                            <option value="5" ${partyCount === 5 ? 'selected' : ''} style="background: white; color: #333;">5</option>
                            <option value="6" ${partyCount === 6 ? 'selected' : ''} style="background: white; color: #333;">6</option>
                        </select>
                    ` : ''}
                    <span class="boss-price">${displayPrice}</span>
                </div>
            </div>
        `;
    }).join('');
}

function refreshBossContainer() {
    const container = document.getElementById('bossContainer');
    if (!container) return;
    const searchValue = document.getElementById('searchBox')?.value || '';
    const bossListElement = document.querySelector('.boss-list');
    const savedScroll = bossListElement ? bossListElement.scrollTop : 0;
    container.innerHTML = renderBosses(searchValue);
    if (bossListElement) bossListElement.scrollTop = savedScroll;
}

function toggleBoss(bossBaseName) {
    const character = getActiveCharacter();
    if (!character) return;

    if (character.selectedBosses.has(bossBaseName)) {
        character.selectedBosses.delete(bossBaseName);
    } else {
        character.selectedBosses.add(bossBaseName);
    }
    
    saveToLocalStorage();

    refreshBossContainer();
    updateSummaryPanel();
    renderCharacterTabs();
}

function updateBossItemState(bossBaseName) {
    const character = getActiveCharacter();
    if (!character) return;

    const bossItem = document.querySelector(`[data-boss="${bossBaseName}"]`);
    if (bossItem) {
        const isSelected = character.selectedBosses.has(bossBaseName);
        const boss = bossData.find(b => b.baseName === bossBaseName);
        if (!boss) return;
        
        const partyCount = getBossPartyCount(character, bossBaseName);
        const difficulty = getBossDifficulty(character, bossBaseName);
        const currentValue = getBossValue(bossBaseName, difficulty);
        const adjustedValue = currentValue / partyCount;
        const displayPrice = formatValue(adjustedValue);
        const difficulties = Object.keys(boss.difficulties);
        
        // Update class
        if (isSelected) {
            bossItem.classList.add('selected');
        } else {
            bossItem.classList.remove('selected');
        }
        
        // Update inner HTML to show/hide dropdowns
        const sanitizedBossName = sanitizeInput(boss.baseName);
        bossItem.innerHTML = `
            <span class="boss-name">${sanitizedBossName}</span>
            <div style="display: flex; align-items: center; gap: 6px;">
                ${isSelected && difficulties.length > 1 ? `
                    <select onchange="event.stopPropagation(); updateBossDifficulty('${boss.baseName}', this.value)"
                            onclick="event.stopPropagation()"
                            style="padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.9); color: #333; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                        ${difficulties.map(diff => `
                            <option value="${diff}" ${difficulty === diff ? 'selected' : ''} style="background: white; color: #333;">${diff}</option>
                        `).join('')}
                    </select>
                ` : ''}
                ${isSelected ? `
                    <select onchange="event.stopPropagation(); updateBossPartyCount('${boss.baseName}', this.value)"
                            onclick="event.stopPropagation()"
                            style="padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.9); color: #333; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                        <option value="1" ${partyCount === 1 ? 'selected' : ''} style="background: white; color: #333;">1</option>
                        <option value="2" ${partyCount === 2 ? 'selected' : ''} style="background: white; color: #333;">2</option>
                        <option value="3" ${partyCount === 3 ? 'selected' : ''} style="background: white; color: #333;">3</option>
                        <option value="4" ${partyCount === 4 ? 'selected' : ''} style="background: white; color: #333;">4</option>
                        <option value="5" ${partyCount === 5 ? 'selected' : ''} style="background: white; color: #333;">5</option>
                        <option value="6" ${partyCount === 6 ? 'selected' : ''} style="background: white; color: #333;">6</option>
                    </select>
                ` : ''}
                <span class="boss-price">${displayPrice}</span>
            </div>
        `;
    }
}

function updateSummaryPanel() {
    const character = getActiveCharacter();
    if (!character) return;

    const total = calculateTotal(character);
    const grandTotal = calculateGrandTotal();

    // Update warning
    const summaryElement = document.querySelector('.summary');
    const existingWarning = summaryElement.querySelector('.boss-limit-warning');
    const nameInput = summaryElement.querySelector('.character-name-input');
    
    if (character.selectedBosses.size > 14) {
        if (!existingWarning) {
            const warningHTML = `
                <div class="boss-limit-warning">
                    <strong>⚠️ Boss Limit:</strong> You have selected ${character.selectedBosses.size} bosses. Only the top 14 highest-value bosses are counted in your total.
                </div>
            `;
            nameInput.insertAdjacentHTML('afterend', warningHTML);
        } else {
            existingWarning.innerHTML = `<strong>⚠️ Boss Limit:</strong> You have selected ${character.selectedBosses.size} bosses. Only the top 14 highest-value bosses are counted in your total.`;
        }
    } else if (existingWarning) {
        existingWarning.remove();
    }

    // Update totals
    const totalAmount = document.querySelector('.total-section .total-amount');
    if (totalAmount) {
        totalAmount.textContent = formatValue(total);
    }

    const grandTotalAmount = document.querySelector('.grand-total-section .total-amount');
    if (grandTotalAmount) {
        grandTotalAmount.textContent = formatValue(grandTotal);
    }
}

function removeBoss(bossBaseName) {
    const character = getActiveCharacter();
    if (!character) return;

    character.selectedBosses.delete(bossBaseName);
    saveToLocalStorage();
    updateBossItemState(bossBaseName);
    updateSummaryPanel();
    renderCharacterTabs();
}

function calculateTotal(character) {
    if (!character || !character.selectedBosses || character.selectedBosses.size === 0) {
        return 0;
    }
    
    const selectedBossData = Array.from(character.selectedBosses).map(baseName => {
        const difficulty = getBossDifficulty(character, baseName);
        const value = getBossValue(baseName, difficulty);
        const partyCount = getBossPartyCount(character, baseName);
        return {
            baseName: baseName,
            value: value,
            adjustedValue: value / partyCount
        };
    })
    .sort((a, b) => b.adjustedValue - a.adjustedValue) // Sort by adjusted value descending
    .slice(0, 14); // Take only top 14
    
    return selectedBossData.reduce((sum, boss) => sum + boss.adjustedValue, 0);
}

function getTop14Bosses(character) {
    if (!character || !character.selectedBosses || character.selectedBosses.size === 0) {
        return [];
    }
    
    return Array.from(character.selectedBosses).map(baseName => {
        const difficulty = getBossDifficulty(character, baseName);
        const value = getBossValue(baseName, difficulty);
        const partyCount = getBossPartyCount(character, baseName);
        return {
            baseName: baseName,
            adjustedValue: value / partyCount
        };
    })
    .sort((a, b) => b.adjustedValue - a.adjustedValue)
    .slice(0, 14)
    .map(boss => boss.baseName);
}

function getTotalBossCount() {
    return characters.reduce((sum, char) => sum + (char.selectedBosses?.size || 0), 0);
}

function getAllBossesWithValues() {
    // Collect all bosses from all characters with their adjusted values
    const allBosses = [];
    
    characters.forEach(char => {
        if (!char.selectedBosses || char.selectedBosses.size === 0) return;
        
        Array.from(char.selectedBosses).forEach(baseName => {
            const difficulty = getBossDifficulty(char, baseName);
            const value = getBossValue(baseName, difficulty);
            const partyCount = getBossPartyCount(char, baseName);
            allBosses.push({
                characterId: char.id,
                characterName: char.name,
                baseName: baseName,
                difficulty: difficulty,
                partyCount: partyCount,
                adjustedValue: value / partyCount
            });
        });
    });
    
    return allBosses.sort((a, b) => b.adjustedValue - a.adjustedValue);
}

function calculateGrandTotal() {
    const allBosses = getAllBossesWithValues();
    const top180 = allBosses.slice(0, 180);
    return top180.reduce((sum, boss) => sum + boss.adjustedValue, 0);
}

function showOverflowBosses() {
    const allBosses = getAllBossesWithValues();
    const totalCount = allBosses.length;
    
    if (totalCount <= 180) {
        return;
    }
    
    const overflowBosses = allBosses.slice(180);
    const overflowCount = overflowBosses.length;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'overflow-tooltip-overlay';
    overlay.onclick = closeOverflowTooltip;
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'overflow-tooltip';
    tooltip.id = 'overflowTooltip';
    
    let content = `
        <h3>⚠️ Overflow Bosses (${overflowCount} not counted)</h3>
        <p style="margin-bottom: 15px; color: #999;">These bosses are NOT included in your grand total because they fall outside the top 180:</p>
    `;
    
    // Group overflow bosses by boss name and difficulty
    const groupedBosses = {};
    overflowBosses.forEach(boss => {
        const key = `${boss.baseName}|${boss.difficulty}`;
        if (!groupedBosses[key]) {
            groupedBosses[key] = {
                baseName: boss.baseName,
                difficulty: boss.difficulty,
                instances: []
            };
        }
        groupedBosses[key].instances.push({
            characterName: boss.characterName,
            partyCount: boss.partyCount,
            adjustedValue: boss.adjustedValue
        });
    });
    
    const uniqueCount = Object.keys(groupedBosses).length;
    content = `
        <h3>⚠️ Overflow Bosses (${overflowCount} instances, ${uniqueCount} unique)</h3>
        <p style="margin-bottom: 15px; color: #999;">These bosses are NOT included in your grand total because they fall outside the top 180:</p>
    `;
    
    let index = 1;
    Object.values(groupedBosses).forEach(group => {
        content += `
            <div class="overflow-boss-item">
                <div class="overflow-boss-name">${index}. ${group.baseName} (${group.difficulty}) ${group.instances.length > 1 ? `× ${group.instances.length}` : ''}</div>
        `;
        
        group.instances.forEach(instance => {
            content += `
                <div class="overflow-boss-details">
                    • ${instance.characterName} | Party: ${instance.partyCount} | Value: ${formatValue(instance.adjustedValue)}
                </div>
            `;
        });
        
        content += `</div>`;
        index++;
    });
    
    content += `
        <div class="overflow-tip">
            💡 <strong>Tip:</strong> Consider removing lower-value bosses to optimize your top 180.
        </div>
        <button class="overflow-close-btn" onclick="closeOverflowTooltip()">Close</button>
    `;
    
    tooltip.innerHTML = content;
    
    document.body.appendChild(overlay);
    document.body.appendChild(tooltip);
}

function closeOverflowTooltip() {
    const overlay = document.querySelector('.overflow-tooltip-overlay');
    const tooltip = document.getElementById('overflowTooltip');
    if (overlay) overlay.remove();
    if (tooltip) tooltip.remove();
}

function formatValue(total) {
    if (total >= 1000) {
        return `${(total / 1000).toFixed(2)}B`;
    } else if (total > 0) {
        return `${total.toFixed(2)}M`;
    }
    return '0M';
}

function renderMainContent() {
    const character = getActiveCharacter();
    const mainContent = document.getElementById('mainContent');

    if (!character) {
        mainContent.innerHTML = '<div class="no-character-message">Click "Add Character" to get started!</div>';
        return;
    }

    // Save scroll position before re-rendering
    const bossListElement = document.querySelector('.boss-list');
    const savedScrollPosition = bossListElement ? bossListElement.scrollTop : 0;

    const searchValue = document.getElementById('searchBox')?.value || '';
    const total = calculateTotal(character);
    const grandTotal = calculateGrandTotal();
    const bossCount = character.selectedBosses.size;
    const displayCount = Math.min(bossCount, 14);
    const totalBossCount = getTotalBossCount();
    const globalDisplayCount = Math.min(totalBossCount, 180);
    const sanitizedName = sanitizeInput(character.name);
    const sanitizedSearchValue = sanitizeInput(searchValue);

    mainContent.innerHTML = `
        <div class="content">
            <div class="boss-list">
                <h2>Available Bosses</h2>
                <input type="text" class="search-box" id="searchBox" placeholder="Search bosses..." value="${sanitizedSearchValue}">
                <div id="bossContainer">${renderBosses(searchValue)}</div>
            </div>
            
            <div class="summary">
                <h2>${sanitizedName}</h2>
                <input type="text" class="character-name-input"
                       placeholder="Character name..."
                       value="${sanitizedName}"
                       oninput="updateCharacterName(this.value)">
               
               ${character.selectedBosses.size > 14 ? `
               <div class="boss-limit-warning">
                   <strong>⚠️ Boss Limit:</strong> You have selected ${character.selectedBosses.size} bosses. Only the top 14 highest-value bosses are counted in your total.
               </div>
               ` : ''}

               ${totalBossCount > 180 ? `
               <div class="boss-limit-warning">
                   <strong>⚠️ Global Limit:</strong> You have selected ${totalBossCount} bosses across all characters. Only the top 180 highest-value bosses are counted in the grand total.
                   <a href="#" onclick="event.preventDefault(); showOverflowBosses();" style="display: block; margin-top: 8px; color: #667eea; text-decoration: underline; cursor: pointer; font-weight: 600;">Tell me more</a>
               </div>
               ` : ''}
                
                <div class="total-section">
                    <div class="total-label">Character Total <span style="font-size: 0.8em; opacity: 0.8;">(${displayCount}/14)</span></div>
                    <div class="total-amount">${formatValue(total)}</div>
                </div>

                ${characters.length > 1 ? `
                <div class="grand-total-section">
                    <div class="total-label">All Characters Total <span style="font-size: 0.8em; opacity: 0.8;">(${globalDisplayCount}/180 bosses, ${characters.length} chars)</span></div>
                    <div class="total-amount">${formatValue(grandTotal)}</div>
                </div>
                ` : ''}
                
                <button class="clear-btn" onclick="clearCharacterBosses()">Clear This Character</button>
            </div>
        </div>
    `;

    // Restore scroll position
    setTimeout(() => {
        const bossListElement = document.querySelector('.boss-list');
        if (bossListElement && savedScrollPosition > 0) {
            bossListElement.scrollTop = savedScrollPosition;
        }
    }, 0);

    // Re-attach search event listener
    document.getElementById('searchBox').addEventListener('input', (e) => {
        document.getElementById('bossContainer').innerHTML = renderBosses(e.target.value);
    });
}

function renderSelectedBosses(character) {
    if (character.selectedBosses.size === 0) {
        return '<div class="empty-message">No bosses selected yet</div>';
    }

    const selectedData = bossData
        .filter(boss => character.selectedBosses.has(boss.name))
        .sort((a, b) => b.value - a.value); // Sort by value descending
    
    const top14Names = getTop14Bosses(character.selectedBosses);
    
    return selectedData.map((boss, index) => {
        const isCounted = top14Names.includes(boss.name);
        const partyCount = getBossPartyCount(character, boss.name);
        const adjustedValue = boss.value / partyCount;
        return `
            <div class="selected-boss ${!isCounted ? 'not-counted' : ''}">
                <span class="selected-boss-name">${boss.name}${!isCounted ? ' (not counted)' : ''}</span>
                <div>
                    <span class="selected-boss-price">${formatValue(adjustedValue)}</span>
                    <button class="remove-btn" onclick="removeBoss('${boss.name}')">✕</button>
                </div>
            </div>
        `;
    }).join('');
}

function clearCharacterBosses() {
    const character = getActiveCharacter();
    if (character) {
        character.selectedBosses.clear();
        saveToLocalStorage();
        renderMainContent();
        renderCharacterTabs();
    }
}

function renderAll() {
    renderCharacterTabs();
    renderPitchCharacterTabs();
    if (activeMainTab === 'bossCrystals') {
        renderMainContent();
    } else if (activeMainTab === 'pitchTracker') {
        renderPitchContent();
    }
}

function renderPitchCharacterTabs() {
    const tabsContainer = document.getElementById('pitchCharacterTabs');
    if (!tabsContainer) return;

    if (characters.length === 0) {
        tabsContainer.innerHTML = '<div class="no-character-message">No characters yet. Add one to get started!</div>';
        return;
    }

    tabsContainer.innerHTML = characters.map(char => {
        const isActive = char.id === activeCharacterId;
        const completedCount = char.pitchedGear ? char.pitchedGear.size : 0;
        const totalCount = pitchedGearData.length;
        const sanitizedName = sanitizeInput(char.name);
        return `
            <div class="character-tab ${isActive ? 'active' : ''}"
                 onclick="switchCharacter(${char.id})">
                <div>
                    <div class="character-tab-name">${sanitizedName}</div>
                    <div class="character-tab-total">${completedCount}/${totalCount}</div>
                </div>
                ${characters.length > 1 ? `
                    <button class="delete-character-btn"
                            onclick="event.stopPropagation(); deleteCharacter(${char.id})"
                            title="Delete character">✕</button>
                ` : ''}
            </div>
        `;
    }).join('');
}

function togglePitchedGear(gearName) {
    const character = getActiveCharacter();
    if (!character) return;

    if (!character.pitchedGear) {
        character.pitchedGear = new Set();
    }

    if (!character.pitchedGearSpares) {
        character.pitchedGearSpares = {};
    }

    if (!character.pitchHistory) {
        character.pitchHistory = [];
    }

    if (character.pitchedGear.has(gearName)) {
        // Check if this item has spares
        const sparesCount = character.pitchedGearSpares[gearName] || 0;
        if (sparesCount > 0) {
            showSparesWarning(gearName, sparesCount);
            return;
        }
        character.pitchedGear.delete(gearName);
    } else {
        character.pitchedGear.add(gearName);
        
        // Add history event for acquisition
        character.pitchHistory.unshift({
            timestamp: new Date().toISOString(),
            action: 'Acquired',
            gearName: gearName,
            count: 0,
            isGlobal: false
        });
    }

    saveToLocalStorage();
    renderPitchCharacterTabs();
    renderPitchContent();
}

function showSparesWarning(gearName, sparesCount) {
    // Find the gear item element
    const gearElement = document.querySelector(`[data-gear="${gearName}"]`);
    if (!gearElement) return;

    // Remove any existing warning
    const existingWarning = document.getElementById('spares-warning');
    if (existingWarning) {
        existingWarning.remove();
    }

    // Create warning element
    const warning = document.createElement('div');
    warning.id = 'spares-warning';
    warning.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #e94560 0%, #c62d47 100%);
        color: white;
        padding: 20px 30px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(233, 69, 96, 0.5);
        z-index: 10000;
        font-size: 1.1em;
        font-weight: 600;
        text-align: center;
        animation: fadeInScale 0.3s ease;
    `;
    warning.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 1.2em;">⚠️ Cannot Uncheck</div>
        <div style="font-size: 0.95em; opacity: 0.95;">${gearName} has ${sparesCount} spare(s)</div>
        <div style="font-size: 0.85em; opacity: 0.8; margin-top: 8px;">Remove spares from history first</div>
    `;

    // Add animation keyframes if not already added
    if (!document.getElementById('warning-animation-style')) {
        const style = document.createElement('style');
        style.id = 'warning-animation-style';
        style.textContent = `
            @keyframes fadeInScale {
                from {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
            }
            @keyframes fadeOutScale {
                from {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.8);
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(warning);

    // Remove after 3 seconds with fade out animation
    setTimeout(() => {
        warning.style.animation = 'fadeOutScale 0.3s ease';
        setTimeout(() => {
            warning.remove();
        }, 300);
    }, 3000);
}

function togglePitchedGearSubOption(gearName, subOption) {
    const character = getActiveCharacter();
    if (!character) return;

    if (!character.pitchedGearSubOptions) {
        character.pitchedGearSubOptions = {};
    }

    if (!character.pitchedGearSubOptions[gearName]) {
        character.pitchedGearSubOptions[gearName] = new Set();
    }

    // For Black Heart / Total Control, make TC and BH mutually exclusive
    if (gearName === "Black Heart / Total Control") {
        if (character.pitchedGearSubOptions[gearName].has(subOption)) {
            // Uncheck if already checked
            character.pitchedGearSubOptions[gearName].delete(subOption);
        } else {
            // Clear the other option and check this one (radio button behavior)
            character.pitchedGearSubOptions[gearName].clear();
            character.pitchedGearSubOptions[gearName].add(subOption);
        }
    } else {
        // Normal toggle behavior for other items
        if (character.pitchedGearSubOptions[gearName].has(subOption)) {
            character.pitchedGearSubOptions[gearName].delete(subOption);
        } else {
            character.pitchedGearSubOptions[gearName].add(subOption);
        }
    }

    saveToLocalStorage();
    renderPitchContent();
}

function addPitchedGearSpare(gearName) {
    const character = getActiveCharacter();
    if (!character) return;

    if (!character.pitchedGearSpares) {
        character.pitchedGearSpares = {};
    }

    if (!character.pitchHistory) {
        character.pitchHistory = [];
    }

    // Check if this is Black Heart / Total Control and determine which sub-option
    const isUsingBH = gearName === "Black Heart / Total Control" &&
                     character.pitchedGearSubOptions?.[gearName]?.has("Using BH");
    const isUsingTC = gearName === "Black Heart / Total Control" &&
                     character.pitchedGearSubOptions?.[gearName]?.has("Using TC");
    
    // Determine display name for history
    let displayName = gearName;
    if (isUsingBH) {
        displayName = "Black Heart";
    } else if (isUsingTC) {
        displayName = "Total Control";
    }

    if (isUsingBH) {
        // Use global Black Heart counter
        globalBlackHeartSpares++;
        
        // Add to history (global event)
        character.pitchHistory.unshift({
            timestamp: new Date().toISOString(),
            action: 'Add',
            gearName: displayName,
            count: globalBlackHeartSpares,
            isGlobal: true
        });
    } else {
        // Use character-specific counter
        const currentCount = character.pitchedGearSpares[gearName] || 0;
        character.pitchedGearSpares[gearName] = currentCount + 1;

        // Add to history
        character.pitchHistory.unshift({
            timestamp: new Date().toISOString(),
            action: 'Add',
            gearName: displayName,
            count: currentCount + 1,
            isGlobal: false
        });
    }

    saveToLocalStorage();
    renderPitchContent();
}

function boomPitchedGearSpare(gearName) {
    const character = getActiveCharacter();
    if (!character) return;

    if (!character.pitchedGearSpares) {
        character.pitchedGearSpares = {};
    }

    if (!character.pitchHistory) {
        character.pitchHistory = [];
    }

    // Check if this is Black Heart / Total Control and determine which sub-option
    const isUsingBH = gearName === "Black Heart / Total Control" &&
                     character.pitchedGearSubOptions?.[gearName]?.has("Using BH");
    const isUsingTC = gearName === "Black Heart / Total Control" &&
                     character.pitchedGearSubOptions?.[gearName]?.has("Using TC");
    
    // Determine display name for history
    let displayName = gearName;
    if (isUsingBH) {
        displayName = "Black Heart";
    } else if (isUsingTC) {
        displayName = "Total Control";
    }

    if (isUsingBH) {
        // Use global Black Heart counter
        if (globalBlackHeartSpares > 0) {
            globalBlackHeartSpares--;
            
            // Add to history (global event)
            character.pitchHistory.unshift({
                timestamp: new Date().toISOString(),
                action: 'Boom',
                gearName: displayName,
                count: globalBlackHeartSpares,
                isGlobal: true
            });

            saveToLocalStorage();
            renderPitchContent();
        }
    } else {
        // Use character-specific counter
        const currentCount = character.pitchedGearSpares[gearName] || 0;
        if (currentCount > 0) {
            character.pitchedGearSpares[gearName] = currentCount - 1;

            // Add to history
            character.pitchHistory.unshift({
                timestamp: new Date().toISOString(),
                action: 'Boom',
                gearName: displayName,
                count: currentCount - 1,
                isGlobal: false
            });

            saveToLocalStorage();
            renderPitchContent();
        }
    }
}

function addGlobalBlackHeart() {
    const character = getActiveCharacter();
    if (!character) return;

    if (!character.pitchHistory) {
        character.pitchHistory = [];
    }

    // Add to global Black Heart counter
    globalBlackHeartSpares++;
    
    // Add to history (global event)
    character.pitchHistory.unshift({
        timestamp: new Date().toISOString(),
        action: 'Add',
        gearName: "Black Heart",
        count: globalBlackHeartSpares,
        isGlobal: true
    });

    saveToLocalStorage();
    renderPitchContent();
    
    // Also refresh BH History tab if it's active
    if (activeMainTab === 'bhHistory') {
        renderBHHistory();
    }
}

function removePitchHistoryEvent(eventIndex) {
    const character = getActiveCharacter();
    if (!character || !character.pitchHistory) return;

    // Remove the event
    character.pitchHistory.splice(eventIndex, 1);

    // Recalculate spares for all gear items AND update count in each history event
    character.pitchedGearSpares = {};
    
    // Also need to recalculate global BH counter by replaying ALL characters' histories
    globalBlackHeartSpares = 0;
    
    // Collect all BH events from all characters (now stored as "Black Heart" in history)
    const allBHEvents = [];
    characters.forEach(char => {
        if (char.pitchHistory) {
            char.pitchHistory.forEach(event => {
                if (event.isGlobal && event.gearName === "Black Heart") {
                    allBHEvents.push(event);
                }
            });
        }
    });
    
    // Sort all BH events chronologically (oldest first)
    allBHEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Replay BH events to recalculate global counter
    allBHEvents.forEach(event => {
        if (event.action === 'Add') {
            globalBlackHeartSpares++;
            event.count = globalBlackHeartSpares;
        } else if (event.action === 'Boom') {
            globalBlackHeartSpares = Math.max(0, globalBlackHeartSpares - 1);
            event.count = globalBlackHeartSpares;
        }
    });
    
    // Replay current character's history for character-specific items
    const chronologicalHistory = [...character.pitchHistory].reverse();
    
    chronologicalHistory.forEach(event => {
        if (!event.isGlobal) {
            if (!character.pitchedGearSpares[event.gearName]) {
                character.pitchedGearSpares[event.gearName] = 0;
            }
            
            if (event.action === 'Add') {
                character.pitchedGearSpares[event.gearName]++;
                event.count = character.pitchedGearSpares[event.gearName];
            } else if (event.action === 'Boom') {
                character.pitchedGearSpares[event.gearName] = Math.max(0, character.pitchedGearSpares[event.gearName] - 1);
                event.count = character.pitchedGearSpares[event.gearName];
            }
        }
    });

    saveToLocalStorage();
    renderPitchContent();
}

function renderPitchContent() {
    const character = getActiveCharacter();
    const pitchContent = document.getElementById('pitchContent');

    if (!character) {
        pitchContent.innerHTML = '<div class="no-character-message">Click "Add Character" to get started!</div>';
        return;
    }

    if (!character.pitchedGear) {
        character.pitchedGear = new Set();
    }

    if (!character.pitchedGearSubOptions) {
        character.pitchedGearSubOptions = {};
    }

    if (!character.pitchedGearSpares) {
        character.pitchedGearSpares = {};
    }

    const completedCount = character.pitchedGear.size;
    const totalCount = pitchedGearData.length;

    pitchContent.innerHTML = `
        <div style="padding: 30px; display: flex; gap: 30px; max-width: 1600px; margin: 0 auto;">
            <div style="flex: 1; min-width: 0;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="font-size: 2em; margin-bottom: 10px;">🎯 Pitched Gear Checklist</h2>
                    <p style="color: #999; font-size: 1.1em;">Track which pitched gear items ${sanitizeInput(character.name)} has obtained</p>
                </div>
                
                <div style="background: #0f3460; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                    <div style="font-size: 1.4em; color: #667eea; font-weight: 600; text-align: center; margin-bottom: 15px;">
                        Progress: ${completedCount}/${totalCount} items
                    </div>
                    <div style="background: #1a1a2e; height: 24px; border-radius: 12px; overflow: hidden;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; width: ${(completedCount / totalCount * 100)}%; transition: width 0.3s ease;"></div>
                    </div>
                    <div style="margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 12px;">
                        <button onclick="addGlobalBlackHeart()"
                                style="padding: 10px 20px; border-radius: 8px; border: none; background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; cursor: pointer; font-weight: 600; font-size: 1em; box-shadow: 0 4px 15px rgba(243, 156, 18, 0.3); transition: all 0.3s ease;"
                                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(243, 156, 18, 0.4)';"
                                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(243, 156, 18, 0.3)';">
                            ➕ Add BH
                        </button>
                        <div style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: rgba(243, 156, 18, 0.1); border-radius: 8px; border: 2px solid #f39c12;">
                            <span style="font-size: 0.9em; color: #f39c12; font-weight: 600;">Global BH:</span>
                            <span style="font-size: 1.2em; color: #f39c12; font-weight: 700;">${globalBlackHeartSpares}</span>
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 15px;">
                ${pitchedGearData.map(gear => {
                    const gearName = typeof gear === 'string' ? gear : gear.name;
                    const hasSubOptions = typeof gear === 'object' && gear.subOptions;
                    const isChecked = character.pitchedGear.has(gearName);
                    
                    const hasSpares = !noSparesItems.includes(gearName);
                    
                    // Check if this is Black Heart with "Using BH" selected (use global counter)
                    const isUsingBH = gearName === "Black Heart / Total Control" &&
                                     character.pitchedGearSubOptions?.[gearName]?.has("Using BH");
                    const sparesCount = isUsingBH ? globalBlackHeartSpares : (character.pitchedGearSpares[gearName] || 0);
                    
                    if (hasSubOptions) {
                        // Item with sub-options
                        return `
                            <div class="boss-item ${isChecked ? 'selected' : ''}"
                                 data-gear="${gearName}"
                                 onclick="togglePitchedGear(\`${gearName}\`)"
                                 style="cursor: pointer; display: flex; flex-direction: column; padding: 18px 20px; min-height: 60px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                                    <div style="display: flex; align-items: center; gap: 15px;">
                                        <div style="width: 28px; height: 28px; min-width: 28px; border: 2px solid ${isChecked ? '#667eea' : '#666'}; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: ${isChecked ? '#667eea' : 'transparent'}; transition: all 0.3s ease;">
                                            ${isChecked ? '<span style="color: white; font-weight: bold; font-size: 1.2em;">✓</span>' : ''}
                                        </div>
                                        <span class="boss-name" style="font-size: 1.05em;">${gearName}</span>
                                    </div>
                                    ${hasSpares && isChecked ? `
                                        <div onclick="event.stopPropagation();" style="display: flex; align-items: center; gap: 6px;">
                                            <span style="font-size: 0.85em; color: #999; font-weight: 600;">Spares:</span>
                                            <input type="text"
                                                   value="${sparesCount}"
                                                   readonly
                                                   style="width: 45px; padding: 4px 8px; border-radius: 4px; border: 1px solid #666; background: #1a1a2e; color: #e0e0e0; text-align: center; font-weight: 600;">
                                            <button onclick="addPitchedGearSpare(\`${gearName}\`)"
                                                    style="padding: 4px 10px; border-radius: 4px; border: none; background: #27ae60; color: white; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                                                Add
                                            </button>
                                            <button onclick="boomPitchedGearSpare(\`${gearName}\`)"
                                                    style="padding: 4px 10px; border-radius: 4px; border: none; background: #e94560; color: white; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                                                Boom
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                                ${isChecked ? `
                                    <div style="margin-top: 12px; margin-left: 43px; display: flex; gap: 15px;" onclick="event.stopPropagation();">
                                        ${gear.subOptions.map(subOpt => {
                                            const subChecked = character.pitchedGearSubOptions[gearName]?.has(subOpt);
                                            return `
                                                <div onclick="togglePitchedGearSubOption(\`${gearName}\`, \`${subOpt}\`)"
                                                     style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 6px 12px; background: rgba(255,255,255,0.05); border-radius: 6px; transition: all 0.3s ease;"
                                                     onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                                                     onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                                    <div style="width: 20px; height: 20px; border: 2px solid ${subChecked ? '#667eea' : '#666'}; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: ${subChecked ? '#667eea' : 'transparent'}; transition: all 0.3s ease;">
                                                        ${subChecked ? '<span style="color: white; font-weight: bold; font-size: 0.9em;">✓</span>' : ''}
                                                    </div>
                                                    <span style="font-size: 0.9em; color: #e0e0e0;">${subOpt}</span>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    } else {
                        // Regular item
                        return `
                            <div class="boss-item ${isChecked ? 'selected' : ''}"
                                 data-gear="${gearName}"
                                 onclick="togglePitchedGear(\`${gearName}\`)"
                                 style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; min-height: 60px;">
                                <div style="display: flex; align-items: center; gap: 15px;">
                                    <div style="width: 28px; height: 28px; min-width: 28px; border: 2px solid ${isChecked ? '#667eea' : '#666'}; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: ${isChecked ? '#667eea' : 'transparent'}; transition: all 0.3s ease;">
                                        ${isChecked ? '<span style="color: white; font-weight: bold; font-size: 1.2em;">✓</span>' : ''}
                                    </div>
                                    <span class="boss-name" style="font-size: 1.05em;">${gearName}</span>
                                </div>
                                ${hasSpares && isChecked ? `
                                    <div onclick="event.stopPropagation();" style="display: flex; align-items: center; gap: 6px;">
                                        <span style="font-size: 0.85em; color: #999; font-weight: 600;">Spares:</span>
                                        <input type="text"
                                               value="${sparesCount}"
                                               readonly
                                               style="width: 45px; padding: 4px 8px; border-radius: 4px; border: 1px solid #666; background: #1a1a2e; color: #e0e0e0; text-align: center; font-weight: 600;">
                                        <button onclick="addPitchedGearSpare(\`${gearName}\`)"
                                                style="padding: 4px 10px; border-radius: 4px; border: none; background: #27ae60; color: white; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                                            Add
                                        </button>
                                        <button onclick="boomPitchedGearSpare(\`${gearName}\`)"
                                                style="padding: 4px 10px; border-radius: 4px; border: none; background: #e94560; color: white; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                                            Boom
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }
                }).join('')}
                </div>
            </div>

            <div style="width: 350px; flex-shrink: 0;">
                <div style="background: #0f3460; border-radius: 12px; padding: 20px; position: sticky; top: 20px;">
                    <h3 style="font-size: 1.3em; margin-bottom: 15px; color: #667eea; display: flex; align-items: center; gap: 10px;">
                        📜 Pitch History
                    </h3>
                    <div style="max-height: 600px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
                        ${character.pitchHistory && character.pitchHistory.length > 0 ? character.pitchHistory.map((event, index) => {
                            const date = new Date(event.timestamp);
                            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            
                            // Determine color and icon based on action type
                            let actionColor, actionIcon;
                            if (event.action === 'Add') {
                                actionColor = '#27ae60';
                                actionIcon = '➕';
                            } else if (event.action === 'Boom') {
                                actionColor = '#e94560';
                                actionIcon = '💥';
                            } else if (event.action === 'Acquired') {
                                actionColor = '#3498db';
                                actionIcon = '✔';
                            } else if (event.action === 'Removed') {
                                actionColor = '#95a5a6';
                                actionIcon = 'Ã¢ÂÅ’';
                            } else {
                                actionColor = '#999';
                                actionIcon = '•';
                            }
                            
                            return `
                                <div style="background: rgba(255,255,255,0.05); padding: 10px 12px; border-radius: 6px; border-left: 3px solid ${actionColor}; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                                    <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px;">
                                        <span style="font-weight: 600; color: ${actionColor}; font-size: 0.85em;">
                                            ${actionIcon} ${event.action}
                                        </span>
                                        <span style="color: #e0e0e0; font-size: 0.9em;">
                                            ${event.gearName}
                                        </span>
                                        <span style="color: #999; font-size: 0.8em;">
                                            (${event.count})
                                        </span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <div style="font-size: 0.75em; color: #999; text-align: right; white-space: nowrap;">
                                            ${timeStr}<br>${dateStr}
                                        </div>
                                        <button onclick="removePitchHistoryEvent(${index})"
                                                style="padding: 4px 8px; border-radius: 4px; border: none; background: rgba(233, 69, 96, 0.2); color: #e94560; cursor: pointer; font-size: 0.85em; font-weight: 600; transition: all 0.2s ease;"
                                                onmouseover="this.style.background='rgba(233, 69, 96, 0.4)'"
                                                onmouseout="this.style.background='rgba(233, 69, 96, 0.2)'">
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('') : '<div style="text-align: center; color: #666; padding: 20px;">No history yet</div>'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderBHHistory() {
    const bhHistoryContent = document.getElementById('bhHistoryContent');
    
    // Collect all Black Heart events from all characters
    const allBHEvents = [];
    characters.forEach(char => {
        if (char.pitchHistory) {
            char.pitchHistory.forEach(event => {
                if (event.gearName === "Black Heart" && event.isGlobal) {
                    allBHEvents.push({
                        ...event,
                        characterName: char.name,
                        characterId: char.id
                    });
                }
            });
        }
    });
    
    // Sort by timestamp (newest first)
    allBHEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    bhHistoryContent.innerHTML = `
        <div style="padding: 30px; max-width: 1200px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="font-size: 2em; margin-bottom: 10px;">🖤 Black Heart History</h2>
                <p style="color: #999; font-size: 1.1em;">Global Black Heart tracking across all characters</p>
            </div>
            
            <div style="background: #0f3460; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
                    <span style="font-size: 1.2em; color: #f39c12; font-weight: 600;">Current Global Total:</span>
                    <span style="font-size: 2em; color: #f39c12; font-weight: 700;">${globalBlackHeartSpares}</span>
                </div>
                <div style="text-align: center; margin-top: 15px;">
                    <button onclick="addGlobalBlackHeart()"
                            style="padding: 10px 20px; border-radius: 8px; border: none; background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; cursor: pointer; font-weight: 600; font-size: 1em; box-shadow: 0 4px 15px rgba(243, 156, 18, 0.3); transition: all 0.3s ease;"
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(243, 156, 18, 0.4)';"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(243, 156, 18, 0.3)';">
                        ➕ Add BH
                    </button>
                </div>
            </div>
            
            <div style="background: #0f3460; padding: 25px; border-radius: 12px;">
                <h3 style="color: #f39c12; margin-bottom: 20px; font-size: 1.3em; text-align: center;">
                    📜 Complete History (${allBHEvents.length} events)
                </h3>
                <div style="max-height: 600px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
                    ${allBHEvents.length > 0 ? allBHEvents.map((event, index) => {
                        const date = new Date(event.timestamp);
                        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const actionColor = event.action === 'Add' ? '#27ae60' : '#e94560';
                        const actionIcon = event.action === 'Add' ? '➕' : '💥';
                        
                        return `
                            <div style="background: rgba(243, 156, 18, 0.1); padding: 12px 15px; border-radius: 8px; border-left: 4px solid ${actionColor}; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                                <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px;">
                                    <span style="font-weight: 700; color: ${actionColor}; font-size: 1em;">
                                        ${actionIcon} ${event.action}
                                    </span>
                                    <span style="color: #f39c12; font-weight: 600; font-size: 0.95em;">
                                        Black Heart
                                    </span>
                                    <span style="color: #999; font-size: 0.85em;">
                                        ⏱ ${event.count}
                                    </span>
                                    <span style="color: #667eea; font-size: 0.85em; font-style: italic;">
                                        by ${event.characterName}
                                    </span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="font-size: 0.8em; color: #999; text-align: right; white-space: nowrap;">
                                        ${timeStr}<br>${dateStr}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('') : '<div style="text-align: center; color: #666; padding: 40px; font-size: 1.1em;">No Black Heart history yet. Click "Add BH" to get started!</div>'}
                </div>
            </div>
        </div>
    `;
}

function renderSellingStrategy() {
    const container = document.getElementById('sellingStrategyContent');

    if (characters.length === 0) {
        container.innerHTML = '<div class="no-character-message">No characters found. Add characters in the Boss Crystals tab.</div>';
        return;
    }

    const rows = characters.map(char => {
        if (!char.selectedBosses || char.selectedBosses.size === 0) {
            return `
                <div style="background: #0f3460; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
                    <div style="color: #667eea; font-size: 1.2em; font-weight: 700; margin-bottom: 8px;">${sanitizeInput(char.name)}</div>
                    <div style="color: #666; font-style: italic;">No bosses selected.</div>
                </div>`;
        }

        const allBosses = Array.from(char.selectedBosses).map(baseName => {
            const difficulty = getBossDifficulty(char, baseName);
            const partyCount = getBossPartyCount(char, baseName);
            const adjustedValue = getBossValue(baseName, difficulty) / partyCount;
            return { baseName, difficulty, partyCount, adjustedValue };
        }).sort((a, b) => b.adjustedValue - a.adjustedValue);

        const overflow = allBosses.slice(14);

        const overflowHTML = overflow.length === 0
            ? '<div style="color: #2ecc71; font-style: italic;">All crystals count — nothing to drop.</div>'
            : overflow.map(boss => `
                <div style="display: flex; justify-content: space-between; align-items: center;
                            background: #16213e; border-left: 3px solid #e94560;
                            border-radius: 6px; padding: 10px 14px; margin-bottom: 6px;">
                    <span style="color: #e0e0e0; font-weight: 600;">
                        ${sanitizeInput(boss.difficulty)} ${sanitizeInput(boss.baseName)}
                        ${boss.partyCount > 1 ? `<span style="color: #999; font-size: 0.85em;">(party ${boss.partyCount})</span>` : ''}
                    </span>
                    <span style="color: #e94560; font-weight: bold;">${formatValue(boss.adjustedValue)}</span>
                </div>`).join('');

        return `
            <div style="background: #0f3460; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
                    <div style="color: #667eea; font-size: 1.2em; font-weight: 700;">${sanitizeInput(char.name)}</div>
                    <div style="color: #999; font-size: 0.9em;">${char.selectedBosses.size} bosses selected &mdash; top 14 count</div>
                </div>
                ${overflow.length > 0 ? `<div style="color: #ffb347; font-size: 0.9em; margin-bottom: 10px;">
                    ⚠️ Drop these <strong>${overflow.length}</strong> crystal${overflow.length > 1 ? 's' : ''} — they don't count toward your weekly total:
                </div>` : ''}
                ${overflowHTML}
            </div>`;
    }).join('');

    container.innerHTML = `
        <div style="padding: 30px;">
            <h2 style="color: #e94560; margin-bottom: 6px; font-size: 1.6em;">💰 Selling Strategy</h2>
            <p style="color: #999; margin-bottom: 24px;">Crystals listed below are overflow — skip selling these to save time.</p>
            ${rows}
        </div>`;
}

// Initialize - load from localStorage or create first character
function initialize() {
    const loaded = loadFromLocalStorage();
    if (!loaded || characters.length === 0) {
        // No saved data or empty, create first character
        addCharacter();
    } else {
        // Loaded successfully, restore the active tab
        const tabs = document.querySelectorAll('.main-tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
        });
        
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        // Activate the saved tab
        const activeTabButton = Array.from(tabs).find(tab => {
            if (activeMainTab === 'bossCrystals') return tab.textContent.includes('Boss Crystals');
            if (activeMainTab === 'pitchTracker') return tab.textContent.includes('Pitched Tracker');
            if (activeMainTab === 'bhHistory') return tab.textContent.includes('BH History');
            return false;
        });
        if (activeTabButton) {
            activeTabButton.classList.add('active');
        }
        
        const activeTabContent = document.getElementById(activeMainTab + 'Tab');
        if (activeTabContent) {
            activeTabContent.classList.add('active');
        }
        
        // Render the appropriate content
        if (activeMainTab === 'bossCrystals') {
            renderAll();
        } else if (activeMainTab === 'pitchTracker') {
            renderPitchCharacterTabs();
            renderPitchContent();
        } else if (activeMainTab === 'bhHistory') {
            renderBHHistory();
        }
    }
}

// Start the app
initialize();
