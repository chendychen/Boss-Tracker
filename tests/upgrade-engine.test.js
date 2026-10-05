import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const context = vm.createContext({});
vm.runInContext(readFileSync(join(__dirname, '../upgrade-tables.js'), 'utf8'), context);
vm.runInContext(readFileSync(join(__dirname, '../upgrade-engine.js'), 'utf8'), context);
const E = context.UpgradeEngine;

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

// A late-game archer sheet, close to the tracker's main.
const SHEET = {
    mainBase: 7054, mainPct: 525, mainFlat: 31410,
    subBase: 4453, subPct: 256, subFlat: 570,
    att: 3790, attPct: 106, dmg: 59, boss: 696, critDmg: 142, ied: 98.94,
};

describe('damage model', () => {
    test('ATT% scales attack proportionally', () => {
        near(E.fdGain(SHEET, { attPct: 1 }), 100 * (1 / 206), 1e-9);
    });

    test('boss damage is additive with damage%', () => {
        near(E.fdGain(SHEET, { boss: 10 }), 100 * (10 / (100 + 59 + 696)), 1e-9);
    });

    test('IED stacks multiplicatively and a negative line removes it', () => {
        const after = E.applyDelta({ ied: 90 }, { ied: [40] });
        near(after.ied, 94);
        near(E.applyDelta(after, { ied: [-40] }).ied, 90);
        // swapping a 30% line for a 40% one in one delta
        near(E.applyDelta({ ied: 90 }, { ied: [40, -30] }).ied, 100 * (1 - 0.1 * 0.6 / 0.7));
    });

    test('a delta and its negation cancel', () => {
        const d = { mainPct: 9, att: 30, boss: 40, ied: [40] };
        const back = E.applyDelta(E.applyDelta(SHEET, d), E.negateDelta(d));
        const want = E.normalizeStats(SHEET);
        for (const k of Object.keys(want)) if (typeof want[k] === 'number') near(back[k], want[k], 1e-9);
    });

    test('higher PDR makes IED worth more', () => {
        const low = E.fdGain({ ...SHEET, ied: 90 }, { ied: [20] }, 300);
        const high = E.fdGain({ ...SHEET, ied: 90 }, { ied: [20] }, 380);
        assert.ok(high > low);
    });
});

describe('potential lines', () => {
    const cases = [
        ['DEX +12%', 'Bowmaster', { stat: 'main%', value: 12 }],
        ['STR: +9%', 'Bowmaster', { stat: 'sub%', value: 9 }],
        ['All Stats: +9%', 'Pathfinder', { stat: 'all%', value: 9 }],
        ['ATT +13%', 'Bowmaster', { stat: 'att%', value: 13 }],
        ['Magic ATT +13%', 'Kinesis', { stat: 'att%', value: 13 }],
        ['Magic ATT +13%', 'Bowmaster', { stat: 'other', value: 13 }],
        ['Boss Monster Damage: +40%', 'Bowmaster', { stat: 'boss', value: 40 }],
        ['Ignore Enemy DEF +40%', 'Bowmaster', { stat: 'ied', value: 40 }],
        ['Critical Damage +8%', 'Bowmaster', { stat: 'critDmg', value: 8 }],
        ['Damage +12%', 'Bowmaster', { stat: 'dmg', value: 12 }],
        ['Skill Cooldown -2 sec', 'Bowmaster', { stat: 'cooldown', value: 2 }],
        ['INT +12%', 'Ice/Lightning', { stat: 'main%', value: 12 }],
    ];
    for (const [text, cls, want] of cases) {
        test(`${text} for ${cls}`, () => {
            const got = E.parsePotentialLine(text, cls);
            assert.equal(got.stat, want.stat);
            assert.equal(got.value, want.value);
        });
    }

    test('stat per level lines scale with character level', () => {
        const d = E.linesDelta(['DEX +2 per 10 Character Levels'], 'Bowmaster', 285);
        assert.equal(d.mainBase, 56);
    });

    test('all stat % adds to both main and secondary', () => {
        const d = E.linesDelta(['All Stats: +9%'], 'Bowmaster');
        assert.equal(d.mainPct, 9);
        assert.equal(d.subPct, 9);
    });
});

