import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME_DATA = JSON.parse(readFileSync(join(__dirname, '../boss-data.json'), 'utf8'));

// ── Pure logic extracted from boss-tracker.js ──────────────────────────────

function parseBossName(fullName) {
    const difficulties = ['Extreme', 'Hard', 'Chaos', 'Normal', 'Easy'];
    for (const diff of difficulties) {
        if (fullName.startsWith(diff + ' ')) {
            return { difficulty: diff, baseName: fullName.substring(diff.length + 1) };
        }
    }
    return { difficulty: null, baseName: fullName };
}

function buildBossData(gameData) {
    const bossGroups = {};
    gameData.bosses.forEach(boss => {
        const { difficulty, baseName } = parseBossName(boss.name);
        if (!bossGroups[baseName]) bossGroups[baseName] = { baseName, difficulties: {} };
        const key = difficulty ?? 'Solo';
        bossGroups[baseName].difficulties[key] = { fullName: boss.name, price: boss.price, value: boss.value };
    });

    return Object.values(bossGroups).map(group => {
        const diffEntries = Object.entries(group.difficulties);
        const highestDiff = diffEntries.reduce((max, [, data]) =>
            data.value > max.value ? data : max, diffEntries[0][1]);
        return {
            baseName: group.baseName,
            difficulties: group.difficulties,
            defaultDifficulty: Object.keys(group.difficulties).find(d => group.difficulties[d] === highestDiff),
            value: highestDiff.value
        };
    }).sort((a, b) => b.value - a.value);
}

const bossData = buildBossData(GAME_DATA);

function getBossPartyCount(character, baseName) {
    return character.bossPartyCount?.[baseName] || 1;
}

function getBossDifficulty(character, baseName) {
    const boss = bossData.find(b => b.baseName === baseName);
    if (!boss) return null;
    return character.bossDifficulty?.[baseName] || boss.defaultDifficulty;
}

function getBossValue(baseName, difficulty) {
    const boss = bossData.find(b => b.baseName === baseName);
    if (!boss || !boss.difficulties[difficulty]) return 0;
    return boss.difficulties[difficulty].value;
}

// Mirrors renderBosses(): the list is filtered but never reordered per character.
function bossListForCharacter(character, filter = '') {
    return bossData.filter(b => b.baseName.toLowerCase().includes(filter.toLowerCase()));
}

function calculateTotal(character) {
    if (!character?.selectedBosses?.size) return 0;
    return Array.from(character.selectedBosses)
        .map(baseName => {
            const diff = getBossDifficulty(character, baseName);
            return getBossValue(baseName, diff) / getBossPartyCount(character, baseName);
        })
        .sort((a, b) => b - a)
        .slice(0, 14)
        .reduce((sum, v) => sum + v, 0);
}

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

// ── Tests ──────────────────────────────────────────────────────────────────

describe('parseBossName', () => {
    test('extracts difficulty and base name', () => {
        assert.deepEqual(parseBossName('Hard Kaling'), { difficulty: 'Hard', baseName: 'Kaling' });
        assert.deepEqual(parseBossName('Extreme Lotus'), { difficulty: 'Extreme', baseName: 'Lotus' });
        assert.deepEqual(parseBossName('Chaos Guardian Angel Slime'), { difficulty: 'Chaos', baseName: 'Guardian Angel Slime' });
    });

    test('returns null difficulty for names without prefix', () => {
        const result = parseBossName('SomeBoss');
        assert.equal(result.difficulty, null);
        assert.equal(result.baseName, 'SomeBoss');
    });
});

// Reads a crystal value straight from the data, so price updates don't break tests.
function bossValue(baseName, difficulty) {
    return bossData.find(b => b.baseName === baseName).difficulties[difficulty].value;
}

