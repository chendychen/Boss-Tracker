import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

// The engine as the page loads it: the upgrade engine first, for class skill IED.
const __dirname = dirname(fileURLToPath(import.meta.url));
const context = vm.createContext({});
for (const f of ['upgrade-tables.js', 'upgrade-engine.js', 'boss-engine.js']) {
    vm.runInContext(readFileSync(join(__dirname, '..', f), 'utf8'), context);
}
const B = context.BossEngine;
const bossData = B.bossData;

// Objects built inside the vm have another realm's prototypes; compare them as data.
const plain = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected, tolerance = 1e-9) =>
    assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
        `${actual} is not within ${tolerance} of ${expected}`);

function makeCharacter(overrides = {}) {
    return {
        id: 1,
        name: 'Test',
        selectedBosses: new Set(),
        bossPartyCount: {},
        bossDifficulty: {},
        ...overrides
    };
}

// Reads a crystal value straight from the data, so price updates don't break tests.
function bossValue(baseName, difficulty) {
    return bossData.find(b => b.baseName === baseName).difficulties[difficulty].value;
}

/** Runs `fn` with these boss changes in place of the recorded ones, then puts those back. */
function withChanges(changes, fn) {
    const recorded = B.BOSS_CHANGES.splice(0, B.BOSS_CHANGES.length, ...changes);
    try { return fn(); } finally { B.BOSS_CHANGES.splice(0, B.BOSS_CHANGES.length, ...recorded); }
}

// ── Crystal prices ─────────────────────────────────────────────────────────

describe('parseBossName', () => {
    test('extracts difficulty and base name', () => {
        assert.deepEqual(plain(B.parseBossName('Hard Kaling')), { difficulty: 'Hard', baseName: 'Kaling' });
        assert.deepEqual(plain(B.parseBossName('Extreme Lotus')), { difficulty: 'Extreme', baseName: 'Lotus' });
        assert.deepEqual(plain(B.parseBossName('Chaos Guardian Angel Slime')), { difficulty: 'Chaos', baseName: 'Guardian Angel Slime' });
    });

    test('returns null difficulty for names without prefix', () => {
        const result = B.parseBossName('SomeBoss');
        assert.equal(result.difficulty, null);
        assert.equal(result.baseName, 'SomeBoss');
    });
});

describe('boss list', () => {
    test('Black Mage is in the boss list with both difficulties', () => {
        const blackMage = bossData.find(b => b.baseName === 'Black Mage');
        assert.ok(blackMage, 'Black Mage should exist');
        assert.ok('Extreme' in blackMage.difficulties);
        assert.ok('Hard' in blackMage.difficulties);
    });

    test('bosses are grouped correctly — Kaling has multiple difficulties', () => {
        const kaling = bossData.find(b => b.baseName === 'Kaling');
        assert.deepEqual(plain(Object.keys(kaling.difficulties)).sort(), ['Easy', 'Extreme', 'Hard', 'Normal']);
    });

    test('default difficulty is the highest value one', () => {
        assert.equal(bossData.find(b => b.baseName === 'Kaling').defaultDifficulty, 'Extreme');
        bossData.forEach(boss => {
            const highest = Math.max(...Object.values(boss.difficulties).map(d => d.value));
            assert.equal(boss.value, highest, `${boss.baseName} should sort on its highest difficulty`);
        });
    });

    test('list is ordered by highest-difficulty price, descending', () => {
        const values = plain(bossData.map(b => b.value));
        assert.deepEqual(values, [...values].sort((a, b) => b - a));
    });

    test('every priced boss has combat data, so Progression can price it', () => {
        const priced = B.bossDataFlat.length;
        assert.equal(B.allCombatEntries().length, priced);
    });
});

