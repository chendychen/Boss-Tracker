/**
 * Reads the stat sheet off a MapleScouter "Enter Directly" screenshot for the
 * Upgrades tab. Text recognition runs in the browser with Tesseract.js,
 * loaded from jsdelivr on first use; the image itself is never uploaded.
 *
 * Exposes window.ScouterScreenshot. The parsing half is plain functions so
 * tests can run it against recognised text in Node.
 */
(function (root) {
    'use strict';

    const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    // Small text in the screenshot loses decimal points below about 4x.
    const OCR_SCALE = 4;

    /** "1,234.5" -> 1234.5; null for anything that is not a number. */
    function num(s) {
        if (s === undefined || s === null) return null;
        const v = parseFloat(String(s).replace(/,/g, ''));
        return Number.isFinite(v) ? v : null;
    }

    const letters = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

    // MapleScouter's English class names where they differ from ours.
    const CLASS_ALIASES = {
        archmageicelightning: 'Ice/Lightning', archmageil: 'Ice/Lightning',
        archmagefirepoison: 'Fire/Poison', archmagefp: 'Fire/Poison',
        bowmaster: 'Bowmaster', windbreaker: 'Wind Archer', soulmaster: 'Dawn Warrior',
        striker: 'Thunder Breaker', captain: 'Corsair', viper: 'Buccaneer', cannonshooter: 'Cannoneer',
        flamewizard: 'Blaze Wizard', demonavengers: 'Demon Avenger',
    };

    /**
     * Our class name for MapleScouter's, or null when it is not recognised.
     * Matches the longest class name the text starts with, since the
     * dropdown's arrow often reads as a trailing "v".
     */
    function matchClass(raw) {
        const key = letters(raw);
        if (!key) return null;
        const engine = root.UpgradeEngine;
        const known = [
            ...Object.entries(CLASS_ALIASES),
            ...(engine ? Object.keys(engine.CLASS_STATS) : []).map(n => [letters(n), n]),
        ];
        const hits = known.filter(([k]) => k.length > 2 && key.startsWith(k));
        return hits.length ? hits.sort((a, b) => b[0].length - a[0].length)[0][1] : null;
    }

    // Row labels in the Base Value / % Value / % Value Not Applied table.
    const ROW_KEYS = { dex: 'dex', str: 'str', int: 'int', luk: 'luk', hp: 'hp', maxhp: 'hp',
        attack: 'att', mattack: 'matt', magicattack: 'matt' };

    /**
     * Pulls MapleScouter's fields out of recognised text. Each field is null
     * when its label was not found, so the review can point at what to type.
     */
    function parseScouterText(text) {
        const t = String(text || '').replace(/[|]/g, ' ');
        const grab = re => { const m = t.match(re); return m ? num(m[1]) : null; };

        const rows = {};
        const rowRe = /^\s*(DEX|STR|INT|LUK|Max\s*HP|HP|M\.?\s?Attack|Magic\s+Attack|Attack)\s+(\d[\d,]*)\s+(\d[\d,.]*)\s+(\d[\d,]*)(?!\S*\d)/gim;
        for (const m of t.matchAll(rowRe)) {
            const key = ROW_KEYS[letters(m[1])];
            if (key && !rows[key]) rows[key] = { base: num(m[2]), pct: num(m[3]), flat: num(m[4]) };
        }

        const classLine = t.match(/Class\s+([^\n]+)/);
        let ied = grab(/Ignore\s+Enemy\s+Def\S*\s+(\d[\d.,]*)/i);
        // A dropped decimal point turns 98.94 into 9894.
        if (ied !== null && ied > 100 && ied < 10000) ied /= 100;

        return {
            level: grab(/Level\s+(\d{2,3})\b/),
            classRaw: classLine ? classLine[1].trim() : null,
            className: classLine ? matchClass(classLine[1]) : null,
            rows,
            damage: grab(/(?:^|\d\s+)Damage\s+(\d[\d.,]*)/m),
            boss: grab(/Boss\s+Damage\s+(\d[\d.,]*)/i),
            finalDamage: grab(/Final\s+Damage\s+(\d[\d.,]*)/i),
            critDmg: grab(/Critical\s+Damage\s+(\d[\d.,]*)/i),
            ied,
            statusDmg: grab(/Additional\s+Status\s*D\S*\s+(\d[\d.,]*)/i),
            ier: grab(/Ignore\s+Elemental\s*Re\S*\s+(\d[\d.,]*)/i),
            arcaneForce: grab(/Arcane\s+Force\s+(\d[\d,]*)/i),
            sacredForce: grab(/Sacred\s+Force\s+(\d[\d,]*)/i),
        };
    }

    /**
     * The Upgrades tab's stat sheet fields from parsed text, for a class (the
     * character's, else the screenshot's). Abnormal status damage joins the
     * damage % pool since bosses nearly always carry a debuff; ignore
     * elemental resistance and final damage are left out because no gear line
     * changes them, so they cannot change which upgrade is worth more.
     * Returns { stats, missing }: stats holds only what was read.
     */
    function statsFromScouter(parsed, className) {
        const engine = root.UpgradeEngine;
        const cls = className || parsed.className;
        const cs = engine && cls ? engine.classStats(cls) : null;
        const statRows = ['dex', 'str', 'int', 'luk', 'hp'].filter(k => parsed.rows[k]);
        const mainKey = cs && parsed.rows[cs.main] ? cs.main : statRows[0];
        const subKey = cs && parsed.rows[cs.sub] ? cs.sub : statRows.find(k => k !== mainKey);
        const main = parsed.rows[mainKey];
        const sub = parsed.rows[subKey];
        const atk = (cs && cs.magic ? parsed.rows.matt || parsed.rows.att : parsed.rows.att || parsed.rows.matt);

        const stats = {};
        const put = (k, v) => { if (v !== null && v !== undefined) stats[k] = v; };
        if (main) { put('mainBase', main.base); put('mainPct', main.pct); put('mainFlat', main.flat); }
        if (sub) { put('subBase', sub.base); put('subPct', sub.pct); put('subFlat', sub.flat); }
        if (atk) { put('att', atk.base); put('attPct', atk.pct); }
        if (parsed.damage !== null) put('dmg', parsed.damage + (parsed.statusDmg || 0));
        put('boss', parsed.boss);
        put('critDmg', parsed.critDmg);
        put('ied', parsed.ied);

        const fields = ['mainBase', 'mainPct', 'mainFlat', 'subBase', 'subPct', 'subFlat',
            'att', 'attPct', 'dmg', 'boss', 'critDmg', 'ied'];
        return { stats, missing: fields.filter(k => !(k in stats)) };
    }

    // ── Browser: load Tesseract, find the stats panel, recognise ─────────────

    let tesseractLoading = null;
    function loadTesseract() {
        if (root.Tesseract) return Promise.resolve(root.Tesseract);
        if (!tesseractLoading) {
            tesseractLoading = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = TESSERACT_URL;
                s.onload = () => resolve(root.Tesseract);
                s.onerror = () => { tesseractLoading = null; reject(new Error('Could not load the text reader (Tesseract.js) from jsdelivr.')); };
                document.head.appendChild(s);
            });
        }
        return tesseractLoading;
    }

    /**
     * The x of the divider between MapleScouter's stat panel and its buffs
     * panel: a column, a bit lighter than what is left of it, that runs the
     * full height. The buff icons confuse line finding, so only the left
     * panel is read. Null when there is no such column (a cropped shot).
     */
    function findDivider(pixels, width, height) {
        const lum = (x, y) => {
            const i = (y * width + x) * 4;
            return 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        };
        const median = vals => vals.sort((a, b) => a - b)[vals.length >> 1];
        const step = Math.max(1, Math.floor(height / 300));
        for (let x = Math.round(width * 0.3); x < width * 0.85; x++) {
            const col = [], left = [];
            for (let y = 0; y < height; y += step) { col.push(lum(x, y)); left.push(lum(Math.max(0, x - 3), y)); }
            const m = median(col.slice());
            const steady = col.filter(v => Math.abs(v - m) < 6).length / col.length;
            if (steady > 0.9 && m - median(left) > 8) return x;
        }
        return null;
    }

    function loadImage(blob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image the browser can open.')); };
            img.src = url;
        });
    }

    /** The stats panel enlarged and inverted to dark text on light, as Tesseract prefers. */
    function prepare(img) {
        const probe = document.createElement('canvas');
        probe.width = img.width; probe.height = img.height;
        const pg = probe.getContext('2d');
        pg.drawImage(img, 0, 0);
        const divider = findDivider(pg.getImageData(0, 0, img.width, img.height).data, img.width, img.height);
        const w = divider ? divider - 2 : img.width;
        const scale = Math.min(OCR_SCALE, Math.max(1, Math.floor(4000 / Math.max(w, img.height))));
        const c = document.createElement('canvas');
        c.width = w * scale; c.height = img.height * scale;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0, w, img.height, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < d.data.length; i += 4) {
            const v = 255 - (0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]);
            d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        }
        g.putImageData(d, 0, 0);
        return c;
    }

    /** Recognises a screenshot; resolves to { text, parsed }. */
    async function readScouterScreenshot(blob, onProgress = () => {}) {
        onProgress('Loading the text reader');
        const Tesseract = await loadTesseract();
        const canvas = prepare(await loadImage(blob));
        const worker = await Tesseract.createWorker('eng', 1, {
            logger: m => { if (m.status === 'recognizing text') onProgress(`Reading ${Math.round(m.progress * 100)}%`); },
        });
        try {
            const { data } = await worker.recognize(canvas);
            return { text: data.text, parsed: parseScouterText(data.text) };
        } finally {
            await worker.terminate();
        }
    }

    root.ScouterScreenshot = { parseScouterText, statsFromScouter, matchClass, findDivider, readScouterScreenshot };
})(typeof globalThis !== 'undefined' ? globalThis : this);
