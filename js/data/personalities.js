const AIPersonalities = {
    AGGRESSIVE: {
        id: 'aggressive',
        name: "The Warmonger",
        description: "Focuses on military strength and completing high-VP raids as quickly as possible.",
        priorities: {
            raidCompletion: 1.0,      // Prioritize completing raids ASAP
            strengthBuilding: 0.9,    // Highly values strength gear and officers
            resourceHoarding: 0.2,    // Spends resources freely
            gearAcquisition: 0.6,     // Values offensive gear
            influenceEfficiency: 0.4  // Willing to spend influence for power
        },
        riskTolerance: 0.8,           // Will spend down to low resources
        commanderPreference: ['Red', 'Purple'], // Favors military/command locations
        gearFocus: ['weapons', 'strength']      // Prioritizes strength gear
    },
    
    ECONOMIST: {
        id: 'economist',
        name: "The Treasurer",
        description: "Builds a strong economic engine, hoarding resources and maximizing influence efficiency.",
        priorities: {
            raidCompletion: 0.4,
            strengthBuilding: 0.5,
            resourceHoarding: 1.0,    // Loves having buffer resources
            gearAcquisition: 0.7,     // Focuses on economic/utility gear
            influenceEfficiency: 0.9  // Minimizes influence spent
        },
        riskTolerance: 0.2,           // Conservative spending
        commanderPreference: ['Yellow', 'Blue'], // Favors resource locations
        gearFocus: ['economy', 'upgrades']
    },
    
    BALANCED: {
        id: 'balanced',
        name: "The Strategist",
        description: "Adaptive playstyle that balances resource accumulation with military capability.",
        priorities: {
            raidCompletion: 0.7,
            strengthBuilding: 0.7,
            resourceHoarding: 0.6,
            gearAcquisition: 0.6,
            influenceEfficiency: 0.7
        },
        riskTolerance: 0.5,
        commanderPreference: [], // Versatile
        gearFocus: ['versatility']
    }
};

const AIDifficulty = {
    EASY: {
        id: 'easy',
        name: 'Easy',
        errorChance: 0.3,        // 30% chance to make suboptimal choice
        lookahead: 1,            // Only consider immediate turn
        adaptation: 0            // Doesn't react to player strategy
    },
    MEDIUM: {
        id: 'medium',
        name: 'Medium',
        errorChance: 0.1,
        lookahead: 2,            // Considers next turn's setup
        adaptation: 0.3          // Slight reaction to player leads
    },
    HARD: {
        id: 'hard',
        name: 'Hard',
        errorChance: 0.0,
        lookahead: 3,            // Plans multiple turns ahead
        adaptation: 0.7          // Actively counters player strategy
    }
};

if (typeof module !== 'undefined') {
    module.exports = { AIPersonalities, AIDifficulty };
} else {
    window.AIPersonalities = AIPersonalities;
    window.AIDifficulty = AIDifficulty;
}
