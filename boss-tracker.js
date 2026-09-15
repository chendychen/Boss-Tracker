// Embedded game data (for local file:// protocol compatibility)
const GAME_DATA = {
    "bosses": [
        { "name": "Extreme Black Mage", "price": "18B", "value": 18000 },
        { "name": "Extreme Kaling", "price": "6.03B", "value": 6026 },
        { "name": "Hard Jupiter", "price": "5.95B", "value": 5953 },
        { "name": "Extreme First Adversary", "price": "5.88B", "value": 5880 },
        { "name": "Extreme Kalos the Guardian", "price": "5.2B", "value": 5200 },
        { "name": "Hard Black Mage", "price": "4.5B", "value": 4500 },
        { "name": "Extreme Chosen Seren", "price": "4.24B", "value": 4235 },
        { "name": "Hard Baldrix", "price": "4.2B", "value": 4200 },
        { "name": "Hard Malefic Star", "price": "3.99B", "value": 3990 },
        { "name": "Hard Limbo", "price": "3.75B", "value": 3745 },
        { "name": "Hard Kaling", "price": "2.99B", "value": 2990 },
        { "name": "Normal Jupiter", "price": "2.97B", "value": 2965 },
        { "name": "Hard First Adversary", "price": "2.94B", "value": 2940 },
        { "name": "Normal Baldrix", "price": "2.8B", "value": 2800 },
        { "name": "Chaos Kalos the Guardian", "price": "2.6B", "value": 2600 },
        { "name": "Normal Limbo", "price": "2.1B", "value": 2100 },
        { "name": "Normal Kaling", "price": "1.51B", "value": 1506.5 },
        { "name": "Normal Malefic Star", "price": "1.45B", "value": 1452 },
        { "name": "Extreme Lotus", "price": "1.4B", "value": 1397.5 },
        { "name": "Normal First Adversary", "price": "1.37B", "value": 1365 },
        { "name": "Normal Kalos the Guardian", "price": "1.3B", "value": 1300 },
        { "name": "Hard Chosen Seren", "price": "1.1B", "value": 1096.5625 },
        { "name": "Easy Kaling", "price": "1.03B", "value": 1031.25 },
        { "name": "Easy First Adversary", "price": "985M", "value": 985 },
        { "name": "Easy Kalos the Guardian", "price": "937.5M", "value": 937.5 },
        { "name": "Normal Chosen Seren", "price": "889.02M", "value": 889.021875 },
        { "name": "Hard Verus Hilla", "price": "762.11M", "value": 762.105 },
        { "name": "Hard Darknell", "price": "667.92M", "value": 667.92 },
        { "name": "Hard Will", "price": "621.81M", "value": 621.81 },
        { "name": "Chaos Guardian Angel Slime", "price": "600.58M", "value": 600.578125 },
        { "name": "Normal Verus Hilla", "price": "581.88M", "value": 581.88 },
        { "name": "Chaos Gloom", "price": "563.95M", "value": 563.945 },
        { "name": "Hard Lucid", "price": "504M", "value": 504 },
        { "name": "Hard Lotus", "price": "444.68M", "value": 444.675 },
        { "name": "Hard Damien", "price": "421.88M", "value": 421.875 }
    ],
    "pitchedGear": [
        {
            "name": "Black Heart / Total Control",
            "subOptions": ["Using TC", "Using BH"]
        },
        "Endless Terror",
        "Magic Eyepatch",
        "Source of Suffering",
        "Berserked",
        "Commanding Force Earring",
        "Dreamy Belt",
        "Genesis Badge",
        "Cursed Spellbook",
        "Mitra's Rage"
    ],
    "noSparesItems": ["Cursed Spellbook", "Genesis Badge", "Mitra's Rage"]
};

// Boss profile icons, cropped from the in-game Soul Crystal price list.
// Files live in images/bosses/ and are named after the slugified full boss name.
const BOSS_ICON_NAMES = new Set([
    "Extreme Black Mage", "Extreme Kaling", "Hard Jupiter", "Extreme First Adversary",
    "Extreme Kalos the Guardian", "Hard Black Mage", "Extreme Chosen Seren", "Hard Baldrix",
    "Hard Malefic Star", "Hard Limbo", "Hard Kaling", "Normal Jupiter",
    "Hard First Adversary", "Normal Baldrix", "Chaos Kalos the Guardian", "Normal Limbo",
    "Normal Kaling", "Normal Malefic Star", "Extreme Lotus", "Normal First Adversary",
    "Normal Kalos the Guardian", "Hard Chosen Seren", "Easy Kaling", "Easy First Adversary",
    "Easy Kalos the Guardian", "Normal Chosen Seren", "Hard Verus Hilla", "Hard Darknell",
    "Hard Will", "Chaos Guardian Angel Slime", "Normal Verus Hilla", "Chaos Gloom",
    "Hard Lucid", "Hard Lotus", "Hard Damien"
]);

/**
 * Resolves the icon path for a boss at a given difficulty.
 * Falls back to any other difficulty of the same boss when that exact
 * combination has no artwork, and returns null when nothing matches.
 * @param {string} baseName - Boss name without the difficulty prefix
 * @param {string} [difficulty] - Preferred difficulty
 * @returns {string|null} Relative image path, or null if no icon exists
 */
function getBossIconPath(baseName, difficulty) {
    const slug = name => `images/bosses/${name.toLowerCase().replace(/'/g, '').replace(/ /g, '-')}.png`;

    if (difficulty && BOSS_ICON_NAMES.has(`${difficulty} ${baseName}`)) {
        return slug(`${difficulty} ${baseName}`);
    }
    const group = bossGroups[baseName];
    if (group) {
        const match = Object.values(group.difficulties)
            .find(d => BOSS_ICON_NAMES.has(d.fullName));
        if (match) return slug(match.fullName);
    }
    return BOSS_ICON_NAMES.has(baseName) ? slug(baseName) : null;
}

/**
 * Builds the <img> markup for a boss icon, or an empty string when none exists.
 * @param {string} baseName - Boss name without the difficulty prefix
 * @param {string} [difficulty] - Preferred difficulty
 * @param {string} [extraClass] - Additional CSS class for the image
 * @returns {string} HTML for the icon
 */
function renderBossIcon(baseName, difficulty, extraClass = '') {
    const path = getBossIconPath(baseName, difficulty);
    if (!path) return '';
    return `<img class="boss-icon ${extraClass}" src="${path}" alt="" loading="lazy">`;
}

// Global variables for game data
let bossDataFlat = GAME_DATA.bosses;
let pitchedGearData = GAME_DATA.pitchedGear;
let noSparesItems = GAME_DATA.noSparesItems;

const GEAR_SLOTS = [
    { name: 'Ring 1', col: 1, row: 1, options: ['Slime', 'Kanna', 'Meister', 'Gollux', 'Endless Terror', 'RoR', 'Cont.'] },
    { name: 'Ring 2', col: 1, row: 2, options: ['Slime', 'Kanna', 'Meister', 'Gollux', 'Endless Terror', 'RoR', 'Cont.'] },
    { name: 'Ring 3', col: 1, row: 3, options: ['Slime', 'Kanna', 'Meister', 'Gollux', 'Endless Terror', 'RoR', 'Cont.'] },
    { name: 'Ring 4', col: 1, row: 4, options: ['Slime', 'Kanna', 'Meister', 'Gollux', 'Endless Terror', 'RoR', 'Cont.'] },
    { name: 'Belt',   col: 1, row: 5, options: ['Gollux', 'Dreamy Belt'] },
    { name: 'Face',      col: 2, row: 1, options: ['Twilight', 'Berserked'] },
    { name: 'Eyes',      col: 2, row: 2, options: ['BBM', 'Magic Eyepatch'] },
    { name: 'Earrings',  col: 2, row: 3, options: ['Gollux', 'Commanding Force Earrings'] },
    { name: 'Pendant 1', col: 2, row: 4, options: ['Gollux', 'Daybreak', 'Dominator', 'Source of Suffering'] },
    { name: 'Pendant 2', col: 2, row: 5, options: ['Gollux', 'Daybreak', 'Dominator', 'Source of Suffering'] },
    { name: 'Hat',      col: 3, row: 1, options: ['CRA', 'Eternal'] },
    { name: 'Top',      col: 3, row: 2, options: ['CRA', 'Eternal'] },
    { name: 'Bottom',   col: 3, row: 3, options: ['CRA', 'Eternal'] },
    { name: 'Shoulder', col: 3, row: 4, options: ['Arcane', 'Eternal'] },
    { name: 'Cape',   col: 4, row: 1, options: ['Arcane', 'Eternal'] },
    { name: 'Gloves', col: 4, row: 2, options: ['Arcane', 'Eternal'] },
    { name: 'Shoes',  col: 4, row: 3, options: ['Arcane', 'Eternal'] },
];

// FD gain table for Eternal upgrades: ETERNAL_FD_TABLE[sf][nthEternal (0-indexed)]
const ETERNAL_FD_TABLE = {
    '17': [-2.72, 1.36, 1.08, -2.38, -3.46, -1.14, 0.21],
    '18': [-2.14, 1.94, 1.67, -1.77, -2.91, -0.58, 0.76],
    '19': [-1.53, 2.55, 2.27, -1.19, -2.30,  0.03, 1.37],
    '20': [-0.89, 3.18, 2.91, -0.56, -1.66,  0.66, 2.01],
    '21': [-0.23, 3.84, 3.57,  0.11, -1.00,  1.32, 2.67],
    '22': [ 0.49, 4.56, 4.29,  0.82, -0.28,  2.05, 3.39]
};

// Optimal Eternal upgrade priority order
const ETERNAL_PRIORITY = [
    { slot: 'Hat',      replaces: 'CRA',    boss: 'Kalos' },
    { slot: 'Top',      replaces: 'CRA',    boss: 'Kalos & Kaling' },
    { slot: 'Bottom',   replaces: 'CRA',    boss: 'Kalos & Kaling' },
    { slot: 'Shoulder', replaces: 'Arcane',  boss: 'Kaling' },
    { slot: 'Cape',     replaces: 'Arcane',  boss: 'Limbo & Baldrix' },
    { slot: 'Gloves',   replaces: 'Arcane',  boss: 'Limbo & Baldrix' },
    { slot: 'Shoes',    replaces: 'Arcane',  boss: 'Limbo & Baldrix' },
];

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
    
    // Update tab buttons. The button is found from tabName rather than the ambient
    // event so that calling this directly (not from a click) still highlights it.
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.classList.toggle('active',
            (tab.getAttribute('onclick') || '').includes("'" + tabName + "'"));
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Save active tab to localStorage
    saveToLocalStorage();
    
    // Render appropriate content
    renderAllCharacterTabs();
    renderActiveTab();
}

// LocalStorage functions
/**
 * Serialises one character to a plain JSON-safe object.
 * Every persistence path (localStorage save and file export) goes through this
 * so the four of them cannot drift apart and silently drop fields.
 * @param {object} char
 * @returns {object}
 */
