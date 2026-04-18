// All DOM rendering, idle animation state, and animation timers.
// Reads G and selectedFood as live bindings from state.js.

import { VW, VH, LIGHT_R, FOOD_NEEDED, FOOD_KEYS, FOOD_CHARS, FOOD_INFO, GEM_CHAR, GEM_COLOR, BIOMES, CLR, getRarity, escHtml, rand } from './utils.js';
import { getTile, getChunkBiome, chunkX, chunkY } from './world.js';
import { EGG_STAGES, getEggStage, EYE_ROW } from './creature.js';
import { G, selectedFood } from './state.js';
import { startBiomeLoop } from './audio.js';

// ── Idle animation state ──────────────────────────────────────────
let idleGen             = 0;
let eggShakeTimer       = null;
let creatureBlinkTimer  = null;
let creatureJiggleTimer = null;
let colIdleGen          = 0;
let colBlinkTimer       = null;
let colJiggleTimer      = null;

export function stopIdleAnims() {
  idleGen++;
  clearTimeout(eggShakeTimer);
  clearTimeout(creatureBlinkTimer);
  clearTimeout(creatureJiggleTimer);
  eggShakeTimer = creatureBlinkTimer = creatureJiggleTimer = null;
}

export function stopColAnims() {
  colIdleGen++;
  clearTimeout(colBlinkTimer);
  clearTimeout(colJiggleTimer);
  colBlinkTimer = colJiggleTimer = null;
}

export function getColSelected() {
  const { collection } = G;
  if (!collection?.length) return null;
  const order = { Legendary: 0, Rare: 1, Uncommon: 2, Common: 3 };
  const sorted = [...collection].sort(
    (a, b) => (order[a.rarity.name] ?? 9) - (order[b.rarity.name] ?? 9) || a.name.localeCompare(b.name)
  );
  return sorted[Math.max(0, Math.min(G.colSelectedIdx, sorted.length - 1))];
}

const cLine = (c, l) => c.shiny
  ? `<span class="shiny-anim">${escHtml(l)}</span>`
  : `<span style="color:${c.color}">${escHtml(l)}</span>`;

export function getAdjacentEgg() {
  if (!G?.worldEggs) return null;
  for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
    const egg = G.worldEggs.get(`${G.px + dx},${G.py + dy}`);
    if (egg) return egg;
  }
  return null;
}

export function shiftArt(lines, dx) {
  if (!dx) return lines;
  return lines.map(l =>
    dx > 0 ? ' '.repeat(dx) + l.slice(0, l.length - dx)
           : l.slice(-dx) + ' '.repeat(-dx)
  );
}

// ── Idle animation triggers ───────────────────────────────────────

function triggerEggShake() {
  eggShakeTimer = null;
  const egg = getAdjacentEgg();
  if (G?.phase !== 'playing' || !egg) return;
  const stage = EGG_STAGES[getEggStage(egg.fed)];
  const gen   = ++idleGen;
  const offsets = [1, 0, -1, 0, 1, 0];
  let fi = 0;
  (function nextFrame() {
    if (idleGen !== gen) return;
    document.getElementById('egg-display').innerHTML =
      shiftArt(stage.art, offsets[fi])
        .map(l => `<span style="color:${stage.color}">${escHtml(l)}</span>`).join('\n');
    if (++fi < offsets.length) setTimeout(nextFrame, 70);
  })();
  const delay = Math.max(400, 2200 - egg.fed * 180);
  eggShakeTimer = setTimeout(triggerEggShake, delay);
}

function triggerCreatureBlink() {
  creatureBlinkTimer = null;
  if (!G?.creature || G.phase === 'animating' || getAdjacentEgg()) return;
  const c  = G.creature;
  const ri = EYE_ROW[c.dom] ?? 2;
  const orig   = c.lines[ri];
  const closed = orig.replace(/o/g, '-');
  if (closed === orig) {
    creatureBlinkTimer = setTimeout(triggerCreatureBlink, 3000);
    return;
  }
  const gen     = ++idleGen;
  const blinked = [...c.lines];
  blinked[ri]   = closed;
  document.getElementById('egg-display').innerHTML =
    blinked.map(l => cLine(c, l)).join('\n');
  setTimeout(() => {
    if (idleGen !== gen) {
      if (G?.phase === 'playing' && G.creature && !creatureBlinkTimer)
        creatureBlinkTimer = setTimeout(triggerCreatureBlink, 2500 + rand(0, 2000));
      return;
    }
    document.getElementById('egg-display').innerHTML =
      c.lines.map(l => cLine(c, l)).join('\n');
    creatureBlinkTimer = setTimeout(triggerCreatureBlink, 2500 + rand(0, 2000));
  }, 180);
}

