# Nokia Mini OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Nokia XpressMusic mockup into a small browser phone OS with persistent call history, configurable shortcuts, gallery wallpaper, status indicators, and basic apps.

**Architecture:** Keep the single-file app in `index.html`, with state stored in one JS object and persisted through `localStorage`. Playwright tests cover the key behavior: D-pad menu navigation, call history, gallery wallpaper, and physical/keyboard controls.

**Tech Stack:** Plain HTML, CSS, JavaScript, browser localStorage, Playwright.

## Global Constraints

- Preserve the Nokia-inspired 3:4 screen.
- Keep the app local and static; no backend.
- Do not reintroduce the right-side camera hardware key; use volume keys there.
- Use localStorage for user settings and history.
- Camera remains a menu/shortcut app, not a dedicated right-side physical button.

---

### Task 1: Persistent Phone Shell

- [ ] Add status bar for date, time, signal, Wi-Fi, and battery.
- [ ] Replace right-side camera key with volume up/down.
- [ ] Add powered on/off state and long-press red-key behavior.
- [ ] Verify the screen remains 3:4 and buttons stay inside their hardware surfaces.

### Task 2: Menu Navigation And Apps

- [ ] Make D-pad move real menu selection.
- [ ] Add apps: Call Log, Contacts, Messages, Gallery, Camera, Calculator, Alarm, Timer, Snake, Settings.
- [ ] Make center key open selected menu item.
- [ ] Keep placeholder apps usable with realistic Nokia-style screens.

### Task 3: Storage And Settings

- [ ] Store call history, wallpaper, ringtone, volume, profile, display, and shortcuts in localStorage.
- [ ] Add Settings rows for shortcuts, sounds, display, date/time, phone/profile, network, power/battery, and music folder placeholder.
- [ ] Let Gallery set the bundled image as wallpaper.

### Task 4: Verification

- [ ] Add Playwright tests for call history, D-pad selection, gallery wallpaper, and keyboard/physical controls.
- [ ] Run `npm test`.
