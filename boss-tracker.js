// Crystal prices, the sale plan and the Progression model live in
// boss-engine.js. The names the page uses are lifted into globals here, so the
// Upgrades and HEXA tabs reach them too.
const {
    bossGroups, bossData, BLACK_MAGE, getBossPartyCount, getBossDifficulty, getBossValue,
    calculateTotal, formatValue, currentMonth, currentCrystalWeek, getBlackMage, getCrystalsDone,
    BOSS_TIME_LIMIT, bossTimeLimit, BURST_CYCLE, BURST_WINDOW, BURST_SHARE, burstsInFight,
    DEFAULT_EXECUTION, getCharSkillIed, statSheetIed, getCharIed, getCharLevel,
    CALIB_FIELDS, resetCalibAnchor, localDate, recordUpgradeGain,
    scouterCut, PREDICTOR_LABELS, runDps, siteDps, predictionSources, sourceDps, sourcePace, predictPace,
    describeSource, measuredExecution, fmtHP, fmtClock, adjustedCharacter, allCombatEntries,
} = BossEngine;

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

let characters = [];
let activeCharacterId = null;
let nextCharacterId = 1;
let activeMainTab = 'bossCrystals';
let globalBlackHeartSpares = 0; // Global BH counter shared across all characters
let upgradeSettings = { ...UpgradeEngine.DEFAULT_SETTINGS };  // account-wide upgrade pricing

// The engine's account-wide figures, for this page's roster.
function calculateGrandTotal() { return BossEngine.calculateGrandTotal(characters); }
function rosterOrder() { return BossEngine.rosterOrder(characters); }
function crystalSalePlan() { return BossEngine.crystalSalePlan(characters); }

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
        calibDate: char.calibDate || null,
        executionFactor: char.executionFactor || null,
        manualDps: char.manualDps || null,
        ied: (char.ied === null || char.ied === undefined) ? null : char.ied,
        upgradeBuild: char.upgradeBuild || null,
        className: char.className || (char.upgradeBuild && char.upgradeBuild.className) || null,
        usesCdrHat: char.usesCdrHat !== false,
        cdrCurve: Array.isArray(char.cdrCurve) && char.cdrCurve.length ? char.cdrCurve : null,
        crystalsDone: char.crystalsDone || null,
        blackMage: char.blackMage || null,
        hexaConverted: char.hexaConverted || null,
        calibAnchors: char.calibAnchors || null,
        hexaLevels: char.hexaLevels || null,
        hexaIncome: char.hexaIncome || null,
        hexaPlanDone: char.hexaPlanDone || 0,
        hexaStones: char.hexaStones || {},
        hexaRenames: char.hexaRenames || [],
        skillIed: (char.skillIed === null || char.skillIed === undefined || char.skillIed === '') ? null : char.skillIed,
        skillIedSource: char.skillIedSource || null,
        skillIedSkills: Array.isArray(char.skillIedSkills) ? char.skillIedSkills : null
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
        // Black Mage left the weekly picks for Selling Strategy's monthly row.
        selectedBosses: new Set((char.selectedBosses || []).filter(b => b !== BLACK_MAGE)),
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
        calibDate: char.calibDate || null,
        executionFactor: char.executionFactor || null,
        manualDps: char.manualDps || null,
        ied: (char.ied === null || char.ied === undefined) ? null : char.ied,
        upgradeBuild: char.upgradeBuild
            ? { ...char.upgradeBuild, className: UpgradeEngine.canonicalClass(char.upgradeBuild.className) }
            : null,
        className: UpgradeEngine.canonicalClass(char.className || (char.upgradeBuild && char.upgradeBuild.className)),
        usesCdrHat: char.usesCdrHat !== false,
        cdrCurve: Array.isArray(char.cdrCurve) && char.cdrCurve.length ? char.cdrCurve : null,
        crystalsDone: char.crystalsDone || null,
        blackMage: char.blackMage || null,
        hexaConverted: char.hexaConverted || null,
        calibAnchors: char.calibAnchors || null,
        hexaLevels: char.hexaLevels || null,
        hexaIncome: char.hexaIncome || null,
        hexaPlanDone: char.hexaPlanDone || 0,
        hexaStones: char.hexaStones || {},
        hexaRenames: char.hexaRenames || [],
        skillIed: (char.skillIed === null || char.skillIed === undefined || char.skillIed === '') ? null : char.skillIed,
        skillIedSource: char.skillIedSource || null,
        skillIedSkills: Array.isArray(char.skillIedSkills) ? char.skillIedSkills : null
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
    if (data.upgradeSettings) upgradeSettings = normalizeUpgradeSettings({ ...upgradeSettings, ...data.upgradeSettings });
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
            if (data.upgradeSettings) upgradeSettings = normalizeUpgradeSettings({ ...upgradeSettings, ...data.upgradeSettings });
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
        calibDate: null,      // day the run or site % was measured; prices the boss as it was then
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
        calibDate: currentChar.calibDate || null,
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

