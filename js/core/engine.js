const GameEngine = {

    // Utility to shuffle arrays
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    logEvent(message, isPhaseChange = false) {
        const entry = {
            text: message,
            isPhaseChange: isPhaseChange,
            timestamp: Date.now()
        };
        GameState.eventLog.push(entry);
        if (GameState.eventLog.length > 100) GameState.eventLog.shift();
        if (window.gameUI) window.gameUI.renderEventLog();
    },

    minimizeChoice() {
        const overlay = document.getElementById('choice-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    startGame(numPlayers, numAI = 0) {
        GameState.settings.numPlayers = numPlayers;
        GameState.settings.numAI = numAI;
        GameState.players = [];

        const totalPlayers = numPlayers + numAI;

        // Setup Players
        for (let i = 0; i < totalPlayers; i++) {
            const isAI = i >= numPlayers;
            const player = {
                id: i,
                name: isAI ? `AI ${i - numPlayers + 1}` : `Player ${i + 1}`,
                isAI: isAI,
                influence: 3,
                vp: 0,
                strength: 0,
                resources: {
                    yellow: 1,
                    blue: 1,
                    red: 1,
                    green: 0
                },
                gear: [],
                leaders: [],
                startingOfficersChoice: [],
                startingRaidsChoice: [],
                commanders: ['Black'],
                completedRaids: [],
                raidsInHand: [],
                favors: [],
                treasures: 0,
                usedGearLastTurn: [],
                strengthThresholdsClaimed: [],
                strengthPath: null,
                markersPlaced: 0,
                color: ['#dd2222', '#1090ee', '#22bb44', '#ffcc00', '#8a2be2'][i] || '#888888'
            };

            if (isAI) {
                // Assign random personality and difficulty
                const personalities = Object.values(window.AIPersonalities);
                player.aiPersonality = personalities[Math.floor(Math.random() * personalities.length)];
                player.aiDifficulty = window.AIDifficulty.MEDIUM;
            }

            GameState.players.push(player);
        }

        // Setup Decks
        GameState.board.decks.gear = this.shuffle([...GameCards.gear]);
        GameState.board.decks.raids = this.shuffle([...GameCards.raids]);
        GameState.board.decks.favors = this.shuffle([...GameCards.favorCards]);

        // Filter and shuffle leaders by rank
        let standardOfficers = this.shuffle(GameCards.leaders.filter(l => l.rank === 'Standard Officer'));
        GameState.board.decks.leaders.lieutenant = this.shuffle(GameCards.leaders.filter(l => l.rank === 'Lieutenant'));
        GameState.board.decks.leaders.colonel = this.shuffle(GameCards.leaders.filter(l => l.rank === 'Colonel'));
        GameState.board.decks.leaders.general = this.shuffle(GameCards.leaders.filter(l => l.rank === 'General'));

        // Deal Standard Officers to each player for starting choice
        for (let i = 0; i < totalPlayers; i++) {
            const count = Math.min(2, standardOfficers.length);
            for (let j = 0; j < count; j++) {
                GameState.players[i].startingOfficersChoice.push(standardOfficers.pop());
            }
        }

        // Deal Raid cards to each player for starting choice
        for (let i = 0; i < totalPlayers; i++) {
            const count = Math.min(2, GameState.board.decks.raids.length);
            for (let j = 0; j < count; j++) {
                GameState.players[i].startingRaidsChoice.push(GameState.board.decks.raids.pop());
            }
        }

        // Deal initial market: 5 gear, 3 raids
        for (let i = 0; i < 5; i++) {
            if (GameState.board.decks.gear.length > 0) GameState.board.market.gear.push(GameState.board.decks.gear.pop());
        }
        for (let i = 0; i < 3; i++) {
            if (GameState.board.decks.raids.length > 0) GameState.board.market.raids.push(GameState.board.decks.raids.pop());
        }

        // Deal initial 3 leaders
        if (GameState.board.decks.leaders.lieutenant.length > 0) GameState.board.market.leaders.lieutenant = GameState.board.decks.leaders.lieutenant.pop();
        if (GameState.board.decks.leaders.colonel.length > 0) GameState.board.market.leaders.colonel = GameState.board.decks.leaders.colonel.pop();
        if (GameState.board.decks.leaders.general.length > 0) GameState.board.market.leaders.general = GameState.board.decks.leaders.general.pop();
        
        // --- NEW: Automatically resolve AI starting choices ---
        this.resolveAIStartupChoices();

        GameState.turn.phase = 'activate';
        GameState.turn.currentPlayerIndex = 0;

        if (window.gameUI) {
            window.gameUI.renderFullState();
        }

        // Trigger AI if first player
        this.checkAITurn();
    },

    placeCommander(locId) {
        if (GameState.turn.phase !== 'place') return;

        const cp = GameState.players[GameState.turn.currentPlayerIndex];

        // --- NEW: Cost Check Before Placement ---
        const locConfig = this.LOCATION_REWARDS[locId];
        if (locConfig) {
            // Find the minimum cost for any commander at this location
            const costs = Object.values(locConfig).map(c => c.cost || 0);
            const minCost = Math.min(...costs);
            if (cp.influence < minCost) {
                if (window.gameUI && !cp.isAI) Dialogs.alert(`Not enough influence to visit this location! (Minimum ${minCost} needed)`);
                return;
            }
        }

        const bumpedColor = GameState.board.locations[locId];

        // --- BUMP MECHANIC ---
        // Get the color of the commander the player is placing
        const myColor = cp.commanders.shift(); // Remove the first available commander

        // Update board state with player's color
        GameState.board.locations[locId] = myColor;
        GameState.turn.lastPlacedLocationId = locId;
        GameState.turn.lastBumpedColor = bumpedColor; // Store for cancelation
        cp.lastLocationId = locId;

        this.logEvent(`${cp.name} placed a ${myColor} Commander on ${locId.replace('loc-', '').replace(/([A-Z])/g, ' $1')}.`);

        // Add the bumped color back to the player's hand (if it wasn't empty)
        if (bumpedColor) {
            cp.commanders.push(bumpedColor);
            this.logEvent(`${cp.name} bumped a ${bumpedColor} Commander back to hand.`);
        }

        // Trigger Reward (Collection) immediately
        this.resolveLocationReward(cp, locId);

        // Check for strength threshold rewards after placement/resolution
        this.checkStrengthThresholds(cp);

        // Move to next phase (skip collect, go to turnin)
        this.nextPhase();
    },

    checkStrengthThresholds(player) {
        if (!window.gameUI) return;
        const currentStrength = window.gameUI._calcStrength(player);
        const thresholds = [5, 12, 18, 25, 32, 38, 45];

        for (const t of thresholds) {
            if (currentStrength >= t && !player.strengthThresholdsClaimed.includes(t)) {
                // Found a new threshold reached
                this.triggerStrengthReward(player, t);
                return; // Only trigger one at a time, recursion/subsequent calls will handle the rest
            }
        }
    },

    triggerStrengthReward(player, threshold) {
        player.strengthThresholdsClaimed.push(threshold);
        const currentStrength = window.gameUI ? window.gameUI._calcStrength(player) : player.strength;

        if (player.isAI) {
            this.logEvent(`${player.name} (AI) reached strength ${threshold} and is auto-selecting a reward.`);
            const personality = player.aiPersonality;
            const choice = window.AIChoiceResolver.resolveStrengthReward({ threshold }, player, personality);
            
            if (threshold === 12 || threshold === 38) {
                this.resolveStrengthReward(threshold, 'gear', choice, player.id);
            } else {
                this.resolveStrengthReward(threshold, choice, null, player.id);
            }
            return;
        }

        GameState.turn.pendingChoice = {
            type: 'strengthReward',
            threshold: threshold,
            context: {
                message: `You have gotten stronger! Your strength has increased to ${currentStrength} please choose a reward!`
            }
        };

        this.logEvent(`${player.name} reached strength ${threshold} and triggered a reward!`);
        if (window.gameUI) window.gameUI.renderFullState();
    },

    modifyInfluence(player, amount) {
        player.influence = Math.min(player.influence + amount, 12);
    },

    LOCATION_REWARDS: {
        'loc-favors': {
            'Purple': { cost: 5, reward: { treasures: 1, cards: { type: 'favors', count: 1 } } },
            'Black': { cost: 6, reward: { cards: { type: 'favors', count: 1 } } },
            'Red': { cost: 6, reward: { cards: { type: 'favors', count: 1 } } },
            'Yellow': { cost: 6, reward: { cards: { type: 'favors', count: 1 } } },
            'Blue': { cost: 6, reward: { cards: { type: 'favors', count: 1 } } },
            'Green': { cost: 6, reward: { cards: { type: 'favors', count: 1 } } }
        },
        'loc-barracks': {
            'Purple': { cost: 1, reward: { treasures: 1, resources: { red: 2 } } },
            'Black': { cost: 0, reward: { resources: { red: 1 } } },
            'Red': { cost: 2, reward: { resources: { red: 3 } } },
            'Yellow': { cost: 0, reward: { resources: { red: 1 } } },
            'Blue': { cost: 0, reward: { resources: { red: 1 } } },
            'Green': { cost: 0, reward: { resources: { red: 1 } } }
        },
        'loc-archery': {
            'Purple': { cost: 1, reward: { treasures: 1, resources: { yellow: 2 } } },
            'Black': { cost: 0, reward: { resources: { yellow: 1 } } },
            'Red': { cost: 0, reward: { resources: { yellow: 1 } } },
            'Yellow': { cost: 2, reward: { resources: { yellow: 3 } } },
            'Blue': { cost: 0, reward: { resources: { yellow: 1 } } },
            'Green': { cost: 0, reward: { resources: { yellow: 1 } } }
        },
        'loc-docks': {
            'Purple': { cost: 1, reward: { treasures: 1, resources: { blue: 2 } } },
            'Black': { cost: 0, reward: { resources: { blue: 1 } } },
            'Red': { cost: 0, reward: { resources: { blue: 1 } } },
            'Yellow': { cost: 0, reward: { resources: { blue: 1 } } },
            'Blue': { cost: 2, reward: { resources: { blue: 3 } } },
            'Green': { cost: 0, reward: { resources: { blue: 1 } } }
        },
        'loc-assassins': {
            'Purple': { cost: 1, reward: { treasures: 1, resources: { green: 1 } } },
            'Black': { cost: 2, reward: { resources: { green: 1 } } },
            'Red': { cost: 2, reward: { resources: { green: 1 } } },
            'Yellow': { cost: 2, reward: { resources: { green: 1 } } },
            'Blue': { cost: 2, reward: { resources: { green: 1 } } },
            'Green': { cost: 3, reward: { resources: { green: 2 } } }
        },
        'loc-contractHall': {
            'Purple': { cost: 4, reward: { special: 'resourceSelect', count: 3 } },
            'Black': { cost: 4, reward: { special: 'resourceSelect', count: 3 } },
            'Red': { cost: 3, reward: { special: 'resourceSelect', count: 2 } },
            'Yellow': { cost: 3, reward: { special: 'resourceSelect', count: 2 } },
            'Blue': { cost: 3, reward: { special: 'resourceSelect', count: 2 } },
            'Green': { cost: 3, reward: { special: 'resourceSelect', count: 2 } }
        },
        'loc-influence': {
            'Purple': { cost: 0, reward: { treasures: 1, influence: 4 } },
            'Black': { cost: 0, reward: { influence: 5 } },
            'Red': { cost: 0, reward: { influence: 3 } },
            'Yellow': { cost: 0, reward: { influence: 3 } },
            'Blue': { cost: 0, reward: { influence: 3 } },
            'Green': { cost: 0, reward: { influence: 3 } }
        },
        'loc-raidOrders': {
            'Purple': { cost: 0, reward: { special: 'raidSelect', count: 2 } },
            'Black': { cost: 0, reward: { special: 'raidSelect', count: 1 } },
            'Red': { cost: 0, reward: { special: 'raidSelect', count: 1, influence: 2 } },
            'Yellow': { cost: 0, reward: { special: 'raidSelect', count: 1, influence: 2 } },
            'Blue': { cost: 0, reward: { special: 'raidSelect', count: 1, influence: 2 } },
            'Green': { cost: 0, reward: { special: 'raidSelect', count: 1 } }
        },
        'loc-commandCenter': {
            'Purple': { cost: 4, reward: { cards: { type: 'general', count: 1 } } },
            'Black': { cost: 3, reward: { cards: { type: 'colonel', count: 1 } } },
            'Red': { cost: 2, reward: { cards: { type: 'lieutenant', count: 1 } } },
            'Yellow': { cost: 2, reward: { cards: { type: 'lieutenant', count: 1 } } },
            'Blue': { cost: 2, reward: { cards: { type: 'lieutenant', count: 1 } } },
            'Green': { cost: 3, reward: { cards: { type: 'colonel', count: 1 } } }
        },
        'loc-blacksmith': {
            'Purple': { cost: 2, reward: { treasures: 1, special: 'gearUpgrade', count: 1 } },
            'Black': { cost: 2, reward: { special: 'gearUpgrade', count: 1 } },
            'Red': { cost: 2, reward: { special: 'gearUpgrade', count: 1 } },
            'Yellow': { cost: 2, reward: { special: 'gearUpgrade', count: 1 } },
            'Blue': { cost: 2, reward: { special: 'gearUpgrade', count: 1 } },
            'Green': { cost: 3, reward: { special: 'gearUpgrade', count: 2 } }
        },
        'loc-armory': {
            'Purple': { cost: 0, reward: { special: 'gearPurchase', cycle: true } },
            'Black': { cost: 0, reward: { special: 'gearPurchase', treasures: 2 } },
            'Red': { cost: 0, reward: { special: 'gearPurchase', discount: { red: 1 } } },
            'Yellow': { cost: 0, reward: { special: 'gearPurchase', discount: { yellow: 1 } } },
            'Blue': { cost: 0, reward: { special: 'gearPurchase', discount: { blue: 1 } } },
            'Green': { cost: 0, reward: { special: 'gearPurchase', discount: { influence: 2 } } }
        }
    },

    resolveLocationReward(player, locId) {
        const rewardData = this.LOCATION_REWARDS[locId];
        if (!rewardData) return;

        const commanderColor = GameState.board.locations[locId]; // The color of the commander just placed

        const gearColorMap = {
            'gear_bracers': 'Purple',
            'gear_shield': 'Black',
            'gear_axe': 'Red',
            'gear_bow': 'Yellow',
            'gear_short_sword': 'Blue',
            'gear_daggers': 'Green'
        };

        const triggeringGear = player.gear.find(g =>
            gearColorMap[g.id] === commanderColor &&
            GameState.turn.activatedGearIds.includes(g.id)
        );

        if (commanderColor === 'White' || triggeringGear) {
            GameState.turn.pendingChoice = {
                type: 'commanderAction',
                context: { locId, gearId: triggeringGear ? triggeringGear.id : null }
            };
            if (window.gameUI) window.gameUI.renderFullState();
            return;
        }
        // Auto-resolve based on the actual commander color
        this.executeLocationAction(player, locId, commanderColor);
    },

    cancelLocationAction() {
        if (GameState.turn.phase !== 'turnin') return; // Should be in 'turnin' if choice is pending (since nextPhase was called)
        
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        const locId = GameState.turn.lastPlacedLocationId;
        const placedColor = GameState.board.locations[locId];
        const bumpedColor = GameState.turn.lastBumpedColor;

        if (!locId || !placedColor) return;

        // Revert board
        GameState.board.locations[locId] = bumpedColor || null;

        // Revert player commanders
        // The placed commander was at the front of cp.commanders before shift, 
        // and the bumped one was pushed to the end of cp.commanders.
        if (bumpedColor) {
            const bumpedIdx = cp.commanders.indexOf(bumpedColor);
            if (bumpedIdx !== -1) cp.commanders.splice(bumpedIdx, 1);
        }
        cp.commanders.unshift(placedColor);

        // Clear state
        GameState.turn.pendingChoice = null;
        GameState.turn.lastPlacedLocationId = null;
        GameState.turn.lastBumpedColor = null;
        GameState.turn.phase = 'place';
        
        this.logEvent(`${cp.name} cancelled their action and took back their commander.`);
        if (window.gameUI) window.gameUI.renderFullState();
    },

    // Called when the player resolves a "Select Action Color" choice — i.e. they placed a
    // White commander (which can act as any color) or activated a gear item that lets them
    // use a different commander's color at this location. Restored: this used to be a second,
    // identically-named copy of executeLocationAction, which silently discarded this logic
    // (JS object literals keep only the last definition of a duplicate key) and left the
    // color-choice buttons in the UI calling a method that didn't exist at all.
    resolveCommanderAction(actionColor) {
        const validColors = ['Purple', 'Black', 'Red', 'Yellow', 'Blue', 'Green'];
        if (!validColors.includes(actionColor)) return;

        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        const context = GameState.turn.pendingChoice ? GameState.turn.pendingChoice.context : null;
        if (!context) return;

        GameState.turn.pendingChoice = null;

        // Upgraded Gear Bonus (Bracers/Weapons): +1 Treasure
        if (context.gearId) {
            const gear = cp.gear.find(g => g.id === context.gearId);
            if (gear && gear.upgraded) {
                cp.treasures += 1;
                this.logEvent(`${cp.name} gained +1 Treasure (Upgraded ${gear.name} bonus).`);
            }
        }

        // Upgraded Breastplate Bonus: +2 VP
        const breastplate = cp.gear.find(g => g.id === 'gear_breastplate');
        if (breastplate && breastplate.upgraded) {
            cp.vp += 2;
            this.logEvent(`${cp.name} gained +2 VP (Upgraded Breastplate bonus).`);
        }

        // --- Griffiths Passive (+3/2/1 Treasures based on Raid type) ---
        // This passive applies when a raid card is gained.
        // The context for this is not directly available here, as this function resolves commander actions.
        // This passive should be checked in applyLocationAction when a raid card is drawn.

        this.executeLocationAction(cp, context.locId, actionColor);
    },

    executeLocationAction(player, locId, actionColor) {
        const locConfig = this.LOCATION_REWARDS[locId];
        if (!locConfig) return;

        const config = JSON.parse(JSON.stringify(locConfig[actionColor])); // Deep copy to avoid mutating original config
        if (!config) {
            console.error(`Missing reward config for ${actionColor} at ${locId}`);
            return;
        }

        // --- PRE-COST PASSIVES (Colonels) ---
        let costModifier = 0;
        const colMap = {
            'col_kraus': ['Purple', 'Black'],
            'col_garnica': ['Red', 'Green'],
            'col_gardner': ['Yellow', 'Blue']
        };

        for (const leader of player.leaders) {
            if (colMap[leader.id] && colMap[leader.id].includes(actionColor)) {
                // These Colonels offer "-1 Influence OR Gain 1 Treasure"
                // For simplicity, we trigger a choice if they have at least 1 influence to spend
                if (player.influence > 0) {
                    GameState.turn.pendingChoice = {
                        type: 'passiveChoice',
                        context: {
                            leaderId: leader.id,
                            locId,
                            actionColor,
                            originalConfig: config, // Store for resolution
                            options: [
                                { label: '-1 Influence Cost', effect: { costDiscount: 1 } },
                                { label: '+1 Treasure', effect: { treasures: 1 } }
                            ]
                        }
                    };
                    if (window.gameUI) window.gameUI.renderFullState();
                    return; // Wait for choice
                } else {
                    // If they have 0 influence, they can only take the treasure.
                    // Automatically award it instead of presenting useless choice.
                    player.treasures += 1;
                    this.logEvent(`${player.name} gained +1 Treasure from passive (not enough influence for discount).`);
                    this.applyLocationAction(player, locId, actionColor, config);
                    return;
                }
            }
        }

        this.applyLocationAction(player, locId, actionColor, config);
    },

    applyLocationAction(player, locId, actionColor, config) {
        // Check Cost (Influence)
        if (player.influence < config.cost) {
            if (window.gameUI && !player.isAI) Dialogs.alert(`Not enough influence! Needed ${config.cost}, have ${player.influence}`);
            return;
        }

        player.influence -= config.cost;
        const reward = config.reward;

        // Apply Basic Rewards
        if (reward.treasures) {
            player.treasures += reward.treasures;
            this.logEvent(`${player.name} gained ${reward.treasures} Treasures.`);
        }
        if (reward.influence) {
            let amount = reward.influence;
            const breastplate = player.gear.find(g => g.id === 'gear_breastplate');
            if (breastplate && GameState.turn.activatedGearIds.includes(breastplate.id)) {
                amount += (breastplate.upgraded ? 3 : 2);
            }
            this.modifyInfluence(player, amount);
            this.logEvent(`${player.name} gained ${amount} Influence.`);
        }
        if (reward.resources) {
            const resEntries = Object.entries(reward.resources).filter(([k, v]) => v > 0);
            if (resEntries.length > 0) {
                const resNames = resEntries.map(([k, v]) => `${v} ${k}`).join(', ');
                this.logEvent(`${player.name} gained: ${resNames}`);
                for (const [res, val] of Object.entries(reward.resources)) {
                    player.resources[res] += val;
                }
            }
        }

        // Apply Cards
        if (reward.cards) {
            const type = reward.cards.type;
            const count = reward.cards.count;
            for (let i = 0; i < count; i++) {
                let card = null;
                if (type === 'favors') {
                    const genPol = player.leaders.find(l => l.id === 'gen_polasky');
                    // Cape gear: activated Cape allows looking at 1 extra favor card and choosing
                    const cape = player.gear.find(g => g.id === 'gear_cape' && GameState.turn.activatedGearIds.includes('gear_cape'));
                    const favCount = genPol ? 3 : (cape ? 2 : 1);
                    const capeUpgraded = cape && cape.upgraded;

                    if (GameState.board.decks.favors.length > 0) {
                        if (favCount > 1) {
                            const options = [];
                            for (let j = 0; j < Math.min(favCount, GameState.board.decks.favors.length); j++) {
                                options.push(GameState.board.decks.favors.pop());
                            }
                            GameState.turn.pendingChoice = {
                                type: 'favorSelect',
                                // putBackOnTop: Cape returns unselected to top; Gen. Polasky to bottom
                                context: { options, putBackOnTop: !!cape, capeUpgraded: !!capeUpgraded }
                            };
                        } else {
                            card = GameState.board.decks.favors.pop();
                            player.favors.push(card);
                            this.logEvent(`${player.name} gained a Favor card.`);
                        }
                    }
                }
                else if (['lieutenant', 'colonel', 'general'].includes(type)) {
                    // RANK PREREQUISITES
                    if (type === 'colonel') {
                        const hasLt = player.leaders.some(l => l.id && (l.id.startsWith('lt_') || l.type === 'lieutenant'));
                        if (!hasLt) {
                            const msg = `Cannot acquire a Colonel without a Lieutenant first!`;
                            if (!player.isAI) Dialogs.alert(msg);
                            else this.logEvent(`${player.name} (AI) failed rank check: ${msg}`);
                            // Refund influence
                            if (reward.cost && reward.cost.influence) player.influence += reward.cost.influence;
                            return;
                        }
                    }
                    if (type === 'general') {
                        const hasCol = player.leaders.some(l => l.id && (l.id.startsWith('col_') || l.type === 'colonel'));
                        if (!hasCol) {
                            const msg = `Cannot acquire a General without a Colonel first!`;
                            if (!player.isAI) Dialogs.alert(msg);
                            else this.logEvent(`${player.name} (AI) failed rank check: ${msg}`);
                            // Refund influence
                            if (reward.cost && reward.cost.influence) player.influence += reward.cost.influence;
                            return;
                        }
                    }

                    card = GameState.board.decks.leaders[type].pop();
                    if (card) {
                        player.leaders.push(card);
                        this.logEvent(`${player.name} acquired a ${type.charAt(0).toUpperCase() + type.slice(1)}: ${card.name}`);
                    }
                }
            }
        }

        // Trigger Special Overlays
        if (reward.special) {
            // Gauntlets Bonus: Cycle market when buying gear with ANY commander
            const gauntlets = player.gear.find(g => g.id === 'gear_gauntlets' && GameState.turn.activatedGearIds.includes('gear_gauntlets'));
            const canCycle = config.cycle || !!gauntlets;

            GameState.turn.pendingChoice = {
                type: reward.special,
                context: { locId, actionColor, config: { ...reward, cycle: canCycle } }
            };
        }

        // --- POST-REWARD PASSIVES (Lieutenants) ---
        this.checkPostRewardPassives(player, locId, actionColor, reward);

        if (window.gameUI) window.gameUI.renderFullState();
    },

    checkPostRewardPassives(player, locId, actionColor, reward) {
        // Lt Lee: Gain a bonus Red/Warrior AFTER acquiring 2+ resources from a troop location
        const troopLocations = ['loc-barracks', 'loc-archery', 'loc-docks', 'loc-assassins'];
        let totalResGained = 0;
        if (reward.resources) {
            totalResGained = Object.values(reward.resources).reduce((a, b) => a + b, 0);
        }

        for (const leader of player.leaders) {
            if (leader.id === 'lt_lee') {
                // Lt Lee: Gain 2 additional Influence AFTER acquiring 2 or more RESOURCES (not influence) from a location
                if (totalResGained >= 2) {
                    this.modifyInfluence(player, 2);
                    this.logEvent(`${player.name}'s Lt. Lee triggered: +2 Influence for gaining ${totalResGained} resources.`);
                }
            }
            if (leader.id === 'lt_beier') {
                // Lt Beier: Gain a bonus Yellow OR Blue OR Red AFTER acquiring 5+ influence from locations
                if (reward.influence && reward.influence >= 5) {
                    // Trigger choice
                    GameState.turn.pendingChoice = {
                        type: 'passiveChoice',
                        context: {
                            leaderId: leader.id,
                            options: [
                                { label: '+1 Archer (Yellow)', effect: { resources: { yellow: 1 } } },
                                { label: '+1 Marine (Blue)', effect: { resources: { blue: 1 } } },
                                { label: '+1 Warrior (Red)', effect: { resources: { red: 1 } } }
                            ]
                        }
                    };
                }
            }
            if (leader.id === 'lt_hicks' && totalResGained >= 3) {
                // Lt Hicks: Gain a bonus Yellow/Blue/Red AFTER acquiring 3+ resources
                GameState.turn.pendingChoice = {
                    type: 'passiveChoice',
                    context: {
                        leaderId: leader.id,
                        options: [
                            { label: '+1 Archer (Yellow)', effect: { resources: { yellow: 1 } } },
                            { label: '+1 Marine (Blue)', effect: { resources: { blue: 1 } } },
                            { label: '+1 Warrior (Red)', effect: { resources: { red: 1 } } }
                        ]
                    }
                };
            }
        }
    },

    async resolveFavorSelection(index) {
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        const pc = GameState.turn.pendingChoice;
        const selected = pc.context.options[index];
        const unselected = pc.context.options.filter((o, i) => i !== index);

        cp.favors.push(selected);
        this.logEvent(`${cp.name} selected Favor: ${selected.name}.`);

        if (pc.context.putBackOnTop) {
            // Cape: put unselected back on TOP so they're drawn next
            GameState.board.decks.favors.push(...unselected);
            // Upgraded Cape: offer to spend 3 Treasures to keep the second card
            if (pc.context.capeUpgraded && unselected.length > 0 && cp.treasures >= 3) {
                const shouldKeep = cp.isAI ? (cp.treasures >= 6) : await Dialogs.confirm(`Cape of the Crown: Spend 3 Treasures to also keep "${unselected[0].name}"?`);
                if (shouldKeep) {
                    cp.treasures -= 3;
                    // Remove the just-pushed unselected from top of deck and give to player
                    const kept = GameState.board.decks.favors.splice(-unselected.length);
                    cp.favors.push(...kept);
                    this.logEvent(`${cp.name} spent 3 Treasures to keep an extra Favor (Cape of the Crown).`);
                }
            }
        } else {
            // Gen. Polasky: put unselected at the BOTTOM of the deck
            GameState.board.decks.favors.unshift(...unselected.reverse());
        }

        GameState.turn.pendingChoice = null;
        if (window.gameUI) window.gameUI.renderFullState();
    },

    resolvePassiveChoice(index) {
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        const pc = GameState.turn.pendingChoice;
        const option = pc.context.options[index];
        GameState.turn.pendingChoice = null;

        if (option.effect.costDiscount) {
            this.logEvent(`${cp.name} chose to reduce cost by ${option.effect.costDiscount} influence.`);
            // Re-run apply with discount
            const config = JSON.parse(JSON.stringify(pc.context.originalConfig));
            config.cost = Math.max(0, config.cost - option.effect.costDiscount);
            this.applyLocationAction(cp, pc.context.locId, pc.context.actionColor, config);
        } else {
            if (option.effect.treasures) {
                cp.treasures += option.effect.treasures;
                this.logEvent(`${cp.name} gained ${option.effect.treasures} Treasures.`);
            }
            if (option.effect.resources) {
                const resNames = Object.entries(option.effect.resources).filter(([k, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ');
                this.logEvent(`${cp.name} gained ${resNames}.`);
                for (const [res, val] of Object.entries(option.effect.resources)) {
                    cp.resources[res] += val;
                }
            }
            // If they chose treasure instead of discount, apply original action
            if (pc.context.originalConfig) {
                this.applyLocationAction(cp, pc.context.locId, pc.context.actionColor, pc.context.originalConfig);
            }
        }

        if (window.gameUI) window.gameUI.renderFullState();
    },

    useFavor(favorId) {
        // Favors can be used anytime during the current player's turn
        const validPhases = ['activate', 'place', 'turnin'];
        if (!validPhases.includes(GameState.turn.phase)) {
            if (window.gameUI) Dialogs.alert("Favors can only be used during your turn.");
            return;
        }

        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        const favorIndex = cp.favors.findIndex(f => f.id === favorId);
        if (favorIndex === -1) return;

        const favor = cp.favors.splice(favorIndex, 1)[0];
        this.logEvent(`${cp.name} used Favor: ${favor.name}.`);

        switch (favor.effect.type) {
            case 'mixed_troops':
                cp.resources.yellow++; cp.resources.red++; cp.resources.blue++;
                break;
            case 'treasures':
                cp.treasures += favor.effect.amount;
                break;
            case 'upgrade_gear':
                GameState.turn.pendingChoice = { type: 'gearUpgrade', playerIndex: GameState.turn.currentPlayerIndex };
                break;
            case 'treasure_and_any':
                cp.treasures += favor.effect.treasures;
                // Use 'resourceSelect' so the resource-picker overlay renders correctly
                GameState.turn.pendingChoice = {
                    type: 'resourceSelect',
                    context: { config: { count: favor.effect.any, allowGreen: true }, locId: 'favor', actionColor: 'None' }
                };
                break;
            case 'any_resource':
                GameState.turn.pendingChoice = {
                    type: 'resourceSelect',
                    context: { config: { count: favor.effect.amount, allowGreen: true }, locId: 'favor', actionColor: 'None' }
                };
                break;
            case 'influence_and_any':
                this.modifyInfluence(cp, favor.effect.influence);
                GameState.turn.pendingChoice = {
                    type: 'resourceSelect',
                    context: { config: { count: favor.effect.any, allowGreen: true }, locId: 'favor', actionColor: 'None' }
                };
                break;
            case 'treasure_and_upgrade':
                cp.treasures += favor.effect.treasures;
                GameState.turn.pendingChoice = { type: 'gearUpgrade', playerIndex: GameState.turn.currentPlayerIndex };
                break;
            case 'specialist_and_card':
                cp.resources.green++;
                GameState.turn.pendingChoice = { type: 'freeCardChoice', marketType: 'leaders_raids' };
                break;
            case 'free_gear':
                GameState.turn.pendingChoice = { type: 'freeCardChoice', marketType: 'gear' };
                break;
        }

        if (window.gameUI) window.gameUI.renderFullState();
    },

    selectStartingOfficer(officerId, playerIndex = null) {
        const idx = (playerIndex !== null) ? playerIndex : GameState.turn.currentPlayerIndex;
        const cp = GameState.players[idx];
        const officer = cp.startingOfficersChoice.find(o => o.id === officerId);
        if (!officer) return;
        
        // Ensure startingOfficersChoice is properly handled for this player

        // Add to leaders
        cp.leaders.push(officer);
        this.logEvent(`${cp.name} selected starting officer: ${officer.name}`);

        // Remove from choices
        cp.startingOfficersChoice = [];

        // Apply specific bonuses base on officer ability text
        if (officerId.startsWith('stand_officer_1')) {
            // SO1: +5 Influence
            this.modifyInfluence(cp, 5);
            this.logEvent(`${cp.name} gained 5 Influence from ${officer.name}.`);
            this._finishOfficerSelection(idx);
        } else if (officerId.startsWith('stand_officer_4')) {
            // SO4: +5 Treasure tokens
            cp.treasures += 5;
            this.logEvent(`${cp.name} gained 5 Treasures from ${officer.name}.`);
            this._finishOfficerSelection(idx);
        } else if (officerId.startsWith('stand_officer_2')) {
            // "Begin the game with your choice of a face up gear card and 1 additional Red/Warrior"
            // User corrected: should also have +1 Influence
            cp.resources.red += 1;
            this.logEvent(`${cp.name} gained 1 Warrior from ${officer.name}.`);
            this.modifyInfluence(cp, 1);
            this.logEvent(`${cp.name} gained 1 Influence from ${officer.name}.`);
            
            // Only set pendingChoice if it's the current player (UI)
            if (idx === GameState.turn.currentPlayerIndex) {
                GameState.turn.pendingChoice = { type: 'gear', officerId };
            }
        } else if (officerId.startsWith('stand_officer_3')) {
            // "Begin the game with an additional 2 Yellow OR Blue OR Red"
            if (idx === GameState.turn.currentPlayerIndex) {
                GameState.turn.pendingChoice = { type: 'color', officerId };
            }
        } else if (officerId.startsWith('stand_officer_5')) {
            // "1 additional face down raid card and 1 face down lieutenant officer"
            if (GameState.board.decks.raids.length > 0) {
                const raidCard = GameState.board.decks.raids.pop();
                cp.raidsInHand.push(raidCard);
                this.logEvent(`${cp.name} gained a Raid card from ${officer.name}.`);
            }
            if (GameState.board.decks.leaders.lieutenant.length > 0) {
                const ltCard = GameState.board.decks.leaders.lieutenant.pop();
                cp.leaders.push(ltCard);
                this.logEvent(`${cp.name} gained a Lieutenant from ${officer.name}: ${ltCard.name}.`);
            }
            this._finishOfficerSelection(idx);
        }

        if (window.gameUI) {
            window.gameUI.renderFullState();
        }
    },

    _finishOfficerSelection(playerIndex = null) {
        const idx = (playerIndex !== null) ? playerIndex : GameState.turn.currentPlayerIndex;
        const cp = GameState.players[idx];
        cp.startingOfficersChoice = [];
        // Only clear pendingChoice if it's the current player (to avoid clearing UI state for human)
        if (idx === GameState.turn.currentPlayerIndex) GameState.turn.pendingChoice = null;
        this.checkStrengthThresholds(cp);
    },

    selectStartingRaid(raidId, playerIndex = null) {
        const idx = (playerIndex !== null) ? playerIndex : GameState.turn.currentPlayerIndex;
        const cp = GameState.players[idx];
        const raid = cp.startingRaidsChoice.find(r => r.id === raidId);
        if (!raid) return;

        // Keep chosen raid
        cp.raidsInHand.push(raid);
        this.logEvent(`${cp.name} selected starting Raid: ${raid.name}`);

        // Return the unchosen raid to the bottom of the deck
        const unselected = cp.startingRaidsChoice.filter(r => r.id !== raidId);
        GameState.board.decks.raids.unshift(...unselected);

        // Clear the choice
        cp.startingRaidsChoice = [];

        if (window.gameUI) window.gameUI.renderFullState();
    },

    resolveColorChoice(color) {
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        if (GameState.turn.pendingChoice && GameState.turn.pendingChoice.type === 'color') {
            if (color === 'yellow') cp.resources.yellow += 2;
            if (color === 'blue') cp.resources.blue += 2;
            if (color === 'red') cp.resources.red += 2;
            this.logEvent(`${cp.name} gained 2 ${color.charAt(0).toUpperCase() + color.slice(1)} resources.`);
            this._finishOfficerSelection();
        }
        if (window.gameUI) window.gameUI.renderFullState();
    },

    resolveCardChoice(cardId, marketType) {
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        const pc = GameState.turn.pendingChoice;

        // Sanitization
        if (typeof cardId !== 'string' || typeof marketType !== 'string') {
            if (cp.isAI) console.log(`AI resolveCardChoice failed: cardId=${cardId}, marketType=${marketType}`);
            return;
        }

        // Normalize marketType vs pendingChoice type
        const activeType = pc ? pc.type : null;
        let isMatch = false;
        if (activeType === 'cardChoice' && pc.marketType === marketType) isMatch = true;
        if (activeType === 'raidSelect' && marketType === 'raids') isMatch = true;
        if (activeType === 'gearPurchase' && marketType === 'gear') isMatch = true;
        if (activeType === 'gear' && marketType === 'gear') isMatch = true; // Starting Officer SO2 gear pick
        if (activeType === 'freeCardChoice') {
            if (pc.marketType === marketType || (pc.marketType === 'leaders_raids' && (marketType === 'leaders' || marketType === 'raids'))) {
                isMatch = true;
            }
        }

        if (cp.isAI) console.log(`AI resolveCardChoice: cardId=${cardId}, marketType=${marketType}, activeType=${activeType}`);

        if (pc && isMatch) {
            const market = GameState.board.market[marketType];
            const cardIndex = market.findIndex(c => c.id === cardId);
            if (cardIndex !== -1) {
                const card = market[cardIndex];
                
                // --- Gear Type Limit Check ---
                if (marketType === 'gear') {
                    const hasType = cp.gear.some(g => g.name === card.name);
                    if (hasType) {
                        Dialogs.alert(`You already have a ${card.name}. You may only have one of each gear type.`);
                        return;
                    }
                    cp.gear.push(card);
                } else if (marketType === 'raids') {
                    cp.raidsInHand.push(card);
                    if (cp.isAI) this.logEvent(`${cp.name} (AI) added Raid to hand.`);
                } else if (marketType === 'leaders') {
                    cp.leaders.push(card);
                    if (cp.isAI) this.logEvent(`${cp.name} (AI) added Leader to hand.`);
                }

                let logType = marketType.charAt(0).toUpperCase() + marketType.slice(1);
                if (logType === 'Raids') logType = 'Raid';
                this.logEvent(`${cp.name} gained a ${logType} card: ${card.name}.`);

                // Replace in market
                if (GameState.board.decks[marketType].length > 0) {
                    market[cardIndex] = GameState.board.decks[marketType].pop();
                } else {
                    market.splice(cardIndex, 1);
                }

                // Check if this was a starting choice or a location reward
                if (pc.officerId) {
                    this.checkPostGearPurchasePassives(cp);
                    this._finishOfficerSelection();
                } else if (pc.context && pc.context.config && pc.context.config.count > 1) {
                    pc.context.config.count--;
                } else {
                    GameState.turn.pendingChoice = null;
                }

                this.checkStrengthThresholds(cp);
            }
        }

        if (window.gameUI) {
            window.gameUI.renderFullState();
        }
    },

    cancelChoice() {
        GameState.turn.pendingChoice = null;
        this.logEvent(`${GameState.players[GameState.turn.currentPlayerIndex].name} cancelled a choice.`);
        if (window.gameUI) window.gameUI.renderFullState();
    },

    minimizeChoice() {
        if (GameState.turn.pendingChoice) {
            GameState.turn.pendingChoice.minimized = true;
        }
        if (window.gameUI) window.gameUI.renderFullState();
    },

    resolveResourceSelect(selections) {
        // selections: { yellow: 1, blue: 2 } etc.
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        for (const [res, val] of Object.entries(selections)) {
            cp.resources[res] += val;
        }
        const context = GameState.turn.pendingChoice ? GameState.turn.pendingChoice.context : null;
        GameState.turn.pendingChoice = null;

        // --- LT Hicks trigger (3+ resources from selection) ---
        if (context) {
            const resNames = Object.entries(selections).filter(([k, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ');
            this.logEvent(`${cp.name} collected: ${resNames}`);
            this.checkPostRewardPassives(cp, context.locId, context.actionColor, { resources: selections });
        }

        if (window.gameUI) window.gameUI.renderFullState();
    },

    resolveGearUpgrade(gearId) {
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        const gear = cp.gear.find(g => g.id === gearId);
        const pc = GameState.turn.pendingChoice;
        if (gear) {
            gear.upgraded = true;
            this.logEvent(`${cp.name} upgraded Gear: ${gear.name}`);
            // If it awards a treasure on upgrade (Blacksmith Purple)
            if (pc && pc.context && pc.context.config && pc.context.config.treasures) {
                // Already awarded in applyLocationAction
            }

            // --- Colonel Hall Passive (+2 Treasure on upgrade, Once Per Turn) ---
            const hall = cp.leaders.find(l => l.id === 'col_hall');
            const usedThisTurn = GameState.turn.usedHallPassive || false;
            if (hall && !usedThisTurn) {
                cp.treasures += 2;
                GameState.turn.usedHallPassive = true;
                this.logEvent(`Col Hall triggered: ${cp.name} gained +2 Treasures.`);
            }

            // Check if we have more upgrades pending (Blacksmith Green gets 2)
            if (pc && pc.context && pc.context.count !== undefined) {
                pc.context.count--;
                if (pc.context.count <= 0) {
                    GameState.turn.pendingChoice = null;
                }
            } else {
                GameState.turn.pendingChoice = null;
            }
            this.checkStrengthThresholds(cp);
        }
        if (window.gameUI) window.gameUI.renderFullState();
    },

    resolveGearPurchase(gearId) {
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        const context = GameState.turn.pendingChoice.context;
        const discount = context.config.discount || {};
        const gear = GameState.board.market.gear.find(g => g.id === gearId);

        if (!gear) return;

        // Calculate Cost
        const baseCostRes = gear.baseCostResourceType ? gear.baseCostResourceType.toLowerCase() : null;
        let resCost = gear.baseCostResource || 0;
        let infCost = gear.baseCostInfluence || 0;

        const resMap = {
            'archer': 'yellow', 'yellow': 'yellow',
            'marine': 'blue', 'blue': 'blue',
            'warrior': 'red', 'red': 'red',
            'specialist': 'green', 'green': 'green'
        };

        // Apply Discounts
        // Ensure discount key matches baseCostRes before applying (mapping to color if needed)
        const mappedBaseRes = baseCostRes ? (resMap[baseCostRes] || baseCostRes) : null;
        if (mappedBaseRes && discount[mappedBaseRes]) resCost = Math.max(0, resCost - discount[mappedBaseRes]);
        if (discount.influence) infCost = Math.max(0, infCost - discount.influence);

        const checkResource = (type, amt) => {
            const key = resMap[type.toLowerCase()] || (type.toLowerCase() === 'any' ? 'any' : null);
            if (!key) return true;
            if (key === 'any') {
                const total = Object.values(cp.resources).reduce((a, b) => a + b, 0);
                return total >= amt;
            }
            return cp.resources[key] >= amt;
        };

        const deductResource = (type, amt) => {
            const key = resMap[type.toLowerCase()] || (type.toLowerCase() === 'any' ? 'any' : null);
            if (!key) return;
            if (key === 'any') {
                let remaining = amt;
                const priorities = ['yellow', 'blue', 'red', 'green'];
                for (const p of priorities) {
                    const spend = Math.min(cp.resources[p], remaining);
                    cp.resources[p] -= spend;
                    remaining -= spend;
                    if (remaining <= 0) break;
                }
            } else {
                cp.resources[key] -= amt;
            }
        };

        // Check Affordability
        if (cp.influence < infCost) {
            if (!cp.isAI) Dialogs.alert("Not enough influence"); 
            if (cp.isAI) {
                this.logEvent(`${cp.name} (AI) cancelled gear purchase: not enough influence.`);
                GameState.turn.pendingChoice = null;
            }
            return;
        }

        if (baseCostRes && !checkResource(baseCostRes, resCost)) {
            if (!cp.isAI) Dialogs.alert("Not enough resources"); 
            if (cp.isAI) {
                this.logEvent(`${cp.name} (AI) cancelled gear purchase: not enough resources (${baseCostRes}).`);
                GameState.turn.pendingChoice = null;
            }
            return;
        }

        if (gear.baseCostDetails) {
            for (const [rawKey, amount] of Object.entries(gear.baseCostDetails)) {
                if (!checkResource(rawKey, amount)) {
                    if (!cp.isAI) Dialogs.alert("Not enough resources"); 
                    if (cp.isAI) {
                        this.logEvent(`${cp.name} (AI) cancelled gear purchase: not enough resources (${rawKey}).`);
                        GameState.turn.pendingChoice = null;
                    }
                    return;
                }
            }
        }

        // Deduct
        cp.influence -= infCost;

        if (baseCostRes) {
            deductResource(baseCostRes, resCost);
        }

        if (gear.baseCostDetails) {
            for (const [rawKey, amount] of Object.entries(gear.baseCostDetails)) {
                deductResource(rawKey, amount);
            }
        }

        // Award Card
        cp.gear.push(gear);
        this.logEvent(`${cp.name} purchased Gear: ${gear.name}`);
        // Replace in market
        const marketIndex = GameState.board.market.gear.findIndex(g => g.id === gearId);
        if (GameState.board.decks.gear.length > 0) {
            GameState.board.market.gear[marketIndex] = GameState.board.decks.gear.pop();
        } else {
            GameState.board.market.gear.splice(marketIndex, 1);
        }

        // Award extra treasures (Blacksmith Black)
        if (context && context.config && context.config.treasures) {
            // Already awarded in applyLocationAction
        }

        // --- Lt Friz / Lt Cates Passives ---
        this.checkPostGearPurchasePassives(cp);

        GameState.turn.pendingChoice = null;
        this.checkStrengthThresholds(cp);
        if (window.gameUI) window.gameUI.renderFullState();
    },

    checkPostGearPurchasePassives(player) {
        for (const leader of player.leaders) {
            if (leader.id === 'lt_friz') {
                GameState.turn.pendingChoice = {
                    type: 'passiveChoice',
                    context: {
                        leaderId: leader.id,
                        options: [
                            { label: '+1 Archer (Yellow)', effect: { resources: { yellow: 1 } } },
                            { label: '+1 Marine (Blue)', effect: { resources: { blue: 1 } } },
                            { label: '+1 Warrior (Red)', effect: { resources: { red: 1 } } }
                        ]
                    }
                };
            }
            if (leader.id === 'lt_cates') {
                this.modifyInfluence(player, 2);
                this.logEvent(`Lt Cates triggered: ${player.name} gained +2 Influence.`);
            }
        }
    },

    async completeRaid(raidId) {
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        const raidIndex = cp.raidsInHand.findIndex(r => r.id === raidId);
        if (raidIndex === -1) return;

        const raid = cp.raidsInHand[raidIndex];
        const currentStrength = window.gameUI._calcStrength(cp);

        // Check Strength
        if (currentStrength < raid.reqStrength) {
            console.log("Not enough strength");
            return;
        }

        // Check Resources (gyms)
        const reqs = raid.reqDetails || {};
        if (cp.resources.yellow < (reqs.yellow || 0)) return;
        if (cp.resources.blue < (reqs.blue || 0)) return;
        if (cp.resources.red < (reqs.red || 0)) return;
        if (cp.resources.green < (reqs.green || 0)) return;

        // Success! Deduct resources
        cp.resources.yellow -= (reqs.yellow || 0);
        cp.resources.blue -= (reqs.blue || 0);
        cp.resources.red -= (reqs.red || 0);
        cp.resources.green -= (reqs.green || 0);

        this.logEvent(`${cp.name} completed Raid: ${raid.name} (+${raid.baseVP} VP)`);

        // Apply VP
        cp.vp += raid.baseVP;

        // --- CHECK RAID BONUS REQUIREMENTS (On-Completion Bonuses) ---
        if (raid.bonusReq) {
            const reqs = raid.bonusReq;
            // Check if player has the strength and resources to pay for the bonus
            let canAffordBonus = true;
            if (reqs.strength && currentStrength < reqs.strength) canAffordBonus = false;
            if (reqs.yellow && cp.resources.yellow < reqs.yellow) canAffordBonus = false;
            if (reqs.blue && cp.resources.blue < reqs.blue) canAffordBonus = false;
            if (reqs.red && cp.resources.red < reqs.red) canAffordBonus = false;
            if (reqs.green && cp.resources.green < reqs.green) canAffordBonus = false;

            // General Gansen passive: complete Kingdom raid bonus objective AT NO COST if strength 33+
            const hasGansen = cp.leaders.some(l => l.id === 'gen_gansen');
            let gansenFree = false;
            if (hasGansen && currentStrength >= 33 && raid.type === 'Kingdom') {
                canAffordBonus = true;
                gansenFree = true;
            }

            if (canAffordBonus) {
                const costStr = gansenFree ? "FREE (Gen. Gansen)" : `${reqs.yellow || 0}Y ${reqs.blue || 0}B ${reqs.red || 0}R ${reqs.green || 0}G`;
                const wantsBonus = await Dialogs.confirm(
                    `Strength Required: ${reqs.strength || 0}\nCost: ${costStr}\nReward: +${raid.bonusVP} VP`,
                    { title: `Complete Bonus Objective: "${raid.bonus}"?`, confirmLabel: 'Complete Bonus' }
                );
                if (wantsBonus) {
                    if (!gansenFree) {
                        if (reqs.yellow) cp.resources.yellow -= reqs.yellow;
                        if (reqs.blue) cp.resources.blue -= reqs.blue;
                        if (reqs.red) cp.resources.red -= reqs.red;
                        if (reqs.green) cp.resources.green -= reqs.green;
                    }
                    cp.vp += raid.bonusVP;
                    raid.bonusAchieved = true;
                    this.logEvent(`${cp.name} completed Bonus Objective: ${raid.bonus} (+${raid.bonusVP} VP)`);

                    // --- COMMANDER SWAP LOGIC ---
                    if (raid.bonusSword && raid.type === 'Kingdom') {
                        const totalPlayers = GameState.settings.numPlayers + GameState.settings.numAI;
                        const swapLimit = totalPlayers >= 4 ? 3 : 2;

                        if (GameState.board.commanderSwaps < swapLimit) {
                            const shouldSwap = cp.isAI ? true : await Dialogs.confirm(
                                "Would you like to swap a Black commander for a Purple commander? (Allows 1 more Purple option, 1 less Black option for the rest of the game)",
                                { title: 'Kingdom Bonus', confirmLabel: 'Swap' }
                            );

                            if (shouldSwap) {
                                let swapped = false;
                                // 1. Try to swap in player's queue
                                const blackIndex = cp.commanders.indexOf('Black');
                                if (blackIndex !== -1) {
                                    cp.commanders[blackIndex] = 'Purple';
                                    swapped = true;
                                } 
                                // 2. Try to swap on board (if currently placed)
                                else if (GameState.turn.lastPlacedLocationId && GameState.board.locations[GameState.turn.lastPlacedLocationId] === 'Black') {
                                    GameState.board.locations[GameState.turn.lastPlacedLocationId] = 'Purple';
                                    swapped = true;
                                }

                                if (swapped) {
                                    GameState.board.commanderSwaps++;
                                    this.logEvent(`${cp.name} swapped a Black commander for a Purple commander.`);
                                } else {
                                    this.logEvent(`${cp.name} attempted to swap a Black commander, but none were available (already swapped?).`);
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- Griffiths Passive (+3/2/1 Treasures based on Raid type) ---
        const griffith = cp.leaders.find(l => l.id === 'col_griffiths');
        if (griffith) {
            let bonus = 1; // Village
            if (raid.type === 'Kingdom') bonus = 3;
            else if (raid.type === 'Town') bonus = 2;
            cp.treasures += bonus;
            this.logEvent(`Col Griffiths awarded ${cp.name} +${bonus} Treasures for ${raid.type} raid.`);
        }

        // --- General Kirk passive ---
        const hasKirk = cp.leaders.some(l => l.id === 'gen_kirk');
        if (hasKirk && cp.resources.blue >= 1 && cp.resources.red >= 1) {
            const wantsKirk = await Dialogs.confirm(
                "Spend 1 Marine + 1 Warrior to gain 3 Treasures? (Opponent cube bumping not yet available in UI)",
                { title: 'General Kirk', confirmLabel: 'Spend' }
            );
            if (wantsKirk) {
                cp.resources.blue -= 1;
                cp.resources.red -= 1;
                cp.treasures += 3;
                this.logEvent(`${cp.name} used Gen. Kirk and gained 3 Treasures.`);
            }
        }

        // --- General Esparza passive ---
        let raidTypeForPlacement = raid.type;
        const hasEsparza = cp.leaders.some(l => l.id === 'gen_esparza');
        if (hasEsparza && cp.resources.green >= 1) {
            const wantsEsparza = await Dialogs.confirm(
                "Spend 1 Specialist to place marker on ANY hex type?",
                { title: 'General Esparza', confirmLabel: 'Spend' }
            );
            if (wantsEsparza) {
                cp.resources.green -= 1;
                raidTypeForPlacement = 'All'; // 'All' allows placing anywhere
                this.logEvent(`${cp.name} used Gen. Esparza to place marker anywhere.`);
            }
        }

        // Remove from hand
        cp.raidsInHand.splice(raidIndex, 1);
        cp.completedRaids.push(raid);

        // --- NEW: Trigger Hex Map Placement ---
        GameState.turn.pendingChoice = {
            type: 'hexPlacement',
            context: {
                raidType: raidTypeForPlacement, // 'Kingdom', 'Village', 'Town', or 'All'
                message: `Select a ${raidTypeForPlacement} hexagon to place your marker.`
            }
        };

        if (window.gameUI) window.gameUI.renderFullState();
    },

    resolveHexPlacement(hexId) {
        if (!hexId || typeof hexId !== 'string') return;

        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        const pc = GameState.turn.pendingChoice;
        if (!pc || pc.type !== 'hexPlacement') return;

        const hex = GameState.board.hexGrid.find(h => h.id === hexId);
        if (!hex) return;

        // Validate type (Center hex 'All' is always valid)
        if (hex.type !== 'All' && hex.type !== pc.context.raidType) {
            if (window.gameUI) Dialogs.alert(`Invalid hex type! You must place in a ${pc.context.raidType} or the Center hex.`);
            return;
        }

        // Place marker
        GameState.board.placedMarkers.push({
            hexId: hex.id,
            playerIndex: GameState.turn.currentPlayerIndex
        });

        cp.markersPlaced++;
        this.logEvent(`${cp.name} placed a marker on ${hex.id} (${hex.type}). Total: ${cp.markersPlaced}/6`);

        // Check End Game Trigger
        if (cp.markersPlaced >= 6 && !GameState.settings.endGameTriggered) {
            GameState.settings.endGameTriggered = true;
            GameState.settings.lastPlayerIndex = GameState.turn.currentPlayerIndex;
            this.logEvent(`END GAME TRIGGERED! ${cp.name} has placed 6 markers. All other players get one last turn.`);
        }

        GameState.turn.pendingChoice = null;
        if (window.gameUI) window.gameUI.renderFullState();
    },

    activateGear(gearId) {
        if (GameState.turn.phase !== 'activate') return;
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        const gear = cp.gear.find(g => g.id === gearId);

        // Check cooldown
        if (cp.usedGearLastTurn.includes(gearId)) {
            if (window.gameUI) Dialogs.alert(`This gear is on cooldown! It was used last turn.`);
            return;
        }

        if (!GameState.turn.activatedGearIds.includes(gearId)) {
            GameState.turn.activatedGearIds.push(gearId);
            this.logEvent(`${cp.name} activated Gear: ${gear.name}`);
        }
        if (window.gameUI) window.gameUI.renderFullState();
    },

    cycleGearMarket() {
        const pc = GameState.turn.pendingChoice;
        if (pc && pc.type === 'gearPurchase' && pc.context.config.cycle) {
            // Cycle market: discard and draw 5
            GameState.board.market.gear = [];
            for (let i = 0; i < 5; i++) {
                if (GameState.board.decks.gear.length > 0) {
                    GameState.board.market.gear.push(GameState.board.decks.gear.pop());
                }
            }
            // Once per action
            pc.context.config.cycle = false;
            if (window.gameUI) window.gameUI.renderFullState();
        }
    },

    resolveStrengthReward(threshold, choice, extra, playerIndex = null) {
        const idx = (playerIndex !== null) ? playerIndex : GameState.turn.currentPlayerIndex;
        const cp = GameState.players[idx];
        const pc = GameState.turn.pendingChoice;
        
        // Validation for human player (AI might call this without a pendingChoice set)
        if (!cp.isAI && (!pc || pc.type !== 'strengthReward' || pc.threshold !== threshold)) return;

        if (threshold === 5) {
            if (choice === 'leader') {
                const hasLt = cp.leaders.some(l => l.id && (l.id.startsWith('lt_') || l.type === 'lieutenant'));
                const type = hasLt ? 'colonel' : 'lieutenant';
                const card = GameState.board.decks.leaders[type].pop();
                if (card) {
                    cp.leaders.push(card);
                    this.logEvent(`${cp.name} chose a ${type}: ${card.name} for reaching Strength 5.`);
                }
            } else {
                cp.resources.green += 1;
                this.logEvent(`${cp.name} chose a Specialist for reaching Strength 5.`);
            }
        } else if (threshold === 12 || threshold === 38) {
            if (choice === 'gear' && extra) {
                const gearId = extra;
                const gear = GameState.board.market.gear.find(g => g.id === gearId);
                if (gear) {
                    // Rule: 1 of each gear type
                    const baseId = gear.id.replace('gear_', '');
                    const hasType = cp.gear.some(g => g.id.replace('gear_', '') === baseId);
                    if (hasType) {
                        if (window.gameUI) Dialogs.alert(`You already have ${gear.name}! You must choose a different type.`);
                        return;
                    }

                    cp.gear.push(gear);
                    this.logEvent(`${cp.name} selected ${gear.name} for reaching Strength ${threshold}.`);
                    // Replace market
                    const idx = GameState.board.market.gear.findIndex(g => g.id === gearId);
                    if (GameState.board.decks.gear.length > 0) {
                        GameState.board.market.gear[idx] = GameState.board.decks.gear.pop();
                    } else {
                        GameState.board.market.gear.splice(idx, 1);
                    }
                }
            } else {
                return; // Wait for gear selection from UI
            }
        } else if (threshold === 18) {
            cp.strengthPath = (choice === 'pathA') ? 'A' : 'B';
            if (cp.strengthPath === 'A') {
                if (!cp.isAI) {
                    GameState.turn.pendingChoice = { type: 'resourceSelect', context: { config: { count: 3 }, locId: 'strength-18', actionColor: 'None' } };
                } else {
                    const selection = window.AIChoiceResolver.resolveResourceSelect({ context: { config: { count: 3 } } }, cp);
                    for (const [res, val] of Object.entries(selection)) {
                        cp.resources[res] += val;
                    }
                    this.logEvent(`${cp.name} (AI) auto-selected resources for Path A.`);
                }
                this.logEvent(`${cp.name} chose Path A (3 resources, no green).`);
                if (window.gameUI) window.gameUI.renderFullState();
                return; 
            } else {
                if (!cp.isAI) {
                    GameState.turn.pendingChoice = {
                        type: 'resourceSelect',
                        context: {
                            config: { count: 2, allowGreen: true },
                            locId: 'strength-18',
                            actionColor: 'None'
                        }
                    };
                } else {
                    const selection = window.AIChoiceResolver.resolveResourceSelect({ context: { config: { count: 2, allowGreen: true } } }, cp);
                    for (const [res, val] of Object.entries(selection)) {
                        cp.resources[res] += val;
                    }
                    this.logEvent(`${cp.name} (AI) auto-selected resources for Path B.`);
                }
                // Note: Need to update resolveResourceSelect or update UI to ALLOW green for this specific context
                this.logEvent(`${cp.name} chose Path B (2 resources, with green).`);
                if (window.gameUI) window.gameUI.renderFullState();
                return; // Wait for resource selection
            }
        } else if (threshold === 25) {
            const count = cp.strengthPath === 'A' ? 3 : 2;
            const allowGreen = cp.strengthPath === 'B';
            GameState.turn.pendingChoice = {
                type: 'resourceSelect',
                context: {
                    config: { count, allowGreen },
                    locId: 'strength-25',
                    actionColor: 'None'
                }
            };
            this.logEvent(`${cp.name} claimed path resources for reaching Strength 25.`);
            if (window.gameUI) window.gameUI.renderFullState();
            return;
        } else if (threshold === 32) {
            if (cp.strengthPath === 'A') {
                cp.influence = 12;
                this.logEvent(`${cp.name} gained Full Influence for reaching Strength 32.`);
            } else {
                if (GameState.board.decks.favors.length > 0) {
                    const card = GameState.board.decks.favors.pop();
                    cp.favors.push(card);
                    this.logEvent(`${cp.name} gained a Favor card for reaching Strength 32.`);
                }
            }
        } else if (threshold === 45) {
            if (choice === 'vp') {
                cp.treasures += 8;
                this.logEvent(`${cp.name} chose 8 VP Treasures for reaching Strength 45.`);
            } else if (choice === 'favors') {
                for (let i = 0; i < 2; i++) {
                    if (GameState.board.decks.favors.length > 0) cp.favors.push(GameState.board.decks.favors.pop());
                }
                this.logEvent(`${cp.name} chose 2 Favor cards for reaching Strength 45.`);
            } else if (choice === 'upgrade') {
                cp.treasures += 4;
                GameState.turn.pendingChoice = { type: 'gearUpgrade', context: { count: 1 } };
                this.logEvent(`${cp.name} chose Free Gear Upgrade + 4 VP Treasures for reaching Strength 45.`);
                if (window.gameUI) window.gameUI.renderFullState();
                return;
            }
        }

        GameState.turn.pendingChoice = null;
        if (window.gameUI) window.gameUI.renderFullState();

        // Check if another threshold was crossed (e.g. jumped from 4 to 13)
        this.checkStrengthThresholds(cp);
    },

    nextPhase() {
        const phases = ['activate', 'place', 'turnin'];
        let currentIndex = phases.indexOf(GameState.turn.phase);

        if (currentIndex < phases.length - 1) {
            GameState.turn.phase = phases[currentIndex + 1];
            this.logEvent(`${GameState.turn.phase.toUpperCase()} PHASE`, true);
            this.checkAITurn();
        } else {
            // End of turn, move to next player
            const cp = GameState.players[GameState.turn.currentPlayerIndex];
            this.logEvent(`${cp.name} ended turn.`);

            // Set cooldowns for the player who just finished their turn
            cp.usedGearLastTurn = [...GameState.turn.activatedGearIds];

            GameState.turn.phase = 'activate';
            GameState.turn.currentPlayerIndex = (GameState.turn.currentPlayerIndex + 1) % GameState.players.length;
            GameState.turn.activatedGearIds = []; // Reset for new turn
            GameState.turn.lastPlacedLocationId = null;
            GameState.turn.usedHallPassive = false; // Reset Colonel Hall passive
            
            // Auto-switch view to current player
            GameState.settings.viewerPlayerIndex = GameState.turn.currentPlayerIndex;
            
            // CLEAR PENDING CHOICE to prevent leakage
            GameState.turn.pendingChoice = null;

            // CHECK END GAME TRIGGER
            if (GameState.settings.endGameTriggered && GameState.turn.currentPlayerIndex === GameState.settings.lastPlayerIndex) {
                // End of game!
                this.calculateFinalScores();
                return;
            }

            if (GameState.turn.currentPlayerIndex === 0) {
                GameState.turn.roundCount++;
            }
            
            setTimeout(() => this.checkAITurn(), 150);
        }

        if (window.gameUI) {
            window.gameUI.renderFullState();
        }
    },

    calculateFinalScores() {
        this.logEvent("Calculating Final Scores...");
        const scores = [];

        // Base VP is already tracked in cp.vp from raids.
        // We add VP from other sources like gear, strength track, and hex grid majorities.

        // First, tally markers by hex
        const hexControl = {};
        GameState.board.placedMarkers.forEach(m => {
            if (!hexControl[m.hexId]) hexControl[m.hexId] = {};
            if (!hexControl[m.hexId][m.playerIndex]) hexControl[m.hexId][m.playerIndex] = 0;
            hexControl[m.hexId][m.playerIndex]++;
        });

        // Determine Hex Majority and award VP
        GameState.board.hexGrid.forEach(hex => {
            const counts = hexControl[hex.id] || {};
            let maxMarkers = 0;
            let winners = [];

            for (const [pIdx, count] of Object.entries(counts)) {
                if (count > maxMarkers) {
                    maxMarkers = count;
                    winners = [parseInt(pIdx)];
                } else if (count === maxMarkers && maxMarkers > 0) {
                    winners.push(parseInt(pIdx));
                }
            }

            // Apply VP to all winners (ties get full points per general board game norms unless specified)
            if (winners.length > 0) {
                winners.forEach(w => {
                    GameState.players[w].vp += hex.vp;
                    this.logEvent(`${GameState.players[w].name} scored ${hex.vp} VP for controlling ${hex.type} hex (${hex.id}).`);
                });
            }
        });

        // Score Gear
        for (const cp of GameState.players) {
            cp.gear.forEach(g => {
                cp.vp += g.upgraded ? g.upgradedVP : g.basicVP;
            });

            // Add 1 VP per unspent Treasure
            cp.vp += cp.treasures;

            // Score End-Game Raid Bonuses
            let royalKing = false, royalQueen = false, royalPrince = false;
            let blueVillages = 0, redVillages = 0, greenTowns = 0, yellowTowns = 0;
            let kingdomRaids = 0;
            let uniqueColors = { 'Blue': false, 'Red': false, 'Green': false, 'Yellow': false };

            cp.completedRaids.forEach(r => {
                if (r.bonusAchieved) {
                    if (r.bonus && r.bonus.includes('King!')) royalKing = true;
                    if (r.bonus && r.bonus.includes('Queen')) royalQueen = true;
                    if (r.bonus && r.bonus.includes('Prince')) royalPrince = true;
                }
                if (r.type === 'Village' && r.color === 'Blue') blueVillages++;
                if (r.type === 'Village' && r.color === 'Red') redVillages++;
                if (r.type === 'Town' && r.color === 'Green') greenTowns++;
                if (r.type === 'Town' && r.color === 'Yellow') yellowTowns++;
                if (r.type === 'Kingdom') kingdomRaids++;
                if (r.color) uniqueColors[r.color] = true;
            });

            cp.completedRaids.forEach(r => {
                // Only evaluate end-game bonuses which don't have a specific `bonusReq` dict
                if (!r.bonusReq && r.bonus) {
                    if (r.bonus.startsWith('Royal Slaying') && royalKing && royalQueen && royalPrince) {
                        cp.vp += r.bonusVP;
                        this.logEvent(`${cp.name} scored ${r.bonusVP} VP for Royal Slaying!`);
                    } else if (r.bonus.startsWith('Village Pillage')) {
                        if ((r.color === 'Blue' && blueVillages >= 2) || (r.color === 'Red' && redVillages >= 2)) {
                            cp.vp += r.bonusVP;
                            this.logEvent(`${cp.name} scored ${r.bonusVP} VP for Village Pillage!`);
                        }
                    } else if (r.bonus.startsWith('Town Terror')) {
                        if ((r.color === 'Green' && greenTowns >= 2) || (r.color === 'Yellow' && yellowTowns >= 2)) {
                            cp.vp += r.bonusVP;
                            this.logEvent(`${cp.name} scored ${r.bonusVP} VP for Town Terror!`);
                        }
                    } else if (r.bonus.startsWith('Master of Puppets')) {
                        const str = window.gameUI ? window.gameUI._calcStrength(cp) : 0;
                        if (str >= 35) {
                            const remainingTroops = cp.resources.yellow + cp.resources.blue + cp.resources.red + cp.resources.green;
                            const vps = Math.min(10, Math.floor(remainingTroops / 3));
                            cp.vp += vps;
                            this.logEvent(`${cp.name} scored ${vps} VP for Master of Puppets!`);
                        }
                    } else if (r.bonus.startsWith('Maximum Effort')) {
                        if (cp.gear.length > 0 && cp.gear.every(g => g.upgraded)) {
                            cp.vp += r.bonusVP;
                            this.logEvent(`${cp.name} scored ${r.bonusVP} VP for Maximum Effort!`);
                        }
                    } else if (r.bonus.startsWith('Gearhead')) {
                        if (cp.gear.length >= 6) {
                            cp.vp += r.bonusVP;
                            this.logEvent(`${cp.name} scored ${r.bonusVP} VP for Gearhead!`);
                        }
                    } else if (r.bonus.startsWith('King Killer')) {
                        if (kingdomRaids >= 2) {
                            cp.vp += r.bonusVP;
                            this.logEvent(`${cp.name} scored ${r.bonusVP} VP for King Killer!`);
                        }
                    } else if (r.bonus.startsWith('Gotta raid them all!')) {
                        if (uniqueColors['Blue'] && uniqueColors['Red'] && uniqueColors['Green'] && uniqueColors['Yellow']) {
                            cp.vp += r.bonusVP;
                            this.logEvent(`${cp.name} scored ${r.bonusVP} VP for Gotta raid them all!`);
                        }
                    }
                }
            });

            scores.push({ name: cp.name, vp: cp.vp });
        }

        // Sort and announce winner
        scores.sort((a, b) => b.vp - a.vp);
        const winnerText = `${scores[0].name} wins with ${scores[0].vp} VP!`;
        this.logEvent(`WINNER: ${winnerText}`);

        if (window.gameUI) {
            Dialogs.showGameOver(scores);
        }
    },

    checkAITurn() {
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        if (cp && cp.isAI && !GameState.settings.gameOver) {
            // Delay slightly to let UI catch up
            setTimeout(() => {
                window.AITurnController.playAITurn(GameState.turn.currentPlayerIndex);
            }, 500);
        }
    },

    resolveAIStartupChoices() {
        GameState.players.forEach((p, idx) => {
            if (p.isAI) {
                const personality = p.aiPersonality;
                
                // 1. Resolve starting officer
                if (p.startingOfficersChoice.length > 0) {
                    const offIdx = window.AIChoiceResolver.resolveStartingOfficer(p, p.startingOfficersChoice);
                    const offId = p.startingOfficersChoice[offIdx].id;
                    this.selectStartingOfficer(offId, idx);
                    
                    // Resolve secondary choices for starting officer (like SO3 colors)
                    if (offId.startsWith('stand_officer_3')) {
                        const color = (personality.id === 'aggressive') ? 'red' : 'blue';
                        p.resources[color] += 2;
                        this.logEvent(`${p.name} (AI) gained 2 ${color} from SO3.`);
                        this._finishOfficerSelection(idx);
                    } else if (offId.startsWith('stand_officer_2')) {
                        // Free gear for SO2
                        const gearId = window.AIChoiceResolver.resolveGearPurchase({ type: 'gear', context: { config: { discount: { yellow: 10, blue: 10, red: 10, influence: 10 } } } }, p, personality);
                        if (gearId) {
                            const market = GameState.board.market.gear;
                            const gearIndex = market.findIndex(g => g.id === gearId);
                            if (gearIndex !== -1) {
                                const gear = market[gearIndex];
                                p.gear.push(gear);
                                this.logEvent(`${p.name} (AI) selected ${gear.name} from SO2.`);
                                // Replace in market
                                if (GameState.board.decks.gear.length > 0) {
                                    market[gearIndex] = GameState.board.decks.gear.pop();
                                } else {
                                    market.splice(gearIndex, 1);
                                }
                            }
                        }
                        this._finishOfficerSelection(idx);
                    }
                }
                
                // 2. Resolve starting raid
                if (p.startingRaidsChoice.length > 0) {
                    const raidIdx = window.AIChoiceResolver.resolveStartingRaid(p, p.startingRaidsChoice);
                    this.selectStartingRaid(p.startingRaidsChoice[raidIdx].id, idx);
                }
            }
        });
        if (window.gameUI) window.gameUI.renderFullState();
    }
};
