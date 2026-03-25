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

function sortedBossListForCharacter(character) {
    return [...bossData].sort((a, b) => {
        const diffA = getBossDifficulty(character, a.baseName);
        const diffB = getBossDifficulty(character, b.baseName);
        const partyA = getBossPartyCount(character, a.baseName);
        const partyB = getBossPartyCount(character, b.baseName);
        return (getBossValue(b.baseName, diffB) / partyB) - (getBossValue(a.baseName, diffA) / partyA);
    });
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

describe('buildBossData', () => {
    test('Black Mage is not in boss list', () => {
        const names = bossData.map(b => b.baseName);
        assert.ok(!names.includes('Black Mage'), 'Black Mage should have been removed');
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

describe('dynamic boss sorting', () => {
    test('default order matches static list (no overrides)', () => {
        const char = makeCharacter();
        const sorted = sortedBossListForCharacter(char);
        assert.deepEqual(sorted.map(b => b.baseName), bossData.map(b => b.baseName));
    });

    test('switching to lower difficulty pushes boss down', () => {
        const char = makeCharacter({ bossDifficulty: { Kaling: 'Easy' } });
        const sorted = sortedBossListForCharacter(char);
        const kalingIdx = sorted.findIndex(b => b.baseName === 'Kaling');
        const defaultIdx = bossData.findIndex(b => b.baseName === 'Kaling');
        assert.ok(kalingIdx > defaultIdx, `Kaling on Easy (idx ${kalingIdx}) should be below its default position (idx ${defaultIdx})`);
    });

    test('party size 6 divides value and drops boss in ranking', () => {
        // Kaling Extreme = 6030M / 6 = 1005M — should rank lower than at solo
        const char = makeCharacter({ bossPartyCount: { Kaling: 6 } });
        const sorted = sortedBossListForCharacter(char);
        const kalingIdx = sorted.findIndex(b => b.baseName === 'Kaling');
        const defaultIdx = bossData.findIndex(b => b.baseName === 'Kaling');
        assert.ok(kalingIdx > defaultIdx, `Kaling party-6 (idx ${kalingIdx}) should rank below its default position (idx ${defaultIdx})`);
    });

    test('adjusted value is used for sort, not raw value', () => {
        // Give Lotus party=1, Kaling party=6
        // Lotus Extreme = 1400M, Kaling Extreme / 6 = 1005M → Lotus should come first
        const char = makeCharacter({ bossPartyCount: { Kaling: 6 } });
        const sorted = sortedBossListForCharacter(char);
        const lotusIdx = sorted.findIndex(b => b.baseName === 'Lotus');
        const kalingIdx = sorted.findIndex(b => b.baseName === 'Kaling');
        assert.ok(lotusIdx < kalingIdx, `Lotus (${lotusIdx}) should rank above Kaling party-6 (${kalingIdx})`);
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
        // Extreme Kaling = 6030, Extreme Lotus = 1400
        const expected = 6030 + 1400;
        assert.equal(calculateTotal(char), expected);
    });

    test('party count divides crystal value', () => {
        const char = makeCharacter({
            selectedBosses: new Set(['Kaling']),
            bossPartyCount: { Kaling: 2 }
        });
        assert.equal(calculateTotal(char), 6030 / 2);
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
