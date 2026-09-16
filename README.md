# Navu: Treasures of the Fallen — Browser Edition

A browser implementation of the Navu board game. Static HTML/CSS/JS — no
build step, no server required. Designed for desktop/laptop browsers.

## Running it

Just open `index.html` in a browser, or serve the folder with any static
file server (e.g. GitHub Pages, or `npx serve` locally). There's nothing to
build or install to play.

## Project structure

```
index.html
css/
  base.css       theme variables, resets, generic buttons
  layout.css     app shell (board area, player dock, side panel, action rail)
                 + desktop-width responsive rules
  board.css      the board, location hotspots, hex grid, commander tokens
  cards.css      card containers and card interactive states
  dialogs.css    in-game choice overlay + themed alert/confirm replacement
js/
  data/          static game data (cards.js, gameState.js, personalities.js)
  core/          rules engine (engine.js, choiceResolver.js)
  ai/            AI opponent logic (aiEngine.js, turnController.js)
  ui/            rendering + the themed dialogs.js module
  main.js        entry point
assets/          board/card/token artwork
smoketest.js     optional headless regression check (see below)
```

Scripts are loaded as plain `<script>` tags in dependency order (data → core
→ ai → ui → main) — there's no bundler or module system, by design, to keep
this simple to host and edit.

## Themed dialogs

Every `alert()`/`confirm()` in the game has been replaced by `Dialogs`
(`js/ui/dialogs.js`), which renders a styled modal matching the game's
look instead of a native browser dialog. If you add new confirmations,
use `await Dialogs.confirm(...)` (it's promise-based, so the calling
function needs to be `async`) or `Dialogs.alert(...)`.

## Optional smoke test

`smoketest.js` loads `index.html` in a headless DOM (via `jsdom`) and runs
through a full game sequence — starting a game, resolving starting choices,
placing commanders, forcing the "Select Action Color" modal, advancing
phases, and completing a raid — to catch obvious regressions before you
push changes.

```
npm install
npm test
```

This is optional tooling for development; it has no effect on how the game
is played or hosted.

## Scope note

This codebase intentionally keeps all game *rules* untouched — costs,
rewards, thresholds, win conditions, etc. all match the rulebook exactly.
Changes here are limited to structure, presentation, and fixing bugs where
the code didn't actually do what it was supposed to (see git history /
commit messages for specifics).
