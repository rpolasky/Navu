/**
 * Dialogs — a themed replacement for the browser's native alert()/confirm().
 *
 * This exists so every notification and yes/no prompt in the game looks and
 * feels like part of Navu (gold/Cinzel "war council" styling) instead of a
 * plain OS dialog box, and so future UI work only has to touch one place.
 *
 * Usage:
 *   Dialogs.alert("Not enough influence!");                 // fire-and-forget
 *   Dialogs.alert("Not enough influence!", { title: "..." });
 *
 *   const yes = await Dialogs.confirm("Spend 2 Treasures?");  // Promise<boolean>
 *   if (yes) { ... }
 *
 *   Dialogs.showGameOver([{ name: 'Player 1', vp: 42 }, ...]);
 *
 * Native confirm() is synchronous; Dialogs.confirm() is Promise-based since a
 * custom modal can't block script execution. Call sites that used to read the
 * result of window.confirm() synchronously need to be written as `async`
 * functions (or use `.then()`), and the code that used to run after the
 * confirm() call needs to move inside that async continuation.
 */
const Dialogs = {
    _ensureOverlay() {
        let overlay = document.getElementById('app-dialog-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'app-dialog-overlay';
            document.body.appendChild(overlay);
        }
        return overlay;
    },

    _close(overlay) {
        overlay.style.display = 'none';
        overlay.innerHTML = '';
    },

    /**
     * Themed replacement for alert(). Shows a message with a single
     * "OK" button. Does not block execution (nothing after the call
     * waits on it) — matching how alert() was actually used in this
     * codebase (fire-and-forget notifications, not for reading a result).
     */
    alert(message, { title = 'Navu' } = {}) {
        const overlay = this._ensureOverlay();
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="app-dialog">
                <h3 class="app-dialog-title">${title}</h3>
                <div class="app-dialog-body">${message}</div>
                <div class="app-dialog-actions">
                    <button class="app-dialog-btn primary" data-action="ok">OK</button>
                </div>
            </div>
        `;
        overlay.querySelector('[data-action="ok"]').addEventListener('click', () => this._close(overlay));
    },

    /**
     * Themed replacement for confirm(). Returns a Promise<boolean> that
     * resolves true/false based on which button is pressed.
     */
    confirm(message, { title = 'Navu', confirmLabel = 'Confirm', cancelLabel = 'Cancel' } = {}) {
        const overlay = this._ensureOverlay();
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="app-dialog">
                <h3 class="app-dialog-title">${title}</h3>
                <div class="app-dialog-body">${message}</div>
                <div class="app-dialog-actions">
                    <button class="app-dialog-btn secondary" data-action="cancel">${cancelLabel}</button>
                    <button class="app-dialog-btn primary" data-action="confirm">${confirmLabel}</button>
                </div>
            </div>
        `;
        return new Promise((resolve) => {
            overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
                this._close(overlay);
                resolve(true);
            });
            overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => {
                this._close(overlay);
                resolve(false);
            });
        });
    },

    /**
     * Full end-of-game results panel, replacing the old stacked-string
     * alert(). `scores` is [{ name, vp, breakdown }, ...], already sorted
     * winner-first. `breakdown` is { raids, gear, treasures, theos, endGameBonus }
     * (see cp.vpBreakdown in engine.js for what each category actually covers).
     */
    showGameOver(scores) {
        const overlay = this._ensureOverlay();
        overlay.style.display = 'flex';

        const categoryLabels = [
            { key: 'raids', label: 'Raid Treasures' },
            { key: 'gear', label: 'Gear Treasures' },
            { key: 'treasures', label: 'Board Treasures' },
            { key: 'theos', label: 'Theos Treasures' },
            { key: 'endGameBonus', label: 'End-Game Bonus Treasures' }
        ];

        const playerBlocks = scores.map((s, i) => {
            const b = s.breakdown || {};
            const rows = categoryLabels.map(c =>
                `<li><span>${c.label}</span><span>${b[c.key] || 0}</span></li>`
            ).join('');
            return `
                <div class="game-over-player${i === 0 ? ' winner' : ''}">
                    <div class="game-over-player-header">
                        <span class="game-over-player-name">${s.name}${i === 0 ? ' 🏆' : ''}</span>
                        <span class="game-over-player-total">${s.vp} VP</span>
                    </div>
                    <ul class="game-over-breakdown">${rows}</ul>
                </div>
            `;
        }).join('');

        overlay.innerHTML = `
            <div class="app-dialog game-over">
                <h3 class="app-dialog-title">Game Over — ${scores[0].name} wins!</h3>
                <div class="game-over-players">${playerBlocks}</div>
                <div class="app-dialog-actions">
                    <button class="app-dialog-btn primary" data-action="ok">Close</button>
                </div>
            </div>
        `;
        overlay.querySelector('[data-action="ok"]').addEventListener('click', () => this._close(overlay));
    }
};

if (typeof module !== 'undefined') {
    module.exports = { Dialogs };
} else {
    window.Dialogs = Dialogs;
}
