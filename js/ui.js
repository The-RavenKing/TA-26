// =============================================
//  TOTAL ANNIHILATION: REBORN — UI Manager
// =============================================
import { TILE_SIZE, UNIT_DEF, BUILDING_DEF, FACTION_COLOR } from './constants.js';
import { worldToTile } from './utils.js';

export class UIManager {
  constructor() {
    this.placingBuilding    = false;
    this.placingBuildingId  = null;
    this.placingBuildingDef = null;
    this.ghostTile          = { tx: 0, ty: 0 };
    this.selBox             = null;

    // Notification queue
    this._notifications    = [];
    this._notifTimer       = 0;

    // DOM refs
    this._actionButtons    = document.getElementById('action-buttons');
    this._unitName         = document.getElementById('unit-name');
    this._unitHpBar        = document.getElementById('unit-hp-bar');
    this._unitHpText       = document.getElementById('unit-hp-text');
    this._unitStatus       = document.getElementById('unit-status');
    this._notifEl          = document.getElementById('notification');
    this._portraitCanvas   = document.getElementById('portrait-canvas');
    this._portraitCtx      = this._portraitCanvas?.getContext('2d');
    this._metalValue       = document.getElementById('metal-value');
    this._metalRate        = document.getElementById('metal-rate');
    this._metalFill        = document.getElementById('metal-fill');
    this._energyValue      = document.getElementById('energy-value');
    this._energyRate       = document.getElementById('energy-rate');
    this._energyFill       = document.getElementById('energy-fill');
    this._gameTime         = document.getElementById('game-time');

    // Tooltip
    this._tooltip = this._createTooltip();
    this._hoveredBtn = null;
  }

  _createTooltip() {
    const el = document.createElement('div');
    el.id = 'tooltip';
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }

  // ---- Resource Bar ----
  updateResourceBar(player, timeStr) {
    if (!player) return;
    this._metalValue .textContent = Math.floor(player.metal);
    this._metalRate  .textContent = (player.metalRate  >= 0 ? '+' : '') + player.metalRate .toFixed(1) + '/s';
    this._metalFill  .style.width = (player.metal  / player.metalCap  * 100) + '%';
    this._metalRate  .style.color = player.metalRate  >= 0 ? '#88aa88' : '#cc4444';

    this._energyValue.textContent = Math.floor(player.energy);
    this._energyRate .textContent = (player.energyRate >= 0 ? '+' : '') + player.energyRate.toFixed(1) + '/s';
    this._energyFill .style.width = (player.energy / player.energyCap * 100) + '%';
    this._energyRate .style.color = player.energyRate >= 0 ? '#88aa88' : '#cc4444';

    if (this._gameTime) this._gameTime.textContent = timeStr;
  }

  // ---- Selection Panel ----
  updateSelectionPanel(game, player) {
    const selected = game.getSelected(player.id);

    if (!selected.length) {
      this._showNoSelection();
      return;
    }

    if (selected.length === 1) {
      this._showSingleSelection(selected[0], game, player);
    } else {
      this._showMultiSelection(selected, game, player);
    }
  }

  _showNoSelection() {
    this._unitName  .textContent = 'No Selection';
    this._unitHpBar .style.width = '0%';
    this._unitHpText.textContent = '';
    this._unitStatus.textContent = 'Click a unit or building to select';
    this._actionButtons.innerHTML = '';
    this._drawPortraitEmpty();
  }

  _showSingleSelection(entity, game, player) {
    const def = entity.def;
    const faction = player.faction;
    const name = def[faction.toLowerCase() + 'Name'] || def.name || def.id;

    this._unitName.textContent = name;
    this._unitHpBar.style.width = (entity.hpPct * 100) + '%';

    // HP color
    if (entity.hpPct > 0.6) this._unitHpBar.style.background = 'linear-gradient(90deg,#22cc44,#88ff66)';
    else if (entity.hpPct > 0.3) this._unitHpBar.style.background = 'linear-gradient(90deg,#cc8822,#ffcc44)';
    else this._unitHpBar.style.background = 'linear-gradient(90deg,#cc2222,#ff6644)';

    this._unitHpText.textContent = `${Math.ceil(entity.hp)} / ${entity.maxHp} HP`;
    this._unitStatus.textContent = entity.state ? entity.state.toUpperCase() : (entity.built ? 'OPERATIONAL' : 'BUILDING...');

    this._drawPortrait(entity, faction);
    this._buildActionPanel(entity, game, player);
  }

