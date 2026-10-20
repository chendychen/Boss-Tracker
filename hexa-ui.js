/**
 * HEXA tab: each character's HEXA node levels against its class's
 * progression order from MapleTools' Hexa Matrix Guide, with the next step,
 * its Sol Erda and fragment cost, and what is left. Classes recorded from
 * maplebot.io (builds/hexa-maplebot.json, more current and with FD per
 * level) use that order instead. Erel Light and Sia Astelle, whose boards
 * work differently, follow community sheet plans and are tracked by steps
 * completed.
 */

// builds/hexa-orders.json once loaded: null (not yet), 'loading', 'missing',
// 'error', or the data.
let hexaData = null;
let hexaShowAllSteps = false;
// Whether the node levels section is open, once the user has opened or
// closed it; until then it starts open. Kept across re-renders so entering a
// level does not fold it away.
let hexaNodesOpen = null;
// builds/hexa-maplebot.json (orders recorded from maplebot.io), or null.
let hexaBoards = null;

async function loadHexaData() {
    hexaData = 'loading';
    const json = async path => {
        try {
            const res = await fetch(path, { cache: 'no-store' });
            return res.ok ? await res.json() : null;
        } catch (e) {
            return null;
        }
    };
    const [orders, boards] = await Promise.all([json('builds/hexa-orders.json'), json('builds/hexa-maplebot.json')]);
    hexaData = orders || 'missing';
    hexaBoards = boards;
    if (activeMainTab === 'hexa') renderHexaContent();
}

/** The character's class board recorded from maplebot.io, or null. */
function hexaBoard(character) {
    return HexaEngine.boardFor(hexaBoards, getCharClass(character));
}

/**
 * A node's icon, saved under builds/hexa-icons/ by tools/hexa-orders.mjs
 * --icons (the guide's own art; missing icons are simply left out).
 */
function hexaIcon(guideName, id) {
    const folder = String(guideName || '').toLowerCase().replace(/[^a-z]/g, '');
    const file = id === 11 ? 'hexa.webp' : id === 12 ? 'sol_janus.webp' : `${folder}/${id}.webp`;
    return `<img class="hexa-icon" src="builds/hexa-icons/${file}" alt="" loading="lazy" onerror="this.remove()">`;
}

function hexaGuide(character) {
    return hexaData && typeof hexaData === 'object' ? HexaEngine.guideClass(hexaData, getCharClass(character)) : null;
}

function renderHexaCharacterTabs() {
    const container = document.getElementById('hexaCharacterTabs');
    if (!container) return;
    container.innerHTML = characters.map(char => {
        const guide = hexaGuide(char);
        const board = hexaBoard(char);
        const p = board ? HexaEngine.boardProgress(board, hexaBoardLevels(char, board, HexaEngine.boardNodeIds(board, guide)))
            : guide && guide.plan ? HexaEngine.planProgress(guide.plan, char.hexaPlanDone || 0)
            : guide && guide.order && guide.order.length ? HexaEngine.progress(guide, char.hexaLevels || {}) : null;
        const note = p ? `${p.done}/${p.steps.length} steps` : (getCharClass(char) || 'no class');
        return `
            <div class="character-tab ${char.id === activeCharacterId ? 'active' : ''}"
                 onclick="switchCharacter(${char.id})">
                <div class="character-tab-name">${sanitizeInput(char.name)}</div>
                <div class="character-tab-total">${sanitizeInput(note)}</div>
            </div>`;
    }).join('');
}

function setHexaClass(value) {
    const character = getActiveCharacter();
    if (!character) return;
    character.className = value || null;
    if (character.upgradeBuild) character.upgradeBuild.className = character.className;
    saveToLocalStorage();
    renderHexaCharacterTabs();
    renderHexaContent();
}

/**
 * A node's level, keyed by the guide's node id or (maplebot boards) the
 * node's name, held within the node's own cap (30, or 3 for HEXA Stat).
 */