describe('flames', () => {
    test('uses the class stats and attack type', () => {
        const flames = { str: 40, dex: 120, int: 0, luk: 0, att: 12, matt: 99, allStatPercent: 6, bossDamagePercent: 0, damagePercent: 0 };
        const d = E.flameDelta(flames, 'Bowmaster');
        assert.equal(d.mainBase, 120);
        assert.equal(d.subBase, 40);
        assert.equal(d.att, 12);
        assert.equal(d.mainPct, 6);
    });
});

describe('importing builds', () => {
    test('reads an Upgrade Tracker build wherever it is nested', () => {
        const file = { version: 1, build: {
            id: 'someone', selectedClass: 'Bowmaster',
            characterStats: { primaryStat: 7000, totalPercentStat: 500, additionalPrimaryStat: 30000,
                secondaryStat: 4000, totalPercentSecondaryStat: 200, additionalSecondaryStat: 500,
                totalATT: 3800, totalPercentATT: 110, damagePercent: 60, bossDamagePercent: 600,
                ied: 0.972, critDamagePercent: 140 },
            gear: {
                weapon: { name: 'Genesis Bow', itemLevel: 200, currentStars: 22, starforceCap: 22,
                    isWSE: true, category: 'weapon', potentialTier: 'legendary',
                    potentialLines: ['ATT +13%', 'ATT +10%', 'Boss Monster Damage: +30%'],
                    flames: { att: 200, bossDamagePercent: 10 }, replacementCost: 0 },
                notes: 'ignored',
            } } };
        const got = E.importBuild(file);
        assert.equal(got.source, 'gms-upgrade-tracker');
        assert.equal(got.ign, 'someone');
        assert.equal(got.className, 'Bowmaster');
        near(got.stats.ied, 97.2);
        assert.equal(got.stats.mainFlat, 30000);
        assert.deepEqual(Object.keys(got.items), ['weapon']);
        assert.equal(got.items.weapon.stars, 22);
        assert.equal(got.items.weapon.potLines.length, 3);
    });

    test('reads a MapleScouter preset as a stat sheet only', () => {
        const got = E.importBuild({ type: 'maplescouter-manual-preset', data: { stat: {
            myClass: '패스파인더', level: '284', mainStatBase: '6628', mainStatPer: '487', mainStatAbs: '28050',
            subStatBase: '3969', subStatPer: '248', subStatAbs: '590', atkBase: '3273', atkPercent: '78',
            dmg: '65', bossDmg: '589', criticalDmg: '132', ignoreDef: '95.64' } } });
        assert.equal(got.className, 'Pathfinder');
        assert.equal(got.level, 284);
        assert.equal(got.items, null);
        assert.equal(got.stats.att, 3273);
        near(got.stats.ied, 95.64);
    });

    test('returns null for unrelated JSON', () => {
        assert.equal(E.importBuild({ characters: [] }), null);
    });
});

describe('climbing stars', () => {
    test('a single step with no failure costs one attempt', () => {
        const r = E.climbExpectation(10, 11, () => ({ cost: 5, success: 1, destroy: 0 }));
        near(r.cost, 5);
        near(r.attempts, 1);
    });

    test('a coin-flip step takes two attempts on average', () => {
        const r = E.climbExpectation(10, 11, () => ({ cost: 1, success: 0.5, destroy: 0 }));
        near(r.attempts, 2);
    });

    test('booms send the item back and are counted', () => {
        // from 12 to 14: 50% success, 10% boom back to 12, boom costs 100
        const step = () => ({ cost: 1, success: 0.5, destroy: 0.1 });
        const r = E.climbExpectation(12, 14, step, { recoverStar: 12, boomCost: 100 });
        // Closed form: let a = E[12], b = E[13] (attempt counts)
        // a = 1 + .4a + .5b + .1a ; b = 1 + .4b + .1a
        // => .5a = 1 + .5b ; .6b = 1 + .1a  => a = 2 + b ; .6b = 1 + .2 + .1b => b = 2.4, a = 4.4
        near(r.attempts, 4.4, 1e-9);
        const booms = 0.1 * 4.4; // every attempt booms with 10%
        near(r.booms, booms, 1e-9);
        near(r.cost, 4.4 + 100 * booms, 1e-9);
    });
});

