const AIEngine = {
    assessGameState(player) {
        return {
            influence: player.influence,
            strength: window.gameUI ? window.gameUI._calcStrength(player) : 0,
            resources: { ...player.resources },
            raidCount: player.raidsInHand.length,
            completedRaidCount: player.completedRaids.length,
            gearCount: player.gear.length,
            lastLocationId: player.lastLocationId || null,
            canCompleteRaid: this.canCompleteAnyRaid(player)
        };
    },

    canCompleteAnyRaid(player) {
        const currentStrength = window.gameUI ? window.gameUI._calcStrength(player) : 0;
        return player.raidsInHand.some(raid => {
            if (currentStrength < raid.reqStrength) return false;
            const reqs = raid.reqDetails || {};
            for (const [res, val] of Object.entries(reqs)) {
                if (player.resources[res] < val) return false;
            }
            return true;
        });
    },

    decideActivation(player, personality, state) {
        const activations = [];
        player.gear.forEach(gear => {
            if (player.usedGearLastTurn && player.usedGearLastTurn.includes(gear.id)) return;
            
            let shouldActivate = false;
            if (personality.id === 'aggressive' && (gear.basicStrength || gear.upgradedStrength)) shouldActivate = true;
            if (personality.id === 'economist' && (gear.basicInfluence || gear.upgradedInfluence)) shouldActivate = true;
            if (gear.name.toLowerCase().includes('treasure') || gear.name.toLowerCase().includes('gold')) shouldActivate = true;
            
            if (shouldActivate) activations.push(gear.id);
        });
        return activations;
    },

    decidePlacement(player, personality, state) {
        const locations = Object.keys(GameState.board.locations);
        const locationScores = locations.map(locId => ({
            locId,
            score: this.scoreLocation(locId, player, personality, state)
        }));

        locationScores.sort((a, b) => b.score - a.score);
        return locationScores[0];
    },

    scoreLocation(locId, player, personality, state) {
        const bumpedColor = GameState.board.locations[locId];
        const playerCurrentCommander = player.commanders[0];
        
        const config = GameEngine.LOCATION_REWARDS[locId][playerCurrentCommander];
        if (!config) return -1000;
        
        if (player.influence < config.cost) return -1000;
        
        let score = AIChoiceResolver.scoreRewardConfig(config.reward, player);
        
        score -= config.cost * 2;
        
        if (personality.commanderPreference.includes(playerCurrentCommander)) {
            score += 10;
        }
        
        if (bumpedColor) {
            const gearColorMap = {
                'gear_bracers': 'Purple', 'gear_shield': 'Black', 'gear_axe': 'Red',
                'gear_bow': 'Yellow', 'gear_short_sword': 'Blue', 'gear_daggers': 'Green',
                'gear_helmet': 'Red', 'gear_breastplate': 'Yellow', 'gear_gauntlets': 'Purple',
                'gear_boots': 'Blue', 'gear_greaves': 'Green', 'gear_cape': 'Black'
            };
            // Matching the color you BUMP is good because you get it for next turn
            const needsBumpColor = player.gear.some(g => gearColorMap[g.id] === bumpedColor);
            
            if (needsBumpColor) score += 10; 
            else score += 5; 

            // Matching the color you PLACE is also good if you have gear that triggers it (passive)
            // But here we are scoring BEFORE placement result is fully applied for trigger...
            // Actually, resolveLocationReward handles triggers. 
        }

        if (state.lastLocationId === locId) {
            score -= 40; // AGGRESSIVE loop penalty to force variety
        }

        // Diversity bonus: favor placing on locations that give a color you DON'T have in hand right now
        // This is only relevant if you have >1 commander, but with 1 it ensures you change colors
        if (bumpedColor && !player.commanders.includes(bumpedColor)) {
            score += 5;
        }

        return score;
    },

    shouldCompleteRaid(player, personality, state) {
        if (!state.canCompleteRaid) return false;
        if (personality.id === 'aggressive') return true;
        if (personality.id === 'economist' && state.resources.yellow < 2) return false;
        return true;
    },

    selectBestRaid(player, personality) {
        const eligible = player.raidsInHand.filter(raid => {
            const currentStrength = window.gameUI ? window.gameUI._calcStrength(player) : 0;
            if (currentStrength < raid.reqStrength) return false;
            const reqs = raid.reqDetails || {};
            for (const [res, val] of Object.entries(reqs)) {
                if (player.resources[res] < val) return false;
            }
            return true;
        });
        
        if (eligible.length === 0) return null;
        
        eligible.sort((a, b) => b.baseVP - a.baseVP);
        return eligible[0];
    }
};

if (typeof module !== 'undefined') {
    module.exports = AIEngine;
} else {
    window.AIEngine = AIEngine;
}