  _showMultiSelection(entities, game, player) {
    this._unitName  .textContent = `${entities.length} units selected`;
    this._unitHpBar .style.width = '0%';
    this._unitHpText.textContent = '';
    this._unitStatus.textContent = '';
    this._actionButtons.innerHTML = '';
    this._drawPortraitEmpty();
  }

  _buildActionPanel(entity, game, player) {
    const btns = this._actionButtons;
    btns.innerHTML = '';

    const isUnit     = entity.constructor.name === 'Unit';
    const isBuilding = entity.constructor.name === 'Building';

    if (isUnit && entity.def.canBuild) {
      // Commander: show build menu
      this._buildBuildMenu(entity, game, player);
    } else if (isBuilding && entity.canProduce.length > 0) {
      // Factory: show production buttons
      this._buildProductionMenu(entity, game, player);
    } else if (isBuilding && entity.built) {
      // Other building: show info
    }

    // Universal stop button for units
    if (isUnit) {
      this._addActionButton('⛔', 'STOP', '', () => {
        game.getSelected(player.id).forEach(u => u.commandStop?.());
      });
    }
  }

  _buildBuildMenu(commander, game, player) {
    for (const defId of commander.def.canBuild) {
      const def = BUILDING_DEF[defId];
      if (!def) continue;

      const canAfford = player.canAfford(def.metalCost, def.energyCost);
      const costStr   = `M:${def.metalCost} E:${def.energyCost}`;

      this._addActionButton(
        def.icon || '🏗',
        def.name,
        costStr,
        () => {
          if (!player.canAfford(def.metalCost, def.energyCost)) {
            this.showNotification('Not enough resources!', player.id);
            return;
          }
          this.startPlacement(defId, def, game, player, commander);
        },
        !canAfford,
        def
      );
    }
  }

  _buildProductionMenu(building, game, player) {
    for (const unitId of building.canProduce) {
      const def = UNIT_DEF[unitId];
      if (!def) continue;

      const canAfford = player.canAfford(def.metalCost, def.energyCost);
      const costStr   = `M:${def.metalCost} E:${def.energyCost}`;

      const queueCount = building.queue.filter(id => id === unitId).length;
      const label      = queueCount > 0 ? `${def.name} (${queueCount})` : def.name;

      this._addActionButton(
        '⚙',
        label,
        costStr,
        () => {
          if (!player.canAfford(def.metalCost * 0.1, def.energyCost * 0.1)) {
            this.showNotification('Not enough resources!', player.id);
            return;
          }
          building.enqueue(unitId);
        },
        !canAfford,
        def
      );
    }

    // Rally point button
    this._addActionButton('🚩', 'SET RALLY', '', () => {
      this._settingRally = building;
      this.showNotification('Click to set rally point', player.id);
    });

    // Cancel last item in queue
    if (building.queue.length > 0) {
      this._addActionButton('✕', 'CANCEL', '', () => {
        building.queue.pop();
      });
    }
  }

  _addActionButton(icon, label, cost, onClick, disabled = false, tooltipDef = null) {
    const btn = document.createElement('button');
    btn.className = 'action-btn' + (disabled ? ' disabled' : '');
    btn.innerHTML = `
      <span class="btn-icon">${icon}</span>
      <span class="btn-label">${label.substring(0, 10)}</span>
      ${cost ? `<span class="btn-cost">${cost}</span>` : ''}
    `;

    if (!disabled) btn.addEventListener('click', onClick);

    // Tooltip
    if (tooltipDef) {
      btn.addEventListener('mouseenter', e => {
        this._showTooltip(e, tooltipDef);
      });
      btn.addEventListener('mousemove', e => {
        this._moveTooltip(e);
      });
      btn.addEventListener('mouseleave', () => {
        this._hideTooltip();
      });
    }

    this._actionButtons.appendChild(btn);
  }

  _showTooltip(e, def) {
    this._tooltip.style.display = 'block';
    this._tooltip.innerHTML = `
      <div class="tt-name">${def.name || def.id}</div>
      ${def.metalCost  !== undefined ? `<div class="tt-cost">Metal: ${def.metalCost} | Energy: ${def.energyCost}</div>` : ''}
      ${def.maxHp      !== undefined ? `<div>HP: ${def.maxHp}</div>` : ''}
      ${def.damage     !== undefined ? `<div>DMG: ${def.damage} | Range: ${def.attackRange}</div>` : ''}
      ${def.buildTime  !== undefined ? `<div>Build: ${def.buildTime}s</div>` : ''}
    `;
    this._moveTooltip(e);
  }

