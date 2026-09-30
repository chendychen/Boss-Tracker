// Upgrades tab: per-character gear inventory, stat sheet, pricing settings,
// and the ranked upgrade plan with the bosses each step brings on pace.
//
// Loaded before boss-tracker.js; everything here reads that file's globals
// (characters, getActiveCharacter, saveToLocalStorage, upgradeSettings, the
// Progression model) only when called, never at load time.

let upgradeBuildFiles = null;        // listing of builds/ from the local server
// Why the listing is empty when it is: 'file' (page opened as a file, which
// cannot list a folder), 'server' (served by something other than
// tools/save-server.mjs), or null when the listing is real.
let upgradeBuildFilesProblem = null;
// Build files from a folder picked in the browser, for when the page runs
// without the server: file name -> File. Held for the session only.
let upgradeLocalBuilds = null;
let upgradeTypeFilter = 'all';       // all | starforce | cube | flame
const UPGRADE_PLAN_ROWS = 25;

/** Stat sheet fields, labelled with the class's own stats when it is known. */
function upgradeStatFields(className) {
    const cs = UpgradeEngine.CLASS_STATS[className];
    const main = cs ? UpgradeEngine.STAT_NAMES[cs.main] : 'Main stat';
    const sub = cs ? UpgradeEngine.STAT_NAMES[cs.sub] : 'Secondary';
    const atk = cs ? (cs.magic ? 'MATT' : 'ATT') : 'ATT / MATT';
    return [
        ['mainBase', `${main} (base)`], ['mainPct', `${main} %`], ['mainFlat', `${main} (flat, not % scaled)`],
        ['subBase', `${sub} (base)`], ['subPct', `${sub} %`], ['subFlat', `${sub} (flat)`],
        ['att', atk], ['attPct', `${atk} %`], ['dmg', 'Damage %'], ['boss', 'Boss damage %'],
        ['critDmg', 'Crit damage %'], ['ied', 'IED %'],
    ];
}

/**
 * A character's class. It lives on the character so it survives re-imports
 * and applies before any gear is entered; a build's own class is only a
 * fallback for characters saved before the field existed.
 */
function getCharClass(character) {
    return (character && (character.className || (character.upgradeBuild && character.upgradeBuild.className))) || null;
}

const UPGRADE_SLOT_ORDER = [
    'weapon', 'secondary', 'emblem', 'hat', 'top', 'bottom', 'overall', 'shoulder', 'cape',
    'gloves', 'shoes', 'belt', 'face', 'eye', 'earring', 'pendant', 'pendant2',
    'ring1', 'ring2', 'ring3', 'ring4', 'pocket', 'heart', 'badge', 'medal',
];

function fmtMeso(v) {
    if (!isFinite(v)) return '—';
    if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T';
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    return Math.round(v).toLocaleString();
}

function upgradeSlotRank(slot) {
    const i = UPGRADE_SLOT_ORDER.indexOf(slot);
    return i === -1 ? UPGRADE_SLOT_ORDER.length : i;
}

function renderUpgradesCharacterTabs() {
    const container = document.getElementById('upgradesCharacterTabs');
    if (!container) return;
    container.innerHTML = characters.map(char => {
        const build = char.upgradeBuild;
        const gear = build && build.items ? `${Object.keys(build.items).length} items`
            : build ? 'stats only' : 'no build';
        const cls = getCharClass(char);
        const note = cls ? `${cls} · ${gear}` : gear;
        return `
            <div class="character-tab ${char.id === activeCharacterId ? 'active' : ''}"
                 onclick="switchCharacter(${char.id})">
                <div class="character-tab-name">${sanitizeInput(char.name)}</div>
                <div class="character-tab-total">${note}</div>
            </div>`;
    }).join('');
}

/** Fetches the builds/ listing once per session (re-fetched on demand). */
async function refreshUpgradeBuildFiles() {
    upgradeBuildFilesProblem = null;
    if (upgradeLocalBuilds) {
        // A picked folder is a snapshot; picking it again is how it refreshes.
        document.getElementById('upgradeBuildFolder')?.click();
        return;
    }
    if (!location.protocol.startsWith('http')) {
        upgradeBuildFiles = [];
        upgradeBuildFilesProblem = 'file';
    } else {
        try {
            const res = await fetch('api/builds', { cache: 'no-store' });
            if (!res.ok) throw new Error(res.status);
            upgradeBuildFiles = (await res.json()).builds || [];
        } catch (e) {
            upgradeBuildFiles = [];
            upgradeBuildFilesProblem = 'server';
        }
    }
    if (activeMainTab === 'upgrades') renderUpgradesContent();
}

/**
 * Adopts an imported build for the active character. A MapleScouter preset
 * only replaces the stat sheet; an Upgrade Tracker build replaces both the
 * sheet and the inventory.
 */
function adoptUpgradeBuild(json, label) {
    const character = getActiveCharacter();
    if (!character) return;
    const imported = UpgradeEngine.importBuild(json);
    if (!imported) {
        alert(`${label} is not a GMS Upgrade Tracker build or a MapleScouter preset.`);
        return;
    }
    const current = character.upgradeBuild;
    if (imported.items && current && current.items
        && !confirm(`Replace ${character.name}'s gear with ${label}?`)) return;
    const known = getCharClass(character);
    if (imported.className && known && imported.className !== known
        && confirm(`${label} is a ${imported.className}, but ${character.name} is set as ${known}. Switch ${character.name} to ${imported.className}?`)) {
        character.className = imported.className;
    }
    if (!known && imported.className) character.className = imported.className;

    character.upgradeBuild = {
        ...(current || {}),
        source: imported.source,
        file: label,
        importedAt: new Date().toISOString(),
        ign: imported.ign || (current && current.ign) || null,
        className: getCharClass(character) || imported.className || null,
        stats: imported.stats,
        items: imported.items || (current && current.items) || null,
    };
    if (imported.level && !character.charLevel) character.charLevel = imported.level;
    saveToLocalStorage();
    renderUpgradesCharacterTabs();
    renderUpgradesContent();
}

/**
 * Takes the JSON files from a folder the user picked (the builds/ folder, or
 * any other). Browsers can list a picked folder even when the page is opened
 * as a file, which the server listing cannot do.
 */
