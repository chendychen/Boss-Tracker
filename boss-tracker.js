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
    ]
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
let upgradeSettings = { ...UpgradeEngine.DEFAULT_SETTINGS };  // account-wide upgrade pricing

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
        calibParty: char.calibParty || 1,
        calibPercent: char.calibPercent || null,
        executionFactor: char.executionFactor || null,
        manualDps: char.manualDps || null,
        ied: (char.ied === null || char.ied === undefined) ? null : char.ied,
        upgradeBuild: char.upgradeBuild || null,
        className: char.className || (char.upgradeBuild && char.upgradeBuild.className) || null,
        usesCdrHat: char.usesCdrHat !== false,
        cdrCurve: Array.isArray(char.cdrCurve) && char.cdrCurve.length ? char.cdrCurve : null,
        crystalsDone: char.crystalsDone || null
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
        calibParty: char.calibParty || 1,
        calibPercent: char.calibPercent || null,
        executionFactor: char.executionFactor || null,
        manualDps: char.manualDps || null,
        ied: (char.ied === null || char.ied === undefined) ? null : char.ied,
        upgradeBuild: char.upgradeBuild || null,
        className: char.className || (char.upgradeBuild && char.upgradeBuild.className) || null,
        usesCdrHat: char.usesCdrHat !== false,
        cdrCurve: Array.isArray(char.cdrCurve) && char.cdrCurve.length ? char.cdrCurve : null,
        crystalsDone: char.crystalsDone || null
    };
}

/**
 * The whole account as one JSON-safe object: what export, the save file and
 * the import paths all read and write.
 * @returns {object}
 */
function buildSavePayload() {
    return {
        characters: characters.map(serializeCharacter),
        activeCharacterId: activeCharacterId,
        nextCharacterId: nextCharacterId,
        upgradeSettings: upgradeSettings,
        exportDate: new Date().toISOString(),
        version: '2.0'
    };
}

/**
 * Replaces the in-memory account with a payload from buildSavePayload (or an
 * older export without the newer fields).
 * @param {object} data
 */
function adoptSavePayload(data) {
    characters = data.characters.map(deserializeCharacter);
    activeCharacterId = data.activeCharacterId
        || (characters.length ? characters[0].id : null);
    nextCharacterId = data.nextCharacterId
        || (Math.max(0, ...characters.map(c => c.id)) + 1);
    if (data.upgradeSettings) upgradeSettings = { ...upgradeSettings, ...data.upgradeSettings };
}

/**
 * Loads saves/latest.json when the app is served over http, so the file in the
 * project folder is the source of truth across browsers and machines.
 *
 * A page opened as file:// cannot fetch a sibling file, and that is fine: the
 * app falls back to localStorage. The file is only adopted when its exportDate
 * is newer than the one already loaded, so edits made in the browser since the
 * last import are not thrown away.
 * @returns {Promise<boolean>} whether the save file replaced local data
 */
async function loadSaveFile() {
    if (!location.protocol.startsWith('http')) return false;
    let data;
    try {
        const response = await fetch('saves/latest.json', { cache: 'no-store' });
        if (!response.ok) return false;
        data = await response.json();
    } catch (e) {
        return false;   // no server, no file, or not JSON
    }
    if (!data || !Array.isArray(data.characters)) return false;

    const seen = localStorage.getItem('bossTrackerSaveFileDate');
    if (seen && data.exportDate && seen >= data.exportDate) return false;

    adoptSavePayload(data);
    if (data.exportDate) localStorage.setItem('bossTrackerSaveFileDate', data.exportDate);
    saveToLocalStorage();
    return true;
}

/**
 * Writes the current data back to saves/ through the local server, which keeps
 * the most recent snapshots. Silently does nothing when the app is opened as a
 * file or the server is not running.
 * @returns {Promise<string|null>} the snapshot filename, or null
 */
async function writeSaveFile() {
    if (!location.protocol.startsWith('http')) return null;
    const payload = buildSavePayload();
    try {
        const response = await fetch('api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload, null, 2)
        });
        if (!response.ok) return null;
        const result = await response.json();
        localStorage.setItem('bossTrackerSaveFileDate', payload.exportDate);
        return result.saved || null;
    } catch (e) {
        return null;
    }
}

