// Orchestrator: game logic, save/load, startup.
// All rendering, audio, world, and creature logic lives in modules/.

import { VERSION, PATCH_NOTES, FOOD_NEEDED, FOOD_KEYS, FOOD_INFO, GEM_CHAR, CHEST_CHAR, MAX_LOG, HUNGER_STEPS, CORR_X, CORR_Y, getRarity, RARITIES, emptyInv, rand, escHtml } from './modules/utils.js';
import { WORLD_SEED, chunks, resetWorld, getChunk, getChunkBiome, getTile, setTile, isWalkable, chunkX, chunkY, getChunkEggSpawn } from './modules/world.js';
import { generateCreature, buildAnimSeq, regenLines } from './modules/creature.js';
import { G, setG, selectedFood, setSelectedFood } from './modules/state.js';
import { getMuted, setMuted, toggleMute, sfxPickup, sfxGem, sfxHatch, sfxChestOpen, renderControls } from './modules/audio.js';
import { render, renderAnimFrame, stopIdleAnims, stopColAnims, getAdjacentEgg } from './modules/render.js';
import * as Input from './modules/input.js';
import * as Feedback from './modules/feedback.js';

// ── Game logic ────────────────────────────────────────────────────

let animCancelled = false;

function addLog(msg) {
  G.log.push(msg);
  if (G.log.length > MAX_LOG) G.log.shift();
}

function spawnChunkEgg(cx, cy) {
  const spawn = getChunkEggSpawn(cx, cy);
  if (!spawn) return;
  const wKey = `${spawn.wx},${spawn.wy}`;
  if (G.worldEggs.has(wKey)) return;
  G.worldEggs.set(wKey, {
    x: spawn.wx, y: spawn.wy,
    foodSequence: [], rarityRoll: spawn.rarityRoll,
    inv: emptyInv(), fed: 0,
    biome: getChunkBiome(cx, cy),
  });
}

function updateFOV() {
  const { revealed, spawnedChunks, px, py } = G;
  const R = 6;
  for (let dy = -R - 1; dy <= R + 1; dy++)
    for (let dx = -R - 1; dx <= R + 1; dx++) {
      const nx = px + dx, ny = py + dy;
      if (Math.hypot(dx, dy) > R) continue;
      revealed.add(`${nx},${ny}`);
      const ck = `${chunkX(nx)},${chunkY(ny)}`;
      if (!spawnedChunks.has(ck)) { spawnedChunks.add(ck); spawnChunkEgg(chunkX(nx), chunkY(ny)); }
    }
}

function newGame() {
  animCancelled = true;
  stopIdleAnims();
  resetWorld(rand(0, 0xFFFFFF));

  for (let dcy = -1; dcy <= 1; dcy++) for (let dcx = -1; dcx <= 1; dcx++) getChunk(dcx, dcy);

  const px = CORR_X + 1, py = CORR_Y;
  const startChunk = `${chunkX(px)},${chunkY(py)}`;

  setG({
    px, py,
    inventory:      emptyInv(),
    worldEggs:      new Map(),
    spawnedChunks:  new Set([startChunk]),
    phase:          'playing',
    creature:       null,
    collection:     [],
    revealed:       new Set(),
    showCollection: false,
    colSelectedIdx: 0,
    steps:          0,
    animFrames:     [],
    animFrame:      0,
    log: ['You enter the dungeon.', 'Find an egg and feed it (F)!'],
  });

  // Place a starting egg adjacent to the player
  const startEggPos = [[0,-1],[0,1],[-1,0],[1,0]].find(([dx,dy]) => isWalkable(px+dx, py+dy));
  if (startEggPos) {
    const [dx, dy] = startEggPos;
    G.worldEggs.set(`${px+dx},${py+dy}`, {
      x: px+dx, y: py+dy,
      foodSequence: [], rarityRoll: rand(0, 10000),
      inv: emptyInv(), fed: 0,
      biome: getChunkBiome(chunkX(px), chunkY(py)),
    });
  }

  updateFOV();
  render();
}