describe('cubing', () => {
    const pools = {
        prime: [{ stat: 'dex%', value: 13, w: 1 }, { stat: 'luk%', value: 13, w: 1 }],
        nonPrime: [{ stat: 'dex%', value: 10, w: 1 }, { stat: 'int%', value: 10, w: 3 }],
    };
    const base = { stats: SHEET, className: 'Bowmaster', charLevel: 285, currentLines: [], pools };

    test('useless lines merge and probabilities sum to one', () => {
        const pool = E.collapsePool(pools.nonPrime, 'Bowmaster');
        assert.equal(pool.length, 2);
        near(pool.reduce((a, e) => a + e.w, 0), 1);
    });

    test('outcome probabilities follow the prime chances', () => {
        const out = E.cubeOutcomes({ ...base, lineCount: 2, primeChance: [1, 0] });
        near(out.reduce((a, o) => a + o.p, 0), 1);
        // best: 13 + 10 DEX% = 1/2 prime DEX x 1/4 non-prime DEX
        near(out[0].p, 0.125);
    });

    test('thresholds: rolls = 1 / P(at least t), gain = mean above t', () => {
        const out = E.cubeOutcomes({ ...base, lineCount: 2, primeChance: [1, 0] });
        const th = E.cubeThresholds(out);
        near(th[0].rolls, 8);
        near(th[0].gain, out[0].fd);
        assert.ok(th[1].rolls < th[0].rolls && th[1].gain < th[0].gain);
    });

    test('line limits drop and renormalise', () => {
        const allBoss = { prime: [{ stat: 'boss%', value: 40, w: 1 }, { stat: 'att%', value: 13, w: 1 }], nonPrime: [] };
        const out = E.cubeOutcomes({ ...base, pools: allBoss, lineCount: 3, primeChance: [1, 1, 1], limits: { boss: 2 } });
        assert.ok(out.every(o => o.lines.filter(l => l.stat === 'boss').length <= 2));
        near(out.reduce((a, o) => a + o.p, 0), 1);
    });
});

describe('star force costs and chains', () => {
    const T = E.TABLES;

    test('base cost matches in-game GMS figures', () => {
        assert.equal(T.sfBaseCost(200, 16), 83999600);                     // Lv200 16→17
        near(T.sfBaseCost(250, 18) * 6.5 * 0.7, 2879842875, 1);            // Lv250 18→19, mode 4, Shining
    });

    test('mode 4 at 21★ on a Lv150 item costs what the site shows (8.80B)', () => {
        const item = { slot: 'ring1', level: 150, stars: 21, set: 'Superior Gollux', replacementCost: 5e8 };
        const climb = E.sfSteps(item, 22, E.DEFAULT_SETTINGS);
        near(climb(21, 22).cost, 113738800 * 6.5 / 0.084, 1);
        near(climb(21, 22).booms, 0);
    });

    test('Shining Star Force takes 30% off and 30% of the booms', () => {
        const item = { slot: 'hat', level: 200, stars: 18, set: 'Arcane Umbra' };
        const plain = E.sfStep(item, 18, { ...E.DEFAULT_SETTINGS, sfProtection: '1111' });
        const shining = E.sfStep(item, 18, { ...E.DEFAULT_SETTINGS, sfProtection: '1111', shiningStarForce: true });
        near(shining.cost, plain.cost * 0.7, 1);
        near(shining.destroy, plain.destroy * 0.7, 1e-12);
    });

    test('safeguard premium is never discounted', () => {
        const item = { slot: 'hat', level: 200, stars: 16, set: 'Arcane Umbra' };
        const s = E.sfStep(item, 16, { ...E.DEFAULT_SETTINGS, shiningStarForce: true, mvpDiscount: 3 });
        near(s.cost, 83999600 * 0.7 * 0.97 + 2 * 83999600, 1);
        assert.equal(s.destroy, 0);
    });

    test('step sums agree with the linear-system solver when booms return to 12★', () => {
        const item = { slot: 'hat', level: 200, stars: 15, set: 'Arcane Umbra', replacementCost: 1e9 };
        const settings = { ...E.DEFAULT_SETTINGS, safeguard: false, sfProtection: '1111' };
        const steps = E.sfSteps(item, 20, settings)(15, 20);   // 15-19 all restore to 12★
        const solved = E.climbExpectation(15, 20, s => E.sfStep(item, s, settings), { recoverStar: 12, boomCost: 1e9 });
        near(steps.cost / solved.cost, 1, 1e-9);
        near(steps.booms, solved.booms, 1e-9);
    });

    test('pitched items default to always protected', () => {
        const item = { slot: 'face', level: 160, stars: 21, set: 'Pitched Boss' };
        assert.equal(E.sfStep(item, 21, E.DEFAULT_SETTINGS).destroy, 0);
    });
});

