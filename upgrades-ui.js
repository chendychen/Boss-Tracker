// Upgrades tab: per-character gear inventory, stat sheet, pricing settings,
// and the ranked upgrade plan with the bosses each step brings on pace.
//
// Loaded before boss-tracker.js; everything here reads that file's globals
// (characters, getActiveCharacter, saveToLocalStorage, upgradeSettings, the
// Progression model) only when called, never at load time.

let upgradeBuildFiles = null;        // listing of builds/ from the local server
let upgradeTypeFilter = 'all';       // all | starforce | cube | flame
const UPGRADE_PLAN_ROWS = 25;

const UPGRADE_STAT_FIELDS = [
    ['mainBase', 'Main stat (base)'], ['mainPct', 'Main stat %'], ['mainFlat', 'Main stat (flat)'],
    ['subBase', 'Secondary (base)'], ['subPct', 'Secondary %'], ['subFlat', 'Secondary (flat)'],
    ['att', 'ATT / MATT'], ['attPct', 'ATT %'], ['dmg', 'Damage %'], ['boss', 'Boss damage %'],
    ['critDmg', 'Crit damage %'], ['ied', 'IED %'],
];

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
        const note = build && build.items ? `${Object.keys(build.items).length} items`
            : build ? 'stats only' : 'no build';
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
    if (!location.protocol.startsWith('http')) { upgradeBuildFiles = []; return; }
    try {
        const res = await fetch('api/builds', { cache: 'no-store' });
        upgradeBuildFiles = res.ok ? (await res.json()).builds || [] : [];
    } catch (e) {
        upgradeBuildFiles = [];
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

    character.upgradeBuild = {
        ...(current || {}),
        source: imported.source,
        file: label,
        importedAt: new Date().toISOString(),
        ign: imported.ign || (current && current.ign) || null,
        className: imported.className || (current && current.className) || null,
        stats: imported.stats,
        items: imported.items || (current && current.items) || null,
    };
    if (imported.level && !character.charLevel) character.charLevel = imported.level;
    saveToLocalStorage();
    renderUpgradesCharacterTabs();
    renderUpgradesContent();
}

async function importUpgradeBuildFromFolder(file) {
    if (!file) return;
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
        character.upgradeBuild = { source: 'manual', stats: UpgradeEngine.normalizeStats({}), items: {} };
    }
    return character.upgradeBuild;
}

function setUpgradeClass(value) {
    const character = getActiveCharacter();
    if (!character) return;
    ensureUpgradeBuild(character).className = value || null;
    saveToLocalStorage();
    renderUpgradesContent();
}

function setUpgradeStat(field, value) {
    const character = getActiveCharacter();
    if (!character) return;
    const build = ensureUpgradeBuild(character);
    build.stats = { ...UpgradeEngine.normalizeStats(build.stats), [field]: parseFloat(value) || 0 };
    saveToLocalStorage();
    renderUpgradesContent();
}

