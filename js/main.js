// Expose to window for onclick handlers in HTML
window.gameEngine = GameEngine;
window.gameUI = GameUI;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Navu Game Initialized');
    GameUI.initBoardZoom();
    GameUI.renderPhaseInfo();
    GameUI.renderSetupPanel();
});