describe('recommendations', () => {
    const build = {
        className: 'Bowmaster', stats: SHEET,
        items: {
            hat: { slot: 'hat', name: 'Hat', set: 'Eternal', level: 250, stars: 21, starCap: 0, sfKind: 'ordinary',
                potTier: 'legendary', potLines: [{ stat: 'dex%', value: 10 }, { stat: 'dex%', value: 10 }, { stat: 'other', value: 1 }],
                lineCount: 3, flames: { dex: 100, str: 40 }, replacementCost: 2e9 },
        },
    };

    test('ranks star force, cube and flame options by meso per FD', () => {
        const recs = E.recommend(build, {}, { charLevel: 295 });
        assert.deepEqual([...new Set(recs.map(r => r.type))].sort(), ['cube', 'flame', 'starforce']);
        for (let i = 1; i < recs.length; i++) assert.ok(recs[i].mesoPerFd >= recs[i - 1].mesoPerFd);
    });

    test('the plan continues a star force chain in order', () => {
        const recs = E.recommend(build, { sfMaxStar: 24 }, { charLevel: 295 });
        const sf = E.buildPlan(recs.filter(r => r.type === 'starforce'), 10);
        let at = 21;
        for (const step of sf) { assert.equal(step.from, at); at = step.to; }
        assert.equal(at, 24);
    });

    test('a hat CDR line counts as damage', () => {
        const d = E.linesDelta([{ stat: 'cdr', value: 2 }], 'Bowmaster');
        assert.equal(d.cdr, 2);
        near(E.fdGain(SHEET, d), 1.4, 1e-9);
    });
});

describe('gear editing', () => {
    test('flame score reproduces the site across classes', () => {
        const cases = [
            ['Bowmaster', { att: 251, allStatPercent: 6, bossDamagePercent: 10 }, 913],
            ['Bowmaster', { dex: 107, att: 6, allStatPercent: 4 }, 165],
            ['Pathfinder', { str: 42, dex: 102, allStatPercent: 6 }, 166],
            ['Ice/Lightning', { int: 44, matt: 195, bossDamagePercent: 12 }, 749],
            ['Ice/Lightning', { luk: 16, allStatPercent: 2 }, 21],
            ['Demon Avenger', { str: 36, att: 6, hp: 3600 }, 227],
            ['Demon Avenger', { hp: 3360, allStatPercent: 6 }, 192],
        ];
        for (const [cls, flames, want] of cases) assert.equal(E.flameScore(flames, cls), want, `${cls} ${JSON.stringify(flames)}`);
    });

    test('restating an item edit and undoing it returns the same sheet', () => {
        const before = { ...E.newItem('hat', E.GEAR_CATALOG.find(g => g.name === 'Eternal Hat')), stars: 18,
            potLines: [{ stat: 'dex%', value: 10 }], flames: { dex: 60 } };
        const after = { ...before, stars: 22, potLines: [{ stat: 'dex%', value: 13 }, { stat: 'cdr', value: 2 }],
            flames: { dex: 100, allStatPercent: 6 } };
        const up = E.restatItem(SHEET, before, after, 'Bowmaster', 285);
        assert.ok(E.damageIndex(up) > E.damageIndex(SHEET));
        const back = E.restatItem(up, after, before, 'Bowmaster', 285);
        const want = E.normalizeStats(SHEET);
        for (const k of Object.keys(want)) if (typeof want[k] === 'number') near(back[k], want[k], 1e-9);
    });

    test('line choices fit the slot and level', () => {
        assert.ok(E.lineStatsForSlot('gloves').includes('crit_dmg%'));
        assert.ok(!E.lineStatsForSlot('hat').includes('boss%'));
        assert.deepEqual([...E.lineValuesFor('hat', 250, 'dex%')].slice(0, 2), [13, 10]);
        assert.deepEqual([...E.lineValuesFor('ring1', 150, 'dex%')].slice(0, 2), [12, 9]);
        assert.deepEqual([...E.lineValuesFor('weapon', 200, 'boss%')], [40, 35, 30]);
    });

    test('catalog items become editable inventory items', () => {
        const it = E.newItem('weapon', E.GEAR_CATALOG.find(g => g.name === 'Genesis Weapon'));
        assert.equal(it.sfKind, 'fixed');
        assert.equal(it.stars, 22);
        assert.equal(it.potTier, 'legendary');
    });
});