function tryMove(dx, dy) {
  if (G.phase === 'animating') return;
  const nx = G.px + dx, ny = G.py + dy;
  if (!isWalkable(nx, ny) || G.worldEggs?.has(`${nx},${ny}`)) {
    if (getTile(nx, ny) === CHEST_CHAR) { addLog('A chest! Press E to pick the lock.'); render(); }
    return;
  }

  G.px = nx; G.py = ny;
  G.steps++;

  const tile = getTile(nx, ny);
  if (tile === GEM_CHAR) {
    G.inventory.gem++;
    setTile(nx, ny, '.');
    addLog('Found a gem! Feed it to the egg (key 6, then F).');
    sfxGem();
  } else {
    const info = FOOD_INFO[tile];
    if (info) {
      G.inventory[info.key]++;
      setTile(nx, ny, '.');
      addLog(`Picked up ${info.name}!`);
      sfxPickup();
    }
  }

  if (G.steps % HUNGER_STEPS === 0) {
    const available = FOOD_KEYS.filter(k => G.inventory[k] > 0);
    if (available.length > 0) {
      const k = available[Math.floor(Math.random() * available.length)];
      G.inventory[k]--;
      addLog(`Hungry! You ate some ${k}.`);
    }
  }

  updateFOV();
  render();
  autoSave();
}

function tryFeed() {
  if (G.phase === 'animating') return;
  const egg = getAdjacentEgg();
  if (!egg) { addLog('No egg nearby to feed.'); render(); return; }
  if (egg.fed >= FOOD_NEEDED) return;
  const key = selectedFood;

  if (key === 'gem') {
    if (G.inventory.gem === 0) { addLog('No gems! Find $ in the dungeon.'); render(); return; }
    const curRarity = getRarity(egg.rarityRoll);
    const curIdx = RARITIES.indexOf(curRarity);
    if (curIdx === RARITIES.length - 1) {
      addLog('This egg is already Legendary — gems cannot improve it.'); render(); return;
    }
    G.inventory.gem--;
    egg.rarityRoll = rand(RARITIES[curIdx].threshold, RARITIES[curIdx + 1].threshold);
    addLog(`Fed a gem! Rarity is now ${getRarity(egg.rarityRoll).name}.`);
    render();
    autoSave();
    return;
  }

  if (G.inventory[key] === 0) { addLog(`No ${key} in inventory! (select 1-5)`); render(); return; }
  G.inventory[key]--;
  egg.inv[key]++;
  egg.foodSequence.push(key);
  egg.fed++;
  addLog(`Fed the egg ${key}. (${egg.fed}/${FOOD_NEEDED})`);
  render();
  autoSave();
  if (egg.fed >= FOOD_NEEDED) setTimeout(() => startHatch(egg), 900);
}

function startHatch(egg) {
  stopIdleAnims();
  G.worldEggs.delete(`${egg.x},${egg.y}`);
  G.creature    = generateCreature(egg);
  G.phase       = 'animating';
  G.animFrames  = buildAnimSeq(G.creature);
  G.animFrame   = 0;
  animCancelled = false;

  if (!G.collection.find(c => c.hashVal === G.creature.hashVal)) {
    G.collection.push({ ...G.creature, date: new Date().toLocaleDateString() });
  }
  addLog(`THE EGG HATCHES!  [${G.creature.rarity.name}]`);
  autoSave();
  runAnimFrame();
}

function runAnimFrame() {
  if (animCancelled) return;
  const frame = G.animFrames[G.animFrame];
  renderAnimFrame(frame);
  if (frame.delay === 0) {
    setTimeout(() => {
      if (!animCancelled) {
        G.phase = 'playing';
        sfxHatch();
        render();
      }
    }, 400);
    return;
  }
  G.animFrame++;
  setTimeout(runAnimFrame, frame.delay);
}

// ── Save / Load ───────────────────────────────────────────────────

function buildSaveData() {
  const chunkData = {};
  for (const [key, chunk] of chunks) chunkData[key] = chunk.grid;
  return {
    version: 4, worldSeed: WORLD_SEED, selectedFood, muted: getMuted(),
    player:  { x: G.px, y: G.py, inventory: G.inventory },
    phase:   G.phase === 'animating' ? 'playing' : G.phase,
    creature: G.creature,
    collection: G.collection.map(({ lines: _, ...c }) => c),
    worldEggs: [...G.worldEggs.entries()],
    spawnedChunks: [...G.spawnedChunks],
    chunkData,
    revealed: [...G.revealed],
    log:   G.log,
    steps: G.steps,
  };
}

