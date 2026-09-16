const GameUI = {

    // =====================================================================
    // Colored circle Commander token
    // =====================================================================
    makeMeeple(color) {
        // Commander token appearance (shield shape, per-color gradient) lives entirely
        // in css/board.css under .commander / .commander.cmd-<color> — this just sets
        // the class instead of building inline styles, so re-theming only touches CSS.
        const div = document.createElement('div');
        div.className = `commander cmd-${color.toLowerCase()}`;
        div.title = `${color} Commander`;
        return div;
    },

    // Human-readable location name from its id, e.g. 'loc-commandCenter' -> 'Command Center'.
    // Matches the same formula already used for game-log entries, for consistency.
    _getLocationDisplayName(locId) {
        const raw = locId.replace('loc-', '').replace(/([A-Z])/g, ' $1');
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    },

    // =====================================================================
    renderFullState() {
        this.renderPhaseInfo();
        this.renderBoard();
        this.renderInfluenceTrack();
        this.renderStrengthTrack();
        this.renderPlayerDock();
        this.renderMarket();
        this.renderChoiceOverlay();
        this.renderEventLog();
        this.renderSetupPanel();
        this.renderTurnActionsPopup();
    },

    renderPhaseInfo() {
        if (GameState.turn.phase === 'setup') {
            const trackerEl = document.getElementById('phase-tracker-h');
            if (trackerEl) trackerEl.innerHTML = '';
            return;
        }
        this.renderPhaseTracker(GameState.turn.phase);
    },

    // Horizontal 3-step tracker in the top bar: Activate -> Place & Collect ->
    // Turn-in, matching the three phases GameState.turn.phase actually cycles
    // through (the rulebook's "Collect" step is folded into placement resolution).
    renderPhaseTracker(currentPhase) {
        const trackerEl = document.getElementById('phase-tracker-h');
        if (!trackerEl) return;

        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        const steps = [
            { id: 'activate', label: 'Activate' },
            { id: 'place', label: 'Place & Collect' },
            { id: 'turnin', label: 'Turn-in' }
        ];
        const currentIndex = steps.findIndex(s => s.id === currentPhase);

        const stepsHtml = steps.map((step, i) => {
            const state = i < currentIndex ? 'is-done' : (i === currentIndex ? 'is-current' : '');
            const dotContent = i < currentIndex ? '✓' : (i + 1);
            const connector = i < steps.length - 1 ? '<div class="phase-step-connector"></div>' : '';
            return `
                <div class="phase-step ${state}">
                    <div class="phase-step-dot">${dotContent}</div>
                    <div class="phase-step-label">${step.label}</div>
                </div>
                ${connector}
            `;
        }).join('');

        const turnLabel = cp ? `Round ${GameState.turn.roundCount} · ${cp.name}${cp.isAI ? ' (AI)' : ''}` : '';

        trackerEl.innerHTML = `
            <span class="phase-tracker-turn-label">${turnLabel}</span>
            <div class="phase-tracker-steps">${stepsHtml}</div>
        `;

        // Give the "Turn Actions" button a subtle pulse when it's a human's turn
        // and there's something for them to do (Activate/Place/Turn-in step),
        // so it's clear where to look without a popup being forced open.
        const btn = document.getElementById('btn-open-turn-actions');
        if (btn) {
            const needsAttention = cp && !cp.isAI && !GameState.turn.pendingChoice;
            btn.classList.toggle('has-attention', !!needsAttention);
        }
    },

    // =====================================================================
    // Setup panel — shown as a centered overlay before a game has started.
    // Replaces the old always-visible setup buttons in the action rail.
    // =====================================================================
    _ensureSetupPanel() {
        let panel = document.getElementById('setup-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'setup-panel';
            panel.innerHTML = `
                <div class="setup-panel-card">
                    <h1>Navu: Treasures of the Fallen</h1>
                    <p>Select the number of players to begin.</p>
                    <div class="setup-group">
                        <h3>Player Options</h3>
                        <button onclick="window.gameEngine.startGame(2)">Start 2 Player (Human)</button>
                        <button onclick="window.gameEngine.startGame(3)">Start 3 Player (Human)</button>
                    </div>
                    <div class="setup-group setup-group-ai">
                        <h3>Single Player Mode</h3>
                        <div class="setup-ai-select-row">
                            <label for="ai-count">AI Opponents:</label>
                            <select id="ai-count">
                                <option value="1">1 AI</option>
                                <option value="2">2 AIs</option>
                                <option value="3">3 AIs</option>
                                <option value="4">4 AIs</option>
                            </select>
                        </div>
                        <button class="btn-start-ai" onclick="const count = parseInt(document.getElementById('ai-count').value); window.gameEngine.startGame(1, count)">Start Single Player</button>
                    </div>
                </div>
            `;
            document.body.appendChild(panel);
        }
        return panel;
    },

    renderSetupPanel() {
        const panel = this._ensureSetupPanel();
        panel.style.display = (GameState.turn.phase === 'setup') ? 'flex' : 'none';
    },

    // =====================================================================
    // Turn Actions popup — replaces the old always-visible vertical action
    // rail. Shows the current phase's instruction + relevant button(s)
    // (Next Phase for a human, a thinking indicator for AI). Auto-opens once
    // per new phase/turn for a human player (as long as no other overlay —
    // a pendingChoice or Dialogs modal — is already up), and can otherwise
    // be opened/closed anytime via the top bar button.
    // =====================================================================
    _ensureTurnActionsPopup() {
        let popup = document.getElementById('turn-actions-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'turn-actions-popup';
            popup.className = 'side-popup';
            popup.innerHTML = `
                <div class="side-popup-header">
                    <h3>Turn Actions</h3>
                    <button class="side-popup-close" onclick="window.gameUI.toggleTurnActionsPopup(false)">✕</button>
                </div>
                <div class="side-popup-body" id="turn-actions-popup-body"></div>
            `;
            document.body.appendChild(popup);
        }
        return popup;
    },

    toggleTurnActionsPopup(forceState) {
        const popup = this._ensureTurnActionsPopup();
        const show = (forceState !== undefined) ? forceState : (popup.style.display !== 'flex');
        popup.style.display = show ? 'flex' : 'none';
        if (show) this._fillTurnActionsPopupBody();
    },

    _fillTurnActionsPopupBody() {
        const body = document.getElementById('turn-actions-popup-body');
        if (!body) return;
        if (GameState.turn.phase === 'setup') {
            body.innerHTML = '<p>Start a game from the setup screen to begin.</p>';
            return;
        }
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        if (!cp) return;

        if (cp.isAI) {
            body.innerHTML = `<p class="ai-turn-indicator">${cp.name} (${cp.aiPersonality.name}) is thinking...</p>`;
        } else {
            const instructions = {
                activate: 'Activate any Gear Abilities you want to use this turn.',
                place: 'Place your Commander on a Location.',
                turnin: 'Turn in a Raid Card if requirements are met.'
            };
            body.innerHTML = `
                <p>${instructions[GameState.turn.phase] || ''}</p>
                <button id="btn-next-phase" onclick="window.gameEngine.nextPhase()">Next Phase →</button>
            `;
        }
    },

    renderTurnActionsPopup() {
        const popup = this._ensureTurnActionsPopup();
        const isOpen = popup.style.display === 'flex';
        if (isOpen) this._fillTurnActionsPopupBody();

        if (GameState.turn.phase === 'setup') return;
        const cp = GameState.players[GameState.turn.currentPlayerIndex];
        if (!cp) return;

        // Auto-open once per new phase/turn for a human, unless a
        // pendingChoice or themed dialog is already occupying the screen.
        const phaseKey = `${GameState.turn.currentPlayerIndex}:${GameState.turn.phase}:${GameState.turn.roundCount}`;
        const overlayBusy = !!GameState.turn.pendingChoice;
        if (!cp.isAI && !overlayBusy && GameState.turn._lastAutoShownPhaseKey !== phaseKey) {
            GameState.turn._lastAutoShownPhaseKey = phaseKey;
            this.toggleTurnActionsPopup(true);
        }
    },

    // =====================================================================
    // Game Log popup — replaces the old always-visible log panel. Re-uses
    // the existing #game-log id/rendering (renderEventLog) as its content.
    // =====================================================================
    _ensureLogPopup() {
        let popup = document.getElementById('log-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'log-popup';
            popup.className = 'side-popup log-popup';
            popup.innerHTML = `
                <div class="side-popup-header">
                    <h3>Game Log</h3>
                    <button class="side-popup-close" onclick="window.gameUI.toggleLogPopup(false)">✕</button>
                </div>
                <div class="side-popup-body">
                    <div id="game-log"></div>
                </div>
            `;
            document.body.appendChild(popup);
        }
        return popup;
    },

    toggleLogPopup(forceState) {
        const popup = this._ensureLogPopup();
        const show = (forceState !== undefined) ? forceState : (popup.style.display !== 'flex');
        popup.style.display = show ? 'flex' : 'none';
        if (show) this.renderEventLog();
    },

    // =====================================================================
    // Board: place meeples on their locations
    // =====================================================================
    renderBoard() {
        const canPlace = GameState.turn.phase === 'place';
        const boardArea = document.getElementById('locations-area');

        // Clear existing meeple elements but keep locations intact
        document.querySelectorAll('.location').forEach(el => {
            el.innerHTML = '';
            el.classList.toggle('clickable', canPlace);
        });

        // Event delegation for location clicks
        boardArea.onclick = (e) => {
            if (!canPlace) return;
            const locEl = e.target.closest('.location');
            if (locEl) {
                window.gameEngine.requestCommanderPlacement(locEl.id);
            }
        };

        for (const [locId, color] of Object.entries(GameState.board.locations)) {
            const locEl = document.getElementById(locId);
            if (locEl) locEl.appendChild(this.makeMeeple(color));
        }

        this.renderFavorDeck();
        this.renderHexGrid();
    },

    // Small face-down deck visual at the Favors location — see css/board.css
    // .favor-deck-visual for why this exists (favors have no face-up market
    // display the way gear/raid/leader do, so nothing was shown there before).
    renderFavorDeck() {
        const loc = document.getElementById('loc-favors');
        if (!loc) return;
        const deck = document.createElement('div');
        deck.className = 'favor-deck-visual';
        const count = (GameState.board.decks && GameState.board.decks.favors) ? GameState.board.decks.favors.length : 0;
        deck.textContent = count;
        deck.title = `${count} Favor card${count === 1 ? '' : 's'} remaining`;
        loc.appendChild(deck);
    },

    initBoardZoom() {
        const boardArea = document.getElementById('locations-area');
        const zoomImage = document.getElementById('board-zoom-image');
        const zoomContainer = document.getElementById('board-zoom-container');

        if (!boardArea || !zoomImage) return;

        boardArea.addEventListener('mousemove', (e) => {
            const rect = boardArea.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Calculate percentage across the board
            const xPercent = (x / rect.width) * 100;
            const yPercent = (y / rect.height) * 100;

            // Update zoom image position
            // The zoom image is 800% width, so it's 8x as big as its container (theoretically)
            // 100% of #board-zoom-content is 270px. 800% is 2160px.
            
            // Offset logic:
            // Point (xPercent, yPercent) on the 2160px image corresponds to:
            const leftOffset = (xPercent / 100) * 2160;
            const topOffset = (yPercent / 100) * 2160;

            // Center that point in the 270px wide container:
            const transformX = 135 - leftOffset;
            const transformY = 135 - topOffset;

            zoomImage.style.transform = `translate(${transformX}px, ${transformY}px)`;
            zoomImage.style.display = 'block';
        });

        boardArea.addEventListener('mouseleave', () => {
            zoomImage.style.display = 'none';
        });
    },

    renderHexGrid() {
        const boardArea = document.getElementById('locations-area');
        let container = document.getElementById('hex-grid-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'hex-grid-container';
            boardArea.appendChild(container);
        }
        container.innerHTML = '';

        const pc = GameState.turn.pendingChoice;
        const isHexPlacement = pc && pc.type === 'hexPlacement';
        const isKirkSource = pc && pc.type === 'kirkSelectCubeSource';
        const isKirkDest = pc && pc.type === 'kirkSelectCubeDest';
        const kirkDestOptions = isKirkDest ? (window.gameEngine.HEX_ADJACENCY[pc.context.sourceHexId] || []) : [];

        GameState.board.hexGrid.forEach(hex => {
            const el = document.createElement('div');
            el.className = 'hex-segment';
            el.style.top = `${hex.pos.top}%`;
            el.style.left = `${hex.pos.left}%`;
            el.title = `${hex.type} (${hex.vp} VP)`;

            if (isHexPlacement) {
                const isValid = (hex.type === 'All' || hex.type === pc.context.raidType);
                el.classList.add(isValid ? 'valid-choice' : 'invalid-choice');
                if (isValid) {
                    el.onclick = (e) => {
                        e.stopPropagation();
                        window.gameEngine.resolveHexPlacement(hex.id);
                    };
                }
            } else if (isKirkSource) {
                const cp = GameState.players[GameState.turn.currentPlayerIndex];
                const hasOpponentCube = GameState.board.placedMarkers.some(m => m.hexId === hex.id && m.playerIndex !== cp.id);
                el.classList.add(hasOpponentCube ? 'valid-choice' : 'invalid-choice');
                if (hasOpponentCube) {
                    el.onclick = (e) => {
                        e.stopPropagation();
                        window.gameEngine.resolveKirkCubeSource(hex.id);
                    };
                }
            } else if (isKirkDest) {
                const isValid = kirkDestOptions.includes(hex.id);
                el.classList.add(isValid ? 'valid-choice' : 'invalid-choice');
                if (isValid) {
                    el.onclick = (e) => {
                        e.stopPropagation();
                        window.gameEngine.resolveKirkCubeDest(hex.id);
                    };
                }
            }

            // Render markers in this hex
            const markers = GameState.board.placedMarkers.filter(m => m.hexId === hex.id);
            if (markers.length > 0) {
                const markerContainer = document.createElement('div');
                markerContainer.style.display = 'flex';
                markerContainer.style.flexWrap = 'wrap';
                markerContainer.style.justifyContent = 'center';
                markerContainer.style.width = '80%';

                markers.forEach(m => {
                    const player = GameState.players[m.playerIndex];
                    const cube = document.createElement('div');
                    cube.className = 'hex-marker';
                    cube.style.backgroundColor = player.color;
                    markerContainer.appendChild(cube);
                });
                el.appendChild(markerContainer);
            }

            container.appendChild(el);
        });
    },

    // ── Influence track: 5 player rows on the board, each a 13-space (0-12)
    // zigzag (even positions on the row's lower line, odd on its upper line —
    // matches the board art exactly, coordinates measured directly from it).
    // Percentages are relative to #locations-area, same space .location/
    // .hex-segment/.commander already use.
    INFLUENCE_TRACK: {
        baseX: 5.49,   // x of position 0
        xStep: 1.95,   // x increment per position
        baseYBottom: 74.14, // y of P1's lower zigzag line (even positions)
        yZigzag: 1.95,      // how much higher the upper line (odd positions) sits
        rowStep: 4.76       // y increment from one player's row to the next
    },

    _getInfluencePos(value, playerRowIndex) {
        const t = this.INFLUENCE_TRACK;
        const i = Math.max(0, Math.min(12, value)); // track only goes 0-12 (matches the influence cap)
        const x = t.baseX + i * t.xStep;
        const yBottom = t.baseYBottom + playerRowIndex * t.rowStep;
        const y = (i % 2 === 1) ? yBottom - t.yZigzag : yBottom;
        return { x, y };
    },

    // ── Strength tree: not a linear track — a branching hex tree that starts
    // at a single "Start" node, forks into two paths at each of the 7 real
    // strength thresholds (5/12/18/25/32/38/45; 12 and 38 are single center
    // nodes where the two paths rejoin), matching checkStrengthThresholds in
    // engine.js. Coordinates measured directly from the board art.
    STRENGTH_TREE_NODES: [
        { value: 0, x: 83.05, y: 73.29 },
        { value: 5, x: 80.14, y: 75.24 },
        { value: 5, x: 85.94, y: 75.24 },
        { value: 12, x: 83.05, y: 76.89 },
        { value: 18, x: 80.14, y: 78.69 },
        { value: 18, x: 85.94, y: 78.69 },
        { value: 25, x: 80.14, y: 81.69 },
        { value: 25, x: 85.94, y: 81.69 },
        { value: 32, x: 80.14, y: 84.69 },
        { value: 32, x: 85.94, y: 84.69 },
        { value: 38, x: 83.05, y: 86.34 },
        { value: 45, x: 80.14, y: 88.00 },
        { value: 45, x: 85.94, y: 88.00 }
    ],

    // Snaps a strength value down to the highest real checkpoint it has
    // reached (0 if below 5), then picks a spot among that checkpoint's
    // node(s) — alternating by player index when a checkpoint has two nodes
    // (Left/Right), purely so players sharing a tier don't sit on the exact
    // same node before the small stacking offset in render*Track spreads
    // same-space discs apart further.
    _getStrengthPos(strength, playerIndex) {
        const thresholds = [0, 5, 12, 18, 25, 32, 38, 45];
        let tier = 0;
        for (const t of thresholds) { if (strength >= t) tier = t; }
        const candidates = this.STRENGTH_TREE_NODES.filter(n => n.value === tier);
        return candidates[playerIndex % candidates.length];
    },

    // Small fixed offsets (in the same percentage units as the coordinates
    // above) so discs that land on the exact same space are still all
    // visible instead of perfectly overlapping.
    _trackStackOffsets: [
        { dx: 0, dy: 0 }, { dx: 0.7, dy: -0.5 }, { dx: -0.7, dy: -0.5 },
        { dx: 0.7, dy: 0.5 }, { dx: -0.7, dy: 0.5 }
    ],

    _renderTrackDiscs(containerId, positions) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        // Group players sharing the exact same (x,y) so they can be spread
        // apart with the small stacking offsets above.
        const groups = {};
        positions.forEach((pos, playerIndex) => {
            if (!pos) return;
            const key = `${pos.x.toFixed(2)},${pos.y.toFixed(2)}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push({ playerIndex, pos });
        });

        Object.values(groups).forEach(group => {
            group.forEach((entry, i) => {
                const offset = this._trackStackOffsets[i % this._trackStackOffsets.length];
                const player = GameState.players[entry.playerIndex];
                const disc = document.createElement('div');
                disc.className = 'track-disc';
                disc.style.left = `${entry.pos.x + offset.dx}%`;
                disc.style.top = `${entry.pos.y + offset.dy}%`;
                disc.title = player.name;
                const inner = document.createElement('div');
                inner.className = 'track-disc-inner';
                inner.style.background = player.color;
                disc.appendChild(inner);
                container.appendChild(disc);
            });
        });
    },

    renderInfluenceTrack() {
        if (!GameState.players || GameState.players.length === 0) {
            const container = document.getElementById('influence-track');
            if (container) container.innerHTML = '';
            return;
        }
        const positions = GameState.players.map((p, i) => this._getInfluencePos(p.influence, i));
        this._renderTrackDiscs('influence-track', positions);
    },

    renderStrengthTrack() {
        if (!GameState.players || GameState.players.length === 0) {
            const container = document.getElementById('strength-track');
            if (container) container.innerHTML = '';
            return;
        }
        const positions = GameState.players.map((p, i) => this._getStrengthPos(this._calcStrength(p), i));
        this._renderTrackDiscs('strength-track', positions);
    },

    // =====================================================================
    // Player Dock
    // =====================================================================
    renderPlayerDock() {
        const container = document.getElementById('player-dock');
        container.innerHTML = '';

        // Viewer switch tabs
        const tabsContainer = document.createElement('div');
        tabsContainer.style.cssText = 'display:flex; margin-bottom:10px; border-bottom:1px solid #444; overflow-x:auto;';
        
        GameState.players.forEach((p, idx) => {
            const tab = document.createElement('div');
            const isActive = idx === GameState.settings.viewerPlayerIndex;
            const isTurn = idx === GameState.turn.currentPlayerIndex;
            
            tab.style.cssText = `
                padding: 6px 12px;
                cursor: pointer;
                border-bottom: 2px solid ${isActive ? p.color : 'transparent'};
                color: ${isActive ? 'white' : '#888'};
                background: ${isActive ? 'rgba(255,255,255,0.05)' : 'transparent'};
                font-size: 0.8rem;
                white-space: nowrap;
                position: relative;
            `;
            tab.textContent = p.isAI ? `AI ${idx - (GameState.settings.numPlayers || 0) + 1}` : p.name;
            
            if (isTurn) {
                const dot = document.createElement('span');
                dot.style.cssText = 'position:absolute; top:4px; right:4px; width:6px; height:6px; background:var(--gold); border-radius:50%;';
                tab.appendChild(dot);
            }
            
            tab.onclick = () => {
                GameState.settings.viewerPlayerIndex = idx;
                this.renderPlayerDock();
            };
            tabsContainer.appendChild(tab);
        });
        container.appendChild(tabsContainer);

        const cp = GameState.players[GameState.settings.viewerPlayerIndex];
        if (!cp) return;

        const header = document.createElement('p');
        header.style.cssText = 'margin:0 0 6px; font-weight:bold; color:var(--gold); font-family:Cinzel,serif;';
        header.textContent = cp.isAI ? `${cp.name} (AI - ${cp.aiPersonality.name})` : cp.name;
        container.appendChild(header);

        if (cp.isAI) {
            const personalityDesc = document.createElement('p');
            personalityDesc.style.cssText = 'font-size:0.75rem; color:#aaa; margin-top:-4px; margin-bottom:10px; font-style:italic;';
            personalityDesc.textContent = cp.aiPersonality.description;
            container.appendChild(personalityDesc);
        }

        // Commanders in Hand
        const cmdSec = document.createElement('div');
        cmdSec.className = 'player-setup-section';
        cmdSec.innerHTML = '<h4>Your Commanders</h4>';
        const cmdRow = document.createElement('div');
        cmdRow.style.display = 'flex';
        cmdRow.style.gap = '5px';
        cp.commanders.forEach(color => {
            cmdRow.appendChild(this.makeMeeple(color));
        });
        cmdSec.appendChild(cmdRow);
        container.appendChild(cmdSec);

        // Leaders / Officers (the ones already chosen/acquired)
        if (cp.leaders && cp.leaders.length > 0) {
            const leadSec = document.createElement('div');
            leadSec.className = 'player-setup-section';
            leadSec.innerHTML = '<h4>Officers</h4>';
            const row = document.createElement('div');
            row.className = 'starting-officers';
            cp.leaders.forEach(leader => {
                const imgPath = `${leader.image}`;
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `<img src="${imgPath}" alt="${leader.name}" class="card-thumb">`;
                this._attachPreview(card, imgPath);
                row.appendChild(card);
            });
            leadSec.appendChild(row);
            container.appendChild(leadSec);
        }

        // Acquired Gear
        if (cp.gear && cp.gear.length > 0) {
            const gearSec = document.createElement('div');
            gearSec.className = 'player-setup-section';
            gearSec.innerHTML = '<h4>Gear</h4>';
            const row = document.createElement('div');
            row.className = 'player-gear-list';
            row.style.display = 'flex';
            row.style.flexWrap = 'wrap';
            row.style.gap = '5px';
            cp.gear.forEach(item => {
                const imgPath = `${item.upgraded ? item.upgradedImage : item.basicImage}`;

                const wrap = document.createElement('div');
                wrap.style.textAlign = 'center';

                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `<img src="${imgPath}" alt="${item.name}" class="card-thumb">`;
                this._attachPreview(card, imgPath);
                wrap.appendChild(card);

                const isActivated = GameState.turn.activatedGearIds.includes(item.id);
                const isOnCooldown = cp.usedGearLastTurn.includes(item.id);
                const isSelectableForUpgrade = GameState.turn.pendingChoice && GameState.turn.pendingChoice.type === 'gearUpgrade' && !item.upgraded;

                if (isOnCooldown) {
                    card.classList.add('on-cooldown');
                }

                if (isSelectableForUpgrade) {
                    card.classList.add('selectable-card');
                    card.style.cursor = 'pointer';
                    card.onclick = () => window.gameEngine.resolveGearUpgrade(item.id);
                }

                let badge = null;
                if (GameState.turn.phase === 'activate') {
                    if (isActivated) {
                        badge = document.createElement('div');
                        badge.className = 'gear-status-badge';
                        badge.textContent = 'ACTIVE';
                        wrap.appendChild(badge);
                    } else if (isOnCooldown) {
                        badge = document.createElement('div');
                        badge.className = 'gear-status-badge cooldown';
                        badge.textContent = 'COOLDOWN';
                        wrap.appendChild(badge);
                    } else {
                        const btn = document.createElement('button');
                        btn.className = 'btn-gear-activate';
                        btn.textContent = 'Activate';
                        btn.onclick = () => window.gameEngine.activateGear(item.id);
                        wrap.appendChild(btn);
                    }
                } else if (isActivated || isOnCooldown) {
                    badge = document.createElement('div');
                    badge.className = isActivated ? 'gear-status-badge' : 'gear-status-badge cooldown';
                    badge.textContent = isActivated ? 'ACTIVE' : 'COOLDOWN';
                    wrap.appendChild(badge);
                }

                // Upgraded visual enhancement
                if (badge && item.upgraded && isActivated) {
                    badge.textContent = 'ACTIVE (UG)';
                    badge.style.background = 'linear-gradient(135deg, #ffd700, #ff8c00)';
                } else if (!badge && item.upgraded) {
                    const ub = document.createElement('div');
                    ub.className = 'gear-status-badge';
                    ub.style.background = 'linear-gradient(135deg, #ffd700, #ff8c00)';
                    ub.textContent = 'UPGRADED';
                    wrap.appendChild(ub);
                }

                row.appendChild(wrap);
            });
            gearSec.appendChild(row);
            container.appendChild(gearSec);
        }

        // Current Raids
        const allRaids = [
            ...(cp.raidsInHand || []).map(r => ({ ...r, completed: false })),
            ...(cp.completedRaids || []).map(r => ({ ...r, completed: true }))
        ];

        if (allRaids.length > 0) {
            const raidSec = document.createElement('div');
            raidSec.className = 'player-setup-section';
            raidSec.innerHTML = '<h4>Raids</h4>';
            const row = document.createElement('div');
            row.className = 'player-raid-list';
            row.style.display = 'flex';
            row.style.flexWrap = 'wrap';
            row.style.gap = '10px';

            allRaids.forEach(raid => {
                const imgPath = `${raid.image}`;
                const wrap = document.createElement('div');
                wrap.className = 'raid-card-wrapper';
                wrap.style.textAlign = 'center';
                if (raid.completed) {
                    wrap.style.opacity = '0.6';
                    wrap.style.filter = 'grayscale(80%)';
                }

                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `<img src="${imgPath}" alt="${raid.name}" class="card-thumb">`;
                this._attachPreview(card, imgPath);
                wrap.appendChild(card);

                if (!raid.completed) {
                    const btn = document.createElement('button');
                    btn.className = 'btn-raid-complete';
                    btn.textContent = 'Turn In';
                    const currentStrength = this._calcStrength(cp);
                    const reqs = raid.reqDetails || {};
                    const hasStrength = currentStrength >= raid.reqStrength;
                    const hasYellow = cp.resources.yellow >= (reqs.yellow || 0);
                    const hasBlue = cp.resources.blue >= (reqs.blue || 0);
                    const hasRed = cp.resources.red >= (reqs.red || 0);
                    const hasGreen = cp.resources.green >= (reqs.green || 0);

                    if (hasStrength && hasYellow && hasBlue && hasRed && hasGreen) {
                        btn.onclick = () => window.gameEngine.completeRaid(raid.id);
                    } else {
                        btn.disabled = true;
                        btn.style.opacity = '0.5';
                        btn.style.cursor = 'not-allowed';
                    }
                    wrap.appendChild(btn);
                } else {
                    const badge = document.createElement('div');
                    badge.style.cssText = 'font-size: 0.7rem; color: #aaa; font-weight: bold; margin-top: 4px;';
                    badge.textContent = 'COMPLETED';
                    wrap.appendChild(badge);
                }

                row.appendChild(wrap);
            });
            raidSec.appendChild(row);
            container.appendChild(raidSec);
        }

        // Starting Officer Selection (Choice)
        if (cp.startingOfficersChoice && cp.startingOfficersChoice.length > 0) {
            const offSec = document.createElement('div');
            offSec.className = 'player-setup-section';
            offSec.innerHTML = '<h4>Choose a Starting Officer</h4>';
            const row = document.createElement('div');
            row.className = 'starting-officers';
            cp.startingOfficersChoice.forEach(officer => {
                const imgPath = `${officer.image}`;
                const card = document.createElement('div');
                card.className = 'card starting-officer-pick';
                card.style.cursor = 'pointer';
                card.innerHTML = `<img src="${imgPath}" alt="${officer.name}" class="card-thumb">`;
                card.onclick = () => window.gameEngine.selectStartingOfficer(officer.id);
                this._attachPreview(card, imgPath);
                row.appendChild(card);
            });
            offSec.appendChild(row);
            container.appendChild(offSec);
        }

        // Starting Raid Selection (Choice — pick 1 of 2)
        if (cp.startingRaidsChoice && cp.startingRaidsChoice.length > 0) {
            const raidChoiceSec = document.createElement('div');
            raidChoiceSec.className = 'player-setup-section';
            raidChoiceSec.innerHTML = '<h4>Choose a Starting Raid Card</h4><p class="dialog-hint-text">Hover to preview — click to keep. The other returns to the deck.</p>';
            const row = document.createElement('div');
            row.className = 'starting-officers';
            cp.startingRaidsChoice.forEach(raid => {
                const imgPath = `${raid.image}`;
                const card = document.createElement('div');
                card.className = 'card starting-officer-pick';
                card.style.cursor = 'pointer';
                card.innerHTML = `<img src="${imgPath}" alt="${raid.name}" class="card-thumb">`;
                card.onclick = () => window.gameEngine.selectStartingRaid(raid.id);
                this._attachPreview(card, imgPath);
                row.appendChild(card);
            });
            raidChoiceSec.appendChild(row);
            container.appendChild(raidChoiceSec);
        }
        // Favors
        if (cp.favors && cp.favors.length > 0) {
            const favSec = document.createElement('div');
            favSec.className = 'player-setup-section';
            favSec.innerHTML = '<h4>Favors</h4>';
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexWrap = 'wrap';
            row.style.gap = '8px';
            cp.favors.forEach(favor => {
                const imgPath = `${favor.image}`;
                const wrap = document.createElement('div');
                wrap.style.textAlign = 'center';

                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `<img src="${imgPath}" alt="${favor.name}" class="card-thumb">`;
                this._attachPreview(card, imgPath);
                wrap.appendChild(card);

                const title = document.createElement('div');
                title.style.fontSize = '0.6rem';
                title.style.color = '#aaa';
                title.style.marginTop = '2px';
                title.textContent = favor.name;
                wrap.appendChild(title);

                // Use Favor button — available any time during the player's turn
                const useBtn = document.createElement('button');
                useBtn.className = 'btn-raid-complete';
                useBtn.textContent = 'Use Favor';
                useBtn.style.marginTop = '4px';
                useBtn.style.width = '80px';
                useBtn.style.fontSize = '0.65rem';
                useBtn.onclick = () => window.gameEngine.useFavor(favor.id);
                wrap.appendChild(useBtn);

                row.appendChild(wrap);
            });
            favSec.appendChild(row);
            container.appendChild(favSec);
        }

        // Resources + Coin + Strength
        const strength = this._calcStrength(cp);
        const resSec = document.createElement('div');
        resSec.className = 'player-setup-section';
        resSec.innerHTML = `
            <h4>Resources</h4>
            <div class="resources">
                <span class="res-y">${cp.resources.yellow}Y</span>
                <span class="res-b">${cp.resources.blue}B</span>
                <span class="res-r">${cp.resources.red}R</span>
                <span class="res-g">${cp.resources.green}G</span>
                <span class="res-coin">
                    <img src="assets/images/COIN.png" alt="coin" class="res-coin-icon">
                    <strong class="res-coin-count">${cp.treasures}</strong>
                </span>
            </div>
            <div class="player-stat-line">
                ⚔ Strength: <strong class="stat-strength">${strength}</strong>
                &nbsp;|&nbsp; Influence: <strong class="stat-influence">${cp.influence}</strong>
            </div>`;
        container.appendChild(resSec);

        // All-player scoreboard (replaces board track discs)
        if (GameState.players.length > 1) {
            const playerColors = ['yellow', 'red', 'blue', 'green', 'purple'];
            const scoreSec = document.createElement('div');
            scoreSec.className = 'player-setup-section';
            scoreSec.innerHTML = '<h4>All Players</h4>';
            const rows = document.createElement('div');
            rows.className = 'player-scoreboard-rows';
            GameState.players.forEach((p, i) => {
                const isActive = (p.id === GameState.turn.currentPlayerIndex && GameState.turn.phase !== 'setup');
                const str = this._calcStrength(p);
                const colorHex = { yellow: '#ffcc00', red: '#dd2222', blue: '#1090ee', green: '#22bb44', purple: '#8a2be2' };
                const c = colorHex[playerColors[i]] || '#fff';
                const row = document.createElement('div');
                row.className = `player-score-row${isActive ? ' is-active' : ''}`;
                const commanderDots = (p.commanders || [])
                    .map(color => `<span class="commander commander-mini cmd-${color.toLowerCase()}" title="${color} Commander"></span>`)
                    .join('');
                row.innerHTML = `
                    <span class="player-score-dot" style="background:${c};"></span>
                    <span class="player-score-name">${p.name}${isActive ? ' ★' : ''}</span>
                    <span title="Strength" class="player-score-stat">⚔${str}</span>
                    <span title="Influence" class="player-score-stat player-score-stat-influence">◆${p.influence}</span>
                    <span class="player-score-commanders" title="Commanders in hand, ready to place">${commanderDots}</span>`;
                rows.appendChild(row);
            });
            scoreSec.appendChild(rows);
            container.appendChild(scoreSec);
        }
    },

    // Player dashboards removed – all player info is in the left dock.
    renderPlayers() { },

    _calcStrength(player) {
        let total = 0;
        if (player.gear) player.gear.forEach(g => { total += g.upgraded ? (g.upgradedStrength || 0) : (g.basicStrength || 0); });
        if (player.leaders) player.leaders.forEach(l => { total += l.strength || 0; });
        return total;
    },

    // Same as _calcStrength, but also includes face-down leaders (leaders bumped
    // out by a same-rank recruitment swap). Per the rulebook, a face-down
    // leader's strength contributes nothing during normal play, but IS counted
    // when breaking a tie in the Land of Theos end-game scoring — this is used
    // only for that tie-break, never for normal active-strength checks.
    _calcTiebreakStrength(player) {
        let total = this._calcStrength(player);
        if (player.faceDownLeaders) player.faceDownLeaders.forEach(l => { total += l.strength || 0; });
        return total;
    },

    _attachPreview(cardEl, imgSrc) {
        const preview = document.getElementById('card-preview');
        if (!preview) return;
        cardEl.addEventListener('mouseenter', () => {
            preview.innerHTML = `<img src="${imgSrc}" alt="preview">`;
        });
        cardEl.addEventListener('mouseleave', () => {
            preview.innerHTML = '<span>Hover a card to preview</span>';
        });
    },

    // =====================================================================
    // Market
    // =====================================================================
    renderChoiceOverlay() {
        const pc = GameState.turn.pendingChoice;
        let overlay = document.getElementById('choice-overlay');

        if (!pc || pc.minimized) {
            if (overlay) overlay.style.display = 'none';
            if (pc && pc.minimized) {
                this.renderMinimizedChoiceIndicator();
            } else {
                const indicator = document.getElementById('minimized-choice-indicator');
                if (indicator) indicator.style.display = 'none';
            }
            return;
        }

        const indicator = document.getElementById('minimized-choice-indicator');
        if (indicator) indicator.style.display = 'none';

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'choice-overlay';
            document.body.appendChild(overlay);
        }

        overlay.style.display = 'flex';
        if (pc.type === 'confirmPlacement') {
            const { locId, commanderColor } = pc.context;
            const locName = this._getLocationDisplayName(locId);
            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>Confirm Placement</h3>
                    <p>Place your <span class="confirm-placement-color cmd-${commanderColor.toLowerCase()}">${commanderColor}</span> Commander on <strong>${locName}</strong>?</p>
                    <div class="dialog-btn-row">
                        <button onclick="window.gameEngine.resolveConfirmPlacement(false)" class="btn-cancel-action">Cancel</button>
                        <button onclick="window.gameEngine.resolveConfirmPlacement(true)" class="btn-gold">Confirm</button>
                    </div>
                </div>
            `;
        } else if (pc.type === 'color') {
            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>Officer Choice</h3>
                    <p>Select your additional starting resources:</p>
                    <div class="choice-buttons">
                        <button onclick="window.gameEngine.resolveColorChoice('yellow')" class="btn-yellow">+2 Yellow</button>
                        <button onclick="window.gameEngine.resolveColorChoice('blue')" class="btn-blue">+2 Blue</button>
                        <button onclick="window.gameEngine.resolveColorChoice('red')" class="btn-red">+2 Red</button>
                    </div>
                    <button onclick="window.gameEngine.minimizeChoice()" class="btn-dialog-close">Close</button>
                </div>
            `;
        } else if (pc.type === 'commanderAction') {
            const player = GameState.players[GameState.turn.currentPlayerIndex];
            const colors = ['Purple', 'Black', 'Red', 'Yellow', 'Blue', 'Green'];
            const isCommandCenter = pc.context && pc.context.locId === 'loc-commandCenter';

            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>Select Action Color</h3>
                    <p>Choose which commander's action/reward to utilize:</p>
                    <div class="choice-color-grid">
                        ${colors.map(color => {
                let disabled = false;
                let title = "";
                if (isCommandCenter) {
                    if (color === 'Purple') {
                        const hasCol = player.leaders.some(l => l.id && (l.id.startsWith('col_') || l.type === 'colonel'));
                        if (!hasCol) { disabled = true; title = "Needs a Colonel first"; }
                    } else if (color === 'Black' || color === 'Green') {
                        const hasLt = player.leaders.some(l => l.id && (l.id.startsWith('lt_') || l.type === 'lieutenant'));
                        if (!hasLt) { disabled = true; title = "Needs a Lieutenant first"; }
                    }
                }

                return `
                                <button class="choice-color-btn cmd-${color.toLowerCase()}${disabled ? ' is-disabled' : ''}"
                                        onclick="${disabled ? '' : `window.gameEngine.resolveCommanderAction('${color}')`}"
                                        title="${title}">
                                    ${color}
                                </button>
                            `;
            }).join('')}
                    </div>
                    <button onclick="window.gameEngine.minimizeChoice()" class="btn-dialog-close btn-dialog-close-lg">Close</button>
                </div>
            `;
        } else if (pc.type === 'resourceSelect') {
            const max = pc.context.config.count;
            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>Resource Selection</h3>
                    <p>Select any ${max} resources ${pc.context.config.allowGreen ? '(Including Green)' : '(except Green)'}:</p>
                    <div id="res-choice-container" data-max="${max}" class="res-choice-container">
                        <div class="res-counter" data-type="yellow">
                            <span class="res-symbol res-y"></span> <span class="count">0</span>
                            <div>
                                <button class="res-btn-y" onclick="window.gameUI.updateResCounter('yellow', 1)">+</button>
                                <button class="res-btn-y" onclick="window.gameUI.updateResCounter('yellow', -1)">-</button>
                            </div>
                        </div>
                        <div class="res-counter" data-type="blue">
                            <span class="res-symbol res-b"></span> <span class="count">0</span>
                            <div>
                                <button class="res-btn-b" onclick="window.gameUI.updateResCounter('blue', 1)">+</button>
                                <button class="res-btn-b" onclick="window.gameUI.updateResCounter('blue', -1)">-</button>
                            </div>
                        </div>
                        <div class="res-counter" data-type="red">
                            <span class="res-symbol res-r"></span> <span class="count">0</span>
                            <div>
                                <button class="res-btn-r" onclick="window.gameUI.updateResCounter('red', 1)">+</button>
                                <button class="res-btn-r" onclick="window.gameUI.updateResCounter('red', -1)">-</button>
                            </div>
                        </div>
                        ${pc.context.config.allowGreen ? `
                        <div class="res-counter" data-type="green">
                            <span class="res-symbol res-g"></span> <span class="count">0</span>
                            <div>
                                <button class="res-btn-g" onclick="window.gameUI.updateResCounter('green', 1)">+</button>
                                <button class="res-btn-g" onclick="window.gameUI.updateResCounter('green', -1)">-</button>
                            </div>
                        </div>` : ''}
                    </div>
                    <p id="res-total-display">Total: 0 / ${max}</p>
                    <div class="dialog-btn-row">
                        <button id="btn-confirm-res" onclick="window.gameUI.submitResSelection()" disabled>Confirm</button>
                        <button onclick="window.gameEngine.minimizeChoice()">Close</button>
                        <button onclick="window.gameEngine.cancelLocationAction()" class="btn-cancel-action">Back Out / Cancel Action</button>
                    </div>
                </div>
            `;
        } else if (pc.type === 'passiveChoice') {
            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>Officer Ability</h3>
                    <p>Choose your bonus:</p>
                    <div class="choice-buttons vertical">
                        ${pc.context.options.map((opt, i) => `
                            <button onclick="window.gameEngine.resolvePassiveChoice(${i})" 
                                    class="btn-officer-ability">
                                ${opt.label}
                            </button>
                        `).join('')}
                    </div>
                    <div class="dialog-btn-row dialog-btn-row-mt">
                        <button onclick="window.gameEngine.minimizeChoice()">Close</button>
                        <button onclick="window.gameEngine.cancelLocationAction()" class="btn-cancel-action">Back Out / Cancel Action</button>
                    </div>
                </div>
            `;
        } else if (pc.type === 'favorSelect') {
            const source = pc.context.putBackOnTop ? "Cape" : "General Polasky";
            overlay.innerHTML = `
                <div class="choice-modal choice-modal-wide">
                    <h3>Select Favor</h3>
                    <p>${source} allows you to choose from ${pc.context.options.length} favors:</p>
                    <div class="favor-select-grid">
                        ${pc.context.options.map((fav, i) => `
                            <div class="favor-card favor-select-card" onclick="window.gameEngine.resolveFavorSelection(${i})">
                                <div class="favor-select-name">${fav.name}</div>
                                <div class="favor-select-desc">${fav.description}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="dialog-btn-row dialog-btn-row-mt">
                        <button onclick="window.gameEngine.minimizeChoice()">Close</button>
                        <button onclick="window.gameEngine.cancelLocationAction()" class="btn-cancel-action">Back Out / Cancel Action</button>
                    </div>
                </div>
            `;
        } else if (pc.type === 'gearUpgrade') {
            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>Gear Upgrade</h3>
                    <p>Select ${pc.context.count} gear card(s) from your area to upgrade:</p>
                    <p class="dialog-hint-text">(Click on a gear card in your player dock to upgrade it)</p>
                    <button onclick="window.gameEngine.minimizeChoice()" class="btn-dialog-close">Close</button>
                </div>
            `;
        } else if (pc.type === 'gearPurchase') {
            const canCycle = pc.context.config.cycle;
            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>Gear Purchase</h3>
                    <p>Select a gear card from the market to purchase:</p>
                    <p class="dialog-hint-text">(Discounts will be applied automatically)</p>
                    <div class="dialog-btn-row dialog-btn-row-mt-sm">
                        ${canCycle ? `<button onclick="window.gameEngine.cycleGearMarket()">Cycle Market (Refresh)</button>` : ''}
                        <button onclick="window.gameEngine.minimizeChoice()">Close</button>
                        <button onclick="window.gameEngine.cancelLocationAction()" class="btn-cancel-action">Back Out / Cancel Action</button>
                    </div>
                </div>
            `;
        } else if (pc.type === 'hexPlacement') {
            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>Raid Successful!</h3>
                    <p>${pc.context.message}</p>
                    <button onclick="window.gameEngine.minimizeChoice()" class="btn-dialog-close">View Board</button>
                </div>
            `;
        } else if (pc.type === 'kirkSelectCubeSource') {
            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>General Kirk</h3>
                    <p>${pc.context.message}</p>
                    <button onclick="window.gameEngine.minimizeChoice()" class="btn-dialog-close">View Board</button>
                </div>
            `;
        } else if (pc.type === 'kirkSelectCubeOwner') {
            const { opponentIndexes } = pc.context;
            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>General Kirk</h3>
                    <p>Multiple players have a cube here — whose cube do you want to move?</p>
                    <div class="dialog-btn-row">
                        ${opponentIndexes.map(pIdx => {
                            const p = GameState.players[pIdx];
                            return `<button onclick="window.gameEngine.resolveKirkCubeOwner(${pIdx})" style="background:${p.color};">${p.name}</button>`;
                        }).join('')}
                    </div>
                </div>
            `;
        } else if (pc.type === 'kirkSelectCubeDest') {
            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>General Kirk</h3>
                    <p>${pc.context.message}</p>
                    <button onclick="window.gameEngine.minimizeChoice()" class="btn-dialog-close">View Board</button>
                </div>
            `;
        } else if (pc.type === 'gear') {
            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>Gear Choice</h3>
                    <p>Select a gear card from the market:</p>
                    <button onclick="window.gameEngine.minimizeChoice()" class="btn-dialog-close">Close</button>
                </div>
            `;
        } else if (pc.type === 'raidSelect') {
            overlay.innerHTML = `
                <div class="choice-modal">
                    <h3>Raid Selection</h3>
                    <p>Select ${pc.context.config.count || 1} raid card(s) from the market:</p>
                    <button onclick="window.gameEngine.minimizeChoice()" class="btn-dialog-close">Close</button>
                </div>
            `;
        } else if (pc.type === 'leaderRankConflict') {
            const { rank, existingCard, newCard } = pc.context;
            const renderLeaderOption = (card, keepNew) => `
                <div class="leader-conflict-option" onclick="window.gameEngine.resolveLeaderRankConflict(${keepNew})">
                    <img src="${card.image}" alt="${card.name}" class="leader-conflict-img">
                    <div class="leader-conflict-name">${card.name}</div>
                    <div class="leader-conflict-strength">⚔ Strength ${card.strength}</div>
                    <div class="leader-conflict-ability">${card.passiveAbility || ''}</div>
                </div>
            `;
            overlay.innerHTML = `
                <div class="choice-modal choice-modal-wide">
                    <h3>You already have an active ${rank}</h3>
                    <p>You can only have 1 active ${rank}. Choose which stays active — the other is placed face down (it stops giving strength/ability, but its strength can still break a tie in the Land of Theos at the end of the game).</p>
                    <div class="leader-conflict-grid">
                        ${renderLeaderOption(existingCard, false)}
                        ${renderLeaderOption(newCard, true)}
                    </div>
                </div>
            `;
        } else if (pc.type === 'strengthReward') {
            const player = GameState.players[GameState.turn.currentPlayerIndex];
            const threshold = pc.threshold;
            let content = `<h3>${pc.context.message}</h3>`;

            if (threshold === 5) {
                const hasLt = player.leaders.some(l => l.id && (l.id.startsWith('lt_') || l.type === 'lieutenant'));
                const leaderType = hasLt ? 'Colonel' : 'Lieutenant';
                content += `
                    <p>Choose your reward for reaching Strength 5:</p>
                    <div class="choice-buttons">
                        <button onclick="window.gameEngine.resolveStrengthReward(5, 'leader')" class="btn-gold">Gain a ${leaderType}</button>
                        <button onclick="window.gameEngine.resolveStrengthReward(5, 'green')" class="btn-green">Gain 1 Specialist (Green)</button>
                    </div>
                    <button onclick="window.gameEngine.cancelChoice()" class="btn-skip-close">Skip / Close</button>
                `;
            } else if (threshold === 12 || threshold === 38) {
                content += `
                    <p>Reach Strength ${threshold}! Select a face-up Gear card from the market:</p>
                    <p class="dialog-hint-text">(You may only have one of each gear type. Click a card in the market below.)</p>
                    <button onclick="window.gameEngine.minimizeChoice()" class="btn-dialog-close">Close to see Market</button>
                `;
            } else if (threshold === 18) {
                content += `
                    <p>Reach Strength 18! Choose your path:</p>
                    <div class="choice-buttons vertical">
                        <button onclick="window.gameEngine.resolveStrengthReward(18, 'pathA')" class="btn-gold btn-gold-compact">Path Left: Any 3 Resources (No Green)</button>
                        <button onclick="window.gameEngine.resolveStrengthReward(18, 'pathB')" class="btn-gold btn-gold-compact">Path Right: Any 2 Resources (Including Green)</button>
                    </div>
                    <button onclick="window.gameEngine.cancelChoice()" class="btn-skip-close">Skip / Close</button>
                `;
            } else if (threshold === 25) {
                const path = player.strengthPath || 'A';
                const pathDesc = path === 'A' ? 'Any 3 Resources (No Green)' : 'Any 2 Resources (Including Green)';
                content += `
                    <p>Reach Strength 25! You continue on your path:</p>
                    <div class="choice-buttons">
                        <button onclick="window.gameEngine.resolveStrengthReward(25, 'path')" class="btn-gold">Claim ${pathDesc}</button>
                    </div>
                    <button onclick="window.gameEngine.cancelChoice()" class="btn-skip-close">Skip / Close</button>
                `;
            } else if (threshold === 32) {
                const path = player.strengthPath || 'A';
                const rewardDesc = path === 'A' ? 'Gain Full Influence (12)' : 'Gain a Favor Card';
                content += `
                    <p>Reach Strength 32! Your path rewards you with:</p>
                    <div class="choice-buttons">
                        <button onclick="window.gameEngine.resolveStrengthReward(32, 'path')" class="btn-gold">Claim ${rewardDesc}</button>
                    </div>
                    <button onclick="window.gameEngine.cancelChoice()" class="btn-skip-close">Skip / Close</button>
                `;
            } else if (threshold === 45) {
                content += `
                    <p>Reach Strength 45! Final Reward Selection:</p>
                    <div class="choice-buttons vertical">
                        <button onclick="window.gameEngine.resolveStrengthReward(45, 'vp')" class="btn-gold btn-gold-compact">Option 1: 8 VP Treasures</button>
                        <button onclick="window.gameEngine.resolveStrengthReward(45, 'favors')" class="btn-gold btn-gold-compact">Option 2: 2 Favor Cards (Random)</button>
                        <button onclick="window.gameEngine.resolveStrengthReward(45, 'upgrade')" class="btn-gold btn-gold-compact">Option 3: Free Gear Upgrade + 4 VP Treasures</button>
                    </div>
                    <button onclick="window.gameEngine.cancelChoice()" class="btn-skip-close">Skip / Close</button>
                `;
            }

            overlay.innerHTML = `<div class="choice-modal">${content}</div>`;
        }

    },

    updateResCounter(type, delta) {
        const container = document.getElementById('res-choice-container');
        const max = parseInt(container.dataset.max);
        const counters = container.querySelectorAll('.count');
        let total = 0;
        counters.forEach(c => total += parseInt(c.textContent));

        const target = container.querySelector(`[data-type="${type}"] .count`);
        let current = parseInt(target.textContent);

        if (delta > 0 && total < max) {
            target.textContent = current + 1;
            total++;
        } else if (delta < 0 && current > 0) {
            target.textContent = current - 1;
            total--;
        }

        document.getElementById('res-total-display').textContent = `Total: ${total} / ${max}`;
        document.getElementById('btn-confirm-res').disabled = total !== max;
    },

    submitResSelection() {
        const container = document.getElementById('res-choice-container');
        const selections = {
            yellow: parseInt(container.querySelector('[data-type="yellow"] .count').textContent || 0),
            blue: parseInt(container.querySelector('[data-type="blue"] .count').textContent || 0),
            red: parseInt(container.querySelector('[data-type="red"] .count').textContent || 0),
            green: container.querySelector('[data-type="green"] .count') ? parseInt(container.querySelector('[data-type="green"] .count').textContent) : 0
        };
        window.gameEngine.resolveResourceSelect(selections);
    },

    // =====================================================================
    renderMarket() {
        const locArea = document.getElementById('locations-area');
        if (!locArea) return;

        // Remove any previously placed market cards on the board
        locArea.querySelectorAll('.board-market-card').forEach(el => el.remove());

        const pc = GameState.turn.pendingChoice;
        const isGearPurchase = pc && (pc.type === 'gearPurchase' || pc.type === 'gear' || (pc.type === 'strengthReward' && (pc.threshold === 12 || pc.threshold === 38)));
        const isRaidSelect = pc && pc.type === 'raidSelect';
        const isFreeCard = pc && pc.type === 'freeCardChoice';
        const isRaidFree = isFreeCard && (pc.marketType === 'raids' || pc.marketType === 'leaders_raids');

        // Helper: place a card element precisely on the board
        const placeCard = (el, top, left) => {
            el.classList.add('board-market-card');
            // Inline styles guarantee position:absolute wins over .card { position:relative }
            el.style.cssText += `position:absolute !important; top:${top}%; left:${left}%;
                transform:translate(-50%,-50%); width:12.7%; z-index:15; cursor:pointer;`;
            // Force img to fill the wrapper (the .card-thumb class's fixed width must be overridden)
            const img = el.querySelector('img');
            if (img) img.style.cssText += 'width:100% !important; height:auto; display:block; border-radius:4px;';
            locArea.appendChild(el);
        };

        // ── Gear slots ─────────────────────────────────────────────────────
        const gearSlots = [
            { top: 40.3, left: 8.0 },
            { top: 59.8, left: 7.9 },
            { top: 59.4, left: 21.8 },
            { top: 59.5, left: 34.9 },
            { top: 59.5, left: 48.1 },
        ];
        const isFreeGear = isFreeCard && pc.marketType === 'gear';
        GameState.board.market.gear.forEach((card, i) => {
            if (i >= gearSlots.length) return;
            placeCard(this.makeCard(card, 'gear', isGearPurchase || isFreeGear), gearSlots[i].top, gearSlots[i].left);
        });

        // ── Raid slots ─────────────────────────────────────────────────────
        const raidSlots = [
            { top: 59.9, left: 65.0 },
            { top: 59.5, left: 78.2 },
            { top: 59.8, left: 91.7 },
        ];
        GameState.board.market.raids.forEach((card, i) => {
            if (i >= raidSlots.length) return;
            placeCard(this.makeCard(card, 'raids', isRaidSelect || isRaidFree), raidSlots[i].top, raidSlots[i].left);
        });

        // ── Leader slots ───────────────────────────────────────────────────
        const leaderSlots = [
            { top: 88.7, left: 41.4, rank: 'lieutenant' },
            { top: 89.3, left: 56.6, rank: 'colonel'    },
            { top: 89.3, left: 70.1, rank: 'general'    },
        ];
        const lm = GameState.board.market.leaders;
        leaderSlots.forEach(s => {
            const card = lm[s.rank];
            if (!card) return;
            placeCard(this.makeCard(card, 'leader', false), s.top, s.left);
        });

        const preview = document.getElementById('card-preview');
        if (preview && !preview.querySelector('img')) {
            preview.innerHTML = '<span>Hover a card to preview</span>';
        }
    },

    makeCard(card, type, isSelectable = false) {
        const imgPath = `${card.basicImage || card.image}`;
        const div = document.createElement('div');
        div.className = `card ${isSelectable ? 'selectable-card' : ''}`;
        div.innerHTML = `<img src="${imgPath}" alt="${card.name}" class="card-thumb">`;

        if (isSelectable) {
            div.style.cursor = 'pointer';
            div.onclick = (e) => {
                e.stopPropagation();
                if (type === 'gear') {
                    const pc = GameState.turn.pendingChoice;
                    if (pc && pc.type === 'gearPurchase') {
                        window.gameEngine.resolveGearPurchase(card.id);
                    } else if (pc && pc.type === 'strengthReward') {
                        window.gameEngine.resolveStrengthReward(pc.threshold, 'gear', card.id);
                    } else if (pc && pc.type === 'gear') {
                        // Starting Officer SO2: free face-up gear pick
                        window.gameEngine.resolveCardChoice(card.id, 'gear');
                    } else {
                        window.gameEngine.resolveCardChoice(card.id, 'gear');
                    }
                } else if (type === 'raids') {
                    window.gameEngine.resolveCardChoice(card.id, 'raids');
                }
            };
        }

        this._attachPreview(div, imgPath);
        return div;
    },

    renderMinimizedChoiceIndicator() {
        let indicator = document.getElementById('minimized-choice-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'minimized-choice-indicator';
            indicator.style.cssText = `
                position: fixed; bottom: 20px; right: 320px;
                background: var(--gold); color: black; padding: 10px 15px;
                border-radius: 5px; cursor: pointer; font-weight: bold;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5); z-index: 1000;
                font-family: Cinzel, serif; border: 1px solid #000;
            `;
            indicator.onclick = () => {
                if (GameState.turn.pendingChoice) {
                    GameState.turn.pendingChoice.minimized = false;
                    this.renderFullState();
                }
            };
            document.body.appendChild(indicator);
        }
        indicator.style.display = 'block';
        indicator.textContent = '⚠ Choice Pending - Restore Prompt';
    },

    renderEventLog() {
        const logEl = document.getElementById('game-log');
        if (!logEl) return;
        logEl.innerHTML = '';
        GameState.eventLog.slice().reverse().forEach(entry => {
            const div = document.createElement('div');
            div.className = `log-entry ${entry.isPhaseChange ? 'phase-change' : ''}`;
            div.textContent = entry.text;
            logEl.appendChild(div);
        });
    }
};
