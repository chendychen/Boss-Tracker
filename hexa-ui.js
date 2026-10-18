/**
 * HEXA tab: each character's HEXA node levels against its class's
 * progression order from MapleTools' Hexa Matrix Guide, with the next step,
 * its Sol Erda and fragment cost, and what is left. Erel Light and Sia
 * Astelle, whose boards work differently, follow community sheet plans and
 * are tracked by steps completed.
 */

// builds/hexa-orders.json once loaded: null (not yet), 'loading', 'missing',
// 'error', or the data.
let hexaData = null;
let hexaError = '';
let hexaShowAllSteps = false;

async function loadHexaData() {
    hexaData = 'loading';
    try {
        const res = await fetch('builds/hexa-orders.json', { cache: 'no-store' });
        hexaData = res.ok ? await res.json() : 'missing';
    } catch (e) {
        hexaData = 'missing';
    }
    if (activeMainTab === 'hexa') renderHexaContent();
}

/** Asks the local server to fetch the orders from MapleTools again, then the roster's icons. */
async function refreshHexaOrders() {
    hexaData = 'loading';
    hexaError = '';
    renderHexaContent();
    try {
        const res = await fetch('api/hexa-orders', { method: 'POST' });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        await loadHexaData();
        const classes = [...new Set(characters.map(hexaGuide).filter(g => g && !g.plan).map(g => g.name))];
        if (classes.length) {
            await fetch('api/hexa-icons', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classes }) });
        }
    } catch (e) {
        hexaError = location.protocol.startsWith('http')
            ? `Could not fetch from MapleTools: ${e.message}`
            : 'Fetching needs the local server: run npm start and open the tracker from it.';
    }
    await loadHexaData();
}

/**
 * A node's icon, saved under builds/hexa-icons/ by the refresh (the guide's
 * own art; missing icons are simply left out).
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
        const p = guide && guide.plan ? HexaEngine.planProgress(guide.plan, char.hexaPlanDone || 0)
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

function setHexaLevel(id, value) {
    const character = getActiveCharacter();
    if (!character) return;
    const levels = { ...(character.hexaLevels || {}) };
    const v = parseInt(value, 10);
    if (Number.isFinite(v)) levels[id] = Math.max(0, Math.min(30, v)); else delete levels[id];
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
    const classes = Object.keys(UpgradeEngine.CLASS_STATS).sort();
    const head = `
        <div class="upg-card">
            <div class="upg-class">
                <select onchange="setHexaClass(this.value)">
                    <option value="">Class…</option>
                    ${classes.map(c => `<option ${cls === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
                <span class="upg-sub">${hexaData && typeof hexaData === 'object'
                    ? `Orders from MapleTools' Hexa Matrix Guide (Erel Light and Sia from community sheets), fetched ${hexaData.fetchedAt.slice(0, 10)}`
                    : 'Orders come from MapleTools\' Hexa Matrix Guide'}</span>
                <button class="sell-link" onclick="refreshHexaOrders()" ${hexaData === 'loading' ? 'disabled' : ''}>
                    ${hexaData && typeof hexaData === 'object' ? 'Refresh' : 'Fetch'} from MapleTools</button>
            </div>
            ${hexaError ? `<p class="upg-note upg-shot-error">${sanitizeInput(hexaError)}</p>` : ''}
        </div>`;

    if (hexaData === 'loading' || hexaData === null) {
        container.innerHTML = head + '<p class="upg-note">Loading HEXA orders…</p>';
        return;
    }
    if (hexaData === 'missing') {
        container.innerHTML = head + `<div class="upg-card upg-empty">No HEXA orders yet. Press <strong>Fetch from
            MapleTools</strong> to read the Hexa Matrix Guide's orders into builds/hexa-orders.json (kept on this
            computer). Or run <code>node tools/hexa-orders.mjs</code>.</div>`;
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
        <details class="upg-card" ${p.done === 0 && !Object.keys(levels).length ? 'open' : ''}>
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
                                       onchange="setHexaLevel(${n.id}, this.value)">
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
                <div class="hexa-next-name">${sanitizeInput(next.skill)}</div>
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
                <td>${sanitizeInput(s.skill)}</td>
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
