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

    function check(label, fn) {
        try {
            fn();
            console.log('OK   -', label);
        } catch (e) {
            console.log('FAIL -', label, '->', e.message);
            errors.push(label + ': ' + e.stack);
        }
    }

    check('GameEngine exists', () => { if (!window.gameEngine) throw new Error('missing'); });
    check('Dialogs exists', () => { if (!window.Dialogs) throw new Error('missing'); });
    check('resolveCommanderAction is a function (regression check for the fixed bug)', () => {
        if (typeof window.gameEngine.resolveCommanderAction !== 'function') throw new Error('still missing!');
    });

    check('startGame(2) runs without throwing', () => {
        window.gameEngine.startGame(2);
    });

    check('players were created', () => {
        if (window.eval('GameState').players.length !== 2) throw new Error('expected 2 players, got ' + window.eval('GameState').players.length);
    });

    // Resolve starting officer/raid choices for player 0 if pending, to get into real gameplay
    check('can select a starting officer if offered', () => {
        const p0 = window.eval('GameState').players[0];
        if (p0.startingOfficersChoice && p0.startingOfficersChoice.length > 0) {
            window.gameEngine.selectStartingOfficer(p0.startingOfficersChoice[0].id, 0);
        }
    });

    check('can select a starting raid if offered', () => {
        const p0 = window.eval('GameState').players[0];
        if (p0.startingRaidsChoice && p0.startingRaidsChoice.length > 0) {
            window.gameEngine.selectStartingRaid(p0.startingRaidsChoice[0].id, 0);
        }
    });

    // Drive several placements across both players, deliberately trying to hit a White
    // commander (which was the exact path that used to throw on the missing
    // resolveCommanderAction function) or an activate-then-place combo.
    check('can place a commander (Phase 2) for current player', () => {
        window.eval('GameState').turn.phase = 'place';
        const locIds = Object.keys(window.eval('GameState').board.locations);
        window.gameEngine.placeCommander(locIds[0]);
    });

    check('no pendingChoice of type commanderAction is stuck unresolved after placement', () => {
        // If a commanderAction choice appeared (White commander / matching activated gear),
        // resolve it now via the exact path the UI buttons use, to confirm it doesn't throw.
        const pc = window.eval('GameState').turn.pendingChoice;
        if (pc && pc.type === 'commanderAction') {
            window.gameEngine.resolveCommanderAction('Black');
        }
    });

    // Force a White-commander scenario directly to specifically re-trigger the original bug path
    check('directly forcing a White commander action color choice resolves without throwing', () => {
        window.eval('GameState').turn.pendingChoice = {
            type: 'commanderAction',
            context: { locId: 'loc-influence', gearId: null }
        };
        window.gameEngine.resolveCommanderAction('Blue');
    });

    check('nextPhase can advance through activate -> place -> turnin -> next player', () => {
        window.eval('GameState').turn.phase = 'activate';
        window.gameEngine.nextPhase(); // -> place
        window.gameEngine.nextPhase(); // -> turnin
        window.gameEngine.nextPhase(); // -> next player's activate
    });

    check('completeRaid (now async) can be invoked without throwing synchronously', async () => {
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

    check('phase tracker renders 3 steps with a current one highlighted', () => {
        window.eval('GameState').turn.phase = 'place';
        window.gameUI.renderPhaseInfo();
        const doc = window.document;
        const steps = doc.querySelectorAll('#phase-tracker .phase-step');
        if (steps.length !== 3) throw new Error('expected 3 steps, got ' + steps.length);
        const current = doc.querySelectorAll('#phase-tracker .phase-step.is-current');
        if (current.length !== 1) throw new Error('expected exactly 1 current step, got ' + current.length);
    });

    check('commanderAction modal renders themed per-color buttons (regression check for the res-b collision bug)', () => {
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

    check('favorSelect modal renders without throwing and uses themed classes', () => {
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

    check('strengthReward (threshold 45) modal renders 3 gold buttons', () => {
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

    check('leader rank conflict: acquiring a 2nd Colonel prompts a swap choice instead of duplicating', () => {
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

    check('AI leader rank conflict auto-resolves without leaving a stuck pendingChoice', () => {
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

    check('Land of Theos hex scoring: strength breaks a cube-count tie, and a double-tie awards no VP', () => {
        const GameState = window.eval('GameState');
        // Set up a clean 2-cube tie on one hex, with player 0 having higher strength.
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
        const vpBefore0 = GameState.players[0].vp;
        const vpBefore1 = GameState.players[1].vp;
        window.gameEngine.calculateFinalScores();
        const hexK1 = window.eval('GameEngine').HEX_ADJACENCY ? null : null; // no-op, just referencing engine exists
        const hex = window.eval('GameEngine.LOCATION_REWARDS') ? null : null;
        const k1vp = 6; // hex-k1 is a 6-VP Kingdom hex per gameState.js
        if (GameState.players[0].vp !== vpBefore0 + k1vp) throw new Error('expected player 0 (higher strength) to win the tie and score ' + k1vp + ' VP');
        if (GameState.players[1].vp !== vpBefore1) throw new Error('expected player 1 to score nothing on this hex');

        // Now make it a double-tie (equal strength too) on a fresh hex — nobody should score.
        GameState.board.placedMarkers = [
            { hexId: 'hex-t6', playerIndex: 0 },
            { hexId: 'hex-t6', playerIndex: 1 }
        ];
        GameState.players[0].gear = [];
        const vp0 = GameState.players[0].vp, vp1 = GameState.players[1].vp;
        window.gameEngine.calculateFinalScores();
        if (GameState.players[0].vp !== vp0 || GameState.players[1].vp !== vp1) {
            throw new Error('expected no VP awarded on a full tie (cubes AND strength)');
        }
    });

    check('General Kirk cube-move: full flow moves an opponent cube to an adjacent hex', () => {
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

    check('player scoreboard shows each player\'s commanders-in-hand as color-coded tokens', () => {
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

    check('hex valid-choice highlight uses the translate-preserving pulse animation (regression check for the squished-hex bug)', () => {
        const boardCss = fs.readFileSync(path.join(__dirname, 'css', 'board.css'), 'utf8');
        const ruleMatch = boardCss.match(/\.hex-segment\.valid-choice\s*\{[^}]*\}/);
        if (!ruleMatch) throw new Error('.hex-segment.valid-choice rule not found in css/board.css');
        const rule = ruleMatch[0];
        if (!/animation:\s*gold-pulse-board/.test(rule)) {
            throw new Error('.hex-segment.valid-choice must animate with gold-pulse-board (which preserves translate(-50%,-50%)), not plain gold-pulse — got: ' + rule);
        }
    });

    await new Promise(r => setTimeout(r, 200));

    console.log('\n--- window errors captured ---');
    errors.forEach(e => console.log(e));
    console.log('\nTOTAL ERRORS:', errors.length);
    process.exit(errors.length > 0 ? 1 : 0);
})();
