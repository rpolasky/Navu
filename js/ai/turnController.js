const AITurnController = {
    turnSpeed: 1000, 
    isPlaying: false, // Guard against concurrent execution

    async playAITurn(playerIndex) {
        if (this.isPlaying) return;
        this.isPlaying = true;

        try {
            while (GameState.turn.currentPlayerIndex === playerIndex && this.isPlaying) {
                const player = GameState.players[playerIndex];
                const personality = player.aiPersonality;
                
                console.log(`AI Turn: ${player.name} (${personality.name}) - Phase: ${GameState.turn.phase}`);
                
                // Phase 1: ACTIVATE
                if (GameState.turn.phase === 'activate') {
                    await this.delay(500);
                    const state = AIEngine.assessGameState(player);
                    const gearToActivate = AIEngine.decideActivation(player, personality, state);
                    
                    for (const gearId of gearToActivate) {
                        GameEngine.activateGear(gearId);
                        await this.delay(300);
                    }
                    
                    GameEngine.nextPhase();
                }
                // Phase 2: PLACE
                else if (GameState.turn.phase === 'place') {
                    await this.delay(800);
                    const state = AIEngine.assessGameState(player);
                    const placement = AIEngine.decidePlacement(player, personality, state);
                    
                    GameEngine.placeCommander(placement.locId);
                    
                    // Handle any resulting choices (e.g., Armory, Docks, Archery)
                    // Note: GameEngine.placeCommander calls resolveLocationReward, which might call nextPhase()
                    // or set a pendingChoice. 
                    
                    let safety = 0;
                    while (GameState.turn.pendingChoice && safety < 10) {
                        await this.resolveAIPendingChoice(player, personality);
                        await this.delay(500);
                        safety++;
                    }
                    
                    // IF resolveLocationReward didn't trigger a choice and didn't nextPhase, 
                    // and we are STILL in 'place' phase, we must move forward.
                    if (GameState.turn.phase === 'place' && !GameState.turn.pendingChoice) {
                        GameEngine.nextPhase();
                    }
                }
                // Phase 3: TURNIN
                else if (GameState.turn.phase === 'turnin') {
                    await this.delay(600);
                    const state = AIEngine.assessGameState(player);
                    
                    if (AIEngine.shouldCompleteRaid(player, personality, state)) {
                        const raid = AIEngine.selectBestRaid(player, personality);
                        if (raid) {
                            // completeRaid is async (it awaits themed confirm dialogs for
                            // optional bonus objectives / leader passives), so we must wait
                            // for it to fully resolve before checking pendingChoice below —
                            // otherwise the turn could advance mid-resolution.
                            await GameEngine.completeRaid(raid.id);
                            
                            let safety = 0;
                            while (GameState.turn.pendingChoice && safety < 10) {
                                await this.resolveAIPendingChoice(player, personality);
                                await this.delay(500);
                                safety++;
                            }
                        }
                    }
                    
                    GameEngine.nextPhase();
                }
                
                // Brief delay between phases
                await this.delay(400);
                
                // If it's no longer this AI's turn (e.g., turnin ended), the while loop will exit.
            }
        } catch (error) {
            console.error("AI Turn Error:", error);
        } finally {
            this.isPlaying = false;
        }
    },

    async resolveAIPendingChoice(player, personality) {
        const pc = GameState.turn.pendingChoice;
        if (!pc) return;

        const choice = AIChoiceResolver.resolve(pc, player, personality);
        
        if (choice === null) {
            console.log(`AI skipped choice: ${pc.type}`);
            GameState.turn.pendingChoice = null;
            if (window.gameUI) window.gameUI.renderFullState();
            return;
        }

        // Map choice and resolve via appropriate GameEngine methods
        switch(pc.type) {
            case 'commanderAction':
                GameEngine.resolveCommanderAction(choice);
                break;
            case 'resourceSelect':
                GameEngine.resolveResourceSelect(choice);
                break;
            case 'gearUpgrade':
                GameEngine.resolveGearUpgrade(choice);
                break;
            case 'gearPurchase':
            case 'gear':
                GameEngine.resolveGearPurchase(choice);
                break;
            case 'raidSelect':
                GameEngine.resolveCardChoice(choice, 'raids');
                break;
            case 'favorSelect':
                // resolveFavorSelection is async (Cape of the Crown can await a themed
                // confirm dialog); await it so pendingChoice is guaranteed cleared before
                // this loop iterates again.
                await GameEngine.resolveFavorSelection(choice);
                break;
            case 'passiveChoice':
                GameEngine.resolvePassiveChoice(choice);
                break;
            case 'hexPlacement':
                GameEngine.resolveHexPlacement(choice);
                break;
            case 'strengthReward':
                const threshold = pc.threshold;
                if (threshold === 12 || threshold === 38) {
                    GameEngine.resolveStrengthReward(threshold, 'gear', choice);
                } else {
                    GameEngine.resolveStrengthReward(threshold, choice);
                }
                break;
            case 'color':
                GameEngine.resolveColorChoice(choice);
                break;
        }
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

if (typeof module !== 'undefined') {
    module.exports = AITurnController;
} else {
    window.AITurnController = AITurnController;
}