function pickUpgradeBuildFolder(event) {
    const picked = [...event.target.files].filter(f => f.name.toLowerCase().endsWith('.json'));
    event.target.value = '';
    if (!picked.length) {
        alert('That folder has no .json build files.');
        return;
    }
    upgradeLocalBuilds = new Map(picked.map(f => [f.name, f]));
    upgradeBuildFiles = picked
        .sort((a, b) => b.lastModified - a.lastModified)
        .map(f => ({ file: f.name, modified: new Date(f.lastModified).toISOString() }));
    upgradeBuildFilesProblem = null;
    renderUpgradesContent();
}

async function importUpgradeBuildFromFolder(file) {
    if (!file) return;
    if (upgradeLocalBuilds && upgradeLocalBuilds.has(file)) {
        try {
            adoptUpgradeBuild(JSON.parse(await upgradeLocalBuilds.get(file).text()), file);
        } catch (e) {
            alert(`${file} is not valid JSON.`);
        }
        return;
    }
    try {
        const res = await fetch('builds/' + encodeURIComponent(file), { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status);
        adoptUpgradeBuild(await res.json(), file);
    } catch (e) {
        alert(`Could not read builds/${file}: ${e.message}`);
    }
}

function importUpgradeBuildFromFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            adoptUpgradeBuild(JSON.parse(e.target.result), file.name);
        } catch (err) {
            alert(`${file.name} is not valid JSON.`);
        }
    };
    reader.readAsText(file);
}

function ensureUpgradeBuild(character) {
    if (!character.upgradeBuild) {
        character.upgradeBuild = { source: 'manual', stats: UpgradeEngine.normalizeStats({}), items: {},
                                   className: getCharClass(character) };
    }
    return character.upgradeBuild;
}

function setUpgradeClass(value) {
    const character = getActiveCharacter();
    if (!character) return;
    character.className = value || null;
    if (character.upgradeBuild) character.upgradeBuild.className = character.className;
    saveToLocalStorage();
    renderUpgradesCharacterTabs();
    renderUpgradesContent();
}

function setUpgradeStat(field, value) {
    const character = getActiveCharacter();
    if (!character) return;
    const build = ensureUpgradeBuild(character);
    build.stats = { ...UpgradeEngine.normalizeStats(build.stats), [field]: parseFloat(value) || 0 };
    delete build.statsStale;
    saveToLocalStorage();
    renderUpgradesContent();
}

// ── Gear editor ─────────────────────────────────────────────────────────────

let upgradeEditSlot = null;     // slot open in the editor
// 'upgrade': an edit is a change made in game, so the stat sheet follows it.
// 'describe': the edit records gear already worn, which the sheet already has.
let upgradeEditMode = null;

function getUpgradeEditMode(build) {
    return upgradeEditMode || (build && build.source === 'gms-upgrade-tracker' ? 'upgrade' : 'describe');
}

function setUpgradeEditMode(mode) {
    upgradeEditMode = mode;
    renderUpgradesContent();
}

function selectUpgradeSlot(slot) {
    upgradeEditSlot = upgradeEditSlot === slot ? null : slot;
    renderUpgradesContent();
}

/**
 * Applies an edit to one item. In upgrade mode the stat sheet moves by the
 * difference between the old and new item; changing to a different item also
 * changes base stats and set effects, which are not modelled, so the sheet is
 * flagged for a re-read from the game.
 */
function editUpgradeItem(slot, mutate, { swap = false, forceUpgrade = false } = {}) {
    const character = getActiveCharacter();
    if (!character) return;
    const build = ensureUpgradeBuild(character);
    if (!build.items) build.items = {};
    const before = build.items[slot] ? JSON.parse(JSON.stringify(build.items[slot])) : null;
    const item = build.items[slot] || UpgradeEngine.newItem(slot);
    mutate(item);
    build.items[slot] = item;
    if (forceUpgrade || getUpgradeEditMode(build) === 'upgrade') {
        build.stats = UpgradeEngine.restatItem(build.stats, before, item,
            build.className, getCharLevel(character));
        if (swap) build.statsStale = true;
    }
    saveToLocalStorage();
    renderUpgradesCharacterTabs();
    renderUpgradesContent();
}

function setUpgradeItemField(slot, field, value) {
    editUpgradeItem(slot, item => {
        if (field === 'locked') item.locked = !!value;
        else if (field === 'potTier') item.potTier = value;
        else if (field === 'name') item.name = String(value);
        else if (field === 'set') item.set = String(value);
        else if (field === 'replacementCost') item.replacementCost = UpgradeEngine.parseMeso(value, 0);
        else if (field === 'baseAtt') {
            item.baseStats = { ...(item.baseStats || {}), att: parseFloat(value) || 0, matt: parseFloat(value) || 0 };
        } else if (field === 'lineCount') {
            item.lineCount = Math.max(1, Math.min(3, parseInt(value, 10) || 3));
            item.potLines = (item.potLines || []).slice(0, item.lineCount);
        } else item[field] = parseFloat(value) || 0;
    }, { swap: field === 'level' || field === 'set' });
}

function pickUpgradeCatalogItem(slot, index) {
    const entry = UpgradeEngine.GEAR_CATALOG[+index];
    if (!entry) return;
    editUpgradeItem(slot, item => {
        const fresh = UpgradeEngine.newItem(slot, entry);
        // Keep what was rolled on the old item only when it is the same item.
        const same = item.name === entry.name;
        Object.assign(item, fresh, same ? {
            potTier: item.potTier, potLines: item.potLines, flames: item.flames,
            stars: item.stars, lineCount: item.lineCount,
        } : {});
    }, { swap: true });
}

function setUpgradeLine(slot, index, part, value) {
    editUpgradeItem(slot, item => {
        const lines = (item.potLines || []).map(l => ({ ...l }));
        while (lines.length <= index) lines.push({ stat: 'other', value: 0 });
        if (part === 'stat') {
            const values = UpgradeEngine.lineValuesFor(slot, item.level, value);
            lines[index] = { stat: value, value: values.length ? values[0] : lines[index].value };
        } else {
            lines[index].value = parseFloat(value) || 0;
        }
        item.potLines = lines.slice(0, item.lineCount || 3);
    });
}

function setUpgradeFlame(slot, key, value) {
    editUpgradeItem(slot, item => {
        item.flames = { ...(item.flames || {}), [key]: parseFloat(value) || 0 };
        item.flameScore = UpgradeEngine.flameScore(item.flames, getActiveCharacter().upgradeBuild.className);
    });
}

