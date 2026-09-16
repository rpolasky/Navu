const GameState = {
    players: [],
    board: {
        locations: {
            'loc-favors': 'Blue',
            'loc-barracks': 'Yellow',
            'loc-archery': 'Blue',
            'loc-docks': 'Red',
            'loc-assassins': 'Black',
            'loc-raidOrders': 'Green',
            'loc-contractHall': 'Green',
            'loc-influence': 'Black',
            'loc-blacksmith': 'Yellow',
            'loc-armory': 'Red',
            'loc-commandCenter': 'White'
        },
        decks: {
            gear: [],
            raids: [],
            favors: [],
            leaders: {
                lieutenant: [],
                colonel: [],
                general: []
            }
        },
        market: {
            gear: [],
            raids: [],
            leaders: {
                lieutenant: null,
                colonel: null,
                general: null
            }
        },
        hexGrid: [
            // Center area and Columns (Mapping left-to-right, top-to-bottom)
            
            // Column 1 (Leftmost)
            { id: 'hex-k1', type: 'Kingdom', vp: 6, pos: { top: 27.5, left: 20.1 } },
            { id: 'hex-t6', type: 'All', vp: 5, pos: { top: 36.0, left: 20.3 } },

            // Column 2
            { id: 'hex-t1', type: 'Town', vp: 4, pos: { top: 22.8, left: 27.9 } },
            { id: 'hex-t3', type: 'Village', vp: 2, pos: { top: 31.7, left: 27.8 } },
            { id: 'hex-t4', type: 'Kingdom', vp: 6, pos: { top: 41.0, left: 28.1 } },

            // Column 3
            { id: 'hex-v3', type: 'All', vp: 5, pos: { top: 27.1, left: 35.3 } },
            { id: 'hex-all', type: 'Town', vp: 4, pos: { top: 36.5, left: 35.5 } },
            { id: 'hex-k3', type: 'All', vp: 5, pos: { top: 45.7, left: 35.5 } },

            // Column 4
            { id: 'hex-t2', type: 'Town', vp: 4, pos: { top: 22.5, left: 42.9 } },
            { id: 'hex-v1', type: 'Village', vp: 2, pos: { top: 32.0, left: 42.8 } },
            { id: 'hex-k4', type: 'Kingdom', vp: 6, pos: { top: 40.8, left: 43.4 } },

            // Column 5
            { id: 'hex-k2', type: 'Kingdom', vp: 6, pos: { top: 27.3, left: 50.5 } },
            { id: 'hex-k6', type: 'Town', vp: 4, pos: { top: 36.1, left: 50.7 } },
            { id: 'hex-k5', type: 'Kingdom', vp: 6, pos: { top: 45.3, left: 50.3 } },

            // Column 6 (Rightmost)
            { id: 'hex-v2', type: 'Village', vp: 2, pos: { top: 22.9, left: 58.6 } },
            { id: 'hex-v4', type: 'All', vp: 5, pos: { top: 31.7, left: 58.4 } },
            { id: 'hex-t5', type: 'Village', vp: 2, pos: { top: 41.1, left: 58.4 } }
        ],
        placedMarkers: [], // Global list or map of markers { hexId, playerIndex }
        commanderSwaps: 0
    },
    turn: {
        currentPlayerIndex: 0,
        phase: 'setup', // setup -> activate -> place -> collect -> turnin -> next
        roundCount: 1,
        pendingChoice: null, // { type: 'color'|'gear'|'commanderAction'|'resourceSelect'|'gearUpgrade'|'raidSelect', context: any }
        activatedGearIds: [],
        lastPlacedLocationId: null
    },
    settings: {
        numPlayers: 0,
        numAI: 0,
        endGameTriggered: false,
        viewerPlayerIndex: 0 // Which player's dock the user is currently viewing
    },
    eventLog: [], // Store strings of what happened
};
