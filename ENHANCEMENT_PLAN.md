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

### Session 3 — layout overhaul, placement confirmation, and a second instance of the transform bug

**Layout overhaul (your requests):**
- **Scrollbars on window resize** — root cause: `#locations-area` (the board) was sized as `width: 70vh; height: 70vh` with no width constraint at all, so a narrow (not just short) window would overflow horizontally regardless of anything else. Changed to `width/height: min(70vh, 56vw)` so the board shrinks by whichever dimension is actually tight.
- **Game log** — the always-visible panel is gone. A "📜 Log" button in a new top bar opens it as a floating popup instead.
- **Right action rail** — gone. Replaced with a horizontal "① Activate — ② Place & Collect — ③ Turn-in" tracker across a new top bar, plus a "▶ Turn Actions" button that opens a popup with the current instruction and the Next Phase button. It auto-opens once per new phase for a human turn (skipped if a choice/dialog is already up), and can be reopened/dismissed anytime.
- **Setup screen** (player count / AI opponents) moved into a centered popup shown only pre-game.
- With the rail and log gone, widened the player dock and side panel to use the freed space.
- **Commander placement confirmation** — clicking a location no longer places immediately. It now opens "Place your [Color] Commander on [Location]? Confirm / Cancel" first; Cancel does nothing (nothing was touched yet, so this is a completely safe undo), Confirm runs the actual placement. AI is unaffected (places directly, no popup).

**Bugs reported after Session 2 shipped, now fixed:**
- **Gear cards "shooting off" on hover** — same root cause as the hex-highlight bug from Session 2, in a different place: `.selectable-card:hover { transform: scale(1.1) !important; }` was overriding the inline `translate(-50%, -50%)` that board-positioned cards (gear/raid market cards drawn on the board) need for their own positioning, on top of the constant `gold-pulse` animation doing the same thing every keyframe cycle — together these caused the described flicker (the card jumps out from under the cursor, hover ends, it snaps back, hover restarts). Fixed by rewriting `.selectable-card`/`:hover` to use only `box-shadow`/`filter` — never `transform` — so this class is now safe on any positioned element, board or dock. This is also exactly what was asked for: glow, no movement.
- **Favor cards missing from the board** — there's no face-up favor market the way there is for gear/raid/leader (favors are drawn and resolved into a private choice immediately), so nothing was ever rendered at the Favors location. No dedicated card-back art asset exists in the project, so this is a simple CSS-only themed placeholder (dark gradient, gold border) with a live count of favors remaining in the deck — functional as well as decorative.

**Test-suite note:** while re-verifying all of the above, found and fixed a genuine flakiness source in `smoketest.js` itself (not a game bug) — the test runner's `check()` helper wasn't awaiting async test functions, so an earlier async `completeRaid()` call could still be mid-flight when a later, unrelated test ran, occasionally leaking a stray board marker into it. Fixed by making `check()` properly `async`/`await`-based throughout. Ran the full suite 13 consecutive times after the fix with zero failures.

### Session 4 — end-game correctness, the game actually ending, and a detailed score breakdown

**End-game bonus audit (you asked "so all the end-game bonuses work?"):**
- Checked every raid-set end-game bonus (Royal Slaying, Village Pillage, Town Terror, Master of Puppets, Maximum Effort, Gearhead, King Killer, Gotta Raid Them All) against its actual card text. Found and fixed one real discrepancy: **Master of Puppets**' card says *"If Power is >35"* (strictly greater than), but the code checked `>= 35`. Fixed to match the card exactly.
- Found and fixed a more significant gap: **the game never actually ended.** `calculateFinalScores()` computed everything correctly, but nothing ever set a "game over" flag afterward, so a player could keep clicking around post-game-over — and since every VP source is a `+=` rather than a full recompute, a second trigger would double-count gear VP, raid bonuses, and hex majorities on top of the first pass. Added the flag, made `calculateFinalScores()` a no-op on a repeat call, and gated `placeCommander`/`nextPhase`/`completeRaid` so play genuinely stops once the game ends.

**Detailed end-of-game score breakdown popup (your request).** The Game Over screen now shows, per player: Raid Treasures (raid completion + in-game bonus objectives), Gear Treasures (held gear VP + gear-passive bonuses like an upgraded Breastplate), Board Treasures (unspent Treasure tokens converted 1:1 at game end), Theos Treasures (Land of Theos hex majorities), and End-Game Bonus Treasures (the raid-set bonuses above) — plus the total. This required adding a `vpBreakdown` tracker to each player that's updated alongside `cp.vp` at every point VP is awarded anywhere in the code (not just at game end), so the breakdown is accurate to the actual source of every point, not reconstructed after the fact.

