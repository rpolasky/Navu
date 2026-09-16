const GameCards = {
    gear: [
        {
            id: 'gear_cape',
            name: 'Cape',
            upgradedName: 'Cape of the Crown',
            baseCostInfluence: 5,
            baseCostResource: null,
            baseCostResourceType: null,
            basicStrength: 2,
            upgradedStrength: 3,
            basicVP: 2,
            upgradedVP: 3,
            basicAbility: 'When you get a Favors you can look at an additional card and select that one instead. Place the unselected card on TOP',
            upgradedAbility: 'When you get a Favors you can look at an additional card. You may spend 3 Treasures to keep it.',
            basicImage: 'assets/images/gear/G1.png',
            upgradedImage: 'assets/images/gear/G2.png'
        },
        {
            id: 'gear_breastplate',
            name: 'Breastplate',
            upgradedName: 'Breastplate of the Chosen',
            baseCostInfluence: 2,
            baseCostResource: 2,
            baseCostResourceType: 'Archer', // Yellow
            basicStrength: 3,
            upgradedStrength: 4,
            basicVP: 3,
            upgradedVP: 4,
            basicAbility: 'When gaining Influence gain 2 more',
            upgradedAbility: 'When gaining Influence gain 3 more',
            basicImage: 'assets/images/gear/G3.png',
            upgradedImage: 'assets/images/gear/G4.png'
        },
        {
            id: 'gear_bracers',
            name: 'Bracers',
            upgradedName: 'Bracers of the Mighty',
            baseCostInfluence: 2,
            baseCostResource: 2,
            baseCostResourceType: 'Marine', // Blue
            basicStrength: 3,
            upgradedStrength: 4,
            basicVP: 3,
            upgradedVP: 4,
            basicAbility: 'Utilize any commander\'s bonus/reward when placing the Purple Commander',
            upgradedAbility: 'Utilize any commander\'s bonus/reward when placing the Purple Commander and gain 1 Treasure',
            basicImage: 'assets/images/gear/G5.png',
            upgradedImage: 'assets/images/gear/G6.png'
        },
        {
            id: 'gear_helmet',
            name: 'Helmet',
            upgradedName: 'Helmet of the Exalted',
            baseCostInfluence: 2,
            baseCostResource: 2,
            baseCostResourceType: 'Warrior', // Red
            basicStrength: 3,
            upgradedStrength: 4,
            basicVP: 3,
            upgradedVP: 4,
            basicAbility: 'When gaining a Specialist You may also gain a troop of a different color',
            upgradedAbility: 'When gaining a Specialist You may also gain 2 of a different color',
            basicImage: 'assets/images/gear/G7.png',
            upgradedImage: 'assets/images/gear/G8.png'
        },
        {
            id: 'gear_boots',
            name: 'Boots',
            upgradedName: 'Boots of the High King',
            baseCostInfluence: 0,
            baseCostResource: null,
            baseCostResourceType: null,
            baseCostDetails: { archer: 1, warrior: 1, marine: 1 },
            basicStrength: 4,
            upgradedStrength: 5,
            basicVP: 4,
            upgradedVP: 5,
            basicAbility: 'When completing any raid you may spend one less troop of ANY type or gain 1 Treasure',
            upgradedAbility: 'When completing any raid you may spend one less troop of ANY type AND gain 1 Treasure',
            basicImage: 'assets/images/gear/G9.png',
            upgradedImage: 'assets/images/gear/G10.png'
        },
        {
            id: 'gear_greaves',
            name: 'Greaves',
            upgradedName: 'Greaves of the General',
            baseCostInfluence: 3,
            baseCostResource: 2,
            baseCostDetails: { warrior: 1, archer: 1 },
            basicStrength: 3,
            upgradedStrength: 4,
            basicVP: 3,
            upgradedVP: 4,
            basicAbility: 'When upgrading gear you gain a choice of 1 Specialist or 2 Treasures', // using treasure token
            upgradedAbility: 'When upgrading gear you gain 1 Specialist and 2 Treasures',
            basicImage: 'assets/images/gear/G11.png',
            upgradedImage: 'assets/images/gear/G12.png'
        },
        {
            id: 'gear_gauntlets',
            name: 'Gauntlets',
            upgradedName: 'Gauntlets of the Powerful',
            baseCostInfluence: 0, 
            baseCostResourceType: null,
            baseCostResource: null,
            baseCostDetails: { any: 3 },
            basicStrength: 4,
            upgradedStrength: 5,
            basicVP: 4,
            upgradedVP: 5,
            basicAbility: 'When buying gear you may cycle with any Commander',
            upgradedAbility: 'When buying gear you may cycle and take ANY Commander\'s bonus/reward/discount',
            basicImage: 'assets/images/gear/G13.png',
            upgradedImage: 'assets/images/gear/G14.png'
        },
        {
            id: 'gear_short_sword',
            name: 'Short Sword',
            upgradedName: 'Short Sword of the Marine',
            baseCostInfluence: 2,
            baseCostDetails: { specialist: 2 },
            basicStrength: 5,
            upgradedStrength: 6,
            basicVP: 5,
            upgradedVP: 6,
            basicAbility: 'Utilize any commander\'s bonus/reward when placing the Blue Commander',
            upgradedAbility: 'Utilize any commander\'s bonus/reward when placing the Blue Commander and gain 1 Treasure',
            basicImage: 'assets/images/gear/G15.png',
            upgradedImage: 'assets/images/gear/G16.png'
        },
        {
            id: 'gear_axe',
            name: 'Axe',
            upgradedName: 'Axe of the Warrior',
            baseCostInfluence: 2,
            baseCostDetails: { specialist: 2 },
            basicStrength: 5,
            upgradedStrength: 6,
            basicVP: 5,
            upgradedVP: 6,
            basicAbility: 'Utilize any commander\'s bonus/reward when placing the Red Commander',
            upgradedAbility: 'Utilize any commander\'s bonus/reward when placing the Red Commander and gain 1 Treasure',
            basicImage: 'assets/images/gear/G17.png',
            upgradedImage: 'assets/images/gear/G18.png'
        },
        {
            id: 'gear_bow',
            name: 'Bow',
            upgradedName: 'Long Bow of the Archer',
            baseCostInfluence: 2,
            baseCostDetails: { specialist: 2 },
            basicStrength: 5,
            upgradedStrength: 6,
            basicVP: 5,
            upgradedVP: 6,
            basicAbility: 'Utilize any commander\'s bonus/reward when placing the Yellow Commander',
            upgradedAbility: 'Utilize any commander\'s bonus/reward when placing the Yellow Commander and gain 1 Treasure',
            basicImage: 'assets/images/gear/G19.png',
            upgradedImage: 'assets/images/gear/G20.png'
        },
        {
            id: 'gear_daggers',
            name: 'Daggers',
            upgradedName: 'Daggers of the Specialist',
            baseCostInfluence: 2,
            baseCostDetails: { specialist: 2 },
            basicStrength: 5,
            upgradedStrength: 6,
            basicVP: 5,
            upgradedVP: 6,
            basicAbility: 'Utilize any commander\'s bonus/reward when placing the Green Commander',
            upgradedAbility: 'Utilize any commander\'s bonus/reward when placing the Green Commander and gain 1 Treasure',
            basicImage: 'assets/images/gear/G21.png',
            upgradedImage: 'assets/images/gear/G22.png'
        },
        {
            id: 'gear_shield',
            name: 'Shield',
            upgradedName: 'Shield of the Knight',
            baseCostInfluence: 2,
            baseCostDetails: { specialist: 2 },
            basicStrength: 5,
            upgradedStrength: 6,
            basicVP: 5,
            upgradedVP: 6,
            basicAbility: 'Utilize any commander\'s bonus/reward when placing the Black Commander',
            upgradedAbility: 'Utilize any commander\'s bonus/reward when placing the Black Commander and gain 1 Treasure',
            basicImage: 'assets/images/gear/G23.png',
            upgradedImage: 'assets/images/gear/G24.png'
        }
    ],
    leaders: [
        {
            id: 'col_kraus',
            name: 'Colonel Kraus',
            rank: 'Colonel',
            strength: 3,
            passiveAbility: 'When using the Purple or Black Commander -1 Influence on ANY LOCATION OR GAIN 1 Treasure',
            image: 'assets/images/leaders/CO1.png'
        },
        {
            id: 'col_garnica',
            name: 'Colonel Garnica',
            rank: 'Colonel',
            strength: 3,
            passiveAbility: 'When using the Red or Green Commander -1 Influence on any location OR gain 1 Treasure',
            image: 'assets/images/leaders/CO2.png'
        },
        {
            id: 'col_griffiths',
            name: 'Colonel Griffiths',
            rank: 'Colonel',
            strength: 3,
            passiveAbility: 'Gain 3 Treasure when you complete a Kingdom raid, 2 Treasure for a Town raid, or 1 Treasure for a village raid',
            image: 'assets/images/leaders/CO3.png'
        },
        {
            id: 'col_gardner',
            name: 'Colonel Gardner',
            rank: 'Colonel',
            strength: 3,
            passiveAbility: 'When using the Yellow or Blue Commander -1 Influence on any location OR gain 1 Treasure',
            image: 'assets/images/leaders/CO4.png'
        },
        {
            id: 'col_hall',
            name: 'Colonel Hall',
            rank: 'Colonel',
            strength: 3,
            passiveAbility: 'Gain 2 Treasure when upgrading gear (Once Per Turn & No Favors)',
            image: 'assets/images/leaders/CO5.png'
        },
        {
            id: 'lt_hicks',
            name: 'Lieutenant Hicks',
            rank: 'Lieutenant',
            strength: 2,
            passiveAbility: 'Gain a bonus Archer (Yellow) OR Marine (Blue) OR Warrior (Red) AFTER acquiring 3 or more RESOURCES (No Favors)',
            image: 'assets/images/leaders/LO1.png'
        },
        {
            id: 'lt_lee',
            name: 'Lieutenant Lee',
            rank: 'Lieutenant',
            strength: 2,
            passiveAbility: 'Gain 2 additional Influence AFTER acquiring 2 or more Influence from a location (No Favors)',
            image: 'assets/images/leaders/LO2.png'
        },
        {
            id: 'lt_friz',
            name: 'Lieutenant Friz',
            rank: 'Lieutenant',
            strength: 2,
            passiveAbility: 'Gain a bonus Yellow OR Blue OR Red AFTER acquiring ANY gear (No Favors)',
            image: 'assets/images/leaders/LO3.png'
        },
        {
            id: 'lt_beier',
            name: 'Lieutenant Beier',
            rank: 'Lieutenant',
            strength: 2,
            passiveAbility: 'Gain a bonus Yellow OR Blue OR Red AFTER acquiring 5 or more influence from locations (No Favors)',
            image: 'assets/images/leaders/LO4.png'
        },
        {
            id: 'lt_cates',
            name: 'Lieutenant Cates',
            rank: 'Lieutenant',
            strength: 2,
            passiveAbility: 'Gain a bonus 2 Influence AFTER acquiring ANY gear (No Favors)',
            image: 'assets/images/leaders/LO5.png'
        },
        {
            id: 'gen_polasky',
            name: 'General Polasky',
            rank: 'General',
            strength: 4,
            passiveAbility: 'When gaining a Favor look at 3 instead of 1. Unselected favors returned to the bottom',
            image: 'assets/images/leaders/GO1.png'
        },
        {
            id: 'gen_esparza',
            name: 'General Esparza',
            rank: 'General',
            strength: 4,
            passiveAbility: 'You can spend 1 Green/Specialist when completing any raid to place your raid marker on ANY location on the map',
            image: 'assets/images/leaders/GO2.png'
        },
        {
            id: 'gen_gansen',
            name: 'General Gansen',
            rank: 'General',
            strength: 4,
            passiveAbility: 'As long as you have 33+ Strength you can complete a Kingdom raid bonus objective AT NO COST',
            image: 'assets/images/leaders/GO3.png'
        },
        {
            id: 'gen_kirk',
            name: 'General Kirk',
            rank: 'General',
            strength: 4,
            passiveAbility: 'Pay an extra Blue + Red when you complete a Raid to move an opponents cube in the Land of Theos AND gain 3 Treasure',
            image: 'assets/images/leaders/GO4.png'
        },
        {
            id: 'gen_unknown1', // Based on the pattern, I did not view GO5 yet, skipping for now or putting placeholder. Wait, I will put a placeholder for GO5.
            name: 'General (Unknown 5)',
            rank: 'General',
            strength: 4,
            passiveAbility: '...',
            image: 'assets/images/leaders/GO5.png'
        },
        {
            id: 'stand_officer_1',
            name: 'Standard Officer SO1',
            rank: 'Standard Officer',
            strength: 1,
            passiveAbility: 'Begin the game with 5 additional Influence',
            image: 'assets/images/leaders/SO1.png'
        },
        {
            id: 'stand_officer_2',
            name: 'Standard Officer SO2',
            rank: 'Standard Officer',
            strength: 1,
            passiveAbility: 'Begin the game with your choice of a face up gear card and 1 additional Red/Warrior',
            image: 'assets/images/leaders/SO2.png'
        },
        {
            id: 'stand_officer_3',
            name: 'Standard Officer SO3',
            rank: 'Standard Officer',
            strength: 1,
            passiveAbility: 'Begin the game with an additional 2 Yellow OR Blue OR Red',
            image: 'assets/images/leaders/SO3.png'
        },
        {
            id: 'stand_officer_4',
            name: 'Standard Officer SO4',
            rank: 'Standard Officer',
            strength: 1,
            passiveAbility: 'Begin the game with 5 Treasure Tokens',
            image: 'assets/images/leaders/SO4.png'
        },
        {
            id: 'stand_officer_5',
            name: 'Standard Officer SO5',
            rank: 'Standard Officer',
            strength: 1,
            passiveAbility: 'Begin the game with 1 additional face down raid card and 1 face down lieutenant officer',
            image: 'assets/images/leaders/SO5.png'
        },
        {
            id: 'stand_officer_1_copy',
            name: 'Standard Officer SO1',
            rank: 'Standard Officer',
            strength: 1,
            passiveAbility: 'Begin the game with 5 additional Influence',
            image: 'assets/images/leaders/SO1.png'
        },
        {
            id: 'stand_officer_2_copy',
            name: 'Standard Officer SO2',
            rank: 'Standard Officer',
            strength: 1,
            passiveAbility: 'Begin the game with your choice of a face up gear card and 1 additional Red/Warrior',
            image: 'assets/images/leaders/SO2.png'
        },
        {
            id: 'stand_officer_3_copy',
            name: 'Standard Officer SO3',
            rank: 'Standard Officer',
            strength: 1,
            passiveAbility: 'Begin the game with an additional 2 Yellow OR Blue OR Red',
            image: 'assets/images/leaders/SO3.png'
        },
        {
            id: 'stand_officer_4_copy',
            name: 'Standard Officer SO4',
            rank: 'Standard Officer',
            strength: 1,
            passiveAbility: 'Begin the game with 5 Treasure Tokens',
            image: 'assets/images/leaders/SO4.png'
        },
        {
            id: 'stand_officer_5_copy',
            name: 'Standard Officer SO5',
            rank: 'Standard Officer',
            strength: 1,
            passiveAbility: 'Begin the game with 1 additional face down raid card and 1 face down lieutenant officer',
            image: 'assets/images/leaders/SO5.png'
        }
    ],
    raids: [
        {
            id: 'raid1', name: 'Mythborn Kingdom', type: 'Kingdom',
            reqStrength: 13, reqDetails: { yellow: 3, blue: 3, red: 3, green: 2 },
            baseVP: 12, bonus: 'Royal Slaying: Assassinate a King, Queen & a Prince', bonusVP: 10,
            image: 'assets/images/raids/Raid1.png'
        },
        {
            id: 'raid2', name: 'Everford Kingdom', type: 'Kingdom',
            reqStrength: 11, reqDetails: { yellow: 2, blue: 2, red: 2, green: 2 },
            baseVP: 10, bonus: 'Assassinate the King!', bonusReq: { strength: 15, red: 1, blue: 1, green: 1 }, bonusVP: 4, bonusSword: true,
            image: 'assets/images/raids/Raid2.png'
        },
        {
            id: 'raid3', name: 'Blackhand Kingdom', type: 'Kingdom',
            reqStrength: 11, reqDetails: { yellow: 3, blue: 2, red: 3, green: 1 },
            baseVP: 10, bonus: 'Assassinate the Queen', bonusReq: { strength: 13, red: 1, blue: 1, yellow: 1 }, bonusVP: 3, bonusSword: true,
            image: 'assets/images/raids/Raid3.png'
        },
        {
            id: 'raid4', name: 'Fayborn Kingdom', type: 'Kingdom',
            reqStrength: 11, reqDetails: { yellow: 3, blue: 3, red: 2, green: 1 },
            baseVP: 10, bonus: 'Assassinate the Prince', bonusReq: { strength: 13, red: 1, blue: 1, yellow: 1 }, bonusVP: 3, bonusSword: true,
            image: 'assets/images/raids/Raid4.png'
        },
        {
            id: 'raid5', name: 'Mooncrest Kingdom', type: 'Kingdom',
            reqStrength: 11, reqDetails: { yellow: 2, blue: 3, red: 3, green: 1 },
            baseVP: 10, bonus: 'Assassinate the Queen', bonusReq: { strength: 9, yellow: 1, blue: 1 }, bonusVP: 2, bonusSword: true,
            image: 'assets/images/raids/Raid5.png'
        },
        {
            id: 'raid6', name: 'Iceguard Kingdom', type: 'Kingdom',
            reqStrength: 10, reqDetails: { yellow: 3, blue: 3, red: 3 },
            baseVP: 9, bonus: 'Assassinate the Prince', bonusReq: { strength: 9, red: 1, yellow: 1 }, bonusVP: 2, bonusSword: true,
            image: 'assets/images/raids/Raid6.png'
        },
        {
            id: 'raid7', name: 'DeForest Village', type: 'Village', color: 'Blue',
            reqStrength: 5, reqDetails: { yellow: 2, blue: 1, red: 1 },
            baseVP: 4, bonus: 'Village Pillage', bonusText: 'Raid at least 2 Blue Villages', bonusVP: 4,
            image: 'assets/images/raids/Raid7.png'
        },
        {
            id: 'raid8', name: 'Krahn Village', type: 'Village', color: 'Blue',
            reqStrength: 5, reqDetails: { yellow: 1, blue: 2, red: 1 },
            baseVP: 4, bonus: 'Master of Puppets', bonusText: 'If Power is >35: All remaining troops at 3:1 ratio = 1 VP (Max 10 VP)', bonusVP: 'dynamic',
            image: 'assets/images/raids/Raid8.png'
        },
        {
            id: 'raid9', name: 'Saukgrove Village', type: 'Village', color: 'Blue',
            reqStrength: 5, reqDetails: { yellow: 1, blue: 1, red: 2 },
            baseVP: 4, bonus: 'Maximum Effort', bonusText: 'All your gear is upgraded', bonusVP: 4,
            image: 'assets/images/raids/Raid9.png'
        },
        {
            id: 'raid10', name: 'Sleepmore Village', type: 'Village', color: 'Blue',
            reqStrength: 5, reqDetails: { yellow: 3, red: 1 },
            baseVP: 4, bonus: 'Gearhead', bonusText: 'Have at least 6 gear items', bonusVP: 5,
            image: 'assets/images/raids/Raid10.png'
        },
        {
            id: 'raid11', name: 'Darkreach Village', type: 'Village', color: 'Blue',
            reqStrength: 5, reqDetails: { blue: 3, red: 1 },
            baseVP: 4, bonus: 'King Killer', bonusText: 'Complete 2 Kingdom Raids', bonusVP: 5,
            image: 'assets/images/raids/Raid11.png'
        },
        {
            id: 'raid12', name: 'Ravengulch Village', type: 'Village', color: 'Blue',
            reqStrength: 5, reqDetails: { red: 3, blue: 1 },
            baseVP: 4, bonus: 'Gotta raid them all!', bonusText: 'Raid one of each: Blue, Red, Green, Yellow', bonusVP: 8,
            image: 'assets/images/raids/Raid12.png'
        },
        {
            id: 'raid13', name: 'Mossgrove Village', type: 'Village', color: 'Red',
            reqStrength: 5, reqDetails: { yellow: 2, blue: 2 },
            baseVP: 4, bonus: 'Gotta raid them all!', bonusText: 'Raid one of each: Blue, Red, Green, Yellow', bonusVP: 8,
            image: 'assets/images/raids/Raid13.png'
        },
        {
            id: 'raid14', name: 'Eastmaw Village', type: 'Village', color: 'Red',
            reqStrength: 5, reqDetails: { red: 2, blue: 2 },
            baseVP: 4, bonus: 'King Killer', bonusText: 'Complete 2 Kingdom Raids', bonusVP: 5,
            image: 'assets/images/raids/Raid14.png'
        },
        {
            id: 'raid15', name: 'Newshire Village', type: 'Village', color: 'Red',
            reqStrength: 5, reqDetails: { yellow: 2, red: 2 },
            baseVP: 4, bonus: 'Gearhead', bonusText: 'Have at least 6 gear items', bonusVP: 5,
            image: 'assets/images/raids/Raid15.png'
        },
        {
            id: 'raid16', name: 'Brineborn Village', type: 'Village', color: 'Red',
            reqStrength: 5, reqDetails: { yellow: 3, blue: 1 },
            baseVP: 4, bonus: 'Maximum Effort', bonusText: 'All your gear is upgraded', bonusVP: 4,
            image: 'assets/images/raids/Raid16.png'
        },
        {
            id: 'raid17', name: 'Southfaire Village', type: 'Village', color: 'Red',
            reqStrength: 5, reqDetails: { yellow: 1, red: 3 },
            baseVP: 4, bonus: 'Master of Puppets', bonusText: 'If Power is >35: All remaining troops at 3:1 ratio = 1 VP (Max 10 VP)', bonusVP: 'dynamic',
            image: 'assets/images/raids/Raid17.png'
        },
        {
            id: 'raid18', name: 'Cragbay Village', type: 'Village', color: 'Red',
            reqStrength: 5, reqDetails: { yellow: 1, blue: 3 },
            baseVP: 4, bonus: 'Village Pillage', bonusText: 'Raid at least 2 Red Villages', bonusVP: 4,
            image: 'assets/images/raids/Raid18.png'
        },
        {
            id: 'raid19', name: 'Riverstone Town', type: 'Town', color: 'Green',
            reqStrength: 7, reqDetails: { yellow: 1, blue: 1, green: 2 },
            baseVP: 6, bonus: 'Town Terror', bonusText: 'Raid at least 2 Green Towns', bonusVP: 6,
            image: 'assets/images/raids/Raid19.png'
        },
        {
            id: 'raid20', name: 'Pineshield Town', type: 'Town', color: 'Green',
            reqStrength: 7, reqDetails: { red: 1, blue: 1, green: 2 },
            baseVP: 6, bonus: 'Master of Puppets', bonusText: 'If Power is >35: All remaining troops at 3:1 ratio = 1 VP (Max 10 VP)', bonusVP: 'dynamic',
            image: 'assets/images/raids/Raid20.png'
        },
        {
            id: 'raid21', name: 'Graygull Town', type: 'Town', color: 'Green',
            reqStrength: 7, reqDetails: { yellow: 1, red: 1, green: 2 },
            baseVP: 6, bonus: 'Maximum Effort', bonusText: 'All your gear is upgraded', bonusVP: 4,
            image: 'assets/images/raids/Raid21.png'
        },
        {
            id: 'raid22', name: 'Shadowkeep Town', type: 'Town', color: 'Green',
            reqStrength: 7, reqDetails: { blue: 2, red: 4 },
            baseVP: 6, bonus: 'Gearhead', bonusText: 'Have at least 6 gear items', bonusVP: 5,
            image: 'assets/images/raids/Raid22.png'
        },
        {
            id: 'raid23', name: 'Farburrow Town', type: 'Town', color: 'Green',
            reqStrength: 9, reqDetails: { yellow: 2, blue: 2, red: 2, green: 1 },
            baseVP: 8, bonus: 'King Killer', bonusText: 'Complete 2 Kingdom Raids', bonusVP: 5,
            image: 'assets/images/raids/Raid23.png'
        },
        {
            id: 'raid24', name: 'Staghill Town', type: 'Town', color: 'Green',
            reqStrength: 9, reqDetails: { yellow: 3, red: 2, green: 1 },
            baseVP: 8, bonus: 'Gotta raid them all!', bonusText: 'Raid one of each: Blue, Red, Green, Yellow', bonusVP: 8,
            image: 'assets/images/raids/Raid24.png'
        },
        {
            id: 'raid25', name: 'Bearstrand Town', type: 'Town', color: 'Yellow',
            reqStrength: 9, reqDetails: { yellow: 2, blue: 1, red: 3, green: 1 },
            baseVP: 8, bonus: 'Gotta raid them all!', bonusText: 'Raid one of each: Blue, Red, Green, Yellow', bonusVP: 8,
            image: 'assets/images/raids/Raid25.png'
        },
        {
            id: 'raid26', name: 'Thornfall Town', type: 'Town', color: 'Yellow',
            reqStrength: 9, reqDetails: { yellow: 1, blue: 2, red: 2, green: 2 },
            baseVP: 8, bonus: 'King Killer', bonusText: 'Complete 2 Kingdom Raids', bonusVP: 5,
            image: 'assets/images/raids/Raid26.png'
        },
        {
            id: 'raid27', name: 'Wildmire Town', type: 'Town', color: 'Yellow',
            reqStrength: 9, reqDetails: { yellow: 2, blue: 2, red: 2, green: 1 },
            baseVP: 8, bonus: 'Gearhead', bonusText: 'Have at least 6 gear items', bonusVP: 5,
            image: 'assets/images/raids/Raid27.png'
        },
        {
            id: 'raid28', name: 'Mapleshade Town', type: 'Town', color: 'Yellow',
            reqStrength: 9, reqDetails: { yellow: 4, green: 2 },
            baseVP: 8, bonus: 'Maximum Effort', bonusText: 'All your gear is upgraded', bonusVP: 4,
            image: 'assets/images/raids/Raid28.png'
        },
        {
            id: 'raid29', name: 'Sunstrand Town', type: 'Town', color: 'Yellow',
            reqStrength: 9, reqDetails: { yellow: 4, green: 2 },
            baseVP: 8, bonus: 'Master of Puppets', bonusText: 'If Power is >35: All remaining troops at 3:1 ratio = 1 VP (Max 10 VP)', bonusVP: 'dynamic',
            image: 'assets/images/raids/Raid29.png'
        },
        {
            id: 'raid30', name: 'Coldburn Town', type: 'Town', color: 'Yellow',
            reqStrength: 9, reqDetails: { yellow: 3, blue: 2, red: 3 },
            baseVP: 8, bonus: 'Town Terror', bonusText: 'Raid at least 2 Yellow Towns', bonusVP: 6,
            image: 'assets/images/raids/Raid30.png'
        }
    ],
    favorCards: [
        { id: 'fav1', name: 'Favor 1', description: 'Gain 1 Archer, 1 Warrior, & 1 Marine', effect: { type: 'mixed_troops' }, image: 'assets/images/favors/mini-card-final_1.png' },
        { id: 'fav2', name: 'Favor 2', description: 'Gain 3 Treasures', effect: { type: 'treasures', amount: 3 }, image: 'assets/images/favors/mini-card-final_2.png' },
        { id: 'fav3', name: 'Favor 3', description: 'Upgrade a gear item', effect: { type: 'upgrade_gear' }, image: 'assets/images/favors/mini-card-final_3.png' },
        { id: 'fav4', name: 'Favor 4', description: 'Gain 2 Treasures & 1 of any resource', effect: { type: 'treasure_and_any', treasures: 2, any: 1 }, image: 'assets/images/favors/mini-card-final_4.png' },
        { id: 'fav5', name: 'Favor 5', description: 'Gain 2 of any resource', effect: { type: 'any_resource', amount: 2 }, image: 'assets/images/favors/mini-card-final_5.png' },
        { id: 'fav6', name: 'Favor 6', description: 'Gain 3 Influence & 1 of any resource', effect: { type: 'influence_and_any', influence: 3, any: 1 }, image: 'assets/images/favors/mini-card-final_6.png' },
        { id: 'fav7', name: 'Favor 7', description: 'Gain 1 Treasure & Upgrade a gear item', effect: { type: 'treasure_and_upgrade', treasures: 1 }, image: 'assets/images/favors/mini-card-final_7.png' },
        { id: 'fav8', name: 'Favor 8', description: 'Gain 1 Specialist & either 1 leader or raid', effect: { type: 'specialist_and_card', green: 1 }, image: 'assets/images/favors/mini-card-final_8.png' },
        { id: 'fav9', name: 'Favor 9', description: 'Gain 1 Gear card at no cost', effect: { type: 'free_gear' }, image: 'assets/images/favors/mini-card-final_9.png' }
    ]
};
