# Navu: Treasures of the Fallen — UI/UX & Structure Enhancement Plan

**Status as of this update:** Phase 0 (restructuring) and most of Phases 1–2 are complete and verified — see "Completed work" below. This document is kept as the working plan/reference for what's done and what's left.

**Scope of this document:** This is an analysis of the current `navu-game.zip` codebase against the official rulebook, followed by a phased plan to make the digital implementation more usable, polished, and structurally sound for a GitHub Pages release.

**Hard constraint honored throughout:** No game mechanic, rule, cost, reward value, or win condition is changed anywhere in this plan. Every change is about *how the game is presented and operated*, not *how it plays*. Two exceptions are noted below where the code didn't actually do what it was supposed to (restored, not changed).

**Target platform:** Desktop/laptop web browsers only — this is explicitly not being built for mobile/tablet, per direction.

---

## 0. Completed work

### Session 1 — restructuring, dialogs, initial bug fixes

**Critical bug fixes (restored intended behavior):**
- `resolveCommanderAction` was never defined — the "Select Action Color" modal (shown for White commanders or activated matching-color gear) called a function that didn't exist, throwing and stalling the turn for both human and AI players. This had been accidentally written as a second, identically-named copy of `executeLocationAction`, which silently discarded the upgraded-gear treasure bonus logic. Restored as its own method; the bonus logic now runs again.
- The "Select Action Color" buttons used a `res-${color.charAt(0)}` class scheme that collided ("Black" and "Blue" both start with 'b') and had no styling at all for "Purple." Fixed with proper per-color classes matching the new commander token design.

**Restructuring:**
- Split into `js/data/`, `js/core/`, `js/ai/`, `js/ui/` and `css/base.css`, `layout.css`, `board.css`, `cards.css`, `dialogs.css`, replacing the single 5000-line flat file layout.
- Removed dead/unused markup (`#modal-overlay`) and the obsolete itch.io-specific `FINAL_README.txt`, replaced with a proper `README.md`.
- Added `smoketest.js`, a headless jsdom regression test, run via `npm install && npm test`.

**Dialogs:**
- Built `js/ui/dialogs.js`, a themed modal system matching the gold/Cinzel look.
- Migrated all 13 `alert()` and 5 `confirm()` calls off native browser dialogs, including a proper end-of-game results panel. The `confirm()` migration required making `completeRaid()` and `resolveFavorSelection()` `async` (a custom modal can't block synchronously like native `confirm()`), which meant auditing every caller — including the AI turn controller — to make sure the turn can't advance mid-resolution.

**Visual/UX:**
- Redesigned commander tokens from plain colored circles into shield-shaped, gradient-colored markers, driven by CSS classes instead of inline JS styles.
- Added a 3-step phase tracker (Activate / Place & Collect / Turn-in) in the action rail.
- Added desktop-width responsive rules (fluid/clamped panel widths, two breakpoints) so the layout survives normal window resizing instead of clipping — no mobile breakpoints, per direction.
- Cleaned up 57 of 58 inline styles in `ui.js` into CSS classes (the one remaining is a genuinely per-player dynamic color and is fine to keep inline).

### Session 2 — gameplay-correctness audit and fixes

**Land of Theos hex majority scoring — was genuinely broken, now fixed.** The code awarded full bonus VP to *every* tied player on a hex instead of breaking the tie by strength. Rewrote to match the rulebook: most cubes wins → tied on cubes, highest strength wins → tied on strength too, no one scores that hex. This also required building a `faceDownLeaders` concept (see next item) since the rulebook specifically says a face-down leader's strength counts *only* for this tie-break.

**Duplicate-rank leader bug — confirmed and fixed.** Every path that grants a ranked leader (Command Center, strength-5 reward, a couple of favor effects) was pushing the new card in with no check for "already have one of this rank." Built `grantLeaderCard()`, a centralized acquisition path: acquiring a 2nd leader of a rank you hold now prompts a themed choice (keep old or swap in new); the one that doesn't stay active goes face down (no strength/ability during play, but its strength counts toward the Theos tie-break above). AI auto-resolves by keeping whichever has higher strength. Also fixed: Standard Officer 5's bonus Lieutenant is supposed to be granted face-down per its own card text, but was being added as active — corrected.

**Officer passive-ability audit** — checked all 14 leaders' code against their card text:
- Fixed: Lt. Friz / Lt. Cates ("bonus after acquiring any gear") weren't triggering on gear picked from a strength-12/38 reward, only from the Armory — now they do.
- Fixed: Lt. Lee's trigger was checking 2+ resources gained; card text says 2+ *influence* — corrected (confirmed with you).
- Built: General Kirk's "move an opponent's cube 1 space in the Land of Theos" was entirely unimplemented (only the +3 Treasure half worked, with a code comment admitting it). Built the full flow: pick a hex with an opponent's cube → pick which opponent if more than one is there → pick a real adjacent hex (adjacency computed directly from the board's actual hex coordinates, not guessed) → cube moves, then your own raid's placement continues. AI has a working heuristic too.
- Verified working correctly, no changes needed: all 6 "utilize any commander's bonus when placing the [X] Commander" gear items (Bracers/Short Sword/Axe/Bow/Daggers/Shield), and the White/"Wild" commander mechanic.

**UI/UX:**
- Added small colored commander tokens to each player's row in the scoreboard, showing which commanders they currently hold in hand (not yet placed).

**Bug reported after this session's changes shipped, now fixed:** the yellow "valid hex" highlight during raid-completion cube placement was using an animation (`gold-pulse`) that only animates `transform: scale(...)` — since a CSS animation replaces an element's whole `transform` value per keyframe rather than adding to a separately-set static one, this was overwriting `.hex-segment`'s own `translate(-50%, -50%)` centering offset for the whole animation, visually clustering every highlighted hex toward one corner. Fixed by pointing it at `gold-pulse-board` (already used correctly elsewhere), whose keyframes include the translate. Added a regression check so this can't silently reappear.

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

- The extended-game (8-cube) option from the rulebook still has no UI toggle — worth adding if you want players to be able to choose it.
- General Kirk's cube-move uses a hex adjacency map computed directly from the board's coordinate layout (17 hexes, clean distance threshold between neighbors and non-neighbors) — worth a quick in-game sanity check on the live board art to confirm it matches what you'd expect visually, since it was derived from data rather than manually verified hex-by-hex.

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
- A live playtest end-to-end (the smoke test covers code paths and some rendered DOM state, not visual/UX feel — the hex-highlight-position bug from this session is a good example of something a live playtest catches that the test suite alone didn't, since jsdom doesn't compute animated CSS transforms).

---

## 5. What I'd like from you

1. Play through a full raid-completion → hex-placement cycle again to confirm the highlight-position fix actually looks right on the live board art.
2. Try triggering General Kirk's cube-move a few times and confirm the adjacency (which hexes count as "1 space" away) matches your expectations of the board.
3. Any interest in tabbing the side panel (preview/zoom/log), or is the current fixed layout fine now that it's responsive?
4. Keep flagging anything else that looks or feels off — this kind of "play it and report back" loop is turning out to be the most effective way to find the real gaps.

