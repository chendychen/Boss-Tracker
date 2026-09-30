#!/usr/bin/env node
// Local dev server for the tracker.
//
// Serves the project folder over http so the app can fetch its save file
// (a page opened as file:// cannot), and accepts POST /api/save to write the
// current data back to saves/, keeping the most recent SAVE_LIMIT snapshots.
// GET /api/builds lists the gear build files dropped into builds/.
//
//   node tools/save-server.mjs [port]
//
// Nothing here is exposed beyond localhost and there are no dependencies.

import { createServer } from 'node:http';
import { readFile, writeFile, readdir, unlink, mkdir, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const SAVE_DIR = join(ROOT, 'saves');
const LATEST = join(SAVE_DIR, 'latest.json');
const BUILD_DIR = join(ROOT, 'builds');
const SAVE_LIMIT = 10;
const PORT = Number(process.argv[2]) || 8777;

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

/** Timestamp suitable for a filename: 2026-09-19T2308. */
function stamp(date = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
        + `T${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

/**
 * Writes a snapshot into saves/, refreshes latest.json, and deletes the
 * oldest snapshots beyond SAVE_LIMIT.
 * @param {string} body - the JSON payload as text
 * @returns {Promise<object>} what was written and what was pruned
 */
export async function rotateSave(body) {
    JSON.parse(body);  // reject anything that is not valid JSON before writing
    await mkdir(SAVE_DIR, { recursive: true });
    const name = `save-${stamp()}.json`;
    await writeFile(join(SAVE_DIR, name), body, 'utf8');
    await writeFile(LATEST, body, 'utf8');

    const snapshots = (await readdir(SAVE_DIR))
        .filter(f => /^save-.*\.json$/.test(f))
        .sort();
    const pruned = snapshots.slice(0, Math.max(0, snapshots.length - SAVE_LIMIT));
    for (const f of pruned) await unlink(join(SAVE_DIR, f));
    return { saved: name, kept: snapshots.length - pruned.length, pruned };
}

/**
 * Lists the gear build files dropped into builds/ (exports from the GMS
 * Upgrade Tracker's Gear page, or MapleScouter presets), newest first.
 * @returns {Promise<Array<{file: string, modified: string}>>}
 */
export async function listBuilds() {
    await mkdir(BUILD_DIR, { recursive: true });
    const files = (await readdir(BUILD_DIR)).filter(f => f.toLowerCase().endsWith('.json'));
    const entries = await Promise.all(files.map(async f => ({
        file: f,
        modified: (await stat(join(BUILD_DIR, f))).mtime.toISOString(),
    })));
    return entries.sort((a, b) => b.modified.localeCompare(a.modified));
}

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
    });
    res.end(body);
}

async function handle(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === 'POST' && url.pathname === '/api/save') {
        try {
            const chunks = [];
            let size = 0;
            for await (const chunk of req) {
                size += chunk.length;
                if (size > 8 * 1024 * 1024) throw new Error('Save too large');
                chunks.push(chunk);
            }
            const result = await rotateSave(Buffer.concat(chunks).toString('utf8'));
            console.log(`saved ${result.saved} (keeping ${result.kept})`);
            return sendJson(res, 200, result);
        } catch (err) {
            return sendJson(res, 400, { error: err.message });
        }
    }

    if (req.method === 'GET' && url.pathname === '/api/builds') {
        try {
            return sendJson(res, 200, { builds: await listBuilds() });
        } catch (err) {
            return sendJson(res, 500, { error: err.message });
        }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    // Static files, confined to the project folder.
    const rel = decodeURIComponent(url.pathname === '/' ? '/boss_crystal_tracker.html' : url.pathname);
    const path = resolve(ROOT, '.' + normalize(rel));
    if (path !== ROOT && !path.startsWith(ROOT + sep)) {
        return sendJson(res, 403, { error: 'Outside project folder' });
    }
    try {
        const body = await readFile(path);
        res.writeHead(200, {
            'Content-Type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream',
            'Content-Length': body.length,
            'Cache-Control': 'no-store',
        });
        res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
        sendJson(res, 404, { error: 'Not found' });
    }
}

// Both loopback addresses, never a network interface. "localhost" can resolve
// to either one depending on the browser and any VPN in the way, so listening
// on only one of them makes the page unreachable for some setups.
const LOOPBACKS = [['127.0.0.1', `http://127.0.0.1:${PORT}/`], ['::1', `http://[::1]:${PORT}/`]];

// Only listen when run directly; import-save.mjs imports rotateSave from here.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    let listening = 0;
    for (const [host, url] of LOOPBACKS) {
        const server = createServer(handle);
        server.on('error', err => {
            // IPv6 can be disabled on the machine; IPv4 alone still works.
            console.warn(`Not listening on ${host}: ${err.code || err.message}`);
            if (err.code === 'EADDRINUSE') console.warn(`Port ${PORT} is taken; is the tracker already running?`);
        });
        server.listen(PORT, host, () => {
            console.log(`Boss Tracker: ${url}`);
            if (++listening === 1) {
                console.log(`Also http://localhost:${PORT}/`);
                console.log(`Saves in ${SAVE_DIR} (latest ${SAVE_LIMIT} kept)`);
            }
        });
    }
}