**Influence & Strength track discs (your other request).** Since no visual track existed before (the code had stub functions with a comment saying they were intentionally left empty), I pulled the actual board art and measured exact coordinates rather than guessing:
- **Influence**: 5 player rows, each a 13-space zigzag (0–12), even positions on the row's lower line, odd on its upper line — matches your reference image exactly.
- **Strength**: turned out to be a *branching hex tree*, not a line — Start splits into two paths at each real threshold (5/18/25/32/45) and rejoins at the single-path checkpoints (12/38), matching the 7 thresholds already in `checkStrengthThresholds`. A player's disc snaps to the highest threshold they've reached, alternating sides when two players share a forked tier.
- Verified the coordinate math by drawing the computed positions back onto the actual board image before writing any rendering code (see the overlay check — every circle landed on its printed space).
- No wooden-disc art asset exists in the project, so these are CSS-built tokens (wood-tone gradient + a center dot in the player's own color), not real art.

### Session 5 — strength tree recalibration (the discs really were misplaced)

You caught a real bug: the strength tree's coordinates from Session 4 were significantly off — a screenshot showed the disc sitting well away from "Start," near the unrelated "Leader" bonus icon. My original measurement process (eyeballing a small, scaled-down reference image) turned out to be unreliable at the precision this needed.

Re-measured properly this time: used iterative centroid convergence on the actual board art's dark hex-icon pixels (a small search window repeatedly re-centers itself on the darkest cluster it finds, self-correcting regardless of how far off the starting guess is), then — critically — verified the result by drawing the new coordinates back onto the real board image and confirming every single node (Start, both 5s, 12, both 18s, both 25s, both 32s, 38, both 45s, and the third bottom-center 45) visibly lands on its hex before touching any code. The root issue: my first pass had both an X and Y calibration error large enough (several percent) to miss hexes entirely, whereas this pass nails all 14 nodes.

Also re-checked the Influence track the same way while I was at it — it turned out to be correct (the P1 disc you can see on "3" in your screenshot really was accurate; what looked like a P2 discrepancy was a value of 7, not 8, correctly rendered — a data question, not a rendering bug). Applied only a small (<1%) refinement there since it was already close.

Added a regression check that verifies Start sits in the tree's own center column (matching 12/38) rather than drifting toward the sidebar — the specific failure mode this time.

### Session 6 — the influence track was ALSO miscalibrated (my Session 4/5 verification was insufficient)

You caught this one precisely: P1's disc (influence=3) was landing visibly left of the "3" label, and P2's (influence=8, from 3 base + 5 from a leader card — thanks for the exact math, that made this easy to pin down) was landing back around "6". Both of my previous two passes on this track relied on eyeballing a labeled grid overlay, which — as this proved — wasn't precise enough for coordinates this tight, the same lesson from the strength tree but I hadn't yet applied it here.

This time: auto-detected the actual white number-label pixels ("0", "3", "6", "9", "12") directly on the board art via image processing, clustered and averaged them (removing manual reading error entirely), and verified by drawing the result back onto the real board — all 5 rows × 13 positions land dead-center on their icons, and specifically re-checked the exact P1=3 / P2=8 scenario you reported before calling it fixed. Also confirms there's no separate influence-tracking bug — your P2 was correctly at 8 all along; the earlier broken coordinates just made it look like it wasn't.

New values: `baseX: 6.59, xStep: 2.17, baseYBottom: 74.96, yZigzag: 2.6, rowStep: 5.5` (previously 5.99/1.95/74.01/1.95/4.76 — off by enough to matter, especially cumulative across 12 positions).

Added a regression check locking in the exact reported scenario (value=8 must sit closer to "9" than "6").

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
- Commander tokens and the phase tracker are done. Still worth a pass on: giving the AI's turn a more polished "thinking" treatment beyond the current pulsing text.

### 4.2 Information architecture
- Card preview and board zoom still share the side panel — now that the log and action rail are popups instead of fixed panels, there's more headroom here if you want to enlarge these further or split them out too.

### 4.3 Extended game toggle
- Surface the 8-cube extended-game option as an actual setup checkbox if desired.

### 4.4 GitHub Pages readiness & final QA
- Cross-browser pass (Chrome/Firefox/Safari on desktop).
- Confirm relative asset paths continue to resolve under a GitHub Pages subpath (e.g. `username.github.io/repo-name/`) once actually hosted there.
- A live playtest end-to-end remains the best way to catch anything the test suite can't — jsdom doesn't compute animated CSS transforms or actual rendered positions, which is exactly how both the hex-highlight bug and the gear-card-hover bug slipped through automated testing and only showed up in real play.

---

## 5. What I'd like from you

1. Please check the influence track live in-game now, specifically the exact scenario you reported (a value like 3 and a value like 8) — I verified pixel-for-pixel against the board art this time rather than eyeballing, but a live check from you is still the real confirmation.
2. Take a fresh look at the strength tree discs too, from Session 5 — same "verify it actually looks right in the real game" ask.
3. Play a game through to an actual end (or force-trigger it) and check the score-breakdown popup — do the category labels and groupings make sense, or would you split/rename anything (e.g., should gear-passive VP like the Breastplate bonus be separate from held-gear VP, both currently under "Gear Treasures")?
4. Confirm the Master of Puppets fix (now strictly `>35` strength) is what you want — flag it if `>=35` was actually intentional.
5. Keep flagging anything that looks or feels off — I've clearly needed more than one pass on these board-position calibrations, so please don't hesitate to send another screenshot if something's still not right.