function removeUpgradeItem(slot) {
    const character = getActiveCharacter();
    const build = character && character.upgradeBuild;
    if (!build || !build.items || !build.items[slot]) return;
    if (!confirm(`Remove ${build.items[slot].name || slot}?`)) return;
    const before = build.items[slot];
    delete build.items[slot];
    if (getUpgradeEditMode(build) === 'upgrade') {
        build.stats = UpgradeEngine.restatItem(build.stats, before, null, build.className, getCharLevel(character));
        build.statsStale = true;
    }
    upgradeEditSlot = null;
    saveToLocalStorage();
    renderUpgradesCharacterTabs();
    renderUpgradesContent();
}

function startBlankUpgradeBuild() {
    const character = getActiveCharacter();
    if (!character) return;
    character.upgradeBuild = {
        source: 'manual', file: 'entered by hand', importedAt: new Date().toISOString(),
        className: getCharClass(character), stats: UpgradeEngine.normalizeStats({}), items: {},
    };
    upgradeEditMode = null;
    saveToLocalStorage();
    renderUpgradesCharacterTabs();
    renderUpgradesContent();
}

function clearUpgradeStatsStale() {
    const character = getActiveCharacter();
    if (character && character.upgradeBuild) delete character.upgradeBuild.statsStale;
    saveToLocalStorage();
    renderUpgradesContent();
}

function setUpgradeSetting(key, value) {
    const def = UpgradeEngine.DEFAULT_SETTINGS[key];
    if (typeof def === 'boolean') upgradeSettings[key] = !!value;
    else if (typeof def === 'number') upgradeSettings[key] = UpgradeEngine.parseMeso(value, def);
    else upgradeSettings[key] = value;
    saveToLocalStorage();
    renderUpgradesContent();
}

function setUpgradeTypeFilter(type) {
    upgradeTypeFilter = type;
    renderUpgradesContent();
}

// recommend() takes around a second on a full build, so results are cached
// against everything they depend on.
const upgradeRecCache = new Map();

function upgradeRecKey(character, build) {
    return JSON.stringify([character.id, build.stats, build.items, build.className,
        characterUpgradeSettings(character), getCharLevel(character)]);
}

function hasCachedRecommendations(character, build) {
    const hit = upgradeRecCache.get(character.id);
    return !!hit && hit.key === upgradeRecKey(character, build);
}

function cachedRecommendations(character, build) {
    const key = upgradeRecKey(character, build);
    const hit = upgradeRecCache.get(character.id);
    if (hit && hit.key === key) return hit.recs;
    const recs = UpgradeEngine.recommend(build, characterUpgradeSettings(character), { charLevel: getCharLevel(character) });
    upgradeRecCache.set(character.id, { key, recs });
    return recs;
}

/**
 * The engine's greedy plan with running totals, plus which bosses each step
 * brings on pace, using the Progression tab's own margin for this character.
 */
function buildUpgradePlan(character, recs) {
    const dps = characterDps(character);
    const failing = dps > 0 ? allCombatEntries()
        .map(e => ({ ...e, pace: bossPace(e.baseName, e.difficulty, character, dps) }))
        .filter(e => e.pace && !e.pace.clears && !e.pace.blocked && isFinite(e.pace.damageNeeded))
        : [];
    let mult = 1, cost = 0;
    const seen = new Set();
    const plan = UpgradeEngine.buildPlan(recs, UPGRADE_PLAN_ROWS).map(rec => {
        const key = `${rec.slot}|${rec.type}`;
        const raises = rec.type !== 'starforce' && seen.has(key);
        seen.add(key);
        if (raises) rec = { ...rec, detail: `raises the earlier target, re-rolling from scratch · ${rec.detail}` };
        mult *= 1 + rec.fdGain / 100;
        cost += rec.cost;
        const unlocks = failing.filter(e => !e.unlocked && mult >= e.pace.damageNeeded);
        unlocks.forEach(e => { e.unlocked = true; });
        return { ...rec, cumFd: (mult - 1) * 100, cumCost: cost, unlocks };
    });
    const nextBoss = failing.filter(e => !e.unlocked)
        .sort((a, b) => a.pace.damageNeeded - b.pace.damageNeeded)[0] || null;
    return { plan, nextBoss, calibrated: dps > 0 };
}