describe('class-aware line choices', () => {
    const stats = slot => cls => [...E.lineStatsForSlot(slot, cls)];

    test('a DEX archer sees only DEX, STR, all stat and ATT lines', () => {
        const w = stats('weapon')('Bowmaster');
        for (const s of ['dex%', 'str%', 'allstat%', 'att%', 'att', 'boss%', 'ied%', 'damage%']) assert.ok(w.includes(s), s);
        for (const s of ['int%', 'luk%', 'matt%', 'matt', 'hp%']) assert.ok(!w.includes(s), s);
    });

    test('a mage sees MATT and INT/LUK', () => {
        const w = stats('weapon')('Ice/Lightning');
        assert.ok(w.includes('matt%') && w.includes('int%') && w.includes('luk%'));
        assert.ok(!w.includes('att%') && !w.includes('dex%'));
    });

    test('Demon Avenger keeps HP and STR, and gloves keep only its flat stats', () => {
        const hat = stats('hat')('Demon Avenger');
        assert.ok(hat.includes('hp%') && hat.includes('str%') && hat.includes('cdr'));
        assert.ok(!hat.includes('dex%'));
        const gloves = stats('gloves')('Demon Avenger');
        assert.ok(gloves.includes('str') && !gloves.includes('dex') && gloves.includes('crit_dmg%'));
    });

    test('Shadower keeps its third stat', () => {
        const hat = stats('hat')('Shadower');
        assert.ok(hat.includes('luk%') && hat.includes('dex%') && hat.includes('str%') && !hat.includes('int%'));
    });

    test('an unknown class keeps every option', () => {
        const hat = stats('hat')(null);
        assert.ok(['str%', 'dex%', 'int%', 'luk%', 'hp%'].every(s => hat.includes(s)));
    });

    test('newer classes use the main stats their wiki pages give', () => {
        assert.equal(E.classStats('Mo Xuan').main, 'dex');
        assert.equal(E.classStats('Erel Light').main, 'str');
        assert.equal(E.classStats('Sia').main, 'int');
        assert.equal(E.describeClass('Pathfinder'), 'DEX main · STR secondary · ATT');
    });
});

describe('readable targets', () => {
    test('score thresholds count only scores above the current one', () => {
        const outcomes = [
            { score: 33, fd: 1.0, p: 0.1, lines: [] },
            { score: 30, fd: 0.5, p: 0.2, lines: [] },
            { score: 26, fd: -0.2, p: 0.7, lines: [] },
        ];
        const th = [...E.scoreThresholds(outcomes, { current: 27 })];
        assert.deepEqual(th.map(t => t.threshold), [33, 30]);
        near(th[1].rolls, 1 / 0.3);
        near(th[1].gain, (0.1 * 1.0 + 0.2 * 0.5) / 0.3);
        near(th[1].expect, (0.1 * 33 + 0.2 * 30) / 0.3);
    });

    test('line equivalents are in the target unit', () => {
        const eq = E.lineEquivalent(SHEET, 'mainPct', 'Bowmaster', 285, 380);
        near(eq({ stat: 'main%', value: 13 }), 13, 1e-9);
        assert.ok(eq({ stat: 'all%', value: 10 }) > 10);   // all stat also raises STR
        assert.ok(eq({ stat: 'sub%', value: 10 }) < 2);    // STR is a fraction of DEX
    });

    test('cube and flame rows name a target in stat % and flame score', () => {
        const build = {
            className: 'Bowmaster', stats: SHEET,
            items: {
                hat: { slot: 'hat', name: 'Hat', set: 'Eternal', level: 250, stars: 22, sfKind: 'ordinary',
                    potTier: 'legendary', lineCount: 3, replacementCost: 2e9,
                    potLines: [{ stat: 'dex%', value: 10 }, { stat: 'dex%', value: 10 }, { stat: 'other', value: 1 }],
                    flames: { dex: 100, str: 40 } },
            },
        };
        const recs = E.recommend(build, {}, { charLevel: 295 });
        const cube = recs.find(r => r.type === 'cube');
        assert.match(cube.label, /(to \d+%\+ DEX|until it beats \d+% DEX)$/);
        assert.ok(cube.hits.length >= 1 && !/INT|LUK/.test(cube.hits.join(' ')));
        const flame = recs.find(r => r.type === 'flame');
        assert.match(flame.label, /score \d+/);
        assert.equal(flame.now, 'score 103');
        assert.match(flame.detail, /expect ~\d+/);
        assert.match(cube.now, /^\d+% DEX$/);
    });
});

