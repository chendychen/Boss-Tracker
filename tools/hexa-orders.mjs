#!/usr/bin/env node
// Fetches the HEXA progression orders shown on MapleTools' Hexa Matrix Guide
// (https://mapletools.app/tools/hexamatrix) into builds/hexa-orders.json, for
// the tracker's HEXA tab.
//
// The orders and each class's nodes ship inside the guide page's public
// script; this reads that script once, on demand, and never the site's /api/
// (which its robots.txt disallows). MapleTools allows personal, non-commercial
// use; the file lands in builds/, which is gitignored, so it stays local.
//
//   node tools/hexa-orders.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'builds', 'hexa-orders.json');
const SITE = 'https://mapletools.app';
const GUIDE_PAGE = `${SITE}/tools/hexamatrix/pathfinder`;
const HEADERS = { 'User-Agent': 'BossTracker (personal, local)', Accept: 'text/html,application/javascript' };
const MAX_SCRIPTS = 40;

// The guide's own renames for orders filed under a short class name.
const ORDER_ALIASES = {
    'Arch Mage (I/L)': 'Arch Mage (Ice, Lightning)',
    'Arch Mage (F/P)': 'Arch Mage (Fire, Poison)',
    'Fire Poison (F/P)': 'Arch Mage (Fire, Poison)',
    'Blade Master': 'Dual Blade',
};

const letters = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * Pulls the class nodes and orders out of the guide's script text, by
 * pattern only (nothing from the site is evaluated). Returns
 * { classes: { name: { origin, ascent, mastery[], boost[], common[], order[[node, level]] } } }.
 */
export function parseHexaScript(js) {
    const classes = {};
    // Skill names can hold brackets ("Xuanshan Arts [Tian]"), so arrays are
    // matched string by string.
    const str = String.raw`"(?:[^"\\]|\\.)*"`;
    const arr = String.raw`\[(?:${str},?)*\]`;
    const nodeRe = new RegExp(String.raw`(?:"([^"]+)"|([A-Za-z][A-Za-z ]*)):\{ascentSkill:(${str}),boostSkills:(${arr}),commonSkills:(${arr}),masterySkills:(${arr}),originSkill:(${str})\}`, 'g');
    for (const m of js.matchAll(nodeRe)) {
        const name = m[1] || m[2];
        classes[name] = {
            origin: JSON.parse(m[7]),
            ascent: JSON.parse(m[3]),
            mastery: JSON.parse(m[6]),
            boost: JSON.parse(m[4]),
            common: JSON.parse(m[5]),
            order: [],
        };
    }
    const orderRe = /\{class:"([^"]+)",order:(\[\[[0-9,[\]]*\]\])\}/g;
    for (const m of js.matchAll(orderRe)) {
        let name = ORDER_ALIASES[m[1]] || m[1];
        if (!classes[name]) name = Object.keys(classes).find(k => letters(k) === letters(name)) || name;
        if (classes[name]) classes[name].order = JSON.parse(m[2]);
    }
    return { classes };
}

async function get(url) {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.text();
}