function triggerCreatureJiggle() {
  creatureJiggleTimer = null;
  if (!G?.creature || G.phase === 'animating' || getAdjacentEgg()) return;
  const c   = G.creature;
  const gen = ++idleGen;
  const offsets = [1, 0, -1, 0];
  let fi = 0;
  (function nextFrame() {
    if (idleGen !== gen) return;
    document.getElementById('egg-display').innerHTML =
      shiftArt(c.lines, offsets[fi]).map(l => cLine(c, l)).join('\n');
    if (++fi < offsets.length) setTimeout(nextFrame, 70);
  })();
  creatureJiggleTimer = setTimeout(triggerCreatureJiggle, 6000 + rand(0, 8000));
}

function triggerColBlink() {
  colBlinkTimer = null;
  if (!G?.showCollection) return;
  const c = getColSelected();
  if (!c) return;
  const ri     = EYE_ROW[c.dom] ?? 2;
  const orig   = c.lines[ri];
  const closed = orig.replace(/o/g, '-');
  if (closed === orig) {
    colBlinkTimer = setTimeout(triggerColBlink, 3000);
    return;
  }
  const gen     = ++colIdleGen;
  const blinked = [...c.lines];
  blinked[ri]   = closed;
  document.getElementById('col-art').innerHTML =
    blinked.map(l => cLine(c, l)).join('\n');
  setTimeout(() => {
    if (colIdleGen !== gen) {
      if (G?.showCollection && !colBlinkTimer)
        colBlinkTimer = setTimeout(triggerColBlink, 2500 + rand(0, 2000));
      return;
    }
    document.getElementById('col-art').innerHTML =
      c.lines.map(l => cLine(c, l)).join('\n');
    colBlinkTimer = setTimeout(triggerColBlink, 2500 + rand(0, 2000));
  }, 180);
}

function triggerColJiggle() {
  colJiggleTimer = null;
  if (!G?.showCollection) return;
  const c = getColSelected();
  if (!c) return;
  const gen     = ++colIdleGen;
  const offsets = [1, 0, -1, 0];
  let fi = 0;
  (function nextFrame() {
    if (colIdleGen !== gen) return;
    document.getElementById('col-art').innerHTML =
      shiftArt(c.lines, offsets[fi]).map(l => cLine(c, l)).join('\n');
    if (++fi < offsets.length) setTimeout(nextFrame, 70);
  })();
  colJiggleTimer = setTimeout(triggerColJiggle, 6000 + rand(0, 8000));
}

// ── Animation start helpers (called by game.js) ───────────────────

export function startEggShakeTimer(delay = 1500) {
  if (!eggShakeTimer) eggShakeTimer = setTimeout(triggerEggShake, delay);
}

export function startCreatureAnims() {
  if (!creatureBlinkTimer)  creatureBlinkTimer  = setTimeout(triggerCreatureBlink,  2500);
  if (!creatureJiggleTimer) creatureJiggleTimer = setTimeout(triggerCreatureJiggle, 6000 + rand(0, 8000));
}

// ── Render helpers ────────────────────────────────────────────────

const span = (ch, color) => `<span style="color:${color}">${escHtml(ch)}</span>`;

function renderViewport() {
  const { px, py, revealed, worldEggs } = G;
  const camX = px - Math.floor(VW / 2), camY = py - Math.floor(VH / 2);
  let html = '';
  for (let vy = 0; vy < VH; vy++) {
    const gy = camY + vy;
    for (let vx = 0; vx < VW; vx++) {
      const gx = camX + vx;
      if (gx === px && gy === py)                              { html += span('@', CLR.bright['@']); continue; }
      if (worldEggs?.has(`${gx},${gy}`))                       { html += span('Θ', CLR.bright['Θ']); continue; }
      const inLight = Math.hypot(gx - px, gy - py) <= LIGHT_R;
      const seen = revealed.has(`${gx},${gy}`);
      if (!seen && !inLight)                 { html += span(' ', '#000'); continue; }
      const ch = getTile(gx, gy);
      const biome = BIOMES[getChunkBiome(chunkX(gx), chunkY(gy))];
      let color;
      if      (ch === '#') color = inLight ? biome.wallBright  : biome.wallDim;
      else if (ch === '.') color = inLight ? biome.floorBright : biome.floorDim;
      else { const t = inLight ? CLR.bright : CLR.dim; color = t[ch] || (inLight ? '#aaa' : '#333'); }
      html += span(ch, color);
    }
    if (vy < VH - 1) html += '\n';
  }
  return html;
}