// The roster order is set by dragging character tabs, which is locked until
// Reorganise is pressed so a stray drag never reshuffles it.
let reorderingCharacters = false;
let draggedCharacterId = null;

function toggleCharacterReorder() {
    reorderingCharacters = !reorderingCharacters;
    const btn = document.getElementById('reorderBtn');
    if (btn) {
        btn.textContent = reorderingCharacters ? '✓ Done' : '🔄 Reorganise';
        btn.setAttribute('aria-pressed', String(reorderingCharacters));
        btn.classList.toggle('reorder-on', reorderingCharacters);
    }
    renderCharacterTabs();
}

/**
 * Whether a drop lands after the tab under the pointer: its right half when
 * the tab shares a row with a neighbour, its lower half when the tabs have
 * wrapped one per line (a narrow window).
 */
function dropPosition(event, tab) {
    const box = tab.getBoundingClientRect();
    const inRow = [tab.previousElementSibling, tab.nextElementSibling]
        .some(t => t && Math.abs(t.getBoundingClientRect().top - box.top) < box.height / 2);
    return inRow
        ? { after: event.clientX > box.left + box.width / 2, stacked: false }
        : { after: event.clientY > box.top + box.height / 2, stacked: true };
}

function onCharacterDragStart(event, id) {
    draggedCharacterId = id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(id));
    event.currentTarget.classList.add('dragging');
}

