// Boss engine: crystal prices and the weekly sale plan, the boss combat tables
// and how they change over time, and the Progression damage model.
//
// Pure logic with no DOM access, loaded by the page as a classic script and by
// the tests through node:vm. Functions that read the whole account take the
// roster as an argument, and the ones that depend on the date take it too, so
// both can be set in a test. Exposes window.BossEngine; boss-tracker.js lifts
// the names it uses back into page globals.

(function (root) {
    'use strict';

    // Embedded game data (for local file:// protocol compatibility)
    const GAME_DATA = {
        "bosses": [
            { "name": "Extreme Black Mage", "price": "18B", "value": 18000 },
            { "name": "Extreme Kaling", "price": "6.03B", "value": 6026 },
            { "name": "Hard Jupiter", "price": "5.95B", "value": 5953 },
            { "name": "Extreme First Adversary", "price": "5.88B", "value": 5880 },
            { "name": "Extreme Kalos the Guardian", "price": "5.2B", "value": 5200 },
            { "name": "Hard Black Mage", "price": "4.5B", "value": 4500 },
            { "name": "Extreme Chosen Seren", "price": "4.24B", "value": 4235 },
            { "name": "Hard Baldrix", "price": "4.2B", "value": 4200 },
            { "name": "Hard Malefic Star", "price": "3.99B", "value": 3990 },
            { "name": "Hard Limbo", "price": "3.75B", "value": 3745 },
            { "name": "Hard Kaling", "price": "2.99B", "value": 2990 },
            { "name": "Normal Jupiter", "price": "2.97B", "value": 2965 },
            { "name": "Hard First Adversary", "price": "2.94B", "value": 2940 },
            { "name": "Normal Baldrix", "price": "2.8B", "value": 2800 },
            { "name": "Chaos Kalos the Guardian", "price": "2.6B", "value": 2600 },
            { "name": "Normal Limbo", "price": "2.1B", "value": 2100 },
            { "name": "Normal Kaling", "price": "1.51B", "value": 1506.5 },
            { "name": "Normal Malefic Star", "price": "1.45B", "value": 1452 },
            { "name": "Extreme Lotus", "price": "1.4B", "value": 1397.5 },
            { "name": "Normal First Adversary", "price": "1.37B", "value": 1365 },
            { "name": "Normal Kalos the Guardian", "price": "1.3B", "value": 1300 },
            { "name": "Hard Chosen Seren", "price": "1.1B", "value": 1096.5625 },
            { "name": "Easy Kaling", "price": "1.03B", "value": 1031.25 },
            { "name": "Easy First Adversary", "price": "985M", "value": 985 },
            { "name": "Easy Kalos the Guardian", "price": "937.5M", "value": 937.5 },
            { "name": "Normal Chosen Seren", "price": "889.02M", "value": 889.021875 },
            { "name": "Hard Verus Hilla", "price": "762.11M", "value": 762.105 },
            { "name": "Hard Darknell", "price": "667.92M", "value": 667.92 },
            { "name": "Hard Will", "price": "621.81M", "value": 621.81 },
            { "name": "Chaos Guardian Angel Slime", "price": "600.58M", "value": 600.578125 },
            { "name": "Normal Verus Hilla", "price": "581.88M", "value": 581.88 },
            { "name": "Chaos Gloom", "price": "563.95M", "value": 563.945 },
            { "name": "Hard Lucid", "price": "504M", "value": 504 },
            { "name": "Hard Lotus", "price": "444.68M", "value": 444.675 },
            { "name": "Hard Damien", "price": "421.88M", "value": 421.875 }
        ]
    };

    const bossDataFlat = GAME_DATA.bosses;

    // Parse boss data to extract difficulty and base name
    function parseBossName(fullName) {
        const difficulties = ['Extreme', 'Hard', 'Chaos', 'Normal', 'Easy'];
        for (const diff of difficulties) {
            if (fullName.startsWith(diff + ' ')) {
                return {
                    difficulty: diff,
                    baseName: fullName.substring(diff.length + 1)
                };
            }
        }
        return { difficulty: null, baseName: fullName };
    }

    // Group bosses by base name
    const bossGroups = {};
    bossDataFlat.forEach(boss => {
        const parsed = parseBossName(boss.name);
        const baseName = parsed.baseName;

        if (!bossGroups[baseName]) {
            bossGroups[baseName] = {
                baseName: baseName,
                difficulties: {}
            };
        }

        if (parsed.difficulty) {
            bossGroups[baseName].difficulties[parsed.difficulty] = {
                fullName: boss.name,
                price: boss.price,
                value: boss.value
            };
        } else {
            // Boss with no difficulty prefix
            bossGroups[baseName].difficulties['Solo'] = {
                fullName: boss.name,
                price: boss.price,
                value: boss.value
            };
        }
    });

    // Create display list (one entry per boss group)
    const bossData = Object.values(bossGroups).map(group => {
        // Get highest value difficulty as default
        const diffEntries = Object.entries(group.difficulties);
        const highestDiff = diffEntries.reduce((max, [diff, data]) =>
            data.value > max.value ? data : max
        , diffEntries[0][1]);

        return {
            baseName: group.baseName,
            difficulties: group.difficulties,
            defaultDifficulty: Object.keys(group.difficulties).find(d => group.difficulties[d] === highestDiff),
            // For backward compatibility
            name: highestDiff.fullName,
            price: highestDiff.price,
            value: highestDiff.value
        };
    }).sort((a, b) => b.value - a.value); // Sort by highest value

    // Black Mage is a monthly boss, so it is not one of the weekly picks on the
    // Boss Crystals tab: its crystal counts only in the week a character runs it,
    // set per character in the Selling Strategy checklist.
    const BLACK_MAGE = 'Black Mage';

    function getBossPartyCount(character, bossBaseName) {
        return character.bossPartyCount?.[bossBaseName] || 1;
    }

    function getBossDifficulty(character, bossBaseName) {
        const boss = bossData.find(b => b.baseName === bossBaseName);
        if (!boss) return null;
        return character.bossDifficulty?.[bossBaseName] || boss.defaultDifficulty;
    }

    function getBossValue(bossBaseName, difficulty) {
        const boss = bossData.find(b => b.baseName === bossBaseName);
        if (!boss || !boss.difficulties[difficulty]) return 0;
        return boss.difficulties[difficulty].value;
    }

    function getBossPrice(bossBaseName, difficulty) {
        const boss = bossData.find(b => b.baseName === bossBaseName);
        if (!boss || !boss.difficulties[difficulty]) return '0M';
        return boss.difficulties[difficulty].price;
    }

    const CRYSTALS_PER_CHARACTER = 14;
    const CRYSTALS_PER_ACCOUNT = 180;

    function calculateTotal(character) {
        if (!character || !character.selectedBosses || character.selectedBosses.size === 0) {
            return 0;
        }

        const selectedBossData = Array.from(character.selectedBosses).map(baseName => {
            const difficulty = getBossDifficulty(character, baseName);
            const value = getBossValue(baseName, difficulty);
            const partyCount = getBossPartyCount(character, baseName);
            return {
                baseName: baseName,
                value: value,
                adjustedValue: value / partyCount
            };
        })
        .sort((a, b) => b.adjustedValue - a.adjustedValue) // Sort by adjusted value descending
        .slice(0, CRYSTALS_PER_CHARACTER); // Take only top 14

        return selectedBossData.reduce((sum, boss) => sum + boss.adjustedValue, 0);
    }

    function getAllBossesWithValues(roster) {
        // Collect all bosses from all characters with their adjusted values
        const allBosses = [];

        roster.forEach(char => {
            if (!char.selectedBosses || char.selectedBosses.size === 0) return;

            Array.from(char.selectedBosses).forEach(baseName => {
                const difficulty = getBossDifficulty(char, baseName);
                const value = getBossValue(baseName, difficulty);
                const partyCount = getBossPartyCount(char, baseName);
                allBosses.push({
                    characterId: char.id,
                    characterName: char.name,
                    baseName: baseName,
                    difficulty: difficulty,
                    partyCount: partyCount,
                    adjustedValue: value / partyCount
                });
            });
        });

        return allBosses.sort((a, b) => b.adjustedValue - a.adjustedValue);
    }

    function calculateGrandTotal(roster) {
        const allBosses = getAllBossesWithValues(roster);
        const top180 = allBosses.slice(0, CRYSTALS_PER_ACCOUNT);
        return top180.reduce((sum, boss) => sum + boss.adjustedValue, 0);
    }

    function formatValue(total) {
        if (total >= 1000) {
            return `${(total / 1000).toFixed(2)}B`;
        } else if (total > 0) {
            return `${total.toFixed(2)}M`;
        }
        return '0M';
    }

    /** The current month for monthly bosses, which reset on the 1st at 00:00 UTC. */
    function currentMonth(now = new Date()) {
        return now.toISOString().slice(0, 7);
    }

    /**
     * A character's Black Mage this month: the difficulty (Hard unless chosen),
     * whether it is run this week, and whether it is done for the month, either
     * ticked by hand or finished in this week's checklist (`doneByRun`).
     */
    function getBlackMage(character, now = new Date()) {
        const bm = character.blackMage || {};
        const week = currentCrystalWeek(now);
        const planned = bm.plannedWeek === week;
        return {
            difficulty: bm.difficulty || 'Hard',
            planned,
            done: bm.doneMonth === currentMonth(now),
            doneByRun: planned && bm.doneWeek === week,
        };
    }

    /**
     * This week's crystals across the account, highest value first: the weekly
     * picks without Black Mage, plus Black Mage for characters running it now.
     */
    function weeklyCrystals(roster, now = new Date()) {
        const all = getAllBossesWithValues(roster).filter(b => b.baseName !== BLACK_MAGE);
        roster.forEach(char => {
            const bm = getBlackMage(char, now);
            if (!bm.planned) return;
            const partyCount = getBossPartyCount(char, BLACK_MAGE);
            all.push({
                characterId: char.id, characterName: char.name, baseName: BLACK_MAGE,
                difficulty: bm.difficulty, partyCount,
                adjustedValue: getBossValue(BLACK_MAGE, bm.difficulty) / partyCount,
                monthly: true,
            });
        });
        return all.sort((a, b) => b.adjustedValue - a.adjustedValue);
    }

    /** Each character's position in the roster, top first. */
    function rosterOrder(roster) {
        return new Map(roster.map((c, i) => [c.id, i]));
    }

    /**
     * Which crystals count this week. Each character sells at most its 14 most
     * valuable, and the account at most 180, taken from those per-character
     * picks by value. Everything else is overflow to drop. Crystals already sold
     * this week (finished in the checklist) always keep their place, so a new
     * pick such as Black Mage pushes out an unsold crystal instead. Where the 180
     * cut falls among unsold crystals of equal value, the characters highest in
     * the roster drop theirs: 13 Gloom over the limit are dropped by the top 13.
     * @returns {{counted: object[], overflow: object[], accountLimitHit: boolean}}
     */
    function crystalSalePlan(roster, now = new Date()) {
        const doneByCharacter = new Map(roster.map(c => [c.id, getCrystalsDone(c, now)]));
        const sold = b => doneByCharacter.get(b.characterId).has(b.baseName);
        const rosterIndex = rosterOrder(roster);
        // Sold first, then by value; equal values drop from the top of the roster.
        const keepOrder = (a, b) => sold(b) - sold(a) || b.adjustedValue - a.adjustedValue
            || rosterIndex.get(b.characterId) - rosterIndex.get(a.characterId);

        const perCharacter = new Map();
        const eligible = [];
        const overflow = [];
        weeklyCrystals(roster, now).sort(keepOrder).forEach(b => {
            const n = perCharacter.get(b.characterId) || 0;
            if (n < CRYSTALS_PER_CHARACTER) {
                perCharacter.set(b.characterId, n + 1);
                eligible.push(b);
            } else {
                overflow.push({ ...b, reason: 'character' });
            }
        });
        eligible.sort(keepOrder);
        eligible.slice(CRYSTALS_PER_ACCOUNT).forEach(b => overflow.push({ ...b, reason: 'account' }));
        // Highest value first for display, whatever was sold.
        const counted = eligible.slice(0, CRYSTALS_PER_ACCOUNT).sort((a, b) => b.adjustedValue - a.adjustedValue);
        return {
            counted,
            overflow,
            accountLimitHit: eligible.length > CRYSTALS_PER_ACCOUNT,
        };
    }

    /**
     * The current crystal week, keyed by the date of its start. GMS resets weekly
     * bosses and crystal sales at Thursday 00:00 UTC.
     */
    function currentCrystalWeek(now = new Date()) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const sinceThursday = (d.getUTCDay() - 4 + 7) % 7;
        d.setUTCDate(d.getUTCDate() - sinceThursday);
        return d.toISOString().slice(0, 10);
    }

    /** Bosses a character has finished this week; last week's ticks no longer count. */
    function getCrystalsDone(character, now = new Date()) {
        const done = character.crystalsDone;
        return new Set(done && done.week === currentCrystalWeek(now) ? done.bosses : []);
    }

    // ============================================================================
    // Progression model
    // ----------------------------------------------------------------------------
    // Boss combat data (HP per phase, monster level, Sacred/Arcane Force floors)
    // comes from the in-game boss HP tables. A phase is [hp, monsterLevel,
    // sacRequirement, segments]; some phases sit at a different level to the boss
    // as a whole (Normal Kalos P1 is 275 while P2 is 280), which changes the level
    // modifier mid-fight, so phases are priced individually.
    // ============================================================================

    const BOSS_COMBAT = {
        "Baldrix": {"Normal":{lv:290,sac:700,af:null,ph:[[2379800000000000,290,700,1],[2531700000000000,290,700,1],[4145400000000000.5,290,700,1]]}, "Hard":{lv:290,sac:700,af:null,ph:[[5344600000000000,290,700,1],[5685800000000000,290,700,1],[9309000000000000,290,700,1]]}},
        "Black Mage": {"Hard":{lv:275,sac:null,af:1320,ph:[[63000000000000,265,null,1],[115500000000000,275,null,1],[157500000000000,275,null,1],[136500000000000,265,null,1]]}, "Extreme":{lv:280,sac:null,af:1320,ph:[[1180000000000000,275,null,1],[1190000000000000,280,null,1],[1285000000000000,280,null,1],[1152000000000000,280,null,1]]}},
        "Chosen Seren": {"Normal":{lv:270,sac:200,af:null,ph:[[52500000000000,270,150,1],[155500000000000,270,200,1]]}, "Hard":{lv:275,sac:200,af:null,ph:[[126000000000000,275,150,1],[357000000000000,275,200,1]]}, "Extreme":{lv:280,sac:200,af:null,ph:[[1320000000000000,275,150,1],[5160000000000000,280,200,1]]}},
        "Damien": {"Normal":{lv:210,sac:null,af:null,ph:[[840000000000,210,null,1],[360000000000,210,null,1]]}, "Hard":{lv:210,sac:null,af:null,ph:[[25200000000000,210,null,1],[10800000000000,210,null,1]]}},
        "Darknell": {"Normal":{lv:265,sac:null,af:850,ph:[[26000000000000,265,null,1]]}, "Hard":{lv:265,sac:null,af:850,ph:[[157500000000000,265,null,1]]}},
        "First Adversary": {"Easy":{lv:270,sac:220,af:null,ph:[[171537000000000,270,220,1],[171537000000000,270,220,1],[228011000000000,270,220,1]]}, "Normal":{lv:280,sac:320,af:null,ph:[[494111000000000,280,320,1],[494111000000000,280,320,1],[646783000000000,280,320,1]]}, "Hard":{lv:285,sac:340,af:null,ph:[[3180000000000000,285,340,1],[3180000000000000,285,340,1],[4227000000000000.5,285,340,1]]}, "Extreme":{lv:290,sac:460,af:null,ph:[[10080000000000000,290,460,1],[10080000000000000,290,460,1],[13400000000000000,290,460,1]]}},
        "Gloom": {"Normal":{lv:255,sac:null,af:730,ph:[[25500000000000,255,null,1]]}, "Chaos":{lv:255,sac:null,af:730,ph:[[127500000000000,255,null,1]]}},
        "Guardian Angel Slime": {"Normal":{lv:220,sac:null,af:null,ph:[[5000000000000,220,null,1]]}, "Chaos":{lv:250,sac:null,af:null,ph:[[90000000000000,250,null,1]]}},
        "Jupiter": {"Normal":{lv:295,sac:810,af:null,n:["Phase 1","Phase 2","Phase 3"],ph:[[2049999999999999.8,295,810,1],[3080000000000000,295,810,1],[5130000000000000,295,810,1]]}, "Hard":{lv:295,sac:810,af:null,n:["Phase 1","Phase 2","Phase 3"],ph:[[9880000000000000,295,810,1],[14820000000000000,295,810,1],[24700000000000000,295,810,1]]}},
        "Kaling": {"Easy":{lv:275,sac:230,af:null,n:["Phase 1: Perils","","Phase 3: Kaling","Phase 3: Perils"],ph:[[288000000000000,275,230,3],[105000000000000,275,230,1],[150000000000000,275,230,1],[378000000000000,275,230,3]]}, "Normal":{lv:285,sac:330,af:null,n:["Phase 1: Perils","","Phase 3: Kaling","Phase 3: Perils"],ph:[[1200000000000000,285,330,3],[468000000000000,285,330,1],[722000000000000,285,330,1],[1536000000000000,285,330,3]]}, "Hard":{lv:285,sac:350,af:null,n:["Phase 1: Perils","","Phase 3: Kaling","Phase 3: Perils"],ph:[[2718000000000000,285,350,3],[1404000000000000,285,350,1],[2240000000000000.2,285,350,1],[5481000000000000,285,350,3]]}, "Extreme":{lv:285,sac:480,af:null,n:["Phase 1: Perils","","Phase 3: Kaling","Phase 3: Perils"],ph:[[18200000000000000,285,480,3],[6930000000000000,285,480,1],[8662000000000001,285,480,1],[20800000000000000,285,480,3]]}},
        "Kalos the Guardian": {"Easy":{lv:270,sac:200,af:null,ph:[[94500000000000,270,200,1],[262500000000000,270,200,4]]}, "Normal":{lv:280,sac:300,af:null,ph:[[336000000000000,275,250,1],[720000000000000,280,300,4]]}, "Chaos":{lv:285,sac:330,af:null,ph:[[1060000000000000,285,330,1],[4059999999999999.5,285,330,4]]}, "Extreme":{lv:285,sac:440,af:null,ph:[[5970000000000000,285,440,1],[15600000000000000,285,440,4]]}},
        "Limbo": {"Normal":{lv:285,sac:500,af:null,ph:[[1940000000000000,285,500,1],[1940000000000000,285,500,2],[2600000000000000,285,500,1]]}, "Hard":{lv:285,sac:500,af:null,ph:[[3780000000000000,285,500,1],[3780000000000000,285,500,2],[4990000000000000,285,500,1]]}},
        "Lotus": {"warn":{"Extreme":"Phase 1 shield inflates effective HP; how it lines up with mechanics and burst makes runs vary"}, "Normal":{lv:210,sac:null,af:null,ph:[[470000000000,210,null,1],[470000000000,210,null,1],[630000000000,210,null,1]]}, "Hard":{lv:210,sac:null,af:null,ph:[[10000000000000,210,null,1],[10000000000000,210,null,1],[13500000000000,210,null,1]]}, "Extreme":{lv:285,sac:null,af:null,ph:[[545000000000000,285,null,1],[545000000000000,285,null,1],[720000000000000,285,null,1]]}},
        "Lucid": {"Easy":{lv:230,sac:null,af:360,ph:[[6000000000000,230,null,1],[6000000000000,230,null,1]]}, "Normal":{lv:230,sac:null,af:360,ph:[[12000000000000,230,null,1],[12000000000000,230,null,1]]}, "Hard":{lv:230,sac:null,af:360,ph:[[50800000000000,230,null,1],[54000000000000,230,null,1],[12800000000000,230,null,1]]}},
        "Malefic Star": {"Normal":{lv:280,sac:400,af:null,n:["Phase 1","Phase 2","Phase 3"],ph:[[657600000000000,280,400,1],[1300000000000000,280,400,1],[1300000000000000,280,400,1]]}, "Hard":{lv:280,sac:550,af:null,n:["Phase 1","Phase 2","Phase 3"],ph:[[2900000000000000,280,550,1],[5900000000000000,280,550,1],[5900000000000000,280,550,1]]}},
        "Verus Hilla": {"Normal":{lv:250,sac:null,af:820,ph:[[88000000000000,250,null,4]]}, "Hard":{lv:250,sac:null,af:900,ph:[[176000000000000,250,null,4]]}},
        "Will": {"Easy":{lv:235,sac:null,af:560,n:["Phase 1: Blue Dimension","Phase 1: Purple Dimension","Phase 2","Phase 3"],ph:[[2800000000000,235,null,3],[2800000000000,235,null,3],[4200000000000,235,null,2],[7000000000000,235,null,1]]}, "Normal":{lv:250,sac:null,af:760,n:["Phase 1: Blue Dimension","Phase 1: Purple Dimension","Phase 2","Phase 3"],ph:[[4200000000000,250,null,3],[4200000000000,250,null,3],[6300000000000,250,null,2],[10500000000000,250,null,1]]}, "Hard":{lv:250,sac:null,af:760,n:["Phase 1: Blue Dimension","Phase 1: Purple Dimension","Phase 2","Phase 3"],ph:[[21000000000000,250,null,3],[21000000000000,250,null,3],[31500000000000,250,null,2],[52500000000000,250,null,1]]}}
    };

    // Level advantage: final-damage modifier from (character level - monster level).
    // Source: StrategyWiki MapleStory/Formulas, "Level Advantage Multiplier".
    // Level or above: +10%, then +2%p per level, capping at +20% from +5.
    // 1-4 below: fixed compound values. 5+ below: -2.5%p per level, truncated,
    // reaching -100% at 40 levels under.
    const LEVEL_FD_NEAR = { '-1': 0.0584, '-2': 0.007, '-3': -0.0328, '-4': -0.082 };

    const BOSS_TIME_LIMIT = 30 * 60;  // enrage timer unless a boss has its own, seconds

    // ── Bosses over time ────────────────────────────────────────────────────────
    // BOSS_COMBAT is the table as first recorded, with every boss on the 30:00
    // timer. A patch that retunes bosses is one entry here, in date order: the
    // day it went live (`from`, YYYY-MM-DD) and what it changed (`bosses`, keyed
    // "Boss|Difficulty"):
    //     hp     multiplies every phase's HP (2 / 3 for a cut to two thirds)
    //     ph     replaces the phases outright, when the notes give new figures
    //     limit  the fight's time limit in seconds
    //     lv, sac, af, n   replace the matching field; a new boss gives them all
    // Projections price a boss as it stands today. A timed run or a site clear %
    // is priced as the boss stood on the day it was measured, so an old run
    // keeps meaning what it meant, and MapleScouter's cuts keep the table their
    // thresholds were fitted on (SCOUTER_FIT_DATE).

    /** Patch-note rows of [boss, difficulties, % of HP removed] as a `bosses` map, all on one time limit. */
    function hpCuts(limit, rows) {
        const bosses = {};
        rows.forEach(([boss, difficulties, cut]) => difficulties.split(', ').forEach(d => {
            bosses[`${boss}|${d}`] = { hp: 1 - cut / 100, limit };
        }));
        return bosses;
    }

    const BOSS_CHANGES = [
        // v.272 Maplayer One: every weekly and monthly boss on a 20:00 limit, with
        // HP cut by the rounded percentages the notes list ("~32.1%"), taken here
        // as the same cut on every phase. Hard Black Mage loses more than the rest.
        // Source: nexon.com/maplestory/news/update/47132, Boss & Mob Changes.
        { from: '2026-11-11', bosses: hpCuts(20 * 60, [
            ['Lotus', 'Normal, Hard', 31.6], ['Lotus', 'Extreme', 32.2],
            ['Damien', 'Normal, Hard', 31.5],
            ['Guardian Angel Slime', 'Normal, Chaos', 31.4],
            ['Lucid', 'Easy, Normal', 31.5], ['Lucid', 'Hard', 28.5],
            ['Will', 'Easy, Normal, Hard', 32.9],
            ['Gloom', 'Normal, Chaos', 32.3],
            ['Verus Hilla', 'Normal, Hard', 31.4],
            ['Darknell', 'Normal, Hard', 31.3],
            ['Black Mage', 'Hard', 64.9], ['Black Mage', 'Extreme', 32.3],
            ['Chosen Seren', 'Normal, Hard, Extreme', 32.1],
            ['Kalos the Guardian', 'Easy, Normal, Chaos, Extreme', 33.2],
            ['First Adversary', 'Easy, Normal, Hard, Extreme', 32.2],
            ['Kaling', 'Easy, Normal, Hard, Extreme', 32.2],
            ['Malefic Star', 'Normal, Hard', 32.0],
            ['Limbo', 'Normal, Hard', 32.5],
            ['Baldrix', 'Normal, Hard', 32.2],
            ['Jupiter', 'Normal, Hard', 32.0],
        ]) },
    ];

    /**
     * One boss difficulty as it stood on a date (YYYY-MM-DD, today when left
     * out; null is before any change): its BOSS_COMBAT entry with every change
     * up to that day applied, and its time limit as `limit`.
     * @returns {object|null} null when the boss has no combat data on that date
     */
    function bossCombat(baseName, difficulty, date = localDate()) {
        const key = `${baseName}|${difficulty}`;
        const base = BOSS_COMBAT[baseName] && BOSS_COMBAT[baseName][difficulty];
        let data = base ? { limit: BOSS_TIME_LIMIT, ...base } : null;
        for (const change of BOSS_CHANGES) {
            const c = date !== null && change.from <= date && change.bosses[key];
            if (!c) continue;
            const { hp, ...fields } = c;
            data = { limit: BOSS_TIME_LIMIT, ...data, ...fields };
            if (hp && !c.ph && data.ph) data.ph = data.ph.map(p => [p[0] * hp, ...p.slice(1)]);
        }
        return data && data.ph ? data : null;
    }

    /** A boss's time limit in seconds on a date, the default when it has no combat data. */
    function bossTimeLimit(baseName, difficulty, date) {
        const data = bossCombat(baseName, difficulty, date);
        return data ? data.limit : BOSS_TIME_LIMIT;
    }

    const BURST_COOLDOWN = 120;       // nominal burst cooldown, seconds
    const BURST_CDR = 0.06;           // account-wide cooldown reduction buff
    const BURST_CYCLE = BURST_COOLDOWN * (1 - BURST_CDR);  // 112.8s -> 16 bursts in 30:00
    const BURST_WINDOW = 25;          // seconds of burst uptime
    const BURST_SHARE = 0.60;         // share of damage dealt inside the burst

    /**
     * Final-damage multiplier from level advantage.
     * @param {number} charLevel
     * @param {number} bossLevel
     * @returns {number} multiplier, e.g. 1.20 at +5 or above
     */
    function levelMultiplier(charLevel, bossLevel) {
        const diff = charLevel - bossLevel;
        if (diff >= 5) return 1.20;
        if (diff >= 0) return 1.10 + 0.02 * diff;
        if (diff >= -4) return 1 + LEVEL_FD_NEAR[diff];
        return Math.max(0, 1 - Math.floor(2.5 * -diff) / 100);
    }

    // Arcane Force final-damage tiers by percentage of the requirement met (rounded down).
    // Source: StrategyWiki MapleStory/Formulas, "Arcane Force Maps".
    // Maxed Arcane Symbols give 1320; the guild skill adds up to +30 more, and that
    // extra counts for damage in Arcane River.
    const DEFAULT_ARCANE = 1350;

    const ARCANE_TIERS = [
        [150, 0.50], [130, 0.30], [110, 0.10], [100, 0], [70, -0.20],
        [50, -0.30], [30, -0.40], [10, -0.70], [0, -0.90]
    ];

    /**
     * Damage multiplier from Arcane or Sacred (Authentic) Force.
     * Arcane is stepped by the share of the requirement met: +10% at 110%, +30% at
     * 130%, +50% at 150%, with matching penalties below 100%.
     * Sacred grants +1%p per 2 points over the requirement (rounded down) up to +25%
     * at +50, and costs -1%p per point under it, down to -95%.
     * A blank Sacred Force field is treated as capped: characters reach +50 over the
     * requirement well before they meet a boss's damage requirement.
     * A blank Arcane Force field is treated as DEFAULT_ARCANE (maxed symbols plus the
     * guild skill), which is 150% of every requirement except Black Mage's 1320.
     * @param {number|null} have - the character's force, or null for capped
     * @param {number|null} req - the boss's requirement
     * @param {string} kind - 'sac' or 'af'
     * @returns {number}
     */
    function forceMultiplier(have, req, kind) {
        if (!req) return 1;
        if (have === null || have === undefined) {
            if (kind !== 'af') return 1.25;
            have = DEFAULT_ARCANE;
        }
        if (kind === 'af') {
            const pct = Math.floor(have / req * 100);
            for (const [floor, fd] of ARCANE_TIERS) if (pct >= floor) return 1 + fd;
            return 0.1;
        }
        const diff = have - req;
        if (diff >= 0) return 1 + Math.min(Math.floor(diff / 2), 25) / 100;
        return 1 - Math.min(-diff, 95) / 100;
    }

    // Boss defense (PDR, %). PDR is set per difficulty, not per boss. Chosen Seren
    // and every boss after it sit at 380 on all difficulties; earlier bosses are 300,
    // with one exception: Extreme Lotus is a level-285 re-tune and carries 380.
    const BOSS_PDR_DEFAULT = 300;
    const BOSS_PDR = {
        'Chosen Seren': 380, 'Kalos the Guardian': 380, 'First Adversary': 380,
        'Kaling': 380, 'Malefic Star': 380, 'Limbo': 380, 'Baldrix': 380, 'Jupiter': 380
    };
    const BOSS_PDR_OVERRIDES = {
        'Lotus': { 'Extreme': 380 }
    };

    /** PDR for one boss difficulty, applying per-difficulty exceptions. */
    function bossPdr(baseName, difficulty) {
        const byDiff = BOSS_PDR_OVERRIDES[baseName];
        if (byDiff && byDiff[difficulty]) return byDiff[difficulty];
        return BOSS_PDR[baseName] || BOSS_PDR_DEFAULT;
    }
    const DEFAULT_IED = 98;
    // Measured across this roster: a site clear % overstates a real clear by 1.24x
    // to 1.43x. Used when a character has no timed clear to measure its own factor.
    const DEFAULT_EXECUTION = 1.3;

    /**
     * Damage multiplier after boss defense: 1 - PDR x (1 - IED), floored at zero.
     * At 98% IED that is 0.94 against 300% PDR and 0.924 against 380%.
     * @param {number} pdr - boss defense in percent, e.g. 380
     * @param {number} ied - ignore enemy defense in percent, e.g. 98
     * @returns {number}
     */
    function defenseMultiplier(pdr, ied) {
        return Math.max(0, 1 - (pdr / 100) * (1 - ied / 100));
    }

    /**
     * IED from skills: the character's own value (typed or calibrated from
     * MapleScouter) when set, otherwise the class default from Grandis Library.
     */
    function getCharSkillIed(character) {
        const own = parseFloat(character.skillIed);
        if (isFinite(own)) return own;
        const cls = character.className || (character.upgradeBuild && character.upgradeBuild.className);
        const grandis = typeof UpgradeEngine !== 'undefined' && UpgradeEngine.classSkillIedBreakdown(cls, character.skillIedSkills);
        return grandis ? grandis.ied : 0;
    }

    /** Stat-window IED combined with the class's skill IED. */
    function getCharTotalIed(character) {
        const skill = getCharSkillIed(character);
        return 100 * (1 - (1 - getCharIed(character) / 100) * (1 - skill / 100));
    }

    /** IED from the Upgrades tab's stat sheet, or null when it has none. */
    function statSheetIed(character) {
        const stats = character.upgradeBuild && character.upgradeBuild.stats;
        const v = stats ? parseFloat(stats.ied) : NaN;
        return v > 0 ? v : null;
    }

    /**
     * Stat-window IED: a what-if override, else the Upgrades stat sheet's, else
     * the Progression field, else the default.
     */
    function getCharIed(character) {
        if (character.iedWhatIf !== undefined) return character.iedWhatIf;
        const sheet = statSheetIed(character);
        if (sheet !== null) return sheet;
        return (character.ied === null || character.ied === undefined) ? DEFAULT_IED : character.ied;
    }

    // ── Upgrades since a calibration ─────────────────────────────────────────────
    // A calibration (hexa converted, or a timed run / site %) is a measurement
    // of the character at one moment. Upgrades recorded on the Upgrades tab
    // afterwards raise its damage by their final damage gain, carried here until
    // the calibration is entered again. The calibration also keeps the stat-window
    // IED it was measured at: IED changes then reach the bosses through their own
    // defense (PDR differs by boss), so the carried gain leaves IED out. Skill IED
    // is a class estimate rather than gear, so both sides use its current value.
    const CALIB_FIELDS = ['calibBoss', 'calibMinutes', 'calibParty', 'manualDps', 'calibPercent'];

    function newCalibAnchor(character) {
        return { statIed: getCharIed(character), gain: 1, since: localDate(), upgrades: 0 };
    }

    /** Starts a calibration afresh: kind is 'hexa' or 'calib'. */
    function resetCalibAnchor(character, kind) {
        character.calibAnchors = { ...(character.calibAnchors || {}), [kind]: newCalibAnchor(character) };
    }

    /** Today's date in the user's time zone, as YYYY-MM-DD. */
    function localDate(d = new Date()) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /**
     * Carries an upgrade's gain (a damage ratio with IED held still) into every
     * calibration the character has. `iedBefore` is the stat-window IED before
     * the upgrade, for a calibration that predates anchors. `count` is how the
     * upgrade tally moves: -1 for an undo.
     */
    function recordUpgradeGain(character, ratio, iedBefore, count = 1) {
        if (!(ratio > 0) || Math.abs(ratio - 1) < 1e-9) return;
        const anchors = { ...(character.calibAnchors || {}) };
        const has = { hexa: !!character.hexaConverted, calib: runDps(character) > 0 || siteDps(character) > 0 };
        for (const kind of ['hexa', 'calib']) {
            if (!has[kind] && !anchors[kind]) continue;
            const a = anchors[kind] || { statIed: iedBefore, gain: 1, since: localDate(), upgrades: 0 };
            anchors[kind] = { ...a, gain: a.gain * ratio, upgrades: Math.max(0, (a.upgrades || 0) + count) };
        }
        character.calibAnchors = anchors;
    }

    /** The damage multiplier from upgrades since a calibration (1 when none). */
    function upgradeGainSince(character, kind) {
        const a = character.calibAnchors && character.calibAnchors[kind];
        return a && a.gain > 0 ? a.gain : 1;
    }

    /** The character as it was when a calibration was measured, for its IED. */
    function anchoredCharacter(character, kind) {
        const a = character.calibAnchors && character.calibAnchors[kind];
        return a && isFinite(a.statIed) ? Object.assign({}, character, { iedWhatIf: a.statIed }) : character;
    }

    function getCharLevel(character) { return character.charLevel || 270; }
    function getCharSacred(character) {
        return (character.sacredForce === null || character.sacredForce === undefined)
            ? null : character.sacredForce;
    }
    function getCharArcane(character) {
        return (character.arcaneForce === null || character.arcaneForce === undefined)
            ? null : character.arcaneForce;
    }

    /**
     * Prices a boss for a character: how much damage they must actually output,
     * after level and force multipliers, phase by phase.
     * @param {string} baseName
     * @param {string} difficulty
     * @param {object} character
     * @param {string|null} [date] - the day to take the boss's table from: today
     *     when left out, null for before any change
     * @returns {object|null} { total, phases, blocked, limit } or null if no combat data
     */
    function effectiveHP(baseName, difficulty, character, date) {
        const data = bossCombat(baseName, difficulty, date);
        if (!data) return null;
        const lvl = getCharLevel(character);
        const sacred = getCharSacred(character);
        const arcane = getCharArcane(character);
        const pdr = bossPdr(baseName, difficulty);
        const dm = defenseMultiplier(pdr, getCharTotalIed(character));

        let blocked = null;
        const phases = data.ph.map((p, i) => {
            const hp = p[0], bossLvl = p[1], sacReq = p[2], segments = p[3];
            const lm = levelMultiplier(lvl, bossLvl);
            let fm = 1;
            if (sacReq) {
                fm = forceMultiplier(sacred, sacReq, 'sac');
                if (sacred !== null && sacred < sacReq) blocked = 'SAC ' + sacred + ' < ' + sacReq;
            } else if (data.af) {
                fm = forceMultiplier(arcane, data.af, 'af');
                if (arcane !== null && arcane < data.af) blocked = 'AF ' + arcane + ' < ' + data.af;
            }
            return {
                name: (data.n && data.n[i]) || ('P' + (i + 1)),
                raw: hp,
                effective: dm > 0 ? hp / (lm * fm * dm) : Infinity,
                levelMult: lm,
                forceMult: fm,
                defenseMult: dm,
                pdr: pdr,
                segments: segments,
                bossLevel: bossLvl
            };
        });
        return {
            total: phases.reduce((s, p) => s + p.effective, 0),
            phases: phases,
            blocked: blocked,
            limit: data.limit
        };
    }

    /**
     * Cumulative damage by elapsed time under a bursty cadence: BURST_SHARE of each
     * cycle's damage lands in the first BURST_WINDOW seconds, starting at t=0.
     * @param {number} t - elapsed seconds
     * @param {number} avgDps - sustained damage per second
     * @returns {number}
     */
    function damageByTime(t, avgDps) {
        const perCycle = avgDps * BURST_CYCLE;
        const burstDps = perCycle * BURST_SHARE / BURST_WINDOW;
        const offDps = perCycle * (1 - BURST_SHARE) / (BURST_CYCLE - BURST_WINDOW);
        const full = Math.floor(t / BURST_CYCLE);
        const rem = t - full * BURST_CYCLE;
        let dmg = full * perCycle + burstDps * Math.min(rem, BURST_WINDOW);
        if (rem > BURST_WINDOW) dmg += offDps * (rem - BURST_WINDOW);
        return dmg;
    }

    /**
     * How many bursts land inside the fight timer. Bursts fire at t = 0, C, 2C, ...
     * while t is still under the limit, so an exact division lands the last burst
     * on the cap itself and does not count.
     * @param {number} [limit] - the fight's time limit in seconds
     * @returns {number}
     */
    function burstsInFight(limit = BOSS_TIME_LIMIT) {
        return Math.ceil(limit / BURST_CYCLE);
    }

    /** Inverse of damageByTime: seconds needed to deal dmg. */
    function timeForDamage(dmg, avgDps) {
        if (avgDps <= 0) return Infinity;
        let lo = 0, hi = 4 * BOSS_TIME_LIMIT;
        if (damageByTime(hi, avgDps) < dmg) return Infinity;
        for (let i = 0; i < 60; i++) {
            const mid = (lo + hi) / 2;
            if (damageByTime(mid, avgDps) < dmg) lo = mid; else hi = mid;
        }
        return hi;
    }

    /**
     * Full pace read for one boss: per-phase kill deadlines, burst numbers, and
     * how much slack (in bursts) remains against the boss's own time limit.
     * `date` picks the boss's table as effectiveHP does: today when left out.
     */
    function bossPace(baseName, difficulty, character, avgDps, date) {
        const eff = effectiveHP(baseName, difficulty, character, date);
        if (!eff) return null;
        const warn = BOSS_COMBAT[baseName] && BOSS_COMBAT[baseName].warn
            && BOSS_COMBAT[baseName].warn[difficulty];
        const limit = eff.limit;
        const perBurst = avgDps * BURST_CYCLE * BURST_SHARE;
        const available = damageByTime(limit, avgDps);
        let cum = 0;
        const phases = eff.phases.map(p => {
            cum += p.effective;
            const t = timeForDamage(cum, avgDps);
            return Object.assign({}, p, {
                killBy: t,
                burstNo: isFinite(t) ? Math.floor(t / BURST_CYCLE) + 1 : Infinity,
                share: p.effective / eff.total
            });
        });
        const clearTime = timeForDamage(eff.total, avgDps);
        const shortfall = Math.max(0, eff.total - available);
        return {
            total: eff.total,
            blocked: eff.blocked,
            warn: warn || null,
            phases: phases,
            clearTime: clearTime,
            limit: limit,
            clears: clearTime <= limit,
            spareBursts: (limit - clearTime) / BURST_CYCLE,
            shortBursts: perBurst > 0 ? shortfall / perBurst : Infinity,
            damageNeeded: available > 0 ? eff.total / available : Infinity
        };
    }

    // ── MapleScouter "hexa converted" ───────────────────────────────────────────
    // MapleScouter rates a character with one number (hexa converted, the HEXA
    // figure under Boss 380), adjusts it per boss for level and force (the value
    // printed on each boss card), and turns that into a cut %:
    //     cut % = (card / threshold) ^ k
    // Refitted 2026-10-18 on 74 cuts from six characters spanning 44k-108k (PF,
    // BM twice, Sair, I/L, MM, DrK twice): k = 2.51, rms 2.5%, each character
    // within 4% on average and about 2% when left out of the fit. The 2026-10-05
    // fit (k = 2.56) read 5-7% low below 55k. What remains is a per-class offset
    // of a few percent (BM's cards run hot, PF's cold), not a curve: one
    // character's own snapshots move with k near 2.35. Thresholds are the card
    // value needed for a 100% solo-min cut.
    //
    // A cut is a share of what the boss asked for when the thresholds were
    // fitted, so it turns into damage against the boss table and timer of that
    // day, whatever GMS has retuned since. MapleScouter sets its cuts against
    // KMS, whose shorter timers came with HP scaled down to match.
    const SCOUTER_FIT_DATE = '2026-10-18';
    const SCOUTER_K = 2.51;
    const SCOUTER_THRESHOLDS = {
        'Kalos the Guardian|Normal': 50308, 'First Adversary|Normal': 55886, 'Lotus|Extreme': 66851,
        'Malefic Star|Normal': 72324, 'Kaling|Normal': 73069, 'Kalos the Guardian|Chaos': 94810,
        'Limbo|Normal': 101270, 'Black Mage|Extreme': 102041, 'Kaling|Hard': 112108,
        'First Adversary|Hard': 113392, 'Chosen Seren|Extreme': 116257, 'Malefic Star|Hard': 130117,
        'Limbo|Hard': 131663,
    };
    // Card value = hexa converted x (level and force multiplier relative to their
    // maximum) ^ (1 / 2.35), which reproduces observed cards within ~1.5%.
    // MapleScouter also docks 1350 Arcane Force on Black Mage's 1320 (x0.9665 on
    // the card even at max level), where our tiers apply no penalty.
    const SCOUTER_CARD_K = 2.35;
    const SCOUTER_ARCANE_CARD = 0.9665;

    /** The value MapleScouter would print on this boss's card, or null. */
    function scouterCardValue(character, baseName, difficulty) {
        const hc = parseFloat(character.hexaConverted);
        const data = bossCombat(baseName, difficulty);
        if (!(hc > 0) || !data) return null;
        let mult = levelMultiplier(getCharLevel(character), data.lv) / 1.20;
        let card = 1;
        if (data.sac) {
            mult *= forceMultiplier(getCharSacred(character), data.sac, 'sac') / 1.25;
        } else if (data.af) {
            mult *= forceMultiplier(getCharArcane(character), data.af, 'af')
                / forceMultiplier(DEFAULT_ARCANE, data.af, 'af');
            card = SCOUTER_ARCANE_CARD;
        }
        return hc * card * Math.pow(mult, 1 / SCOUTER_CARD_K);
    }

    /** MapleScouter's cut % for a boss from hexa converted, or null without a threshold. */
    function scouterCut(character, baseName, difficulty) {
        const threshold = SCOUTER_THRESHOLDS[`${baseName}|${difficulty}`];
        const card = threshold ? scouterCardValue(character, baseName, difficulty) : null;
        return card ? 100 * Math.pow(card / threshold, SCOUTER_K) : null;
    }

    // ── Predictors ──────────────────────────────────────────────────────────────
    // Three ways to know how hard a character hits, in the order they are trusted:
    //   run      a clear the player timed (or a DPS they set): measured, so it has
    //            their execution in it
    //   scouter  MapleScouter's cut from hexa converted: expert-set per boss, the
    //            reference for bosses when no run is entered
    //   site     the GMS Upgrade Tracker's clear %: only when neither of the above
    // The first available is the predictor; the Progression tab shows the run and
    // MapleScouter side by side when both exist.
    const PREDICTOR_LABELS = { run: 'Calibrated run', scouter: 'MapleScouter estimate', site: 'Upgrade site clear %' };

    /** Execution factor applied to capacity estimates (MapleScouter, site %). */
    function capacityExecution(character, fallback) {
        return parseFloat(character.executionFactor) || fallback;
    }

    /**
     * The day a timed run or site clear % was measured, which picks the boss
     * table it is priced against. Null for one entered before runs were dated:
     * those all predate the first boss change.
     */
    function calibDate(character) {
        return character.calibDate || null;
    }

    /**
     * DPS from a timed clear, or a DPS set directly. A party clear is split
     * evenly across the party. The clear time is inverted through the burst model
     * the projections use, not divided as a plain average: bursts land at the
     * start of each cycle, so a short fight banks more than its average share.
     * The boss is priced as it stood on the day of the run.
     */
    function runDps(character) {
        if (character.manualDps) return character.manualDps * 1e9 * upgradeGainSince(character, 'calib');
        const boss = character.calibBoss, diff = character.calibDifficulty;
        const mins = parseFloat(character.calibMinutes);
        if (!boss || !diff || !(mins > 0)) return 0;
        const eff = effectiveHP(boss, diff, anchoredCharacter(character, 'calib'), calibDate(character));
        if (!eff) return 0;
        const party = Math.max(1, parseInt(character.calibParty, 10) || 1);
        return (eff.total / party) / damageByTime(mins * 60, 1) * upgradeGainSince(character, 'calib');
    }

    /**
     * DPS MapleScouter's cut implies on one boss: the share of the boss's
     * effective HP the cut says lands inside the timer. MapleScouter's cuts are
     * the prediction as given, so the execution factor defaults to 1. Bosses
     * without a threshold use the Normal Kalos cut, its best fitted one.
     */
    function scouterDps(character, baseName = 'Kalos the Guardian', difficulty = 'Normal', { raw = false } = {}) {
        let cut = scouterCut(character, baseName, difficulty);
        if (cut === null) {
            cut = scouterCut(character, 'Kalos the Guardian', 'Normal');
            baseName = 'Kalos the Guardian';
            difficulty = 'Normal';
        }
        if (cut === null) return 0;
        const eff = effectiveHP(baseName, difficulty, anchoredCharacter(character, 'hexa'), SCOUTER_FIT_DATE);
        if (!eff) return 0;
        const exec = raw ? 1 : capacityExecution(character, 1);
        return (eff.total * cut / 100) / damageByTime(eff.limit, 1) / exec * upgradeGainSince(character, 'hexa');
    }

    /**
     * DPS from the GMS Upgrade Tracker's clear %: the share of a boss's
     * requirement delivered inside the timer under a clean rotation, divided by
     * the execution factor (default 1.3). The boss and its timer are taken as
     * they stood on the day the % was read.
     */
    function siteDps(character) {
        const boss = character.calibBoss, diff = character.calibDifficulty;
        const pct = parseFloat(character.calibPercent);
        if (!(pct > 0) || !boss || !diff) return 0;
        const eff = effectiveHP(boss, diff, anchoredCharacter(character, 'calib'), calibDate(character));
        if (!eff) return 0;
        return (eff.total * pct / 100) / damageByTime(eff.limit, 1)
            / capacityExecution(character, DEFAULT_EXECUTION) * upgradeGainSince(character, 'calib');
    }

    /**
     * Sources available for a character, predictor first. The site's % only
     * appears when there is neither a run nor hexa converted.
     */
    function predictionSources(character) {
        const out = [];
        if (runDps(character) > 0) out.push('run');
        if (scouterDps(character) > 0) out.push('scouter');
        if (!out.length && siteDps(character) > 0) out.push('site');
        return out;
    }

    /** The headline DPS for a source (MapleScouter's is its Normal Kalos figure). */
    function sourceDps(character, source) {
        if (source === 'run') return runDps(character);
        if (source === 'scouter') return scouterDps(character);
        if (source === 'site') return siteDps(character);
        return 0;
    }

    /**
     * Pace for one boss from one source. `paceCharacter` lets the what-if layer
     * keep the real character's damage while pricing the boss for an adjusted
     * level or IED.
     */
    function sourcePace(character, baseName, difficulty, source, paceCharacter = character) {
        const dps = source === 'scouter' ? scouterDps(character, baseName, difficulty) : sourceDps(character, source);
        if (!(dps > 0)) return null;
        const pace = bossPace(baseName, difficulty, paceCharacter, dps);
        return pace ? Object.assign(pace, { dps, source }) : null;
    }

    /** Pace from the character's predictor, or null when nothing is calibrated. */
    function predictPace(character, baseName, difficulty) {
        const source = predictionSources(character)[0];
        return source ? sourcePace(character, baseName, difficulty, source) : null;
    }

    /** The predictor's headline DPS (kept for callers that want one number). */
    function characterDps(character) {
        const source = predictionSources(character)[0];
        return source ? sourceDps(character, source) : 0;
    }

    /** " · +2.4% from 3 upgrades since 2026-10-12", or '' when there are none. */
    function describeUpgradeGain(character, kind) {
        const a = character.calibAnchors && character.calibAnchors[kind];
        if (!a || !a.upgrades || Math.abs(a.gain - 1) < 1e-6) return '';
        const pct = (a.gain - 1) * 100;
        return ` · ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% from ${a.upgrades} upgrade${a.upgrades === 1 ? '' : 's'} since ${a.since}`;
    }

    /** One line describing a source, for the Progression summary. */
    function describeSource(character, source) {
        return describeSourceBase(character, source) + describeUpgradeGain(character, source === 'scouter' ? 'hexa' : 'calib');
    }

    function describeSourceBase(character, source) {
        if (source === 'run') {
            if (character.manualDps) return `DPS set directly: ${character.manualDps}B/sec`;
            const party = parseInt(character.calibParty, 10) || 1;
            return `${character.calibMinutes} min ${character.calibDifficulty} ${character.calibBoss}`
                + `${party > 1 ? ` in a party of ${party}` : ''} → ${(runDps(character) / 1e9).toFixed(0)}B/sec`;
        }
        if (source === 'scouter') {
            const cut = scouterCut(character, 'Kalos the Guardian', 'Normal');
            const exec = capacityExecution(character, 1);
            return `hexa converted ${Number(character.hexaConverted).toLocaleString()}: Normal Kalos ${cut.toFixed(1)}% cut`
                + `${exec !== 1 ? ` ÷ ${exec} execution` : ''} → ${(scouterDps(character) / 1e9).toFixed(0)}B/sec`;
        }
        if (source === 'site') {
            return `site clear ${character.calibPercent}% on ${character.calibDifficulty} ${character.calibBoss}`
                + ` ÷ ${capacityExecution(character, DEFAULT_EXECUTION)} execution → ${(siteDps(character) / 1e9).toFixed(0)}B/sec`;
        }
        return '';
    }

    /**
     * How much slower real runs are than MapleScouter's expert pace, measured on
     * the boss the run was timed on (or Normal Kalos when that boss has no
     * threshold). 1.25 means the run lands 80% of the damage MapleScouter expects.
     */
    function measuredExecution(character) {
        const run = runDps(character) / upgradeGainSince(character, 'calib');
        if (!(run > 0) || character.manualDps) return null;
        const scouter = scouterDps(character, character.calibBoss, character.calibDifficulty, { raw: true })
            / upgradeGainSince(character, 'hexa');
        return scouter > 0 ? scouter / run : null;
    }

    function fmtHP(v) {
        if (!isFinite(v)) return '—';
        if (v >= 1e15) return (v / 1e15).toFixed(2) + 'Q';
        if (v >= 1e12) return (v / 1e12).toFixed(0) + 'T';
        if (v >= 1e9) return (v / 1e9).toFixed(0) + 'B';
        return v.toFixed(0);
    }

    function fmtClock(s) {
        if (!isFinite(s)) return '—';
        // Round the whole value first so 23:59.6 carries to 24:00 rather than 23:60.
        const total = Math.round(s);
        const m = Math.floor(total / 60), sec = total % 60;
        return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    }

    /**
     * Copy of a character with the what-if deltas applied, clamped to sane bounds.
     * DPS is still derived from the real character, so only the projection moves.
     */
    function adjustedCharacter(character, adj) {
        return Object.assign({}, character, {
            charLevel: Math.max(200, Math.min(300, getCharLevel(character) + adj.level)),
            iedWhatIf: Math.max(0, Math.min(100, Math.round((getCharIed(character) + adj.ied) * 10) / 10))
        });
    }

    /** Every boss/difficulty pair that has combat data, ordered by crystal value. */
    function allCombatEntries() {
        const out = [];
        bossDataFlat.forEach(b => {
            const parsed = parseBossName(b.name);
            const diff = parsed.difficulty || 'Normal';
            if (bossCombat(parsed.baseName, diff)) {
                out.push({ baseName: parsed.baseName, difficulty: diff, fullName: b.name, value: b.value });
            }
        });
        return out.sort((a, b) => b.value - a.value);
    }

    root.BossEngine = {
        GAME_DATA, bossDataFlat, parseBossName, bossGroups, bossData, BLACK_MAGE,
        getBossPartyCount, getBossDifficulty, getBossValue, getBossPrice,
        CRYSTALS_PER_CHARACTER, CRYSTALS_PER_ACCOUNT, calculateTotal, getAllBossesWithValues,
        calculateGrandTotal, formatValue,
        currentMonth, currentCrystalWeek, getBlackMage, getCrystalsDone, weeklyCrystals, rosterOrder, crystalSalePlan,
        BOSS_COMBAT, BOSS_CHANGES, BOSS_TIME_LIMIT, bossCombat, bossTimeLimit,
        BURST_COOLDOWN, BURST_CDR, BURST_CYCLE, BURST_WINDOW, BURST_SHARE,
        levelMultiplier, DEFAULT_ARCANE, forceMultiplier, bossPdr, DEFAULT_IED, DEFAULT_EXECUTION, defenseMultiplier,
        getCharSkillIed, getCharTotalIed, statSheetIed, getCharIed, getCharLevel, getCharSacred, getCharArcane,
        CALIB_FIELDS, resetCalibAnchor, localDate, recordUpgradeGain, upgradeGainSince, anchoredCharacter,
        effectiveHP, damageByTime, burstsInFight, timeForDamage, bossPace,
        SCOUTER_FIT_DATE, SCOUTER_K, SCOUTER_THRESHOLDS, scouterCardValue, scouterCut,
        PREDICTOR_LABELS, capacityExecution, calibDate, runDps, scouterDps, siteDps,
        predictionSources, sourceDps, sourcePace, predictPace, characterDps,
        describeUpgradeGain, describeSource, measuredExecution, fmtHP, fmtClock,
        adjustedCharacter, allCombatEntries,
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