function renderInventory() {
  let html = '';
  FOOD_KEYS.forEach((key, idx) => {
    const ch  = FOOD_CHARS.find(c => FOOD_INFO[c].key === key);
    const { color } = FOOD_INFO[ch];
    const count = G.inventory[key];
    const sel = selectedFood === key;
    const clr = count > 0 ? color : '#555';
    const bg  = sel ? 'background:#151515;' : '';
    html += `<div style="color:${clr};${bg}">${sel ? '►' : ' '}${idx + 1} ${ch} ${key.padEnd(8)} x${count}</div>`;
  });
  const gc = G.inventory.gem || 0;
  const gs = selectedFood === 'gem';
  html += `<div style="color:${gc > 0 ? GEM_COLOR : '#555'};${gs ? 'background:#151515;' : ''}">${gs ? '►' : ' '}6 ${GEM_CHAR} gem      x${gc}</div>`;
  document.getElementById('inv-list').innerHTML = html;
}

function renderLog() {
  const el = document.getElementById('log');
  el.innerHTML = G.log.map(m => `<div class="log-line">&gt; ${escHtml(m)}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function renderWorldPanel() {
  const biomeKey = getChunkBiome(chunkX(G.px), chunkY(G.py));
  const biome    = BIOMES[biomeKey];
  document.getElementById('world-biome').innerHTML =
    `<span style="color:${biome.accent}">◈ ${biome.name}</span>`;
  startBiomeLoop(biomeKey);
}

function renderBottomPlaying() {
  idleGen++;
  const adjEgg = getAdjacentEgg();

  if (adjEgg) {
    const stage = EGG_STAGES[getEggStage(adjEgg.fed)];
    document.getElementById('egg-display').innerHTML =
      stage.art.map(l => `<span style="color:${stage.color}">${escHtml(l)}</span>`).join('\n');

    const pct     = Math.min(1, adjEgg.fed / FOOD_NEEDED);
    const filled  = Math.floor(pct * 10);
    const bar     = '█'.repeat(filled) + '░'.repeat(10 - filled);
    const barClr  = pct >= 1 ? '#fff' : pct > 0 ? '#c09030' : '#333';
    const isGem   = selectedFood === 'gem';
    const selCh   = isGem ? null : FOOD_CHARS.find(c => FOOD_INFO[c].key === selectedFood);
    const selClr  = isGem ? GEM_COLOR : (selCh ? FOOD_INFO[selCh].color : '#888');
    const selLabel = isGem ? `${GEM_CHAR} gem` : `${selCh} ${selectedFood}`;
    const selAmt  = isGem ? G.inventory.gem : G.inventory[selectedFood];
    const feedMsg = isGem ? 'Press F to boost rarity!' : 'Press F to feed!';
    const eggBiome = adjEgg.biome ? BIOMES[adjEgg.biome] : null;
    const biomeLabel = eggBiome
      ? `<span style="color:${eggBiome.accent};font-size:.72rem">◈ ${eggBiome.name} egg</span>` : '';
    const currRarity = getRarity(adjEgg.rarityRoll);

    document.getElementById('egg-info').innerHTML = `
      <div id="egg-bar"><span style="color:${barClr}">${bar}</span></div>
      <div id="egg-fed-count">${adjEgg.fed} / ${FOOD_NEEDED} fed &nbsp;<span style="color:${currRarity.color}">${currRarity.badge}</span></div>
      <div style="margin-top:3px;font-size:.78rem;color:#6a6a6a">
        Selected: <span style="color:${selClr}">${selLabel}</span> &nbsp;(x${selAmt})
      </div>
      <div style="margin-top:2px">${biomeLabel}</div>
      <div id="feed-hint">${feedMsg}</div>`;
    startEggShakeTimer(1500);

  } else if (G.creature) {
    document.getElementById('egg-display').innerHTML =
      G.creature.lines.map(l => cLine(G.creature, l)).join('\n');
    const r = G.creature.rarity;
    document.getElementById('egg-info').innerHTML = `
      <div id="creature-name-display" style="color:${G.creature.color}">&ldquo;${escHtml(G.creature.name)}&rdquo;</div>
      <div id="creature-rarity-display" style="color:${r.color}">${r.badge} ${r.name}</div>
      <div id="creature-traits-display">${G.creature.traits.join(' &middot; ')}</div>
      <div id="creature-diet-display">${escHtml(G.creature.diet)}</div>
      <div id="creature-id-display">ID: ${G.creature.id}</div>
      <div id="find-egg-hint" style="color:#3a3a3a;font-size:.78rem">Explore to find eggs</div>`;
    startCreatureAnims();

  } else {
    document.getElementById('egg-display').innerHTML =
      `<span style="color:#2a2a2a">${EGG_STAGES[0].art.join('\n').replace(/./g, ' ')}</span>`;
    document.getElementById('egg-info').innerHTML =
      `<div id="no-egg-msg">Explore to find an egg.</div>`;
  }
}

export function renderAnimFrame(frame) {
  document.getElementById('egg-display').innerHTML =
    frame.lines.map(l => `<span style="color:${frame.color}">${escHtml(l)}</span>`).join('\n');
  document.getElementById('egg-info').innerHTML =
    `<div id="egg-bar"><span style="color:#fff">${'█'.repeat(10)}</span></div>
     <div id="egg-fed-count">${FOOD_NEEDED} / ${FOOD_NEEDED} fed</div>
     <div id="anim-label" style="margin-top:8px">HATCHING...</div>`;
}


function renderCollection() {
  const { collection } = G;
  document.getElementById('col-count').textContent = `${collection.length} hatched`;

  const order  = { Legendary: 0, Rare: 1, Uncommon: 2, Common: 3 };
  const sorted = [...collection].sort(
    (a, b) => (order[a.rarity.name] ?? 9) - (order[b.rarity.name] ?? 9) || a.name.localeCompare(b.name)
  );

  if (collection.length === 0) {
    document.getElementById('col-list').innerHTML =
      '<div style="color:#5a5a5a;padding:12px 0;text-align:center">No creatures hatched yet.</div>';
    document.getElementById('col-art').innerHTML = '';
    document.getElementById('col-detail-info').innerHTML =
      '<div style="color:#5a5a5a;font-size:0.8rem">Hatch an egg to fill your collection.</div>';
    return;
  }

  G.colSelectedIdx = Math.max(0, Math.min(G.colSelectedIdx, sorted.length - 1));
  const sel = sorted[G.colSelectedIdx];

  document.getElementById('col-list').innerHTML = sorted.map((c, i) => `
    <div class="col-entry${i === G.colSelectedIdx ? ' col-selected' : ''}" data-idx="${i}">
      <div class="col-name">
        <span style="color:${c.rarity.color}">${c.rarity.badge}</span>
        &nbsp;<span style="color:${c.color}">&ldquo;${escHtml(c.name)}&rdquo;</span>
      </div>
      <div class="col-id">${c.date || ''}</div>
    </div>`).join('');

  const selEl = document.querySelector('#col-list .col-selected');
  if (selEl) selEl.scrollIntoView({ block: 'nearest' });

  colIdleGen++;
  document.getElementById('col-art').innerHTML =
    sel.lines.map(l => cLine(sel, l)).join('\n');
  if (!colBlinkTimer)  colBlinkTimer  = setTimeout(triggerColBlink,  2500 + rand(0, 2000));
  if (!colJiggleTimer) colJiggleTimer = setTimeout(triggerColJiggle, 6000 + rand(0, 8000));

  document.getElementById('col-detail-info').innerHTML = `
    <div style="color:${sel.color};font-size:0.85rem">&ldquo;${escHtml(sel.name)}&rdquo;</div>
    <div style="color:${sel.rarity.color};font-size:0.75rem">${sel.rarity.badge} ${sel.rarity.name}</div>
    <div style="color:#7a7a7a;font-size:0.72rem">${sel.traits.join(' &middot; ')}</div>
    <div style="color:#606060;font-size:0.68rem">${escHtml(sel.diet)}</div>
    <div style="color:#555;font-size:0.65rem">ID: ${sel.id}</div>`;
}

export function render() {
  if (G.phase === 'animating') return;

  const showCol = G.showCollection;
  document.getElementById('game-area').hidden = showCol;
  document.getElementById('collection-overlay').hidden = !showCol;

  if (showCol) { renderCollection(); }
  else {
    document.getElementById('viewport').innerHTML = renderViewport();
    renderInventory();
    renderWorldPanel();
    renderLog();
  }

  if (G.phase === 'playing') renderBottomPlaying();
}