function setHexaLevel(id, value, max = 30) {
    const character = getActiveCharacter();
    if (!character) return;
    const levels = { ...(character.hexaLevels || {}) };
    const v = parseInt(value, 10);
    if (Number.isFinite(v)) levels[id] = Math.max(0, Math.min(max, v)); else delete levels[id];
    character.hexaLevels = levels;
    saveToLocalStorage();
    renderHexaCharacterTabs();
    renderHexaContent();
}

function setHexaIncome(field, value) {
    const character = getActiveCharacter();
    if (!character) return;
    const v = parseFloat(value);
    character.hexaIncome = { ...(character.hexaIncome || {}), [field]: v > 0 ? v : null };
    saveToLocalStorage();
    renderHexaContent();
}

/** Steps completed on a sheet plan (Erel Light, Sia Astelle). */
function setHexaPlanDone(n) {
    const character = getActiveCharacter();
    if (!character) return;
    character.hexaPlanDone = Math.max(0, n | 0);
    saveToLocalStorage();
    renderHexaCharacterTabs();
    renderHexaContent();
}

function toggleHexaSteps() {
    hexaShowAllSteps = !hexaShowAllSteps;
    renderHexaContent();
}

/** Weeks of income to pay erda and fragments, or null without income. */
function hexaWeeks(character, erda, frag) {
    const inc = character.hexaIncome || {};
    const parts = [];
    if (erda > 0) parts.push(inc.erda > 0 ? erda / inc.erda : Infinity);
    if (frag > 0) parts.push(inc.frag > 0 ? frag / inc.frag : Infinity);
    if (!parts.length) return 0;
    const w = Math.max(...parts);
    return isFinite(w) ? w : null;
}

function fmtWeeks(w) {
    if (w === null) return '';
    if (w === 0) return 'ready';
    return w < 1 ? `~${Math.ceil(w * 7)} days` : `~${w.toFixed(1)} weeks`;
}