function setUpgradeItemField(slot, field, value) {
    const character = getActiveCharacter();
    const item = character && character.upgradeBuild && character.upgradeBuild.items
        && character.upgradeBuild.items[slot];
    if (!item) return;
    if (field === 'locked') item.locked = !!value;
    else if (field === 'potLines') item.potLines = String(value).split('/').map(s => s.trim()).filter(Boolean);
    else if (field === 'potTier') item.potTier = value;
    else item[field] = parseFloat(value) || 0;
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

function cachedRecommendations(character, build) {
    const key = JSON.stringify([character.id, build.stats, build.items, build.className,
        upgradeSettings, getCharLevel(character)]);
    const hit = upgradeRecCache.get(character.id);
    if (hit && hit.key === key) return hit.recs;
    const recs = UpgradeEngine.recommend(build, upgradeSettings, { charLevel: getCharLevel(character) });
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
    const classes = Object.keys(UpgradeEngine.CLASS_STATS).sort();
    return `
        <details class="upg-card" ${build.items && Object.keys(build.items).length ? '' : 'open'}>
            <summary>Stat sheet${build.className ? ` · ${sanitizeInput(build.className)}` : ''}</summary>
            <p class="upg-note">Values from the in-game stat window with your usual bossing buffs.
                Only ratios matter, so small errors shift every upgrade alike.</p>
            <div class="prog-setup">
                <div class="prog-field">
                    <label>Class</label>
                    <select onchange="setUpgradeClass(this.value)">
                        <option value="">—</option>
                        ${classes.map(c => `<option ${build.className === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                ${UPGRADE_STAT_FIELDS.map(([k, label]) => `
                    <div class="prog-field">
                        <label>${label}</label>
                        <input type="number" step="any" value="${stats[k] || ''}"
                               onchange="setUpgradeStat('${k}', this.value)">
                    </div>`).join('')}
            </div>
        </details>`;
}

function renderUpgradeInventory(character, build) {
    const items = Object.values(build.items || {})
        .sort((a, b) => upgradeSlotRank(a.slot) - upgradeSlotRank(b.slot));
    if (!items.length) {
        return `<div class="upg-card upg-empty">No gear yet. Import a build file from the GMS Upgrade Tracker
            (Gear page → Import / Export → Save this build to a file) into the <code>builds/</code> folder.</div>`;
    }
    const tiers = ['none', 'rare', 'epic', 'unique', 'legendary'];
    return `
        <details class="upg-card">
            <summary>Inventory · ${items.length} items</summary>
            <div class="prog-table-wrap">
                <table class="prog-table upg-table">
                    <thead><tr>
                        <th>Slot</th><th>Item</th><th>Lv</th><th>★</th><th>Cap</th>
                        <th>Potential</th><th>Lines (a / b / c)</th><th>Flame</th><th>Boom cost</th><th>Skip</th>
                    </tr></thead>
                    <tbody>
                    ${items.map(it => `
                        <tr class="${it.locked ? 'upg-locked' : ''}">
                            <td>${sanitizeInput(it.slot)}</td>
                            <td>${sanitizeInput(it.name)}<div class="upg-sub">${sanitizeInput(it.set || '')}</div></td>
                            <td>${it.level || ''}</td>
                            <td><input class="upg-num" type="number" min="0" max="30" value="${it.stars}"
                                       onchange="setUpgradeItemField('${it.slot}', 'stars', this.value)"></td>
                            <td><input class="upg-num" type="number" min="0" max="30" value="${it.starCap || ''}"
                                       onchange="setUpgradeItemField('${it.slot}', 'starCap', this.value)"></td>
                            <td><select onchange="setUpgradeItemField('${it.slot}', 'potTier', this.value)">
                                ${tiers.map(t => `<option ${it.potTier === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select></td>
                            <td><input class="upg-lines" type="text" value="${sanitizeInput((it.potLines || []).join(' / '))}"
                                       onchange="setUpgradeItemField('${it.slot}', 'potLines', this.value)"></td>
                            <td>${it.flameScore || ''}</td>
                            <td><input class="upg-num upg-wide" type="text" value="${it.replacementCost ? fmtMeso(it.replacementCost) : ''}"
                                       placeholder="trace" onchange="setUpgradeItemField('${it.slot}', 'replacementCost', UpgradeEngine.parseMeso(this.value, 0))"></td>
                            <td><input type="checkbox" ${it.locked ? 'checked' : ''}
                                       onchange="setUpgradeItemField('${it.slot}', 'locked', this.checked)"></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </details>`;
}

function renderUpgradePlan(character, build) {
    if (!build.items || !Object.keys(build.items).length) return '';
    const stats = UpgradeEngine.normalizeStats(build.stats);
    if (!UpgradeEngine.damageIndex(stats)) {
        return `<div class="upg-card upg-empty">Fill in the stat sheet to rank upgrades.</div>`;
    }
    const all = cachedRecommendations(character, build);
    const counts = { starforce: 0, cube: 0, flame: 0 };
    new Set(all.map(r => `${r.type}|${r.slot}`)).forEach(k => { const t = k.split('|')[0]; counts[t] += 1; });
    const recs = upgradeTypeFilter === 'all' ? all : all.filter(r => r.type === upgradeTypeFilter);
    const { plan, nextBoss, calibrated } = buildUpgradePlan(character, recs);

    const filterBtn = (type, label) => `
        <button class="upg-filter ${upgradeTypeFilter === type ? 'active' : ''}"
                onclick="setUpgradeTypeFilter('${type}')">${label}</button>`;
    const typeLabel = { starforce: 'Star Force', cube: 'Cube', flame: 'Flame' };

    return `
        <div class="upg-card">
            <div class="upg-plan-head">
                <h3>Upgrade plan</h3>
                <div class="upg-filters">
                    ${filterBtn('all', `All (${counts.starforce + counts.cube + counts.flame})`)}
                    ${filterBtn('starforce', `Star Force (${counts.starforce})`)}
                    ${filterBtn('cube', `Cubing (${counts.cube})`)}
                    ${filterBtn('flame', `Flames (${counts.flame})`)}
                </div>
            </div>
            <p class="upg-note">Each row is the cheapest next step per 1% final damage, given the rows above it.
                Star force steps continue from where the plan left the item; a second cube or flame row on an
                item is the extra gain from rolling for a higher target. Filter counts are items, not rows.
                ${calibrated ? '' : ' Calibrate this character on the Progression tab to see which bosses each step unlocks.'}</p>
            <div class="prog-table-wrap">
                <table class="prog-table upg-table">
                    <thead><tr>
                        <th>#</th><th>Upgrade</th><th>Type</th><th>Expected cost</th><th>FD gain</th>
                        <th>Meso / 1% FD</th><th>Running FD</th><th>Running cost</th><th>Brings on pace</th>
                    </tr></thead>
                    <tbody>
                    ${plan.map((r, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td>${sanitizeInput(r.label)}${r.detail ? `<div class="upg-sub">${sanitizeInput(r.detail)}</div>` : ''}</td>
                            <td><span class="upg-type upg-type-${r.type}">${typeLabel[r.type] || r.type}</span></td>
                            <td>${fmtMeso(r.cost)}</td>
                            <td class="upg-gain">+${r.fdGain.toFixed(2)}%</td>
                            <td>${fmtMeso(r.mesoPerFd)}</td>
                            <td>+${r.cumFd.toFixed(2)}%</td>
                            <td>${fmtMeso(r.cumCost)}</td>
                            <td>${r.unlocks.map(e => `<span class="upg-unlock">${sanitizeInput(e.fullName)}</span>`).join(' ')}</td>
                        </tr>`).join('')}
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

    const build = character.upgradeBuild || { stats: {}, items: null };
    const files = upgradeBuildFiles || [];
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
                </div>
                <div class="upg-import-controls">
                    <select id="upgradeBuildSelect">
                        ${files.length ? files.map(f => `<option value="${sanitizeInput(f.file)}"
                            ${character.upgradeBuild && character.upgradeBuild.file === f.file ? 'selected' : ''}>${sanitizeInput(f.file)}</option>`).join('')
                            : '<option value="">builds/ is empty</option>'}
                    </select>
                    <button class="save-btn" onclick="importUpgradeBuildFromFolder(document.getElementById('upgradeBuildSelect').value)"
                            ${files.length ? '' : 'disabled'}>Import from builds/</button>
                    <button class="copy-character-btn" onclick="refreshUpgradeBuildFiles()">↻</button>
                    <button class="import-btn" onclick="document.getElementById('upgradeBuildFile').click()">Open file…</button>
                    <input type="file" id="upgradeBuildFile" accept=".json" style="display:none"
                           onchange="importUpgradeBuildFromFile(event)">
                </div>
            </div>
            ${renderUpgradePlan(character, build)}
            ${renderUpgradeStats(character, build)}
            ${renderUpgradeInventory(character, build)}
            ${renderUpgradeSettings()}
        </div>`;
}