describe('buildBossData', () => {
    test('Black Mage is in the boss list with both difficulties', () => {
        const blackMage = bossData.find(b => b.baseName === 'Black Mage');
        assert.ok(blackMage, 'Black Mage should exist');
        assert.ok('Extreme' in blackMage.difficulties);
        assert.ok('Hard' in blackMage.difficulties);
    });

    test('bosses are grouped correctly — Kaling has multiple difficulties', () => {
        const kaling = bossData.find(b => b.baseName === 'Kaling');
        assert.ok(kaling, 'Kaling should exist');
        assert.ok('Extreme' in kaling.difficulties);
        assert.ok('Hard' in kaling.difficulties);
        assert.ok('Normal' in kaling.difficulties);
        assert.ok('Easy' in kaling.difficulties);
    });

    test('default difficulty is the highest value one', () => {
        const kaling = bossData.find(b => b.baseName === 'Kaling');
        assert.equal(kaling.defaultDifficulty, 'Extreme');
    });

    test('static list is sorted highest to lowest by default value', () => {
        for (let i = 1; i < bossData.length; i++) {
            assert.ok(bossData[i - 1].value >= bossData[i].value,
                `${bossData[i-1].baseName} (${bossData[i-1].value}) should be >= ${bossData[i].baseName} (${bossData[i].value})`);
        }
    });
});

describe('boss list ordering', () => {
    test('each group sorts on its highest-difficulty price', () => {
        bossData.forEach(boss => {
            const highest = Math.max(...Object.values(boss.difficulties).map(d => d.value));
            assert.equal(boss.value, highest, `${boss.baseName} should sort on its highest difficulty`);
        });
    });

    test('list is ordered by highest-difficulty price, descending', () => {
        const values = bossListForCharacter(makeCharacter()).map(b => b.value);
        assert.deepEqual(values, [...values].sort((a, b) => b - a));
    });

    test('choosing a lower difficulty does not reorder the list', () => {
        const base = bossListForCharacter(makeCharacter()).map(b => b.baseName);
        const char = makeCharacter({ bossDifficulty: { Kaling: 'Easy', Lotus: 'Hard' } });
        assert.deepEqual(bossListForCharacter(char).map(b => b.baseName), base);
    });

    test('party size does not reorder the list', () => {
        const base = bossListForCharacter(makeCharacter()).map(b => b.baseName);
        const char = makeCharacter({ bossPartyCount: { Kaling: 6, 'Black Mage': 6 } });
        assert.deepEqual(bossListForCharacter(char).map(b => b.baseName), base);
    });

    test('filtering preserves the fixed order', () => {
        const base = bossListForCharacter(makeCharacter()).map(b => b.baseName);
        const filtered = bossListForCharacter(makeCharacter(), 'a').map(b => b.baseName);
        assert.deepEqual(filtered, base.filter(n => n.toLowerCase().includes('a')));
    });
});

describe('calculateTotal', () => {
    test('returns 0 for empty character', () => {
        assert.equal(calculateTotal(makeCharacter()), 0);
    });

    test('sums adjusted values correctly', () => {
        const char = makeCharacter({
            selectedBosses: new Set(['Kaling', 'Lotus']),
        });
        const expected = bossValue('Kaling', 'Extreme') + bossValue('Lotus', 'Extreme');
        assert.equal(calculateTotal(char), expected);
    });

    test('party count divides crystal value', () => {
        const char = makeCharacter({
            selectedBosses: new Set(['Kaling']),
            bossPartyCount: { Kaling: 2 }
        });
        assert.equal(calculateTotal(char), bossValue('Kaling', 'Extreme') / 2);
    });

    test('caps at 14 bosses, keeping highest adjusted values', () => {
        // Select 15 bosses — total should only count top 14
        const allBossNames = bossData.map(b => b.baseName);
        const selected15 = new Set(allBossNames.slice(0, 15));
        const char = makeCharacter({ selectedBosses: selected15 });

        const top14Sum = bossData.slice(0, 14).reduce((sum, b) => sum + b.value, 0);
        assert.equal(calculateTotal(char), top14Sum);
    });

    test('difficulty override changes total', () => {
        const charExtreme = makeCharacter({ selectedBosses: new Set(['Kaling']) });
        const charEasy = makeCharacter({
            selectedBosses: new Set(['Kaling']),
            bossDifficulty: { Kaling: 'Easy' }
        });
        assert.ok(calculateTotal(charExtreme) > calculateTotal(charEasy));
    });
});