describe('calculateTotal', () => {
    test('returns 0 for empty character', () => {
        assert.equal(B.calculateTotal(makeCharacter()), 0);
    });

    test('sums adjusted values correctly', () => {
        const char = makeCharacter({ selectedBosses: new Set(['Kaling', 'Lotus']) });
        assert.equal(B.calculateTotal(char), bossValue('Kaling', 'Extreme') + bossValue('Lotus', 'Extreme'));
    });

    test('party count divides crystal value', () => {
        const char = makeCharacter({ selectedBosses: new Set(['Kaling']), bossPartyCount: { Kaling: 2 } });
        assert.equal(B.calculateTotal(char), bossValue('Kaling', 'Extreme') / 2);
    });

    test('caps at 14 bosses, keeping highest adjusted values', () => {
        const char = makeCharacter({ selectedBosses: new Set(bossData.slice(0, 15).map(b => b.baseName)) });
        assert.equal(B.calculateTotal(char), bossData.slice(0, 14).reduce((sum, b) => sum + b.value, 0));
    });

    test('difficulty override changes total', () => {
        const charExtreme = makeCharacter({ selectedBosses: new Set(['Kaling']) });
        const charEasy = makeCharacter({ selectedBosses: new Set(['Kaling']), bossDifficulty: { Kaling: 'Easy' } });
        assert.equal(B.calculateTotal(charEasy), bossValue('Kaling', 'Easy'));
        assert.ok(B.calculateTotal(charExtreme) > B.calculateTotal(charEasy));
    });
});

// ── Weeks, months and the sale plan ────────────────────────────────────────

describe('crystal week and month', () => {
    test('the week starts on Thursday 00:00 UTC', () => {
        assert.equal(B.currentCrystalWeek(new Date('2026-11-10T12:00:00Z')), '2026-11-05');   // a Tuesday
        assert.equal(B.currentCrystalWeek(new Date('2026-11-11T23:59:59Z')), '2026-11-05');
        assert.equal(B.currentCrystalWeek(new Date('2026-11-12T00:00:00Z')), '2026-11-12');
    });

    test('a week runs across a month and a year end', () => {
        assert.equal(B.currentCrystalWeek(new Date('2027-01-02T08:00:00Z')), '2026-12-31');
    });

    test('the month is the UTC month', () => {
        assert.equal(B.currentMonth(new Date('2026-11-30T23:59:59Z')), '2026-11');
        assert.equal(B.currentMonth(new Date('2026-12-01T00:00:00Z')), '2026-12');
    });

    test("last week's ticks no longer count", () => {
        const char = makeCharacter({ crystalsDone: { week: '2026-11-05', bosses: ['Kaling'] } });
        assert.ok(B.getCrystalsDone(char, new Date('2026-11-10T12:00:00Z')).has('Kaling'));
        assert.equal(B.getCrystalsDone(char, new Date('2026-11-12T00:00:00Z')).size, 0);
    });
});

describe('crystalSalePlan', () => {
    const NOW = new Date('2026-11-10T12:00:00Z');
    const WEEK = '2026-11-05';
    const weekly = bossData.filter(b => b.baseName !== B.BLACK_MAGE).map(b => b.baseName);
    const fourteen = weekly.slice(0, 14);
    const cheapest = fourteen[13], secondCheapest = fourteen[12];

    test('a character sells its 14 most valuable crystals', () => {
        const char = makeCharacter({ selectedBosses: new Set(weekly.slice(0, 16)) });
        const plan = B.crystalSalePlan([char], NOW);
        assert.equal(plan.counted.length, 14);
        assert.deepEqual(plain(plan.overflow.map(b => b.baseName)).sort(), plain(weekly.slice(14, 16)).sort());
        assert.ok(plan.overflow.every(b => b.reason === 'character'));
        assert.equal(plan.accountLimitHit, false);
    });

    test('the account sells 180, and the top of the roster drops equal crystals', () => {
        const roster = Array.from({ length: 13 }, (_, i) =>
            makeCharacter({ id: i + 1, name: `C${i + 1}`, selectedBosses: new Set(fourteen) }));
        const plan = B.crystalSalePlan(roster, NOW);
        assert.equal(plan.counted.length, 180);
        assert.equal(plan.accountLimitHit, true);
        assert.deepEqual(plain(plan.overflow.map(b => [b.characterId, b.baseName, b.reason])).sort(),
            [[1, cheapest, 'account'], [2, cheapest, 'account']]);
    });

    test('Black Mage counts only in the week it is run, in place of the lowest crystal', () => {
        const char = makeCharacter({ selectedBosses: new Set(fourteen), blackMage: { plannedWeek: WEEK } });
        const plan = B.crystalSalePlan([char], NOW);
        assert.ok(plan.counted.some(b => b.baseName === B.BLACK_MAGE && b.difficulty === 'Hard' && b.monthly));
        assert.deepEqual(plain(plan.overflow.map(b => b.baseName)), [cheapest]);

        const nextWeek = B.crystalSalePlan([char], new Date('2026-11-13T00:00:00Z'));
        assert.ok(!nextWeek.counted.some(b => b.baseName === B.BLACK_MAGE));
        assert.equal(nextWeek.overflow.length, 0);
    });

    test('a crystal already sold keeps its place', () => {
        const char = makeCharacter({
            selectedBosses: new Set(fourteen), blackMage: { plannedWeek: WEEK },
            crystalsDone: { week: WEEK, bosses: [cheapest] },
        });
        assert.deepEqual(plain(B.crystalSalePlan([char], NOW).overflow.map(b => b.baseName)), [secondCheapest]);
    });
});

