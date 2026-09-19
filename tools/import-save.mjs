#!/usr/bin/env node
// Moves an exported backup into saves/, through the same rotation the server
// uses, so the app picks it up on its next load.
//
//   node tools/import-save.mjs                 # newest boss-tracker-backup-*.json
//   node tools/import-save.mjs path/to/file.json

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { rotateSave } from './save-server.mjs';

const ROOT = resolve(import.meta.dirname, '..');

async function newestExport() {
    const files = (await readdir(ROOT)).filter(f => /^boss-tracker-backup-.*\.json$/.test(f));
    if (!files.length) throw new Error('No boss-tracker-backup-*.json in the project folder');
    const timed = await Promise.all(
        files.map(async f => ({ f, t: (await stat(join(ROOT, f))).mtimeMs })));
    return join(ROOT, timed.sort((a, b) => b.t - a.t)[0].f);
}

const source = process.argv[2] ? resolve(process.argv[2]) : await newestExport();
const body = await readFile(source, 'utf8');
const result = await rotateSave(body);
console.log(`imported ${source}`);
console.log(`  -> saves/${result.saved} and saves/latest.json (keeping ${result.kept})`);
if (result.pruned.length) console.log(`  pruned ${result.pruned.join(', ')}`);