function applySaveData(data) {
  animCancelled = true;
  resetWorld(data.worldSeed);
  for (const [key, grid] of Object.entries(data.chunkData || {}))
    chunks.set(key, { grid });
  setSelectedFood(data.selectedFood || 'meat');
  setMuted(data.muted ?? false);
  setG({
    px: data.player.x, py: data.player.y,
    inventory:    { ...emptyInv(), ...(data.player.inventory || {}) },
    phase:        data.phase || 'playing',
    creature:     data.creature || null,
    collection:   data.collection || [],
    worldEggs:    new Map(data.worldEggs || []),
    spawnedChunks: new Set(data.spawnedChunks || []),
    revealed:     new Set(data.revealed || []),
    showCollection: false,
    colSelectedIdx: 0,
    steps:        data.steps || 0,
    animFrames: [], animFrame: 0,
    log:          data.log || [],
  });
  G.collection.forEach(regenLines);
  if (G.creature) regenLines(G.creature);
  updateFOV();
}

async function saveGame() {
  const json = JSON.stringify(buildSaveData(), null, 2);
  try {
    // Save to localStorage
    localStorage.setItem('egg-dungeon-save', json);
    
    // Also offer to download as backup
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'egg-dungeon.json',
        types: [{ description: 'JSON Save File', accept: { 'application/json': ['.json'] } }],
      });
      const w = await handle.createWritable();
      await w.write(json); await w.close();
    } else {
      // For browsers without File System API, offer download
      const a = document.createElement('a');
      a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
      a.download = 'egg-dungeon.json'; a.click();
    }
    addLog('Game saved to browser storage! (backup downloaded)');
  } catch (e) { 
    // If download was cancelled but localStorage worked, that's still a success
    if (e.name !== 'AbortError') {
      try {
        localStorage.setItem('egg-dungeon-save', json);
        addLog('Game saved to browser storage!');
      } catch (_) {
        addLog('Save failed: storage unavailable.');
      }
    } else {
      addLog('Game saved to browser storage!');
    }
  }
  render();
}

async function loadGame() {
  try {
    let text;
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'JSON Save File', accept: { 'application/json': ['.json'] } }],
      });
      text = await (await handle.getFile()).text();
    } else {
      text = await new Promise((res, rej) => {
        const inp = document.getElementById('load-input');
        inp.onchange = async () => { const f = inp.files[0]; if (!f) rej(new Error('no file')); res(await f.text()); inp.value = ''; };
        inp.click();
      });
    }
    // Parse and validate the JSON
    const saveData = JSON.parse(text);
    // Save to localStorage so it becomes the active save
    localStorage.setItem('egg-dungeon-save', JSON.stringify(saveData));
    applySaveData(saveData);
    addLog('Save file imported! Now your active game.');
    render();
  } catch (e) { if (e.name !== 'AbortError') { addLog('Load failed.'); console.error(e); } }
}

function clearSave() {
  try {
    localStorage.removeItem('egg-dungeon-save');
    addLog('Saved game cleared. Press R to start a new game!');
    render();
  } catch (_) {
    addLog('Failed to clear save.');
  }
}

// ── Chest / lockpicking minigame ─────────────────────────────────

const CHEST_BAR = 21;
const CHEST_SWEET = 3;
let chestMinigame = null;

function tryChest() {
  if (G.phase === 'animating') return;
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
  const found = dirs.map(([dx, dy]) => ({ x: G.px + dx, y: G.py + dy }))
    .find(p => getTile(p.x, p.y) === CHEST_CHAR);
  if (!found) { addLog('No chest nearby. (Stand adjacent, press E)'); render(); return; }

  const sweetStart = 2 + Math.floor(Math.random() * (CHEST_BAR - CHEST_SWEET - 4));
  chestMinigame = {
    cx: found.x, cy: found.y,
    pos: 0, dir: 1,
    sweetStart, sweetEnd: sweetStart + CHEST_SWEET - 1,
    intervalId: null,
  };

  document.getElementById('chest-result').textContent = '';
  document.getElementById('chest-overlay').removeAttribute('hidden');
  renderChestBar();
  chestMinigame.intervalId = setInterval(() => {
    if (!chestMinigame) return;
    chestMinigame.pos += chestMinigame.dir;
    if (chestMinigame.pos >= CHEST_BAR - 1) chestMinigame.dir = -1;
    if (chestMinigame.pos <= 0) chestMinigame.dir = 1;
    renderChestBar();
  }, 80);
}