function serializeCharacter(char) {
    const subOptionsObj = {};
    if (char.pitchedGearSubOptions) {
        for (const [key, value] of Object.entries(char.pitchedGearSubOptions)) {
            subOptionsObj[key] = Array.from(value);
        }
    }
    return {
        id: char.id,
        name: char.name,
        selectedBosses: Array.from(char.selectedBosses || new Set()),
        bossPartyCount: char.bossPartyCount || {},
        bossDifficulty: char.bossDifficulty || {},
        pitchedGear: Array.from(char.pitchedGear || new Set()),
        pitchedGearSubOptions: subOptionsObj,
        pitchedGearSpares: char.pitchedGearSpares || {},
        pitchedGearStarForce: char.pitchedGearStarForce || {},
        pitchHistory: char.pitchHistory || [],
        gearStarForce: char.gearStarForce || {},
        gearType: char.gearType || {},
        gearLevel: char.gearLevel || {},
        charLevel: char.charLevel || 270,
        sacredForce: char.sacredForce || null,
        arcaneForce: char.arcaneForce || null,
        calibBoss: char.calibBoss || null,
        calibDifficulty: char.calibDifficulty || null,
        calibMinutes: char.calibMinutes || null,
        manualDps: char.manualDps || null,
        ied: (char.ied === null || char.ied === undefined) ? null : char.ied
    };
}

/**
 * Rebuilds a character from its serialised form, restoring Sets and filling
 * defaults for fields written by older versions of the app.
 * @param {object} char
 * @returns {object}
 */
function deserializeCharacter(char) {
    const subOptionsObj = {};
    if (char.pitchedGearSubOptions) {
        for (const [key, value] of Object.entries(char.pitchedGearSubOptions)) {
            subOptionsObj[key] = new Set(value);
        }
    }
    return {
        id: char.id,
        name: char.name,
        selectedBosses: new Set(char.selectedBosses || []),
        bossPartyCount: char.bossPartyCount || {},
        bossDifficulty: char.bossDifficulty || {},
        pitchedGear: new Set(char.pitchedGear || []),
        pitchedGearSubOptions: subOptionsObj,
        pitchedGearSpares: char.pitchedGearSpares || {},
        pitchedGearStarForce: char.pitchedGearStarForce || {},
        pitchHistory: char.pitchHistory || [],
        gearStarForce: char.gearStarForce || {},
        gearType: char.gearType || {},
        gearLevel: char.gearLevel || {},
        charLevel: char.charLevel || 270,
        sacredForce: char.sacredForce || null,
        arcaneForce: char.arcaneForce || null,
        calibBoss: char.calibBoss || null,
        calibDifficulty: char.calibDifficulty || null,
        calibMinutes: char.calibMinutes || null,
        manualDps: char.manualDps || null,
        ied: (char.ied === null || char.ied === undefined) ? null : char.ied
    };
}

