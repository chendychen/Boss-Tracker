# MapleStory Boss Tracker

A browser-based tracker for MapleStory players to manage weekly boss crystal income, pitched gear, and equipment progression across multiple characters.

## Install

1. Download or clone the repository:
   ```bash
   git clone https://github.com/chendychen/Boss-Tracker.git
   ```
2. Open `boss_crystal_tracker.html` in any modern browser.

No server, build step, or dependencies required. All data is stored locally in your browser via `localStorage`.

## Features

### Boss Crystals Tab
- Select which bosses each character clears weekly
- Choose difficulty per boss (Extreme / Hard / Chaos / Normal / Easy)
- Set party size per boss (crystals split between party members)
- Auto-calculates weekly meso income per character
- Enforces the in-game 60-crystal-per-week limit, with overflow detection
- Grand total across all characters shown at a glance

### Pitched Tracker Tab
- Track pitched (rare drop) gear obtained per character
- Items organized into three sections: Heart, Star Forceable Pitched, and One-of Pitched
- Star Force level tracking (18-22) for applicable pitched items
- Supports sub-options (e.g. Black Heart vs Total Control)
- Tracks spares for select items
- Pitch history log per character
- Global Black Heart spare counter shared across all characters

### BH History Tab
- Log and review Black Heart acquisition history

### Selling Strategy Tab
- Identifies overflow boss crystals that exceed per-character or global limits
- Groups by boss with character tags to help decide which crystals to drop

### Gear Tracker Tab
- Track 17 equipment slots across a 4-column grid layout (Rings, Face, Eyes, Earrings, Pendants, Belt, Hat, Top, Bottom, Shoulder, Cape, Gloves, Shoes)
- Gear type selector per slot with slot-specific options (e.g. CRA/Eternal for armor, Arcane/Eternal for accessories)
- Star Force level tracking (18-22) per slot, or Level (3-6) for RoR/Cont. rings
- Uniqueness constraints: ring and pendant types cannot be duplicated across slots
- RoR and Cont. rings are mutually exclusive
- Quick Fill buttons to instantly set Full Gollux, Full Arcane, or Full CRA with a chosen star force level
- **Eternals Strategy** section showing the top 3 next FD (Final Damage) gain recommendations based on current equipment
  - **Safe** profile: 18 SF for first 3 eternals, upgrade to 19, then 21 max
  - **Risky** profile: all eternals at 22 SF for maximum FD
  - Considers both acquiring new Eternal pieces and upgrading SF on existing ones
  - Displays current cumulative FD from equipped Eternals

### Multi-Character Management
- Add, rename, copy, delete, and reorganize characters
- Active character highlighted with tab navigation
- Per-character data across all tabs

### Data Persistence & Portability
- Auto-saves to browser `localStorage`
- Manual save button with confirmation indicator
- Export all data to a `.json` file
- Import from a previously exported `.json` file

## Files

| File | Description |
|------|-------------|
| `boss_crystal_tracker.html` | Main app entry point |
| `boss-tracker.js` | All application logic |
| `styles.css` | Shared stylesheet |

## Boss Data

Contains 31 bosses ranging from Hard Lotus (~444M mesos) up to Extreme Black Mage (18B mesos). Prices reflect crystal market values and are embedded directly in `boss-tracker.js` for offline compatibility.

## Pitched Gear Tracked

Black Heart / Total Control, Endless Terror, Magic Eyepatch, Source of Suffering, Berserked, Commanding Force Earring, Dreamy Belt, Genesis Badge, Cursed Spellbook, Mitra's Rage
