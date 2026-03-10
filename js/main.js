// =============================================
//  TOTAL ANNIHILATION: REBORN — Entry Point
// =============================================
import { Game }         from './game.js';
import { Renderer }     from './renderer.js';
import { InputHandler } from './input.js';
import { UIManager }    from './ui.js';
import { formatTime }   from './utils.js';
import { TILE_SIZE }    from './constants.js';

let game     = null;
let renderer = null;
let input    = null;
let ui       = null;
let lastTime = null;
let rafId    = null;

// ---- Menu / Startup ----
window.startGame = function(faction) {
  document.getElementById('menu-screen').style.display = 'none';
  document.getElementById('game-screen').classList.remove('hidden');

  initGame(faction);
};

window.returnToMenu = function() {
  if (rafId) cancelAnimationFrame(rafId);
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('menu-screen').style.display = '';
  game = renderer = input = ui = null;
};

function initGame(faction) {
  // Set up canvas
  const canvas     = document.getElementById('game-canvas');
  const mmCanvas   = document.getElementById('minimap-canvas');

  game     = new Game(faction);
  ui       = new UIManager();
  renderer = new Renderer(canvas, mmCanvas);
  input    = new InputHandler(canvas, renderer, game, ui);

  // Center camera on human commander
  const humanPlayer = game.players.find(p => p.isHuman);
  const cmd = humanPlayer.commander;
  if (cmd) {
    renderer.camX = cmd.x - renderer.viewW / 2;
    renderer.camY = cmd.y - renderer.viewH / 2;
    renderer.clampCamera(game.map);
  }

  lastTime = performance.now();
  rafId = requestAnimationFrame(gameLoop);
}

// ---- Main Game Loop ----
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = timestamp;

  // Scroll camera
  input.updateScroll(dt);

  // Update game state
  game.update(dt);

  // Flush notifications from game into UI
  while (game._notifQueue.length) {
    const { msg, playerId } = game._notifQueue.shift();
    const humanPlayer = game.players.find(p => p.isHuman);
    if (!humanPlayer || playerId === humanPlayer.id) {
      ui.showNotification(msg, playerId);
    }
  }

  // Update UI
  const humanPlayer = game.players.find(p => p.isHuman);
  if (humanPlayer) {
    ui.updateResourceBar(humanPlayer, formatTime(game.time));
    ui.updateSelectionPanel(game, humanPlayer);
  }
  ui.update(dt);

  // Render
  renderer.render(game, ui);

  // Check game over
  if (game.gameOver) {
    const won = !!game.winner;
    ui.showGameOver(won, humanPlayer?.faction);
    return; // stop loop
  }

  rafId = requestAnimationFrame(gameLoop);
}

// ---- Keyboard shortcuts ----
window.addEventListener('keydown', e => {
  if (!game) return;

  // Center camera on commander: press H
  if (e.key === 'h' || e.key === 'H') {
    const hp  = game.players.find(p => p.isHuman);
    const cmd = hp?.commander;
    if (cmd && !cmd.dead) {
      renderer.camX = cmd.x - renderer.viewW / 2;
      renderer.camY = cmd.y - renderer.viewH / 2;
      renderer.clampCamera(game.map);
    }
  }

  // Select all units: Ctrl+A
  if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault();
    const hp = game.players.find(p => p.isHuman);
    if (!hp) return;
    game.deselectAll(hp.id);
    for (const u of game.units) {
      if (u.playerId === hp.id && !u.dead) u.selected = true;
    }
  }
});
