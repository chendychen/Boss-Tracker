import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const context = vm.createContext({});
for (const f of ['upgrade-tables.js', 'upgrade-engine.js', 'scouter-screenshot.js']) {
    vm.runInContext(readFileSync(join(__dirname, '..', f), 'utf8'), context);
}
const S = context.ScouterScreenshot;

// What Tesseract read off a Bowmaster's Enter Directly page (stats panel only, 4x).
const BOWMASTER = `Enter Directly (Character Stats Changes) Recall Saved Preset [i) Save Preset &,
Level 295 Class Bow Master v

# Reboot # Liberation Exo] gut Mugong Soul

Base Value % Value % Value Not Applied

DEX 7054 525 31410
STR 4453 256 570
Attack 3790 106 0
General Range 132131728 Damage 59
Final Damage 157.16 Boss Damage 696
Ignore Enemy Defen... 98.94 Normal Enemy Dam...
Attack 7807 Critical Rate 242
M.Attack 7807 Critical Damage 142
Cooldown Reduction O Second 6 % Buff Duration 64
Cooldown Skip 75 Ignore Elemental Re... 1.5
Additional Status D... 22 Summon Duration 12
Arcane Force 1350 Sacred Force 800
`;

describe('MapleScouter screenshot text', () => {
    test('reads the stat table and the single fields', () => {
        const p = S.parseScouterText(BOWMASTER);
        assert.equal(p.level, 295);
        assert.equal(p.className, 'Bowmaster');
        assert.deepEqual({ ...p.rows.dex }, { base: 7054, pct: 525, flat: 31410 });
        assert.deepEqual({ ...p.rows.str }, { base: 4453, pct: 256, flat: 570 });
        assert.deepEqual({ ...p.rows.att }, { base: 3790, pct: 106, flat: 0 });
        assert.equal(p.damage, 59);
        assert.equal(p.boss, 696);
        assert.equal(p.finalDamage, 157.16);
        assert.equal(p.ied, 98.94);
        assert.equal(p.critDmg, 142);
        assert.equal(p.statusDmg, 22);
        assert.equal(p.ier, 1.5);
        assert.equal(p.sacredForce, 800);
    });

    test('maps onto the stat sheet', () => {
        const { stats, missing } = S.statsFromScouter(S.parseScouterText(BOWMASTER), 'Bowmaster');
        assert.deepEqual({ ...stats }, {
            mainBase: 7054, mainPct: 525, mainFlat: 31410, subBase: 4453, subPct: 256, subFlat: 570,
            att: 3790, attPct: 106, dmg: 59, boss: 696, statusDmg: 22, critDmg: 142, ied: 98.94,
        });
        assert.equal(missing.length, 0);
    });

    test('a dropped decimal point in IED is put back', () => {
        assert.equal(S.parseScouterText('Ignore Enemy Defen... 9894 Normal Enemy Dam...').ied, 98.94);
    });

    test('missing fields are reported rather than guessed', () => {
        const { stats, missing } = S.statsFromScouter(S.parseScouterText('Boss Damage 696'), 'Bowmaster');
        assert.deepEqual({ ...stats }, { boss: 696 });
        assert.ok(missing.includes('mainBase') && missing.includes('dmg'));
    });

    test('class names match through spacing and a trailing dropdown arrow', () => {
        assert.equal(S.matchClass('Bow Master Vv'), 'Bowmaster');
        assert.equal(S.matchClass('Night Lord'), 'Night Lord');
        assert.equal(S.matchClass('Demon Avenger v'), 'Demon Avenger');
        assert.equal(S.matchClass('Something Else'), null);
    });

    test('a MapleScouter preset reads abnormal status damage into its own field', () => {
        const b = context.UpgradeEngine.importBuild({ type: 'maplescouter-manual-preset',
            data: { stat: { myClass: '보우마스터', dmg: '59', statusAdditionalDmg: '22', bossDmg: '696' } } });
        assert.equal(b.stats.dmg, 59);
        assert.equal(b.stats.statusDmg, 22);
    });
});