function renderHexaContent() {
    const container = document.getElementById('hexaContent');
    if (!container) return;
    const character = getActiveCharacter();
    if (!character) { container.innerHTML = ''; return; }
    if (hexaData === null) { loadHexaData(); }

    const cls = getCharClass(character);
    const board = cls ? hexaBoard(character) : null;
    const planned = !board && hexaGuide(character);
    const classes = Object.keys(UpgradeEngine.CLASS_STATS).sort();
    const head = `
        <div class="upg-card">
            <div class="upg-class">
                <select onchange="setHexaClass(this.value)">
                    <option value="">Class…</option>
                    ${classes.map(c => `<option ${cls === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
                <span class="upg-sub">${board ? `Order and FD recorded from maplebot.io's HEXA tracker on ${sanitizeInput(hexaBoards.readAt || '')}`
                    : planned && planned.plan
                    ? `Plan from a community Google Sheet, fetched ${hexaData.fetchedAt.slice(0, 10)}`
                    : hexaData && typeof hexaData === 'object'
                    ? `Order from MapleTools' Hexa Matrix Guide, fetched ${hexaData.fetchedAt.slice(0, 10)}`
                    : 'Orders come from MapleTools\' Hexa Matrix Guide'}</span>
            </div>
        </div>`;

    if (hexaData === 'loading' || hexaData === null) {
        container.innerHTML = head + '<p class="upg-note">Loading HEXA orders…</p>';
        return;
    }
    if (board) { container.innerHTML = head + renderHexaBoard(character, board); return; }
    if (hexaData === 'missing') {
        container.innerHTML = head + `<div class="upg-card upg-empty">No HEXA order for this class yet. Run
            <code>node tools/hexa-orders.mjs</code> to read MapleTools' Hexa Matrix Guide into
            builds/hexa-orders.json (kept on this computer).</div>`;
        return;
    }
    const guide = hexaGuide(character);
    if (!cls) { container.innerHTML = head + '<div class="upg-card upg-empty">Pick the character\'s class above.</div>'; return; }
    if (!guide) {
        container.innerHTML = head + `<div class="upg-card upg-empty">MapleTools has no HEXA guide for ${sanitizeInput(cls)}.</div>`;
        return;
    }

    if (guide.plan) { container.innerHTML = head + renderHexaPlan(character, guide); return; }

    const levels = character.hexaLevels || {};
    const nodes = HexaEngine.nodesFor(guide);
    const p = HexaEngine.progress(guide, levels);
    const levelOf = n => (levels[n.id] !== undefined ? levels[n.id] : n.start);

    // Node levels, grouped like the in-game matrix.
    const groups = [...new Set(nodes.map(n => n.group))];
    const nodeCard = `
        <details class="upg-card" ${hexaNodesOpen !== false ? 'open' : ''} ontoggle="hexaNodesOpen = this.open">
            <summary>Node levels <span class="upg-sub">${sanitizeInput(guide.name)}</span></summary>
            <div class="hexa-nodes">
                ${groups.map(g => `
                    <div class="hexa-group">
                        <h4>${g}</h4>
                        ${nodes.filter(n => n.group === g).map(n => `
                            <label class="hexa-node">
                                <span>${hexaIcon(guide.name, n.id)}${sanitizeInput(n.name)}</span>
                                <input type="number" min="0" max="${n.max}" value="${levelOf(n)}"
                                       id="hexa-level-${n.id}" data-tab-group="hexa-level"
                                       onchange="setHexaLevel(${n.id}, this.value, ${n.max})">
                            </label>`).join('')}
                    </div>`).join('')}
            </div>
        </details>`;

    if (!p.steps.length) {
        container.innerHTML = head + `<div class="upg-card upg-empty">MapleTools' guide lists ${sanitizeInput(guide.name)}'s
            nodes but no progression order yet.</div>` + nodeCard;
        return;
    }

    const next = p.next;
    const nextWeeks = next ? hexaWeeks(character, next.owedErda, next.owedFrag) : 0;
    const allWeeks = hexaWeeks(character, p.owed.erda, p.owed.frag);
    const nextCard = next ? `
        <div class="upg-card hexa-next">
            <div>
                <div class="upg-sub">Next · step ${next.index + 1} of ${p.steps.length}</div>
                <div class="hexa-next-name">${hexaIcon(guide.name, next.id)}${sanitizeInput(next.node.name)} <span class="upg-sub">${next.node.type}</span></div>
                <div>Level ${Math.max(next.now, next.from)} → <strong>${next.to}</strong>
                    · ${next.owedErda} Sol Erda · ${next.owedFrag.toLocaleString()} fragments
                    ${nextWeeks ? `<span class="upg-sub">· ${fmtWeeks(nextWeeks)}</span>` : ''}</div>
            </div>
            <button class="save-btn" onclick="setHexaLevel(${next.id}, ${next.to})">Done</button>
        </div>` : `<div class="upg-card hexa-next"><strong>Order complete.</strong></div>`;

    const totals = `
        <div class="upg-card">
            <div class="hexa-totals">
                <div><span class="upg-sub">Rest of the order</span><strong>${p.owed.erda.toLocaleString()}</strong> Sol Erda ·
                    <strong>${p.owed.frag.toLocaleString()}</strong> fragments ${allWeeks ? `<span class="upg-sub">· ${fmtWeeks(allWeeks)}</span>` : ''}</div>
                <div><span class="upg-sub">Every node to max</span>${p.toMax.erda.toLocaleString()} Sol Erda ·
                    ${p.toMax.frag.toLocaleString()} fragments</div>
                <div class="hexa-income"><span class="upg-sub">Weekly income</span>
                    <input type="number" min="0" placeholder="Sol Erda" value="${(character.hexaIncome || {}).erda || ''}"
                           onchange="setHexaIncome('erda', this.value)">
                    <input type="number" min="0" placeholder="Fragments" value="${(character.hexaIncome || {}).frag || ''}"
                           onchange="setHexaIncome('frag', this.value)"></div>
            </div>
            <div class="sell-progress"><div style="width: ${(p.done / p.steps.length * 100).toFixed(1)}%"></div></div>
        </div>`;

    const upcoming = p.steps.filter(s => s.status !== 'done');
    const shown = hexaShowAllSteps ? p.steps : upcoming.slice(0, 12);
    const table = `
        <div class="upg-card">
            <div class="upg-plan-head"><div class="upg-head-title"><h3>Order</h3>
                <span class="upg-sub">${p.done} of ${p.steps.length} steps done</span></div>
                <button class="sell-link" onclick="toggleHexaSteps()">${hexaShowAllSteps ? 'Show what is left' : 'Show every step'}</button>
            </div>
            <div class="prog-table-wrap">
                <table class="prog-table upg-table hexa-table">
                    <thead><tr><th>#</th><th>Node</th><th>Type</th><th>Levels</th><th>Sol Erda</th><th>Fragments</th><th>Running fragments</th></tr></thead>
                    <tbody>
                        ${shown.map(s => `
                            <tr class="hexa-${s.status} ${next && s.index === next.index ? 'hexa-current' : ''}">
                                <td>${s.index + 1}</td>
                                <td>${hexaIcon(guide.name, s.id)}${sanitizeInput(s.node.name)}</td>
                                <td class="upg-sub">${s.node.type}</td>
                                <td>${s.from} → ${s.to}</td>
                                <td>${s.status === 'done' ? '✓' : s.owedErda}</td>
                                <td>${s.status === 'done' ? '✓' : s.owedFrag.toLocaleString()}</td>
                                <td class="upg-sub">${s.status === 'done' ? '' : s.runningFrag.toLocaleString()}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            ${!hexaShowAllSteps && upcoming.length > shown.length ? `<p class="upg-sub">${upcoming.length - shown.length} more steps after these.</p>` : ''}
        </div>`;

    container.innerHTML = head + nextCard + totals + nodeCard + table;
}

/** A board's node levels by name; levels entered against the guide's node ids carry over. */
function hexaBoardLevels(character, board, ids) {
    const saved = character.hexaLevels || {};
    const levels = {};
    for (const n of HexaEngine.boardNodes(board)) {
        if (saved[n.name] !== undefined) levels[n.name] = saved[n.name];
        else if (ids[n.name] !== undefined && saved[ids[n.name]] !== undefined) levels[n.name] = saved[ids[n.name]];
    }
    return levels;
}

/**
 * A board recorded from maplebot.io: node levels by name, the next step with
 * its FD, totals and the order. Icons are maplebot's own, saved under
 * builds/hexa-icons/maplebot/; the guide's stand in where one is missing.
 */
function renderHexaBoard(character, board) {
    const guide = hexaGuide(character);
    const ids = HexaEngine.boardNodeIds(board, guide);
    const nodes = HexaEngine.boardNodes(board);
    const iconOf = new Map(nodes.map(n => [n.name, n.icon]));
    const iconFor = name => {
        const own = iconOf.get(name);
        if (own) return `<img class="hexa-icon" src="builds/hexa-icons/maplebot/${encodeURI(own)}" alt="" loading="lazy" onerror="this.remove()">`;
        return guide && ids[name] !== undefined ? hexaIcon(guide.name, ids[name]) : '';
    };
    const levels = hexaBoardLevels(character, board, ids);
    const p = HexaEngine.boardProgress(board, levels);
    const inOrder = new Set(p.steps.map(s => s.name));
    const fdText = fd => (fd > 0 ? `+${fd.toFixed(fd < 1 ? 3 : 2)}%` : '');

    const groups = [...new Set(nodes.map(n => n.group))];
    const nodeCard = `
        <details class="upg-card" ${hexaNodesOpen !== false ? 'open' : ''} ontoggle="hexaNodesOpen = this.open">
            <summary>Node levels <span class="upg-sub">${sanitizeInput(board.name)}</span></summary>
            <div class="hexa-nodes">
                ${groups.map((g, gi) => `
                    <div class="hexa-group">
                        <h4>${sanitizeInput(g)}</h4>
                        ${nodes.filter(n => n.group === g).map((n, i) => `
                            <label class="hexa-node">
                                <span>${iconFor(n.name)}${sanitizeInput(n.name)}${inOrder.has(n.name) ? '' : ' <span class="upg-sub">(not in the order)</span>'}</span>
                                <input type="number" min="0" max="${n.max}" value="${levels[n.name] !== undefined ? levels[n.name] : n.start}"
                                       id="hexa-level-b${gi}-${i}" data-tab-group="hexa-level"
                                       data-node="${sanitizeInput(n.name)}" onchange="setHexaLevel(this.dataset.node, this.value, ${n.max})">
                            </label>`).join('')}
                    </div>`).join('')}
            </div>
        </details>`;

    const next = p.next;
    const nextWeeks = next ? hexaWeeks(character, next.owedErda, next.owedFrag) : 0;
    const allWeeks = hexaWeeks(character, p.owed.erda, p.owed.frag);
    const nextCard = next ? `
        <div class="upg-card hexa-next">
            <div>
                <div class="upg-sub">Next · step ${next.index + 1} of ${p.steps.length}</div>
                <div class="hexa-next-name">${iconFor(next.name)}${sanitizeInput(next.name)} <span class="upg-sub">${sanitizeInput(next.type)}</span></div>
                <div>Level ${Math.max(next.now, next.from)} → <strong>${next.to}</strong>
                    · ${next.owedErda} Sol Erda · ${next.owedFrag.toLocaleString()} fragments
                    ${next.owedFd > 0 ? `<span class="upg-gain">· ${fdText(next.owedFd)} FD</span>` : ''}
                    ${nextWeeks ? `<span class="upg-sub">· ${fmtWeeks(nextWeeks)}</span>` : ''}</div>
            </div>
            <button class="save-btn" data-node="${sanitizeInput(next.name)}" onclick="setHexaLevel(this.dataset.node, ${next.to})">Done</button>
        </div>` : `<div class="upg-card hexa-next"><strong>Order complete.</strong></div>`;

    const totals = `
        <div class="upg-card">
            <div class="hexa-totals">
                <div><span class="upg-sub">Rest of the order</span><strong>${p.owed.erda.toLocaleString()}</strong> Sol Erda ·
                    <strong>${p.owed.frag.toLocaleString()}</strong> fragments ${allWeeks ? `<span class="upg-sub">· ${fmtWeeks(allWeeks)}</span>` : ''}</div>
                <div><span class="upg-sub">FD from HEXA so far</span><strong>+${p.fd.toFixed(1)}%</strong>
                    <span class="upg-sub">· +${p.fdLeft.toFixed(1)}% more by the end of the order</span></div>
                <div class="hexa-income"><span class="upg-sub">Weekly income</span>
                    <input type="number" min="0" placeholder="Sol Erda" value="${(character.hexaIncome || {}).erda || ''}"
                           onchange="setHexaIncome('erda', this.value)">
                    <input type="number" min="0" placeholder="Fragments" value="${(character.hexaIncome || {}).frag || ''}"
                           onchange="setHexaIncome('frag', this.value)"></div>
            </div>
            <div class="sell-progress"><div style="width: ${(p.done / p.steps.length * 100).toFixed(1)}%"></div></div>
        </div>`;

    const upcoming = p.steps.filter(s => s.status !== 'done');
    const shown = hexaShowAllSteps ? p.steps : upcoming.slice(0, 12);
    const table = `
        <div class="upg-card">
            <div class="upg-plan-head"><div class="upg-head-title"><h3>Order</h3>
                <span class="upg-sub">${p.done} of ${p.steps.length} steps done</span></div>
                <button class="sell-link" onclick="toggleHexaSteps()">${hexaShowAllSteps ? 'Show what is left' : 'Show every step'}</button>
            </div>
            <div class="prog-table-wrap">
                <table class="prog-table upg-table hexa-table">
                    <thead><tr><th>#</th><th>Node</th><th>Type</th><th>Levels</th><th>Sol Erda</th><th>Fragments</th><th>FD</th><th>Running fragments</th></tr></thead>
                    <tbody>
                        ${shown.map(s => `
                            <tr class="hexa-${s.status} ${next && s.index === next.index ? 'hexa-current' : ''}">
                                <td>${s.index + 1}</td>
                                <td>${iconFor(s.name)}${sanitizeInput(s.name)}</td>
                                <td class="upg-sub">${sanitizeInput(s.type)}</td>
                                <td>${s.from} → ${s.to}</td>
                                <td>${s.status === 'done' ? '✓' : s.owedErda}</td>
                                <td>${s.status === 'done' ? '✓' : s.owedFrag.toLocaleString()}</td>
                                <td class="upg-gain">${fdText(s.status === 'done' ? s.fd : s.owedFd)}</td>
                                <td class="upg-sub">${s.status === 'done' ? '' : s.runningFrag.toLocaleString()}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            ${!hexaShowAllSteps && upcoming.length > shown.length ? `<p class="upg-sub">${upcoming.length - shown.length} more steps after these.</p>` : ''}
            <p class="upg-sub">Order and FD from <a href="https://maplebot.io/tools/hexa-tracker" target="_blank" rel="noopener">maplebot.io's
                HEXA tracker</a>, recorded ${sanitizeInput(hexaBoards.readAt || '')}. Each step's FD is on top of the steps before it.</p>
        </div>`;

    return nextCard + totals + nodeCard + table;
}

/**
 * A sheet plan step's icon: maplebot's, for classes whose plan steps have one
 * (builds/hexa-maplebot.json planIcons, keyed by the sheet's step names
 * without a "(2)" suffix). Stat stones and Shinestones have none.
 */
function hexaPlanIcon(character, skill) {
    const icons = hexaBoards && hexaBoards.planIcons && hexaBoards.planIcons[getCharClass(character)];
    const file = icons && icons[String(skill).replace(/\s*\(\d+\)$/, '')];
    return file ? `<img class="hexa-icon" src="builds/hexa-icons/maplebot/${encodeURI(file)}" alt="" loading="lazy" onerror="this.remove()">` : '';
}

/** A sheet plan (Erel Light, Sia Astelle): the next step, totals and the steps by goal. */
function renderHexaPlan(character, guide) {
    const plan = guide.plan;
    const p = HexaEngine.planProgress(plan, character.hexaPlanDone || 0);
    const next = p.next;
    const levelsText = s => (s.to === null ? 'stone' : `${s.from} → ${s.to}`);
    const nextWeeks = next ? hexaWeeks(character, next.erda, next.frag) : 0;
    const allWeeks = hexaWeeks(character, p.owed.erda, p.owed.frag);
    const reached = Object.entries(p.levels);

    const nextCard = next ? `
        <div class="upg-card hexa-next">
            <div>
                <div class="upg-sub">Next · step ${next.index + 1} of ${p.steps.length} · ${sanitizeInput(next.goal)}</div>
                <div class="hexa-next-name">${hexaPlanIcon(character, next.skill)}${sanitizeInput(next.skill)}</div>
                <div>${next.to === null ? 'Stone' : `Level ${next.from} → <strong>${next.to}</strong>`}
                    · ${next.erda} Sol Erda · ${next.frag.toLocaleString()} fragments${/shinestone/i.test(next.skill) ? ' (expected)' : ''}
                    ${next.fd ? `<span class="upg-gain">· +${next.fd.toFixed(2)}% FD</span>` : ''}
                    ${nextWeeks ? `<span class="upg-sub">· ${fmtWeeks(nextWeeks)}</span>` : ''}</div>
            </div>
            <div class="upg-line">
                ${p.done ? `<button class="sell-link" onclick="setHexaPlanDone(${p.done - 1})">Undo last</button>` : ''}
                <button class="save-btn" onclick="setHexaPlanDone(${p.done + 1})">Done</button>
            </div>
        </div>` : `<div class="upg-card hexa-next"><strong>Plan complete.</strong>
            ${p.done ? `<button class="sell-link" onclick="setHexaPlanDone(${p.done - 1})">Undo last</button>` : ''}</div>`;

    const totals = `
        <div class="upg-card">
            <div class="hexa-totals">
                <div><span class="upg-sub">Rest of the plan</span><strong>${p.owed.erda.toLocaleString()}</strong> Sol Erda ·
                    <strong>${p.owed.frag.toLocaleString()}</strong> fragments ${allWeeks ? `<span class="upg-sub">· ${fmtWeeks(allWeeks)}</span>` : ''}</div>
                <div><span class="upg-sub">Gained so far (sheet's estimate)</span>+${p.fd.toFixed(1)}% FD</div>
                <div class="hexa-income"><span class="upg-sub">Weekly income</span>
                    <input type="number" min="0" placeholder="Sol Erda" value="${(character.hexaIncome || {}).erda || ''}"
                           onchange="setHexaIncome('erda', this.value)">
                    <input type="number" min="0" placeholder="Fragments" value="${(character.hexaIncome || {}).frag || ''}"
                           onchange="setHexaIncome('frag', this.value)"></div>
            </div>
            <div class="sell-progress"><div style="width: ${(p.done / p.steps.length * 100).toFixed(1)}%"></div></div>
            ${reached.length ? `<p class="upg-sub">Reached: ${reached.map(([k, v]) => `${sanitizeInput(k)} ${v}`).join(' · ')}</p>` : ''}
        </div>`;

    const shown = hexaShowAllSteps ? p.steps : p.steps.filter(s => s.status !== 'done').slice(0, 15);
    let lastGoal = null;
    const rows = shown.map(s => {
        const goalRow = s.goal !== lastGoal ? `<tr class="hexa-goal"><td colspan="7">${sanitizeInput(s.goal)}</td></tr>` : '';
        lastGoal = s.goal;
        return goalRow + `
            <tr class="hexa-${s.status} ${next && s.index === next.index ? 'hexa-current' : ''}">
                <td>${s.index + 1}</td>
                <td>${hexaPlanIcon(character, s.skill)}${sanitizeInput(s.skill)}</td>
                <td>${levelsText(s)}</td>
                <td>${s.status === 'done' ? '✓' : s.erda}</td>
                <td>${s.status === 'done' ? '✓' : s.frag.toLocaleString()}</td>
                <td class="upg-gain">${s.fd ? `+${s.fd.toFixed(2)}%` : ''}</td>
                <td class="upg-sub">${s.status === 'done' ? '' : s.runningFrag.toLocaleString()}</td>
            </tr>`;
    }).join('');
    const remaining = p.steps.length - p.done;
    const table = `
        <div class="upg-card">
            <div class="upg-plan-head"><div class="upg-head-title"><h3>Plan</h3>
                <span class="upg-sub">${p.done} of ${p.steps.length} steps done</span></div>
                <button class="sell-link" onclick="toggleHexaSteps()">${hexaShowAllSteps ? 'Show what is left' : 'Show every step'}</button>
            </div>
            <div class="prog-table-wrap">
                <table class="prog-table upg-table hexa-table">
                    <thead><tr><th>#</th><th>Skill or stone</th><th>Levels</th><th>Sol Erda</th><th>Fragments</th><th>FD</th><th>Running fragments</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${!hexaShowAllSteps && remaining > shown.length ? `<p class="upg-sub">${remaining - shown.length} more steps after these.</p>` : ''}
            <p class="upg-sub">Plan by ${sanitizeInput(plan.credits.replace(/^Credits:\s*/i, ''))} ·
                <a href="${plan.source}" target="_blank" rel="noopener">the sheet</a>. Fragment-oriented: for erda-gated
                characters the sheet suggests favouring 1-erda stat stones and the free split-stone levels.</p>
        </div>`;

    return nextCard + totals + table;
}