function saveToLocalStorage() {
    const data = {
        characters: characters.map(serializeCharacter),
        activeCharacterId: activeCharacterId,
        nextCharacterId: nextCharacterId,
        activeMainTab: activeMainTab,
        globalBlackHeartSpares: globalBlackHeartSpares,
        upgradeSettings: upgradeSettings
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
            if (data.upgradeSettings) upgradeSettings = { ...upgradeSettings, ...data.upgradeSettings };
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
    writeSaveFile().then(name => {
        if (name) console.log(`Boss Tracker: wrote saves/${name}`);
    });
}

function showSaveStatus() {
    const status = document.getElementById('saveStatus');
    status.classList.add('show');
    setTimeout(() => {
        status.classList.remove('show');
    }, 2000);
}

async function exportData() {
    const data = buildSavePayload();

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
            adoptSavePayload(data);

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
        calibParty: 1,        // party size of that clear; damage is split evenly
        calibPercent: null,   // GMS Upgrade Tracker clear %, used instead of a time
        executionFactor: null, // real clear / site capacity; blank uses DEFAULT_EXECUTION
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
        calibParty: currentChar.calibParty || 1,
        calibPercent: currentChar.calibPercent || null,
        executionFactor: currentChar.executionFactor || null,
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
    renderProgressionCharacterTabs();
    renderUpgradesCharacterTabs();
}

/**
 * Re-renders the body of whichever main tab is active. Every caller that
 * changes shared state goes through this, so adding a tab means touching one
 * place rather than four that silently drift apart.
 */
function renderActiveTab() {
    if (activeMainTab === 'bossCrystals') {
        renderMainContent();
    } else if (activeMainTab === 'sellingStrategy') {
        renderSellingStrategy();
    } else if (activeMainTab === 'progression') {
        renderProgressionContent();
    } else if (activeMainTab === 'upgrades') {
        renderUpgradesContent();
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
        renderAllCharacterTabs();
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

const CRYSTALS_PER_CHARACTER = 14;
const CRYSTALS_PER_ACCOUNT = 180;

/**
 * Which crystals count this week. Each character sells at most its 14 most
 * valuable, and the account at most 180, taken from those per-character
 * picks by value. Everything else is overflow to drop.
 * @returns {{counted: object[], overflow: object[], accountLimitHit: boolean}}
 */
function crystalSalePlan() {
    const all = getAllBossesWithValues();   // sorted by adjusted value, highest first
    const perCharacter = new Map();
    const eligible = [];
    const overflow = [];
    all.forEach(b => {
        const n = perCharacter.get(b.characterId) || 0;
        if (n < CRYSTALS_PER_CHARACTER) {
            perCharacter.set(b.characterId, n + 1);
            eligible.push(b);
        } else {
            overflow.push({ ...b, reason: 'character' });
        }
    });
    eligible.slice(CRYSTALS_PER_ACCOUNT).forEach(b => overflow.push({ ...b, reason: 'account' }));
    return {
        counted: eligible.slice(0, CRYSTALS_PER_ACCOUNT),
        overflow,
        accountLimitHit: eligible.length > CRYSTALS_PER_ACCOUNT,
    };
}

/**
 * The current crystal week, keyed by the date of its start. GMS resets weekly
 * bosses and crystal sales at Thursday 00:00 UTC.
 */
function currentCrystalWeek(now = new Date()) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const sinceThursday = (d.getUTCDay() - 4 + 7) % 7;
    d.setUTCDate(d.getUTCDate() - sinceThursday);
    return d.toISOString().slice(0, 10);
}

// Which checklist columns the user opened or closed by hand this week. A
// per-browser convenience, so localStorage, and it lapses with the week.
const SELL_COLUMNS_KEY = 'bossTrackerSellColumns';

function sellColumnState() {
    try {
        const saved = JSON.parse(localStorage.getItem(SELL_COLUMNS_KEY));
        if (saved && saved.week === currentCrystalWeek()) return saved;
    } catch (e) { /* unreadable or blocked storage: fall back to defaults */ }
    return { week: currentCrystalWeek(), open: {} };
}

function writeSellColumnState(state) {
    try { localStorage.setItem(SELL_COLUMNS_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
}

function toggleSellColumn(characterId, open) {
    const state = sellColumnState();
    state.open[characterId] = !open;
    writeSellColumnState(state);
    renderSellingStrategy();
}

/** Back to the default: open while unfinished, closed once all finished. */
function clearSellColumnOverride(characterId) {
    const state = sellColumnState();
    delete state.open[characterId];
    writeSellColumnState(state);
}

/** Bosses a character has finished this week; last week's ticks no longer count. */
function getCrystalsDone(character) {
    const done = character.crystalsDone;
    return new Set(done && done.week === currentCrystalWeek() ? done.bosses : []);
}

function setCrystalsDone(character, bosses) {
    character.crystalsDone = { week: currentCrystalWeek(), bosses: Array.from(bosses) };
    saveToLocalStorage();
    renderSellingStrategy();
}

function toggleCrystalDone(characterId, baseName) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    const done = getCrystalsDone(character);
    if (done.has(baseName)) done.delete(baseName); else done.add(baseName);
    setCrystalsDone(character, done);
}

function finishAllCrystals(characterId) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    const counted = crystalSalePlan().counted.filter(b => b.characterId === characterId);
    clearSellColumnOverride(characterId);
    setCrystalsDone(character, new Set([...getCrystalsDone(character), ...counted.map(b => b.baseName)]));
}

function resetCrystalsDone(characterId) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    clearSellColumnOverride(characterId);
    setCrystalsDone(character, []);
}

/**
 * Weekly checklist of the crystals that count, one column per character.
 * A character whose bosses are all finished collapses to its header.
 */
function renderCrystalChecklist(counted) {
    const byCharacter = characters
        .map(char => ({ char, bosses: counted.filter(b => b.characterId === char.id) }))
        .filter(c => c.bosses.length);
    if (!byCharacter.length) return '';

    let doneTotal = 0, earned = 0;
    const columnState = sellColumnState();
    const columns = byCharacter.map(({ char, bosses }) => {
        const done = getCrystalsDone(char);
        const finishedBosses = bosses.filter(b => done.has(b.baseName));
        const finished = finishedBosses.length;
        doneTotal += finished;
        earned += finishedBosses.reduce((sum, b) => sum + b.adjustedValue, 0);
        const complete = finished === bosses.length;
        const override = columnState.open[char.id];
        const open = typeof override === 'boolean' ? override : !complete;
        const rows = !open ? '' : bosses.map(b => {
            const isDone = done.has(b.baseName);
            return `
                <button class="sell-boss ${isDone ? 'sell-done' : ''}"
                        onclick="toggleCrystalDone(${char.id}, '${b.baseName.replace(/'/g, "\\'")}')">
                    ${renderBossIcon(b.baseName, b.difficulty, 'boss-icon-sm')}
                    <span class="sell-boss-name">${sanitizeInput(`${b.difficulty === 'Solo' ? '' : b.difficulty + ' '}${b.baseName}`)}${b.partyCount > 1 ? ` <span class="sell-party">×${b.partyCount}</span>` : ''}</span>
                    <span class="sell-state">${isDone ? 'Finished' : formatValue(b.adjustedValue)}</span>
                </button>`;
        }).join('');
        return `
            <div class="sell-col ${complete ? 'sell-complete' : ''}">
                <div class="sell-col-head">
                    <button class="sell-col-name" onclick="toggleSellColumn(${char.id}, ${open})"
                            aria-expanded="${open}" title="${open ? 'Hide' : 'Show'} ${sanitizeInput(char.name)}'s bosses">
                        <span class="sell-caret">${open ? '▾' : '▸'}</span>${sanitizeInput(char.name)}
                    </button>
                    <span class="sell-count">${finished}/${bosses.length}</span>
                    ${complete
                        ? `<span class="sell-all-done">All finished</span>
                           <button class="sell-link" onclick="resetCrystalsDone(${char.id})">Undo</button>`
                        : `<button class="sell-finish" onclick="finishAllCrystals(${char.id})">Finish all</button>`}
                </div>
                ${rows ? `<div class="sell-list">${rows}</div>` : ''}
            </div>`;
    }).join('');

    const total = counted.length;
    const pct = total ? (doneTotal / total) * 100 : 0;
    const potential = counted.reduce((sum, b) => sum + b.adjustedValue, 0);
    return `
        <div class="sell-tracker">
            <div class="sell-tracker-head">
                <h3>This week's crystals</h3>
                <span class="sell-total">Total done ${doneTotal}/${total}</span>
                <span class="sell-earned">${formatValue(earned)} <span class="sell-of">/ ${formatValue(potential)} earned</span></span>
                <span class="sell-week">Resets Thursday 00:00 UTC · week of ${currentCrystalWeek()}</span>
            </div>
            <div class="sell-progress"><div style="width: ${pct.toFixed(1)}%"></div></div>
            <div class="sell-grid">${columns}</div>
        </div>`;
}

function renderSellingStrategy() {
    const container = document.getElementById('sellingStrategyContent');

    if (characters.length === 0) {
        container.innerHTML = '<div class="no-character-message">No characters found. Add characters in the Boss Crystals tab.</div>';
        return;
    }

    const { counted, overflow, accountLimitHit } = crystalSalePlan();
    const limitLabel = accountLimitHit
        ? 'per-character 14-crystal and account 180-crystal limits'
        : 'per-character 14-crystal limit';

    // Group overflow by "difficulty baseName" boss label
    const byBoss = {};
    overflow.forEach(b => {
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
            ${renderCrystalChecklist(counted)}
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
    "Guardian Angel Slime": {"Normal":{lv:220,sac:null,af:null,ph:[[5000000000000,220,null,1]]}, "Chaos":{lv:250,sac:null,af:null,ph:[[90000000000000,250,null,1]]}},
    "Jupiter": {"Normal":{lv:295,sac:810,af:null,n:["Phase 1","Phase 2","Phase 3"],ph:[[2049999999999999.8,295,810,1],[3080000000000000,295,810,1],[5130000000000000,295,810,1]]}, "Hard":{lv:295,sac:810,af:null,n:["Phase 1","Phase 2","Phase 3"],ph:[[9880000000000000,295,810,1],[14820000000000000,295,810,1],[24700000000000000,295,810,1]]}},
    "Kaling": {"Easy":{lv:275,sac:230,af:null,n:["Phase 1: Perils","","Phase 3: Kaling","Phase 3: Perils"],ph:[[288000000000000,275,230,3],[105000000000000,275,230,1],[150000000000000,275,230,1],[378000000000000,275,230,3]]}, "Normal":{lv:285,sac:330,af:null,n:["Phase 1: Perils","","Phase 3: Kaling","Phase 3: Perils"],ph:[[1200000000000000,285,330,3],[468000000000000,285,330,1],[722000000000000,285,330,1],[1536000000000000,285,330,3]]}, "Hard":{lv:285,sac:350,af:null,n:["Phase 1: Perils","","Phase 3: Kaling","Phase 3: Perils"],ph:[[2718000000000000,285,350,3],[1404000000000000,285,350,1],[2240000000000000.2,285,350,1],[5481000000000000,285,350,3]]}, "Extreme":{lv:285,sac:480,af:null,n:["Phase 1: Perils","","Phase 3: Kaling","Phase 3: Perils"],ph:[[18200000000000000,285,480,3],[6930000000000000,285,480,1],[8662000000000001,285,480,1],[20800000000000000,285,480,3]]}},
    "Kalos the Guardian": {"Easy":{lv:270,sac:200,af:null,ph:[[94500000000000,270,200,1],[262500000000000,270,200,4]]}, "Normal":{lv:280,sac:300,af:null,ph:[[336000000000000,275,250,1],[720000000000000,280,300,4]]}, "Chaos":{lv:285,sac:330,af:null,ph:[[1060000000000000,285,330,1],[4059999999999999.5,285,330,4]]}, "Extreme":{lv:285,sac:440,af:null,ph:[[5970000000000000,285,440,1],[15600000000000000,285,440,4]]}},
    "Limbo": {"Normal":{lv:285,sac:500,af:null,ph:[[1940000000000000,285,500,1],[1940000000000000,285,500,2],[2600000000000000,285,500,1]]}, "Hard":{lv:285,sac:500,af:null,ph:[[3780000000000000,285,500,1],[3780000000000000,285,500,2],[4990000000000000,285,500,1]]}},
    "Lotus": {"warn":{"Extreme":"Phase 1 shield inflates effective HP; how it lines up with mechanics and burst makes runs vary"}, "Normal":{lv:210,sac:null,af:null,ph:[[470000000000,210,null,1],[470000000000,210,null,1],[630000000000,210,null,1]]}, "Hard":{lv:210,sac:null,af:null,ph:[[10000000000000,210,null,1],[10000000000000,210,null,1],[13500000000000,210,null,1]]}, "Extreme":{lv:285,sac:null,af:null,ph:[[545000000000000,285,null,1],[545000000000000,285,null,1],[720000000000000,285,null,1]]}},
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
// Maxed Arcane Symbols give 1320; the guild skill adds up to +30 more, and that
// extra counts for damage in Arcane River.
const DEFAULT_ARCANE = 1350;

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
 * A blank Sacred Force field is treated as capped: characters reach +50 over the
 * requirement well before they meet a boss's damage requirement.
 * A blank Arcane Force field is treated as DEFAULT_ARCANE (maxed symbols plus the
 * guild skill), which is 150% of every requirement except Black Mage's 1320.
 * @param {number|null} have - the character's force, or null for capped
 * @param {number|null} req - the boss's requirement
 * @param {string} kind - 'sac' or 'af'
 * @returns {number}
 */
function forceMultiplier(have, req, kind) {
    if (!req) return 1;
    if (have === null || have === undefined) {
        if (kind !== 'af') return 1.25;
        have = DEFAULT_ARCANE;
    }
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
// Measured across this roster: a site clear % overstates a real clear by 1.24x
// to 1.43x. Used when a character has no timed clear to measure its own factor.
const DEFAULT_EXECUTION = 1.3;

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
    const warn = BOSS_COMBAT[baseName] && BOSS_COMBAT[baseName].warn
        && BOSS_COMBAT[baseName].warn[difficulty];
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
        warn: warn || null,
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
 * A calibration clear done in a party is divided by the party size: the boss's
 * effective HP was dealt by everyone present, so one member's share is an even
 * split of it. That assumes the party pulled its weight evenly, which is rough
 * but far closer than crediting one character with all of it.
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
    // Clear-percent mode: the GMS Upgrade Tracker reports the share of a boss's
    // requirement a character delivers inside the timer, so 122% means it clears
    // with room and 54% means it does a little over half. That is the same
    // quantity as our margin, which makes it a calibration without a stopwatch.
    const pct = parseFloat(character.calibPercent);
    if (pct > 0 && boss && diff) {
        const effPct = effectiveHP(boss, diff, character);
        // The site states damage capacity under an assumed rotation. Real runs
        // lose time to mechanics, shields, transitions and deaths, so capacity is
        // divided by an execution factor measured from this character's own timed
        // clears. A clear time entered directly needs no such correction: the
        // execution is already inside the number.
        if (effPct) {
            const exec = parseFloat(character.executionFactor) || DEFAULT_EXECUTION;
            return (effPct.total * pct / 100) / damageByTime(BOSS_TIME_LIMIT, 1) / exec;
        }
    }
    const mins = parseFloat(character.calibMinutes);
    if (!boss || !diff || !mins || mins <= 0) return 0;
    const eff = effectiveHP(boss, diff, character);
    if (!eff) return 0;
    const party = Math.max(1, parseInt(character.calibParty, 10) || 1);
    return (eff.total / party) / damageByTime(mins * 60, 1);
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
    } else if (field === 'calibParty') {
        character.calibParty = Math.max(1, parseInt(value, 10) || 1);
    } else if (field === 'manualDps' || field === 'ied' || field === 'calibPercent'
            || field === 'executionFactor') {
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
                <label>Arcane Force (blank = 1350)</label>
                <input type="number" min="0" max="2000" value="${character.arcaneForce || ''}"
                       placeholder="1350"
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
                <label>party size of that clear</label>
                <input type="number" min="1" max="6" value="${character.calibParty || 1}"
                       data-prog="calibParty" onchange="updateProgressionField('calibParty', this.value)">
            </div>
            <div class="prog-field">
                <label>in (minutes)</label>
                <input type="number" min="1" max="30" step="0.5" value="${character.calibMinutes || ''}"
                       placeholder="e.g. 27"
                       data-prog="calibMinutes" onchange="updateProgressionField('calibMinutes', this.value)">
            </div>
            <div class="prog-field">
                <label>or site clear % at 30:00</label>
                <input type="number" min="1" step="1" value="${character.calibPercent || ''}"
                       placeholder="e.g. 122"
                       data-prog="calibPercent" onchange="updateProgressionField('calibPercent', this.value)">
            </div>
            <div class="prog-field">
                <label>execution factor (site % only)</label>
                <input type="number" min="1" max="3" step="0.01" value="${character.executionFactor || ''}"
                       placeholder="${DEFAULT_EXECUTION}"
                       data-prog="executionFactor" onchange="updateProgressionField('executionFactor', this.value)">
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
                <td><span class="prog-status ${cur.cls}">${cur.status}</span>${r.cur.warn ? ' <span class="prog-flip prog-s-tight" title="' + sanitizeInput(r.cur.warn) + '">variable</span>' : ''}</td>
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
                ${pace.warn ? `<p class="prog-sub prog-s-tight">⚠ ${sanitizeInput(pace.warn)} — treat this margin as
                   noisier than the others and leave more than the usual buffer.</p>` : ''}
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
async function initialize() {
    const loaded = loadFromLocalStorage();
    const fromFile = await loadSaveFile();
    if (fromFile) console.log('Boss Tracker: loaded saves/latest.json');
    if ((!loaded && !fromFile) || characters.length === 0) {
        // No saved data or empty, create first character
        addCharacter();
    } else {
        // Restore the saved tab. A tab that has since been removed (the old
        // Pitched Tracker, BH History and Gear Tracker) falls back to Boss Crystals.
        if (!document.getElementById(activeMainTab + 'Tab')) activeMainTab = 'bossCrystals';
        switchMainTab(activeMainTab);
    }
}

// Start the app
initialize();


