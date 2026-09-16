# Navu: Treasures of the Fallen — UI/UX & Structure Enhancement Plan

**Status as of this update:** Phase 0 (restructuring) and most of Phases 1–2 are complete and verified — see "Completed work" below. This document is kept as the working plan/reference for what's done and what's left.

**Scope of this document:** This is an analysis of the current `navu-game.zip` codebase against the official rulebook, followed by a phased plan to make the digital implementation more usable, polished, and structurally sound for a GitHub Pages release.

**Hard constraint honored throughout:** No game mechanic, rule, cost, reward value, or win condition is changed anywhere in this plan. Every change is about *how the game is presented and operated*, not *how it plays*. Two exceptions are noted below where the code didn't actually do what it was supposed to (restored, not changed).

**Target platform:** Desktop/laptop web browsers only — this is explicitly not being built for mobile/tablet, per direction.

---

## 0. Completed work

**Critical bug fixes (restored intended behavior):**
- `resolveCommanderAction` was never defined — the "Select Action Color" modal (shown for White commanders or activated matching-color gear) called a function that didn't exist, throwing and stalling the turn for both human and AI players. This had been accidentally written as a second, identically-named copy of `executeLocationAction`, which silently discarded the upgraded-gear treasure bonus logic. Restored as its own method; the bonus logic now runs again.
- The "Select Action Color" buttons used a `res-${color.charAt(0)}` class scheme that collided ("Black" and "Blue" both start with 'b') and had no styling at all for "Purple." Fixed with proper per-color classes matching the new commander token design.

**Restructuring:**
- Split into `js/data/`, `js/core/`, `js/ai/`, `js/ui/` and `css/base.css`, `layout.css`, `board.css`, `cards.css`, `dialogs.css`, replacing the single 5000-line flat file layout.
- Removed dead/unused markup (`#modal-overlay`) and the obsolete itch.io-specific `FINAL_README.txt`, replaced with a proper `README.md`.
- Added `smoketest.js`, a headless jsdom regression test (16 checks) covering game start, starting choices, commander placement, the two fixed bugs specifically, phase progression, and raid completion. Run via `npm install && npm test`.

**Dialogs:**
- Built `js/ui/dialogs.js`, a themed modal system matching the gold/Cinzel look.
- Migrated all 13 `alert()` and 5 `confirm()` calls off native browser dialogs, including a proper end-of-game results panel. The `confirm()` migration required making `completeRaid()` and `resolveFavorSelection()` `async` (a custom modal can't block synchronously like native `confirm()`), which meant auditing every caller — including the AI turn controller — to make sure the turn can't advance mid-resolution.

**Visual/UX:**
- Redesigned commander tokens from plain colored circles into shield-shaped, gradient-colored markers, driven by CSS classes instead of inline JS styles.
- Added a 3-step phase tracker (Activate / Place & Collect / Turn-in) in the action rail.
- Added desktop-width responsive rules (fluid/clamped panel widths, two breakpoints) so the layout survives normal window resizing instead of clipping — no mobile breakpoints, per direction.
- Cleaned up 57 of 58 inline styles in `ui.js` into CSS classes (the one remaining is a genuinely per-player dynamic color and is fine to keep inline).

---

## 1. What's already working (unchanged from original analysis)

- Core loop (Activate → Place & Pick Up → Collect → Strength Check & Turn-in) matches the rulebook's 4-step turn structure.
- All 30 raid cards, 55 gear cards, leader cards, and 9 favor cards match the rulebook counts.
- Location reward table, strength thresholds, leader rank prerequisites, and Land of Theos hex-majority scoring are all implemented correctly.
- Asset paths are relative and case-correct.

## 2. Rulebook ↔ Code cohesion check

| Rulebook concept | Code status |
|---|---|
| 4-step turn (Activate / Place & Pick Up / Collect / Check & Turn-in) | ✅ Implemented as `activate → place → turnin` phases (Collect is folded into placement resolution) |
| Commander "bump" mechanic | ✅ Implemented in `placeCommander()` |
| Only 1 raid turn-in per turn | ✅ Enforced by phase structure |
| Strength thresholds grant one-time rewards | ✅ Implemented, thresholds tracked per player |
| Leader rank prerequisite | ✅ Enforced in Command Center choice logic |
| Max 1 of each gear type | ✅ Enforced in strength-reward gear selection |
| Land of Theos hex majority + tie-break by strength | ✅ Implemented in `calculateFinalScores()` |
| End game at 6th raid cube (8th for extended) | ✅ Implemented; the 8-cube "extended game" option isn't exposed as a setup toggle anywhere in the UI (see Section 4.5) |

## 3. Remaining code-correctness notes

Everything from the original list is now resolved except:

- The extended-game (8-cube) option from the rulebook still has no UI toggle — worth adding if you want players to be able to choose it.

## 4. Remaining UX/UI work

### 4.1 Visual & thematic polish (in progress)
- Commander tokens and the phase tracker are done. Still worth a pass on: the native `<select>`/button styling on the initial setup screen (partially done — AI-count dropdown and Start Single Player button are themed), and giving the AI's turn a more polished "thinking" treatment beyond the current pulsing text.

### 4.2 Information architecture
- Card preview, board zoom, and the game log still compete for the same fixed-width side column — worth reconsidering as tabs or an expandable panel.

### 4.3 Extended game toggle
- Surface the 8-cube extended-game option as an actual setup checkbox if desired.

### 4.4 GitHub Pages readiness & final QA
- Cross-browser pass (Chrome/Firefox/Safari on desktop).
- Confirm relative asset paths continue to resolve under a GitHub Pages subpath (e.g. `username.github.io/repo-name/`) once actually hosted there.
- A live playtest end-to-end (the smoke test covers code paths, not visual/UX feel).

---

## 5. What I'd like from you

1. Is the visual direction so far (shield-shaped commander tokens, gold/Cinzel themed modals, 3-step phase tracker) the right lane, or do you want changes before I keep going in that style?
2. Want the extended-game (8-cube) toggle added, or leave it out for now?
3. Any interest in tabbing the side panel (preview/zoom/log), or is the current fixed layout fine now that it's responsive?