function renderChestBar() {
  if (!chestMinigame) return;
  const { pos, sweetStart, sweetEnd } = chestMinigame;
  const chars = Array.from({ length: CHEST_BAR }, (_, i) => {
    if (i === pos) return '│';
    if (i >= sweetStart && i <= sweetEnd) return '≡';
    return '·';
  });
  document.getElementById('chest-bar').textContent = '[' + chars.join('') + ']';
}

function tryLockpick() {
  if (!chestMinigame) return;
  const { pos, sweetStart, sweetEnd, cx, cy } = chestMinigame;
  const resultEl = document.getElementById('chest-result');
  if (pos >= sweetStart && pos <= sweetEnd) {
    clearInterval(chestMinigame.intervalId);
    chestMinigame.intervalId = null;
    const barEl = document.getElementById('chest-bar');
    barEl.textContent = '[' + '■'.repeat(CHEST_BAR) + ']';
    barEl.classList.add('chest-bar-success');
    resultEl.className = 'chest-hit';
    resultEl.textContent = '✓ Unlocked!';
    sfxChestOpen();
    setTimeout(() => {
      closeChest();
      setTile(cx, cy, '.');
      FOOD_KEYS.forEach(k => { G.inventory[k]++; });
      G.inventory.gem += 3;
      addLog('Chest unlocked! Found food and 3 gems.');
      autoSave();
      render();
    }, 750);
  } else {
    resultEl.className = 'chest-miss';
    resultEl.textContent = '✗ Missed — try again!';
  }
}

function closeChest() {
  if (!chestMinigame) return;
  clearInterval(chestMinigame.intervalId);
  chestMinigame = null;
  document.getElementById('chest-bar').classList.remove('chest-bar-success');
  document.getElementById('chest-overlay').setAttribute('hidden', '');
  document.getElementById('chest-result').textContent = '';
}

function autoSave() {
  try { localStorage.setItem('egg-dungeon-save', JSON.stringify(buildSaveData())); } catch (_) { /* storage unavailable */ }
}

function autoLoad() {
  try {
    const saved = localStorage.getItem('egg-dungeon-save');
    if (!saved) return false;
    applySaveData(JSON.parse(saved));
    addLog('Welcome back!');
    render();
    return true;
  } catch (e) { return false; }
}

// ── Patch notes ───────────────────────────────────────────────────

function checkPatchNotes() {
  const SEEN_KEY = 'egg-dungeon-patch-seen';
  if (localStorage.getItem(SEEN_KEY) === VERSION) return;
  const notes = PATCH_NOTES[VERSION];
  if (!notes) return;

  document.getElementById('patch-version').textContent = 'v' + VERSION;
  document.getElementById('patch-notes-list').innerHTML =
    notes.map(n => `<div class="patch-note">${escHtml(n)}</div>`).join('');
  document.getElementById('patch-overlay').removeAttribute('hidden');

  function dismiss(e) {
    e.stopPropagation();
    document.getElementById('patch-overlay').setAttribute('hidden', '');
    localStorage.setItem(SEEN_KEY, VERSION);
    document.removeEventListener('keydown', dismiss, true);
    document.getElementById('patch-overlay').removeEventListener('click', dismiss);
  }
  document.addEventListener('keydown', dismiss, true);
  document.getElementById('patch-overlay').addEventListener('click', dismiss);
}

// ── Startup ───────────────────────────────────────────────────────

Feedback.init();

Input.init({
  saveGame,
  loadGame,
  clearSave,
  toggleMute: () => { toggleMute(); autoSave(); },
  openFeedback: Feedback.openFeedback,
  getG: () => G,
  setSelectedFood,
  tryMove,
  tryFeed,
  tryChest,
  lockpick: tryLockpick,
  closeChest,
  isChestActive: () => chestMinigame !== null,
  render,
  stopColAnims,
});

document.getElementById('version').textContent = 'v' + VERSION;
renderControls();
if (!autoLoad()) newGame();
checkPatchNotes();
