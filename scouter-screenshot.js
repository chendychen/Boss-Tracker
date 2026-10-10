/**
 * Reads MapleScouter screenshots: the "Enter Directly" page gives the
 * Upgrades tab's stat sheet, the results page gives hexa converted (for
 * Progression) and the Stat Efficiency panel (for skill IED). Text
 * recognition runs in the browser with Tesseract.js, loaded from jsdelivr on
 * first use; the image itself is never uploaded.
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
     * character's, else the screenshot's). Ignore elemental resistance and
     * final damage are left out because no gear line changes them, so they
     * cannot change which upgrade is worth more.
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
        put('dmg', parsed.damage);
        put('boss', parsed.boss);
        put('statusDmg', parsed.statusDmg);
        put('critDmg', parsed.critDmg);
        put('ied', parsed.ied);

        const fields = ['mainBase', 'mainPct', 'mainFlat', 'subBase', 'subPct', 'subFlat',
            'att', 'attPct', 'dmg', 'boss', 'statusDmg', 'critDmg', 'ied'];
        return { stats, missing: fields.filter(k => !(k in stats)) };
    }

    // ── Results page ────────────────────────────────────────────────────────

    /** Whether recognised text is MapleScouter's results page rather than Enter Directly. */
    function isResultsPage(text) {
        return /Stat\s+Efficiency|Boss\s+380|Scouter\s+Graph/i.test(text) && !/Base\s+Value/i.test(text);
    }

    /**
     * Hexa converted: the HEXA figure under Boss 380. The HEXA row reads
     * "HEXA 108,137 HEXA 108,598", Boss 300 first, so the last one is taken.
     */
    function parseResultsText(text) {
        let hexa = null;
        for (const line of String(text || '').split('\n')) {
            if (!/^\s*HEXA\b/i.test(line)) continue;
            const nums = [...line.matchAll(/HEXA\s+(\d[\d,]{3,})/gi)].map(m => num(m[1]));
            if (nums.length) hexa = nums[nums.length - 1];
        }
        return { hexaConverted: hexa };
    }

    /**
     * A Stat Efficiency value as read off its slider bubble. The decimal point
     * is a dot or two pixels and often drops out; these values carry one
     * decimal place, so a bare "85" is 8.5.
     */
    function bubbleValue(raw) {
        const s = String(raw || '').replace(/[^\d.]/g, '').replace(/^\.+|\.+$/g, '');
        if (!s) return null;
        if (s.includes('.')) return num(s);
        return s.length >= 2 ? num(`${s.slice(0, -1)}.${s.slice(-1)}`) : num(s);
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

    /**
     * The stats panel enlarged and inverted to dark text on light, as
     * Tesseract prefers. Also returns the original pixels and the scale, so
     * results can be mapped back onto the screenshot.
     */
    function prepare(img) {
        const probe = document.createElement('canvas');
        probe.width = img.width; probe.height = img.height;
        const pg = probe.getContext('2d');
        pg.drawImage(img, 0, 0);
        const pixels = pg.getImageData(0, 0, img.width, img.height).data;
        const divider = findDivider(pixels, img.width, img.height);
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
        return { canvas: c, scale, pixels };
    }

    /** Words with boxes in screenshot pixels, from a recognition run with blocks. */
    function wordsOf(data, scale) {
        return (data.blocks || []).flatMap(b => b.paragraphs.flatMap(p => p.lines.flatMap(l => l.words)))
            .map(w => ({ t: w.text, x0: w.bbox.x0 / scale, x1: w.bbox.x1 / scale, y0: w.bbox.y0 / scale, y1: w.bbox.y1 / scale }));
    }

    /**
     * Where a Stat Efficiency card's bubble sits, from its label: the card's
     * label reads "ATT/MATT per 40% <tail>", and the bubble rides a slider
     * just below it (below the "ID" that wraps onto a second line for EQP ID).
     * Returns a search box in screenshot pixels, or null.
     */
    function bubbleRegion(words, tail) {
        const sameLine = (a, b) => Math.abs((a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2) < Math.max(a.y1 - a.y0, 6);
        for (const end of words.filter(w => tail.test(w.t))) {
            const pct = words.find(w => /^40%$/.test(w.t) && sameLine(w, end) && w.x1 <= end.x0 + 2 && end.x0 - w.x1 < 25);
            if (!pct) continue;
            // The label's first word, "ATT/MATT", is the word before "per";
            // found by position because OCR does not always spell it exactly.
            const before = words.filter(w => sameLine(w, end) && w.x0 < pct.x0).sort((a, b) => b.x0 - a.x0);
            const att = /^p\S{1,3}$/i.test((before[0] || {}).t) ? before[1] : before[0];
            if (!att) continue;
            const lh = Math.max(att.y1 - att.y0, 6);
            const left = att.x0 - 0.8 * lh, right = end.x1 + 0.8 * lh;
            const id = words.find(w => /^ID$/i.test(w.t) && w.y0 > end.y1 && w.y0 - end.y1 < 2 * lh
                && w.x0 >= left && w.x1 <= right);
            const top = (id || end).y1;
            return { x: Math.round(left), y: Math.round(top + 0.8 * lh), w: Math.round(right - left), h: Math.round(1.9 * lh) };
        }
        return null;
    }

    /**
     * The bright digits inside a region: the bubble's number is the only
     * near-white there apart from the card's border, a vertical line that is
     * bright down most of the region and is skipped for that.
     */
    function brightBox(pixels, width, region) {
        const bright = (x, y) => {
            const i = (y * width + x) * 4;
            return 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2] > 170;
        };
        let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
        for (let x = region.x; x < region.x + region.w; x++) {
            const rows = [];
            for (let y = region.y; y < region.y + region.h; y++) if (bright(x, y)) rows.push(y);
            if (!rows.length || rows.length > 0.7 * region.h) continue;
            x0 = Math.min(x0, x); x1 = Math.max(x1, x);
            y0 = Math.min(y0, rows[0]); y1 = Math.max(y1, rows[rows.length - 1]);
        }
        return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }

    /** A small box enlarged and thresholded to black digits on white. */
    function digitsCanvas(img, box, scale) {
        const pad = 4;
        const c = document.createElement('canvas');
        c.width = (box.w + 2 * pad) * scale; c.height = (box.h + 2 * pad) * scale;
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, box.x - pad, box.y - pad, box.w + 2 * pad, box.h + 2 * pad, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < d.data.length; i += 4) {
            const v = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2] > 130 ? 0 : 255;
            d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        }
        g.putImageData(d, 0, 0);
        return c;
    }

    /**
     * Reads one Stat Efficiency bubble; tries two enlargements and prefers
     * one with its decimal point. Returns { value, reads, box }.
     */
    async function readBubble(worker, img, pixels, words, tail) {
        const region = bubbleRegion(words, tail);
        const box = region && brightBox(pixels, img.width, region);
        if (!box) return { value: null, reads: [], box: null, region };
        const reads = [];
        for (const scale of [6, 8]) {
            const { data } = await worker.recognize(digitsCanvas(img, box, scale));
            const t = data.text.trim();
            if (t) reads.push(t);
        }
        return { value: bubbleValue(reads.find(t => t.includes('.')) || reads[0]), reads, box, region };
    }

    /**
     * Recognises a screenshot. Resolves to { kind: 'enter', text, parsed } for
     * the Enter Directly page, or { kind: 'results', text, parsed } with
     * parsed = { hexaConverted, bd40, ied40 } for the results page.
     */
    async function readScouterScreenshot(blob, onProgress = () => {}) {
        onProgress('Loading the text reader');
        const Tesseract = await loadTesseract();
        const img = await loadImage(blob);
        const { canvas, scale, pixels } = prepare(img);
        const worker = await Tesseract.createWorker('eng', 1, {
            logger: m => { if (m.status === 'recognizing text') onProgress(`Reading ${Math.round(m.progress * 100)}%`); },
        });
        let data;
        try {
            ({ data } = await worker.recognize(canvas, {}, { blocks: true }));
        } finally {
            await worker.terminate();
        }
        if (!isResultsPage(data.text)) return { kind: 'enter', text: data.text, parsed: parseScouterText(data.text) };

        // A fresh reader for the bubbles: one that has just read the whole
        // page adapts to its fonts and misreads the tiny digits.
        onProgress('Reading Stat Efficiency');
        const words = wordsOf(data, scale);
        const digits = await Tesseract.createWorker('eng');
        try {
            await digits.setParameters({ tessedit_char_whitelist: '0123456789.', tessedit_pageseg_mode: '7' });
            const bd = await readBubble(digits, img, pixels, words, /^BD$/i);
            const ied = await readBubble(digits, img, pixels, words, /^EQP$/i);
            const bubbleNote = (label, b) => `${label}: ${b.reads.length ? b.reads.join(' / ') : 'not found'}`;
            return {
                kind: 'results',
                text: `${data.text}
${bubbleNote('ATT per 40% BD bubble', bd)}
${bubbleNote('ATT per 40% EQP ID bubble', ied)}`,
                parsed: { ...parseResultsText(data.text), bd40: bd.value, ied40: ied.value, bubbles: { bd, ied } },
            };
        } finally {
            await digits.terminate();
        }
    }

    root.ScouterScreenshot = {
        parseScouterText, statsFromScouter, matchClass, findDivider, readScouterScreenshot,
        isResultsPage, parseResultsText, bubbleValue, bubbleRegion,
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
