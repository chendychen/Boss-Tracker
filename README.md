# MapleStory Boss Tracker

A browser-based tracker for MapleStory players to manage weekly boss crystal income and pitched gear across multiple characters.

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
- Supports sub-options (e.g. Black Heart vs Total Control)
- Tracks spares for select items
- Pitch history log per character
- Global Black Heart spare counter shared across all characters

### BH History Tab
- Log and review Black Heart acquisition history

### Multi-Character Management
- Add, rename, copy, delete, and reorganize characters
- Active character highlighted with tab navigation

### Data Persistence & Portability
- Auto-saves to browser `localStorage`
- Manual save button with confirmation indicator
- Export all data to a `.json` file
- Import from a previously exported `.json` file

## Usage

Open `boss_crystal_tracker.html` directly in a browser — no server or install required.

> All data is stored locally in your browser. Use Export/Import to back up or transfer data between browsers/devices.

## Files

| File | Description |
|------|-------------|
| `boss_crystal_tracker.html` | Main app entry point |
| `boss-tracker.js` | All application logic |
| `styles.css` | Shared stylesheet |
| `boss-data.json` | Boss list with crystal prices (reference) |
| `crystal_pricing.csv` | Crystal prices in CSV format (reference) |

## Boss Data

Contains 31 bosses ranging from Hard Lotus (~444M mesos) up to Extreme Black Mage (18B mesos). Prices reflect crystal market values and are embedded directly in `boss-tracker.js` for offline compatibility.

## Pitched Gear Tracked

Berserked, Magic Eyepatch, Black Heart / Total Control, Dreamy Belt, Source of Suffering, Genesis Badge, Commanding Force Earring, Endless Terror, Cursed Spellbook, Mitra's Rage
