// =============================================
//  TOTAL ANNIHILATION: REBORN — Entry Point
// =============================================
import { Game }         from './game.js';
import { Renderer }     from './renderer.js';
import { InputHandler } from './input.js';
import { UIManager }    from './ui.js';
import { formatTime }   from './utils.js';

let game     = null;
let renderer = null;
let input    = null;
let ui       = null;
let lastTime = null;
let rafId    = null;

// Control groups: Map<groupNum, Set<entityId>>
let controlGroups = {};

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
  controlGroups = {};
};

function initGame(faction) {
  const canvas   = document.getElementById('game-canvas');
  const mmCanvas = document.getElementById('minimap-canvas');

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

  controlGroups = {};
  lastTime = performance.now();
  rafId = requestAnimationFrame(gameLoop);
}

// ---- Main Game Loop ----
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  input.updateScroll(dt);
  game.update(dt);

  // Screen shake from large explosions
  for (const e of game._newExplosions ?? []) {
    const power = Math.min(e.radius * 0.15, 10);
    if (power > 2) renderer.shake(power, 0.25);
  }
  game._newExplosions = [];

  // Flush notifications
  while (game._notifQueue.length) {
    const { msg, playerId } = game._notifQueue.shift();
    const humanPlayer = game.players.find(p => p.isHuman);
    if (!humanPlayer || playerId === humanPlayer.id) {
      ui.showNotification(msg, playerId);
    }
  }

  const humanPlayer = game.players.find(p => p.isHuman);
  if (humanPlayer) {
    ui.updateResourceBar(humanPlayer, formatTime(game.time));
    ui.updateSelectionPanel(game, humanPlayer);
  }
  ui.update(dt);

  renderer.render(game, ui, dt);

  if (game.gameOver) {
    const won = !!game.winner;
    ui.showGameOver(won, humanPlayer?.faction);
    return;
  }

  rafId = requestAnimationFrame(gameLoop);
}

// ---- Keyboard Shortcuts ----
window.addEventListener('keydown', e => {
  if (!game) return;
  const hp = game.players.find(p => p.isHuman);
  if (!hp) return;

  // H — jump to commander
  if (e.key === 'h' || e.key === 'H') {
    const cmd = hp.commander;
    if (cmd && !cmd.dead) {
      renderer.camX = cmd.x - renderer.viewW / 2;
      renderer.camY = cmd.y - renderer.viewH / 2;
      renderer.clampCamera(game.map);
    }
    return;
  }

  // Ctrl+A — select all own units
  if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault();
    game.deselectAll(hp.id);
    for (const u of game.units) {
      if (u.playerId === hp.id && !u.dead) u.selected = true;
    }
    return;
  }

  // ---- Control Groups: 1–9 ----
  const num = parseInt(e.key);
  if (num >= 1 && num <= 9) {
    if (e.ctrlKey) {
      // Ctrl+N — assign selected units to group N
      e.preventDefault();
      const selected = game.getSelected(hp.id);
      controlGroups[num] = new Set(selected.map(u => u.id));
      ui.showNotification(`Group ${num} assigned (${selected.length} units)`, hp.id);
    } else if (e.shiftKey) {
      // Shift+N — add group N to current selection
      const group = controlGroups[num];
      if (group) {
        for (const u of game.units) {
          if (group.has(u.id) && !u.dead && u.playerId === hp.id) u.selected = true;
        }
        for (const b of game.buildings) {
          if (group.has(b.id) && !b.dead && b.playerId === hp.id) b.selected = true;
        }
      }
    } else {
      // N — select group N
      const group = controlGroups[num];
      if (group) {
        game.deselectAll(hp.id);
        let found = 0;
        for (const u of game.units) {
          if (group.has(u.id) && !u.dead && u.playerId === hp.id) { u.selected = true; found++; }
        }
        for (const b of game.buildings) {
          if (group.has(b.id) && !b.dead && b.playerId === hp.id) { b.selected = true; found++; }
        }
        // Double-tap to center camera on group
        if (found > 0) {
          let sx = 0, sy = 0, n = 0;
          for (const u of game.units) {
            if (u.selected && u.playerId === hp.id) { sx += u.x; sy += u.y; n++; }
          }
          if (n > 0) {
            renderer.camX = sx/n - renderer.viewW/2;
            renderer.camY = sy/n - renderer.viewH/2;
            renderer.clampCamera(game.map);
          }
        }
      }
    }
  }
});