describe('cooldown hat', () => {
    const build = {
        className: 'Bowmaster', stats: SHEET,
        items: {
            hat: { slot: 'hat', name: 'Hat', set: 'Eternal', level: 250, stars: 22, sfKind: 'ordinary',
                potTier: 'legendary', lineCount: 3, replacementCost: 2e9,
                potLines: [{ stat: 'cdr', value: 2 }, { stat: 'dex%', value: 10 }, { stat: 'other', value: 1 }], flames: {} },
        },
    };

    test('CDR lines are worth nothing for a class without a cooldown hat', () => {
        const eq = E.lineEquivalent(E.normalizeStats({ ...SHEET, cdrValue: 0 }), 'mainPct', 'Bowmaster', 295, 380);
        assert.equal(eq({ stat: 'cooldown', value: 2 }), 0);
        assert.ok(!E.equivalenceLegend(build, { cdrValue: 0 }).armor.includes('CDR'));
        assert.ok(E.equivalenceLegend(build, {}).armor.includes('CDR'));
    });

    test('without CDR value, cubing the hat never keeps a CDR line for its own sake', () => {
        const hat = E.recommend(build, { cdrValue: 0 }, { charLevel: 295 }).filter(r => r.type === 'cube');
        for (const r of hat) assert.ok(r.hits.every(h => !/^CDR/.test(h)), r.hits.join(' | '));
    });
});

describe('IED in cube targets', () => {
    const build = {
        className: 'Bowmaster', stats: { ...SHEET, ied: 95 },
        items: {
            weapon: { slot: 'weapon', name: 'Weapon', set: 'Eternal', level: 200, stars: 22, sfKind: 'fixed',
                potTier: 'legendary', lineCount: 3, replacementCost: 0, flames: {},
                potLines: [{ stat: 'att%', value: 13 }, { stat: 'att%', value: 10 }, { stat: 'dex%', value: 10 }] },
        },
    };
    const cubes = settings => E.recommend(build, settings, { charLevel: 295 }).filter(r => r.type === 'cube');

    test('by default IED lines are junk to cube targeting', () => {
        assert.equal(E.DEFAULT_SETTINGS.iedWeight, 0);
        for (const r of cubes({})) assert.ok(r.hits.every(h => !/IED/.test(h)), r.hits.join(' | '));
    });

    test('a weight brings IED back at a scaled value, shown at its rolled value', () => {
        const w = E.weighIed({ stat: 'ied%', value: 40 }, 'Bowmaster', 0.25);
        assert.equal(w.value, 10);
        assert.equal(E.describeLines([w], 'Bowmaster'), 'IED 40');
        assert.equal(E.weighIed({ stat: 'ied%', value: 40 }, 'Bowmaster', 0).stat, 'other');
        assert.ok(cubes({ iedWeight: 1 }).some(r => r.hits.some(h => /IED/.test(h))));
    });

    test('the stat sheet still counts real IED', () => {
        const before = { ...build.items.weapon, potLines: [{ stat: 'ied%', value: 40 }] };
        const after = { ...build.items.weapon, potLines: [] };
        assert.ok(E.restatItem(build.stats, before, after, 'Bowmaster', 295).ied < 95);
    });
});