function renderUpgradeSettings() {
    const s = upgradeSettings;
    const D = UpgradeEngine.DEFAULT_SETTINGS;
    const num = (key, label, hint) => `
        <div class="prog-field">
            <label>${label}</label>
            <input type="text" value="${fmtMeso(s[key])}" onchange="setUpgradeSetting('${key}', this.value)">
            ${hint ? `<span class="upg-hint">${hint}</span>` : ''}
        </div>`;
    const text = (key, label, hint) => `
        <div class="prog-field">
            <label>${label}</label>
            <input type="text" value="${sanitizeInput(String(s[key]))}" onchange="setUpgradeSetting('${key}', this.value)">
            ${hint ? `<span class="upg-hint">${hint}</span>` : ''}
        </div>`;
    const check = (key, label) => `
        <label class="upg-check">
            <input type="checkbox" ${s[key] ? 'checked' : ''} onchange="setUpgradeSetting('${key}', this.checked)">
            ${label}
        </label>`;
    return `
        <details class="upg-card">
            <summary>Pricing and events</summary>
            <div class="prog-setup">
                ${num('glowingCube', 'Glowing Cube price', `default ${fmtMeso(D.glowingCube)}`)}
                ${num('brightCube', 'Bright Cube price', `default ${fmtMeso(D.brightCube)}`)}
                ${num('flameReset', 'Flame reset price', `default ${fmtMeso(D.flameReset)}`)}
                <div class="prog-field">
                    <label>Boss PDR for valuing IED</label>
                    <select onchange="setUpgradeSetting('pdr', this.value)">
                        ${[300, 380].map(p => `<option value="${p}" ${s.pdr === p ? 'selected' : ''}>${p}%</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="prog-setup">
                ${text('sfProtection', 'Enhancement Mode 18/19/20/21★', 'e.g. 1144 (the site default), 4444 = no booms')}
                ${text('sfProtectionPitched', 'Pitched / Brilliant items', 'default 4444')}
                ${text('sfMaxStar', 'Star force target', 'for items without their own cap')}
                ${text('mvpDiscount', 'MVP star force discount %', 'Silver 3, Gold 5, Diamond 10')}
                ${text('cdrValue', 'FD % per second of cooldown', 'hat CDR lines; site default 0.7')}
            </div>
            <div class="upg-checks">
                ${check('shiningStarForce', 'Shining Star Force (30% off, 30% fewer booms)')}
                ${check('safeguard', 'Safeguard 15→18★')}
            </div>
        </details>`;
}

function renderUpgradeStats(character, build) {
    const stats = UpgradeEngine.normalizeStats(build.stats);
    return `
        <details class="upg-card" ${build.items && Object.keys(build.items).length ? '' : 'open'}>
            <summary>Stat sheet</summary>
            <p class="upg-note">Values from the in-game stat window with your usual bossing buffs.
                Only ratios matter, so small errors shift every upgrade alike.</p>
            <div class="prog-setup">
                ${upgradeStatFields(build.className).map(([k, label]) => `
                    <div class="prog-field">
                        <label>${label}</label>
                        <input type="number" step="any" value="${stats[k] || ''}"
                               onchange="setUpgradeStat('${k}', this.value)">
                    </div>`).join('')}
            </div>
        </details>`;
}

/** What a set of lines is worth: FD lost if they were all removed. */
function upgradeLinesWorth(stats, delta) {
    const without = UpgradeEngine.applyDelta(stats, UpgradeEngine.negateDelta(delta));
    const base = UpgradeEngine.damageIndex(without, upgradeSettings.pdr);
    return base ? (UpgradeEngine.damageIndex(stats, upgradeSettings.pdr) / base - 1) * 100 : 0;
}

/**
 * Account pricing with this character's own choices on top: a class that
 * does not run a cooldown hat gets nothing from CDR lines.
 */
function characterUpgradeSettings(character) {
    const usesCdr = !character || character.usesCdrHat !== false;
    return usesCdr ? upgradeSettings : { ...upgradeSettings, cdrValue: 0 };
}

function setUpgradeUsesCdr(value) {
    const character = getActiveCharacter();
    if (!character) return;
    character.usesCdrHat = !!value;
    saveToLocalStorage();
    renderUpgradesContent();
}

function upgradeStatsFor(character, build) {
    return UpgradeEngine.normalizeStats({ ...build.stats,
        cdrValue: characterUpgradeSettings(character).cdrValue });
}

function describeUpgradeLine(line) {
    if (!line || line.stat === 'other') return 'junk';
    if (line.stat === 'cdr') return `CDR ${line.value}s`;
    const label = (UpgradeEngine.LINE_LABELS[line.stat] || line.stat).replace(/ %$/, '');
    return `${label} ${line.value}${/%$/.test(line.stat) ? '%' : line.stat === 'cdr' ? 's' : ''}`;
}

function renderUpgradeInventory(character, build) {
    const E = UpgradeEngine;
    const stats = upgradeStatsFor(character, build);
    const valued = !!E.damageIndex(stats);
    const items = build.items || {};
    const slots = [...E.STANDARD_SLOTS, ...Object.keys(items).filter(k => !E.STANDARD_SLOTS.includes(k))];
    const mode = getUpgradeEditMode(build);
    const fmtPct = v => (valued ? `+${v.toFixed(2)}%` : '—');

    const rows = slots.map(slot => {
        const it = items[slot];
        const open = upgradeEditSlot === slot;
        if (!it) {
            return `<tr class="upg-row ${open ? 'upg-open' : ''}" onclick="selectUpgradeSlot('${slot}')">
                    <td>${slot}</td><td class="upg-sub" colspan="8">empty · click to add</td></tr>
                ${open ? `<tr class="upg-editor-row"><td colspan="9">${renderUpgradeItemEditor(character, build, slot, E.newItem(slot))}</td></tr>` : ''}`;
        }
        const lines = (it.potLines || []).length ? it.potLines.map(describeUpgradeLine).join(' / ') : '—';
        const potWorth = upgradeLinesWorth(stats, E.linesDelta(it.potLines || [], build.className, getCharLevel(character)));
        const flameWorth = upgradeLinesWorth(stats, E.flameDelta(it.flames, build.className));
        const score = E.flameScore(it.flames, build.className);
        return `<tr class="upg-row ${open ? 'upg-open' : ''} ${it.locked ? 'upg-locked' : ''}" onclick="selectUpgradeSlot('${slot}')">
                <td>${slot}</td>
                <td>${sanitizeInput(it.name || '(unnamed)')}<span class="upg-sub">${sanitizeInput(it.set || '')} · Lv ${it.level || '?'}</span></td>
                <td>${it.sfKind === 'ordinary' ? `${it.stars}★` : it.stars ? `${it.stars}★ fixed` : '—'}</td>
                <td><span class="upg-tier upg-tier-${it.potTier}">${it.potTier}</span></td>
                <td>${sanitizeInput(lines)}</td>
                <td class="upg-gain">${(it.potLines || []).length ? fmtPct(potWorth) : ''}</td>
                <td>${score || ''}</td>
                <td class="upg-gain">${score ? fmtPct(flameWorth) : ''}</td>
                <td>${it.locked ? 'skip' : ''}</td>
            </tr>
            ${open ? `<tr class="upg-editor-row"><td colspan="9">${renderUpgradeItemEditor(character, build, slot, it)}</td></tr>` : ''}`;
    }).join('');

    return `
        <div class="upg-card">
            <div class="upg-plan-head">
                <h3>Gear</h3>
                <div class="upg-filters" title="Whether edits change the stat sheet">
                    <button class="upg-filter ${mode === 'upgrade' ? 'active' : ''}" onclick="setUpgradeEditMode('upgrade')">Edits are upgrades I made</button>
                    <button class="upg-filter ${mode === 'describe' ? 'active' : ''}" onclick="setUpgradeEditMode('describe')">Edits describe gear I wear</button>
                </div>
            </div>
            <p class="upg-note">${mode === 'upgrade'
                ? 'Each edit moves the stat sheet by the difference, so recording a new cube roll or flame updates your damage.'
                : 'Edits leave the stat sheet alone: use this while entering gear the stat window already includes.'}
                The Worth columns are the final damage each potential or flame gives now (what you would lose without it).
                Click a row to edit it.</p>
            ${build.statsStale ? `<div class="upg-stale"><span>An item was swapped or removed. Base stats and set effects changed in ways
                the tracker does not model, so re-read the stat sheet from the game.</span>
                <button class="prog-reset" onclick="clearUpgradeStatsStale()">Dismiss</button></div>` : ''}
            <div class="prog-table-wrap">
                <table class="prog-table upg-table">
                    <thead><tr>
                        <th>Slot</th><th>Item</th><th>★</th><th>Tier</th><th>Potential</th><th>Worth</th>
                        <th>Flame score</th><th>Worth</th><th></th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}