// ── Damage multipliers ─────────────────────────────────────────────────────

describe('level, force and defense multipliers', () => {
    test('level advantage caps at +20% from five levels over', () => {
        assert.equal(B.levelMultiplier(285, 280), 1.20);
        assert.equal(B.levelMultiplier(300, 280), 1.20);
        near(B.levelMultiplier(282, 280), 1.14);
        assert.equal(B.levelMultiplier(280, 280), 1.10);
    });

    test('being under the boss costs damage, down to nothing at 40 under', () => {
        near(B.levelMultiplier(279, 280), 1.0584);
        near(B.levelMultiplier(276, 280), 0.918);
        near(B.levelMultiplier(275, 280), 0.88);
        assert.equal(B.levelMultiplier(240, 280), 0);
    });

    test('Sacred Force gives 1% per 2 over, to 25%, and costs 1% per point under', () => {
        assert.equal(B.forceMultiplier(null, 300, 'sac'), 1.25);
        assert.equal(B.forceMultiplier(350, 300, 'sac'), 1.25);
        near(B.forceMultiplier(320, 300, 'sac'), 1.10);
        near(B.forceMultiplier(290, 300, 'sac'), 0.90);
        assert.equal(B.forceMultiplier(500, null, 'sac'), 1);
    });

    test('Arcane Force steps by share of the requirement, 1350 when blank', () => {
        assert.equal(B.forceMultiplier(1350, 760, 'af'), 1.5);
        assert.equal(B.forceMultiplier(null, 760, 'af'), 1.5);
        assert.equal(B.forceMultiplier(null, 1320, 'af'), 1);      // Black Mage: 102%
        near(B.forceMultiplier(1000, 760, 'af'), 1.3);
        near(B.forceMultiplier(700, 760, 'af'), 0.8);
    });

    test('defense is 1 - PDR x (1 - IED)', () => {
        near(B.defenseMultiplier(300, 98), 0.94);
        near(B.defenseMultiplier(380, 98), 0.924);
        assert.equal(B.defenseMultiplier(380, 50), 0);
    });

    test('PDR is 380 from Chosen Seren on and for Extreme Lotus, else 300', () => {
        assert.equal(B.bossPdr('Kaling', 'Easy'), 380);
        assert.equal(B.bossPdr('Lotus', 'Extreme'), 380);
        assert.equal(B.bossPdr('Lotus', 'Hard'), 300);
        assert.equal(B.bossPdr('Will', 'Hard'), 300);
    });
});

describe('effectiveHP', () => {
    test('prices each phase at its own level: Normal Kalos P1 is 275, P2 is 280', () => {
        const eff = B.effectiveHP('Kalos the Guardian', 'Normal', makeCharacter({ charLevel: 280 }), null);
        assert.equal(eff.phases[0].levelMult, 1.20);
        assert.equal(eff.phases[1].levelMult, 1.10);
        near(eff.phases[0].effective, 336e12 / (1.20 * 1.25 * 0.924));
        near(eff.phases[1].effective, 720e12 / (1.10 * 1.25 * 0.924));
        near(eff.total, eff.phases[0].effective + eff.phases[1].effective);
        assert.equal(eff.blocked, null);
        assert.equal(eff.limit, 30 * 60);
    });

    test('flags a character under the force floor and applies the penalty', () => {
        const eff = B.effectiveHP('Kalos the Guardian', 'Normal', makeCharacter({ charLevel: 280, sacredForce: 280 }), null);
        assert.equal(eff.blocked, 'SAC 280 < 300');
        near(eff.phases[1].forceMult, 0.80);
    });

    test('more IED means less to deal, by each boss\'s own PDR', () => {
        const low = B.effectiveHP('Kaling', 'Normal', makeCharacter({ ied: 95 }), null).total;
        const high = B.effectiveHP('Kaling', 'Normal', makeCharacter({ ied: 98 }), null).total;
        near(low / high, 0.924 / 0.81);
    });

    test('is null for a boss with no combat data', () => {
        assert.equal(B.effectiveHP('Nobody', 'Hard', makeCharacter(), null), null);
    });
});

