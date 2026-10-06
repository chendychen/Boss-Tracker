// Game tables for the upgrade engine, current to GMS v.271 (September 2026).
//
// Sources, per table:
//   Star Force rates     Nexon v.264 notes; x1.05 star catch folded in by v.271
//                        (maplestorywiki Star_Force_Enhancement; AngeloTadeucci
//                        starforcing-calc rates.js, checked against the panel)
//   Star Force cost      maplestorywiki Base_Meso_Cost, GMS divisors
//                        (brendonmay serverDiffs.js)
//   Enhancement Mode     Nexon v.269 notes; per-level rates from tadeucci
//                        rates.js and misaomaki starforce.js
//   Star Force stats     maplestorywiki Star_Force_Enhancement/Stat_Tables
//   Potential pools      KMS official per-line pages via brendonmay
//                        cubeRates.js (120-200 bucket); GMS 151+ values +1
//   Prime chances        KMS official cube pages (brendonmay cubes.js)
//   Tier-up rates        GMS community rates (brendonmay cubes.js); Nexon has
//                        not published Glowing/Bright tier-up rates
//   Flames               maplestorywiki Bonus_Stats; brendonmay flameCalculator
//
// Values marked UNVERIFIED in the research notes are the best available and
// flagged inline.

(function (root) {
    'use strict';

    // ── Star Force ──────────────────────────────────────────────────────────

    // [success %, destroy %] per current star; maintain is the remainder.
    // Failing no longer drops a star (v.264).
    const SF_RATES = [
        [99.75, 0], [94.5, 0], [89.25, 0], [89.25, 0], [84, 0],
        [78.75, 0], [73.5, 0], [68.25, 0], [63, 0], [57.75, 0],
        [52.5, 0], [47.25, 0], [42, 0], [36.75, 0], [31.5, 0],
        [31.5, 2.055], [31.5, 2.055], [15.75, 6.74], [15.75, 6.74], [15.75, 8.425],
        [31.5, 10.275], [15.75, 12.6375], [15.75, 16.85], [10.5, 17.9], [10.5, 17.9],
        [10.5, 17.9], [7.35, 18.53], [5.25, 18.95], [3.15, 19.37], [1.05, 19.79],
    ];

    // Enhancement Mode (v.269), current star 15-21: level -> [cost mult, success %, destroy %].
    // 15-17 have no Level 4; Safeguard gives 0% destroy there instead.
    // 20->21 Level 2/4 follow the GMS calculators (KMS lists 25.2 / 16.8).
    const SF_MODES = {
        15: { 1: [1, 31.5, 2.055], 2: [1.5, 31.5, 1.37], 3: [2.5, 31.5, 0.685] },
        16: { 1: [1, 31.5, 2.055], 2: [1.5, 31.5, 1.37], 3: [2.5, 31.5, 0.685] },
        17: { 1: [1, 15.75, 6.74], 2: [1.5, 15.75, 4.2125], 3: [2.5, 15.75, 1.685] },
        18: { 1: [1, 15.75, 6.74], 2: [2, 12.6, 4.37], 3: [3.5, 10.5, 1.79], 4: [6.5, 8.4, 0] },
        19: { 1: [1, 15.75, 8.425], 2: [2, 12.6, 6.118], 3: [3.5, 10.5, 3.58], 4: [6.5, 8.4, 0] },
        20: { 1: [1, 31.5, 10.275], 2: [2, 26.25, 7.375], 3: [3.5, 21.0, 3.95], 4: [6.5, 15.75, 0] },
        21: { 1: [1, 15.75, 12.6375], 2: [2, 12.6, 8.74], 3: [3.5, 10.5, 4.475], 4: [6.5, 8.4, 0] },
    };

    // Cost per attempt: 100 * round(mult * L^3 * (S+1)^exp / div + 10), L floored to tens.
    function sfBaseCost(itemLevel, star) {
        const L = Math.floor(itemLevel / 10) * 10;
        let exp = 2.7, div = 20000, mult = 1;
        if (star < 10) { exp = 1; div = 2500; }
        else if (star <= 14) div = { 10: 40000, 11: 22000, 12: 15000, 13: 11000, 14: 7500 }[star];
        else if (star === 17) mult = 4 / 3;
        else if (star === 18) mult = 20 / 7;
        else if (star === 19) mult = 40 / 9;
        else if (star === 21) mult = 8 / 5;
        return 100 * Math.round(mult * Math.pow(L, 3) * Math.pow(star + 1, exp) / div + 10);
    }

    // Where a destroyed item's trace comes back (v.264), by the star it boomed at.
    function sfRecoverStar(star) {
        if (star >= 26) return 20;
        if (star >= 23) return 19;
        if (star >= 21) return 17;
        if (star === 20) return 15;
        return 12;
    }

    // Max stars by item level (normal equipment).
    function sfMaxStars(itemLevel) {
        if (itemLevel >= 138) return 30;
        if (itemLevel >= 128) return 20;
        if (itemLevel >= 118) return 15;
        if (itemLevel >= 108) return 10;
        if (itemLevel >= 95) return 8;
        return 5;
    }

    // Stat and ATT gained by reaching star s (1-30), per level bracket.
    // Stars 1-15 give class stats only (+2 to 5, +3 after); gloves also gain
    // ATT on 5,7,9,11,13,14,15. Weapons 1-15 ATT compounds off the weapon's
    // own ATT and is not modelled: every weapon here is already past 15.
    const SF_BRACKETS = [128, 138, 150, 160, 200, 250];
    const SF_ARMOR_16 = {   // star -> [stat, att] per bracket (index into SF_BRACKETS)
        16: [[7, 7], [9, 8], [11, 9], [13, 10], [15, 12], [17, 14]],
        17: [[7, 8], [9, 9], [11, 10], [13, 11], [15, 13], [17, 15]],
        18: [[7, 9], [9, 10], [11, 11], [13, 12], [15, 14], [17, 16]],
        19: [[7, 10], [9, 11], [11, 12], [13, 13], [15, 15], [17, 17]],
        20: [[7, 11], [9, 12], [11, 13], [13, 14], [15, 16], [17, 18]],
        21: [null, [9, 13], [11, 14], [13, 15], [15, 17], [17, 19]],
        22: [null, [9, 15], [11, 16], [13, 17], [15, 19], [17, 21]],
        23: [null, [0, 17], [0, 18], [0, 19], [0, 21], [0, 23]],
        24: [null, [0, 19], [0, 20], [0, 21], [0, 23], [0, 25]],
        25: [null, [0, 21], [0, 22], [0, 23], [0, 25], [0, 27]],
        26: [null, [0, 22], [0, 23], [0, 24], [0, 26], [0, 28]],
        27: [null, [0, 23], [0, 24], [0, 25], [0, 27], [0, 29]],
        28: [null, [0, 24], [0, 25], [0, 26], [0, 28], [0, 30]],
        29: [null, [0, 25], [0, 26], [0, 27], [0, 29], [0, 31]],
        30: [null, [0, 26], [0, 27], [0, 28], [0, 30], [0, 32]],
    };
    // Weapons (slot "weapon" only). 23+ is known for Lv200 (namu) and to 25
    // for 138-249; missing cells extend +1 per star (UNVERIFIED).
    const SF_WEAPON_16 = {
        16: [[7, 6], [9, 7], [11, 8], [13, 9], [15, 13], [17, 16]],
        17: [[7, 6], [9, 7], [11, 8], [13, 9], [15, 13], [17, 16]],
        18: [[7, 7], [9, 8], [11, 9], [13, 10], [15, 14], [17, 17]],
        19: [[7, 8], [9, 9], [11, 10], [13, 11], [15, 14], [17, 17]],
        20: [[7, 9], [9, 10], [11, 11], [13, 12], [15, 15], [17, 18]],
        21: [null, [9, 11], [11, 12], [13, 13], [15, 16], [17, 19]],
        22: [null, [9, 12], [11, 13], [13, 14], [15, 17], [17, 20]],
        23: [null, [0, 30], [0, 31], [0, 32], [0, 34], [0, 37]],
        24: [null, [0, 31], [0, 32], [0, 33], [0, 35], [0, 38]],
        25: [null, [0, 32], [0, 33], [0, 34], [0, 36], [0, 39]],
        26: [null, [0, 33], [0, 34], [0, 35], [0, 37], [0, 40]],
        27: [null, [0, 34], [0, 35], [0, 36], [0, 38], [0, 41]],
        28: [null, [0, 35], [0, 36], [0, 37], [0, 39], [0, 42]],
        29: [null, [0, 36], [0, 37], [0, 38], [0, 40], [0, 43]],
        30: [null, [0, 37], [0, 38], [0, 39], [0, 41], [0, 44]],
    };
    const GLOVE_ATT_STARS = new Set([5, 7, 9, 11, 13, 14, 15]);

    function sfBracket(itemLevel) {
        let i = -1;
        SF_BRACKETS.forEach((lvl, k) => { if (itemLevel >= lvl) i = k; });
        return Math.max(0, i);
    }

    /** { stat, att } gained on reaching star s. */
    function sfStarGain(slot, itemLevel, s) {
        if (s <= 15) {
            return { stat: s <= 5 ? 2 : 3, att: slot === 'gloves' && GLOVE_ATT_STARS.has(s) ? 1 : 0 };
        }
        const table = slot === 'weapon' ? SF_WEAPON_16 : SF_ARMOR_16;
        const row = table[s];
        if (!row) return { stat: 0, att: 0 };
        const cell = row[sfBracket(itemLevel)] || row.find(Boolean);
        return { stat: cell[0], att: cell[1] };
    }

    // ── Potential ───────────────────────────────────────────────────────────

    // Line pools per equipment type: [stat, value, weight %] in the export's
    // vocabulary, at the 12/9 (Lv <= 150) values. Lines that never add damage
    // (invincibility, decent skills, drop/meso, when-hit) are one 'other' row.
    const P = (stat, value, w) => ({ stat, value, w });
    const stats4 = (v, w) => ['str%', 'dex%', 'int%', 'luk%'].map(s => P(s, v, w));
    const CUBE_POOLS = {
        weapon: {
            prime: [...stats4(12, 9.7561), P('att%', 12, 4.878), P('matt%', 12, 4.878), P('other', 0, 4.878),
                P('damage%', 12, 4.878), P('allstat%', 9, 7.3171), P('att', 32, 4.878), P('matt', 32, 4.878),
                P('ied%', 35, 4.878), P('ied%', 40, 4.878), P('boss%', 35, 9.7561), P('boss%', 40, 4.878)],
            nonPrime: [...stats4(9, 11.6279), P('att%', 9, 6.9768), P('matt%', 9, 6.9768), P('other', 0, 9.3023),
                P('damage%', 9, 6.9768), P('allstat%', 6, 9.3023), P('ied%', 30, 6.9768), P('boss%', 30, 6.9768)],
        },
        secondary: {
            prime: [...stats4(12, 8.5106), P('att%', 12, 4.2553), P('matt%', 12, 4.2553), P('other', 0, 4.2553 + 12.766),
                P('damage%', 12, 4.2553), P('allstat%', 9, 6.383), P('att', 32, 4.2553), P('matt', 32, 4.2553),
                P('ied%', 35, 4.2553), P('ied%', 40, 4.2553), P('boss%', 35, 8.5106), P('boss%', 40, 4.2553)],
            nonPrime: [...stats4(9, 9.8039), P('att%', 9, 5.8823), P('matt%', 9, 5.8823), P('other', 0, 7.8431 + 15.6862),
                P('damage%', 9, 5.8823), P('allstat%', 6, 7.8431), P('ied%', 30, 5.8823), P('boss%', 30, 5.8823)],
        },
        emblem: {
            prime: [...stats4(12, 11.4286), P('att%', 12, 5.7143), P('matt%', 12, 5.7143), P('other', 0, 5.7143),
                P('damage%', 12, 5.7143), P('allstat%', 9, 8.5714), P('att', 32, 5.7143), P('matt', 32, 5.7143),
                P('ied%', 35, 5.7143), P('ied%', 40, 5.7143)],
            nonPrime: [...stats4(9, 12.5), P('att%', 9, 7.5), P('matt%', 9, 7.5), P('other', 0, 10),
                P('damage%', 9, 7.5), P('allstat%', 6, 10), P('ied%', 30, 7.5)],
        },
        hat: {
            prime: [...stats4(12, 9.7561), P('hp%', 12, 9.7561), P('allstat%', 9, 7.3171),
                P('cdr', 1, 7.3171), P('cdr', 2, 4.878), P('other', 0, 9.76 + 7.3171 * 3)],
            nonPrime: [...stats4(9, 9.6153), P('hp%', 9, 11.5384), P('allstat%', 6, 7.6923),
                P('other', 0, 19.23 + 7.6923 * 3)],
        },
        top: {
            prime: [...stats4(12, 10.2564), P('hp%', 12, 10.2564), P('allstat%', 9, 7.6923), P('other', 0, 10.26 + 7.6923 * 4)],
            nonPrime: [...stats4(9, 8.0646), P('hp%', 9, 9.6774), P('allstat%', 6, 6.4517), P('other', 0, 25.81 + 6.4517 * 4)],
        },
        bottom: {
            prime: [...stats4(12, 12.1212), P('hp%', 12, 12.1212), P('allstat%', 9, 9.0909), P('other', 0, 12.12 + 9.0909 * 2)],
            nonPrime: [...stats4(9, 9.6153), P('hp%', 9, 11.5384), P('allstat%', 6, 7.6923), P('other', 0, 19.23 + 7.6923 * 3)],
        },
        shoes: {
            prime: [...stats4(12, 11.1111), P('hp%', 12, 11.1111), P('allstat%', 9, 8.3333), P('other', 0, 11.11 + 8.3333 * 3)],
            nonPrime: [...stats4(9, 9.6153), P('hp%', 9, 11.5384), P('allstat%', 6, 7.6923), P('other', 0, 19.23 + 7.6923 * 3)],
        },
        gloves: {
            prime: [...stats4(12, 10), P('hp%', 12, 10), P('crit_dmg%', 8, 10), P('allstat%', 9, 7.5), P('other', 0, 10 + 7.5 * 3)],
            nonPrime: [...stats4(9, 8.9286), P('hp%', 9, 10.7143), P('allstat%', 6, 7.1429),
                ...['str', 'dex', 'int', 'luk'].map(s => P(s, 32, 1.7857)), P('other', 0, 17.86 + 7.1429 * 3)],
        },
        cape: {
            prime: [...stats4(12, 12.1212), P('hp%', 12, 12.1212), P('allstat%', 9, 9.0909), P('other', 0, 12.12 + 9.0909 * 2)],
            nonPrime: [...stats4(9, 10.4167), P('hp%', 9, 12.5), P('allstat%', 6, 8.3333), P('other', 0, 20.83 + 8.3333 * 2)],
        },
        accessory: {   // rings, pendants, earrings, face, eye, pocket share the accessory pool
            prime: [...stats4(12, 10.2564), P('hp%', 12, 10.2564), P('allstat%', 9, 7.6923), P('other', 0, 25.64 + 7.6923 * 2)],
            nonPrime: [...stats4(9, 12.5), P('hp%', 9, 15), P('allstat%', 6, 10), P('other', 0, 25)],
        },
        heart: {
            prime: [...stats4(12, 14.8148), P('hp%', 12, 14.8148), P('allstat%', 9, 11.1111), P('other', 0, 14.81)],
            nonPrime: [...stats4(9, 12.5), P('hp%', 9, 15), P('allstat%', 6, 10), P('other', 0, 25)],
        },
    };
    CUBE_POOLS.overall = CUBE_POOLS.top;
    CUBE_POOLS.shoulder = CUBE_POOLS.cape;
    CUBE_POOLS.belt = CUBE_POOLS.cape;

    const SLOT_POOL = {
        weapon: 'weapon', secondary: 'secondary', emblem: 'emblem', hat: 'hat', top: 'top',
        overall: 'overall', bottom: 'bottom', shoes: 'shoes', gloves: 'gloves', cape: 'cape',
        shoulder: 'shoulder', belt: 'belt', heart: 'heart',
        ring1: 'accessory', ring2: 'accessory', ring3: 'accessory', ring4: 'accessory',
        pendant1: 'accessory', pendant2: 'accessory', earring: 'accessory', face: 'accessory',
        eye: 'accessory', pocket: 'accessory',
    };

    // GMS items above level 150 roll one point higher on percentage lines.
    const LEVEL_BUMPED = new Set(['str%', 'dex%', 'int%', 'luk%', 'hp%', 'allstat%', 'att%', 'matt%', 'damage%']);

    /** The pool for an item, with values adjusted to its level. */
    function cubePool(slot, itemLevel) {
        const pool = CUBE_POOLS[SLOT_POOL[slot]];
        if (!pool) return null;
        const bump = itemLevel > 150 ? 1 : 0;
        const adj = arr => arr.map(l => (bump && LEVEL_BUMPED.has(l.stat) ? { ...l, value: l.value + bump } : l));
        return { prime: adj(pool.prime), nonPrime: adj(pool.nonPrime) };
    }

    const CUBES = {
        glowing: { name: 'Glowing Cube', priceKey: 'glowingCube', primeChance: [1, 0.10, 0.01],
                   tierUp: { rare: 0.14, epic: 0.06, unique: 0.025 } },
        bright: { name: 'Bright Cube', priceKey: 'brightCube', primeChance: [1, 0.20, 0.05],
                  tierUp: { rare: 0.17, epic: 0.11, unique: 0.05 } },
    };
    // Nexon caps a potential at two Boss or two IED lines.
    const CUBE_LIMITS = { boss: 2, ied: 2 };

    /** Mesos charged to reveal each new potential: level^2 x 20 above level 120. */
    function revealCost(itemLevel) {
        if (itemLevel > 120) return itemLevel * itemLevel * 20;
        if (itemLevel > 70) return itemLevel * itemLevel * 2.5;
        if (itemLevel > 30) return itemLevel * itemLevel * 0.5;
        return 0;
    }

    // ── Flames ──────────────────────────────────────────────────────────────

    // Tier odds per line. Meso reset (v.271) uses Black/Eternal odds and keeps
    // the better result. Items that are not flame-advantaged roll two tiers
    // lower and a random number of lines.
    const FLAME_TIERS_ADVANTAGED = [[4, 0.29], [5, 0.45], [6, 0.25], [7, 0.01]];
    const FLAME_TIERS_NORMAL = [[2, 0.29], [3, 0.45], [4, 0.25], [5, 0.01]];
    const FLAME_LINES_NORMAL = [[1, 0.40], [2, 0.40], [3, 0.15], [4, 0.05]];
    const FLAME_POOL_ARMOR = 19;    // 4 single stats, 6 doubles, HP, MP, ATT, MATT, DEF, speed, jump, all%, level
    const FLAME_POOL_WEAPON = 21;   // plus boss% and damage%

    // Boss-drop and boss-coin sets are flame-advantaged; Gollux and others are not.
    const FLAME_ADVANTAGED_SETS = new Set(['Eternal', 'Arcane Umbra', 'AbsoLab', 'Pitched Boss',
        'Brilliant Boss', 'Dawn Boss', 'CRA', 'Boss Accessory', 'Genesis', 'Destiny']);
    const FLAMEABLE_SLOTS = new Set(['weapon', 'hat', 'top', 'overall', 'bottom', 'shoes', 'gloves', 'cape',
        'belt', 'pendant1', 'pendant2', 'earring', 'face', 'eye', 'pocket']);

    const flameSingle = L => (L >= 230 ? 12 : L >= 200 ? 11 : L >= 180 ? 10 : L >= 160 ? 9 : L >= 140 ? 8 : 7);
    const flameDouble = L => (L >= 250 ? 7 : L >= 200 ? 6 : L >= 160 ? 5 : 4);
    const flameHp = L => (L >= 250 ? 700 : Math.floor(L / 10) * 30);
    /** Weapon flame ATT per tier, as calculators round it (ceil; UNVERIFIED). */
    function flameWeaponAtt(baseAtt, itemLevel, tier, advantaged) {
        const shift = advantaged ? 3 : 1;
        return Math.ceil(baseAtt * (Math.floor(itemLevel / 40) + 1) * tier * Math.pow(1.1, tier - shift) / 100);
    }

    // ── Skill IED by class ───────────────────────────────────────────────────
    // From Grandis Library's class overviews ("Base Stats (From Skills)",
    // Ignore DEF row), read 2026-10-05: [skill, IED %, kind], where kind is
    // P always or nearly always up, T conditional or on a cooldown,
    // U unlocked (hyper, 5th job, buffs), D a debuff on the enemy.
    // Per-stack skills are at their maximum; Freezing Breath uses its MDR
    // (30%) since Ice/Lightning hits with magic. Blaster and Lynn list none;
    // Dual Blade lists +0%.
    const CLASS_SKILL_IED = {
        'Hero': [['Combat Mastery', 50, 'P'], ['Weapon Aura', 16, 'U']],
        'Paladin': [['High Paladin', 31, 'P'], ['Noble Demand', 50, 'D'], ['Weapon Aura', 16, 'U']],
        'Dark Knight': [['Dark Resonance - Passive', 30, 'P'], ['Dark Resonance', 10, 'T'], ['Weapon Aura', 16, 'U']],
        'Bishop': [['Arcane Aim', 20, 'P'], ['Righteously Indignant - Passive', 20, 'P'], ['Angelic Wrath', 44, 'D'], ['Empirical Knowledge', 9, 'D']],
        'Ice/Lightning': [['Arcane Aim', 20, 'P'], ['Empirical Knowledge', 9, 'D'], ['Freezing Breath', 30, 'D'], ['Shatter', 10, 'T']],
        'Fire/Poison': [['Arcane Aim', 20, 'P'], ['Empirical Knowledge', 9, 'D']],
        'Dual Blade': [],
        'Shadower': [['Shadower Instinct', 20, 'P']],
        'Night Lord': [['Dark Harmony', 30, 'P'], ['Frailty Curse', 30, 'U']],
        'Pathfinder': [["Archer's Essence", 30, 'P']],
        'Marksman': [['Marksmanship', 25, 'P'], ['Greater Empowered Arrows', 20, 'P'], ['Arrow Illusion', 30, 'P'], ['Greater Empowered Arrows (stacks)', 13, 'T'], ['Bullseye Shot', 20, 'T']],
        'Bowmaster': [['Marksmanship', 25, 'P'], ['Armor Break', 40, 'P'], ['Sharp Eyes - Guardbreak', 5, 'U']],
        'Cannoneer': [['Cannon Overload', 20, 'P'], ["Pirate's Banner", 25, 'U']],
        'Buccaneer': [['Typhoon Crush', 40, 'P'], ["Pirate's Banner", 25, 'U']],
        'Corsair': [['Fullmetal Jacket', 20, 'P'], ["Pirate's Banner", 25, 'U']],
        'Dawn Warrior': [['Soul Element', 10, 'P'], ['Unpredictable', 30, 'P'], ['True Sight', 10, 'U'], ['Weapon Aura', 16, 'U']],
        'Thunder Breaker': [['Thunder God', 45, 'T']],
        'Night Walker': [['Dark Blessing', 15, 'P'], ['Adaptive Darkness III', 35, 'D']],
        'Wind Archer': [['Pinpoint Pierce', 15, 'P'], ['Albatross Max', 15, 'P'], ['Emerald Dust', 10, 'D']],
        'Blaze Wizard': [['Fires of Creation', 30, 'P']],
        'Mihile': [['Combat Mastery', 40, 'P'], ['Radiant Soul', 100, 'T'], ['Weapon Aura', 16, 'U']],
        'Aran': [['Cleaving Attack', 40, 'P'], ['Weapon Aura', 16, 'U']],
        'Evan': [['Dragon Potential', 20, 'P']],
        'Luminous': [['Arcane Pitch - Passive', 40, 'P'], ['Light Wash', 15, 'P']],
        'Mercedes': [['Defense Break', 25, 'P'], ['Spikes Royale', 30, 'D']],
        'Phantom': [["Priere D'Aria", 30, 'P'], ['Tempest', 20, 'D']],
        'Shade': [['Weaken', 20, 'P'], ['Spirit Bond 4', 30, 'P']],
        'Blaster': [],
        'Battle Mage': [['Spell Boost', 30, 'P'], ['Weakening Aura', 20, 'D']],
        'Wild Hunter': [['Wild Instinct', 40, 'P']],
        'Mechanic': [['Overclock', 30, 'P'], ['Support Unit: H-EX', 10, 'D']],
        'Xenon': [['Offensive Matrix', 30, 'P'], ['Core Overload', 30, 'T']],
        'Demon Slayer': [['Binding Darkness - Passive', 30, 'P'], ['Demon Cry', 15, 'D'], ['Weapon Aura', 16, 'U']],
        'Demon Avenger': [['Overwhelming Power', 30, 'P'], ['Nether Slice', 30, 'D'], ['Weapon Aura', 16, 'U']],
        'Kaiser': [['Unbreakable Will', 40, 'P'], ['Weapon Aura', 16, 'U']],
        'Kain': [['Natural Born Instinct', 10, 'P'], ['Dogma', 30, 'P']],
        'Cadena': [['Keen Eye', 20, 'P'], ['Summon Daggers', 30, 'D']],
        'Angelic Buster': [['Dragon Whistle', 16, 'P'], ['Final Contract', 30, 'T'], ['Finale Ribbon - Armorbreak', 15, 'U']],
        'Hayato': [['Cleaver', 35, 'P'], ['Akatsuki Samurai', 20, 'T'], ['Weapon Aura', 16, 'U']],
        'Kanna': [['Summon Tengu', 30, 'T']],
        'Ren': [['Eyes Unclouded', 40, 'P'], ['Weapon Aura', 16, 'U']],
        'Adele': [['Will to Live', 10, 'P'], ['Tolerance', 10, 'P'], ['Ruination', 20, 'P'], ['Grave Proclamation', 10, 'D'], ['Weapon Aura', 16, 'U']],
        'Illium': [['Wisdom of the Crystal', 25, 'P'], ['Umbral Brand III', 20, 'D']],
        'Khali': [['Intuition', 20, 'P'], ['Redemption', 20, 'P']],
        'Ark': [['Complete Fusion', 30, 'P'], ['Abyssal Charge Drive - Spell Bullet', 20, 'T']],
        'Hoyoung': [['Bravado', 10, 'P'], ['Asura', 10, 'P'], ["Dragon's Eye", 10, 'P'], ['Scroll: Degeneration', 20, 'D']],
        'Lara': [['Insight', 40, 'P'], ['Arbor Away', 15, 'D']],
        'Lynn': [],
        'Mo Xuan': [['Aura', 30, 'P'], ['Boundless', 20, 'P'], ['Power of Destiny', 30, 'U']],
        'Sia': [['Astral Infinity', 30, 'P'], ['Stellar III - Alchiba', 10, 'T'], ['Stellar XI - Sirius', 10, 'T']],
        'Erel Light': [['Radiant Control', 40, 'P'], ['Weapon Aura', 16, 'U']],
        'Zero': [["Rhinne's Blessing", 15, 'P'], ['Armor Split', 50, 'D'], ['Weapon Aura', 16, 'U'], ['Lapis Type 9', 30, 'U'], ['Long Sword Mastery', 30, 'P']],
        'Kinesis': [['Critical Rush', 40, 'P'], ['Psychic Smash', 15, 'D']],
    };
    // Tagged "always up" but they build while attacking, so the stat window
    // does not show them: counted on top by default. Ice/Lightning only
    // matches MapleScouter's valuation of IED (51.7%) with Arcane Aim counted.
    const STACKING_PASSIVES = new Set(['Arcane Aim']);
    // A full ignore for a few seconds; counting it would zero every IED line.
    const WINDOW_ONLY = new Set(['Radiant Soul']);

    // ── Set effects ─────────────────────────────────────────────────────────
    // What each piece threshold adds (thresholds stack). Sources: maplestorywiki
    // set pages (Eternal, Arcane Umbra, AbsoLab, Root Abyss, Pitched Boss, Boss
    // Accessory, Superior Gollux, Dawn Boss, Brilliant Boss). all = all stats
    // (flat), mainSub = primary and secondary stat, hp = flat Max HP. HP/MP %
    // and DEF lines are left out.
    const SET_EFFECTS = {
        'Eternal': { 2: { att: 40, boss: 10 }, 3: { all: 50, att: 40, boss: 10 }, 4: { att: 40, boss: 10 },
            5: { att: 40, ied: 20 }, 6: { att: 40, boss: 15 }, 7: { all: 50, att: 40, boss: 15 }, 8: { att: 40, boss: 15 } },
        'Arcane Umbra': { 2: { att: 30, boss: 10 }, 3: { att: 30, ied: 10 }, 4: { all: 50, att: 35, boss: 10 },
            5: { att: 40, boss: 10 }, 6: { att: 30 }, 7: { att: 30, ied: 10 } },
        'AbsoLab': { 2: { att: 20, boss: 10 }, 3: { all: 30, att: 20, boss: 10 }, 4: { att: 25, ied: 10 },
            5: { att: 30, boss: 10 }, 6: { att: 20 }, 7: { att: 20, ied: 10 } },
        'CRA': { 2: { mainSub: 20 }, 3: { all: 9, att: 50 }, 4: { boss: 30 } },
        'Pitched Boss': { 2: { all: 10, att: 10, boss: 10, hp: 250 }, 3: { all: 10, att: 10, ied: 10, hp: 250 },
            4: { all: 15, att: 15, critDmg: 5, hp: 375 }, 5: { all: 15, att: 15, boss: 10 }, 6: { all: 15, att: 15, ied: 10 },
            7: { all: 15, att: 15, critDmg: 5 }, 8: { all: 15, att: 15, boss: 10 }, 9: { all: 15, att: 15, critDmg: 5 },
            10: { all: 20, att: 20, boss: 10, hp: 500 } },
        'Boss Accessory': { 3: { all: 10, att: 5 }, 5: { all: 10, att: 5 }, 7: { all: 10, att: 10, ied: 10 },
            9: { all: 15, att: 10, boss: 10 } },
        'Superior Gollux': { 2: { all: 20 }, 3: { att: 35 }, 4: { boss: 30, ied: 30 } },
        'Dawn Boss': { 2: { all: 10, att: 10, boss: 10, hp: 250 }, 3: { all: 10, att: 10, hp: 250 },
            4: { all: 10, att: 10, ied: 10, hp: 250 } },
        'Brilliant Boss': { 2: { all: 20, att: 20, boss: 15, hp: 500 }, 3: { all: 20, att: 20, ied: 15, hp: 500 },
            4: { all: 20, att: 20, critDmg: 5, hp: 500 }, 5: { all: 20, att: 20, boss: 15, hp: 500 },
            6: { all: 20, att: 20, critDmg: 7.5, hp: 500 } },
    };

    root.UpgradeEngine = Object.assign(root.UpgradeEngine || {}, {
        TABLES: {
            SET_EFFECTS, CLASS_SKILL_IED, STACKING_PASSIVES, WINDOW_ONLY,
            SF_RATES, SF_MODES, sfBaseCost, sfRecoverStar, sfMaxStars, sfStarGain,
            CUBE_POOLS, SLOT_POOL, cubePool, CUBES, CUBE_LIMITS, revealCost,
            FLAME_TIERS_ADVANTAGED, FLAME_TIERS_NORMAL, FLAME_LINES_NORMAL,
            FLAME_POOL_ARMOR, FLAME_POOL_WEAPON, FLAME_ADVANTAGED_SETS, FLAMEABLE_SLOTS,
            flameSingle, flameDouble, flameHp, flameWeaponAtt,
        },
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