  _moveTooltip(e) {
    this._tooltip.style.left = (e.clientX + 12) + 'px';
    this._tooltip.style.top  = (e.clientY - 40) + 'px';
  }

  _hideTooltip() {
    this._tooltip.style.display = 'none';
  }

  // ---- Building Placement ----
  startPlacement(defId, def, game, player, commander) {
    this.placingBuilding    = true;
    this.placingBuildingId  = defId;
    this.placingBuildingDef = def;
    this._placementCommander = commander;
    this._placementPlayer   = player;
    this.showNotification(`Placing ${def.name} — right-click to cancel`, player.id);
  }

  confirmPlacement(renderer, game) {
    const { tx, ty } = this.ghostTile;
    const def = this.placingBuildingDef;
    const player = this._placementPlayer;
    const commander = this._placementCommander;

    if (!game.map.canPlace(tx, ty, def.tileW, def.tileH, def.requiresMetal ?? false)
        || game.isTileOccupied(tx, ty, def.tileW, def.tileH)) {
      this.showNotification('Cannot place here!', player.id);
      return;
    }

    if (!player.purchase(def.metalCost, def.energyCost)) {
      this.showNotification('Not enough resources!', player.id);
      return;
    }

    const building = game.placeBuilding(this.placingBuildingId, tx, ty, player.id, player.faction);
    commander.commandBuild(building);

    this.cancelPlacement();
    this.showNotification(`${def.name} placed!`, player.id);
  }

  cancelPlacement() {
    this.placingBuilding    = false;
    this.placingBuildingId  = null;
    this.placingBuildingDef = null;
    this._placementCommander = null;
    this._placementPlayer   = null;
  }

  // ---- Notifications ----
  showNotification(msg, playerId) {
    this._notifications.push({ msg, playerId });
  }

  update(dt) {
    if (this._notifTimer > 0) {
      this._notifTimer -= dt;
    } else if (this._notifications.length > 0) {
      const { msg } = this._notifications.shift();
      this._notifEl.textContent = msg;
      this._notifEl.classList.remove('hidden');
      this._notifTimer = 2.5;
    } else {
      this._notifEl.classList.add('hidden');
    }
  }

  // ---- Portrait Canvas ----
  _drawPortrait(entity, faction) {
    if (!this._portraitCtx) return;
    const ctx = this._portraitCtx;
    ctx.clearRect(0, 0, 80, 80);

    ctx.fillStyle = '#0a0f18';
    ctx.fillRect(0, 0, 80, 80);

    // Draw entity at portrait scale
    ctx.save();
    ctx.translate(40, 45);
    ctx.scale(2.2, 2.2);

    // Use entity's draw method logic inline (simplified)
    const col  = FACTION_COLOR[faction];
    const dark = faction === 'ARM' ? '#1155aa' : '#aa1111';
    entity._drawBody?.(ctx, entity.radius, col, dark, false);
    ctx.restore();

    // Faction badge
    ctx.beginPath();
    ctx.arc(68, 68, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.fillStyle = col;
    ctx.font = '8px "Courier New"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(faction[0], 68, 68);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _drawPortraitEmpty() {
    if (!this._portraitCtx) return;
    const ctx = this._portraitCtx;
    ctx.clearRect(0, 0, 80, 80);
    ctx.fillStyle = '#0a0f18';
    ctx.fillRect(0, 0, 80, 80);
    ctx.strokeStyle = '#1a2a3a';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 80, 80);
  }

  // ---- Game Over ----
  showGameOver(won, faction) {
    const screen = document.getElementById('gameover-screen');
    const title  = document.getElementById('gameover-title');
    const desc   = document.getElementById('gameover-desc');
    screen.classList.remove('hidden');
    screen.className = won ? 'victory' : 'defeat';
    title.textContent = won ? 'VICTORY' : 'DEFEAT';
    desc.textContent  = won
      ? `The ${faction} forces have annihilated the enemy. The galaxy is yours.`
      : `Your Commander has been destroyed. The ${faction === 'ARM' ? 'CORE' : 'ARM'} is victorious.`;
  }
}
