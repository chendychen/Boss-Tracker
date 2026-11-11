import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const context = vm.createContext({});
vm.runInContext(readFileSync(join(__dirname, '..', 'autosave.js'), 'utf8'), context);
const A = context.Autosave;

/** An autosave over a fake browser: `state` is what the test edits, `writes` what reached the file. */
function setup() {
    const stored = new Map();
    const state = { data: 'roster v1', date: '2026-11-11', clock: 0, serverUp: true };
    const writes = [];
    const autosave = A.createAutosave({
        storage: { getItem: k => (stored.has(k) ? stored.get(k) : null), setItem: (k, v) => stored.set(k, String(v)) },
        today: () => state.date,
        content: () => state.data,
        write: async () => {
            if (state.serverUp) writes.push(state.data);
            return state.serverUp;
        },
        now: () => state.clock,
    });
    return { autosave, state, writes, stored };
}

describe('fingerprint', () => {
    test('is the same for the same text and differs when the text does', () => {
        assert.equal(A.fingerprint('{"a":1}'), A.fingerprint('{"a":1}'));
        assert.notEqual(A.fingerprint('{"a":1}'), A.fingerprint('{"a":2}'));
        assert.notEqual(A.fingerprint('ab'), A.fingerprint('ba'));
    });
});

describe('daily autosave', () => {
    test('opening the app for the first time writes nothing', async () => {
        const { autosave, writes } = setup();
        assert.equal(await autosave.check(), false);
        assert.equal(await autosave.check(), false);
        assert.deepEqual(writes, []);
    });

    test('the first edit of the day is saved, later ones wait for tomorrow', async () => {
        const { autosave, state, writes } = setup();
        await autosave.check();

        state.data = 'roster v2';
        assert.equal(await autosave.check(), true);
        state.data = 'roster v3';
        assert.equal(await autosave.check(), false);
        assert.deepEqual(writes, ['roster v2']);

        state.date = '2026-11-12';
        assert.equal(await autosave.check(), true);
        assert.deepEqual(writes, ['roster v2', 'roster v3']);
    });

    test('a day with no changes writes nothing', async () => {
        const { autosave, state, writes } = setup();
        await autosave.check();
        state.data = 'roster v2';
        await autosave.check();

        state.date = '2026-11-12';
        assert.equal(await autosave.check(), false);
        assert.deepEqual(writes, ['roster v2']);
    });

    test('an edit that is undone is not a change', async () => {
        const { autosave, state, writes } = setup();
        await autosave.check();
        state.data = 'roster v2';
        state.data = 'roster v1';
        assert.equal(await autosave.check(), false);
        assert.deepEqual(writes, []);
    });

    test('a manual save leaves nothing to autosave until the next edit', async () => {
        const { autosave, state, writes } = setup();
        await autosave.check();
        state.data = 'roster v2';
        autosave.markSaved();
        assert.equal(await autosave.check(), false);

        state.data = 'roster v3';
        assert.equal(await autosave.check(), true);
        assert.deepEqual(writes, ['roster v3']);
    });

    test('a write that fails is tried again later the same day', async () => {
        const { autosave, state, writes, stored } = setup();
        await autosave.check();
        state.data = 'roster v2';
        state.serverUp = false;
        assert.equal(await autosave.check(), false);
        assert.equal(stored.has(A.DATE_KEY), false);

        state.serverUp = true;
        assert.equal(await autosave.check(), false);            // still backing off
        state.clock = A.RETRY_AFTER;
        assert.equal(await autosave.check(), true);
        assert.deepEqual(writes, ['roster v2']);
    });

    test('edits made while a write is under way do not start a second one', async () => {
        const { autosave, state, writes } = setup();
        await autosave.check();
        state.data = 'roster v2';
        const results = await Promise.all([autosave.check(), autosave.check(), autosave.check()]);
        assert.deepEqual(results, [true, false, false]);
        assert.deepEqual(writes, ['roster v2']);
    });
});