function renderUpgradeItemEditor(character, build, slot, it) {
    const E = UpgradeEngine;
    const cs = E.classStats(build.className);
    const stats = upgradeStatsFor(character, build);
    const valued = !!E.damageIndex(stats);
    const exists = !!(build.items && build.items[slot]);
    const catalog = E.GEAR_CATALOG.map((g, i) => ({ g, i })).filter(({ g }) => g.slot === slot);
    const lineCount = it.lineCount || 3;
    const tiers = ['none', 'rare', 'epic', 'unique', 'legendary'];
    const sets = ['None', 'Eternal', 'Arcane Umbra', 'AbsoLab', 'CRA', 'Pitched Boss', 'Brilliant Boss',
        'Dawn Boss', 'Superior Gollux', 'Boss Accessory'];
    const inCatalog = catalog.some(({ g }) => g.name === it.name);

    const pick = `
        <div class="prog-field prog-field-wide">
            <label>Item</label>
            <select onchange="pickUpgradeCatalogItem('${slot}', this.value)">
                <option value="">${inCatalog ? 'Change item…' : sanitizeInput(it.name || 'Pick an item…')}</option>
                ${catalog.map(({ g, i }) => `<option value="${i}" ${g.name === it.name ? 'selected' : ''}>${sanitizeInput(g.name)} (Lv ${g.level})</option>`).join('')}
            </select>
        </div>`;
    if (!exists) {
        return `<div class="upg-editor" onclick="event.stopPropagation()">
            <div class="prog-setup">${pick}
                <div class="prog-field"><label>&nbsp;</label>
                    <button class="save-btn" onclick="setUpgradeItemField('${slot}', 'name', 'Custom item')">Add a custom item</button>
                </div>
            </div></div>`;
    }

    const lineRows = [];
    for (let i = 0; i < lineCount; i++) {
        const line = (it.potLines || [])[i] || { stat: 'other', value: 0 };
        const choices = E.lineStatsForSlot(slot, build.className);
        if (!choices.includes(line.stat)) choices.unshift(line.stat);
        const values = E.lineValuesFor(slot, it.level, line.stat);
        if (line.stat !== 'other' && !values.includes(line.value)) values.unshift(line.value);
        const worth = valued ? upgradeLinesWorth(stats, E.linesDelta([line], build.className, getCharLevel(character))) : 0;
        lineRows.push(`
            <div class="upg-line">
                <span class="upg-sub">Line ${i + 1}</span>
                <select onchange="setUpgradeLine('${slot}', ${i}, 'stat', this.value)">
                    ${choices.map(c => `<option value="${c}" ${c === line.stat ? 'selected' : ''}>${E.LINE_LABELS[c] || c}</option>`).join('')}
                </select>
                ${line.stat === 'other' ? '' : `
                <select onchange="setUpgradeLine('${slot}', ${i}, 'value', this.value)">
                    ${values.map(v => `<option value="${v}" ${v === line.value ? 'selected' : ''}>${v}</option>`).join('')}
                </select>`}
                <span class="upg-gain">${valued && line.stat !== 'other' ? `+${worth.toFixed(2)}%` : ''}</span>
            </div>`);
    }

    // Flame fields that matter to this class; other flame stats are kept but not shown.
    const flameFields = cs.main === 'hp'
        ? [['hp', 'HP'], [cs.sub, cs.sub.toUpperCase()], ['att', 'ATT']]
        : [[cs.main, cs.main.toUpperCase()], [cs.sub, cs.sub.toUpperCase()],
           [cs.magic ? 'matt' : 'att', cs.magic ? 'MATT' : 'ATT'], ['allStatPercent', 'All Stat %']];
    if (slot === 'weapon') flameFields.push(['bossDamagePercent', 'Boss %'], ['damagePercent', 'Damage %']);
    const flameable = E.TABLES.FLAMEABLE_SLOTS.has(slot);
    const score = E.flameScore(it.flames, build.className);
    const flameWorth = upgradeLinesWorth(stats, E.flameDelta(it.flames, build.className));

    return `
        <div class="upg-editor" onclick="event.stopPropagation()">
            <div class="prog-setup">
                ${pick}
                <div class="prog-field">
                    <label>Name</label>
                    <input type="text" value="${sanitizeInput(it.name || '')}" onchange="setUpgradeItemField('${slot}', 'name', this.value)">
                </div>
                <div class="prog-field">
                    <label>Item level</label>
                    <input type="number" value="${it.level || ''}" onchange="setUpgradeItemField('${slot}', 'level', this.value)">
                </div>
                <div class="prog-field">
                    <label>Set</label>
                    <select onchange="setUpgradeItemField('${slot}', 'set', this.value)">
                        ${[...new Set([it.set || 'None', ...sets])].map(v => `<option ${v === it.set ? 'selected' : ''}>${v}</option>`).join('')}
                    </select>
                </div>
                ${it.sfKind === 'ordinary' ? `
                <div class="prog-field">
                    <label>Stars</label>
                    <input type="number" min="0" max="30" value="${it.stars || 0}" onchange="setUpgradeItemField('${slot}', 'stars', this.value)">
                </div>
                <div class="prog-field">
                    <label>Star target (blank = default)</label>
                    <input type="number" min="0" max="30" value="${it.starCap || ''}" onchange="setUpgradeItemField('${slot}', 'starCap', this.value)">
                </div>` : ''}
                <div class="prog-field">
                    <label>Boom cost</label>
                    <input type="text" value="${it.replacementCost ? fmtMeso(it.replacementCost) : ''}" placeholder="0 = trace restore"
                           onchange="setUpgradeItemField('${slot}', 'replacementCost', this.value)">
                </div>
                ${slot === 'weapon' ? `
                <div class="prog-field">
                    <label>Base ${cs.magic ? 'MATT' : 'ATT'} (for flames)</label>
                    <input type="number" value="${(it.baseStats && (cs.magic ? it.baseStats.matt : it.baseStats.att)) || ''}"
                           onchange="setUpgradeItemField('${slot}', 'baseAtt', this.value)">
                </div>` : ''}
                <label class="upg-check"><input type="checkbox" ${it.locked ? 'checked' : ''}
                    onchange="setUpgradeItemField('${slot}', 'locked', this.checked)"> Skip in plan</label>
            </div>

            <div class="upg-editor-cols">
                <div>
                    <h4>Potential</h4>
                    <div class="upg-line">
                        <select onchange="setUpgradeItemField('${slot}', 'potTier', this.value)">
                            ${tiers.map(t => `<option ${t === it.potTier ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                        <select onchange="setUpgradeItemField('${slot}', 'lineCount', this.value)">
                            ${[3, 2].map(n => `<option value="${n}" ${n === lineCount ? 'selected' : ''}>${n} lines</option>`).join('')}
                        </select>
                    </div>
                    ${it.potTier === 'none' ? '' : lineRows.join('')}
                </div>
                <div>
                    <h4>Flames ${flameable ? `<span class="upg-sub">score ${score}${valued ? ` · worth +${flameWorth.toFixed(2)}%` : ''}</span>` : ''}</h4>
                    ${flameable ? flameFields.map(([k, label]) => `
                        <div class="upg-line">
                            <span class="upg-sub upg-flame-label">${label}</span>
                            <input class="upg-num upg-wide" type="number" value="${(it.flames && it.flames[k]) || ''}"
                                   onchange="setUpgradeFlame('${slot}', '${k}', this.value)">
                        </div>`).join('') : '<p class="upg-sub">This slot cannot be flamed.</p>'}
                </div>
            </div>
            <button class="prog-reset" onclick="removeUpgradeItem('${slot}')">Remove item</button>
        </div>`;
}

// ── Recording results from the plan ─────────────────────────────────────────

// The plan row being updated and a draft of what was hit. Nothing touches
// the item until the draft is saved.
let upgradeRecord = null;   // { key, slot, type, target, draft: { stars, potTier, potLines, flames } }

function openUpgradeRecord(key, slot, type, toStar) {
    if (upgradeRecord && upgradeRecord.key === key) { upgradeRecord = null; renderUpgradesContent(); return; }
    const character = getActiveCharacter();
    const item = character && character.upgradeBuild && character.upgradeBuild.items
        && character.upgradeBuild.items[slot];
    if (!item) return;
    const rec = (upgradeRecordRows.get(key) || {});
    const lineCount = item.lineCount || 3;
    const lines = (item.potLines || []).map(l => ({ ...l }));
    while (lines.length < lineCount) lines.push({ stat: 'other', value: 0 });
    upgradeRecord = {
        key, slot, type, rec,
        draft: {
            stars: type === 'starforce' && toStar !== undefined ? toStar : item.stars,
            potTier: type === 'cube' ? 'legendary' : item.potTier,
            potLines: lines.slice(0, lineCount),
            flames: { ...(item.flames || {}) },
        },
    };
    renderUpgradesContent();
}

function cancelUpgradeRecord() {
    upgradeRecord = null;
    renderUpgradesContent();
}

function setRecordField(field, value) {
    if (!upgradeRecord) return;
    const d = upgradeRecord.draft;
    if (field === 'stars') d.stars = Math.max(0, Math.min(30, parseInt(value, 10) || 0));
    else if (field === 'potTier') d.potTier = value;
    renderUpgradesContent();
}

function setRecordLine(index, part, value) {
    if (!upgradeRecord) return;
    const character = getActiveCharacter();
    const item = character.upgradeBuild.items[upgradeRecord.slot];
    const line = upgradeRecord.draft.potLines[index];
    if (part === 'stat') {
        const values = UpgradeEngine.lineValuesFor(item.slot, item.level, value);
        upgradeRecord.draft.potLines[index] = { stat: value, value: values.length ? values[0] : line.value };
    } else {
        line.value = parseFloat(value) || 0;
    }
    renderUpgradesContent();
}

function setRecordFlame(key, value) {
    if (!upgradeRecord) return;
    upgradeRecord.draft.flames[key] = parseFloat(value) || 0;
    renderUpgradesContent();
}

/**
 * Writes the recorded result to the item. A result is always an upgrade the
 * player made, so the stat sheet moves by the difference whatever the gear
 * editor's mode is.
 */
function saveUpgradeRecord() {
    if (!upgradeRecord) return;
    const { slot, type, draft } = upgradeRecord;
    upgradeRecord = null;
    editUpgradeItem(slot, item => {
        if (type === 'starforce') item.stars = draft.stars;
        if (type === 'cube') {
            item.potTier = draft.potTier;
            item.potLines = draft.potLines.map(l => ({ ...l }));
        }
        if (type === 'flame') {
            item.flames = { ...draft.flames };
            item.flameScore = UpgradeEngine.flameScore(item.flames, getActiveCharacter().upgradeBuild.className);
        }
    }, { forceUpgrade: true });
}

// Plan rows by key, so the recorder can read the row it was opened from.
const upgradeRecordRows = new Map();

function renderUpgradeRecorder(character, build) {
    const E = UpgradeEngine;
    const { slot, type, draft, rec } = upgradeRecord;
    const item = build.items[slot];
    if (!item) return '';
    const cls = build.className;
    const cs = E.classStats(cls);
    const stats = upgradeStatsFor(character, build);
    const pdr = characterUpgradeSettings(character).pdr;
    const charLevel = getCharLevel(character);

    // What the draft is worth against the item as it stands now.
    const after = { ...item, stars: draft.stars, potTier: draft.potTier, potLines: draft.potLines, flames: draft.flames };
    const restated = E.restatItem(stats, item, after, cls, charLevel);
    const change = (E.damageIndex(restated, pdr) / E.damageIndex(stats, pdr) - 1) * 100;
    const fmtChange = `${change >= 0 ? '+' : ''}${change.toFixed(2)}% FD`;

    let body = '', check = '';
    if (type === 'starforce') {
        body = `
            <div class="upg-line">
                <span class="upg-sub upg-flame-label">Stars now</span>
                <input class="upg-num upg-wide" type="number" min="0" max="30" value="${draft.stars}"
                       onchange="setRecordField('stars', this.value)">
                <span class="upg-sub">was ${item.stars}★. If it boomed, enter the star it was restored at.</span>
            </div>`;
    } else if (type === 'cube') {
        const unitKey = rec.unitKey || E.targetUnit(slot, cls).key;
        const unit = rec.unit || E.targetUnit(slot, cls).name;
        const base = E.applyDelta(stats, E.negateDelta(E.linesDelta(item.potLines || [], cls, charLevel)));
        const eq = E.lineEquivalent(base, unitKey, cls, charLevel, pdr);
        const score = draft.potLines.reduce((a, l) => a + eq(E.parsePotentialLine(l, cls)), 0);
        const met = rec.threshold === undefined || score + 1e-9 >= rec.threshold;
        check = `<span class="${met ? 'upg-met' : 'upg-miss'}">${Math.floor(score)}% ${unit}
            ${rec.threshold !== undefined ? (met ? `· meets ${rec.threshold}%+` : `· short of ${rec.threshold}%+`) : ''}</span>`;
        body = `
            <div class="upg-line">
                <span class="upg-sub">Tier</span>
                <select onchange="setRecordField('potTier', this.value)">
                    ${['rare', 'epic', 'unique', 'legendary'].map(t => `<option ${t === draft.potTier ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
            ${draft.potLines.map((line, i) => {
                const choices = E.lineStatsForSlot(slot, cls);
                if (!choices.includes(line.stat)) choices.unshift(line.stat);
                const values = E.lineValuesFor(slot, item.level, line.stat);
                if (line.stat !== 'other' && !values.includes(line.value)) values.unshift(line.value);
                return `
                <div class="upg-line">
                    <span class="upg-sub">Line ${i + 1}</span>
                    <select onchange="setRecordLine(${i}, 'stat', this.value)">
                        ${choices.map(c => `<option value="${c}" ${c === line.stat ? 'selected' : ''}>${E.LINE_LABELS[c] || c}</option>`).join('')}
                    </select>
                    ${line.stat === 'other' ? '' : `
                    <select onchange="setRecordLine(${i}, 'value', this.value)">
                        ${values.map(v => `<option value="${v}" ${v === line.value ? 'selected' : ''}>${v}</option>`).join('')}
                    </select>`}
                </div>`;
            }).join('')}`;
    } else if (type === 'flame') {
        const fields = cs.main === 'hp'
            ? [['hp', 'HP'], [cs.sub, cs.sub.toUpperCase()], ['att', 'ATT']]
            : [[cs.main, cs.main.toUpperCase()], [cs.sub, cs.sub.toUpperCase()],
               [cs.magic ? 'matt' : 'att', cs.magic ? 'MATT' : 'ATT'], ['allStatPercent', 'All Stat %']];
        if (slot === 'weapon') fields.push(['bossDamagePercent', 'Boss %'], ['damagePercent', 'Damage %']);
        const score = E.flameScore(draft.flames, cls);
        const met = rec.threshold === undefined || score >= rec.threshold;
        check = `<span class="${met ? 'upg-met' : 'upg-miss'}">score ${score}
            ${rec.threshold !== undefined ? (met ? `· meets ${rec.threshold}+` : `· short of ${rec.threshold}+`) : ''}</span>`;
        body = fields.map(([k, label]) => `
            <div class="upg-line">
                <span class="upg-sub upg-flame-label">${label}</span>
                <input class="upg-num upg-wide" type="number" value="${draft.flames[k] || ''}"
                       onchange="setRecordFlame('${k}', this.value)">
            </div>`).join('');
    }

    return `
        <div class="upg-recorder">
            <div class="upg-recorder-head">
                <strong>Record what ${sanitizeInput(item.name)} hit</strong>
                ${check}
                <span class="upg-sub">${fmtChange} vs now</span>
            </div>
            ${body}
            <div class="upg-recorder-actions">
                <button class="save-btn" onclick="saveUpgradeRecord()">Save result</button>
                <button class="prog-reset" onclick="cancelUpgradeRecord()">Cancel</button>
                <span class="upg-sub">Saving updates the item and moves the stat sheet by the difference.</span>
            </div>
        </div>`;
}

function renderUpgradePlan(character, build) {
    if (!build.items || !Object.keys(build.items).length) return '';
    const stats = UpgradeEngine.normalizeStats(build.stats);
    if (!UpgradeEngine.damageIndex(stats)) {
        return `<div class="upg-card upg-empty">Fill in the stat sheet to rank upgrades.</div>`;
    }
    if (!hasCachedRecommendations(character, build)) {
        // Ranking takes about a second; draw the editor first and fill this in after.
        setTimeout(() => {
            if (getActiveCharacter() !== character || activeMainTab !== 'upgrades') return;
            cachedRecommendations(character, build);
            const slot = document.getElementById('upgradePlanSlot');
            if (slot) slot.outerHTML = renderUpgradePlan(character, build);
        }, 30);
        return `<div class="upg-card upg-empty" id="upgradePlanSlot">Ranking upgrades…</div>`;
    }
    const all = cachedRecommendations(character, build);
    const counts = { starforce: 0, cube: 0, flame: 0 };
    new Set(all.map(r => `${r.type}|${r.slot}`)).forEach(k => { const t = k.split('|')[0]; counts[t] += 1; });
    const recs = upgradeTypeFilter === 'all' ? all : all.filter(r => r.type === upgradeTypeFilter);
    const { plan, nextBoss, calibrated } = buildUpgradePlan(character, recs);
    const legend = UpgradeEngine.equivalenceLegend(build, characterUpgradeSettings(character), { charLevel: getCharLevel(character) });

    const filterBtn = (type, label) => `
        <button class="upg-filter ${upgradeTypeFilter === type ? 'active' : ''}"
                onclick="setUpgradeTypeFilter('${type}')">${label}</button>`;
    const typeLabel = { starforce: 'Star Force', cube: 'Cube', flame: 'Flame' };

    return `
        <div class="upg-card" id="upgradePlanSlot">
            <div class="upg-plan-head">
                <h3>Upgrade plan</h3>
                <div class="upg-filters">
                    ${filterBtn('all', `All (${counts.starforce + counts.cube + counts.flame})`)}
                    ${filterBtn('starforce', `Star Force (${counts.starforce})`)}
                    ${filterBtn('cube', `Cubing (${counts.cube})`)}
                    ${filterBtn('flame', `Flames (${counts.flame})`)}
                </div>
            </div>
            ${legend ? `<div class="upg-legend">
                <div><strong>Reading targets.</strong> Cube targets count every line in one stat, valued for this character: ${sanitizeInput(legend.armor)}.</div>
                <div>${sanitizeInput(legend.wse)}.</div>
                <div>${sanitizeInput(legend.flame)}. Meso resets keep the better roll, so "until it beats" means reroll until the score goes up.</div>
            </div>` : ''}
            <p class="upg-note">Each row is the cheapest next step per 1% final damage, given the rows above it.
                Star force steps continue from where the plan left the item; a second cube or flame row on an
                item is the extra gain from rolling for a higher target. Filter counts are items, not rows.
                ${calibrated ? '' : ' Calibrate this character on the Progression tab to see which bosses each step unlocks.'}</p>
            <div class="prog-table-wrap">
                <table class="prog-table upg-table">
                    <thead><tr>
                        <th>#</th><th>Upgrade</th><th>Type</th><th>Expected cost</th><th>FD gain</th>
                        <th>Meso / 1% FD</th><th>Running FD</th><th>Running cost</th><th>Brings on pace</th><th></th>
                    </tr></thead>
                    <tbody>
                    ${plan.map((r, i) => {
                        const key = `${r.slot}|${r.type}|${i}`;
                        upgradeRecordRows.set(key, r);
                        const open = upgradeRecord && upgradeRecord.key === key;
                        return `
                        <tr class="${open ? 'upg-open' : ''}">
                            <td>${i + 1}</td>
                            <td>${sanitizeInput(r.label)}${r.detail ? `<div class="upg-sub">${sanitizeInput(r.detail)}</div>` : ''}
                                ${r.hits && r.hits.length ? `<div class="upg-hits">Most likely hits: ${r.hits.map(h => `<span>${sanitizeInput(h)}</span>`).join('')}</div>` : ''}</td>
                            <td><span class="upg-type upg-type-${r.type}">${typeLabel[r.type] || r.type}</span></td>
                            <td>${fmtMeso(r.cost)}</td>
                            <td class="upg-gain">+${r.fdGain.toFixed(2)}%</td>
                            <td>${fmtMeso(r.mesoPerFd)}</td>
                            <td>+${r.cumFd.toFixed(2)}%</td>
                            <td>${fmtMeso(r.cumCost)}</td>
                            <td>${r.unlocks.map(e => `<span class="upg-unlock">${sanitizeInput(e.fullName)}</span>`).join(' ')}</td>
                            <td><button class="upg-filter ${open ? 'active' : ''}"
                                        onclick="openUpgradeRecord('${key}', '${r.slot}', '${r.type}', ${r.type === 'starforce' ? r.to : 'undefined'})">Update</button></td>
                        </tr>
                        ${open ? `<tr class="upg-editor-row"><td colspan="10">${renderUpgradeRecorder(character, build)}</td></tr>` : ''}`;
                    }).join('')}
                    </tbody>
                </table>
            </div>
            ${nextBoss ? `<p class="upg-note">Next boss after these steps: <strong>${sanitizeInput(nextBoss.fullName)}</strong>
                needs +${((nextBoss.pace.damageNeeded - 1) * 100).toFixed(1)}% damage from today.</p>` : ''}
        </div>`;
}

function renderUpgradesContent() {
    const container = document.getElementById('upgradesContent');
    if (!container) return;
    const character = getActiveCharacter();
    if (!character) { container.innerHTML = ''; return; }
    if (upgradeBuildFiles === null) { upgradeBuildFiles = []; refreshUpgradeBuildFiles(); }

    const cls = getCharClass(character);
    if (character.upgradeBuild && cls && character.upgradeBuild.className !== cls) {
        character.upgradeBuild.className = cls;
    }
    const build = character.upgradeBuild || { stats: {}, items: null, className: cls };
    const files = upgradeBuildFiles || [];
    const classes = Object.keys(UpgradeEngine.CLASS_STATS).sort();
    const classPicker = `
        <div class="upg-class">
            <select onchange="setUpgradeClass(this.value)" title="Sets main stat, secondary stat and ATT or MATT">
                <option value="">Class…</option>
                ${classes.map(c => `<option ${cls === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
            <span class="upg-sub">${cls ? UpgradeEngine.describeClass(cls)
                : 'Pick a class so lines and stats match the character'}</span>
            <label class="upg-check" title="Untick for classes that do not use a cooldown hat; CDR lines are then worth nothing">
                <input type="checkbox" ${character.usesCdrHat !== false ? 'checked' : ''}
                       onchange="setUpgradeUsesCdr(this.checked)"> Uses a cooldown hat
            </label>
        </div>`;
    const source = character.upgradeBuild
        ? `${sanitizeInput(character.upgradeBuild.file || character.upgradeBuild.source)}
           ${character.upgradeBuild.importedAt ? ` · imported ${character.upgradeBuild.importedAt.slice(0, 10)}` : ''}`
        : 'nothing imported yet';

    container.innerHTML = `
        <div class="upg-wrap">
            <div class="upg-card upg-import">
                <div>
                    <strong>${sanitizeInput(character.name)}</strong>
                    <span class="upg-sub">${source}</span>
                    ${classPicker}
                </div>
                <div class="upg-import-controls">
                    <select id="upgradeBuildSelect">
                        ${files.length ? files.map(f => `<option value="${sanitizeInput(f.file)}"
                            ${character.upgradeBuild && character.upgradeBuild.file === f.file ? 'selected' : ''}>${sanitizeInput(f.file)}</option>`).join('')
                            : `<option value="">${upgradeBuildFilesProblem ? 'builds/ unavailable' : 'builds/ is empty'}</option>`}
                    </select>
                    <button class="save-btn" onclick="importUpgradeBuildFromFolder(document.getElementById('upgradeBuildSelect').value)"
                            ${files.length ? '' : 'disabled'}>Import from builds/</button>
                    <button class="copy-character-btn" onclick="refreshUpgradeBuildFiles()">↻</button>
                    <button class="import-btn" onclick="document.getElementById('upgradeBuildFolder').click()"
                            title="Pick the builds folder; works without the local server">Open builds folder…</button>
                    <input type="file" id="upgradeBuildFolder" webkitdirectory multiple style="display:none"
                           onchange="pickUpgradeBuildFolder(event)">
                    <button class="import-btn" onclick="document.getElementById('upgradeBuildFile').click()">Open file…</button>
                    ${character.upgradeBuild ? '' : '<button class="add-character-btn" onclick="startBlankUpgradeBuild()">Enter gear by hand</button>'}
                    <input type="file" id="upgradeBuildFile" accept=".json" style="display:none"
                           onchange="importUpgradeBuildFromFile(event)">
                </div>
                ${upgradeBuildFilesProblem ? `<div class="upg-stale upg-wide-note"><span>${upgradeBuildFilesProblem === 'file'
                    ? 'This page was opened as a file, which cannot list the builds/ folder (or read and write saves/).'
                    : 'This page is not served by the tracker\'s own server, so the builds/ folder cannot be listed.'}
                    Use <strong>Open builds folder…</strong> and pick the project's builds folder instead,
                    or run <code>npm start</code> and open <code>http://127.0.0.1:8777</code>.</span></div>` : ''}
            </div>
            ${renderUpgradePlan(character, build)}
            ${renderUpgradeStats(character, build)}
            ${renderUpgradeInventory(character, build)}
            ${renderUpgradeSettings()}
        </div>`;
}