/** Finds the guide's data script and parses it; one page plus a handful of scripts. */
export async function fetchHexaOrders() {
    const html = await get(GUIDE_PAGE);
    const scripts = [...new Set(html.match(/\/_next\/static\/chunks\/[^"'\s]+\.js/g) || [])];
    for (const path of scripts.slice(0, MAX_SCRIPTS)) {
        const js = await get(SITE + path);
        if (!js.includes('masterySkills:[') || !js.includes('order:[[')) continue;
        const parsed = parseHexaScript(js);
        const withOrder = Object.values(parsed.classes).filter(c => c.order.length).length;
        if (!withOrder) continue;
        return { source: `${SITE}/tools/hexamatrix`, fetchedAt: new Date().toISOString(), ...parsed };
    }
    throw new Error('The Hexa Matrix Guide\'s order data was not found; the page may have changed.');
}

// Classes whose HEXA board works differently (split skill stones, RNG
// shinestones, rush and boost stones) and which the guide does not cover:
// their community plans live in public Google Sheets, read as CSV.
const SHEET_PLANS = [
    { className: 'Sia Astelle', id: '1BDsJwMWZPjoNdV22_KSYxoLBQxcZ9Ls-WIXg5AzpO4E', gid: '1338703510' },
    { className: 'Erel Light', id: '1ZaHBpObiHw52asuVT6pHUNlkGIt_bm4nk1I2iUFAi7g', gid: '1954669731' },
];

/** Splits CSV text into rows of cells, honouring quoted cells. */
export function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
}

/**
 * A sheet plan's steps: the rows under its SKILL / LEVEL / ERDA / FRAGS
 * header, each under the "Goal: ..." row before it. LEVEL "2 --> 9" upgrades
 * levels 2 to 9 (from 1), "5" takes one level (from 4), "-" is a stone with no
 * levels. Fragments on shinestones are the sheet's expected (average) cost.
 */
export function parseSheetPlan(csv) {
    const rows = parseCsv(csv);
    const header = rows.findIndex(r => (r[0] || '').trim() === 'SKILL' && (r[3] || '').trim() === 'FRAGS');
    if (header < 0) return null;
    const credits = rows.map(r => (r[0] || '').trim()).find(c => /^Credits:/i.test(c)) || '';
    const steps = [];
    let goal = '';
    for (const r of rows.slice(header + 1)) {
        const skill = (r[0] || '').trim();
        if (/^Goal:/i.test(skill)) { goal = skill.replace(/^Goal:\s*/i, ''); continue; }
        const erda = parseFloat(r[2]), frag = parseFloat(r[3]);
        if (!skill || !Number.isFinite(erda) || !Number.isFinite(frag)) continue;
        const lv = (r[1] || '').trim();
        const range = lv.match(/^(\d+)\s*-+>\s*(\d+)$/);
        const one = lv.match(/^(\d+)$/);
        const to = range ? +range[2] : one ? +one[1] : null;
        const from = range ? +range[1] - 1 : one ? +one[1] - 1 : null;
        steps.push({ goal, skill, levels: lv, from, to, erda, frag: Math.round(frag * 10) / 10, fd: parseFloat(r[5]) || 0 });
    }
    return { credits, steps };
}

// ── Skill icons ─────────────────────────────────────────────────────────────
// The guide shows each node's icon from its CDN: skills/<class>/<node>.webp,
// plus shared icons for Sol Janus and HEXA Stat. They are saved under
// builds/hexa-icons/ (gitignored) so the tab works offline and the game art
// stays on this computer.
const CDN = 'https://cdn.mapletools.app';
const ICON_DIR = join(ROOT, 'builds', 'hexa-icons');
const ICON_CLASS_PATHS = { 'Arch Mage (Fire, Poison)': 'Fire Poison', 'Arch Mage (Ice, Lightning)': 'Ice Lightning' };
const NODE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** The local folder name for a class's icons. */
export const iconFolder = className => letters(className);

/**
 * Saves the node icons for the given guide class names (and the shared
 * ones), skipping files already there. Returns { saved, kept, missing }.
 */
export async function downloadHexaIcons(classNames) {
    const { stat } = await import('node:fs/promises');
    const exists = p => stat(p).then(() => true, () => false);
    const jobs = [['sol_janus.webp', 'skills/sol_janus.webp'], ['hexa.webp', 'skills/hexa.webp']];
    for (const name of new Set(classNames)) {
        const remote = encodeURIComponent(ICON_CLASS_PATHS[name] || name);
        for (const id of NODE_IDS) jobs.push([`${iconFolder(name)}/${id}.webp`, `skills/${remote}/${id}.webp`]);
    }
    let saved = 0, kept = 0, missing = 0;
    for (const [local, remote] of jobs) {
        const path = join(ICON_DIR, local);
        if (await exists(path)) { kept++; continue; }
        const res = await fetch(`${CDN}/${remote}`, { headers: HEADERS });
        if (!res.ok || !/^image\//.test(res.headers.get('content-type') || '')) { missing++; continue; }
        await mkdir(join(path, '..'), { recursive: true });
        await writeFile(path, Buffer.from(await res.arrayBuffer()));
        saved++;
    }
    return { saved, kept, missing };
}

/** Fetches and writes builds/hexa-orders.json; returns a short summary. */
export async function refreshHexaOrders() {
    const data = await fetchHexaOrders();
    for (const sheet of SHEET_PLANS) {
        const url = `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=${sheet.gid}`;
        try {
            const plan = parseSheetPlan(await get(url));
            if (!plan || !plan.steps.length) continue;
            data.classes[sheet.className] = {
                ...(data.classes[sheet.className] || {}),
                plan: { ...plan, source: `https://docs.google.com/spreadsheets/d/${sheet.id}/edit#gid=${sheet.gid}` },
            };
        } catch (err) {
            console.warn(`${sheet.className} plan not fetched: ${err.message}`);
        }
    }
    await mkdir(join(ROOT, 'builds'), { recursive: true });
    await writeFile(OUT, JSON.stringify(data, null, 2), 'utf8');
    const names = Object.keys(data.classes);
    const covered = n => (data.classes[n].order || []).length || (data.classes[n].plan && data.classes[n].plan.steps.length);
    return { classes: names.length, withOrder: names.filter(covered).length, fetchedAt: data.fetchedAt };
}

// node tools/hexa-orders.mjs                 fetch the orders
// node tools/hexa-orders.mjs --icons A B ... save icons for guide classes A, B, ...
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const run = args[0] === '--icons'
        ? downloadHexaIcons(args.slice(1)).then(r => console.log(`HEXA icons: ${r.saved} saved, ${r.kept} already there, ${r.missing} not on the CDN`))
        : refreshHexaOrders().then(r => console.log(`HEXA orders: ${r.withOrder} of ${r.classes} classes, saved to builds/hexa-orders.json`));
    run.catch(err => { console.error(err.message); process.exit(1); });
}