describe('cooldown curves', () => {
    const curve = E.CDR_CURVES.Pathfinder;
    const hat = lines => ({ slot: 'hat', name: 'Hat', level: 250, potLines: lines });
    const build = { className: 'Pathfinder', stats: SHEET,
        items: { hat: hat([{ stat: 'cdr', value: 2 }, { stat: 'dex%', value: 10 }]) } };

    test('the curve interpolates and clamps', () => {
        assert.equal(E.cdrCurveAt(curve, 0), 0);
        assert.equal(E.cdrCurveAt(curve, 3), 47);
        assert.equal(E.cdrCurveAt(curve, 2.5), 34);
        assert.equal(E.cdrCurveAt(curve, 12), 80);
    });

    test('gear CDR comes from the potential lines, not the stat window', () => {
        assert.equal(E.analysisStats(build, { cdrCurve: curve }).cdr, 2);
    });

    test('whole rolls score on the curve: the chart examples', () => {
        const st = E.analysisStats(build, { cdrCurve: curve });
        const bare = E.applyDelta(st, E.negateDelta(E.linesDelta(build.items.hat.potLines, 'Pathfinder', 285)));
        const score = E.lineSetScorer(bare, 'mainPct', 'Pathfinder', 285, 380);
        near(score([{ stat: 'cdr', value: 2 }, { stat: 'cdr', value: 1 }]), 47, 1e-9);
        near(score([{ stat: 'cdr', value: 2 }, { stat: 'cdr', value: 1 }, { stat: 'dex%', value: 10 }]), 57, 1e-9);
        near(score([{ stat: 'cdr', value: 2 }, { stat: 'cdr', value: 2 }]), 75, 1e-9);
    });

    test('without a curve cooldown stays a flat FD multiplier', () => {
        const st = E.analysisStats(build, {});
        assert.equal(st.cdrCurve, null);
        near(E.fdGain(st, { cdr: 1 }), 0.7 / 1.014 , 1e-6);   // 2s -> 3s at 0.7% FD per second
    });
});

describe('sets and item swaps', () => {
    const cat = name => E.GEAR_CATALOG.find(g => g.name === name);
    const item = (slot, name, stars = 22) => ({ ...E.newItem(slot, cat(name)), stars });
    const genesis = { ...E.newItem('weapon', cat('Genesis Weapon')), baseStats: { int: 150, luk: 150, matt: 406 } };
    const craBuild = () => ({
        weapon: genesis,
        hat: item('hat', 'CRA Hat'), top: item('top', 'CRA Top'), bottom: item('bottom', 'CRA Bottom'),
    });

    test('a lucky weapon tops up sets with 3 real pieces', () => {
        const counts = E.setCounts(craBuild());
        assert.equal(counts.CRA, 4);
        assert.equal(counts.Eternal, 1);
        const two = craBuild();
        delete two.bottom;
        assert.equal(E.setCounts(two).CRA, 2);
    });

    test('set thresholds stack', () => {
        const d = E.setDelta(craBuild(), 'Ice/Lightning');
        assert.equal(d.boss, 30);                     // CRA 4
        assert.equal(d.att, 50);                      // CRA 3
        assert.equal(d.mainBase, 20 + 9);             // CRA 2 + 3
    });

    test('swapping there and back is free', () => {
        const items = craBuild();
        const next = item('hat', 'Eternal Hat');
        const there = E.swapDelta(items, 'hat', next, 'Ice/Lightning', 280);
        const back = E.swapDelta({ ...items, hat: next }, 'hat', items.hat, 'Ice/Lightning', 280);
        const after = E.applyDelta(E.applyDelta(SHEET, there), back);
        const want = E.normalizeStats(SHEET);
        for (const k of Object.keys(want)) if (typeof want[k] === 'number') near(after[k], want[k], 1e-9);
    });

    test('breaking a lucky-held set can make one piece a loss and the whole set a gain', () => {
        const items = craBuild();
        const stats = { ...SHEET, att: 3000 };
        const one = E.fdGain(stats, E.swapDelta(items, 'hat', item('hat', 'Eternal Hat'), 'Ice/Lightning', 280));
        const all = E.fdGain(stats, E.swapDeltaMany(items, {
            hat: item('hat', 'Eternal Hat'), top: item('top', 'Eternal Top'), bottom: item('bottom', 'Eternal Bottom'),
        }, 'Ice/Lightning', 280));
        assert.ok(one < 0, `one piece ${one}`);
        assert.ok(all > 0, `whole set ${all}`);
    });

    test('items with unknown base stats cannot be priced', () => {
        const items = { face: item('face', 'Berserked') };
        assert.equal(E.swapDelta(items, 'face', E.newItem('face', cat('Twilight Mark')), 'Bowmaster', 280), null);
    });

    test('swap options list whole-set moves with their set changes', () => {
        const build = { className: 'Ice/Lightning', stats: { ...SHEET, att: 3000 }, items: craBuild() };
        const opts = E.swapOptions(build, {}, { charLevel: 280 });
        const whole = opts.find(o => o.whole && /Eternal/.test(o.to));
        assert.ok(whole, 'expected a whole-set CRA to Eternal swap');
        assert.match(whole.sets, /CRA 4→0/);
        assert.ok(!opts.some(o => !o.whole && o.to === 'Eternal Hat'), 'the lone Eternal hat is a loss and should not be listed');
    });
});

