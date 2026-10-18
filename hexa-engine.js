/**
 * HEXA Matrix progression: node costs, a class's upgrade order and how far a
 * character is along it. Orders and node names come from MapleTools' Hexa
 * Matrix Guide via builds/hexa-orders.json (see tools/hexa-orders.mjs).
 *
 * Exposes window.HexaEngine; plain functions so tests can run it in Node.
 */
(function (root) {
    'use strict';

    // Cost of each level, index L = from level L to L + 1 (maplestorywiki
    // HEXA Matrix; MapleTools uses the same). Origin starts at level 1 for
    // free; its first entry is what the Ascent node costs to unlock. HEXA
    // Stat levels 1-3 are unlocking stat nodes I-III.
    const COSTS = {
        Origin: {
            erda: [5, 1, 1, 1, 2, 2, 2, 3, 3, 10, 3, 3, 4, 4, 4, 4, 4, 4, 5, 15, 5, 5, 5, 5, 5, 6, 6, 6, 7, 20],
            frag: [100, 30, 35, 40, 45, 50, 55, 60, 65, 200, 80, 90, 100, 110, 120, 130, 140, 150, 160, 350,
                170, 180, 190, 200, 210, 220, 230, 240, 250, 500],
        },
        Mastery: {
            erda: [3, 1, 1, 1, 1, 1, 1, 2, 2, 5, 2, 2, 2, 2, 2, 2, 2, 2, 3, 8, 3, 3, 3, 3, 3, 3, 3, 3, 4, 10],
            frag: [50, 15, 18, 20, 23, 25, 28, 30, 33, 100, 40, 45, 50, 55, 60, 65, 70, 75, 80, 175,
                85, 90, 95, 100, 105, 110, 115, 120, 125, 250],
        },
        Boost: {
            erda: [4, 1, 1, 1, 2, 2, 2, 3, 3, 8, 3, 3, 3, 3, 3, 3, 3, 3, 4, 12, 4, 4, 4, 4, 4, 5, 5, 5, 6, 15],
            frag: [75, 23, 27, 30, 34, 38, 42, 45, 49, 150, 60, 68, 75, 83, 90, 98, 105, 113, 120, 263,
                128, 135, 143, 150, 158, 165, 173, 180, 188, 375],
        },
        Common: {
            erda: [7, 2, 2, 2, 3, 3, 3, 5, 5, 14, 5, 5, 6, 6, 6, 6, 6, 6, 7, 17, 7, 7, 7, 7, 7, 9, 9, 9, 10, 20],
            frag: [125, 38, 44, 50, 57, 63, 69, 75, 82, 300, 110, 124, 138, 152, 165, 179, 193, 207, 220, 525,
                234, 248, 262, 275, 289, 303, 317, 330, 344, 750],
        },
        'Hexa Stat': { erda: [5, 10, 15], frag: [10, 200, 350] },
    };

    // The guide's node numbering: Origin 1, Ascent 10, Mastery 2/7/8/9,
    // Boost 3-6, HEXA Stat 11, Common 12.
    const MASTERY_IDS = [2, 7, 8, 9];

    /** A class's nodes, in display order: [{ id, name, type, group, start, max }]. */
    function nodesFor(cls) {
        if (!cls) return [];
        const out = [];
        if (cls.origin) out.push({ id: 1, name: cls.origin, type: 'Origin', group: 'Skills', start: 1, max: 30 });
        if (cls.ascent) out.push({ id: 10, name: cls.ascent, type: 'Origin', group: 'Skills', start: 0, max: 30 });
        (cls.mastery || []).forEach((name, i) => out.push({ id: MASTERY_IDS[i], name, type: 'Mastery', group: 'Mastery', start: 0, max: 30 }));
        (cls.boost || []).forEach((name, i) => out.push({ id: 3 + i, name, type: 'Boost', group: 'Boost', start: 0, max: 30 }));
        (cls.common || []).slice(0, 1).forEach(name => out.push({ id: 12, name, type: 'Common', group: 'Common', start: 0, max: 30 }));
        out.push({ id: 11, name: 'HEXA Stat', type: 'Hexa Stat', group: 'HEXA Stat', start: 0, max: 3 });
        return out;
    }

    /** Sol Erda and fragments to take a node of `type` from level `from` to `to`. */
    function cost(type, from, to) {
        const t = COSTS[type];
        let erda = 0, frag = 0;
        if (!t) return { erda, frag };
        for (let l = Math.max(0, from); l < to && l < t.frag.length; l++) {
            erda += t.erda[l] || 0;
            frag += t.frag[l] || 0;
        }
        return { erda, frag };
    }

    /**
     * The order as steps: consecutive levels on the same node joined into one
     * { id, from, to } (the guide lists one level at a time). `from` is the
     * node's level before the step, starting from its free level.
     */
    function steps(cls) {
        const nodes = new Map(nodesFor(cls).map(n => [n.id, n]));
        const level = new Map([...nodes.values()].map(n => [n.id, n.start]));
        const out = [];
        for (const [id, target] of cls.order || []) {
            const node = nodes.get(id);
            if (!node) continue;
            const from = level.get(id);
            if (target <= from) continue;
            const last = out[out.length - 1];
            if (last && last.id === id && last.to === from) last.to = target;
            else out.push({ id, from, to: target });
            level.set(id, target);
        }
        return out.map(s => ({ ...s, node: nodes.get(s.id), ...cost(nodes.get(s.id).type, s.from, s.to) }));
    }

    /**
     * Where a character stands on its class's order, given its node levels
     * ({ id: level }). Each step gets a status ('done', 'partial', 'todo') and
     * what is still owed on it; `next` is the first step not done.
     */
    function progress(cls, levels = {}) {
        const nodes = nodesFor(cls);
        const levelOf = id => {
            const n = nodes.find(x => x.id === id);
            const v = levels[id];
            return Number.isFinite(+v) && v !== null && v !== '' ? +v : (n ? n.start : 0);
        };
        let owedErda = 0, owedFrag = 0, next = null;
        const list = steps(cls).map((s, i) => {
            const now = levelOf(s.id);
            const status = now >= s.to ? 'done' : now > s.from ? 'partial' : 'todo';
            const owed = status === 'done' ? { erda: 0, frag: 0 } : cost(s.node.type, Math.max(now, s.from), s.to);
            owedErda += owed.erda;
            owedFrag += owed.frag;
            const step = { ...s, index: i, status, now, owedErda: owed.erda, owedFrag: owed.frag, runningFrag: owedFrag, runningErda: owedErda };
            if (!next && status !== 'done') next = step;
            return step;
        });
        const total = nodes.reduce((a, n) => {
            const c = cost(n.type, levelOf(n.id), n.max);
            return { erda: a.erda + c.erda, frag: a.frag + c.frag };
        }, { erda: 0, frag: 0 });
        return { steps: list, next, owed: { erda: owedErda, frag: owedFrag }, toMax: total, done: list.filter(s => s.status === 'done').length };
    }

    /**
     * Progress through a sheet plan (Erel Light, Sia Astelle), whose steps
     * carry their own costs: the first `done` steps are complete. Also the
     * skill levels the completed steps reached, by the sheet's skill names.
     */
    function planProgress(plan, done = 0) {
        const n = Math.max(0, Math.min(done | 0, plan.steps.length));
        let erda = 0, frag = 0;
        const list = plan.steps.map((s, i) => {
            const status = i < n ? 'done' : 'todo';
            if (status !== 'done') { erda += s.erda; frag += s.frag; }
            return { ...s, index: i, status, runningErda: erda, runningFrag: Math.round(frag * 10) / 10 };
        });
        const levels = {};
        list.filter(s => s.status === 'done' && s.to !== null).forEach(s => {
            levels[s.skill] = Math.max(levels[s.skill] || 0, s.to);
        });
        const fd = list.filter(s => s.status === 'done').reduce((a, s) => a + (s.fd || 0), 0);
        return { steps: list, next: list[n] || null, done: n, owed: { erda, frag: Math.round(frag * 10) / 10 }, levels, fd };
    }

    // Our class names where the guide's differ.
    const GUIDE_NAMES = {
        Bowmaster: 'Bow Master', 'Ice/Lightning': 'Arch Mage (Ice, Lightning)',
        'Fire/Poison': 'Arch Mage (Fire, Poison)', Sia: 'Sia Astelle',
    };
    const letters = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

    /** The guide's entry for one of our class names, or null. */
    function guideClass(data, className) {
        if (!data || !data.classes || !className) return null;
        const want = GUIDE_NAMES[className] || className;
        if (data.classes[want]) return { name: want, ...data.classes[want] };
        const key = Object.keys(data.classes).find(k => letters(k) === letters(want));
        return key ? { name: key, ...data.classes[key] } : null;
    }

    root.HexaEngine = { COSTS, nodesFor, cost, steps, progress, planProgress, guideClass };
})(typeof globalThis !== 'undefined' ? globalThis : this);