describe('other classes on the Enter Directly page', () => {
    const DEMON_AVENGER = `Level 285 Class Demon Avenger
Base Value % Value % Value Not Applied
HP 131907 546 630800
STR 3962 84 510
Attack 3585 69 0
General Range 116813423 Damage 104
Final Damage 108.79 Boss Damage 496
Ignore Enemy Defen... 96.08 Normal Enemy Dam...
M.Attack 6058 Critical Damage 128.2
Additional Status D... 22 Summon Duration 12
`;
    const ICE_LIGHTNING = `Level 280 Class Ice Lightning v
INT 5451 426 25990
LUK 3275 173 410
M.Attack 2953 47 0
General Range 98754915 Damage 95
Final Damage 326.50 Boss Damage 438
Ignore Enemy Defen... 98.94 Normal Enemy Dam...
M.Attack 4340 Critical Damage 111.85
Additional Status D... 20 Summon Duration 12
`;

    test('Demon Avenger reads HP as the main stat', () => {
        const p = S.parseScouterText(DEMON_AVENGER);
        assert.equal(p.className, 'Demon Avenger');
        const { stats } = S.statsFromScouter(p, 'Demon Avenger');
        assert.equal(stats.mainBase, 131907);
        assert.equal(stats.mainFlat, 630800);
        assert.equal(stats.subBase, 3962);
        assert.equal(stats.att, 3585);
        assert.equal(stats.dmg, 104);
        assert.equal(stats.statusDmg, 22);
    });

    test('a mage reads INT, LUK and the MATT row', () => {
        const p = S.parseScouterText(ICE_LIGHTNING);
        assert.equal(p.className, 'Ice/Lightning');
        const { stats, missing } = S.statsFromScouter(p, 'Ice/Lightning');
        assert.deepEqual([stats.mainBase, stats.mainPct, stats.subBase, stats.att, stats.attPct, stats.critDmg],
            [5451, 426, 3275, 2953, 47, 111.85]);
        assert.equal(missing.length, 0);
    });

    test('a Demon Avenger sheet is valued by HP whatever filled it', () => {
        const E = context.UpgradeEngine;
        const st = E.analysisStats({ className: 'Demon Avenger', stats: { mainBase: 100000, subBase: 4000, att: 3000 }, items: {} });
        assert.equal(st.model, 'hp');
        const b = E.importBuild({ type: 'maplescouter-manual-preset', data: { stat: { myClass: '데몬어벤져' } } });
        assert.equal(b.stats.model, 'hp');
    });
});

describe('MapleScouter results page', () => {
    // What Tesseract read off a results page's left column.
    const RESULTS = `Combat Power
ITEMSTAT 827572161
HEXA
STAT Ee
Dojo 663,782,515
Boss 300 Boss 380
Normal 108,137 Normal 108,598
HEXA 108137 HEXA 108,598
Scouter Graph
Stat Efficiency
ATT/MATT per 40% BD | | ATT/MATT per 45% BD
(85) w— (08) wm
`;

    test('is told apart from the Enter Directly page', () => {
        assert.ok(S.isResultsPage(RESULTS));
        assert.ok(!S.isResultsPage('Base Value % Value % Value Not Applied\nDEX 7054 525 31410'));
    });

    test('hexa converted is the HEXA figure under Boss 380', () => {
        assert.equal(S.parseResultsText(RESULTS).hexaConverted, 108598);
        assert.equal(S.parseResultsText('HEXA 73,418').hexaConverted, 73418);
    });

    test('a bubble read without its decimal point gets it back', () => {
        assert.equal(S.bubbleValue('85'), 8.5);
        assert.equal(S.bubbleValue('4.6'), 4.6);
        assert.equal(S.bubbleValue('103'), 10.3);
        assert.equal(S.bubbleValue(''), null);
    });

    test('the bubble is looked for under its own card, even when OCR misspells the label', () => {
        const words = [
            { t: 'ATT/MATT', x0: 33, x1: 84, y0: 769, y1: 778 }, { t: 'per', x0: 88, x1: 102, y0: 769, y1: 778 },
            { t: '40%', x0: 105, x1: 127, y0: 769, y1: 777 }, { t: 'ADD', x0: 131, x1: 152, y0: 769, y1: 777 },
            { t: 'ATTMAT', x0: 180, x1: 231, y0: 769, y1: 778 }, { t: 'per', x0: 234, x1: 249, y0: 769, y1: 778 },
            { t: '40%', x0: 252, x1: 274, y0: 769, y1: 777 }, { t: 'EQP', x0: 278, x1: 298, y0: 769, y1: 778 },
            { t: 'ID', x0: 234, x1: 243, y0: 787, y1: 795 },
        ];
        const r = S.bubbleRegion(words, /^EQP$/);
        assert.ok(r.x > 160 && r.x < 180, `left edge ${r.x}`);
        assert.ok(r.y > 795, `below the ID line, got ${r.y}`);
    });
});
