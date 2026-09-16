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

    await new Promise(r => setTimeout(r, 200));

    console.log('\n--- window errors captured ---');
    errors.forEach(e => console.log(e));
    console.log('\nTOTAL ERRORS:', errors.length);
    process.exit(errors.length > 0 ? 1 : 0);
})();
