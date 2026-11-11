// Daily autosave: decides when the page writes the save file by itself.
//
// Edits land in localStorage at once; the file in saves/ is the backup. Once a
// day, the first time the page finds the data differs from what the file
// holds, it writes the file the way the Save button does.
//
// Pure logic with no DOM access, loaded by the page as a classic script and by
// the tests through node:vm. Storage, the clock, the data and the write are
// passed in, so a test can supply them. Exposes window.Autosave.

(function (root) {
    'use strict';

    const DATE_KEY = 'bossTrackerAutosaveDate';        // local date of the last autosave
    const SAVED_KEY = 'bossTrackerSavedFingerprint';   // fingerprint of the data the save file holds
    const RETRY_AFTER = 10 * 60 * 1000;                // wait after a write that failed, ms

    /** A short fingerprint of a text: its length and a 32-bit FNV-1a hash. */
    function fingerprint(text) {
        let hash = 0x811c9dc5;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        return `${text.length}:${(hash >>> 0).toString(16)}`;
    }

    /**
     * @param {object} deps
     * @param {Storage} deps.storage - localStorage, or anything with getItem and setItem
     * @param {() => string} deps.today - the local date, YYYY-MM-DD
     * @param {() => string} deps.content - the data worth saving, as text
     * @param {() => Promise<boolean>} deps.write - writes the save file; resolves to whether it was written
     * @param {() => number} [deps.now] - the clock, in ms
     */
    function createAutosave({ storage, today, content, write, now = Date.now }) {
        let writing = false;
        let retryAt = 0;

        /** Records that the save file holds the data as it is now: after a manual save, or a file just loaded. */
        function markSaved() {
            storage.setItem(SAVED_KEY, fingerprint(content()));
        }

        /**
         * Writes the save file when today's autosave has not happened yet and
         * the data differs from what the file holds. The first time it runs in
         * a browser there is nothing to compare with, so the data as found
         * counts as saved: opening the app never writes the file, only an edit
         * does.
         * @returns {Promise<boolean>} whether it saved
         */
        async function check() {
            if (writing || now() < retryAt) return false;
            if (storage.getItem(DATE_KEY) === today()) return false;
            const saved = storage.getItem(SAVED_KEY);
            const current = fingerprint(content());
            if (saved === null) storage.setItem(SAVED_KEY, current);
            if (saved === null || saved === current) return false;

            writing = true;
            try {
                if (!await write()) {
                    retryAt = now() + RETRY_AFTER;
                    return false;
                }
                storage.setItem(SAVED_KEY, current);
                storage.setItem(DATE_KEY, today());
                return true;
            } finally {
                writing = false;
            }
        }

        return { check, markSaved };
    }

    root.Autosave = { DATE_KEY, SAVED_KEY, RETRY_AFTER, fingerprint, createAutosave };
})(typeof globalThis !== 'undefined' ? globalThis : this);