// ── Burst cadence and pace ─────────────────────────────────────────────────

describe('burst cadence', () => {
    test('16 bursts fit in 30:00 and 11 in 20:00', () => {
        assert.equal(B.burstsInFight(), 16);
        assert.equal(B.burstsInFight(20 * 60), 11);
    });

    test('60% of a cycle lands in the burst window', () => {
        near(B.damageByTime(B.BURST_CYCLE, 1), B.BURST_CYCLE);
        near(B.damageByTime(B.BURST_WINDOW, 1), 0.6 * B.BURST_CYCLE);
        near(B.damageByTime(3 * B.BURST_CYCLE + B.BURST_WINDOW, 2), 2 * 3.6 * B.BURST_CYCLE);
    });

    test('timeForDamage inverts damageByTime', () => {
        for (const t of [10, 25, 100, 420, 1799]) near(B.timeForDamage(B.damageByTime(t, 5e9), 5e9), t, 1e-6);
        assert.equal(B.timeForDamage(1, 0), Infinity);
    });
});

describe('bossPace', () => {
    const char = makeCharacter({ charLevel: 280 });
    const total = B.effectiveHP('Chosen Seren', 'Normal', char, null).total;

    test('damage that just fills the timer clears with nothing spare', () => {
        const pace = B.bossPace('Chosen Seren', 'Normal', char, total / B.damageByTime(1800, 1), null);
        assert.ok(pace.clears);
        near(pace.clearTime, 1800, 1e-6);
        near(pace.spareBursts, 0, 1e-4);
        near(pace.damageNeeded, 1);
    });

    test('half that damage is short by half the fight', () => {
        const pace = B.bossPace('Chosen Seren', 'Normal', char, total / B.damageByTime(1800, 1) / 2, null);
        assert.equal(pace.clears, false);
        near(pace.damageNeeded, 2);
        assert.ok(pace.shortBursts > 0);
    });

    test('phases are killed in order, the last at the clear time', () => {
        const pace = B.bossPace('Chosen Seren', 'Normal', char, 1e12, null);
        assert.ok(pace.phases[0].killBy < pace.phases[1].killBy);
        near(pace.phases[1].killBy, pace.clearTime);
        near(pace.phases.reduce((s, p) => s + p.share, 0), 1);
    });
});

// ── Predictors ─────────────────────────────────────────────────────────────

describe('calibrated run', () => {
    const run = makeCharacter({
        charLevel: 280, calibBoss: 'Chosen Seren', calibDifficulty: 'Normal', calibMinutes: 7, calibParty: 1,
    });

    test('predicts its own boss at the time it was cleared in', () => withChanges([], () => {
        const pace = B.predictPace(run, 'Chosen Seren', 'Normal');
        assert.equal(pace.source, 'run');
        near(pace.clearTime, 7 * 60, 1e-6);
    }));

    test('a party clear splits the boss evenly', () => {
        near(B.runDps({ ...run, calibParty: 2 }), B.runDps(run) / 2);
    });

    test('a DPS set directly wins over the timed clear', () => {
        assert.equal(B.runDps({ ...run, manualDps: 500 }), 500e9);
    });

    test('is the predictor ahead of MapleScouter, with the site % only as a last resort', () => {
        assert.deepEqual(plain(B.predictionSources({ ...run, hexaConverted: 60000, calibPercent: 120 })), ['run', 'scouter']);
        assert.deepEqual(plain(B.predictionSources(makeCharacter({
            calibBoss: 'Chosen Seren', calibDifficulty: 'Normal', calibPercent: 120,
        }))), ['site']);
        assert.deepEqual(plain(B.predictionSources(makeCharacter())), []);
    });

    test('a site clear % is divided by the execution factor, 1.3 unless set', () => {
        const site = makeCharacter({ charLevel: 280, calibBoss: 'Chosen Seren', calibDifficulty: 'Normal', calibPercent: 100 });
        const full = B.effectiveHP('Chosen Seren', 'Normal', site, null).total / B.damageByTime(1800, 1);
        near(B.siteDps(site), full / 1.3);
        near(B.siteDps({ ...site, executionFactor: 1 }), full);
    });
});