describe('lucky weapon scope', () => {
    const cat = name => E.GEAR_CATALOG.find(g => g.name === name);
    test('accessory sets have no weapon piece, so the lucky weapon does not top them up', () => {
        const items = {
            weapon: E.newItem('weapon', cat('Genesis Weapon')),
            ring1: E.newItem('ring1', cat('Superior Gollux Ring')),
            pendant1: E.newItem('pendant1', cat('Superior Gollux Pendant')),
            earring: E.newItem('earring', cat('Superior Gollux Earring')),
            face: E.newItem('face', cat('Berserked')), eye: E.newItem('eye', cat('Magic Eyepatch')),
            belt: E.newItem('belt', cat('Dreamy Belt')),
            shoes: E.newItem('shoes', cat('Arcane Umbra Shoes')), gloves: E.newItem('gloves', cat('Arcane Umbra Gloves')),
            cape: E.newItem('cape', cat('Arcane Umbra Cape')),
        };
        const c = E.setCounts(items);
        assert.equal(c['Superior Gollux'], 3);
        assert.equal(c['Pitched Boss'], 3);
        assert.equal(c['Arcane Umbra'], 4);
    });
});

describe('swap break-even star force', () => {
    const cat = name => E.GEAR_CATALOG.find(g => g.name === name);
    const item = (slot, name, stars = 22) => ({ ...E.newItem(slot, cat(name)), stars });
    const items = {
        weapon: { ...E.newItem('weapon', cat('Genesis Weapon')), baseStats: { int: 150, luk: 150, matt: 406 } },
        hat: item('hat', 'CRA Hat', 21), top: item('top', 'CRA Top', 21), bottom: item('bottom', 'CRA Bottom', 21),
    };
    const build = { className: 'Ice/Lightning', stats: { ...SHEET, att: 3000 }, items };

    test('the whole-set swap breaks even at the first star where it stops losing', () => {
        const whole = E.swapOptions(build, {}, { charLevel: 280 }).find(o => o.whole && /Eternal/.test(o.to));
        assert.ok(whole && whole.breakEven, 'expected a break-even');
        const at = star => E.fdGain(E.analysisStats(build, {}), E.swapDeltaMany(items, {
            hat: item('hat', 'Eternal Hat', star), top: item('top', 'Eternal Top', star), bottom: item('bottom', 'Eternal Bottom', star),
        }, 'Ice/Lightning', 280));
        const be = whole.breakEven.stars;
        assert.ok(be > 0 && be <= whole.stars);
        assert.ok(at(be) >= 0, `gain at ${be}★`);
        assert.ok(at(be - 1) < 0, `gain at ${be - 1}★`);
        assert.ok(whole.breakEven.cost < whole.cost);
    });
});

describe('whole-set swaps piece by piece', () => {
    const cat = name => E.GEAR_CATALOG.find(g => g.name === name);
    const item = (slot, name, stars = 22) => ({ ...E.newItem(slot, cat(name)), stars });
    const items = {
        weapon: { ...E.newItem('weapon', cat('Genesis Weapon')), baseStats: { int: 150, luk: 150, matt: 406 } },
        hat: item('hat', 'CRA Hat', 22), top: item('top', 'CRA Top', 22), bottom: item('bottom', 'CRA Bottom', 22),
    };
    const build = { className: 'Ice/Lightning', stats: { ...SHEET, att: 3000 }, items };
    // 22-star CRA against 22-star Eternals: the first piece out breaks CRA's lucky-held set.
    const whole = E.swapOptions(build, {}, { charLevel: 280 }).find(o => o.whole && /Eternal/.test(o.to));

    test('the steps compound to the whole-set gain', () => {
        assert.equal(whole.steps.length, 3);
        near(whole.steps[whole.steps.length - 1].cumulative, whole.fdGain, 1e-6);
    });

    test('a step that drops the lucky weapon is explained and has no break-even of its own', () => {
        const loss = whole.steps.find(st => st.gain < 0);
        assert.ok(loss, 'expected the first CRA piece out to lose on its own');
        assert.equal(loss.breakEven, null);
        assert.match(loss.why, /lucky weapon stops counting/);
        assert.match(loss.sets, /CRA 4→2/);
    });
});