function onCharacterDragOver(event, id) {
    if (draggedCharacterId === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const tab = event.currentTarget;
    const { after, stacked } = dropPosition(event, tab);
    const over = id !== draggedCharacterId;
    tab.classList.toggle('drop-before', over && !after);
    tab.classList.toggle('drop-after', over && after);
    tab.classList.toggle('drop-stacked', stacked);
}

function onCharacterDragLeave(event) {
    event.currentTarget.classList.remove('drop-before', 'drop-after');
}

function onCharacterDrop(event, id) {
    event.preventDefault();
    const { after } = dropPosition(event, event.currentTarget);
    const from = characters.findIndex(c => c.id === draggedCharacterId);
    draggedCharacterId = null;
    if (from < 0 || characters[from].id === id) { renderCharacterTabs(); return; }
    const [moved] = characters.splice(from, 1);
    const target = characters.findIndex(c => c.id === id);
    characters.splice(after ? target + 1 : target, 0, moved);
    saveToLocalStorage();
    renderAll();
}

function onCharacterDragEnd() {
    draggedCharacterId = null;
    document.querySelectorAll('.character-tab.dragging, .character-tab.drop-before, .character-tab.drop-after')
        .forEach(t => t.classList.remove('dragging', 'drop-before', 'drop-after'));
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
    renderHexaCharacterTabs();
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
    } else if (activeMainTab === 'hexa') {
        renderHexaContent();
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
    container.classList.toggle('reordering', reorderingCharacters);
    container.innerHTML = characters.map(char => {
        const total = calculateTotal(char);
        const sanitizedName = sanitizeInput(char.name);
        const drag = reorderingCharacters ? `draggable="true"
                 ondragstart="onCharacterDragStart(event, ${char.id})" ondragover="onCharacterDragOver(event, ${char.id})"
                 ondragleave="onCharacterDragLeave(event)" ondrop="onCharacterDrop(event, ${char.id})"
                 ondragend="onCharacterDragEnd()"` : '';
        return `
            <div class="character-tab ${char.id === activeCharacterId ? 'active' : ''}" ${drag}
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
        .filter(boss => boss.baseName !== BLACK_MAGE)
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

function updateBlackMage(characterId, change) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    character.blackMage = { ...(character.blackMage || {}), ...change };
    saveToLocalStorage();
    renderSellingStrategy();
}

function setBlackMagePlanned(characterId, on) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    if (!on) {
        // Taking the run back out of the week also undoes its finished tick.
        const done = getCrystalsDone(character);
        if (done.delete(BLACK_MAGE)) character.crystalsDone = { week: currentCrystalWeek(), bosses: Array.from(done) };
        if (getBlackMage(character).doneByRun) character.blackMage = { ...character.blackMage, doneMonth: null, doneWeek: null };
    }
    updateBlackMage(characterId, { plannedWeek: on ? currentCrystalWeek() : null });
}

/** Done for the month by hand: run earlier this month, so not this week. */
function setBlackMageDone(characterId, on) {
    updateBlackMage(characterId, on
        ? { doneMonth: currentMonth(), doneWeek: null, plannedWeek: null }
        : { doneMonth: null, doneWeek: null });
}

function setBlackMageDifficulty(characterId, difficulty) {
    updateBlackMage(characterId, { difficulty });
}

/** Black Mage's party size, kept with the other bosses' party sizes. */
function setBlackMageParty(characterId, count) {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    character.bossPartyCount[BLACK_MAGE] = Math.max(1, Math.min(6, parseInt(count, 10) || 1));
    saveToLocalStorage();
    renderSellingStrategy();
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

function setCrystalsDone(character, bosses) {
    const week = currentCrystalWeek();
    character.crystalsDone = { week, bosses: Array.from(bosses) };
    const bm = getBlackMage(character);
    if (bm.planned && character.crystalsDone.bosses.includes(BLACK_MAGE)) {
        character.blackMage = { ...character.blackMage, doneMonth: currentMonth(), doneWeek: week };
    } else if (bm.doneByRun) {
        character.blackMage = { ...character.blackMage, doneMonth: null, doneWeek: null };
    }
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

/** A column's monthly Black Mage row: run this week, done this month, difficulty, party size. */
function renderBlackMageControls(char) {
    const bm = getBlackMage(char);
    const boss = bossData.find(b => b.baseName === BLACK_MAGE);
    const difficulties = boss
        ? Object.keys(boss.difficulties).sort((a, b) => boss.difficulties[a].value - boss.difficulties[b].value)
        : ['Hard'];
    // Done earlier this month: nothing to run. Done this week: the checklist tick owns it.
    const runLocked = bm.done && !bm.doneByRun;
    const party = getBossPartyCount(char, BLACK_MAGE);
    return `
        <div class="sell-bm ${bm.planned ? 'sell-bm-on' : ''}">
            ${renderBossIcon(BLACK_MAGE, bm.difficulty, 'boss-icon-sm')}
            <label title="${runLocked ? 'Already done this month' : 'Run Black Mage this week: its crystal counts in place of the lowest one'}">
                <input type="checkbox" ${bm.planned ? 'checked' : ''} ${runLocked ? 'disabled' : ''}
                       onchange="setBlackMagePlanned(${char.id}, this.checked)"> Run
            </label>
            <label title="Done this month${bm.doneByRun ? ': finished in this week\'s checklist' : ': ran it earlier this month'}">
                <input type="checkbox" ${bm.done ? 'checked' : ''} ${bm.doneByRun ? 'disabled' : ''}
                       onchange="setBlackMageDone(${char.id}, this.checked)"> Done
            </label>
            <select onchange="setBlackMageDifficulty(${char.id}, this.value)" aria-label="Black Mage difficulty">
                ${difficulties.map(d => `<option value="${d}" ${d === bm.difficulty ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
            <select class="sell-bm-party" onchange="setBlackMageParty(${char.id}, this.value)" aria-label="Black Mage party size"
                    title="Party size: the crystal's value is split between the party">
                ${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${n === party ? 'selected' : ''}>×${n}</option>`).join('')}
            </select>
        </div>`;
}

/**
 * Weekly checklist of the crystals that count, one column per character.
 * A character whose bosses are all finished collapses to its header.
 */
function renderCrystalChecklist(counted) {
    const byCharacter = characters
        .map(char => ({ char, bosses: counted.filter(b => b.characterId === char.id) }))
        .filter(c => c.bosses.length || (c.char.selectedBosses && c.char.selectedBosses.size));
    if (!byCharacter.length) return '';

    let doneTotal = 0, earned = 0, charsDone = 0;
    const columnState = sellColumnState();
    const columns = byCharacter.map(({ char, bosses }) => {
        const done = getCrystalsDone(char);
        const finishedBosses = bosses.filter(b => done.has(b.baseName));
        const finished = finishedBosses.length;
        doneTotal += finished;
        earned += finishedBosses.reduce((sum, b) => sum + b.adjustedValue, 0);
        const complete = bosses.length > 0 && finished === bosses.length;
        if (complete) charsDone++;
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
                ${renderBlackMageControls(char)}
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
                <span class="sell-total">Characters ${charsDone}/${byCharacter.filter(c => c.bosses.length).length}</span>
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
        byBoss[label].chars.push({ id: b.characterId, name: b.characterName, partyCount: b.partyCount });
    });

    // Sort groups by adjustedValue descending, and each group's characters top to bottom
    const groups = Object.values(byBoss).sort((a, b) => b.adjustedValue - a.adjustedValue);
    const rosterIndex = rosterOrder();
    groups.forEach(g => g.chars.sort((a, b) => rosterIndex.get(a.id) - rosterIndex.get(b.id)));

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
// Progression tab rendering
// ============================================================================

let progressionSelectedBoss = null;   // "BaseName|Difficulty" for the phase panel

// What-if adjustments keyed by character id. Held in memory only: they model a
// scenario rather than the character's real state, so they are never saved.
const progressionAdjust = {};

function getProgressionAdjust(character) {
    return progressionAdjust[character.id] || { level: 0, ied: 0 };
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

function updateProgressionField(field, value) {
    const character = getActiveCharacter();
    if (!character) return;
    if (field === 'calibBoss') {
        const parts = value.split('|');
        character.calibBoss = parts[0] || null;
        character.calibDifficulty = parts[1] || null;
    } else if (field === 'calibParty') {
        character.calibParty = Math.max(1, parseInt(value, 10) || 1);
    } else if (field === 'calibDate') {
        character.calibDate = value || null;
    } else if (field === 'manualDps' || field === 'ied' || field === 'calibPercent'
            || field === 'executionFactor' || field === 'hexaConverted' || field === 'calibMinutes'
            || field === 'skillIed') {
        character[field] = value === '' ? null : parseFloat(value);
    } else {
        character[field] = value === '' ? null : parseInt(value, 10);
    }
    // A new clear time or site % is a new measurement, taken today unless the
    // date field says otherwise: it is priced against the boss as it is now.
    if (field === 'calibMinutes' || field === 'calibPercent') character.calibDate = character[field] ? localDate() : null;
    if (field === 'hexaConverted') resetCalibAnchor(character, 'hexa');
    if (CALIB_FIELDS.includes(field)) resetCalibAnchor(character, 'calib');
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

    const sources = predictionSources(character);
    const primary = sources[0] || null;
    const other = sources[1] || null;           // shown alongside for comparison
    const dps = primary ? sourceDps(character, primary) : 0;
    const entries = allCombatEntries();
    const calibKey = character.calibBoss ? `${character.calibBoss}|${character.calibDifficulty}` : '';

    const field = (label, key, value, attrs = '') => `
            <div class="prog-field">
                <label>${label}</label>
                <input type="number" ${attrs} value="${value === null || value === undefined ? '' : value}"
                       data-prog="${key}" onchange="updateProgressionField('${key}', this.value)">
            </div>`;
    const setup = `
        <div class="prog-setup">
            <div class="prog-group-label">Character</div>
            ${field('Character level', 'charLevel', getCharLevel(character), 'min="200" max="300"')}
            ${field('Sacred Force (blank = capped)', 'sacredForce', character.sacredForce || '', 'min="0" max="1000" placeholder="capped"')}
            ${field('Arcane Force (blank = 1350)', 'arcaneForce', character.arcaneForce || '', 'min="0" max="2000" placeholder="1350"')}
            ${statSheetIed(character) !== null
                ? `<div class="prog-field"><label>IED % (from the Upgrades stat sheet)</label>
                       <input type="number" value="${statSheetIed(character)}" disabled
                              title="Change it on the Upgrades tab's stat sheet"></div>`
                : field('IED % (stat window)', 'ied', getCharIed(character), 'min="0" max="100" step="0.1" placeholder="98"')}
            ${field('IED from skills % (blank = class default)', 'skillIed', character.skillIed ?? '', `min="0" max="99" step="0.1" placeholder="${getCharSkillIed(Object.assign({}, character, { skillIed: null }))}"`)}
        </div>
        <div class="prog-setup">
            <div class="prog-group-label">MapleScouter estimate</div>
            ${field('Hexa converted (Boss 380)', 'hexaConverted', character.hexaConverted || '', 'min="0" step="1" placeholder="e.g. 73418"')}
            ${field('Execution factor (blank = 1, as MapleScouter)', 'executionFactor', character.executionFactor || '', 'min="1" max="3" step="0.01" placeholder="1"')}
        </div>
        <div class="prog-setup">
            <div class="prog-group-label">Calibrated run <span class="prog-sub">(used as the predictor when entered)</span></div>
            <div class="prog-field prog-field-wide">
                <label>Boss you cleared</label>
                <select data-prog="calibBoss" onchange="updateProgressionField('calibBoss', this.value)">
                    <option value="">— pick a boss —</option>
                    ${entries.map(e => {
                        const k = `${e.baseName}|${e.difficulty}`;
                        return `<option value="${k}" ${calibKey === k ? 'selected' : ''}>${sanitizeInput(e.fullName)}</option>`;
                    }).join('')}
                </select>
            </div>
            ${field('Clear time (minutes)', 'calibMinutes', character.calibMinutes || '', 'min="1" max="30" step="0.5" placeholder="e.g. 27"')}
            ${field('Party size of that clear', 'calibParty', character.calibParty || 1, 'min="1" max="6"')}
            <div class="prog-field">
                <label>Date of the run or site % (blank = before any boss changes)</label>
                <input type="date" value="${character.calibDate || ''}" data-prog="calibDate"
                       title="The boss is priced as it stood on this day, so a run timed before a patch keeps its meaning"
                       onchange="updateProgressionField('calibDate', this.value)">
            </div>
        </div>
        <details class="prog-setup prog-fallback">
            <summary class="prog-group-label">Other calibration</summary>
            ${field('Upgrade site clear % (used only without a run or hexa converted)', 'calibPercent', character.calibPercent || '', 'min="1" step="1" placeholder="e.g. 122"')}
            ${field('DPS override (B/sec, counts as a run)', 'manualDps', character.manualDps || '', 'min="0" step="10" placeholder="e.g. 1000"')}
        </details>
    `;

    if (dps <= 0) {
        container.innerHTML = `
            <div class="prog-wrap">
                <h2 class="prog-title">Progression</h2>
                <p class="prog-sub">Enter hexa converted from MapleScouter, or a boss you clear and how long it
                   takes. Either gives your damage, and everything else is priced against it.</p>
                ${setup}
                <div class="empty-message">Add hexa converted or a timed clear to see every boss.</div>
            </div>`;
        return;
    }

    const execMeasured = measuredExecution(character);
    const sourceNote = `
        <div class="prog-sources">
            ${sources.map(src => `
                <div class="prog-source ${src === primary ? 'prog-source-primary' : ''}">
                    <span class="prog-k">${src === primary ? 'Predicting with' : 'Compare'} · ${PREDICTOR_LABELS[src]}</span>
                    <span>${sanitizeInput(describeSource(character, src))}</span>
                </div>`).join('')}
            ${execMeasured ? `<div class="prog-source">
                    <span class="prog-k">Measured execution</span>
                    <span>your run lands ${(100 / execMeasured).toFixed(0)}% of MapleScouter's expert pace
                        (factor ${execMeasured.toFixed(2)})</span>
                </div>` : ''}
        </div>`;

    const perBurst = dps * BURST_CYCLE * BURST_SHARE;
    const offDps = dps * BURST_CYCLE * (1 - BURST_SHARE) / (BURST_CYCLE - BURST_WINDOW);
    const burstDps = perBurst / BURST_WINDOW;
    // Bursts are counted against the selected boss's timer, else the usual one.
    const cadenceLimit = progressionSelectedBoss
        ? bossTimeLimit(...progressionSelectedBoss.split('|')) : BOSS_TIME_LIMIT;

    const cadence = `
        <div class="prog-cadence">
            <div><span class="prog-k">Sustained</span><span class="prog-v">${(dps / 1e9).toFixed(0)}B/sec</span></div>
            <div><span class="prog-k">Burst (${BURST_WINDOW}s)</span><span class="prog-v">${(burstDps / 1e9).toFixed(0)}B/sec</span></div>
            <div><span class="prog-k">Off-burst</span><span class="prog-v">${(offDps / 1e9).toFixed(0)}B/sec</span></div>
            <div><span class="prog-k">Per burst</span><span class="prog-v">${fmtHP(perBurst)}</span></div>
            <div><span class="prog-k">Bursts in ${fmtClock(cadenceLimit)}</span><span class="prog-v">${burstsInFight(cadenceLimit)}</span></div>
            <div><span class="prog-k">Cycle</span><span class="prog-v">${BURST_CYCLE.toFixed(0)}s</span></div>
        </div>
    `;

    // What-if layer. DPS stays as calibrated; only the projection uses the
    // adjusted level and IED, so every figure below compares like for like.
    const adj = getProgressionAdjust(character);
    const adjusted = adjustedCharacter(character, adj);
    const active = adj.level !== 0 || adj.ied !== 0;

    const scored = entries.map(e => {
        const cur = sourcePace(character, e.baseName, e.difficulty, primary);
        if (!cur) return null;
        const alt = active ? sourcePace(character, e.baseName, e.difficulty, primary, adjusted) : null;
        const cmp = other ? sourcePace(character, e.baseName, e.difficulty, other) : null;
        const cut = sources.includes('scouter') ? scouterCut(character, e.baseName, e.difficulty) : null;
        return { e: e, cur: cur, alt: alt, cmp: cmp, cut: cut };
    }).filter(Boolean);
    const showCut = sources.includes('scouter');

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
                ${showCut ? `<td class="prog-num ${r.cut === null ? '' : r.cut >= 100 ? 'prog-s-ok' : 'prog-s-fail'}"
                    title="${r.cut === null ? 'No MapleScouter threshold for this boss; priced from the Normal Kalos cut' : 'MapleScouter cut predicted from hexa converted'}">
                    ${r.cut === null ? '—' : r.cut.toFixed(1) + '%'}</td>` : ''}
                <td class="prog-num">${fmtClock(r.cur.limit)}</td>
                <td class="prog-num">${fmtClock(r.cur.clearTime)}</td>
                <td><span class="prog-status ${cur.cls}">${cur.status}</span>${r.cur.warn ? ' <span class="prog-flip prog-s-tight" title="' + sanitizeInput(r.cur.warn) + '">variable</span>' : ''}</td>
                ${r.cmp ? (() => {
                    const c = paceStatus(r.cmp);
                    return `<td class="prog-num prog-cmp-col">${fmtClock(r.cmp.clearTime)}</td>
                            <td class="prog-cmp-col"><span class="prog-status ${c.cls}">${c.status}</span></td>`;
                })() : ''}
                ${adjCells}
            </tr>`;
    }).join('');

    let detail = '';
    if (progressionSelectedBoss) {
        const parts = progressionSelectedBoss.split('|');
        const pace = sourcePace(character, parts[0], parts[1], primary);
        const altPace = active ? sourcePace(character, parts[0], parts[1], primary, adjusted) : null;
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
               the damage you actually have to output. Everything is measured against each boss's own time limit.</p>
            ${setup}
            ${sourceNote}
            ${cadence}
            ${adjustPanel}
            <div class="prog-table-wrap">
            <table class="prog-table">
                <thead><tr><th>Boss</th><th class="prog-num">Raw HP</th><th class="prog-num">Effective</th>
                    ${showCut ? '<th class="prog-num" title="MapleScouter cut predicted from hexa converted">Scouter cut</th>' : ''}
                    <th class="prog-num">Limit</th><th class="prog-num">Clear time</th><th>Margin (${PREDICTOR_LABELS[primary]})</th>
                    ${other ? `<th class="prog-num prog-cmp-col">Clear</th><th class="prog-cmp-col">Margin (${PREDICTOR_LABELS[other]})</th>` : ''}
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