describe('MapleScouter cut', () => {
    // Five levels over Normal Kalos with Sacred Force capped: the card is hexa converted itself.
    const atThreshold = makeCharacter({ charLevel: 285, hexaConverted: B.SCOUTER_THRESHOLDS['Kalos the Guardian|Normal'] });

    test('a card on the threshold is a 100% cut, which just clears', () => withChanges([], () => {
        near(B.scouterCut(atThreshold, 'Kalos the Guardian', 'Normal'), 100);
        const pace = B.sourcePace(atThreshold, 'Kalos the Guardian', 'Normal', 'scouter');
        near(pace.clearTime, 1800, 1e-6);
    }));

    test('the cut grows with hexa converted to the power k', () => {
        const stronger = { ...atThreshold, hexaConverted: atThreshold.hexaConverted * 1.1 };
        near(B.scouterCut(stronger, 'Kalos the Guardian', 'Normal'), 100 * Math.pow(1.1, B.SCOUTER_K));
    });

    test('a lower level shrinks the card', () => {
        const lower = { ...atThreshold, charLevel: 280 };
        assert.ok(B.scouterCardValue(lower, 'Kalos the Guardian', 'Normal') < atThreshold.hexaConverted);
    });

    test('a boss without a threshold is priced from the Normal Kalos cut', () => {
        assert.equal(B.scouterCut(atThreshold, 'Chosen Seren', 'Normal'), null);
        near(B.scouterDps(atThreshold, 'Chosen Seren', 'Normal'), B.scouterDps(atThreshold));
    });

    test('the execution factor scales the estimate down', () => {
        near(B.scouterDps({ ...atThreshold, executionFactor: 1.25 }), B.scouterDps(atThreshold) / 1.25);
    });
});

describe('upgrades since a calibration', () => {
    test('a recorded gain is carried into the calibration it follows, and an undo takes it back', () => {
        const char = makeCharacter({ charLevel: 285, hexaConverted: 60000 });
        const before = B.scouterDps(char);
        B.recordUpgradeGain(char, 1.02, 98);
        assert.equal(char.calibAnchors.hexa.upgrades, 1);
        assert.equal(char.calibAnchors.calib, undefined);
        near(B.scouterDps(char), before * 1.02);

        B.recordUpgradeGain(char, 1 / 1.02, 98, -1);
        assert.equal(char.calibAnchors.hexa.upgrades, 0);
        near(B.scouterDps(char), before);
    });

    test('a calibration keeps the stat-window IED it was measured at', () => {
        const char = makeCharacter({
            charLevel: 280, ied: 95, calibBoss: 'Chosen Seren', calibDifficulty: 'Normal', calibMinutes: 7,
        });
        const before = B.runDps(char);
        B.resetCalibAnchor(char, 'calib');
        char.ied = 98;                                   // an IED upgrade after the run
        near(B.runDps(char), before);                    // the run meant the same damage
        assert.ok(B.predictPace(char, 'Chosen Seren', 'Normal').clearTime < 7 * 60);
    });
});

// ── Bosses over time ───────────────────────────────────────────────────────