function saveToLocalStorage() {
    const data = {
        characters: characters.map(serializeCharacter),
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
            characters = data.characters.map(deserializeCharacter);
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
    renderActiveTab();
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
        characters: characters.map(serializeCharacter),
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
            characters = data.characters.map(deserializeCharacter);
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
        pitchedGearStarForce: {}, // Store star force level per gear item
        pitchHistory: [], // Store pitch history events
        gearStarForce: {}, // Store star force level per gear slot
        gearType: {}, // Store gear type per gear slot
        gearLevel: {}, // Store level for RoR/Cont rings
        charLevel: 270,          // for level-advantage damage modifier
        sacredForce: null,       // Sacred Force total
        arcaneForce: null,       // Arcane Force total
        calibBoss: null,         // boss used to derive this character's DPS
        calibDifficulty: null,
        calibMinutes: null,
        manualDps: null,         // B/sec override, wins over calibration
        ied: null,               // ignore enemy defense %, blank = 98
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
        pitchedGearStarForce: { ...currentChar.pitchedGearStarForce }, // Copy star force levels
        gearStarForce: { ...currentChar.gearStarForce }, // Copy gear star force levels
        gearType: { ...currentChar.gearType }, // Copy gear types
        gearLevel: { ...currentChar.gearLevel }, // Copy gear levels
        charLevel: currentChar.charLevel || 270,
        sacredForce: currentChar.sacredForce || null,
        arcaneForce: currentChar.arcaneForce || null,
        calibBoss: currentChar.calibBoss || null,
        calibDifficulty: currentChar.calibDifficulty || null,
        calibMinutes: currentChar.calibMinutes || null,
        manualDps: currentChar.manualDps || null,
        ied: currentChar.ied === undefined ? null : currentChar.ied,
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

/**
 * Re-renders every per-character tab strip. Each main tab keeps its own strip,
 * so they all have to move together when the active character changes.
 */
function renderAllCharacterTabs() {
    renderCharacterTabs();
    renderPitchCharacterTabs();
    renderGearTrackerCharacterTabs();
    renderProgressionCharacterTabs();
}

/**
 * Re-renders the body of whichever main tab is active. Every caller that
 * changes shared state goes through this, so adding a tab means touching one
 * place rather than four that silently drift apart.
 */
function renderActiveTab() {
    if (activeMainTab === 'bossCrystals') {
        renderMainContent();
    } else if (activeMainTab === 'pitchTracker') {
        renderPitchContent();
    } else if (activeMainTab === 'bhHistory') {
        renderBHHistory();
    } else if (activeMainTab === 'sellingStrategy') {
        renderSellingStrategy();
    } else if (activeMainTab === 'gearTracker') {
        renderGearTrackerContent();
    } else if (activeMainTab === 'progression') {
        renderProgressionContent();
    }
}

function switchCharacter(id) {
    activeCharacterId = id;
    saveToLocalStorage();
    renderAllCharacterTabs();
    renderActiveTab();
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

    // bossData is already ordered by each boss's highest-difficulty price, descending.
    // The list stays in that fixed order — picking a difficulty or party size never reorders it.
    const filteredBosses = bossData
        .filter(boss => boss.baseName.toLowerCase().includes(filter.toLowerCase()));

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
                <span class="boss-label">${renderBossIcon(boss.baseName, difficulty)}<span class="boss-name">${sanitizedBossName}</span></span>
                <div style="display: flex; align-items: center; gap: 6px;">
                    ${isSelected && difficulties.length > 1 ? `
                        <select onchange="event.stopPropagation(); updateBossDifficulty('${boss.baseName}', this.value)"
                                onclick="event.stopPropagation()"
                                style="padding: 4px 8px; border-radius: 0; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.9); color: #333; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                            ${difficulties.map(diff => `
                                <option value="${diff}" ${difficulty === diff ? 'selected' : ''} style="background: white; color: #333;">${diff}</option>
                            `).join('')}
                        </select>
                    ` : ''}
                    ${isSelected ? `
                        <select onchange="event.stopPropagation(); updateBossPartyCount('${boss.baseName}', this.value)"
                                onclick="event.stopPropagation()"
                                style="padding: 4px 8px; border-radius: 0; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.9); color: #333; cursor: pointer; font-weight: 600; font-size: 0.85em;">
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
            <span class="boss-label">${renderBossIcon(boss.baseName, difficulty)}<span class="boss-name">${sanitizedBossName}</span></span>
            <div style="display: flex; align-items: center; gap: 6px;">
                ${isSelected && difficulties.length > 1 ? `
                    <select onchange="event.stopPropagation(); updateBossDifficulty('${boss.baseName}', this.value)"
                            onclick="event.stopPropagation()"
                            style="padding: 4px 8px; border-radius: 0; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.9); color: #333; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                        ${difficulties.map(diff => `
                            <option value="${diff}" ${difficulty === diff ? 'selected' : ''} style="background: white; color: #333;">${diff}</option>
                        `).join('')}
                    </select>
                ` : ''}
                ${isSelected ? `
                    <select onchange="event.stopPropagation(); updateBossPartyCount('${boss.baseName}', this.value)"
                            onclick="event.stopPropagation()"
                            style="padding: 4px 8px; border-radius: 0; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.9); color: #333; cursor: pointer; font-weight: 600; font-size: 0.85em;">
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
                   <a href="#" onclick="event.preventDefault(); document.querySelector('[onclick*=sellingStrategy]').click();" style="display: block; margin-top: 8px; color: #0f62fe; text-decoration: underline; cursor: pointer; font-weight: 600;">Tell me more</a>
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
    renderAllCharacterTabs();
    renderActiveTab();
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
        background: linear-gradient(135deg, #da1e28 0%, #c62d47 100%);
        color: white;
        padding: 20px 30px;
        border-radius: 0;
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

function setPitchedGearStarForce(gearName, level) {
    const character = getActiveCharacter();
    if (!character) return;

    if (!character.pitchedGearStarForce) {
        character.pitchedGearStarForce = {};
    }

    if (level === 'Unused') {
        delete character.pitchedGearStarForce[gearName];
    } else {
        character.pitchedGearStarForce[gearName] = level;
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

function renderGearCard(gear, character) {
    const noSparesItems = GAME_DATA.noSparesItems;
    const noStarForceItems = ['Genesis Badge', 'Cursed Spellbook', "Mitra's Rage"];
    const gearName = typeof gear === 'string' ? gear : gear.name;
    const hasSubOptions = typeof gear === 'object' && gear.subOptions;
    const isChecked = character.pitchedGear.has(gearName);
    const hasSpares = !noSparesItems.includes(gearName);
    const isUsingBH = gearName === "Black Heart / Total Control" &&
                     character.pitchedGearSubOptions?.[gearName]?.has("Using BH");
    const sparesCount = isUsingBH ? globalBlackHeartSpares : (character.pitchedGearSpares[gearName] || 0);
    const starForceLevel = character.pitchedGearStarForce?.[gearName] || 'Unused';
    const starForceOptions = ['Unused', '18', '19', '20', '21', '22'];
    const hasStarForce = !noStarForceItems.includes(gearName);

    const starForceDropdown = isChecked && hasStarForce ? `
        <div onclick="event.stopPropagation();" style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.85em; color: #999; font-weight: 600;">SF:</span>
            <select onchange="setPitchedGearStarForce(\`${gearName}\`, this.value)"
                    style="padding: 4px 8px; border-radius: 0; border: 1px solid #666; background: #161616; color: #c6c6c6; font-weight: 600; font-size: 0.85em; cursor: pointer;">
                ${starForceOptions.map(opt => `<option value="${opt}" ${starForceLevel === opt ? 'selected' : ''}>${opt === 'Unused' ? 'Unused' : opt + '★'}</option>`).join('')}
            </select>
        </div>
    ` : '';

    const sparesHtml = hasSpares && isChecked ? `
        <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.85em; color: #999; font-weight: 600;">Spares:</span>
            <input type="text" value="${sparesCount}" readonly
                   style="width: 45px; padding: 4px 8px; border-radius: 0; border: 1px solid #666; background: #161616; color: #c6c6c6; text-align: center; font-weight: 600;">
            <button onclick="addPitchedGearSpare(\`${gearName}\`)"
                    style="padding: 4px 10px; border-radius: 0; border: none; background: #1a7a38; color: white; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                Add
            </button>
            <button onclick="boomPitchedGearSpare(\`${gearName}\`)"
                    style="padding: 4px 10px; border-radius: 0; border: none; background: #da1e28; color: white; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                Boom
            </button>
        </div>
    ` : '';

    let controlsRow = '';
    if (isChecked && (starForceDropdown || sparesHtml)) {
        controlsRow = `
            <div onclick="event.stopPropagation();" style="display: flex; align-items: center; gap: 12px; margin-top: 12px; margin-left: 43px; flex-wrap: wrap;">
                ${starForceDropdown}
                ${sparesHtml}
            </div>
        `;
    }

    let subOptionsRow = '';
    if (hasSubOptions && isChecked) {
        subOptionsRow = `
            <div style="margin-top: 12px; margin-left: 43px; display: flex; gap: 15px;" onclick="event.stopPropagation();">
                ${gear.subOptions.map(subOpt => {
                    const subChecked = character.pitchedGearSubOptions[gearName]?.has(subOpt);
                    return `
                        <div onclick="togglePitchedGearSubOption(\`${gearName}\`, \`${subOpt}\`)"
                             style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 6px 12px; background: rgba(255,255,255,0.05); border-radius: 0; transition: all 0.3s ease;"
                             onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                             onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                            <div style="width: 20px; height: 20px; border: 2px solid ${subChecked ? '#0f62fe' : '#666'}; border-radius: 0; display: flex; align-items: center; justify-content: center; background: ${subChecked ? '#0f62fe' : 'transparent'}; transition: all 0.3s ease;">
                                ${subChecked ? '<span style="color: white; font-weight: bold; font-size: 0.9em;">✓</span>' : ''}
                            </div>
                            <span style="font-size: 0.9em; color: #c6c6c6;">${subOpt}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    return `
        <div class="boss-item ${isChecked ? 'selected' : ''}"
             data-gear="${gearName}"
             onclick="togglePitchedGear(\`${gearName}\`)"
             style="cursor: pointer; display: flex; flex-direction: column; padding: 18px 20px; min-height: 60px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="width: 28px; height: 28px; min-width: 28px; border: 2px solid ${isChecked ? '#0f62fe' : '#666'}; border-radius: 0; display: flex; align-items: center; justify-content: center; background: ${isChecked ? '#0f62fe' : 'transparent'}; transition: all 0.3s ease;">
                    ${isChecked ? '<span style="color: white; font-weight: bold; font-size: 1.2em;">✓</span>' : ''}
                </div>
                <span class="boss-name" style="font-size: 1.05em;">${gearName}</span>
            </div>
            ${controlsRow}
            ${subOptionsRow}
        </div>
    `;
}

function renderPitchedGearSections(character) {
    const noStarForceItems = ['Genesis Badge', 'Cursed Spellbook', "Mitra's Rage"];
    const blackHeartGear = pitchedGearData.filter(g => typeof g === 'object' && g.subOptions);
    const starForceGear = pitchedGearData.filter(g => {
        const name = typeof g === 'string' ? g : g.name;
        return !noStarForceItems.includes(name) && !(typeof g === 'object' && g.subOptions);
    });
    const noStarForceGear = pitchedGearData.filter(g => {
        const name = typeof g === 'string' ? g : g.name;
        return noStarForceItems.includes(name);
    });

    return `
        <div style="margin-bottom: 20px;">
            <h3 style="font-size: 1.1em; color: #c6c6c6; margin-bottom: 10px;">Heart</h3>
            ${blackHeartGear.map(g => renderGearCard(g, character)).join('')}
        </div>
        <div style="margin-bottom: 20px;">
            <h3 style="font-size: 1.1em; color: #c6c6c6; margin-bottom: 10px;">Star Forceable Pitched</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 15px;">
                ${starForceGear.map(g => renderGearCard(g, character)).join('')}
            </div>
        </div>
        <div style="margin-bottom: 20px;">
            <h3 style="font-size: 1.1em; color: #c6c6c6; margin-bottom: 10px;">One-of Pitched</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 15px;">
                ${noStarForceGear.map(g => renderGearCard(g, character)).join('')}
            </div>
        </div>
    `;
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
                
                <div style="background: #393939; padding: 25px; border-radius: 0; margin-bottom: 30px;">
                    <div style="font-size: 1.4em; color: #0f62fe; font-weight: 600; text-align: center; margin-bottom: 15px;">
                        Progress: ${completedCount}/${totalCount} items
                    </div>
                    <div style="background: #161616; height: 24px; border-radius: 0; overflow: hidden;">
                        <div style="background: #0f62fe; height: 100%; width: ${(completedCount / totalCount * 100)}%; transition: width 0.3s ease;"></div>
                    </div>
                    <div style="margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 12px;">
                        <button onclick="addGlobalBlackHeart()"
                                style="padding: 10px 20px; border-radius: 0; border: none; background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; cursor: pointer; font-weight: 600; font-size: 1em; box-shadow: 0 4px 15px rgba(243, 156, 18, 0.3); transition: all 0.3s ease;"
                                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(243, 156, 18, 0.4)';"
                                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(243, 156, 18, 0.3)';">
                            ➕ Add BH
                        </button>
                        <div style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: rgba(243, 156, 18, 0.1); border-radius: 0; border: 2px solid #f39c12;">
                            <span style="font-size: 0.9em; color: #f39c12; font-weight: 600;">Global BH:</span>
                            <span style="font-size: 1.2em; color: #f39c12; font-weight: 700;">${globalBlackHeartSpares}</span>
                        </div>
                    </div>
                </div>

                ${renderPitchedGearSections(character)}
            </div>

            <div style="width: 350px; flex-shrink: 0;">
                <div style="background: #393939; border-radius: 0; padding: 20px; position: sticky; top: 20px;">
                    <h3 style="font-size: 1.3em; margin-bottom: 15px; color: #0f62fe; display: flex; align-items: center; gap: 10px;">
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
                                actionColor = '#1a7a38';
                                actionIcon = '➕';
                            } else if (event.action === 'Boom') {
                                actionColor = '#da1e28';
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
                                <div style="background: rgba(255,255,255,0.05); padding: 10px 12px; border-radius: 0; border-left: 3px solid ${actionColor}; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                                    <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px;">
                                        <span style="font-weight: 600; color: ${actionColor}; font-size: 0.85em;">
                                            ${actionIcon} ${event.action}
                                        </span>
                                        <span style="color: #c6c6c6; font-size: 0.9em;">
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
                                                style="padding: 4px 8px; border-radius: 0; border: none; background: rgba(233, 69, 96, 0.2); color: #da1e28; cursor: pointer; font-size: 0.85em; font-weight: 600; transition: all 0.2s ease;"
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
            
            <div style="background: #393939; padding: 25px; border-radius: 0; margin-bottom: 30px;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
                    <span style="font-size: 1.2em; color: #f39c12; font-weight: 600;">Current Global Total:</span>
                    <span style="font-size: 2em; color: #f39c12; font-weight: 700;">${globalBlackHeartSpares}</span>
                </div>
                <div style="text-align: center; margin-top: 15px;">
                    <button onclick="addGlobalBlackHeart()"
                            style="padding: 10px 20px; border-radius: 0; border: none; background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; cursor: pointer; font-weight: 600; font-size: 1em; box-shadow: 0 4px 15px rgba(243, 156, 18, 0.3); transition: all 0.3s ease;"
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(243, 156, 18, 0.4)';"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(243, 156, 18, 0.3)';">
                        ➕ Add BH
                    </button>
                </div>
            </div>
            
            <div style="background: #393939; padding: 25px; border-radius: 0;">
                <h3 style="color: #f39c12; margin-bottom: 20px; font-size: 1.3em; text-align: center;">
                    📜 Complete History (${allBHEvents.length} events)
                </h3>
                <div style="max-height: 600px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
                    ${allBHEvents.length > 0 ? allBHEvents.map((event, index) => {
                        const date = new Date(event.timestamp);
                        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const actionColor = event.action === 'Add' ? '#1a7a38' : '#da1e28';
                        const actionIcon = event.action === 'Add' ? '➕' : '💥';
                        
                        return `
                            <div style="background: rgba(243, 156, 18, 0.1); padding: 12px 15px; border-radius: 0; border-left: 4px solid ${actionColor}; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
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
                                    <span style="color: #0f62fe; font-size: 0.85em; font-style: italic;">
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

function setGearStarForce(slot, level) {
    const character = getActiveCharacter();
    if (!character) return;

    if (!character.gearStarForce) {
        character.gearStarForce = {};
    }

    if (level === 'Unused') {
        delete character.gearStarForce[slot];
    } else {
        character.gearStarForce[slot] = level;
    }

    saveToLocalStorage();
    renderGearTrackerContent();
}

function setGearType(slot, type) {
    const character = getActiveCharacter();
    if (!character) return;

    if (!character.gearType) character.gearType = {};
    if (!character.gearStarForce) character.gearStarForce = {};
    if (!character.gearLevel) character.gearLevel = {};

    const oldType = character.gearType[slot] || '';

    if (!type) {
        delete character.gearType[slot];
        delete character.gearStarForce[slot];
        delete character.gearLevel[slot];
    } else {
        // RoR and Cont. are mutually exclusive across all rings
        if (type === 'RoR' || type === 'Cont.') {
            const otherType = type === 'RoR' ? 'Cont.' : 'RoR';
            const ringSlots = ['Ring 1', 'Ring 2', 'Ring 3', 'Ring 4'];
            for (const rs of ringSlots) {
                if (character.gearType[rs] === otherType) {
                    delete character.gearType[rs];
                    delete character.gearLevel[rs];
                }
            }
        }

        character.gearType[slot] = type;

        // Clear SF when switching to RoR/Cont (uses level instead)
        if (type === 'RoR' || type === 'Cont.') {
            delete character.gearStarForce[slot];
        }
        // Clear level when switching away from RoR/Cont
        if (oldType === 'RoR' || oldType === 'Cont.') {
            if (type !== 'RoR' && type !== 'Cont.') {
                delete character.gearLevel[slot];
            }
        }
    }

    saveToLocalStorage();
    renderGearTrackerContent();
}

function setGearLevel(slot, level) {
    const character = getActiveCharacter();
    if (!character) return;

    if (!character.gearLevel) {
        character.gearLevel = {};
    }

    if (!level) {
        delete character.gearLevel[slot];
    } else {
        character.gearLevel[slot] = level;
    }

    saveToLocalStorage();
    renderGearTrackerContent();
}

function applyGearPreset(preset) {
    const character = getActiveCharacter();
    if (!character) return;

    if (!character.gearType) character.gearType = {};
    if (!character.gearStarForce) character.gearStarForce = {};

    const sfSelect = document.getElementById('presetSFSelect');
    const sf = sfSelect ? sfSelect.value : 'Unused';

    const presets = {
        'Gollux': [
            { slot: 'Ring 1', type: 'Gollux' },
            { slot: 'Earrings', type: 'Gollux' },
            { slot: 'Pendant 1', type: 'Gollux' },
            { slot: 'Belt', type: 'Gollux' }
        ],
        'Arcane': [
            { slot: 'Shoulder', type: 'Arcane' },
            { slot: 'Cape', type: 'Arcane' },
            { slot: 'Gloves', type: 'Arcane' },
            { slot: 'Shoes', type: 'Arcane' }
        ],
        'CRA': [
            { slot: 'Hat', type: 'CRA' },
            { slot: 'Top', type: 'CRA' },
            { slot: 'Bottom', type: 'CRA' }
        ]
    };

    const items = presets[preset];
    if (!items) return;

    // For Gollux ring: find first ring slot not already taken by a non-Gollux unique type
    if (preset === 'Gollux') {
        const ringSlots = ['Ring 1', 'Ring 2', 'Ring 3', 'Ring 4'];
        // Find a ring slot: prefer one already set to Gollux, otherwise first empty, otherwise Ring 1
        let targetRing = ringSlots.find(rs => character.gearType[rs] === 'Gollux')
                      || ringSlots.find(rs => !character.gearType[rs])
                      || 'Ring 1';
        items[0].slot = targetRing;
    }

    for (const item of items) {
        character.gearType[item.slot] = item.type;
        if (sf === 'Unused') {
            delete character.gearStarForce[item.slot];
        } else {
            character.gearStarForce[item.slot] = sf;
        }
    }

    saveToLocalStorage();
    renderGearTrackerContent();
}

function renderGearTrackerCharacterTabs() {
    const tabsContainer = document.getElementById('gearTrackerCharacterTabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = characters.map(char => {
        const isActive = char.id === activeCharacterId;
        const sanitizedName = sanitizeInput(char.name);
        return `
            <div class="character-tab ${isActive ? 'active' : ''}"
                 onclick="switchCharacter(${char.id})">
                <div>
                    <div class="character-tab-name">${sanitizedName}</div>
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

function getEternalsRecommendations(character, strategy) {
    const eternalSlots = ['Hat', 'Top', 'Bottom', 'Shoulder', 'Cape', 'Gloves', 'Shoes'];
    const currentEternals = eternalSlots.filter(s => character.gearType?.[s] === 'Eternal');
    const eternalCount = currentEternals.length;

    // Find remaining slots in priority order
    const remaining = ETERNAL_PRIORITY.filter(p => !currentEternals.includes(p.slot));

    const priorityOrder = ETERNAL_PRIORITY.map(p => p.slot);
    // Sort current eternals by priority order to assign correct Nth column
    const sortedCurrentEternals = [...currentEternals].sort((a, b) => priorityOrder.indexOf(a) - priorityOrder.indexOf(b));

    // Calculate cumulative FD from current eternals using their actual SF
    let cumulativeFD = 0;
    for (let i = 0; i < sortedCurrentEternals.length; i++) {
        const slot = sortedCurrentEternals[i];
        const sf = character.gearStarForce?.[slot] || '18';
        const row = ETERNAL_FD_TABLE[sf];
        if (row && i < 7) {
            cumulativeFD += row[i];
        }
    }

    const allOptions = [];

    // Option type 1: Acquire next Eternal piece (must follow priority order)
    if (remaining.length > 0 && eternalCount < 7) {
        const nthEternal = eternalCount; // 0-indexed column
        let sf;
        if (strategy === 'Safe') {
            sf = (nthEternal < 3) ? '18' : '21';
        } else {
            sf = '22';
        }

        const fdGain = ETERNAL_FD_TABLE[sf][nthEternal];
        const entry = remaining[0];

        allOptions.push({
            type: 'acquire',
            slot: entry.slot,
            replaces: entry.replaces,
            boss: entry.boss,
            sf: sf,
            fdGain: fdGain,
            nthEternal: nthEternal + 1
        });
    }

    // Option type 2: Upgrade SF on existing Eternals
    // Generate upgrade options for each phase boundary (e.g. 18→19, 19→21)
    for (let i = 0; i < sortedCurrentEternals.length; i++) {
        const slot = sortedCurrentEternals[i];
        const currentSF = character.gearStarForce?.[slot] || '18';
        const currentSFNum = parseInt(currentSF);
        if (isNaN(currentSFNum) || currentSFNum >= 22) continue;

        // Determine SF milestones for this slot
        let milestones;
        if (strategy === 'Safe') {
            milestones = i < 3 ? [19, 21] : [21];
        } else {
            milestones = [22];
        }

        for (let m = 0; m < milestones.length; m++) {
            const milestone = milestones[m];
            // fromSF is either current SF or the previous milestone
            const fromSFNum = Math.max(currentSFNum, m > 0 ? milestones[m - 1] : currentSFNum);
            if (fromSFNum >= milestone) continue;

            const fromSF = String(fromSFNum);
            const toSF = String(milestone);
            const fromFD = ETERNAL_FD_TABLE[fromSF]?.[i] || 0;
            const toFD = ETERNAL_FD_TABLE[toSF]?.[i] || 0;
            const fdGain = toFD - fromFD;

            allOptions.push({
                type: 'upgrade',
                slot: slot,
                fromSF: fromSF,
                sf: toSF,
                fdGain: fdGain,
                nthEternal: i + 1,
                phase: m
            });
        }
    }

    // Sort: earlier phases on the same slot must precede later phases,
    // otherwise sort by FD gain descending
    allOptions.sort((a, b) => {
        // If same slot upgrades, earlier phase comes first
        if (a.type === 'upgrade' && b.type === 'upgrade' && a.slot === b.slot) {
            return a.phase - b.phase;
        }
        return b.fdGain - a.fdGain;
    });
    const recommendations = allOptions.slice(0, 3);

    return { recommendations, eternalCount, cumulativeFD };
}

function renderEternalsStrategy(character) {
    const safe = getEternalsRecommendations(character, 'Safe');
    const risky = getEternalsRecommendations(character, 'Risky');

    function renderPanel(title, data, description) {
        if (data.eternalCount >= 7) {
            return `
                <div style="flex: 1; background: #393939; padding: 20px;">
                    <h3 style="font-size: 1.1em; color: #c6c6c6; margin-bottom: 8px;">${title}</h3>
                    <p style="font-size: 0.85em; color: #999; margin-bottom: 15px;">${description}</p>
                    <div style="text-align: center; color: #0f62fe; font-weight: 600; padding: 20px;">All 7 Eternal pieces equipped!</div>
                </div>
            `;
        }

        return `
            <div style="flex: 1; background: #393939; padding: 20px;">
                <h3 style="font-size: 1.1em; color: #c6c6c6; margin-bottom: 8px;">${title}</h3>
                <p style="font-size: 0.85em; color: #999; margin-bottom: 15px;">${description}</p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${data.recommendations.map((rec, i) => {
                        const fdColor = rec.fdGain >= 0 ? '#1a7a38' : '#da1e28';
                        const fdSign = rec.fdGain >= 0 ? '+' : '';
                        const isUpgrade = rec.type === 'upgrade';
                        const label = isUpgrade
                            ? `${rec.slot} <span style="color: #666; font-weight: 400;">${rec.fromSF}★ → ${rec.sf}★</span>`
                            : `${rec.slot} <span style="color: #666; font-weight: 400;">→ Eternal</span>`;
                        const detail = isUpgrade
                            ? `Upgrade SF · ${rec.nthEternal}${rec.nthEternal === 1 ? 'st' : rec.nthEternal === 2 ? 'nd' : rec.nthEternal === 3 ? 'rd' : 'th'} Eternal`
                            : `Replaces ${rec.replaces} · ${rec.boss} · ${rec.sf}★ · ${rec.nthEternal}${rec.nthEternal === 1 ? 'st' : rec.nthEternal === 2 ? 'nd' : rec.nthEternal === 3 ? 'rd' : 'th'} Eternal`;
                        return `
                            <div style="background: #262626; padding: 14px; display: flex; align-items: center; justify-content: space-between;">
                                <div>
                                    <div style="font-weight: 600; color: #c6c6c6; font-size: 0.95em;">
                                        ${i + 1}. ${label}
                                    </div>
                                    <div style="font-size: 0.8em; color: #999; margin-top: 4px;">
                                        ${detail}
                                    </div>
                                </div>
                                <div style="font-size: 1.2em; font-weight: 700; color: ${fdColor}; min-width: 70px; text-align: right;">
                                    ${fdSign}${rec.fdGain.toFixed(2)}%
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    const cumulativeFD = safe.cumulativeFD;
    const cumColor = cumulativeFD >= 0 ? '#1a7a38' : '#da1e28';
    const cumSign = cumulativeFD >= 0 ? '+' : '';

    return `
        <div style="margin-top: 30px;">
            <h2 style="font-size: 1.4em; margin-bottom: 4px; text-align: center; color: #c6c6c6;">Eternals Strategy <span style="font-size: 0.7em; color: #666;">(${safe.eternalCount}/7 equipped)</span></h2>
            <div style="text-align: center; margin-bottom: 15px; font-size: 1.1em; font-weight: 600; color: ${cumColor};">
                Current FD: ${cumSign}${cumulativeFD.toFixed(2)}%
            </div>
            <div style="display: flex; gap: 15px;">
                ${renderPanel('Safe', safe, '18★ for first 3, then 21★ max')}
                ${renderPanel('Risky', risky, 'All at 22★ for maximum FD')}
            </div>
        </div>
    `;
}

function renderGearTrackerContent() {
    const character = getActiveCharacter();
    const container = document.getElementById('gearTrackerContent');
    if (!container) return;

    if (!character) {
        container.innerHTML = '<div class="no-character-message">Click "Add Character" to get started!</div>';
        return;
    }

    if (!character.gearStarForce) character.gearStarForce = {};
    if (!character.gearType) character.gearType = {};
    if (!character.gearLevel) character.gearLevel = {};

    const starForceOptions = ['Unused', '18', '19', '20', '21', '22'];
    const levelOptions = ['3', '4', '5', '6'];

    // Collect used types for uniqueness constraints
    const ringSlots = ['Ring 1', 'Ring 2', 'Ring 3', 'Ring 4'];
    const pendantSlots = ['Pendant 1', 'Pendant 2'];
    const usedRingTypes = {};
    const usedPendantTypes = {};
    for (const rs of ringSlots) {
        const t = character.gearType[rs];
        if (t) usedRingTypes[t] = rs;
    }
    for (const ps of pendantSlots) {
        const t = character.gearType[ps];
        if (t) usedPendantTypes[t] = ps;
    }

    // Check if RoR or Cont. is already used (for mutual exclusivity)
    const hasRoR = Object.values(character.gearType).includes('RoR');
    const hasCont = Object.values(character.gearType).includes('Cont.');

    container.innerHTML = `
        <div style="padding: 30px; max-width: 1200px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="font-size: 2em; margin-bottom: 10px;">🛡️ Gear Tracker</h2>
                <p style="color: #999; font-size: 1.1em;">Track star force levels for ${sanitizeInput(character.name)}'s equipment</p>
            </div>

            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                <span style="font-size: 0.9em; color: #999; font-weight: 600;">Quick Fill:</span>
                <select id="presetSFSelect"
                        style="padding: 6px 10px; border-radius: 0; border: 1px solid #666; background: #161616; color: #c6c6c6; font-weight: 600; font-size: 0.85em; cursor: pointer;">
                    ${['Unused', '18', '19', '20', '21', '22'].map(opt => `<option value="${opt}">${opt === 'Unused' ? 'Unused' : opt + '★'}</option>`).join('')}
                </select>
                <button onclick="applyGearPreset('Gollux')"
                        style="padding: 6px 16px; border-radius: 0; border: none; background: #0f62fe; color: white; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                    Full Gollux
                </button>
                <button onclick="applyGearPreset('Arcane')"
                        style="padding: 6px 16px; border-radius: 0; border: none; background: #0f62fe; color: white; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                    Full Arcane
                </button>
                <button onclick="applyGearPreset('CRA')"
                        style="padding: 6px 16px; border-radius: 0; border: none; background: #0f62fe; color: white; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                    Full CRA
                </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(5, auto); gap: 15px;">
                ${GEAR_SLOTS.map(slot => {
                    const sfLevel = character.gearStarForce[slot.name] || 'Unused';
                    const gearType = character.gearType[slot.name] || '';
                    const gearLvl = character.gearLevel[slot.name] || '';
                    const isRoRCont = gearType === 'RoR' || gearType === 'Cont.';
                    const isRing = ringSlots.includes(slot.name);
                    const isPendant = pendantSlots.includes(slot.name);

                    // Filter options for uniqueness
                    let availableOptions = slot.options;
                    if (isRing) {
                        availableOptions = slot.options.filter(opt => {
                            // Allow the currently selected type
                            if (opt === gearType) return true;
                            // Block if already used by another ring
                            if (usedRingTypes[opt]) return false;
                            // RoR/Cont mutual exclusivity
                            if (opt === 'RoR' && hasCont) return false;
                            if (opt === 'Cont.' && hasRoR) return false;
                            return true;
                        });
                    } else if (isPendant) {
                        availableOptions = slot.options.filter(opt => {
                            if (opt === gearType) return true;
                            if (usedPendantTypes[opt]) return false;
                            return true;
                        });
                    }

                    // Second row: Level for RoR/Cont, SF for everything else
                    let secondRow = '';
                    if (isRoRCont) {
                        secondRow = `
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 0.85em; color: #999; font-weight: 600; min-width: 35px;">Lv:</span>
                                <select onchange="setGearLevel('${slot.name}', this.value)"
                                        style="padding: 4px 8px; border-radius: 0; border: 1px solid #666; background: #161616; color: #c6c6c6; font-weight: 600; font-size: 0.85em; cursor: pointer; flex: 1;">
                                    <option value="" ${!gearLvl ? 'selected' : ''}>--</option>
                                    ${levelOptions.map(opt => `<option value="${opt}" ${gearLvl === opt ? 'selected' : ''}>Level ${opt}</option>`).join('')}
                                </select>
                            </div>
                        `;
                    } else {
                        secondRow = `
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 0.85em; color: #999; font-weight: 600; min-width: 35px;">SF:</span>
                                <select onchange="setGearStarForce('${slot.name}', this.value)"
                                        style="padding: 4px 8px; border-radius: 0; border: 1px solid #666; background: #161616; color: #c6c6c6; font-weight: 600; font-size: 0.85em; cursor: pointer; flex: 1;">
                                    ${starForceOptions.map(opt => `<option value="${opt}" ${sfLevel === opt ? 'selected' : ''}>${opt === 'Unused' ? 'Unused' : opt + '★'}</option>`).join('')}
                                </select>
                            </div>
                        `;
                    }

                    return `
                        <div class="boss-item" style="grid-column: ${slot.col}; grid-row: ${slot.row}; display: flex; flex-direction: column; padding: 18px 20px; min-height: 60px;">
                            <span class="boss-name" style="font-size: 1.05em; margin-bottom: 10px;">${slot.name}</span>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 0.85em; color: #999; font-weight: 600; min-width: 35px;">Type:</span>
                                    <select onchange="setGearType('${slot.name}', this.value)"
                                            style="padding: 4px 8px; border-radius: 0; border: 1px solid #666; background: #161616; color: #c6c6c6; font-weight: 600; font-size: 0.85em; cursor: pointer; flex: 1;">
                                        <option value="" ${!gearType ? 'selected' : ''}>--</option>
                                        ${availableOptions.map(opt => `<option value="${opt}" ${gearType === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                                    </select>
                                </div>
                                ${secondRow}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            ${renderEternalsStrategy(character)}
        </div>
    `;
}

function renderSellingStrategy() {
    const container = document.getElementById('sellingStrategyContent');

    if (characters.length === 0) {
        container.innerHTML = '<div class="no-character-message">No characters found. Add characters in the Boss Crystals tab.</div>';
        return;
    }

    const allBosses = getAllBossesWithValues(); // sorted by adjustedValue desc
    const globalLimitHit = allBosses.length > 180;

    // Build a set of overflow boss keys: "characterId:baseName"
    const overflowKeys = new Set();
    if (globalLimitHit) {
        allBosses.slice(180).forEach(b => overflowKeys.add(`${b.characterId}:${b.baseName}`));
    } else {
        // Per-character: bosses ranked 15+ for each character
        characters.forEach(char => {
            const charBosses = allBosses.filter(b => b.characterId === char.id);
            charBosses.slice(14).forEach(b => overflowKeys.add(`${b.characterId}:${b.baseName}`));
        });
    }

    const limitLabel = globalLimitHit ? 'global 180-crystal limit' : 'per-character 14-crystal limit';

    // Group overflow by "difficulty baseName" boss label
    const byBoss = {};
    allBosses.forEach(b => {
        if (!overflowKeys.has(`${b.characterId}:${b.baseName}`)) return;
        const label = `${b.difficulty} ${b.baseName}`;
        if (!byBoss[label]) byBoss[label] = { label, baseName: b.baseName, difficulty: b.difficulty,
                                                adjustedValue: b.adjustedValue, chars: [] };
        byBoss[label].chars.push({ name: b.characterName, partyCount: b.partyCount });
    });

    // Sort groups by adjustedValue descending
    const groups = Object.values(byBoss).sort((a, b) => b.adjustedValue - a.adjustedValue);

    const rows = groups.map(group => {
        const charTags = group.chars.map(c =>
            `<span style="background: #161616; color: #c6c6c6; border-radius: 0; padding: 3px 8px; font-size: 0.85em;">
                ${sanitizeInput(c.name)}${c.partyCount > 1 ? ` <span style="color:#999;">×${c.partyCount}</span>` : ''}
            </span>`
        ).join('');

        return `
            <div style="display: flex; justify-content: space-between; align-items: center;
                        background: #393939; border-left: 3px solid #da1e28;
                        border-radius: 0; padding: 10px 16px; margin-bottom: 8px; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex: 1;">
                    ${renderBossIcon(group.baseName, group.difficulty, 'boss-icon-sm')}
                    <span style="color: #c6c6c6; font-weight: 700; white-space: nowrap;">${sanitizeInput(group.label)} <span style="color: #da1e28;">x${group.chars.length}</span></span>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">${charTags}</div>
                </div>
                <span style="color: #da1e28; font-weight: bold; white-space: nowrap;">${formatValue(group.adjustedValue)}</span>
            </div>`;
    }).join('');

    const bodyContent = rows.length > 0
        ? rows
        : '<div style="color: #24a148; text-align: center; padding: 40px; font-size: 1.1em;">All crystals count — nothing to drop.</div>';

    container.innerHTML = `
        <div style="padding: 30px;">
            <h2 style="color: #da1e28; margin-bottom: 6px; font-size: 1.6em;">💰 Selling Strategy</h2>
            <p style="color: #999; margin-bottom: 20px;">Based on the ${limitLabel}. Drop these crystals — they don't count toward your total.</p>
            ${bodyContent}
        </div>`;
}


// ============================================================================
// Progression model
// ----------------------------------------------------------------------------
// Boss combat data (HP per phase, monster level, Sacred/Arcane Force floors)
// comes from the in-game boss HP tables. A phase is [hp, monsterLevel,
// sacRequirement, segments]; some phases sit at a different level to the boss
// as a whole (Normal Kalos P1 is 275 while P2 is 280), which changes the level
// modifier mid-fight, so phases are priced individually.
// ============================================================================

const BOSS_COMBAT = {
    "Baldrix": {"Normal":{lv:290,sac:700,af:null,ph:[[2379800000000000,290,700,1],[2531700000000000,290,700,1],[4145400000000000.5,290,700,1]]}, "Hard":{lv:290,sac:700,af:null,ph:[[5344600000000000,290,700,1],[5685800000000000,290,700,1],[9309000000000000,290,700,1]]}},
    "Black Mage": {"Hard":{lv:275,sac:null,af:1320,ph:[[63000000000000,265,null,1],[115500000000000,275,null,1],[157500000000000,275,null,1],[136500000000000,265,null,1]]}, "Extreme":{lv:280,sac:null,af:1320,ph:[[1180000000000000,275,null,1],[1190000000000000,280,null,1],[1285000000000000,280,null,1],[1152000000000000,280,null,1]]}},
    "Chosen Seren": {"Normal":{lv:270,sac:200,af:null,ph:[[52500000000000,270,150,1],[155500000000000,270,200,1]]}, "Hard":{lv:275,sac:200,af:null,ph:[[126000000000000,275,150,1],[357000000000000,275,200,1]]}, "Extreme":{lv:280,sac:200,af:null,ph:[[1320000000000000,275,150,1],[5160000000000000,280,200,1]]}},
    "Damien": {"Normal":{lv:210,sac:null,af:null,ph:[[840000000000,210,null,1],[360000000000,210,null,1]]}, "Hard":{lv:210,sac:null,af:null,ph:[[25200000000000,210,null,1],[10800000000000,210,null,1]]}},
    "Darknell": {"Normal":{lv:265,sac:null,af:850,ph:[[26000000000000,265,null,1]]}, "Hard":{lv:265,sac:null,af:850,ph:[[157500000000000,265,null,1]]}},
    "First Adversary": {"Easy":{lv:270,sac:220,af:null,ph:[[171537000000000,270,220,1],[171537000000000,270,220,1],[228011000000000,270,220,1]]}, "Normal":{lv:280,sac:320,af:null,ph:[[494111000000000,280,320,1],[494111000000000,280,320,1],[646783000000000,280,320,1]]}, "Hard":{lv:285,sac:340,af:null,ph:[[3180000000000000,285,340,1],[3180000000000000,285,340,1],[4227000000000000.5,285,340,1]]}, "Extreme":{lv:290,sac:460,af:null,ph:[[10080000000000000,290,460,1],[10080000000000000,290,460,1],[13400000000000000,290,460,1]]}},
    "Gloom": {"Normal":{lv:255,sac:null,af:730,ph:[[25500000000000,255,null,1]]}, "Chaos":{lv:255,sac:null,af:730,ph:[[127500000000000,255,null,1]]}},
    "Guardian Angel Slime": {"Normal":{lv:220,sac:null,af:null,ph:[[5000000000000,220,null,1]]}, "Chaos":{lv:220,sac:null,af:null,ph:[[90000000000000,220,null,1]]}},
    "Jupiter": {"Normal":{lv:295,sac:810,af:null,n:["Phase 1","Phase 2","Phase 3"],ph:[[2049999999999999.8,295,810,1],[3080000000000000,295,810,1],[5130000000000000,295,810,1]]}, "Hard":{lv:295,sac:810,af:null,n:["Phase 1","Phase 2","Phase 3"],ph:[[9880000000000000,295,810,1],[14820000000000000,295,810,1],[24700000000000000,295,810,1]]}},
    "Kaling": {"Easy":{lv:275,sac:230,af:null,n:["Phase 1: Perils","","Phase 3: Kaling","Phase 3: Perils"],ph:[[288000000000000,275,230,3],[105000000000000,275,230,1],[150000000000000,275,230,1],[378000000000000,275,230,3]]}, "Normal":{lv:285,sac:330,af:null,n:["Phase 1: Perils","","Phase 3: Kaling","Phase 3: Perils"],ph:[[1200000000000000,285,330,3],[468000000000000,285,330,1],[722000000000000,285,330,1],[1536000000000000,285,330,3]]}, "Hard":{lv:285,sac:350,af:null,n:["Phase 1: Perils","","Phase 3: Kaling","Phase 3: Perils"],ph:[[2718000000000000,285,350,3],[1404000000000000,285,350,1],[2240000000000000.2,285,350,1],[5481000000000000,285,350,3]]}, "Extreme":{lv:285,sac:480,af:null,n:["Phase 1: Perils","","Phase 3: Kaling","Phase 3: Perils"],ph:[[18200000000000000,285,480,3],[6930000000000000,285,480,1],[8662000000000001,285,480,1],[20800000000000000,285,480,3]]}},
    "Kalos the Guardian": {"Easy":{lv:270,sac:200,af:null,ph:[[94500000000000,270,200,1],[262500000000000,270,200,4]]}, "Normal":{lv:280,sac:300,af:null,ph:[[336000000000000,275,250,1],[720000000000000,280,300,4]]}, "Chaos":{lv:285,sac:330,af:null,ph:[[1060000000000000,285,330,1],[4059999999999999.5,285,330,4]]}, "Extreme":{lv:285,sac:440,af:null,ph:[[5970000000000000,285,440,1],[15600000000000000,285,440,4]]}},
    "Limbo": {"Normal":{lv:285,sac:500,af:null,ph:[[1940000000000000,285,500,1],[1940000000000000,285,500,2],[2600000000000000,285,500,1]]}, "Hard":{lv:285,sac:500,af:null,ph:[[3780000000000000,285,500,1],[3780000000000000,285,500,2],[4990000000000000,285,500,1]]}},
    "Lotus": {"Normal":{lv:210,sac:null,af:null,ph:[[470000000000,210,null,1],[470000000000,210,null,1],[630000000000,210,null,1]]}, "Hard":{lv:210,sac:null,af:null,ph:[[10000000000000,210,null,1],[10000000000000,210,null,1],[13500000000000,210,null,1]]}, "Extreme":{lv:285,sac:null,af:null,ph:[[545000000000000,285,null,1],[545000000000000,285,null,1],[720000000000000,285,null,1]]}},
    "Lucid": {"Easy":{lv:230,sac:null,af:360,ph:[[6000000000000,230,null,1],[6000000000000,230,null,1]]}, "Normal":{lv:230,sac:null,af:360,ph:[[12000000000000,230,null,1],[12000000000000,230,null,1]]}, "Hard":{lv:230,sac:null,af:360,ph:[[50800000000000,230,null,1],[54000000000000,230,null,1],[12800000000000,230,null,1]]}},
    "Malefic Star": {"Normal":{lv:280,sac:400,af:null,n:["Phase 1","Phase 2","Phase 3"],ph:[[657600000000000,280,400,1],[1300000000000000,280,400,1],[1300000000000000,280,400,1]]}, "Hard":{lv:280,sac:550,af:null,n:["Phase 1","Phase 2","Phase 3"],ph:[[2900000000000000,280,550,1],[5900000000000000,280,550,1],[5900000000000000,280,550,1]]}},
    "Verus Hilla": {"Normal":{lv:250,sac:null,af:820,ph:[[88000000000000,250,null,4]]}, "Hard":{lv:250,sac:null,af:900,ph:[[176000000000000,250,null,4]]}},
    "Will": {"Easy":{lv:235,sac:null,af:560,n:["Phase 1: Blue Dimension","Phase 1: Purple Dimension","Phase 2","Phase 3"],ph:[[2800000000000,235,null,3],[2800000000000,235,null,3],[4200000000000,235,null,2],[7000000000000,235,null,1]]}, "Normal":{lv:250,sac:null,af:760,n:["Phase 1: Blue Dimension","Phase 1: Purple Dimension","Phase 2","Phase 3"],ph:[[4200000000000,250,null,3],[4200000000000,250,null,3],[6300000000000,250,null,2],[10500000000000,250,null,1]]}, "Hard":{lv:250,sac:null,af:760,n:["Phase 1: Blue Dimension","Phase 1: Purple Dimension","Phase 2","Phase 3"],ph:[[21000000000000,250,null,3],[21000000000000,250,null,3],[31500000000000,250,null,2],[52500000000000,250,null,1]]}}
};

// Level advantage: final-damage modifier from (character level - monster level).
// Source: StrategyWiki MapleStory/Formulas, "Level Advantage Multiplier".
// Level or above: +10%, then +2%p per level, capping at +20% from +5.
// 1-4 below: fixed compound values. 5+ below: -2.5%p per level, truncated,
// reaching -100% at 40 levels under.
const LEVEL_FD_NEAR = { '-1': 0.0584, '-2': 0.007, '-3': -0.0328, '-4': -0.082 };

const BOSS_TIME_LIMIT = 30 * 60;  // hard enrage timer, seconds
const BURST_COOLDOWN = 120;       // nominal burst cooldown, seconds
const BURST_CDR = 0.06;           // account-wide cooldown reduction buff
const BURST_CYCLE = BURST_COOLDOWN * (1 - BURST_CDR);  // 112.8s -> 16 bursts in 30:00
const BURST_WINDOW = 25;          // seconds of burst uptime
const BURST_SHARE = 0.60;         // share of damage dealt inside the burst

/**
 * Final-damage multiplier from level advantage.
 * @param {number} charLevel
 * @param {number} bossLevel
 * @returns {number} multiplier, e.g. 1.20 at +5 or above
 */
function levelMultiplier(charLevel, bossLevel) {
    const diff = charLevel - bossLevel;
    if (diff >= 5) return 1.20;
    if (diff >= 0) return 1.10 + 0.02 * diff;
    if (diff >= -4) return 1 + LEVEL_FD_NEAR[diff];
    return Math.max(0, 1 - Math.floor(2.5 * -diff) / 100);
}

// Arcane Force final-damage tiers by percentage of the requirement met (rounded down).
// Source: StrategyWiki MapleStory/Formulas, "Arcane Force Maps".
const ARCANE_TIERS = [
    [150, 0.50], [130, 0.30], [110, 0.10], [100, 0], [70, -0.20],
    [50, -0.30], [30, -0.40], [10, -0.70], [0, -0.90]
];

/**
 * Damage multiplier from Arcane or Sacred (Authentic) Force.
 * Arcane is stepped by the share of the requirement met: +10% at 110%, +30% at
 * 130%, +50% at 150%, with matching penalties below 100%.
 * Sacred grants +1%p per 2 points over the requirement (rounded down) up to +25%
 * at +50, and costs -1%p per point under it, down to -95%.
 * A blank field is treated as capped: characters reach the bonus cap well before
 * they meet a boss's damage requirement, so force is rarely the constraint.
 * @param {number|null} have - the character's force, or null for capped
 * @param {number|null} req - the boss's requirement
 * @param {string} kind - 'sac' or 'af'
 * @returns {number}
 */
function forceMultiplier(have, req, kind) {
    if (!req) return 1;
    if (have === null || have === undefined) return kind === 'af' ? 1.5 : 1.25;
    if (kind === 'af') {
        const pct = Math.floor(have / req * 100);
        for (const [floor, fd] of ARCANE_TIERS) if (pct >= floor) return 1 + fd;
        return 0.1;
    }
    const diff = have - req;
    if (diff >= 0) return 1 + Math.min(Math.floor(diff / 2), 25) / 100;
    return 1 - Math.min(-diff, 95) / 100;
}

// Boss defense (PDR, %). PDR is set per difficulty, not per boss. Chosen Seren
// and every boss after it sit at 380 on all difficulties; earlier bosses are 300,
// with one exception: Extreme Lotus is a level-285 re-tune and carries 380.
const BOSS_PDR_DEFAULT = 300;
const BOSS_PDR = {
    'Chosen Seren': 380, 'Kalos the Guardian': 380, 'First Adversary': 380,
    'Kaling': 380, 'Malefic Star': 380, 'Limbo': 380, 'Baldrix': 380, 'Jupiter': 380
};
const BOSS_PDR_OVERRIDES = {
    'Lotus': { 'Extreme': 380 }
};

/** PDR for one boss difficulty, applying per-difficulty exceptions. */
function bossPdr(baseName, difficulty) {
    const byDiff = BOSS_PDR_OVERRIDES[baseName];
    if (byDiff && byDiff[difficulty]) return byDiff[difficulty];
    return BOSS_PDR[baseName] || BOSS_PDR_DEFAULT;
}
const DEFAULT_IED = 98;

/**
 * Damage multiplier after boss defense: 1 - PDR x (1 - IED), floored at zero.
 * At 98% IED that is 0.94 against 300% PDR and 0.924 against 380%.
 * @param {number} pdr - boss defense in percent, e.g. 380
 * @param {number} ied - ignore enemy defense in percent, e.g. 98
 * @returns {number}
 */
function defenseMultiplier(pdr, ied) {
    return Math.max(0, 1 - (pdr / 100) * (1 - ied / 100));
}

function getCharIed(character) {
    return (character.ied === null || character.ied === undefined) ? DEFAULT_IED : character.ied;
}

function getCharLevel(character) { return character.charLevel || 270; }
function getCharSacred(character) {
    return (character.sacredForce === null || character.sacredForce === undefined)
        ? null : character.sacredForce;
}
function getCharArcane(character) {
    return (character.arcaneForce === null || character.arcaneForce === undefined)
        ? null : character.arcaneForce;
}

/**
 * Prices a boss for a character: how much damage they must actually output,
 * after level and force multipliers, phase by phase.
 * @param {string} baseName
 * @param {string} difficulty
 * @param {object} character
 * @returns {object|null} { total, phases, blocked } or null if no combat data
 */
function effectiveHP(baseName, difficulty, character) {
    const boss = BOSS_COMBAT[baseName];
    if (!boss || !boss[difficulty]) return null;
    const data = boss[difficulty];
    const lvl = getCharLevel(character);
    const sacred = getCharSacred(character);
    const arcane = getCharArcane(character);
    const pdr = bossPdr(baseName, difficulty);
    const dm = defenseMultiplier(pdr, getCharIed(character));

    let blocked = null;
    const phases = data.ph.map((p, i) => {
        const hp = p[0], bossLvl = p[1], sacReq = p[2], segments = p[3];
        const lm = levelMultiplier(lvl, bossLvl);
        let fm = 1;
        if (sacReq) {
            fm = forceMultiplier(sacred, sacReq, 'sac');
            if (sacred !== null && sacred < sacReq) blocked = 'SAC ' + sacred + ' < ' + sacReq;
        } else if (data.af) {
            fm = forceMultiplier(arcane, data.af, 'af');
            if (arcane !== null && arcane < data.af) blocked = 'AF ' + arcane + ' < ' + data.af;
        }
        return {
            name: (data.n && data.n[i]) || ('P' + (i + 1)),
            raw: hp,
            effective: dm > 0 ? hp / (lm * fm * dm) : Infinity,
            levelMult: lm,
            forceMult: fm,
            defenseMult: dm,
            pdr: pdr,
            segments: segments,
            bossLevel: bossLvl
        };
    });
    return {
        total: phases.reduce((s, p) => s + p.effective, 0),
        phases: phases,
        blocked: blocked
    };
}

/**
 * Cumulative damage by elapsed time under a bursty cadence: BURST_SHARE of each
 * cycle's damage lands in the first BURST_WINDOW seconds, starting at t=0.
 * @param {number} t - elapsed seconds
 * @param {number} avgDps - sustained damage per second
 * @returns {number}
 */
function damageByTime(t, avgDps) {
    const perCycle = avgDps * BURST_CYCLE;
    const burstDps = perCycle * BURST_SHARE / BURST_WINDOW;
    const offDps = perCycle * (1 - BURST_SHARE) / (BURST_CYCLE - BURST_WINDOW);
    const full = Math.floor(t / BURST_CYCLE);
    const rem = t - full * BURST_CYCLE;
    let dmg = full * perCycle + burstDps * Math.min(rem, BURST_WINDOW);
    if (rem > BURST_WINDOW) dmg += offDps * (rem - BURST_WINDOW);
    return dmg;
}

/**
 * How many bursts land inside the fight timer. Bursts fire at t = 0, C, 2C, ...
 * while t is still under the limit, so an exact division lands the last burst
 * on the cap itself and does not count.
 * @returns {number}
 */
function burstsInFight() {
    return Math.ceil(BOSS_TIME_LIMIT / BURST_CYCLE);
}

/** Inverse of damageByTime: seconds needed to deal dmg. */
function timeForDamage(dmg, avgDps) {
    if (avgDps <= 0) return Infinity;
    let lo = 0, hi = 4 * BOSS_TIME_LIMIT;
    if (damageByTime(hi, avgDps) < dmg) return Infinity;
    for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (damageByTime(mid, avgDps) < dmg) lo = mid; else hi = mid;
    }
    return hi;
}

/**
 * Full pace read for one boss: per-phase kill deadlines, burst numbers, and
 * how much slack (in bursts) remains against the 30 minute timer.
 */
function bossPace(baseName, difficulty, character, avgDps) {
    const eff = effectiveHP(baseName, difficulty, character);
    if (!eff) return null;
    const perBurst = avgDps * BURST_CYCLE * BURST_SHARE;
    const available = damageByTime(BOSS_TIME_LIMIT, avgDps);
    let cum = 0;
    const phases = eff.phases.map(p => {
        cum += p.effective;
        const t = timeForDamage(cum, avgDps);
        return Object.assign({}, p, {
            killBy: t,
            burstNo: isFinite(t) ? Math.floor(t / BURST_CYCLE) + 1 : Infinity,
            share: p.effective / eff.total
        });
    });
    const clearTime = timeForDamage(eff.total, avgDps);
    const shortfall = Math.max(0, eff.total - available);
    return {
        total: eff.total,
        blocked: eff.blocked,
        phases: phases,
        clearTime: clearTime,
        clears: clearTime <= BOSS_TIME_LIMIT,
        spareBursts: (BOSS_TIME_LIMIT - clearTime) / BURST_CYCLE,
        shortBursts: perBurst > 0 ? shortfall / perBurst : Infinity,
        damageNeeded: available > 0 ? eff.total / available : Infinity
    };
}

/**
 * Derives a character's sustained DPS from a boss they are known to clear.
 * A manual override wins when set.
 *
 * The clear time is inverted through the same burst model the projections use,
 * not divided as a plain average. Bursts land at the start of each cycle, so a
 * short fight banks more than its average share; a plain HP / time average would
 * credit a 4 minute clear with ~10% more damage than the model then gives back.
 * damageByTime is linear in DPS, so the inversion is a single division.
 */
function characterDps(character) {
    if (character.manualDps) return character.manualDps * 1e9;
    const boss = character.calibBoss, diff = character.calibDifficulty;
    const mins = parseFloat(character.calibMinutes);
    if (!boss || !diff || !mins || mins <= 0) return 0;
    const eff = effectiveHP(boss, diff, character);
    if (!eff) return 0;
    return eff.total / damageByTime(mins * 60, 1);
}

function fmtHP(v) {
    if (!isFinite(v)) return '—';
    if (v >= 1e15) return (v / 1e15).toFixed(2) + 'Q';
    if (v >= 1e12) return (v / 1e12).toFixed(0) + 'T';
    if (v >= 1e9) return (v / 1e9).toFixed(0) + 'B';
    return v.toFixed(0);
}

function fmtClock(s) {
    if (!isFinite(s)) return '—';
    // Round the whole value first so 23:59.6 carries to 24:00 rather than 23:60.
    const total = Math.round(s);
    const m = Math.floor(total / 60), sec = total % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

// ============================================================================
// Progression tab rendering
// ============================================================================

let progressionSelectedBoss = null;   // "BaseName|Difficulty" for the phase panel

// What-if adjustments keyed by character id. Held in memory only: they model a
// scenario rather than the character's real state, so they are never saved.
const progressionAdjust = {};

function getProgressionAdjust(character) {
    return progressionAdjust[character.id] || { level: 0, ied: 0 };
}

/**
 * Copy of a character with the what-if deltas applied, clamped to sane bounds.
 * DPS is still derived from the real character, so only the projection moves.
 */
function adjustedCharacter(character, adj) {
    return Object.assign({}, character, {
        charLevel: Math.max(200, Math.min(300, getCharLevel(character) + adj.level)),
        ied: Math.max(0, Math.min(100, Math.round((getCharIed(character) + adj.ied) * 10) / 10))
    });
}

function setProgressionAdjust(field, value) {
    const character = getActiveCharacter();
    if (!character) return;
    const adj = Object.assign({ level: 0, ied: 0 }, progressionAdjust[character.id]);
    adj[field] = field === 'level' ? Math.round(value) : Math.round(value * 10) / 10;
    if (adj.level === 0 && adj.ied === 0) delete progressionAdjust[character.id];
    else progressionAdjust[character.id] = adj;
    renderProgressionContent();
}

function updateProgressionAdjust(field, value) {
    const n = parseFloat(value);
    setProgressionAdjust(field, isFinite(n) ? n : 0);
}

function nudgeProgressionAdjust(field, step) {
    const character = getActiveCharacter();
    if (!character) return;
    setProgressionAdjust(field, getProgressionAdjust(character)[field] + step);
}

function resetProgressionAdjust() {
    const character = getActiveCharacter();
    if (!character) return;
    delete progressionAdjust[character.id];
    renderProgressionContent();
}

/** Margin label plus row and text classes for one boss pace result. */
function paceStatus(pace) {
    if (pace.blocked) {
        const margin = pace.clears ? `${pace.spareBursts.toFixed(1)} bursts spare`
            : `short ${pace.shortBursts.toFixed(1)} bursts (+${((pace.damageNeeded - 1) * 100).toFixed(0)}% dmg)`;
        return { status: `${pace.blocked} · ${margin}`, cls: 'prog-s-blocked', row: 'prog-blocked' };
    }
    if (pace.clears) {
        const tight = pace.spareBursts < 2;
        return { status: `${pace.spareBursts.toFixed(1)} bursts spare`,
                 cls: tight ? 'prog-s-tight' : 'prog-s-ok', row: tight ? 'prog-tight' : 'prog-ok' };
    }
    return { status: `short ${pace.shortBursts.toFixed(1)} bursts (+${((pace.damageNeeded - 1) * 100).toFixed(0)}% dmg)`,
             cls: 'prog-s-fail', row: 'prog-fail' };
}

/** Every boss/difficulty pair that has combat data, ordered by crystal value. */
function allCombatEntries() {
    const out = [];
    bossDataFlat.forEach(b => {
        const parsed = parseBossName(b.name);
        const diff = parsed.difficulty || 'Normal';
        if (BOSS_COMBAT[parsed.baseName] && BOSS_COMBAT[parsed.baseName][diff]) {
            out.push({ baseName: parsed.baseName, difficulty: diff, fullName: b.name, value: b.value });
        }
    });
    return out.sort((a, b) => b.value - a.value);
}

function updateProgressionField(field, value) {
    const character = getActiveCharacter();
    if (!character) return;
    if (field === 'calibBoss') {
        const parts = value.split('|');
        character.calibBoss = parts[0] || null;
        character.calibDifficulty = parts[1] || null;
    } else if (field === 'manualDps' || field === 'ied') {
        character[field] = value === '' ? null : parseFloat(value);
    } else {
        character[field] = value === '' ? null : parseInt(value, 10);
    }
    saveToLocalStorage();
    renderProgressionContent();
}

function selectProgressionBoss(key) {
    progressionSelectedBoss = key;
    renderProgressionContent();
}

function renderProgressionCharacterTabs() {
    const container = document.getElementById('progressionCharacterTabs');
    if (!container) return;
    container.innerHTML = characters.map(char => `
        <div class="character-tab ${char.id === activeCharacterId ? 'active' : ''}"
             onclick="switchCharacter(${char.id})">
            <div class="character-tab-name">${sanitizeInput(char.name)}</div>
            <div class="character-tab-total">Lv ${getCharLevel(char)}</div>
        </div>
    `).join('');
}

/**
 * Re-renders the progression panel, restoring keyboard focus and caret position
 * afterwards. The panel rebuilds its own inputs, so without this an edit would
 * drop focus mid-typing and a click on another control could be swallowed.
 */
function renderProgressionContent() {
    const focused = document.activeElement;
    const field = focused && focused.dataset ? focused.dataset.prog : null;
    const start = field && focused.selectionStart !== undefined ? focused.selectionStart : null;
    renderProgressionPanel();
    if (field) {
        const next = document.querySelector('[data-prog="' + field + '"]');
        if (next) {
            next.focus();
            if (start !== null && next.setSelectionRange) {
                try { next.setSelectionRange(start, start); } catch (e) { /* number inputs */ }
            }
        }
    }
}

function renderProgressionPanel() {
    const container = document.getElementById('progressionContent');
    if (!container) return;
    const character = getActiveCharacter();
    if (!character) { container.innerHTML = ''; return; }

    const dps = characterDps(character);
    const entries = allCombatEntries();
    const calibKey = character.calibBoss ? `${character.calibBoss}|${character.calibDifficulty}` : '';

    const setup = `
        <div class="prog-setup">
            <div class="prog-field">
                <label>Character level</label>
                <input type="number" min="200" max="300" value="${getCharLevel(character)}"
                       data-prog="charLevel" onchange="updateProgressionField('charLevel', this.value)">
            </div>
            <div class="prog-field">
                <label>Sacred Force (blank = capped)</label>
                <input type="number" min="0" max="1000" value="${character.sacredForce || ''}"
                       placeholder="capped"
                       data-prog="sacredForce" onchange="updateProgressionField('sacredForce', this.value)">
            </div>
            <div class="prog-field">
                <label>Arcane Force (blank = capped)</label>
                <input type="number" min="0" max="2000" value="${character.arcaneForce || ''}"
                       placeholder="capped"
                       data-prog="arcaneForce" onchange="updateProgressionField('arcaneForce', this.value)">
            </div>
            <div class="prog-field prog-field-wide">
                <label>Calibrate from a boss you clear</label>
                <select data-prog="calibBoss" onchange="updateProgressionField('calibBoss', this.value)">
                    <option value="">— pick a boss —</option>
                    ${entries.map(e => {
                        const k = `${e.baseName}|${e.difficulty}`;
                        return `<option value="${k}" ${calibKey === k ? 'selected' : ''}>${sanitizeInput(e.fullName)}</option>`;
                    }).join('')}
                </select>
            </div>
            <div class="prog-field">
                <label>in (minutes)</label>
                <input type="number" min="1" max="30" step="0.5" value="${character.calibMinutes || ''}"
                       placeholder="e.g. 27"
                       data-prog="calibMinutes" onchange="updateProgressionField('calibMinutes', this.value)">
            </div>
            <div class="prog-field">
                <label>or set DPS directly (B/sec)</label>
                <input type="number" min="0" step="10" value="${character.manualDps || ''}"
                       placeholder="e.g. 1000"
                       data-prog="manualDps" onchange="updateProgressionField('manualDps', this.value)">
            </div>
            <div class="prog-field">
                <label>IED %</label>
                <input type="number" min="0" max="100" step="0.1" value="${getCharIed(character)}"
                       placeholder="98"
                       data-prog="ied" onchange="updateProgressionField('ied', this.value)">
            </div>
        </div>
    `;

    if (dps <= 0) {
        container.innerHTML = `
            <div class="prog-wrap">
                <h2 class="prog-title">Progression</h2>
                <p class="prog-sub">Set a level, then calibrate from a boss you already clear — the
                   model derives your damage from that and prices everything else against it.</p>
                ${setup}
                <div class="empty-message">Pick a boss you clear and how long it takes to see the rest.</div>
            </div>`;
        return;
    }

    const perBurst = dps * BURST_CYCLE * BURST_SHARE;
    const offDps = dps * BURST_CYCLE * (1 - BURST_SHARE) / (BURST_CYCLE - BURST_WINDOW);
    const burstDps = perBurst / BURST_WINDOW;

    const cadence = `
        <div class="prog-cadence">
            <div><span class="prog-k">Sustained</span><span class="prog-v">${(dps / 1e9).toFixed(0)}B/sec</span></div>
            <div><span class="prog-k">Burst (${BURST_WINDOW}s)</span><span class="prog-v">${(burstDps / 1e9).toFixed(0)}B/sec</span></div>
            <div><span class="prog-k">Off-burst</span><span class="prog-v">${(offDps / 1e9).toFixed(0)}B/sec</span></div>
            <div><span class="prog-k">Per burst</span><span class="prog-v">${fmtHP(perBurst)}</span></div>
            <div><span class="prog-k">Bursts in 30:00</span><span class="prog-v">${burstsInFight()}</span></div>
            <div><span class="prog-k">Cycle</span><span class="prog-v">${BURST_CYCLE.toFixed(0)}s</span></div>
        </div>
    `;

    // What-if layer. DPS stays as calibrated; only the projection uses the
    // adjusted level and IED, so every figure below compares like for like.
    const adj = getProgressionAdjust(character);
    const adjusted = adjustedCharacter(character, adj);
    const active = adj.level !== 0 || adj.ied !== 0;

    const scored = entries.map(e => {
        const cur = bossPace(e.baseName, e.difficulty, character, dps);
        if (!cur) return null;
        const alt = active ? bossPace(e.baseName, e.difficulty, adjusted, dps) : null;
        return { e: e, cur: cur, alt: alt };
    }).filter(Boolean);

    const nowClear = active ? scored.filter(r => !r.cur.clears && r.alt.clears && !r.alt.blocked) : [];
    const lostClear = active ? scored.filter(r => r.cur.clears && !r.alt.clears) : [];

    const signed = (n, digits) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(digits);
    const adjustPanel = `
        <div class="prog-adjust">
            <div class="prog-adjust-head">
                <span class="prog-k">What-if adjustment</span>
                <span class="prog-adjust-hint">Your damage stays at the result above — this changes how much of it lands.
                    IED here is your total — a new X% source adds X × (1 − current/100), so 20% at 98% adds 0.4%.</span>
            </div>
            <div class="prog-adjust-row">
                <div class="prog-field">
                    <label>Levels (now ${getCharLevel(character)})</label>
                    <div class="prog-stepper">
                        <button type="button" onclick="nudgeProgressionAdjust('level', -5)">−5</button>
                        <button type="button" onclick="nudgeProgressionAdjust('level', -1)">−1</button>
                        <input type="number" step="1" value="${adj.level}" data-prog="adjLevel"
                               onchange="updateProgressionAdjust('level', this.value)">
                        <button type="button" onclick="nudgeProgressionAdjust('level', 1)">+1</button>
                        <button type="button" onclick="nudgeProgressionAdjust('level', 5)">+5</button>
                    </div>
                    <span class="prog-adjust-result">→ Lv ${getCharLevel(adjusted)}</span>
                </div>
                <div class="prog-field">
                    <label>IED (now ${getCharIed(character)}%)</label>
                    <div class="prog-stepper">
                        <button type="button" onclick="nudgeProgressionAdjust('ied', -1)">−1</button>
                        <button type="button" onclick="nudgeProgressionAdjust('ied', -0.5)">−0.5</button>
                        <input type="number" step="0.1" value="${adj.ied}" data-prog="adjIed"
                               onchange="updateProgressionAdjust('ied', this.value)">
                        <button type="button" onclick="nudgeProgressionAdjust('ied', 0.5)">+0.5</button>
                        <button type="button" onclick="nudgeProgressionAdjust('ied', 1)">+1</button>
                    </div>
                    <span class="prog-adjust-result">→ ${getCharIed(adjusted).toFixed(1)}%</span>
                </div>
                <button type="button" class="prog-reset" onclick="resetProgressionAdjust()" ${active ? '' : 'disabled'}>Reset</button>
            </div>
            ${active ? `
                <div class="prog-adjust-summary">
                    <strong>${signed(adj.level, 0)} levels, ${signed(adj.ied, 1)}% IED</strong>
                    ${nowClear.length ? ` · <span class="prog-s-ok">now clears: ${nowClear.map(r => sanitizeInput(r.e.fullName)).join(', ')}</span>` : ''}
                    ${lostClear.length ? ` · <span class="prog-s-fail">no longer clears: ${lostClear.map(r => sanitizeInput(r.e.fullName)).join(', ')}</span>` : ''}
                    ${!nowClear.length && !lostClear.length ? ' · no boss changes between clearing and failing' : ''}
                </div>` : ''}
        </div>
    `;

    const rows = scored.map(r => {
        const key = `${r.e.baseName}|${r.e.difficulty}`;
        const cur = paceStatus(r.cur);
        let adjCells = '';
        if (active) {
            const alt = paceStatus(r.alt);
            const gain = r.alt.total > 0 ? r.cur.total / r.alt.total - 1 : 0;
            const flip = !r.cur.clears && r.alt.clears ? ' <span class="prog-flip prog-s-ok">now clears</span>'
                : r.cur.clears && !r.alt.clears ? ' <span class="prog-flip prog-s-fail">stops clearing</span>' : '';
            adjCells = `
                <td class="prog-num prog-adj-col">${fmtClock(r.alt.clearTime)}</td>
                <td class="prog-adj-col"><span class="prog-status ${alt.cls}">${alt.status}</span>${flip}</td>
                <td class="prog-num prog-adj-col ${gain > 0.0005 ? 'prog-s-ok' : gain < -0.0005 ? 'prog-s-fail' : ''}">
                    ${Math.abs(gain) < 0.0005 ? '—' : signed(gain * 100, 1) + '% dmg'}</td>`;
        }
        return `
            <tr class="${cur.row} ${progressionSelectedBoss === key ? 'prog-selected' : ''}"
                onclick="selectProgressionBoss('${key}')">
                <td>${sanitizeInput(r.e.fullName)}</td>
                <td class="prog-num">${fmtHP(r.cur.phases.reduce((s, p) => s + p.raw, 0))}</td>
                <td class="prog-num">${fmtHP(r.cur.total)}</td>
                <td class="prog-num">${fmtClock(r.cur.clearTime)}</td>
                <td><span class="prog-status ${cur.cls}">${cur.status}</span></td>
                ${adjCells}
            </tr>`;
    }).join('');

    let detail = '';
    if (progressionSelectedBoss) {
        const parts = progressionSelectedBoss.split('|');
        const pace = bossPace(parts[0], parts[1], character, dps);
        const altPace = active ? bossPace(parts[0], parts[1], adjusted, dps) : null;
        if (pace) {
            detail = `
                <h3 class="prog-title" style="margin-top:24px;">${sanitizeInput(parts[1] + ' ' + parts[0])} — phase pace</h3>
                <p class="prog-sub">Kill each phase by the deadline shown. Aim to finish a phase in the
                   ~20s <em>before</em> a burst so the next burst lands on the fresh phase, not a corpse.</p>
                <div class="prog-table-wrap">
                <table class="prog-table">
                    <thead><tr><th>Phase</th><th class="prog-num">Raw</th><th class="prog-num">Effective</th>
                        <th class="prog-num">Share</th><th class="prog-num">Kill by</th>
                        <th class="prog-num">Burst #</th>
                        ${active ? '<th class="prog-num prog-adj-col">Kill by (adj)</th><th class="prog-num prog-adj-col">Burst # (adj)</th>' : ''}
                        <th>Notes</th></tr></thead>
                    <tbody>
                    ${pace.phases.map((p, i) => {
                        const a = altPace ? altPace.phases[i] : null;
                        const note = [];
                        if (p.segments > 1) note.push(`${p.segments} segments`);
                        note.push(`lv${p.bossLevel}`);
                        note.push(a && a.levelMult !== p.levelMult
                            ? `${p.levelMult.toFixed(2)}→${a.levelMult.toFixed(2)}x lvl`
                            : `${p.levelMult.toFixed(2)}x lvl`);
                        note.push(`${p.forceMult.toFixed(2)}x force`);
                        note.push(a && a.defenseMult !== p.defenseMult
                            ? `PDR ${p.pdr}% ${p.defenseMult.toFixed(3)}→${a.defenseMult.toFixed(3)}x`
                            : `PDR ${p.pdr}% ${p.defenseMult.toFixed(3)}x`);
                        return `<tr>
                            <td>${sanitizeInput(p.name)}</td>
                            <td class="prog-num">${fmtHP(p.raw)}</td>
                            <td class="prog-num">${fmtHP(p.effective)}</td>
                            <td class="prog-num">${(p.share * 100).toFixed(1)}%</td>
                            <td class="prog-num">${fmtClock(p.killBy)}</td>
                            <td class="prog-num">${isFinite(p.burstNo) ? p.burstNo : '—'}</td>
                            ${a ? `<td class="prog-num prog-adj-col">${fmtClock(a.killBy)}</td>
                                   <td class="prog-num prog-adj-col">${isFinite(a.burstNo) ? a.burstNo : '—'}</td>` : ''}
                            <td class="prog-note">${note.join(' · ')}</td>
                        </tr>`;
                    }).join('')}
                    </tbody>
                </table>
                </div>`;
        }
    }

    container.innerHTML = `
        <div class="prog-wrap">
            <h2 class="prog-title">Progression</h2>
            <p class="prog-sub">Effective HP is raw HP divided by your level, force and defense multipliers —
               the damage you actually have to output. Everything is measured against the 30:00 timer.</p>
            ${setup}
            ${cadence}
            ${adjustPanel}
            <div class="prog-table-wrap">
            <table class="prog-table">
                <thead><tr><th>Boss</th><th class="prog-num">Raw HP</th><th class="prog-num">Effective</th>
                    <th class="prog-num">Clear time</th><th>Margin</th>
                    ${active ? '<th class="prog-num prog-adj-col">Clear (adj)</th><th class="prog-adj-col">Margin (adj)</th><th class="prog-num prog-adj-col">Change</th>' : ''}
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            </div>
            <p class="prog-sub" style="margin-top:12px;">Purple rows are under the force floor, and the
               penalty for that is already applied to their figures. Amber rows clear
               with under two bursts to spare, where a mistimed phase transition costs you the run.</p>
            ${detail}
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
            if (activeMainTab === 'sellingStrategy') return tab.textContent.includes('Selling Strategy');
            if (activeMainTab === 'gearTracker') return tab.textContent.includes('Gear Tracker');
            if (activeMainTab === 'progression') return tab.textContent.includes('Progression');
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
        } else if (activeMainTab === 'sellingStrategy') {
            renderSellingStrategy();
        } else if (activeMainTab === 'gearTracker') {
            renderGearTrackerCharacterTabs();
            renderGearTrackerContent();
        } else if (activeMainTab === 'progression') {
            renderProgressionCharacterTabs();
            renderProgressionContent();
        }
    }
}

// Start the app
initialize();


