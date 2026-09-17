const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const errors = [];

(async () => {
    const dom = new JSDOM(html, {
        url: 'file://' + __dirname + '/index.html',
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        beforeParse(window) {
            window.addEventListener('error', (e) => {
                errors.push('window error: ' + (e.error ? (e.error.stack || e.error.message) : e.message));
            });
            // stub out things jsdom can't do / that we don't need for a logic smoke test
            window.alert = (msg) => console.log('[native alert suppressed]', msg);
            window.confirm = (msg) => { console.log('[native confirm suppressed -> true]', msg); return true; };
        }
    });

    const window = dom.window;

    // Let all <script> tags execute
    await new Promise((resolve) => {
        window.document.addEventListener('DOMContentLoaded', () => setTimeout(resolve, 50));
    });

    async function check(label, fn) {
        try {
            await fn();
            console.log('OK   -', label);
        } catch (e) {
            console.log('FAIL -', label, '->', e.message);
            errors.push(label + ': ' + e.stack);
        }
    }

    await check('GameEngine exists', () => { if (!window.gameEngine) throw new Error('missing'); });
    await check('Dialogs exists', () => { if (!window.Dialogs) throw new Error('missing'); });
    await check('resolveCommanderAction is a function (regression check for the fixed bug)', () => {
        if (typeof window.gameEngine.resolveCommanderAction !== 'function') throw new Error('still missing!');
    });

    await check('startGame(2) runs without throwing', () => {
        window.gameEngine.startGame(2);
    });

    await check('players were created', () => {
        if (window.eval('GameState').players.length !== 2) throw new Error('expected 2 players, got ' + window.eval('GameState').players.length);
    });

    // Resolve starting officer/raid choices for player 0 if pending, to get into real gameplay
    await check('can select a starting officer if offered', () => {
        const p0 = window.eval('GameState').players[0];
        if (p0.startingOfficersChoice && p0.startingOfficersChoice.length > 0) {
            window.gameEngine.selectStartingOfficer(p0.startingOfficersChoice[0].id, 0);
        }
    });

    await check('can select a starting raid if offered', () => {
        const p0 = window.eval('GameState').players[0];
        if (p0.startingRaidsChoice && p0.startingRaidsChoice.length > 0) {
            window.gameEngine.selectStartingRaid(p0.startingRaidsChoice[0].id, 0);
        }
    });

    // Drive several placements across both players, deliberately trying to hit a White
    // commander (which was the exact path that used to throw on the missing
    // resolveCommanderAction function) or an activate-then-place combo.
    await check('can place a commander (Phase 2) for current player', () => {
        window.eval('GameState').turn.phase = 'place';
        const locIds = Object.keys(window.eval('GameState').board.locations);
        window.gameEngine.placeCommander(locIds[0]);
    });

    await check('no pendingChoice of type commanderAction is stuck unresolved after placement', () => {
        // If a commanderAction choice appeared (White commander / matching activated gear),
        // resolve it now via the exact path the UI buttons use, to confirm it doesn't throw.
        const pc = window.eval('GameState').turn.pendingChoice;
        if (pc && pc.type === 'commanderAction') {
            window.gameEngine.resolveCommanderAction('Black');
        }
    });

    // Force a White-commander scenario directly to specifically re-trigger the original bug path
    await check('directly forcing a White commander action color choice resolves without throwing', () => {
        window.eval('GameState').turn.pendingChoice = {
            type: 'commanderAction',
            context: { locId: 'loc-influence', gearId: null }
        };
        window.gameEngine.resolveCommanderAction('Blue');
    });

    await check('nextPhase can advance through activate -> place -> turnin -> next player', () => {
        window.eval('GameState').turn.phase = 'activate';
        window.gameEngine.nextPhase(); // -> place
        window.gameEngine.nextPhase(); // -> turnin
        window.gameEngine.nextPhase(); // -> next player's activate
    });

    await check('completeRaid (now async) can be invoked without throwing synchronously', async () => {
        const p0 = window.eval('GameState').players[0];
        // Give player 0 a raid in hand plus enough of everything to complete it, to
        // exercise the async confirm-dialog code path end-to-end.
        const raid = window.eval('GameCards').raids[0];
        p0.raidsInHand.push(JSON.parse(JSON.stringify(raid)));
        p0.resources = { yellow: 20, blue: 20, red: 20, green: 20 };
        p0.gear = [{ id: 'gear_cape', basicStrength: 99, upgradedStrength: 99, basicVP: 2, upgradedVP: 3, upgraded: false }];
        window.eval('GameState').turn.currentPlayerIndex = 0;
        await window.gameEngine.completeRaid(raid.id);
    });

    await check('phase tracker renders 3 steps with a current one highlighted', () => {
        window.eval('GameState').turn.phase = 'place';
        window.gameUI.renderPhaseInfo();
        const doc = window.document;
        const steps = doc.querySelectorAll('#phase-tracker-h .phase-step');
        if (steps.length !== 3) throw new Error('expected 3 steps, got ' + steps.length);
        const current = doc.querySelectorAll('#phase-tracker-h .phase-step.is-current');
        if (current.length !== 1) throw new Error('expected exactly 1 current step, got ' + current.length);
    });

    await check('commanderAction modal renders themed per-color buttons (regression check for the res-b collision bug)', () => {
        window.eval('GameState').turn.pendingChoice = {
            type: 'commanderAction',
            context: { locId: 'loc-influence', gearId: null }
        };
        window.gameUI.renderFullState();
        const doc = window.document;
        const btns = doc.querySelectorAll('#choice-overlay .choice-color-btn');
        if (btns.length !== 6) throw new Error('expected 6 color buttons, got ' + btns.length);
        const classes = Array.from(btns).map(b => b.className);
        ['cmd-purple', 'cmd-black', 'cmd-red', 'cmd-yellow', 'cmd-blue', 'cmd-green'].forEach(cls => {
            if (!classes.some(c => c.includes(cls))) throw new Error('missing expected class ' + cls);
        });
        window.eval('GameState').turn.pendingChoice = null;
    });

    await check('favorSelect modal renders without throwing and uses themed classes', () => {
        window.eval('GameState').turn.pendingChoice = {
            type: 'favorSelect',
            context: {
                putBackOnTop: true,
                capeUpgraded: false,
                options: window.eval('GameCards').favorCards.slice(0, 2)
            }
        };
        window.gameUI.renderFullState();
        const doc = window.document;
        const cards = doc.querySelectorAll('#choice-overlay .favor-select-card');
        if (cards.length !== 2) throw new Error('expected 2 favor cards, got ' + cards.length);
        window.eval('GameState').turn.pendingChoice = null;
    });

    await check('strengthReward (threshold 45) modal renders 3 gold buttons', () => {
        window.eval('GameState').turn.pendingChoice = {
            type: 'strengthReward',
            threshold: 45,
            context: { message: 'test' }
        };
        window.gameUI.renderFullState();
        const doc = window.document;
        const btns = doc.querySelectorAll('#choice-overlay .btn-gold.btn-gold-compact');
        if (btns.length !== 3) throw new Error('expected 3 buttons, got ' + btns.length);
        window.eval('GameState').turn.pendingChoice = null;
    });

    await check('leader rank conflict: acquiring a 2nd Colonel prompts a swap choice instead of duplicating', () => {
        const GameState = window.eval('GameState');
        const GameCards = window.eval('GameCards');
        const cp = GameState.players[0];
        cp.leaders = [];
        cp.faceDownLeaders = [];
        const colonelCards = GameCards.leaders.filter(l => l.rank === 'Colonel');
        window.gameEngine.grantLeaderCard(cp, JSON.parse(JSON.stringify(colonelCards[0])));
        if (cp.leaders.length !== 1) throw new Error('expected 1 leader after first grant, got ' + cp.leaders.length);

        window.gameEngine.grantLeaderCard(cp, JSON.parse(JSON.stringify(colonelCards[1])));
        const pc = GameState.turn.pendingChoice;
        if (!pc || pc.type !== 'leaderRankConflict') throw new Error('expected a leaderRankConflict pendingChoice, got ' + JSON.stringify(pc));
        if (cp.leaders.length !== 1) throw new Error('should NOT have 2 active Colonels while the choice is pending, got ' + cp.leaders.length);

        // Resolve: keep the new one
        window.gameEngine.resolveLeaderRankConflict(true);
        if (cp.leaders.length !== 1) throw new Error('expected exactly 1 active Colonel after resolving, got ' + cp.leaders.length);
        if (cp.leaders[0].id !== colonelCards[1].id) throw new Error('expected the new Colonel to be active');
        if (cp.faceDownLeaders.length !== 1 || cp.faceDownLeaders[0].id !== colonelCards[0].id) {
            throw new Error('expected the old Colonel to be face-down, got ' + JSON.stringify(cp.faceDownLeaders));
        }
    });

    await check('AI leader rank conflict auto-resolves without leaving a stuck pendingChoice', () => {
        const GameState = window.eval('GameState');
        const GameCards = window.eval('GameCards');
        // player 1 is AI in a 1-human-vs-1-AI-ish setup? our test used startGame(2) (2 humans).
        // Force an AI flag temporarily to exercise the AI branch of grantLeaderCard — needs a
        // matching aiPersonality object too, since renderPlayerDock reads cp.aiPersonality.name
        // whenever isAI is true (real startGame() always sets both together).
        const p = GameState.players[1];
        const wasAI = p.isAI;
        const wasPersonality = p.aiPersonality;
        p.isAI = true;
        p.aiPersonality = { name: 'Test AI', description: 'test' };
        p.leaders = [];
        p.faceDownLeaders = [];
        try {
            const ltCards = GameCards.leaders.filter(l => l.rank === 'Lieutenant');
            window.gameEngine.grantLeaderCard(p, JSON.parse(JSON.stringify(ltCards[0])));
            window.gameEngine.grantLeaderCard(p, JSON.parse(JSON.stringify(ltCards[1])));
            if (GameState.turn.pendingChoice && GameState.turn.pendingChoice.type === 'leaderRankConflict') {
                throw new Error('AI should auto-resolve the swap, not leave a pendingChoice');
            }
            if (p.leaders.length !== 1) throw new Error('AI should still end up with exactly 1 active Lieutenant, got ' + p.leaders.length);
        } finally {
            p.isAI = wasAI;
            p.aiPersonality = wasPersonality;
        }
    });

    await check('Land of Theos hex scoring: strength breaks a cube-count tie, and a double-tie awards no VP', () => {
        const GameState = window.eval('GameState');
        // Set up a clean 2-cube tie on one hex, with player 0 having higher strength.
        // Also clear completedRaids/treasures for both players — calculateFinalScores
        // also scores end-game raid-set bonuses and unspent treasures each time it
        // runs, and this test isn't isolated from earlier tests' state otherwise
        // (this was the real cause of an earlier intermittent failure here — not the
        // hex-scoring logic itself, but leftover completedRaids/treasures inflating
        // the VP delta unpredictably).
        GameState.board.placedMarkers = [
            { hexId: 'hex-k1', playerIndex: 0 },
            { hexId: 'hex-k1', playerIndex: 1 }
        ];
        GameState.players[0].gear = [{ id: 'gear_test', upgraded: false, basicStrength: 10, upgradedStrength: 10, basicVP: 0, upgradedVP: 0 }];
        GameState.players[1].gear = [];
        GameState.players[0].faceDownLeaders = [];
        GameState.players[1].faceDownLeaders = [];
        GameState.players[0].leaders = [];
        GameState.players[1].leaders = [];
        GameState.players[0].completedRaids = [];
        GameState.players[1].completedRaids = [];
        GameState.players[0].treasures = 0;
        GameState.players[1].treasures = 0;
        const vpBefore0 = GameState.players[0].vp;
        const vpBefore1 = GameState.players[1].vp;
        window.gameEngine.calculateFinalScores();
        const k1vp = 6; // hex-k1 is a 6-VP Kingdom hex per gameState.js
        if (GameState.players[0].vp !== vpBefore0 + k1vp) throw new Error('expected player 0 (higher strength) to win the tie and score ' + k1vp + ' VP, got delta ' + (GameState.players[0].vp - vpBefore0));
        if (GameState.players[1].vp !== vpBefore1) throw new Error('expected player 1 to score nothing on this hex');

        // Now make it a double-tie (equal strength too) on a fresh hex — nobody should score.
        // Reset the gameOver idempotency guard between these two calculateFinalScores()
        // calls — the guard means a second call is normally a no-op by design (see the
        // dedicated idempotency test below), which would otherwise make this second
        // assertion pass for the wrong reason (nothing ran) rather than actually
        // re-testing the double-tie-awards-no-VP logic.
        GameState.settings.gameOver = false;
        GameState.board.placedMarkers = [
            { hexId: 'hex-t6', playerIndex: 0 },
            { hexId: 'hex-t6', playerIndex: 1 }
        ];
        GameState.players[0].gear = [];
        GameState.players[0].completedRaids = [];
        GameState.players[1].completedRaids = [];
        GameState.players[0].treasures = 0;
        GameState.players[1].treasures = 0;
        const vp0 = GameState.players[0].vp, vp1 = GameState.players[1].vp;
        window.gameEngine.calculateFinalScores();
        if (GameState.players[0].vp !== vp0 || GameState.players[1].vp !== vp1) {
            throw new Error('expected no VP awarded on a full tie (cubes AND strength)');
        }
        GameState.settings.gameOver = false; // leave it reset for later tests too
    });

    await check('General Kirk cube-move: full flow moves an opponent cube to an adjacent hex', () => {
        const GameState = window.eval('GameState');
        const GameCards = window.eval('GameCards');
        const cp = GameState.players[0];
        cp.leaders = [JSON.parse(JSON.stringify(GameCards.leaders.find(l => l.id === 'gen_kirk')))];
        cp.resources = { yellow: 5, blue: 5, red: 5, green: 5 };
        GameState.board.placedMarkers = [{ hexId: 'hex-k1', playerIndex: 1 }];
        GameState.turn.currentPlayerIndex = 0;

        GameState.turn.pendingChoice = {
            type: 'kirkSelectCubeSource',
            context: { message: 'test', afterRaidType: 'Kingdom' }
        };
        window.gameEngine.resolveKirkCubeSource('hex-k1');
        const pc = GameState.turn.pendingChoice;
        if (!pc || pc.type !== 'kirkSelectCubeDest') throw new Error('expected kirkSelectCubeDest after picking the source hex, got ' + JSON.stringify(pc));

        const validDest = window.eval('GameEngine').HEX_ADJACENCY['hex-k1'][0];
        window.gameEngine.resolveKirkCubeDest(validDest);

        const moved = GameState.board.placedMarkers.find(m => m.playerIndex === 1);
        if (!moved || moved.hexId !== validDest) throw new Error('expected the opponent cube to have moved to ' + validDest + ', markers: ' + JSON.stringify(GameState.board.placedMarkers));

        const finalPc = GameState.turn.pendingChoice;
        if (!finalPc || finalPc.type !== 'hexPlacement') throw new Error('expected the flow to proceed to hexPlacement afterward, got ' + JSON.stringify(finalPc));
    });

    await check('player scoreboard shows each player\'s commanders-in-hand as color-coded tokens', () => {
        const GameState = window.eval('GameState');
        GameState.players[0].commanders = ['Black', 'Purple'];
        window.gameUI.renderFullState();
        const doc = window.document;
        const rows = doc.querySelectorAll('#player-dock .player-score-row');
        if (rows.length === 0) throw new Error('expected player scoreboard rows to render');
        const dots = rows[0].querySelectorAll('.player-score-commanders .commander-mini');
        if (dots.length !== 2) throw new Error('expected 2 commander-mini tokens for player 0, got ' + dots.length);
        if (!dots[0].className.includes('cmd-black')) throw new Error('expected first token to be cmd-black, got ' + dots[0].className);
        if (!dots[1].className.includes('cmd-purple')) throw new Error('expected second token to be cmd-purple, got ' + dots[1].className);
    });

    await check('hex valid-choice highlight uses the translate-preserving pulse animation (regression check for the squished-hex bug)', () => {
        const boardCss = fs.readFileSync(path.join(__dirname, 'css', 'board.css'), 'utf8');
        const ruleMatch = boardCss.match(/\.hex-segment\.valid-choice\s*\{[^}]*\}/);
        if (!ruleMatch) throw new Error('.hex-segment.valid-choice rule not found in css/board.css');
        const rule = ruleMatch[0];
        if (!/animation:\s*gold-pulse-board/.test(rule)) {
            throw new Error('.hex-segment.valid-choice must animate with gold-pulse-board (which preserves translate(-50%,-50%)), not plain gold-pulse — got: ' + rule);
        }
    });

    await check('selectable-card hover has no transform (regression check for the shooting-off gear card bug)', () => {
        const cardsCss = fs.readFileSync(path.join(__dirname, 'css', 'cards.css'), 'utf8');
        const hoverMatch = cardsCss.match(/\.selectable-card:hover\s*\{[^}]*\}/);
        if (!hoverMatch) throw new Error('.selectable-card:hover rule not found in css/cards.css');
        if (/transform\s*:/.test(hoverMatch[0])) {
            throw new Error('.selectable-card:hover must not set transform — board-positioned cards rely on an inline translate(-50%,-50%) for their position, and any transform here (scale, etc) replaces rather than adds to it, making the card jump on hover. Got: ' + hoverMatch[0]);
        }
        if (!/@keyframes gold-glow-pulse/.test(cardsCss)) {
            throw new Error('expected the transform-free gold-glow-pulse animation to still be defined in css/cards.css');
        }
    });

    await check('favor deck visual renders with a live remaining-count badge', () => {
        const GameState = window.eval('GameState');
        window.gameUI.renderBoard();
        const doc = window.document;
        const deckEl = doc.querySelector('#loc-favors .favor-deck-visual');
        if (!deckEl) throw new Error('expected a .favor-deck-visual element inside #loc-favors');
        const expectedCount = String(GameState.board.decks.favors.length);
        if (deckEl.textContent !== expectedCount) {
            throw new Error('expected deck badge to show ' + expectedCount + ', got ' + deckEl.textContent);
        }
    });

    await check('influence track disc appears at the correct zigzag position for each player', () => {
        const GameState = window.eval('GameState');
        GameState.players[0].influence = 6; // even -> should sit on the LOWER zigzag line
        GameState.players[1].influence = 9; // odd -> should sit on the UPPER zigzag line
        window.gameUI.renderInfluenceTrack();
        const doc = window.document;
        const discs = doc.querySelectorAll('#influence-track .track-disc');
        if (discs.length !== GameState.players.length) throw new Error('expected ' + GameState.players.length + ' discs, got ' + discs.length);
        const p0 = window.gameUI._getInfluencePos(6, 0);
        const p1 = window.gameUI._getInfluencePos(9, 1);
        if (Math.abs(p0.y - p1.y) < 0.5) throw new Error('expected different rows to have different Y positions');
        // even position should be lower (larger %) than the odd position within the SAME row
        const evenPos = window.gameUI._getInfluencePos(6, 0);
        const oddPos = window.gameUI._getInfluencePos(7, 0);
        if (!(oddPos.y < evenPos.y)) throw new Error('expected odd position to sit higher (smaller %) than even position on the same row');
    });

    await check('strength track disc snaps to the correct tree node for a given strength value', () => {
        const belowFive = window.gameUI._getStrengthPos(3, 0);
        const atStart = window.gameUI.STRENGTH_TREE_NODES.find(n => n.value === 0);
        if (belowFive.x !== atStart.x || belowFive.y !== atStart.y) throw new Error('strength 3 should sit at the Start node');

        const at20 = window.gameUI._getStrengthPos(20, 0);
        const node18 = window.gameUI.STRENGTH_TREE_NODES.filter(n => n.value === 18);
        if (!node18.some(n => n.x === at20.x && n.y === at20.y)) throw new Error('strength 20 should snap down to the 18 tier, not round up to 25');

        const atMax = window.gameUI._getStrengthPos(99, 0);
        const node45 = window.gameUI.STRENGTH_TREE_NODES.filter(n => n.value === 45);
        if (!node45.some(n => n.x === atMax.x && n.y === atMax.y)) throw new Error('strength above 45 should still snap to the 45 tier (the max)');

        window.gameUI.renderStrengthTrack();
        const doc = window.document;
        const discs = doc.querySelectorAll('#strength-track .track-disc');
        if (discs.length !== window.eval('GameState').players.length) throw new Error('expected one strength disc per player');
    });

    await check('calculateFinalScores is idempotent — a second call after gameOver is a no-op', () => {
        const GameState = window.eval('GameState');
        GameState.settings.gameOver = false;
        GameState.board.placedMarkers = [{ hexId: 'hex-k1', playerIndex: 0 }];
        window.gameEngine.calculateFinalScores();
        if (!GameState.settings.gameOver) throw new Error('expected gameOver to be set true after calculateFinalScores runs');
        const vpAfterFirst = GameState.players[0].vp;
        window.gameEngine.calculateFinalScores(); // should be a no-op now
        if (GameState.players[0].vp !== vpAfterFirst) throw new Error('expected a second calculateFinalScores call to change nothing (double-scoring bug)');
        GameState.settings.gameOver = false; // reset for later tests
    });

    await check('placeCommander/nextPhase/completeRaid all refuse to act once gameOver is set', async () => {
        const GameState = window.eval('GameState');
        GameState.settings.gameOver = true;
        const phaseBefore = GameState.turn.phase;
        window.gameEngine.nextPhase();
        if (GameState.turn.phase !== phaseBefore) throw new Error('nextPhase should not advance once gameOver is set');

        const boardBefore = JSON.stringify(GameState.board.locations);
        window.gameEngine.placeCommander(Object.keys(GameState.board.locations)[0]);
        if (JSON.stringify(GameState.board.locations) !== boardBefore) throw new Error('placeCommander should not place once gameOver is set');

        const vpBefore = GameState.players[0].vp;
        await window.gameEngine.completeRaid('nonexistent-raid-id-anyway');
        if (GameState.players[0].vp !== vpBefore) throw new Error('completeRaid should not run once gameOver is set');

        GameState.settings.gameOver = false; // reset for later tests
    });

    await check("VP breakdown tracks category totals that sum to the player's total VP", () => {
        const GameState = window.eval('GameState');
        const p = GameState.players[0];
        p.vp = 0;
        p.vpBreakdown = { raids: 0, gear: 0, treasures: 0, theos: 0, endGameBonus: 0 };
        p.gear = [{ id: 'gt', upgraded: false, basicStrength: 5, upgradedStrength: 5, basicVP: 3, upgradedVP: 3 }];
        p.treasures = 4;
        p.completedRaids = [];
        p.faceDownLeaders = [];
        p.leaders = [];
        GameState.board.placedMarkers = [{ hexId: 'hex-v2', playerIndex: 0 }]; // sole marker -> uncontested win
        GameState.settings.gameOver = false;
        window.gameEngine.calculateFinalScores();
        const sum = p.vpBreakdown.raids + p.vpBreakdown.gear + p.vpBreakdown.treasures + p.vpBreakdown.theos + p.vpBreakdown.endGameBonus;
        if (sum !== p.vp) throw new Error('expected vpBreakdown categories (' + sum + ') to sum to cp.vp (' + p.vp + ')');
        if (p.vpBreakdown.gear !== 3) throw new Error('expected 3 VP tracked under gear, got ' + p.vpBreakdown.gear);
        if (p.vpBreakdown.treasures !== 4) throw new Error('expected 4 VP tracked under treasures, got ' + p.vpBreakdown.treasures);
        GameState.settings.gameOver = false; // reset for later tests
    });

    await check('game-over popup renders a breakdown section per player', () => {
        const GameState = window.eval('GameState');
        const scores = GameState.players.map(p => ({ name: p.name, vp: p.vp, breakdown: p.vpBreakdown }));
        scores.sort((a, b) => b.vp - a.vp);
        window.Dialogs.showGameOver(scores);
        const doc = window.document;
        const blocks = doc.querySelectorAll('.game-over-player');
        if (blocks.length !== GameState.players.length) throw new Error('expected one breakdown block per player, got ' + blocks.length);
        const firstBlockRows = blocks[0].querySelectorAll('.game-over-breakdown li');
        if (firstBlockRows.length !== 5) throw new Error('expected 5 category rows per player, got ' + firstBlockRows.length);
        if (!blocks[0].classList.contains('winner')) throw new Error('expected the first (highest-VP) block to be marked as winner');
    });

    await check('strength tree Start node is well-clear of the "Leader" bonus icon area (regression check for the mis-calibrated tree)', () => {
        // The very first calibration of this tree had Start's x around 83%, which
        // turned out (confirmed against a real screenshot) to land off the hex
        // entirely, near the unrelated "Leader" bonus icon to its left. Start's
        // real position sits in the tree's own center column, matching 12/38/45B.
        const nodes = window.gameUI.STRENGTH_TREE_NODES;
        const start = nodes.find(n => n.value === 0);
        const n12 = nodes.find(n => n.value === 12);
        const n38 = nodes.find(n => n.value === 38);
        if (Math.abs(start.x - n12.x) > 0.5) throw new Error("Start should share the center column's x with 12, got Start.x=" + start.x + " vs 12.x=" + n12.x);
        if (Math.abs(start.x - n38.x) > 0.5) throw new Error("Start should share the center column's x with 38, got Start.x=" + start.x + " vs 38.x=" + n38.x);
        if (start.y >= n12.y) throw new Error('Start should sit above (smaller y than) 12 in the tree');
    });

    await check('influence disc for value=8 sits near "9" not "6" (regression check for the mis-calibrated track)', () => {
        // Two earlier calibration passes were both off (confirmed by user screenshots:
        // P1 at influence=3 rendered left of the "3" label; P2 at influence=8 rendered
        // looking like it was near "6"). Re-measured by auto-detecting the actual white
        // number-label pixels on the board art. Lock in the specific reported scenario.
        const pos3 = window.gameUI._getInfluencePos(3, 0);
        const pos6 = window.gameUI._getInfluencePos(6, 0);
        const pos8 = window.gameUI._getInfluencePos(8, 0);
        const pos9 = window.gameUI._getInfluencePos(9, 0);
        if (Math.abs(pos8.x - pos9.x) >= Math.abs(pos8.x - pos6.x)) {
            throw new Error("value=8 should sit closer to value=9's x than value=6's x");
        }
        if (pos3.y >= window.gameUI._getInfluencePos(0, 0).y) {
            throw new Error('value=3 (odd) should sit higher (smaller y) than value=0 (even) on the same row');
        }
    });

    await new Promise(r => setTimeout(r, 200));

    console.log('\n--- window errors captured ---');
    errors.forEach(e => console.log(e));
    console.log('\nTOTAL ERRORS:', errors.length);
    process.exit(errors.length > 0 ? 1 : 0);
})();
