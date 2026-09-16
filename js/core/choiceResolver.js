const AIChoiceResolver = {
    resolve(pendingChoice, player, personality) {
        if (!pendingChoice) return null;

        switch(pendingChoice.type) {
            case 'commanderAction':
                return this.resolveCommanderAction(pendingChoice, player);
                
            case 'resourceSelect':
                return this.resolveResourceSelect(pendingChoice, player);
                
            case 'gearUpgrade':
                return this.resolveGearUpgrade(pendingChoice, player, personality);
                
            case 'gearPurchase':
            case 'gear':
                return this.resolveGearPurchase(pendingChoice, player, personality);
                
            case 'raidSelect':
                return this.resolveRaidSelect(pendingChoice, player);

            case 'favorSelect':
                return this.resolveFavorSelect(pendingChoice, player);
                
            case 'passiveChoice':
                return this.resolvePassiveChoice(pendingChoice, player, personality);
                
            case 'hexPlacement':
                return this.resolveHexPlacement(pendingChoice, player);

            case 'kirkSelectCubeSource':
                return this.resolveKirkCubeSource(pendingChoice, player);

            case 'kirkSelectCubeOwner':
                return this.resolveKirkCubeOwner(pendingChoice, player);

            case 'kirkSelectCubeDest':
                return this.resolveKirkCubeDest(pendingChoice, player);

            case 'strengthReward':
                return this.resolveStrengthReward(pendingChoice, player, personality);
                
            default:
                console.warn("AI Choice Resolver: Unknown choice type:", pendingChoice.type);
                return null;
        }
    },
    
    resolveCommanderAction(pc, player) {
        const locId = pc.context.locId;
        const validColors = ['Purple', 'Black', 'Red', 'Yellow', 'Blue', 'Green'];
        
        // Score each possible commander action
        const scores = validColors.map(color => {
            const config = GameEngine.LOCATION_REWARDS[locId][color];
            return {
                color,
                score: this.scoreRewardConfig(config.reward, player)
            };
        });
        
        // Command Center restriction check
        if (locId === 'loc-commandCenter') {
            const hasLt = player.leaders.some(l => l.id && (l.id.startsWith('lt_') || l.type === 'lieutenant'));
            const hasCol = player.leaders.some(l => l.id && (l.id.startsWith('col_') || l.type === 'colonel'));
            
            // Filter out invalid options
            if (!hasLt) {
                // Cannot take Black/Green if no Lt
                scores.forEach(s => { if (s.color === 'Black' || s.color === 'Green') s.score = -1000; });
            }
            if (!hasCol) {
                // Cannot take Purple if no Col
                scores.forEach(s => { if (s.color === 'Purple') s.score = -1000; });
            }
        }

        scores.sort((a, b) => b.score - a.score);
        return scores[0].color;
    },
    
    scoreRewardConfig(reward, player, context = {}) {
        if (!reward) return 0;
        let score = 0;
        
        // Capped rewards should be worth less
        if (reward.treasures) {
            // Aggressive diminishing returns: 2 is okay, 4 is risky, 6+ is hoarding
            let tValue = 2;
            if (player.treasures >= 4) tValue = 1;
            if (player.treasures >= 7) tValue = 0.5;
            score += reward.treasures * tValue;
        }
        if (reward.influence) {
            const currentInf = player.influence || 0;
            const remainingSpace = Math.max(0, 12 - currentInf);
            const actualGain = Math.min(reward.influence, remainingSpace);
            score += actualGain * 3;
            if (reward.influence > actualGain) score += (reward.influence - actualGain) * 0.5; // Slight value for "overflow" just in case
        }
        
        if (reward.resources) {
            for (const [res, val] of Object.entries(reward.resources)) {
                score += val * this.getResourceValue(res, player);
            }
        }
        
        if (reward.cards) {
            if (reward.cards.type === 'favors') {
                score += 12;
            } else if (['lieutenant', 'colonel', 'general'].includes(reward.cards.type)) {
                // RANK PREREQUISITES check for scoring
                const type = reward.cards.type;
                let meetsRank = true;
                if (type === 'colonel') {
                    meetsRank = player.leaders.some(l => l.id && (l.id.startsWith('lt_') || l.type === 'lieutenant'));
                } else if (type === 'general') {
                    meetsRank = player.leaders.some(l => l.id && (l.id.startsWith('col_') || l.type === 'colonel'));
                }
                
                if (meetsRank) {
                    // Leaders are good, but maybe value them less if we have many?
                    score += 20; // Assuming count is 1 for leader cards, or adjust if reward.cards.count exists
                } else {
                    // Penalize if prerequisite not met
                    score -= 50; 
                }
            }
        }
        
        if (reward.special) {
            if (reward.special === 'gearPurchase') {
                const canAffordAny = this.resolveGearPurchase({ context: { config: reward } }, player, { gearFocus: [] }) !== null;
                if (canAffordAny) {
                    score += 12; // Moderate magnet strength
                } else {
                    // FUTILITY PENALTY: Penalty if checking Armory but can't buy anything
                    score -= 5;
                    // Lower value for treasures if we can't buy gear anyway
                    if (reward.treasures) score -= reward.treasures * 1;
                }
            }
            else if (reward.special === 'gearUpgrade') {
                const hasUpgradable = player.gear.some(g => !g.upgraded);
                score += hasUpgradable ? 15 : 0;
            }
            else if (reward.special === 'resourceSelect') score += (reward.count || 0) * 4;
            else if (reward.special === 'raidSelect') {
                // Hand size limit check
                const handLimit = 3;
                if (player.raidsInHand && player.raidsInHand.length >= handLimit) score += 2; // Very low value if full
                else score += (reward.count || 0) * 15;
            }
        }
        
        return score;
    },

    getResourceValue(res, player) {
        let value = 4;
        
        // Value for Raids in hand
        if (player.raidsInHand) {
            player.raidsInHand.forEach(raid => {
                const reqs = raid.reqDetails || {};
                if (reqs[res] > player.resources[res]) value += 5;
            });
        }

        if (GameState.board && GameState.board.market && GameState.board.market.gear) {
            const resMap = { 'archer': 'yellow', 'yellow': 'yellow', 'marine': 'blue', 'blue': 'blue', 'warrior': 'red', 'red': 'red', 'specialist': 'green', 'green': 'green', 'any': 'any' };
            GameState.board.market.gear.forEach(gear => {
                const baseCostRes = gear.baseCostResourceType ? gear.baseCostResourceType.toLowerCase() : null;
                const resKey = baseCostRes ? (resMap[baseCostRes] || (baseCostRes === 'any' ? 'any' : null)) : null;
                
                if (resKey === res || resKey === 'any') value += 3;
                
                if (gear.baseCostDetails) {
                    for (const rawKey of Object.keys(gear.baseCostDetails)) {
                        const key = resMap[rawKey.toLowerCase()] || (rawKey.toLowerCase() === 'any' ? 'any' : null);
                        if (key === res || key === 'any') value += 2;
                    }
                }
            });
        }

        if (res === 'green') value += 3; // Specialists are priority
        return value;
    },

    resolveResourceSelect(pc, player) {
        const max = pc.context.config.count;
        const allowGreen = pc.context.config.allowGreen;
        
        const selection = { yellow: 0, blue: 0, red: 0, green: 0 };
        let remaining = max;
        
        const colors = ['yellow', 'blue', 'red', 'green']
            .filter(c => allowGreen || c !== 'green')
            .sort((a, b) => this.getResourceValue(b, player) - this.getResourceValue(a, player));
        
        for (const color of colors) {
            if (remaining <= 0) break;
            // Just take one of each until remaining is exhausted, or fill most needed
            const take = 1; 
            selection[color] = take;
            remaining -= take;
        }
        
        if (remaining > 0) {
            selection[colors[0]] += remaining;
        }
        
        return selection;
    },
    
    resolveGearUpgrade(pc, player, personality) {
        // Choose gear that isn't upgraded yet
        const eligible = player.gear.filter(g => !g.upgraded);
        if (eligible.length === 0) return null;
        
        // Prioritize based on personality
        eligible.sort((a, b) => {
            if (personality.gearFocus.includes('weapons')) {
                const aIsWeapon = a.name.toLowerCase().match(/axe|sword|dagger|bow/);
                const bIsWeapon = b.name.toLowerCase().match(/axe|sword|dagger|bow/);
                if (aIsWeapon && !bIsWeapon) return -1;
                if (!aIsWeapon && bIsWeapon) return 1;
            }
            return b.upgradedVP - a.upgradedVP;
        });
        
        return eligible[0].id;
    },
    
    resolveGearPurchase(pc, player, personality) {
        if (player.isAI) console.log(`AI ${player.id} evaluating gear purchase...`);
        const market = GameState.board.market.gear;
        if (market.length === 0) return null;
        
        let eligible = market.filter(card => !player.gear.some(g => g.name === card.name));
        if (eligible.length === 0) return null;

        const discount = (pc.context && pc.context.config && pc.context.config.discount) ? pc.context.config.discount : {};
        eligible = eligible.filter(gear => {
            const baseCostRes = gear.baseCostResourceType ? gear.baseCostResourceType.toLowerCase() : null;
            let resCost = gear.baseCostResource || 0;
            let infCost = gear.baseCostInfluence || 0;
            const resMap = { 'archer': 'yellow', 'yellow': 'yellow', 'marine': 'blue', 'blue': 'blue', 'warrior': 'red', 'red': 'red', 'specialist': 'green', 'green': 'green' };

            const mappedBaseRes = baseCostRes ? (resMap[baseCostRes] || baseCostRes) : null;
            if (mappedBaseRes && discount[mappedBaseRes]) resCost = Math.max(0, resCost - discount[mappedBaseRes]);
            if (discount.influence) infCost = Math.max(0, infCost - discount.influence);

            if (player.influence < infCost) return false;
            if (baseCostRes) {
                const resKey = resMap[baseCostRes.toLowerCase()] || (baseCostRes.toLowerCase() === 'any' ? 'any' : null);
                if (resKey === 'any') {
                    const totalRes = Object.values(player.resources).reduce((a, b) => a + b, 0);
                    if (totalRes < resCost) return false;
                } else if (resKey && player.resources[resKey] < resCost) return false;
            }
            if (gear.baseCostDetails) {
                for (const [rawKey, amount] of Object.entries(gear.baseCostDetails)) {
                    const resKey = resMap[rawKey.toLowerCase()] || (rawKey.toLowerCase() === 'any' ? 'any' : null);
                    if (resKey === 'any') {
                        const totalRes = Object.values(player.resources).reduce((a, b) => a + b, 0);
                        if (totalRes < amount) return false;
                    } else if (resKey && player.resources[resKey] < amount) return false;
                }
            }
            return true;
        });

        if (player.isAI) console.log(`AI ${player.id} affordable gear count: ${eligible.length}`);
        if (eligible.length === 0) return null;

        // Score gear
        const scores = eligible.map(gear => {
            let score = gear.basicVP + (gear.upgradedVP || 0);
            if (personality.gearFocus.includes('weapons') && gear.name.toLowerCase().match(/axe|sword|dagger|bow/)) score += 10;
            if (personality.gearFocus.includes('strength') && (gear.basicStrength || 0) > 0) score += 5;
            return { id: gear.id, score };
        });
        
        scores.sort((a, b) => b.score - a.score);
        return scores[0].id;
    },

    resolveRaidSelect(pc, player) {
        const market = GameState.board.market.raids;
        if (market.length === 0) return null;
        
        // Prioritize raids we can almost complete or high VP
        const scores = market.map(raid => {
            let score = raid.baseVP;
            // Check synergy with current resources
            const reqs = raid.reqDetails || {};
            for (const [res, val] of Object.entries(reqs)) {
                if (player.resources[res] >= val) score += 2;
            }
            return { id: raid.id, score };
        });
        
        scores.sort((a, b) => b.score - a.score);
        return scores[0].id; // Returns first ID, engine might call multiple times if count > 1
    },

    resolveFavorSelect(pc, player) {
        // Gen Polasky / Cape choice
        const options = pc.context.options;
        // Simple: pick first one or based on type
        return 0; // Return index
    },

    resolvePassiveChoice(pc, player, personality) {
        // Colonel kraus/garnica/gardner "-1 Influence OR Gain 1 Treasure"
        if (pc.context.leaderId.startsWith('col_')) {
            // Economist favors treasure, Aggressive favors discount (to spend more elsewhere)
            if (personality.id === 'economist') return 1; // Treasure
            return 0; // Discount
        }
        
        // Lt Beier/Hicks choice of resource
        if (pc.context.leaderId.startsWith('lt_')) {
            return 0; // Just pick first one for now
        }
        
        return 0;
    },

    resolveHexPlacement(pc, player) {
        const raidType = pc.context.raidType;
        // Find best hex of that type
        const eligible = GameState.board.hexGrid.filter(h => h.type === 'All' || h.type === raidType);
        
        // Strategy: 
        // 1. Where we already have presence but not majority
        // 2. High VP hexes
        const scores = eligible.map(hex => {
            let score = hex.vp;
            const markers = GameState.board.placedMarkers.filter(m => m.hexId === hex.id);
            const myCount = markers.filter(m => m.playerIndex === player.id).length;
            const otherCounts = {};
            markers.forEach(m => {
                if (m.playerIndex !== player.id) {
                    otherCounts[m.playerIndex] = (otherCounts[m.playerIndex] || 0) + 1;
                }
            });
            const maxOther = Math.max(0, ...Object.values(otherCounts));
            
            if (myCount > maxOther) score += 5; // Defending majority
            else if (myCount === maxOther) score += 10; // Taking majority
            else if (myCount < maxOther) score += 2; // Building presence
            
            return { id: hex.id, score };
        });
        
        scores.sort((a, b) => b.score - a.score);
        return scores[0].id;
    },

    // General Kirk cube-move mini-flow (AI heuristics — simple but reasonable,
    // not exploitable): disrupt the highest-value hex an opponent controls,
    // targeting whichever opponent is currently ahead on VP, and shove their
    // cube to the lowest-value adjacent hex.
    resolveKirkCubeSource(pc, player) {
        const candidateHexIds = [...new Set(
            GameState.board.placedMarkers
                .filter(m => m.playerIndex !== player.id)
                .map(m => m.hexId)
        )];
        if (candidateHexIds.length === 0) return null;

        let best = candidateHexIds[0];
        let bestVp = -1;
        candidateHexIds.forEach(hexId => {
            const hex = GameState.board.hexGrid.find(h => h.id === hexId);
            if (hex && hex.vp > bestVp) { bestVp = hex.vp; best = hexId; }
        });
        return best;
    },

    resolveKirkCubeOwner(pc, player) {
        const { opponentIndexes } = pc.context;
        let best = opponentIndexes[0];
        let bestVp = -1;
        opponentIndexes.forEach(pIdx => {
            const p = GameState.players[pIdx];
            if (p.vp > bestVp) { bestVp = p.vp; best = pIdx; }
        });
        return best;
    },

    resolveKirkCubeDest(pc, player) {
        const options = GameEngine.HEX_ADJACENCY[pc.context.sourceHexId] || [];
        if (options.length === 0) return null;
        let best = options[0];
        let bestVp = Infinity;
        options.forEach(hexId => {
            const hex = GameState.board.hexGrid.find(h => h.id === hexId);
            if (hex && hex.vp < bestVp) { bestVp = hex.vp; best = hexId; }
        });
        return best;
    },

    resolveStrengthReward(pc, player, personality) {
        const threshold = pc.threshold;
        switch(threshold) {
            case 5:
                // Leader vs Specialist
                return personality.id === 'aggressive' ? 'leader' : 'green';
            case 12:
            case 38:
                // Gear pick - handled by resolveGearPurchase style logic
                const market = GameState.board.market.gear;
                const eligible = market.filter(card => !player.gear.some(g => g.name === card.name));
                return eligible.length > 0 ? eligible[0].id : null;
            case 18:
                // Path A vs B
                return personality.id === 'economist' ? 'pathA' : 'pathB';
            case 25:
            case 32:
                return 'path';
            case 45:
                // VP vs Favors vs Upgrade
                if (personality.id === 'aggressive') return 'vp';
                return 'upgrade';
        }
        return null;
    },

    resolveStartingOfficer(player, officers) {
        // officers is array of 2
        const scores = officers.map((off, idx) => {
            let score = off.strength * 5;
            if (off.passiveAbility.toLowerCase().includes('influence')) score += 10;
            if (off.passiveAbility.toLowerCase().includes('treasure')) score += 8;
            return { index: idx, score };
        });
        scores.sort((a, b) => b.score - a.score);
        return scores[0].index;
    },

    resolveStartingRaid(player, raids) {
        // raids is array of 2
        const scores = raids.map((raid, idx) => {
            let score = 20 - raid.reqStrength;
            score += raid.baseVP;
            return { index: idx, score };
        });
        scores.sort((a, b) => b.score - a.score);
        return scores[0].index;
    }
};

if (typeof module !== 'undefined') {
    module.exports = AIChoiceResolver;
} else {
    window.AIChoiceResolver = AIChoiceResolver;
}
