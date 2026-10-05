// Upgrade engine: gear inventory, damage model and upgrade ranking.
//
// Pure logic with no DOM access, loaded by the page as a classic script and by
// the tests through node:vm. Everything hangs off one global so the page's own
// globals stay untouched.
//
// Damage model (StrategyWiki, "MapleStory/Formulas"):
//   stat value  = 4 x main + sub, where main = base x (1 + stat%) + flat
//   attack      = ATT x (1 + ATT%)
//   multipliers = (1 + damage% + boss%) x (1.35 + crit damage%) x (1 - PDR x (1 - IED))
// An upgrade is valued by how much it moves the product, expressed as final
// damage percent, which is what the Progression tab consumes.

(function (root) {
    'use strict';

    const DEFAULT_PDR = 380;   // the bosses worth upgrading for are all 380% PDR

    // Account-wide pricing. Heroic worlds buy cubes and flame resets with mesos.
    const DEFAULT_SETTINGS = {
        glowingCube: 12e6,
        brightCube: 22e6,
        flameReset: 3e6,
        pdr: DEFAULT_PDR,
        shiningStarForce: false,   // 30% off and 30% fewer booms while the event runs
        safeguard: true,           // Safeguard 15→18★
        sfProtection: '1144',      // Enhancement Mode at 18, 19, 20, 21★ (the site's default)
        sfProtectionPitched: '4444',
        sfMaxStar: 22,             // target cap for items without their own
        mvpDiscount: 0,            // % off star force up to 16→17★ (Silver 3, Gold 5, Diamond 10)
        cdrCurve: null,            // per-character cooldown curve (see CDR_CURVES); null = linear cdrValue
        cdrValue: 0.7,             // % final damage per second of hat cooldown reduction
        // How much IED lines count when choosing cube targets: 0 ignores them,
        // 1 is their full damage value. Stacked IED has sharply diminishing
        // returns and players do not roll for it, so the default is 0.
        iedWeight: 0,
    };

    /** Parses "2.5B", "500M", "12,000,000" or a number into mesos. */
    function parseMeso(value, fallback = 0) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
        const m = String(value || '').replace(/,/g, '').trim().match(/^(\d+(?:\.\d+)?)\s*([kmbt])?$/i);
        if (!m) return fallback;
        const scale = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[(m[2] || '').toLowerCase()] || 1;
        return parseFloat(m[1]) * scale;
    }

    /**
     * Normalises a stat sheet so every field the model reads is a number.
     * IED is a percentage (97.2, not 0.972).
     * @param {object} s
     * @returns {object}
     */
    function normalizeStats(s = {}) {
        const n = v => (Number.isFinite(+v) ? +v : 0);
        return {
            mainBase: n(s.mainBase), mainPct: n(s.mainPct), mainFlat: n(s.mainFlat),
            subBase: n(s.subBase), subPct: n(s.subPct), subFlat: n(s.subFlat),
            att: n(s.att), attPct: n(s.attPct),
            dmg: n(s.dmg), boss: n(s.boss),
            critDmg: n(s.critDmg), ied: n(s.ied), fd: n(s.fd),
            cdr: n(s.cdr),
            // Final damage per second of skill cooldown reduction. Cooldown has
            // no place in the damage formula, so it is valued as the extra
            // skill uptime it buys: 0.7% per second is the common estimate.
            cdrValue: s.cdrValue === undefined ? 0.7 : n(s.cdrValue),
            // A class's cooldown curve, when it has one: main stat % worth of
            // 0, 1, 2, ... seconds of total hat CDR. Replaces cdrValue.
            cdrCurve: Array.isArray(s.cdrCurve) && s.cdrCurve.length ? s.cdrCurve.map(n) : null,
            model: s.model === 'hp' ? 'hp' : 'normal',
        };
    }

    /**
     * Main stat % a cooldown curve gives at `seconds` of total CDR, clamped to
     * the curve's ends and interpolated between whole seconds.
     */
    function cdrCurveAt(curve, seconds) {
        if (!curve || !curve.length) return 0;
        const t = Math.max(0, Math.min(curve.length - 1, seconds));
        const i = Math.floor(t);
        const f = t - i;
        return i + 1 < curve.length ? curve[i] + f * (curve[i + 1] - curve[i]) : curve[i];
    }

    /**
     * Relative damage of a stat sheet against a boss with the given PDR.
     * Only ratios of this number are meaningful.
     */
    function damageIndex(stats, pdr = DEFAULT_PDR) {
        const s = normalizeStats(stats);
        // A cooldown curve is stated in main stat %, so it joins the stat %;
        // without one, cooldown is a flat final damage multiplier.
        const curvePct = s.cdrCurve ? cdrCurveAt(s.cdrCurve, s.cdr) : 0;
        const main = s.mainBase * (1 + (s.mainPct + curvePct) / 100) + s.mainFlat;
        const sub = s.subBase * (1 + s.subPct / 100) + s.subFlat;
        // Demon Avenger converts HP: 1 stat per 3.5 HP, at 80% for HP above its
        // pure (AP) HP. Pure HP is a small share of a bossing DA's total, so all
        // of it is taken at the 80% rate; only ratios matter here.
        const statValue = s.model === 'hp' ? 0.8 * main / 3.5 + sub : 4 * main + sub;
        const attack = s.att * (1 + s.attPct / 100);
        const dmgMult = 1 + (s.dmg + s.boss) / 100;
        const critMult = 1.35 + s.critDmg / 100;
        const defMult = Math.max(0, 1 - (pdr / 100) * (1 - s.ied / 100));
        const fdMult = 1 + s.fd / 100;
        const cdrMult = s.cdrCurve ? 1 : 1 + (s.cdr * s.cdrValue) / 100;
        return statValue * attack * dmgMult * critMult * defMult * fdMult * cdrMult;
    }

    const asList = v => (Array.isArray(v) ? v : v ? [v] : []);

    /**
     * Applies a stat change to a sheet. Every field adds except IED, which is a
     * list of signed lines: +40 stacks a 40% source multiplicatively and -30
     * removes a 30% source, so swapping one line for another is [+40, -30].
     * @param {object} stats
     * @param {object} delta - same fields as the sheet, ied as number or list
     * @returns {object} a new sheet
     */
    function applyDelta(stats, delta) {
        const out = normalizeStats(stats);
        for (const [k, v] of Object.entries(delta || {})) {
            if (k === 'ied') {
                let remaining = 1 - out.ied / 100;
                for (const line of asList(v)) {
                    const f = 1 - Math.abs(line) / 100;
                    remaining = line > 0 ? remaining * f : remaining / f;
                }
                out.ied = 100 * (1 - remaining);
            } else if (v && k in out && !['model', 'cdrValue', 'cdrCurve'].includes(k)) {
                out[k] += v;
            }
        }
        return out;
    }

    /** Final damage percent gained by applying delta to stats. */
    function fdGain(stats, delta, pdr = DEFAULT_PDR) {
        const before = damageIndex(stats, pdr);
        if (!before) return 0;
        return (damageIndex(applyDelta(stats, delta), pdr) / before - 1) * 100;
    }

    /** Adds deltas together; IED lines are concatenated so they stack. */
    function sumDeltas(...deltas) {
        const out = {};
        for (const d of deltas) {
            for (const [k, v] of Object.entries(d || {})) {
                if (k === 'ied') out.ied = [...asList(out.ied), ...asList(v)];
                else if (v) out[k] = (out[k] || 0) + v;
            }
        }
        return out;
    }

    /** The delta that undoes d. */
    function negateDelta(d) {
        const out = {};
        for (const [k, v] of Object.entries(d || {})) {
            if (k === 'ied') out.ied = asList(v).map(x => -x);
            else if (v) out[k] = -v;
        }
        return out;
    }

    // ── Classes ─────────────────────────────────────────────────────────────
    // Main and secondary stat, and whether the class attacks with MATT.
    // `also` lists a third stat the class draws on: Shadower, Dual Blade and
    // Cadena use STR alongside DEX, and Xenon uses all of STR, DEX and LUK.
    // Those stats are offered as potential lines but valued at nothing, which
    // undervalues them slightly. Demon Avenger's main stat is HP.
    // Sources for the newer classes: maplestorywiki.net class pages (Sia
    // Astelle INT/LUK, Erel Light STR, Mo Xuan DEX, Lynn INT).
    const CLASS_STATS = (() => {
        const t = {};
        const set = (names, main, sub, magic = false, also = []) =>
            names.forEach(n => { t[n] = { main, sub, magic, also }; });
        set(['Hero', 'Paladin', 'Dark Knight', 'Dawn Warrior', 'Mihile', 'Aran', 'Kaiser',
             'Adele', 'Zero', 'Hayato', 'Ren', 'Erel Light', 'Blaster', 'Thunder Breaker',
             'Buccaneer', 'Shade', 'Ark', 'Cannoneer', 'Demon Slayer'], 'str', 'dex');
        set(['Bowmaster', 'Marksman', 'Pathfinder', 'Wind Archer', 'Wild Hunter', 'Mercedes',
             'Kain', 'Corsair', 'Mechanic', 'Angelic Buster', 'Mo Xuan'], 'dex', 'str');
        set(['Night Lord', 'Night Walker', 'Phantom', 'Hoyoung', 'Khali'], 'luk', 'dex');
        set(['Shadower', 'Dual Blade', 'Cadena'], 'luk', 'dex', false, ['str']);
        set(['Fire/Poison', 'Ice/Lightning', 'Bishop', 'Luminous', 'Evan', 'Battle Mage',
             'Blaze Wizard', 'Kinesis', 'Illium', 'Lara', 'Kanna', 'Lynn', 'Sia'], 'int', 'luk', true);
        set(['Demon Avenger'], 'hp', 'str');
        set(['Xenon'], 'str', 'dex', false, ['luk']);
        return t;
    })();

    const STAT_NAMES = { str: 'STR', dex: 'DEX', int: 'INT', luk: 'LUK', hp: 'HP' };

    /** "DEX main · STR secondary · ATT" for a class, or '' when unknown. */
    function describeClass(className) {
        const cs = CLASS_STATS[className];
        if (!cs) return '';
        const also = cs.also.length ? ` (+${cs.also.map(k => STAT_NAMES[k]).join(', ')})` : '';
        return `${STAT_NAMES[cs.main]} main · ${STAT_NAMES[cs.sub]}${also} secondary · ${cs.magic ? 'MATT' : 'ATT'}`;
    }

    // Cooldown curves by class: main stat % worth of total hat CDR at 0, 1, 2,
    // ... seconds. Cooldown pays off at skill breakpoints, so the value is far
    // from linear. Pathfinder's is the community efficiency chart the user
    // supplied (2026-10-01).
    const CDR_CURVES = {
        Pathfinder: [0, 20, 21, 47, 75, 76, 78, 80],
    };

    function classStats(className) {
        return CLASS_STATS[className] || { main: 'str', sub: 'dex', magic: false, also: [] };
    }

    // ── Potential lines ─────────────────────────────────────────────────────
    // A parsed line is { stat, value }. stat is one of:
    //   main%, sub%, all%, att%, main, sub, all, att, boss, dmg, ied, critDmg,
    //   critRate, mainPerLevel, cooldown, other
    const STAT_WORDS = { str: 'STR', dex: 'DEX', int: 'INT', luk: 'LUK', hp: 'MaxHP' };

    /**
     * Parses a potential line such as "DEX +12%", "Boss Monster Damage: +40%",
     * "Ignore Enemy DEF +40%" or "DEX +2 per 10 Character Levels", relative to
     * the class's stats. Unrecognised lines come back as { stat: 'other' }.
     */
    function parsePotentialLine(text, className) {
        if (text && typeof text === 'object') return parseStructuredLine(text, className);
        const raw = String(text || '').trim();
        const cs = classStats(className);
        const m = raw.match(/([+-]?\d+(?:\.\d+)?)\s*(%)?/);
        const value = m ? Math.abs(parseFloat(m[1])) : 0;
        const pct = !!(m && m[2]);
        const t = raw.toLowerCase();
        const mainWord = STAT_WORDS[cs.main].toLowerCase();
        const subWord = STAT_WORDS[cs.sub].toLowerCase();
        const has = w => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(t);

        if (/boss/.test(t)) return { stat: 'boss', value };
        if (/ignore|ied|defense|def\b/.test(t) && pct) return { stat: 'ied', value };
        if (/crit(ical)?\s*(damage|dmg)/.test(t)) return { stat: 'critDmg', value };
        if (/crit(ical)?\s*rate/.test(t)) return { stat: 'critRate', value };
        if (/cooldown/.test(t)) return { stat: 'cooldown', value };
        if (/per\s*\d+\s*(character\s*)?level/.test(t)) {
            const per = parseFloat((t.match(/per\s*(\d+)/) || [])[1]) || 10;
            if (has(mainWord) || /all stat/.test(t)) return { stat: 'mainPerLevel', value, per };
            return { stat: 'other', value };
        }
        if (/all stat/.test(t)) return { stat: pct ? 'all%' : 'all', value };
        const attWord = cs.magic ? /magic att|matt/ : /(^|[^c])att(ack)?([^a-z]|$)/;
        if (attWord.test(t) && !(cs.magic === false && /magic/.test(t))) {
            return { stat: pct ? 'att%' : 'att', value };
        }
        if (/damage/.test(t) && pct) return { stat: 'dmg', value };
        if (has(mainWord)) return { stat: pct ? 'main%' : 'main', value };
        if (has(subWord)) return { stat: pct ? 'sub%' : 'sub', value };
        return { stat: 'other', value };
    }

    /**
     * Maps a structured line from an Upgrade Tracker export ({stat: 'dex%',
     * value: 12}, 'matt%', 'crit_dmg%', 'allstat%', 'boss%', 'cdr', ...) or one
     * already in the engine's own vocabulary.
     */
    const OWN_STATS = new Set(['main%', 'sub%', 'all%', 'att%', 'main', 'sub', 'all', 'att', 'boss',
        'dmg', 'ied', 'critDmg', 'critRate', 'mainPerLevel', 'cooldown', 'other']);
    function parseStructuredLine(line, className) {
        const value = Math.abs(+line.value || 0);
        const key = String(line.stat || '').toLowerCase();
        if (OWN_STATS.has(line.stat)) return { ...line, value };
        const cs = classStats(className);
        const pct = key.endsWith('%');
        const base = key.replace(/%$/, '');
        if (base === 'boss') return { stat: 'boss', value };
        if (base === 'ied' || base === 'ignore' || base === 'ignore_def') return { stat: 'ied', value };
        if (base === 'damage' || base === 'dmg') return { stat: 'dmg', value };
        if (base === 'crit_dmg') return { stat: 'critDmg', value };
        if (base === 'crit_rate') return { stat: 'critRate', value };
        if (base === 'cdr') return { stat: 'cooldown', value };
        if (base === 'allstat') return { stat: pct ? 'all%' : 'all', value };
        if (base === 'att' || base === 'matt') {
            return (base === 'matt') === cs.magic ? { stat: pct ? 'att%' : 'att', value } : { stat: 'other', value };
        }
        if (base === cs.main) return { stat: pct ? 'main%' : 'main', value };
        if (base === cs.sub) return { stat: pct ? 'sub%' : 'sub', value };
        if (/per_?(\d+_?)?level/.test(base) && base.startsWith(cs.main)) {
            return { stat: 'mainPerLevel', value, per: parseFloat((base.match(/(\d+)/) || [])[1]) || 10 };
        }
        return { stat: 'other', value };
    }

    /** Stat delta granted by a set of potential lines. */
    function linesDelta(lines, className, charLevel = 280) {
        const d = {};
        const add = (k, v) => { d[k] = (d[k] || 0) + v; };
        const hpMain = classStats(className).main === 'hp';   // all stat excludes HP
        for (const raw of lines || []) {
            const l = parsePotentialLine(raw, className);
            switch (l.stat) {
                case 'main%': add('mainPct', l.value); break;
                case 'sub%': add('subPct', l.value); break;
                case 'all%': if (!hpMain) add('mainPct', l.value); add('subPct', l.value); break;
                case 'main': add('mainBase', l.value); break;
                case 'sub': add('subBase', l.value); break;
                case 'all': if (!hpMain) add('mainBase', l.value); add('subBase', l.value); break;
                case 'mainPerLevel': add('mainBase', l.value * Math.floor(charLevel / (l.per || 10))); break;
                case 'att%': add('attPct', l.value); break;
                case 'att': add('att', l.value); break;
                case 'boss': add('boss', l.value); break;
                case 'dmg': add('dmg', l.value); break;
                case 'critDmg': add('critDmg', l.value); break;
                case 'cooldown': add('cdr', l.value); break;
                case 'ied': d.ied = [...asList(d.ied), l.value]; break;
                default: break;
            }
        }
        return d;
    }

    /**
     * Stat delta granted by an item's flames. Flames are {str, dex, int, luk,
     * hp, att, matt, allStatPercent, bossDamagePercent, damagePercent}.
     * Flame main stat is base stat (scaled by stat%).
     */
    function flameDelta(flames, className) {
        if (!flames) return {};
        const cs = classStats(className);
        const f = k => +flames[k] || 0;
        return {
            mainBase: f(cs.main), subBase: f(cs.sub),
            att: cs.magic ? f('matt') : f('att'),
            mainPct: cs.main === 'hp' ? 0 : f('allStatPercent'), subPct: f('allStatPercent'),
            boss: f('bossDamagePercent'), dmg: f('damagePercent'),
        };
    }

    // ── Absorbing Markov chains ─────────────────────────────────────────────

    /** Solves A x = b in place by Gaussian elimination with partial pivoting. */
    function solveLinear(A, b) {
        const n = b.length;
        for (let c = 0; c < n; c++) {
            let p = c;
            for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
            [A[c], A[p]] = [A[p], A[c]];
            [b[c], b[p]] = [b[p], b[c]];
            for (let r = c + 1; r < n; r++) {
                const f = A[r][c] / A[c][c];
                if (!f) continue;
                for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
                b[r] -= f * b[c];
            }
        }
        const x = new Array(n).fill(0);
        for (let r = n - 1; r >= 0; r--) {
            let v = b[r];
            for (let k = r + 1; k < n; k++) v -= A[r][k] * x[k];
            x[r] = v / A[r][r];
        }
        return x;
    }

    /**
     * Expected totals to climb from star `from` to `to`.
     *
     * step(s) describes one attempt at star s: { cost, success, destroy, drop }
     * as probabilities (the remainder keeps the star), plus per-attempt extras
     * the caller wants summed (e.g. booms). A destroyed item comes back at
     * `recoverStar` after paying `boomCost`. Returns { cost, booms, attempts }.
     */
    function climbExpectation(from, to, step, { recoverStar = 12, boomCost = 0 } = {}) {
        if (to <= from) return { cost: 0, booms: 0, attempts: 0 };
        const lo = Math.min(from, recoverStar);
        const states = [];
        for (let s = lo; s < to; s++) states.push(s);
        const idx = s => s - lo;
        const n = states.length;
        const solveFor = perAttempt => {
            const A = states.map(() => new Array(n).fill(0));
            const b = new Array(n).fill(0);
            states.forEach(s => {
                const r = idx(s);
                const st = step(s);
                const stay = 1 - st.success - st.destroy - (st.drop || 0);
                A[r][r] += 1 - stay;
                if (s + 1 < to) A[r][idx(s + 1)] -= st.success;
                if (st.drop) A[r][idx(Math.max(lo, s - 1))] -= st.drop;
                if (st.destroy) A[r][idx(recoverStar)] -= st.destroy;
                b[r] = perAttempt(st);
            });
            return solveLinear(A, b)[idx(from)];
        };
        return {
            cost: solveFor(st => st.cost + st.destroy * boomCost),
            booms: solveFor(st => st.destroy),
            attempts: solveFor(() => 1),
        };
    }

    // ── Cubing ──────────────────────────────────────────────────────────────

    /**
     * Collapses a line pool to what matters for one class: lines that move the
     * same stats by the same amount merge, so "LUK +12%" and "Max MP +12%"
     * become one "nothing" entry for a DEX class. Returns [{line, w}].
     */
    function collapsePool(pool, className) {
        const merged = new Map();
        for (const entry of pool || []) {
            const line = parsePotentialLine(entry, className);
            const useful = !['other', 'critRate'].includes(line.stat);
            const key = useful ? `${line.stat}:${line.value}` : 'other';
            const prev = merged.get(key);
            if (prev) prev.w += entry.w;
            else merged.set(key, { line: useful ? line : { stat: 'other', value: 0 }, w: entry.w });
        }
        const total = [...merged.values()].reduce((a, e) => a + e.w, 0) || 1;
        return [...merged.values()].map(e => ({ line: e.line, w: e.w / total }));
    }

    /**
     * Distribution of final-damage outcomes from one roll of an item's
     * potential. `pools.prime` and `pools.nonPrime` are line pools ({stat,
     * value, w}); `primeChance[i]` is the chance line i is prime (line 0 is
     * always prime at Legendary). `limits` caps how many lines of a stat may
     * appear together, e.g. { ied: 2, boss: 2 }; outcomes that break a cap are
     * rerolled, i.e. dropped and the rest renormalised.
     * Returns outcomes sorted best first: [{ fd, p, lines }].
     */
    function cubeOutcomes({ stats, className, charLevel, currentLines, lineCount = 3,
                            pools, primeChance, limits = {}, pdr = DEFAULT_PDR }) {
        const prime = collapsePool(pools.prime, className);
        const nonPrime = collapsePool(pools.nonPrime, className);
        const perLine = [];
        for (let i = 0; i < lineCount; i++) {
            const pc = i === 0 ? 1 : (primeChance[i] ?? primeChance[primeChance.length - 1]);
            const opts = new Map();
            const add = (arr, scale) => arr.forEach(e => {
                const k = `${e.line.stat}:${e.line.value}`;
                const prev = opts.get(k);
                if (prev) prev.w += e.w * scale;
                else opts.set(k, { line: e.line, w: e.w * scale });
            });
            add(prime, pc);
            if (pc < 1) add(nonPrime, 1 - pc);
            perLine.push([...opts.values()].filter(o => o.w > 0));
        }

        const without = negateDelta(linesDelta(currentLines || [], className, charLevel));
        const base = applyDelta(stats, without);
        const baseIndex = damageIndex(stats, pdr);
        const byKey = new Map();
        let kept = 0;
        const walk = (i, chosen, w) => {
            if (i === lineCount) {
                if (Object.keys(limits).length) {
                    const counts = {};
                    for (const l of chosen) counts[l.stat] = (counts[l.stat] || 0) + 1;
                    for (const [stat, max] of Object.entries(limits)) if ((counts[stat] || 0) > max) return;
                }
                kept += w;
                const key = chosen.map(l => `${l.stat}:${l.value}`).sort().join('|');
                const prev = byKey.get(key);
                if (prev) { prev.p += w; return; }
                const after = applyDelta(base, linesDelta(chosen, className, charLevel));
                byKey.set(key, { fd: (damageIndex(after, pdr) / baseIndex - 1) * 100, p: w, lines: chosen.slice() });
                return;
            }
            for (const o of perLine[i]) {
                chosen.push(o.line);
                walk(i + 1, chosen, w * o.w);
                chosen.pop();
            }
        };
        walk(0, [], 1);
        const out = [...byKey.values()];
        out.forEach(o => { o.p /= kept || 1; });
        return out.sort((a, b) => b.fd - a.fd);
    }

    /**
     * For "cube until the result is at least t", the expected rolls and the
     * expected gain, for each distinct useful threshold. Outcomes must be
     * sorted best first. Thresholds with no gain over current are skipped.
     */
    function cubeThresholds(outcomes, { minGain = 0.01, step = 0.01 } = {}) {
        // Outcomes closer than `step` % FD are one target: nobody cubes for the
        // difference, and it keeps the option list short.
        const res = [];
        let p = 0, pf = 0;
        for (let i = 0; i < outcomes.length; i++) {
            p += outcomes[i].p;
            pf += outcomes[i].p * outcomes[i].fd;
            const next = outcomes[i + 1];
            const bin = Math.floor(outcomes[i].fd / step);
            if (next && Math.floor(next.fd / step) === bin) continue;
            const threshold = bin * step;
            if (threshold < minGain) break;
            res.push({ threshold, p, rolls: 1 / p, gain: pf / p, at: outcomes[i].lines });
        }
        return res;
    }

    // ── Star Force ──────────────────────────────────────────────────────────

    const T = () => root.UpgradeEngine.TABLES;

    /**
     * Enhancement Mode level used at current stars 18-21, plus Safeguard at
     * 15-17, as the site's "SG 1144" shorthand. Pitched and Brilliant items
     * default to always protected (4444), as a boom there costs a pitched item.
     */
    function sfProtection(item, settings) {
        const always = /pitched|brilliant/i.test(item.set || '');
        const spec = String(always ? settings.sfProtectionPitched : settings.sfProtection).replace(/\D/g, '');
        return {
            safeguard: settings.safeguard !== false,
            modes: { 18: +spec[0] || 1, 19: +spec[1] || 1, 20: +spec[2] || 1, 21: +spec[3] || 1 },
        };
    }

    /** One attempt at star s: { cost, success, destroy } with protection and events. */
    function sfStep(item, s, settings) {
        const tables = T();
        const base = tables.sfBaseCost(item.level, s);
        const shining = !!settings.shiningStarForce;
        const discount = (shining ? 0.7 : 1) * (s <= 16 ? 1 - (settings.mvpDiscount || 0) / 100 : 1);
        const prot = sfProtection(item, settings);
        let [success, destroy] = tables.SF_RATES[s] || [0, 0];
        let cost = base * discount;
        if (s >= 15 && s <= 17 && prot.safeguard) {
            destroy = 0;
            cost += 2 * base;                    // the safeguard premium is never discounted
        } else if (s >= 18 && s <= 21) {
            const mode = tables.SF_MODES[s][prot.modes[s]] || tables.SF_MODES[s][1];
            cost = base * mode[0] * discount;
            success = mode[1];
            destroy = mode[2];
        }
        if (shining && s <= 21) destroy *= 0.7;  // 30% fewer booms below 22
        return { cost, success: success / 100, destroy: destroy / 100 };
    }

    /** Stat delta from climbing an item from star a to b. */
    function sfDelta(item, a, b, className) {
        const cs = classStats(className);
        let stat = 0, att = 0;
        for (let s = a + 1; s <= b; s++) {
            const g = T().sfStarGain(item.slot, item.level, s);
            stat += g.stat;
            att += g.att;
        }
        return { mainBase: cs.main === 'hp' ? 0 : stat, subBase: stat, att };
    }

    /**
     * Expected mesos, booms and attempts for each single step s -> s+1 up to
     * `upTo`, including the re-climb after a boom. A boom costs the item's
     * replacement cost (0 when a trace is restored for free) and returns it to
     * the star v.264 restores that star to, which is always lower, so steps can
     * be filled in upward:
     *   E[s] = (cost + destroy x (boomCost + E[recover(s) -> s])) / success
     * Climbs then add: E[a -> b] = sum of E[s] for a <= s < b.
     */
    function sfSteps(item, upTo, settings) {
        const tables = T();
        const lo = Math.min(item.stars, 12);
        const E = {}, B = {}, A = {};
        const span = (arr, a, b) => { let t = 0; for (let k = a; k < b; k++) t += arr[k]; return t; };
        for (let st = lo; st < upTo; st++) {
            const step = sfStep(item, st, settings);
            const r = Math.max(lo, tables.sfRecoverStar(st));
            const back = { e: span(E, r, st), b: span(B, r, st), a: span(A, r, st) };
            E[st] = (step.cost + step.destroy * ((item.replacementCost || 0) + back.e)) / step.success;
            B[st] = (step.destroy * (1 + back.b)) / step.success;
            A[st] = (1 + step.destroy * back.a) / step.success;
        }
        return (a, b) => ({ cost: span(E, a, b), booms: span(B, a, b), attempts: span(A, a, b) });
    }

    function sfCap(item, settings) {
        const levelCap = T().sfMaxStars(item.level);
        const cap = item.starCap > 0 ? item.starCap : (settings.sfMaxStar || 22);
        return Math.min(levelCap, cap);
    }

    function starForceOptions(item, ctx) {
        if (item.locked || item.sfKind !== 'ordinary') return [];
        if (!item.stars && !(item.starCap > 0)) return [];   // never starred: emblems, badges, pockets
        const cap = sfCap(item, ctx.settings);
        if (item.stars >= cap) return [];
        const climb = sfSteps(item, cap, ctx.settings);
        const out = [];
        // Every start star, so the plan can continue a chain it has begun.
        for (let from = item.stars; from < cap; from++) {
            for (let to = from + 1; to <= cap; to++) {
                const c = climb(from, to);
                const gain = fdGain(ctx.stats, sfDelta(item, from, to, ctx.className), ctx.pdr);
                if (gain <= 0 || !isFinite(c.cost)) continue;
                out.push({
                    type: 'starforce', slot: item.slot, start: item.stars, from, to,
                    label: `${item.name} ${from}★→${to}★`,
                    detail: `~${c.attempts.toFixed(0)} attempts · ${c.booms.toFixed(2)} booms expected`,
                    cost: c.cost, fdGain: gain,
                });
            }
        }
        return out;
    }

    // ── Cube options ────────────────────────────────────────────────────────

    const TIER_ORDER = ['rare', 'epic', 'unique', 'legendary'];

    /**
     * A potential line as cube targeting values it: IED is scaled by
     * `weight`, and at 0 becomes junk. `shown` keeps the rolled value for
     * display. Damage bookkeeping (the stat sheet) never goes through this.
     */
    function weighIed(line, className, weight) {
        const parsed = { ...parsePotentialLine(line, className) };
        if (line && line.w !== undefined) parsed.w = line.w;
        if (parsed.stat !== 'ied' || weight >= 1) return parsed;
        if (!(weight > 0)) return { stat: 'other', value: 0, w: parsed.w };
        return { ...parsed, shown: parsed.value, value: parsed.value * weight };
    }

    /** "DEX 13 / DEX 10 / All 7" in the class's own stat names. */
    function describeLines(lines, className) {
        const cs = classStats(className);
        const name = {
            'main%': STAT_NAMES[cs.main], 'sub%': STAT_NAMES[cs.sub], 'all%': 'All', 'att%': cs.magic ? 'MATT' : 'ATT',
            boss: 'Boss', ied: 'IED', dmg: 'Dmg', critDmg: 'CD', main: STAT_NAMES[cs.main],
            att: cs.magic ? 'MATT' : 'ATT', mainPerLevel: `${STAT_NAMES[cs.main]}/lv`, cooldown: 'CDR',
        };
        const pct = l => (l.stat === 'cooldown' ? 's' : /%$|boss|ied|dmg|critDmg/.test(l.stat) ? '' : ' flat');
        const useful = lines.filter(l => name[l.stat]);
        if (!useful.length) return 'nothing useful';
        return useful.map(l => `${name[l.stat]} ${l.shown ?? l.value}${pct(l)}`).join(' / ');
    }

    /**
     * The unit a potential target is stated in, as players roll by it: main
     * stat % on armor and accessories, ATT % (MATT %) on weapon, secondary and
     * emblem, where boss and IED lines trade against attack.
     */
    function targetUnit(slot, className) {
        const cs = classStats(className);
        const wse = ['weapon', 'secondary', 'emblem'].includes(slot);
        return wse ? { key: 'attPct', name: cs.magic ? 'MATT' : 'ATT' }
            : { key: 'mainPct', name: STAT_NAMES[cs.main] };
    }

    /**
     * What one line is worth in a unit (1% main stat or 1% ATT), measured on
     * this character's own sheet: "All Stat 10%" might be 11.2% DEX. IED is
     * valued per line; two IED lines stack slightly below the sum.
     */
    function lineEquivalent(stats, unitKey, className, charLevel, pdr) {
        const per = fdGain(stats, { [unitKey]: 1 }, pdr) || 1;
        const cache = new Map();
        return line => {
            const k = `${line.stat}:${line.value}`;
            if (!cache.has(k)) cache.set(k, fdGain(stats, linesDelta([line], className, charLevel), pdr) / per);
            return cache.get(k);
        };
    }

    /**
     * Scores a whole roll in the unit: what all its lines together are worth.
     * Lines do not simply add: cooldown follows a class curve (2s + 1s is the
     * 3s value, not the 2s and 1s values summed) and IED stacks.
     */
    function lineSetScorer(stats, unitKey, className, charLevel, pdr) {
        const per = fdGain(stats, { [unitKey]: 1 }, pdr) || 1;
        const cache = new Map();
        return lines => {
            const parsed = lines.map(l => parsePotentialLine(l, className));
            const k = parsed.map(l => `${l.stat}:${l.value}`).sort().join('|');
            if (!cache.has(k)) cache.set(k, fdGain(stats, linesDelta(parsed, className, charLevel), pdr) / per);
            return cache.get(k);
        };
    }

    /**
     * "Roll until the result scores at least t" for each whole-number t above
     * the current score, where each outcome has a player-readable `score`.
     * Gains are still exact FD. Each threshold carries the most likely
     * outcomes that meet it, so the target can be shown as line sets to hope
     * for. Outcomes need { score, fd, p, lines }.
     */
    function scoreThresholds(outcomes, { current = 0, step = 1, minGain = 0.01 } = {}) {
        const sorted = outcomes.slice().sort((a, b) => b.score - a.score);
        const res = [];
        const top = [];
        let p = 0, pf = 0, ps = 0;
        for (let i = 0; i < sorted.length; i++) {
            const o = sorted[i];
            p += o.p;
            pf += o.p * o.fd;
            ps += o.p * o.score;
            top.push(o);
            top.sort((a, b) => b.p - a.p);
            if (top.length > 3) top.pop();
            const bin = Math.floor(o.score / step + 1e-9);
            const next = sorted[i + 1];
            if (next && Math.floor(next.score / step + 1e-9) === bin) continue;
            const threshold = bin * step;
            if (threshold <= current + 1e-9) break;
            const gain = pf / p;
            if (gain < minGain) continue;
            res.push({ threshold, p, rolls: 1 / p, gain, expect: ps / p,
                hits: top.map(t => ({ lines: t.lines, share: t.p / p })) });
        }
        return res;
    }

    function cubeOptions(item, ctx) {
        const tables = T();
        if (item.locked || !item.potTier || item.potTier === 'none') return [];
        const rawPools = tables.cubePool(item.slot, item.level);
        if (!rawPools) return [];
        const pools = {
            prime: rawPools.prime.map(l => weighIed(l, ctx.className, ctx.iedWeight)),
            nonPrime: rawPools.nonPrime.map(l => weighIed(l, ctx.className, ctx.iedWeight)),
        };
        const weigh = l => weighIed(l, ctx.className, ctx.iedWeight);
        const current = (item.potLines || []).map(weigh);
        const unit = targetUnit(item.slot, ctx.className);
        const base = applyDelta(ctx.stats, negateDelta(linesDelta(current, ctx.className, ctx.charLevel)));
        const scoreOf = lineSetScorer(base, unit.key, ctx.className, ctx.charLevel, ctx.pdr);
        const now = scoreOf(current);
        const out = [];
        for (const [key, cube] of Object.entries(tables.CUBES)) {
            const price = (ctx.settings[cube.priceKey] || 0) + tables.revealCost(item.level);
            let tierCost = 0;
            for (let t = TIER_ORDER.indexOf(item.potTier); t >= 0 && t < 3; t++) {
                tierCost += price / cube.tierUp[TIER_ORDER[t]];
            }
            const outcomes = cubeOutcomes({
                stats: ctx.stats, className: ctx.className, charLevel: ctx.charLevel,
                currentLines: current, lineCount: item.lineCount || 3, pools,
                primeChance: cube.primeChance, limits: tables.CUBE_LIMITS, pdr: ctx.pdr,
            });
            outcomes.forEach(o => { o.score = scoreOf(o.lines); });
            const nowPct = Math.floor(now);
            for (const th of scoreThresholds(outcomes, { current: now })) {
                const hits = th.hits.map(h => describeLines(h.lines, ctx.className));
                const beat = th.threshold <= nowPct + 1;
                out.push({
                    type: 'cube', slot: item.slot, cube: key,
                    label: beat ? `Cube ${item.name} until it beats ${nowPct}% ${unit.name}`
                        : `Cube ${item.name} to ${th.threshold}%+ ${unit.name}`,
                    target: `${th.threshold}%+ ${unit.name}`, now: `${nowPct}% ${unit.name}`,
                    threshold: th.threshold, unit: unit.name, unitKey: unit.key,
                    detail: `${cube.name}s · ${tierCost ? 'tier up, then ' : ''}~${Math.round(th.rolls)} cubes`
                        + ` · expect ~${Math.round(th.expect)}%`,
                    hits, cubes: th.rolls, cubeName: cube.name,
                    cost: tierCost + th.rolls * price, fdGain: th.gain,
                });
            }
        }
        return keepEfficientFrontier(out);
    }

    /**
     * Of many alternative targets for one item, keeps the upper convex hull of
     * (cost, gain) from the origin: the cheapest good target, then each bigger
     * target whose extra gain is still bought at a better rate than any target
     * beyond it. Anything under the hull is never the right next step.
     */
    function keepEfficientFrontier(options) {
        const pts = options.filter(o => o.fdGain > 0 && isFinite(o.cost)).sort((a, b) => a.cost - b.cost);
        const hull = [];
        const cross = (o, a, b) => (a.cost - o.cost) * (b.fdGain - o.fdGain) - (a.fdGain - o.fdGain) * (b.cost - o.cost);
        const origin = { cost: 0, fdGain: 0 };
        for (const p of pts) {
            if (hull.length && p.fdGain <= hull[hull.length - 1].fdGain) continue;
            while (hull.length >= 1 && cross(hull.length >= 2 ? hull[hull.length - 2] : origin, hull[hull.length - 1], p) >= 0) hull.pop();
            hull.push(p);
        }
        // Thin to targets at least 25% apart in cost: the curve is smooth, and
        // a plan needs a handful of rungs per item, not every 0.01%.
        const out = [];
        hull.forEach((p, i) => {
            const last = out[out.length - 1];
            if (!last || i === hull.length - 1 || p.cost >= last.cost * 1.25) out.push(p);
        });
        return out;
    }

    // ── Flame options ───────────────────────────────────────────────────────

    /** Flame line types that matter to a class, with their per-tier delta. */
    function flameLineTypes(item, className) {
        const tables = T();
        const cs = classStats(className);
        const L = item.level;
        const single = tables.flameSingle(L), dbl = tables.flameDouble(L);
        const four = ['str', 'dex', 'int', 'luk'];
        const types = [];
        const stat = (k, v) => (k === cs.main ? { mainBase: v } : k === cs.sub ? { subBase: v } : null);
        for (const k of four) {
            const d = stat(k, single);
            if (d) types.push({ name: k.toUpperCase(), per: tier => scale(d, tier) });
        }
        for (let i = 0; i < 4; i++) {
            for (let j = i + 1; j < 4; j++) {
                const d = sumDeltas(stat(four[i], dbl), stat(four[j], dbl));
                if (Object.keys(d).length) types.push({ name: `${four[i]}+${four[j]}`.toUpperCase(), per: tier => scale(d, tier) });
            }
        }
        if (cs.main === 'hp') types.push({ name: 'HP', per: tier => ({ mainBase: tables.flameHp(L) * tier }) });
        const weapon = item.slot === 'weapon';
        const baseAtt = (item.baseStats && (cs.magic ? item.baseStats.matt : item.baseStats.att)) || 0;
        types.push({ name: cs.magic ? 'MATT' : 'ATT', per: tier => ({
            att: weapon ? tables.flameWeaponAtt(baseAtt, L, tier, ctxAdvantaged(item)) : tier }) });
        types.push({ name: 'All%', per: tier => (cs.main === 'hp' ? { subPct: tier } : { mainPct: tier, subPct: tier }) });
        if (weapon) {
            types.push({ name: 'Boss', per: tier => ({ boss: 2 * tier }) });
            types.push({ name: 'Dmg', per: tier => ({ dmg: tier }) });
        }
        return types;
    }

    const scale = (d, k) => Object.fromEntries(Object.entries(d).map(([a, v]) => [a, v * k]));
    const ctxAdvantaged = item => T().FLAME_ADVANTAGED_SETS.has(item.set) || /genesis|destiny/i.test(item.name);

    function choose(n, k) {
        if (k < 0 || k > n) return 0;
        let r = 1;
        for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
        return r;
    }

    /**
     * Distribution of flame outcomes as FD relative to the current flame.
     * Lines are distinct types drawn from the pool; only types that matter to
     * the class are enumerated, the rest are counted combinatorially.
     */
    function flameOutcomes(item, ctx) {
        const tables = T();
        const advantaged = ctxAdvantaged(item);
        const types = flameLineTypes(item, ctx.className);
        const N = item.slot === 'weapon' ? tables.FLAME_POOL_WEAPON : tables.FLAME_POOL_ARMOR;
        const tiers = advantaged ? tables.FLAME_TIERS_ADVANTAGED : tables.FLAME_TIERS_NORMAL;
        const lineCounts = advantaged ? [[4, 1]] : tables.FLAME_LINES_NORMAL;
        const R = types.length;

        // Each line type's delta per tier as a fixed-width vector, so the
        // enumeration adds numbers instead of building objects.
        const FIELDS = ['mainBase', 'subBase', 'att', 'mainPct', 'subPct', 'boss', 'dmg'];
        const vec = d => FIELDS.map(f => d[f] || 0);
        const perTier = types.map(t => tiers.map(([tier, pt]) => ({ v: vec(t.per(tier)), p: pt })));

        const dist = new Map();
        const acc = new Array(FIELDS.length).fill(0);
        const chosen = [];
        const leaf = p => {
            const key = acc.join(',');
            const prev = dist.get(key);
            if (prev) prev.p += p; else dist.set(key, { v: acc.slice(), p });
        };
        const walkTiers = (i, p) => {
            if (i === chosen.length) { leaf(p); return; }
            for (const { v, p: pt } of perTier[chosen[i]]) {
                for (let f = 0; f < v.length; f++) acc[f] += v[f];
                walkTiers(i + 1, p * pt);
                for (let f = 0; f < v.length; f++) acc[f] -= v[f];
            }
        };
        const subsets = start => {
            let pSet = 0;
            for (const [k, pk] of lineCounts) pSet += pk * choose(N - R, k - chosen.length) / choose(N, k);
            if (pSet) walkTiers(0, pSet);
            if (chosen.length >= 4) return;
            for (let i = start; i < R; i++) {
                chosen.push(i);
                subsets(i + 1);
                chosen.pop();
            }
        };
        subsets(0);

        const current = flameDelta(item.flames, ctx.className);
        const base = applyDelta(ctx.stats, negateDelta(current));
        const before = damageIndex(ctx.stats, ctx.pdr);
        const hpMain = classStats(ctx.className).main === 'hp';
        const out = [];
        for (const { v, p } of dist.values()) {
            const delta = {};
            FIELDS.forEach((f, k) => { if (v[k]) delta[f] = v[k]; });
            // The same score flameScore() gives a finished flame, from the vector.
            const [mainBase, subBase, att, mainPct, , boss, dmg] = v;
            const score = (hpMain ? mainBase / 17.5 : mainBase) + subBase / 12 + 3 * att
                + 10 * mainPct + 10 * (boss + dmg);
            out.push({ fd: (damageIndex(applyDelta(base, delta), ctx.pdr) / before - 1) * 100, p, lines: [], score });
        }
        return out.sort((a, b) => b.fd - a.fd);
    }

    function flameOptions(item, ctx) {
        const tables = T();
        if (item.locked || !tables.FLAMEABLE_SLOTS.has(item.slot)) return [];
        const price = ctx.settings.flameReset || 0;
        if (!price) return [];
        const now = flameScore(item.flames, ctx.className);
        const outcomes = flameOutcomes(item, ctx);
        const out = scoreThresholds(outcomes, { current: now }).map(th => ({
            type: 'flame', slot: item.slot,
            label: th.threshold <= now + 1 ? `Flame ${item.name} until it beats score ${now}`
                : `Flame ${item.name} to score ${th.threshold}+`,
            target: `score ${th.threshold}+`, now: `score ${now}`, threshold: th.threshold,
            detail: `~${Math.round(th.rolls)} meso resets, keeping the better roll · expect ~${Math.round(th.expect)}`,
            cost: th.rolls * price, fdGain: th.gain,
        }));
        return keepEfficientFrontier(out);
    }

    /** Total seconds of skill cooldown on a build's potential lines. */
    function gearCdr(items, className) {
        let total = 0;
        for (const item of Object.values(items || {})) {
            for (const line of item.potLines || []) {
                const l = parsePotentialLine(line, className);
                if (l.stat === 'cooldown') total += l.value;
            }
        }
        return total;
    }

    /**
     * The sheet every valuation starts from: the stat sheet, with the CDR the
     * gear actually carries (the stat window does not show it, and a curve
     * needs it) and the character's cooldown valuation.
     */
    function analysisStats(build, settings = {}) {
        const s = { ...DEFAULT_SETTINGS, ...settings };
        return normalizeStats({
            ...build.stats,
            cdr: gearCdr(build.items, build.className),
            cdrValue: +s.cdrValue,
            cdrCurve: s.cdrCurve || null,
        });
    }

    /**
     * What common lines are worth for this character, in the units the plan's
     * targets use, so a roll can be judged by eye.
     */
    function equivalenceLegend(build, settings = {}, { charLevel = 280 } = {}) {
        const s = { ...DEFAULT_SETTINGS, ...settings };
        const stats = analysisStats(build, s);
        const pdr = +s.pdr || DEFAULT_PDR;
        if (!damageIndex(stats, pdr)) return null;
        const cs = classStats(build.className);
        const cls = build.className;
        const main = STAT_NAMES[cs.main], sub = STAT_NAMES[cs.sub], atk = cs.magic ? 'MATT' : 'ATT';
        const fmt = v => (v >= 10 ? v.toFixed(0) : v.toFixed(1));
        const eqMain = lineEquivalent(stats, 'mainPct', cls, charLevel, pdr);
        const eqAtt = lineEquivalent(stats, 'attPct', cls, charLevel, pdr);
        const armor = [
            [`All Stat 10%`, eqMain({ stat: 'all%', value: 10 })],
            [`${sub} 10%`, eqMain({ stat: 'sub%', value: 10 })],
            ...(!s.cdrCurve && +s.cdrValue ? [['CDR 2s', eqMain({ stat: 'cooldown', value: 2 })]] : []),
            ['Crit Dmg 8%', eqMain({ stat: 'critDmg', value: 8 })],
        ];
        const wse = [
            ['Boss 40%', eqAtt({ stat: 'boss', value: 40 })],
            ...(+s.iedWeight > 0 ? [[`IED 40% (at ${Math.round(+s.iedWeight * 100)}% weight)`,
                eqAtt(weighIed({ stat: 'ied', value: 40 }, cls, Math.min(1, +s.iedWeight)))]] : []),
            ['Dmg 13%', eqAtt({ stat: 'dmg', value: 13 })],
            [`${main} 13%`, eqAtt({ stat: 'main%', value: 13 })],
        ];
        const curve = s.cdrCurve && s.cdrCurve.length
            ? ` · CDR by total seconds on gear: ${s.cdrCurve.slice(1).map((v, i) => `${i + 1}s ${fmt(+v)}%`).join(', ')}`
                + ` (now ${stats.cdr}s)` : '';
        return {
            armor: `${main}% targets: ` + armor.map(([n, v]) => `${n} ≈ ${fmt(v)}% ${main}`).join(' · ') + curve,
            wse: `${atk}% targets: ` + wse.map(([n, v]) => `${n} ≈ ${fmt(v)}% ${atk}`).join(' · ')
                + (+s.iedWeight > 0 ? '' : ' · IED lines count as junk'),
            flame: cs.main === 'hp'
                ? `Flame score: HP ÷ 17.5 + ${sub} ÷ 12 + 3 × ${atk} + 10 × (boss + damage) %`
                : `Flame score: ${main} + ${sub} ÷ 12 + 3 × ${atk} + 10 × all stat % + 10 × (boss + damage) %`,
        };
    }

    // ── Ranking ─────────────────────────────────────────────────────────────

    /**
     * Every upgrade option for a build, best meso-per-FD first. Options for
     * one item and type are alternatives (a cube target, a flame target) or a
     * chain (star force), which buildPlan resolves.
     */
    function recommend(build, settings = {}, { charLevel = 280 } = {}) {
        const s = { ...DEFAULT_SETTINGS, ...settings };
        const ctx = {
            stats: analysisStats(build, s), className: build.className,
            charLevel, settings: s, pdr: +s.pdr || DEFAULT_PDR,
            iedWeight: Math.max(0, Math.min(1, +s.iedWeight || 0)),
        };
        if (!damageIndex(ctx.stats, ctx.pdr)) return [];
        const out = [];
        for (const item of Object.values(build.items || {})) {
            out.push(...starForceOptions(item, ctx), ...cubeOptions(item, ctx), ...flameOptions(item, ctx));
        }
        out.forEach(o => { o.mesoPerFd = o.cost / o.fdGain; });
        return out.sort((a, b) => a.mesoPerFd - b.mesoPerFd);
    }

    /**
     * Greedy plan over recommend()'s options: repeatedly takes the most
     * efficient option still available. A star force step is available when it
     * starts from the item's current planned star; taking one advances that
     * item. A cube or flame target on an item that already has one is valued
     * by the gain beyond the target already taken (a re-roll from scratch).
     */
    function buildPlan(options, limit = 25) {
        const stars = {};
        const taken = {};   // slot|type -> gain already planned
        const plan = [];
        const pool = options.slice();
        while (plan.length < limit) {
            let best = null, bestEff = Infinity, bestGain = 0;
            for (const o of pool) {
                let gain = o.fdGain;
                if (o.type === 'starforce') {
                    if ((stars[o.slot] ?? o.start) !== o.from) continue;
                } else {
                    gain -= taken[`${o.slot}|${o.type}`] || 0;
                    if (gain <= 1e-6) continue;
                }
                const eff = o.cost / gain;
                if (eff < bestEff) { best = o; bestEff = eff; bestGain = gain; }
            }
            if (!best) break;
            pool.splice(pool.indexOf(best), 1);
            if (best.type === 'starforce') {
                stars[best.slot] = best.to;
            } else {
                taken[`${best.slot}|${best.type}`] = (taken[`${best.slot}|${best.type}`] || 0) + bestGain;
            }
            plan.push({ ...best, fdGain: bestGain, mesoPerFd: bestEff });
        }
        return plan;
    }

    // ── Gear editing ────────────────────────────────────────────────────────

    /**
     * Flame score in the GMS Upgrade Tracker's convention, which reproduces
     * every score in its exports: main + secondary/12 + 3 x ATT + 10 x all
     * stat % + 10 x (boss + damage) %. Demon Avenger scores HP / 17.5 as its
     * main stat and gets nothing from all stat %.
     */
    function flameScore(flames, className) {
        if (!flames) return 0;
        const cs = classStats(className);
        const f = k => +flames[k] || 0;
        const main = cs.main === 'hp' ? f('hp') / 17.5 : f(cs.main);
        const attack = cs.magic ? f('matt') : f('att');
        const allPct = cs.main === 'hp' ? 0 : f('allStatPercent');
        return Math.round(main + f(cs.sub) / 12 + 3 * attack + 10 * allPct
            + 10 * (f('bossDamagePercent') + f('damagePercent')));
    }

    /** Everything an item adds that the editor can change: stars, potential, flames. */
    function itemContribution(item, className, charLevel) {
        if (!item) return {};
        const stars = item.sfKind === 'ordinary' ? sfDelta(item, 0, item.stars || 0, className) : {};
        return sumDeltas(stars, linesDelta(item.potLines || [], className, charLevel),
            flameDelta(item.flames, className));
    }

    /**
     * Applies an item edit to a stat sheet: takes out what the old version of
     * the item added and puts in what the new one adds. Set effects and base
     * stats are not modelled, so swapping to a different item needs the stat
     * sheet re-read from the game; changing stars, lines or flames does not.
     */
    function restatItem(stats, before, after, className, charLevel) {
        return applyDelta(stats, sumDeltas(
            negateDelta(itemContribution(before, className, charLevel)),
            itemContribution(after, className, charLevel)));
    }

    // Potential line choices per slot, in the export's vocabulary.
    const MAIN_STATS = ['str%', 'dex%', 'int%', 'luk%', 'allstat%', 'hp%'];
    const SLOT_LINE_STATS = {
        weapon: ['att%', 'matt%', 'boss%', 'ied%', 'damage%', ...MAIN_STATS, 'att', 'matt'],
        secondary: ['att%', 'matt%', 'boss%', 'ied%', 'damage%', ...MAIN_STATS, 'att', 'matt'],
        emblem: ['att%', 'matt%', 'ied%', 'damage%', ...MAIN_STATS, 'att', 'matt'],
        hat: [...MAIN_STATS, 'cdr'],
        gloves: [...MAIN_STATS, 'crit_dmg%', 'str', 'dex', 'int', 'luk'],
    };
    const LINE_LABELS = {
        'str%': 'STR %', 'dex%': 'DEX %', 'int%': 'INT %', 'luk%': 'LUK %', 'allstat%': 'All Stat %',
        'hp%': 'Max HP %', 'att%': 'ATT %', 'matt%': 'MATT %', 'boss%': 'Boss %', 'ied%': 'IED %',
        'damage%': 'Damage %', 'crit_dmg%': 'Crit Damage %', cdr: 'Cooldown (s)', att: 'ATT',
        matt: 'MATT', str: 'STR', dex: 'DEX', int: 'INT', luk: 'LUK', other: 'Other / junk',
    };

    /**
     * Line stats worth offering on a slot. With a known class, stats the class
     * does not use are left out: no INT or LUK lines for a DEX class, no MATT
     * for a physical one, and Max HP only for Demon Avenger.
     */
    function lineStatsForSlot(slot, className) {
        const all = SLOT_LINE_STATS[slot] || MAIN_STATS;
        const cs = CLASS_STATS[className];
        if (!cs) return [...all, 'other'];
        const stats = new Set([cs.main, cs.sub, ...cs.also]);
        const keep = stat => {
            const base = stat.replace(/%$/, '');
            if (base === 'allstat') return true;
            if (base === 'att') return !cs.magic;
            if (base === 'matt') return cs.magic;
            if (['str', 'dex', 'int', 'luk', 'hp'].includes(base)) return stats.has(base);
            return true;
        };
        return [...all.filter(keep), 'other'];
    }

    /** Values a line can take on this slot and item level, best first. */
    function lineValuesFor(slot, itemLevel, stat) {
        const tables = root.UpgradeEngine.TABLES;
        const pool = tables && tables.cubePool(slot, itemLevel || 200);
        const values = new Set();
        if (pool) [...pool.prime, ...pool.nonPrime].forEach(l => { if (l.stat === stat) values.add(l.value); });
        // Lower tiers roll smaller values; offer the unique/epic steps too.
        if (/%$/.test(stat) && !/boss|ied|crit/.test(stat)) {
            const top = Math.max(0, ...values);
            if (top) [top - 3, top - 6].filter(v => v > 0).forEach(v => values.add(v));
        }
        return [...values].sort((a, b) => b - a);
    }

    // Common endgame gear. Replacement costs are the site's defaults and are
    // what a boom is charged at; everything is editable per item. `base` is
    // the item's own stats ([stat on each class stat, ATT/MATT, Max HP]), read
    // from Upgrade Tracker exports and maplestorywiki class pages; null where
    // unknown, which keeps the item out of swap suggestions. `via` is how the
    // item is obtained, for swaps.
    const G = (slot, name, level, set, replacementCost, base = null, extra = {}) =>
        ({ slot, name, level, set, replacementCost, sfKind: 'ordinary', base, ...extra });
    const VIA = {
        'Eternal': 'Eternal pieces (10 per item)', 'Arcane Umbra': 'Arcane Umbra coins or boxes',
        'AbsoLab': 'AbsoLab coins or boxes', 'CRA': 'Root Abyss drop or coins',
        'Pitched Boss': 'pitched boss drop', 'Dawn Boss': 'Dawn boss drop',
        'Superior Gollux': 'Gollux coins', 'Boss Accessory': 'boss drop',
    };
    const GEAR_CATALOG = [
        G('weapon', 'Genesis Weapon', 200, 'Eternal', 0, null, { sfKind: 'fixed', stars: 22, starCap: 22, lucky: true }),
        G('weapon', 'Destiny Weapon', 250, 'Eternal', 0, null, { sfKind: 'destiny', stars: 22, starCap: 22, lucky: true }),
        G('weapon', 'Arcane Umbra Weapon', 200, 'Arcane Umbra', 1e9),
        G('weapon', 'AbsoLab Weapon', 160, 'AbsoLab', 3e8),
        G('secondary', 'Secondary', 140, 'None', 5e8),
        G('emblem', "Mitra's Rage", 200, 'Pitched Boss', 0, [0, 0, 0]),
        G('emblem', 'Gold Maple Leaf Emblem', 100, 'None', 0),
        G('hat', 'Eternal Hat', 250, 'Eternal', 2e9, [80, 0, 0]),
        G('top', 'Eternal Top', 250, 'Eternal', 2e9, [100, 5, 0]),
        G('bottom', 'Eternal Bottom', 250, 'Eternal', 2e9, [100, 5, 0]),
        G('shoes', 'Eternal Shoes', 250, 'Eternal', 2e9, [65, 5, 0]),
        G('gloves', 'Eternal Gloves', 250, 'Eternal', 2e9, [55, 12, 0]),
        G('cape', 'Eternal Cape', 250, 'Eternal', 2e9, [50, 8, 0]),
        G('shoulder', 'Eternal Shoulder', 250, 'Eternal', 2e9, [50, 14, 0]),
        G('hat', 'Arcane Umbra Hat', 200, 'Arcane Umbra', 1e8, [65, 7, 0]),
        G('top', 'Arcane Umbra Suit (overall)', 200, 'Arcane Umbra', 1e8, [85, 9, 0]),
        G('shoes', 'Arcane Umbra Shoes', 200, 'Arcane Umbra', 1e8, [40, 9, 0]),
        G('gloves', 'Arcane Umbra Gloves', 200, 'Arcane Umbra', 1e8, [40, 9, 0]),
        G('cape', 'Arcane Umbra Cape', 200, 'Arcane Umbra', 1e8, [35, 6, 0]),
        G('shoulder', 'Arcane Umbra Shoulder', 200, 'Arcane Umbra', 1e8, [35, 20, 0]),
        G('hat', 'AbsoLab Hat', 160, 'AbsoLab', 3e7, [45, 3, 0]),
        G('top', 'AbsoLab Overall', 160, 'AbsoLab', 3e7, [65, 5, 0]),
        G('shoes', 'AbsoLab Shoes', 160, 'AbsoLab', 3e7, [20, 5, 0]),
        G('gloves', 'AbsoLab Gloves', 160, 'AbsoLab', 3e7, [20, 5, 0]),
        G('cape', 'AbsoLab Cape', 160, 'AbsoLab', 3e7, [15, 2, 0]),
        G('shoulder', 'AbsoLab Shoulder', 160, 'AbsoLab', 3e7, [14, 10, 0]),
        G('hat', 'CRA Hat', 150, 'CRA', 5e6, [40, 2, 0]),
        G('top', 'CRA Top', 150, 'CRA', 5e6, [30, 2, 0]),
        G('bottom', 'CRA Bottom', 150, 'CRA', 5e6, [30, 2, 0]),
        G('belt', 'Dreamy Belt', 200, 'Pitched Boss', 8e9, [50, 7, 500]),
        G('belt', 'Superior Engraved Gollux Belt', 150, 'Superior Gollux', 5e8, [25, 10, 300]),
        G('face', 'Berserked', 160, 'Pitched Boss', 8e9, [40, 10, 800]),
        G('face', 'Twilight Mark', 140, 'Dawn Boss', 5e9),
        G('eye', 'Magic Eyepatch', 160, 'Pitched Boss', 8e9, [30, 7, 500]),
        G('eye', 'Papulatus Mark', 145, 'Boss Accessory', 5e8, [8, 1, 0]),
        G('earring', 'Commanding Force Earring', 200, 'Pitched Boss', 8e9, [15, 5, 500]),
        G('earring', 'Estella Earrings', 160, 'Dawn Boss', 5e9),
        G('earring', 'Superior Gollux Earring', 150, 'Superior Gollux', 5e8, [15, 10, 300]),
        ...['pendant1', 'pendant2'].flatMap(s => [
            G(s, 'Source of Suffering', 160, 'Pitched Boss', 8e9, [10, 5, 500]),
            G(s, 'Daybreak Pendant', 140, 'Dawn Boss', 5e9, [8, 2, 0]),
            G(s, 'Superior Gollux Pendant', 150, 'Superior Gollux', 5e8, [28, 5, 300]),
            G(s, 'Dominator Pendant', 140, 'Boss Accessory', 5e8),
        ]),
        ...['ring1', 'ring2', 'ring3', 'ring4'].flatMap(s => [
            G(s, 'Endless Terror', 200, 'Pitched Boss', 8e9, [5, 4, 250]),
            G(s, 'Dawn Guardian Angel Ring', 160, 'Dawn Boss', 5e9, [5, 2, 200]),
            G(s, 'Superior Gollux Ring', 150, 'Superior Gollux', 5e8, [10, 0, 300]),
            G(s, 'Guardian Angel Ring', 160, 'None', 5e8),
            G(s, 'Meister Ring', 140, 'None', 5e8),
            G(s, "Kanna's Treasure", 140, 'Boss Accessory', 5e8),
            G(s, 'Oz Ring', 150, 'None', 0, [0, 0, 0], { sfKind: 'special', locked: true }),
        ]),
        G('pocket', 'Cursed Spellbook', 160, 'Pitched Boss', 8e9, [20, 10, 100]),
        G('pocket', 'Pink Holy Cup', 140, 'Boss Accessory', 0),
        G('heart', 'Black Heart', 120, 'Pitched Boss', 0, [10, 77, 0], { sfKind: 'special', stars: 15, starCap: 15 }),
        G('heart', 'Plasma Heart', 130, 'None', 3e9, [10, 5, 0]),
        G('badge', 'Crystal Ventus Badge', 130, 'None', 0, [10, 5, 0]),
        G('medal', 'Medal', 1, 'None', 0),
    ];
    const STANDARD_SLOTS = ['weapon', 'secondary', 'emblem', 'hat', 'top', 'bottom', 'shoes', 'gloves',
        'cape', 'shoulder', 'ring1', 'ring2', 'ring3', 'ring4', 'pendant1', 'pendant2', 'earring',
        'face', 'eye', 'belt', 'badge', 'heart', 'medal', 'pocket'];

    /** A fresh inventory item from a catalog entry (or a bare slot). */
    function newItem(slot, entry = null) {
        const e = entry || { slot, name: '', level: 200, set: 'None', replacementCost: 0, sfKind: 'ordinary' };
        const [stat, att, hp] = e.base || [0, 0, 0];
        const item = normalizeItem(slot, {
            name: e.name, itemLevel: e.level, equipmentSet: e.set, replacementCost: e.replacementCost,
            starforceItemKind: e.sfKind, currentStars: e.stars || 0, starforceCap: e.starCap || 0,
            category: slot === 'weapon' || slot === 'secondary' || slot === 'emblem' ? 'weapon' : 'armor',
            isWSE: ['weapon', 'secondary', 'emblem'].includes(slot),
            potentialTier: /badge|medal/.test(slot) || e.sfKind === 'special' ? 'none' : 'legendary',
            potentialLines: [], potentialPhysicalLineCount: 3, locked: !!e.locked,
            flames: {}, baseStats: { str: stat, dex: stat, int: stat, luk: stat, att, matt: att, hp },
        });
        item.baseKnown = !!e.base;
        return item;
    }

    // ── Sets and item swaps ─────────────────────────────────────────────────

    const isLucky = item => !!item && (/genesis|destiny/i.test(item.name || '') || item.lucky);

    // Sets that include a weapon. A lucky weapon only stands in for sets like
    // these: accessory sets (pitched, Gollux, Dawn, Brilliant, boss accessory)
    // have no weapon piece, so it does nothing for them (user, 2026-10-05).
    const SETS_WITH_WEAPON = new Set(['Eternal', 'Arcane Umbra', 'AbsoLab', 'CRA']);

    /**
     * Pieces worn per set. A Genesis or Destiny weapon is a piece of its own
     * set (Eternal) and also counts once toward every other set that has a
     * weapon piece, where at least 3 real pieces are worn (the lucky item rule).
     */
    function setCounts(items) {
        const counts = {};
        let lucky = null;
        for (const item of Object.values(items || {})) {
            if (!item || !item.set || item.set === 'None') continue;
            counts[item.set] = (counts[item.set] || 0) + 1;
            if (isLucky(item)) lucky = item.set;
        }
        const out = { ...counts };
        if (lucky) {
            for (const [set, n] of Object.entries(counts)) {
                if (set !== lucky && n >= 3 && SETS_WITH_WEAPON.has(set)) out[set] = n + 1;
            }
        }
        return out;
    }

    /** Stat delta from every active set threshold. */
    function setDelta(items, className) {
        const cs = classStats(className);
        const table = root.UpgradeEngine.TABLES.SET_EFFECTS;
        const d = {};
        const add = (k, v) => { if (v) d[k] = (d[k] || 0) + v; };
        for (const [set, n] of Object.entries(setCounts(items))) {
            for (const [pieces, fx] of Object.entries(table[set] || {})) {
                if (n < +pieces) continue;
                // All stat never includes HP, so a Demon Avenger only gets the STR.
                add('mainBase', cs.main === 'hp' ? 0 : (fx.all || 0) + (fx.mainSub || 0));
                add('subBase', (fx.all || 0) + (fx.mainSub || 0));
                if (cs.main === 'hp') add('mainBase', fx.hp || 0);
                add('att', fx.att);
                add('boss', fx.boss);
                add('critDmg', fx.critDmg);
                if (fx.ied) d.ied = [...(d.ied || []), fx.ied];
            }
        }
        return d;
    }

    /** Stat delta from an item's own base stats. */
    function baseDelta(item, className) {
        const b = item && item.baseStats;
        if (!b) return {};
        const cs = classStats(className);
        return { mainBase: +b[cs.main] || 0, subBase: +b[cs.sub] || 0, att: +(cs.magic ? b.matt : b.att) || 0 };
    }

    /** Whether an item's base stats are known well enough to price a swap. */
    function baseKnown(item) {
        if (!item) return true;                       // an empty slot adds nothing
        if (item.baseKnown !== undefined) return item.baseKnown;
        return !!item.baseStats;                      // imported items carry theirs
    }

    /** Everything an item adds on its own: base, star force, potential, flames. */
    function itemFull(item, className, charLevel) {
        if (!item) return {};
        return sumDeltas(baseDelta(item, className), itemContribution(item, className, charLevel));
    }

    /**
     * The stat change from putting `next` in `slot` (null empties it): the old
     * item's own stats out, the new one's in, and the difference in set
     * bonuses across the whole build. Null when either item's base is unknown.
     */
    function swapDelta(items, slot, next, className, charLevel) {
        return swapDeltaMany(items, { [slot]: next }, className, charLevel);
    }

    /** swapDelta for several slots at once: { slot: newItem or null }. */
    function swapDeltaMany(items, changes, className, charLevel) {
        const after = { ...(items || {}) };
        const parts = [];
        for (const [slot, next] of Object.entries(changes)) {
            const prev = (items || {})[slot] || null;
            if (!baseKnown(prev) || !baseKnown(next)) return null;
            parts.push(negateDelta(itemFull(prev, className, charLevel)), itemFull(next, className, charLevel));
            if (next) after[slot] = next; else delete after[slot];
        }
        return sumDeltas(...parts, negateDelta(setDelta(items, className)), setDelta(after, className));
    }

    /** "Eternal 3→4 · CRA 4→2" for the sets a swap changes. */
    function describeSetChange(items, slot, next) {
        const changes = typeof slot === 'object' ? slot : { [slot]: next };
        const before = setCounts(items);
        const after = setCounts({ ...items, ...changes });
        const sets = new Set([...Object.keys(before), ...Object.keys(after)]);
        return [...sets].filter(s => (before[s] || 0) !== (after[s] || 0))
            .map(s => `${s} ${before[s] || 0}→${after[s] || 0}`).join(' · ');
    }

    /**
     * Item swaps worth making, best final damage first. The new item is
     * starred to the target (the plan's star force target, or its own fixed
     * stars) and keeps the old item's potential and flames, so the comparison
     * is the item itself and its set bonuses. Cost is the mesos to star it.
     */
    function swapOptions(build, settings = {}, { charLevel = 280 } = {}) {
        const s = { ...DEFAULT_SETTINGS, ...settings };
        const tables = root.UpgradeEngine.TABLES;
        const stats = analysisStats(build, s);
        const pdr = +s.pdr || DEFAULT_PDR;
        if (!damageIndex(stats, pdr)) return [];
        const items = build.items || {};
        const worn = new Set(Object.values(items).map(i => i && i.name));
        // The replacement as it would be worn: starred to the target, carrying
        // the old item's potential and flames.
        const replacement = (slot, current, entry) => {
            const next = newItem(slot, entry);
            if (next.sfKind === 'ordinary') next.stars = Math.min(tables.sfMaxStars(next.level), s.sfMaxStar || 22);
            next.potTier = current.potTier;
            next.potLines = (current.potLines || []).map(l => ({ ...l }));
            next.lineCount = current.lineCount || 3;
            next.flames = tables.FLAMEABLE_SLOTS.has(slot) ? { ...(current.flames || {}) } : {};
            return next;
        };
        const starCost = next => (next.sfKind === 'ordinary' && next.stars
            ? sfSteps({ ...next, stars: 0 }, next.stars, s)(0, next.stars).cost : 0);
        const swappable = (slot, current) => current && !current.locked && slot !== 'weapon' && baseKnown(current);
        const out = [];

        /**
         * The lowest star force at which the new items stop being a loss
         * (every changed piece at the same star), and the mesos to get there.
         * Gain rises with stars, so the first star that breaks even is the
         * answer. Items that cannot be starred break even at their own stars
         * or not at all.
         */
        const breakEven = changes => {
            const pieces = Object.values(changes);
            const starrable = pieces.filter(n => n.sfKind === 'ordinary');
            if (!starrable.length) return null;
            const top = Math.max(...starrable.map(n => n.stars));
            for (let star = 0; star <= top; star++) {
                const at = {};
                for (const [sl, n] of Object.entries(changes)) {
                    at[sl] = n.sfKind === 'ordinary' ? { ...n, stars: Math.min(star, n.stars) } : n;
                }
                const delta = swapDeltaMany(items, at, build.className, charLevel);
                if (delta && fdGain(stats, delta, pdr) >= 0) {
                    return { stars: star, cost: Object.values(at).reduce((a, n) => a + starCost(n), 0) };
                }
            }
            return null;
        };

        for (const [slot, current] of Object.entries(items)) {
            if (!swappable(slot, current)) continue;
            for (const entry of GEAR_CATALOG) {
                if (entry.slot !== slot || !entry.base || entry.name === current.name || worn.has(entry.name)) continue;
                if (entry.sfKind === 'special' || /badge|medal/.test(slot)) continue;
                const next = replacement(slot, current, entry);
                const delta = swapDelta(items, slot, next, build.className, charLevel);
                if (!delta) continue;
                const gain = fdGain(stats, delta, pdr);
                if (gain <= 0.005) continue;
                out.push({
                    type: 'swap', slots: [slot], from: current.name, to: entry.name, stars: next.stars,
                    fdGain: gain, cost: starCost(next), via: VIA[entry.set] || 'drop',
                    sets: describeSetChange(items, slot, next), breakEven: breakEven({ [slot]: next }),
                });
            }
        }

        // Whole-set swaps: every armor piece of one set into another at once.
        // A set bonus often makes the first piece a loss and the full move a
        // gain (three CRA pieces held at 4 by a lucky weapon, say).
        const ARMOR = ['hat', 'top', 'bottom', 'shoes', 'gloves', 'cape', 'shoulder'];
        const fromSets = new Set(ARMOR.map(sl => items[sl] && items[sl].set).filter(x => x && x !== 'None'));
        for (const fromSet of fromSets) {
            const slots = ARMOR.filter(sl => items[sl] && items[sl].set === fromSet && swappable(sl, items[sl]));
            if (slots.length < 2) continue;
            for (const toSet of ['Eternal', 'Arcane Umbra', 'AbsoLab']) {
                if (toSet === fromSet) continue;
                const changes = {};
                for (const sl of slots) {
                    const entry = GEAR_CATALOG.find(g => g.slot === sl && g.set === toSet && g.base);
                    if (entry) changes[sl] = replacement(sl, items[sl], entry);
                }
                const moved = Object.keys(changes);
                if (moved.length < 2) continue;
                const delta = swapDeltaMany(items, changes, build.className, charLevel);
                if (!delta) continue;
                const gain = fdGain(stats, delta, pdr);
                if (gain <= 0.005) continue;
                out.push({
                    type: 'swap', slots: moved, from: `${fromSet} ${moved.join(', ')}`,
                    to: `${toSet} ${moved.join(', ')}`, stars: Object.values(changes)[0].stars,
                    fdGain: gain, cost: Object.values(changes).reduce((a, n) => a + starCost(n), 0),
                    via: VIA[toSet] || 'drop', sets: describeSetChange(items, changes), whole: true,
                    breakEven: breakEven(changes),
                });
            }
        }
        return out.sort((a, b) => b.fdGain - a.fdGain);
    }

    // ── Importing builds ────────────────────────────────────────────────────

    // MapleScouter stores the class in Korean.
    const KOREAN_CLASS = {
        '보우마스터': 'Bowmaster', '신궁': 'Marksman', '패스파인더': 'Pathfinder',
        '윈드브레이커': 'Wind Archer', '와일드헌터': 'Wild Hunter', '메르세데스': 'Mercedes',
        '카인': 'Kain', '캡틴': 'Corsair', '메카닉': 'Mechanic', '엔젤릭버스터': 'Angelic Buster',
        '히어로': 'Hero', '팔라딘': 'Paladin', '다크나이트': 'Dark Knight', '소울마스터': 'Dawn Warrior',
        '미하일': 'Mihile', '아란': 'Aran', '카이저': 'Kaiser', '아델': 'Adele', '제로': 'Zero',
        '데몬어벤져': 'Demon Avenger', '데몬슬레이어': 'Demon Slayer', '제논': 'Xenon',
        '나이트로드': 'Night Lord', '섀도어': 'Shadower', '듀얼블레이드': 'Dual Blade',
        '나이트워커': 'Night Walker', '팬텀': 'Phantom', '카데나': 'Cadena', '호영': 'Hoyoung',
        '칼리': 'Khali', '바이퍼': 'Buccaneer', '캐논슈터': 'Cannoneer', '은월': 'Shade',
        '스트라이커': 'Thunder Breaker', '아크': 'Ark', '블래스터': 'Blaster',
        '아크메이지(불,독)': 'Fire/Poison', '아크메이지(썬,콜)': 'Ice/Lightning', '비숍': 'Bishop',
        '루미너스': 'Luminous', '에반': 'Evan', '배틀메이지': 'Battle Mage', '플레임위자드': 'Blaze Wizard',
        '키네시스': 'Kinesis', '일리움': 'Illium', '라라': 'Lara', '칸나': 'Kanna', '하야토': 'Hayato',
    };

    /** Finds the first nested object satisfying pred (depth-first). */
    function findNested(obj, pred, depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 6) return null;
        if (pred(obj)) return obj;
        for (const v of Object.values(obj)) {
            const hit = findNested(v, pred, depth + 1);
            if (hit) return hit;
        }
        return null;
    }

    /** Normalises one item from an Upgrade Tracker build into the tracker's shape. */
    function normalizeItem(slot, it) {
        const num = v => (Number.isFinite(+v) ? +v : 0);
        return {
            slot,
            name: it.name || slot,
            set: it.equipmentSet || 'None',
            level: num(it.itemLevel),
            category: it.category || 'armor',
            isWSE: !!it.isWSE,
            stars: num(it.currentStars),
            starCap: num(it.starforceCap) || null,
            sfKind: it.starforceItemKind || 'ordinary',
            flames: it.flames || null,
            flameScore: num(it.flameScore),
            potTier: it.potentialTier || 'none',
            potLines: Array.isArray(it.potentialLines) ? it.potentialLines.map(l => ({ ...l })) : [],
            lineCount: num(it.potentialPhysicalLineCount)
                || (Array.isArray(it.potentialLines) && it.potentialLines.length) || 3,
            baseStats: it.baseStats || null,
            replacementCost: num(it.replacementCost),
            spares: num(it.sparesOwned),
            locked: !!(it.locked || it.skipRecommendations),
        };
    }

    /**
     * Turns an imported JSON file into { source, ign, className, level, stats,
     * items }. Understands a GMS Upgrade Tracker build (anything holding a
     * `gear` map and `characterStats`) and a MapleScouter manual preset, which
     * only carries a stat sheet. Returns null when neither is recognised.
     */
    function importBuild(json) {
        if (!json || typeof json !== 'object') return null;

        if (json.type === 'maplescouter-manual-preset' && json.data && json.data.stat) {
            const s = json.data.stat;
            return {
                source: 'maplescouter',
                ign: null,
                className: KOREAN_CLASS[s.myClass] || s.myClass || null,
                level: +s.level || null,
                stats: normalizeStats({
                    mainBase: s.mainStatBase, mainPct: s.mainStatPer, mainFlat: s.mainStatAbs,
                    subBase: s.subStatBase, subPct: s.subStatPer, subFlat: s.subStatAbs,
                    att: s.atkBase, attPct: s.atkPercent, dmg: s.dmg, boss: s.bossDmg,
                    critDmg: s.criticalDmg, ied: s.ignoreDef,
                }),
                items: null,
            };
        }

        const build = findNested(json, o => o.gear && typeof o.gear === 'object' && !Array.isArray(o.gear)
            && (o.characterStats || o.selectedClass));
        if (!build) return null;
        const cs = build.characterStats || {};
        const ied = +cs.ied || 0;
        const items = {};
        for (const [slot, it] of Object.entries(build.gear)) {
            if (it && typeof it === 'object' && (it.name || it.itemLevel)) items[slot] = normalizeItem(slot, it);
        }
        return {
            source: 'gms-upgrade-tracker',
            ign: build.name || build.id || build.ign || null,
            className: build.selectedClass || null,
            level: +build.characterLevel || +build.level || null,
            sacredPower: +build.sacredPower || null,
            stats: normalizeStats({
                mainBase: cs.primaryStat, mainPct: cs.totalPercentStat, mainFlat: cs.additionalPrimaryStat,
                subBase: cs.secondaryStat, subPct: cs.totalPercentSecondaryStat, subFlat: cs.additionalSecondaryStat,
                att: cs.totalATT, attPct: cs.totalPercentATT, dmg: cs.damagePercent, boss: cs.bossDamagePercent,
                critDmg: cs.critDamagePercent, ied: ied <= 1 ? ied * 100 : ied, fd: cs.finalDamagePercent,
                model: cs.statModel,
            }),
            items,
        };
    }

    root.UpgradeEngine = Object.assign(root.UpgradeEngine || {}, {
        DEFAULT_PDR, DEFAULT_SETTINGS, parseMeso,
        normalizeStats, damageIndex, applyDelta, fdGain, sumDeltas, negateDelta,
        CLASS_STATS, classStats, parsePotentialLine, linesDelta, flameDelta,
        KOREAN_CLASS, importBuild, normalizeItem, solveLinear, climbExpectation,
        collapsePool, cubeOutcomes, cubeThresholds,
        sfStep, sfSteps, sfDelta, flameOutcomes, recommend, buildPlan,
        flameScore, itemContribution, restatItem, lineStatsForSlot, lineValuesFor, LINE_LABELS,
        describeClass, STAT_NAMES, describeLines, weighIed, lineSetScorer, CDR_CURVES, cdrCurveAt, gearCdr, analysisStats, targetUnit, lineEquivalent, scoreThresholds, equivalenceLegend,
        GEAR_CATALOG, STANDARD_SLOTS, newItem,
        setCounts, setDelta, baseDelta, baseKnown, itemFull, swapDelta, swapDeltaMany, describeSetChange, swapOptions,
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);
