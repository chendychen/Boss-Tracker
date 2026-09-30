# MapleStory Boss Tracker

A browser-based tracker for MapleStory players to manage weekly boss crystal income, boss progression and gear upgrades across multiple characters.

## Install

1. Download or clone the repository:
   ```bash
   git clone https://github.com/chendychen/Boss-Tracker.git
   ```
2. Start the local server and open the address it prints (`http://localhost:8777`, or `http://127.0.0.1:8777`):
   ```bash
   npm start
   ```

The server needs only Node, with no dependencies. It serves the app, reads and writes the save file in `saves/`, and lists gear builds in `builds/`. Opening `boss_crystal_tracker.html` directly also works, but then data lives only in the browser and `builds/` has to be picked with **Open builds folder…**.

## Features

### Boss Crystals Tab
- Select which bosses each character clears weekly
- Boss profile icons cropped from the in-game Soul Crystal price list, swapping with the selected difficulty
- Choose difficulty per boss (Extreme / Hard / Chaos / Normal / Easy)
- Set party size per boss (crystals split between party members)
- Auto-calculates weekly meso income per character
- Enforces the in-game crystal limits, with overflow detection
- Grand total across all characters shown at a glance

### Selling Strategy Tab
- Identifies overflow boss crystals that exceed per-character or global limits
- Groups by boss with character tags to help decide which crystals to drop

### Progression Tab
- Models effective HP per boss: raw HP divided by level-advantage, Arcane/Sacred Force and boss defense multipliers
- Level advantage, Arcane Force tiers and Sacred/Authentic Force scaling follow the [StrategyWiki formulas](https://strategywiki.org/wiki/MapleStory/Formulas), including penalties below the force floor
- Boss defense uses `1 − PDR × (1 − IED)`, with PDR set per difficulty: Chosen Seren onward and Extreme Lotus are 380%, other earlier bosses 300%. IED is a per-character field defaulting to 98%
- Per-character level, Sacred Force and Arcane Force inputs
- Derives your sustained damage by calibrating from a boss you already clear, a site clear %, or DPS set directly
- Phase-by-phase pace against the 30:00 enrage timer, including per-phase monster level (Normal Kalos P1 is level 275 while P2 is 280, so they price differently)
- Models the 2-minute burst cadence (60% of damage in a ~25s window) and reports slack as **bursts you can waste**
- Flags each boss as clearing, tight (under 2 bursts spare), short by N bursts, or blocked below the force floor
- What-if adjustment: nudge level and IED to see adjusted clear time, margin and damage change side by side, including which bosses flip to clearing

### Upgrades Tab
- Per-character gear inventory, imported from a GMS Upgrade Tracker build export (Gear → Import / Export → Save this build to a file) dropped into `builds/`, or entered by hand from a catalog of endgame gear
- Per-character class, which sets main and secondary stat and ATT or MATT, and filters potential lines to what the class uses
- Gear editor with slot-aware potential line dropdowns, flames with the site's flame score, and what each is worth in final damage
- Upgrade plan ranking star force, cubes and flames by expected mesos per 1% final damage, with the bosses each step brings on pace
- Targets stated the way players roll: main stat % or ATT %, and flame score, with the most likely qualifying rolls
- **Update** on each plan row records what you hit and moves the stat sheet by the difference
- Star force follows the current GMS system (Enhancement Mode, Safeguard, trace recovery, Shining Star Force); cubes use Glowing/Bright line odds; flames use the 3M meso reset
- IED lines are ignored in cube targets by default (stacked IED has sharply diminishing returns); hat cooldown can follow a class curve (Pathfinder built in)

### Multi-Character Management
- Add, rename, copy, delete, and reorganize characters
- Active character highlighted with tab navigation
- Per-character data across all tabs

### Data Persistence & Portability
- Auto-saves to browser `localStorage`
- **Save** also writes `saves/latest.json` and keeps the last 10 snapshots when the local server is running
- Export all data to a `.json` file, and `npm run import-save` to move an export into `saves/`
- Import from a previously exported `.json` file

## Files

| File | Description |
|------|-------------|
| `boss_crystal_tracker.html` | Main app entry point |
| `boss-tracker.js` | Boss crystals, selling strategy, progression and saving |
| `upgrade-tables.js` | Star force, cube and flame game tables, with sources |
| `upgrade-engine.js` | Damage model, build import and upgrade ranking |
| `upgrades-ui.js` | Upgrades tab |
| `styles.css` | Shared stylesheet |
| `tools/save-server.mjs` | Local server: serves the app, `saves/` and `builds/` |
| `tools/import-save.mjs` | Moves an exported backup into `saves/` |
| `images/bosses/` | Boss profile icons, one per boss + difficulty |

`saves/` and `builds/` hold personal data and are gitignored.

## Boss Data

Contains 35 bosses across 17 boss groups, ranging from Hard Damien (~422M mesos) up to Extreme Black Mage (18B mesos). Prices reflect the in-game Intense Power Crystal values and are embedded directly in `boss-tracker.js` for offline compatibility, mirrored in `boss-data.json` for the test suite.