describe('boss changes by date', () => {
    const PATCH = [{
        from: '2026-11-11',
        bosses: {
            'Chosen Seren|Normal': { hp: 2 / 3, limit: 20 * 60 },
            'Kalos the Guardian|Normal': { hp: 2 / 3, limit: 20 * 60 },
            'Test Boss|Hard': { lv: 280, sac: 500, af: null, ph: [[1e15, 280, 500, 1]], limit: 15 * 60 },
        },
    }];
    const run = makeCharacter({
        charLevel: 280, calibBoss: 'Chosen Seren', calibDifficulty: 'Normal', calibMinutes: 7, calibParty: 1,
    });

    test('v.272 put every boss on a 20:00 limit from 11 Nov 2026, with about a third less HP', () => {
        const hp = data => data.ph.reduce((sum, p) => sum + p[0], 0);
        for (const { baseName, difficulty, fullName } of B.allCombatEntries()) {
            const before = B.bossCombat(baseName, difficulty, '2026-11-10');
            const after = B.bossCombat(baseName, difficulty, '2026-11-11');
            assert.equal(before.limit, 30 * 60, fullName);
            assert.equal(after.limit, 20 * 60, fullName);
            const kept = hp(after) / hp(before);
            if (fullName === 'Hard Black Mage') near(kept, 0.351);
            else assert.ok(kept > 0.66 && kept < 0.72, `${fullName} keeps ${kept}`);
        }
        near(B.bossCombat('Chosen Seren', 'Normal', '2026-11-11').ph[0][0], 52.5e12 * 0.679);
        near(B.bossCombat('Lucid', 'Hard', '2026-11-11').ph[0][0], 50.8e12 * 0.715);
    });

    test('a boss is read as it stood on the day asked for', () => withChanges(PATCH, () => {
        const before = B.bossCombat('Chosen Seren', 'Normal', '2026-11-10');
        const after = B.bossCombat('Chosen Seren', 'Normal', '2026-11-11');
        assert.equal(before.limit, 30 * 60);
        assert.equal(before.ph[0][0], 52.5e12);
        assert.equal(after.limit, 20 * 60);
        near(after.ph[0][0], 35e12);
        assert.deepEqual(plain(after.ph[0].slice(1)), plain(before.ph[0].slice(1)));
        assert.equal(B.bossCombat('Chosen Seren', 'Normal', null).limit, 30 * 60);
        assert.equal(B.bossTimeLimit('Chosen Seren', 'Normal', '2026-12-01'), 20 * 60);
    }));

    test('bosses the patch does not name are untouched', () => withChanges(PATCH, () => {
        assert.deepEqual(plain(B.bossCombat('Kaling', 'Hard', '2026-12-01')), plain(B.bossCombat('Kaling', 'Hard', null)));
        assert.equal(B.BOSS_COMBAT['Chosen Seren'].Normal.ph[0][0], 52.5e12);   // the first table is not edited
    }));

    test('a boss a patch adds exists from that day', () => withChanges(PATCH, () => {
        assert.equal(B.bossCombat('Test Boss', 'Hard', '2026-11-10'), null);
        assert.equal(B.bossCombat('Test Boss', 'Hard', '2026-11-11').limit, 15 * 60);
    }));

    test('later changes build on earlier ones', () => withChanges(
        [...PATCH, { from: '2027-01-01', bosses: { 'Chosen Seren|Normal': { hp: 0.5 } } }], () => {
            const later = B.bossCombat('Chosen Seren', 'Normal', '2027-02-01');
            near(later.ph[0][0], 52.5e12 / 3);
            assert.equal(later.limit, 20 * 60);
        }));

    test('a run timed before the patch still means the same damage', () => {
        const dps = B.runDps(run);
        withChanges(PATCH, () => {
            near(B.runDps(run), dps);                                       // undated: before any change
            near(B.runDps({ ...run, calibDate: '2026-11-09' }), dps);
            near(B.runDps({ ...run, calibDate: '2026-11-12' }), dps * 2 / 3);  // same time on a smaller boss
        });
    });

    test('that run clears the cut-down boss faster, against the shorter limit', () => withChanges(PATCH, () => {
        const pace = B.bossPace('Chosen Seren', 'Normal', run, B.runDps(run), '2026-11-12');
        assert.equal(pace.limit, 20 * 60);
        // Two thirds of the damage takes a little under two thirds of the time: bursts come first.
        assert.ok(pace.clearTime <= 7 * 60 * 2 / 3 && pace.clearTime > 7 * 60 / 2, `cleared in ${pace.clearTime}s`);
    }));

    test('a site clear % is read against the timer of the day it was measured', () => {
        const site = makeCharacter({ charLevel: 280, calibBoss: 'Chosen Seren', calibDifficulty: 'Normal', calibPercent: 150 });
        const dps = B.siteDps(site);
        withChanges(PATCH, () => {
            near(B.siteDps(site), dps);
            const after = B.effectiveHP('Chosen Seren', 'Normal', site, '2026-11-12');
            near(B.siteDps({ ...site, calibDate: '2026-11-12' }), after.total * 1.5 / B.damageByTime(20 * 60, 1) / 1.3);
        });
    });

    test('MapleScouter keeps the table its thresholds were fitted on', () => {
        const char = makeCharacter({ charLevel: 285, hexaConverted: B.SCOUTER_THRESHOLDS['Kalos the Guardian|Normal'] });
        const dps = B.scouterDps(char);
        withChanges(PATCH, () => {
            near(B.scouterDps(char), dps);
            // A 100% cut on the old 30:00 boss still clears two thirds of it in 20:00, with
            // a little to spare because bursts land at the start of each cycle.
            const pace = B.bossPace('Kalos the Guardian', 'Normal', char, dps, '2026-11-12');
            assert.ok(pace.clears);
            assert.ok(pace.clearTime > 1150 && pace.clearTime <= 1200, `cleared in ${pace.clearTime}s`);
        });
    });
});
