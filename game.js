// Orchestrator: game logic, save/load, startup.
// All rendering, audio, world, and creature logic lives in modules/.

import { VERSION, PATCH_NOTES, FOOD_NEEDED, FOOD_KEYS, FOOD_INFO, GEM_CHAR, CHEST_CHAR, MAX_LOG, HUNGER_STEPS, CORR_X, CORR_Y, getRarity, RARITIES, emptyInv, rand, escHtml, DRAGON_GEM_COST, DRAGON_CREATURE_COST } from './modules/utils.js';
import { WORLD_SEED, chunks, resetWorld, getChunk, getChunkBiome, getTile, setTile, isWalkable, chunkX, chunkY, getChunkEggSpawn, getGreatBeastSpawn, markChestOpened, setOpenedChests, getOpenedChests } from './modules/world.js';
import { generateCreature, buildAnimSeq, regenLines, generateGreatBeast, buildGreatBeastAnimSeq, regenGreatBeastLines, DRAGON_EGG_STAGES, KRAKEN_EGG_STAGES, GRIFFON_EGG_STAGES } from './modules/creature.js';
import { G, setG, selectedFood, setSelectedFood } from './modules/state.js';
import { getMuted, setMuted, toggleMute, sfxPickup, sfxGem, sfxHatch, sfxDragonHatch, sfxKrakenHatch, sfxGriffonHatch, sfxChestOpen, sfxBeastAwaken, sfxSacrifice, renderControls } from './modules/audio.js';
import { render, renderAnimFrame, stopIdleAnims, stopColAnims, getAdjacentEgg, getAdjacentBeast, BEAST_ART_AWAKE, KRAKEN_BEAST_ART_AWAKE, GRIFFON_BEAST_ART_AWAKE } from './modules/render.js';
import * as Input from './modules/input.js';
import * as Feedback from './modules/feedback.js';

// ── Game logic ────────────────────────────────────────────────────

let animCancelled = false;
let devForceShiny = false;

const EMBERS_ART = [
  '              ', '  ·   * ·     ', '    · *  . ·  ', '  .   ·  *    ',
  '  * ·    · .  ', '   · *  ·     ', ' *  .   · * · ', '  ·  *    ·   ',
  '    ·  *  .   ', '              ',
];

const SPLASH_ART = [
  '              ', '  ~   ~ ~     ', '    ~ ~  ~ ~  ', '  ~   ~  ~    ',
  '  ~ ~    ~ ~  ', '   ~ ~  ~     ', ' ~  ~   ~ ~ ~ ', '  ~  ~    ~   ',
  '    ~  ~  ~   ', '              ',
];

const FEATHERS_ART = [
  '              ', '  ^   ^ ^     ', '    ^ ^  ^ ^  ', '  ^   ^  ^    ',
  '  ^ ^    ^ ^  ', '   ^ ^  ^     ', ' ^  ^   ^ ^ ^ ', '  ^  ^    ^   ',
  '    ^  ^  ^   ', '              ',
];

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

function spawnChunkGreatBeast(cx, cy) {
  const spawn = getGreatBeastSpawn(cx, cy);
  if (!spawn) return;
  const wKey = `${spawn.wx},${spawn.wy}`;
  if (G.worldBeasts.has(wKey) || G.worldEggs.has(wKey)) return;
  G.worldBeasts.set(wKey, {
    x: spawn.wx, y: spawn.wy,
    beastType: spawn.beastType,
    biome: getChunkBiome(cx, cy),
    phase: 'sleeping',
    gemsReceived: 0,
    sacrificedCreatures: [],
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
      if (!spawnedChunks.has(ck)) { spawnedChunks.add(ck); spawnChunkEgg(chunkX(nx), chunkY(ny)); spawnChunkGreatBeast(chunkX(nx), chunkY(ny)); }
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
    worldBeasts:    new Map(),
    spawnedChunks:  new Set([startChunk]),
    phase:          'playing',
    creature:       null,
    collection:     [],
    greatBeasts:    [],
    revealed:       new Set(),
    showCollection: false,
    colSelectedIdx: 0,
    collectionTab:  'creatures',
    gbSelectedIdx:  0,
    dragonInteract: null,
    sacrificeMode:  false,
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
  const nKey = `${nx},${ny}`;
  if (!isWalkable(nx, ny) || G.worldEggs?.has(nKey) || G.worldBeasts?.has(nKey)) {
    if (getTile(nx, ny) === CHEST_CHAR) { addLog('A chest! Press E to pick the lock.'); render(); }
    else if (G.worldBeasts?.has(nKey)) {
      const beast = G.worldBeasts.get(nKey);
      const bName = beast.beastType ?? 'dragon';
      if (beast.phase === 'sleeping') addLog(`An ancient ${bName} slumbers here. Press E to approach.`);
      else addLog(`The ${bName} awaits your offering. Press E to continue.`);
      render();
    }
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
}

function tryFeed() {
  if (G.phase === 'animating') return;

  // Dragon overlay open: offer a gem to the beast
  if (G.dragonInteract) { tryFeedBeastGem(); return; }

  const egg = getAdjacentEgg();
  if (!egg) { addLog('No egg nearby to feed.'); render(); return; }
  if (egg.fed >= FOOD_NEEDED) return;
  const key = selectedFood;

  if (key === 'gem') {
    if (egg.noGems) { addLog('Dragon eggs cannot be enhanced with gems.'); render(); return; }
    if (G.inventory.gem === 0) { addLog('No gems! Find $ in the dungeon.'); render(); return; }
    const curRarity = getRarity(egg.rarityRoll);
    const curIdx = RARITIES.indexOf(curRarity);
    if (curIdx === RARITIES.length - 1) {
      addLog('This egg is already Legendary — gems cannot improve it.'); render(); return;
    }
    G.inventory.gem--;
    egg.rarityRoll = rand(RARITIES[curIdx].threshold, RARITIES[curIdx + 1].threshold);
    addLog(`Fed a gem! Rarity is now ${getRarity(egg.rarityRoll).name}.`);
    autoSave();
    render();
    return;
  }

  if (G.inventory[key] === 0) { addLog(`No ${key} in inventory! (select 1-5)`); render(); return; }
  G.inventory[key]--;
  egg.inv[key]++;
  egg.foodSequence.push(key);
  egg.fed++;
  addLog(`Fed the egg ${key}. (${egg.fed}/${FOOD_NEEDED})`);
  render();
  if (egg.fed >= FOOD_NEEDED) setTimeout(() => egg.isDragonEgg ? startDragonHatch(egg) : startHatch(egg), 900);
}

function runLayFrame(frames, idx, callback) {
  if (animCancelled) return;
  const frame = frames[idx];
  renderAnimFrame(frame, '<span style="color:#ff6020">DISSOLVING...</span>');
  if (frame.delay === 0) {
    setTimeout(() => { if (!animCancelled) callback(); }, 300);
    return;
  }
  setTimeout(() => runLayFrame(frames, idx + 1, callback), frame.delay);
}

function startHatch(egg) {
  stopIdleAnims();
  G.worldEggs.delete(`${egg.x},${egg.y}`);
  G.creature    = generateCreature(egg);
  if (devForceShiny) G.creature.shiny = true;
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

function startDragonHatch(egg) {
  stopIdleAnims();
  G.worldEggs.delete(`${egg.x},${egg.y}`);
  G.creature    = generateGreatBeast(egg);
  if (devForceShiny) G.creature.shiny = true;
  G.phase       = 'animating';
  G.animFrames  = buildGreatBeastAnimSeq(G.creature);
  G.animFrame   = 0;
  animCancelled = false;

  if (!G.greatBeasts.find(b => b.hashVal === G.creature.hashVal)) {
    G.greatBeasts.push({ ...G.creature, date: new Date().toLocaleDateString() });
  }
  addLog(`A ${(G.creature.beastType ?? 'dragon').toUpperCase()} AWAKENS!  [${G.creature.rarity.name}]`);
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
        G.creature?.isGreatBeast ? (G.creature.beastType === 'kraken' ? sfxKrakenHatch() : G.creature.beastType === 'griffon' ? sfxGriffonHatch() : sfxDragonHatch()) : sfxHatch();
        render();
      }
    }, 400);
    return;
  }
  G.animFrame++;
  setTimeout(runAnimFrame, frame.delay);
}

// ── Save / Load ───────────────────────────────────────────────────

const CHUNK_SAVE_LIMIT = 100;

function buildSaveData() {
  const recentChunks = [...chunks.entries()].slice(-CHUNK_SAVE_LIMIT);
  const savedChunkKeys = new Set(recentChunks.map(([k]) => k));
  const chunkData = Object.fromEntries(recentChunks.map(([k, c]) => [k, c.grid]));
  return {
    version: 5, worldSeed: WORLD_SEED, selectedFood, muted: getMuted(),
    player:  { x: G.px, y: G.py, inventory: G.inventory },
    phase:   G.phase === 'animating' ? 'playing' : G.phase,
    creature: G.creature ? { ...G.creature, lines: undefined } : null,
    collection:  G.collection.map(({ lines: _, ...c }) => c),
    greatBeasts: G.greatBeasts.map(({ lines: _, ...b }) => b),
    worldEggs:   [...G.worldEggs.entries()],
    worldBeasts: [...G.worldBeasts.entries()],
    spawnedChunks: [...G.spawnedChunks],
    collectionTab: G.collectionTab,
    gbSelectedIdx: G.gbSelectedIdx,
    chunkData,
    openedChests: [...getOpenedChests()],
    revealed: [...G.revealed].filter(k => { const [wx, wy] = k.split(','); return savedChunkKeys.has(`${chunkX(+wx)},${chunkY(+wy)}`); }),
    log:   G.log.slice(-50),
    steps: G.steps,
  };
}

function applySaveData(data) {
  animCancelled = true;
  resetWorld(data.worldSeed);
  setOpenedChests(new Set(data.openedChests || []));
  for (const [key, grid] of Object.entries(data.chunkData || {}))
    chunks.set(key, { grid });
  setSelectedFood(data.selectedFood || 'meat');
  setMuted(data.muted ?? false);
  setG({
    px: data.player.x, py: data.player.y,
    inventory:     { ...emptyInv(), ...(data.player.inventory || {}) },
    phase:         data.phase || 'playing',
    creature:      data.creature || null,
    collection:    data.collection || [],
    greatBeasts:   data.greatBeasts || [],
    worldEggs:     new Map(data.worldEggs || []),
    worldBeasts:   new Map(data.worldBeasts || []),
    spawnedChunks: new Set(data.spawnedChunks || []),
    revealed:      new Set(data.revealed || []),
    showCollection: false,
    colSelectedIdx: 0,
    collectionTab:  data.collectionTab || 'creatures',
    gbSelectedIdx:  data.gbSelectedIdx || 0,
    dragonInteract: null,
    sacrificeMode:  false,
    steps:         data.steps || 0,
    animFrames: [], animFrame: 0,
    log:           data.log || [],
  });
  G.collection.forEach(regenLines);
  G.greatBeasts.forEach(regenGreatBeastLines);
  if (G.creature?.isGreatBeast) regenGreatBeastLines(G.creature);
  else if (G.creature) regenLines(G.creature);
  updateFOV();
}

async function saveGame() {
  const json = JSON.stringify(buildSaveData(), null, 2);
  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'egg-dungeon.json',
        types: [{ description: 'JSON Save File', accept: { 'application/json': ['.json'] } }],
      });
      const w = await handle.createWritable();
      await w.write(json); await w.close();
    } else {
      const a = document.createElement('a');
      a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
      a.download = 'egg-dungeon.json'; a.click();
    }
    addLog('Game saved!');
  } catch (e) { if (e.name !== 'AbortError') addLog('Save failed.'); }
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
    applySaveData(JSON.parse(text));
    addLog('Game loaded!');
    render();
  } catch (e) { if (e.name !== 'AbortError') { addLog('Load failed.'); console.error(e); } }
}

// ── Dragon / Great Beast interaction ─────────────────────────────

function tryE() {
  if (G.phase === 'animating') return;
  const adjBeast = getAdjacentBeast();
  if (adjBeast) { openBeastOverlay(adjBeast); return; }
  tryChest();
}

function openBeastOverlay(beast) {
  G.dragonInteract = `${beast.x},${beast.y}`;
  G.showCollection = false;
  G.sacrificeMode  = false;
  render();
}

function closeBeastOverlay() {
  G.dragonInteract = null;
  G.sacrificeMode  = false;
  G.showCollection = false;
  render();
}

function tryFeedBeastGem() {
  if (!G.dragonInteract) return;
  const beast = G.worldBeasts.get(G.dragonInteract);
  if (!beast || beast.phase !== 'sleeping') {
    addLog(`The ${beast?.beastType ?? 'beast'} is already awake.`); render(); return;
  }
  if (G.inventory.gem === 0) {
    addLog('No gems! Find $ in the dungeon.'); render(); return;
  }
  G.inventory.gem--;
  beast.gemsReceived++;
  if (beast.gemsReceived >= DRAGON_GEM_COST) {
    beast.phase = 'awake';
    sfxBeastAwaken();
    addLog(`The ${beast.beastType} AWAKENS! Offer ${DRAGON_CREATURE_COST} creatures from your collection (C).`);
  } else {
    addLog(`Offered a gem. (${beast.gemsReceived}/${DRAGON_GEM_COST})`);
  }
  autoSave();
  render();
}

function enterSacrificeMode() {
  if (!G.dragonInteract) return;
  const beast = G.worldBeasts.get(G.dragonInteract);
  if (!beast || beast.phase !== 'awake') {
    addLog(`Wake the ${beast?.beastType ?? 'beast'} with ${DRAGON_GEM_COST} gems first.`); render(); return;
  }
  if (!G.collection.length) {
    addLog('No creatures to sacrifice! Hatch some eggs first.'); render(); return;
  }
  G.sacrificeMode  = true;
  G.showCollection = true;
  G.collectionTab  = 'creatures';
  render();
}

function exitSacrificeMode() {
  G.sacrificeMode  = false;
  G.showCollection = false;
  render();
}

function sacrificeCreature() {
  if (!G.dragonInteract || !G.sacrificeMode) return;
  const beast = G.worldBeasts.get(G.dragonInteract);
  if (!beast || beast.phase !== 'awake') return;
  if (!G.collection.length) { addLog('No creatures to sacrifice!'); render(); return; }

  const order  = { Legendary: 0, Rare: 1, Uncommon: 2, Common: 3 };
  const sorted = [...G.collection].sort(
    (a, b) => (order[a.rarity.name] ?? 9) - (order[b.rarity.name] ?? 9) || a.name.localeCompare(b.name)
  );
  const idx     = Math.max(0, Math.min(G.colSelectedIdx, sorted.length - 1));
  const creature = sorted[idx];

  const collIdx = G.collection.findIndex(c => c.hashVal === creature.hashVal);
  G.collection.splice(collIdx, 1);
  beast.sacrificedCreatures.push({ id: creature.id, name: creature.name, rarity: creature.rarity });
  sfxSacrifice();
  addLog(`Offered ${creature.name}. (${beast.sacrificedCreatures.length}/${DRAGON_CREATURE_COST})`);

  if (beast.sacrificedCreatures.length >= DRAGON_CREATURE_COST) {
    completeBeast(beast);
    return;
  }

  G.colSelectedIdx = Math.max(0, Math.min(G.colSelectedIdx, G.collection.length - 1));
  autoSave();
  render();
}

function completeBeast(beast) {
  const key = `${beast.x},${beast.y}`;
  G.worldBeasts.delete(key);
  G.phase = 'animating';
  animCancelled = false;
  stopIdleAnims();

  const beastDefs = {
    kraken:  { dissolveArt: SPLASH_ART,   dissolveClr1: '#40c0ff', dissolveClr2: '#104060', flashClr1: '#40e0ff', flashClr2: '#1080b0', eggStageArt: KRAKEN_EGG_STAGES[0].art,  eggClr: '#0a2a40', defaultBiome: 'wetlands', dissolveLog: 'The kraken sinks into the deep! A Kraken Egg bobs to the surface...', awakeArt: KRAKEN_BEAST_ART_AWAKE  },
    griffon: { dissolveArt: FEATHERS_ART, dissolveClr1: '#e0c040', dissolveClr2: '#705010', flashClr1: '#f0d020', flashClr2: '#c09018', eggStageArt: GRIFFON_EGG_STAGES[0].art, eggClr: '#1a3010', defaultBiome: 'forest',   dissolveLog: 'The griffon fades into golden light! A Griffon Egg drifts down...', awakeArt: GRIFFON_BEAST_ART_AWAKE },
    dragon:  { dissolveArt: EMBERS_ART,   dissolveClr1: '#ff6020', dissolveClr2: '#993010', flashClr1: '#ff8040', flashClr2: '#cc2010', eggStageArt: DRAGON_EGG_STAGES[0].art,  eggClr: '#8b2500', defaultBiome: 'badlands', dissolveLog: 'The dragon dissolves into embers! A Dragon Egg remains...',           awakeArt: BEAST_ART_AWAKE        },
  };
  const def = beastDefs[beast.beastType] ?? beastDefs.dragon;
  const { dissolveArt, dissolveClr1, dissolveClr2, flashClr1, flashClr2, eggStageArt, eggClr, dissolveLog } = def;
  const eggBiome = beast.biome ?? def.defaultBiome;

  const beastArt = ['              ', '              ', ...def.awakeArt, '              ', '              '];
  const layFrames = [
    { lines: beastArt,     color: flashClr1,    delay: 180 },
    { lines: beastArt,     color: '#ffffff',    delay: 120 },
    { lines: beastArt,     color: flashClr2,    delay: 150 },
    { lines: beastArt,     color: dissolveClr1, delay: 110 },
    { lines: dissolveArt,  color: dissolveClr1, delay: 140 },
    { lines: dissolveArt,  color: dissolveClr2, delay: 110 },
    { lines: eggStageArt,  color: eggClr,       delay: 0   },
  ];

  runLayFrame(layFrames, 0, () => {
    G.worldEggs.set(key, {
      x: beast.x, y: beast.y,
      foodSequence: [], rarityRoll: rand(0, 10000),
      inv: emptyInv(), fed: 0,
      biome: eggBiome,
      isDragonEgg: true,
      noGems: true,
      beastType: beast.beastType,
      sacrificedCreatures: beast.sacrificedCreatures,
    });
    G.dragonInteract = null;
    G.sacrificeMode  = false;
    G.showCollection = false;
    addLog(dissolveLog);
    G.phase = 'playing';
    autoSave();
    render();
  });
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
  if (!found) return;

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
      markChestOpened(cx, cy);
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
  toggleMute: () => { toggleMute(); autoSave(); },
  openFeedback: Feedback.openFeedback,
  getG: () => G,
  setSelectedFood,
  tryMove,
  tryFeed,
  tryE,
  lockpick: tryLockpick,
  closeChest,
  isChestActive: () => chestMinigame !== null,
  isDragonActive:   () => !!(G?.dragonInteract && !G.sacrificeMode),
  isDragonSacrifice: () => !!G?.sacrificeMode,
  enterSacrificeMode,
  exitSacrificeMode,
  sacrificeCreature,
  closeDragonOverlay: closeBeastOverlay,
  render,
  stopColAnims,
});

const isDev = window.location.pathname.includes('/dev/');
document.getElementById('version').textContent = 'v' + VERSION + (isDev ? '-dev' : '');
renderControls();
if (!autoLoad()) newGame();
checkPatchNotes();

// ── Dev spawn (dev environment only) ─────────────────────────────

if (isDev) {
  const devStyle = document.createElement('style');
  devStyle.textContent =
    '#dev-spawn-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.82);align-items:center;justify-content:center;z-index:400;font-family:inherit}' +
    '#dev-spawn-overlay:not([hidden]){display:flex}' +
    '#dev-spawn-box{background:#111;border:1px solid #666;padding:1.2rem 1.8rem;min-width:270px}' +
    '#dev-spawn-title{color:#ff0;font-weight:bold;margin-bottom:.9rem;letter-spacing:.06em}' +
    '.dev-item{color:#888;padding:.18rem 0;cursor:pointer}' +
    '.dev-item::before{content:"  "}' +
    '.dev-item-sel{color:#fff}' +
    '.dev-item-sel::before{content:"> "}' +
    '#dev-spawn-hint{color:#444;font-size:.8em;margin-top:.9rem;border-top:1px solid #2a2a2a;padding-top:.55rem}';
  document.head.appendChild(devStyle);

  const DEV_ITEMS = [
    { label: 'Egg \u2014 Common',          type: 'egg',         rarityRoll: 0    },
    { label: 'Egg \u2014 Uncommon',        type: 'egg',         rarityRoll: 6000 },
    { label: 'Egg \u2014 Rare',            type: 'egg',         rarityRoll: 8500 },
    { label: 'Egg \u2014 Legendary',       type: 'egg',         rarityRoll: 9700 },
    { label: 'Dragon Egg',                 type: 'dragonEgg'                     },
    { label: 'Dragon Beast (asleep)',      type: 'dragonBeast', awake: false     },
    { label: 'Dragon Beast (awake)',       type: 'dragonBeast', awake: true      },
    { label: 'Kraken Egg',                 type: 'krakenEgg'                     },
    { label: 'Kraken Beast (asleep)',      type: 'krakenBeast', awake: false     },
    { label: 'Kraken Beast (awake)',       type: 'krakenBeast', awake: true      },
    { label: 'Griffon Egg',               type: 'griffonEgg'                    },
    { label: 'Griffon Beast (asleep)',    type: 'griffonBeast', awake: false    },
    { label: 'Griffon Beast (awake)',     type: 'griffonBeast', awake: true     },
    { label: 'Chest',                      type: 'chest'                         },
    { label: '+10 food  +30 gems',         type: 'resources'                     },
    { label: 'Force shiny',                type: 'toggleShiny'                   },
  ];

  let devIdx = 0;
  let devOpen = false;

  const devEl = document.createElement('div');
  devEl.id = 'dev-spawn-overlay';
  devEl.hidden = true;
  devEl.innerHTML =
    '<div id="dev-spawn-box">' +
      '<div id="dev-spawn-title">~ DEV SPAWN ~</div>' +
      '<div id="dev-spawn-list"></div>' +
      '<div id="dev-spawn-hint">WS&nbsp;navigate &nbsp;&middot;&nbsp; E&nbsp;spawn &nbsp;&middot;&nbsp; Esc&nbsp;/&nbsp;` close</div>' +
    '</div>';
  document.body.appendChild(devEl);

  const devRender = () => {
    devEl.hidden = !devOpen;
    if (!devOpen) return;
    document.getElementById('dev-spawn-list').innerHTML = DEV_ITEMS
      .map((item, i) => {
        const label = item.type === 'toggleShiny'
          ? `Force shiny: ${devForceShiny ? 'ON  [*]' : 'OFF'}`
          : item.label;
        return `<div class="dev-item${i === devIdx ? ' dev-item-sel' : ''}">${escHtml(label)}</div>`;
      })
      .join('');
  }

  const devFreePos = () => {
    for (const [dx, dy] of [[0,-1],[0,1],[1,0],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1]]) {
      const nx = G.px + dx, ny = G.py + dy;
      const key = `${nx},${ny}`;
      if (isWalkable(nx, ny) && !G.worldEggs?.has(key) && !G.worldBeasts?.has(key)) return [nx, ny];
    }
    return null;
  }

  const devSpawn = item => {
    if (item.type === 'resources') {
      FOOD_KEYS.forEach(k => { G.inventory[k] += 10; });
      G.inventory.gem += 30;
      addLog('[DEV] Added 10\u00d7 each food and 30 gems.');
      render(); return;
    }
    const pos = devFreePos();
    if (!pos) { addLog('[DEV] No free adjacent tile.'); render(); return; }
    const [nx, ny] = pos;
    const key = `${nx},${ny}`;
    if (item.type === 'egg') {
      G.worldEggs.set(key, {
        x: nx, y: ny, foodSequence: [], rarityRoll: item.rarityRoll,
        inv: emptyInv(), fed: 0, biome: getChunkBiome(chunkX(nx), chunkY(ny)),
      });
    } else if (item.type === 'dragonEgg') {
      G.worldEggs.set(key, {
        x: nx, y: ny, foodSequence: [], rarityRoll: rand(0, 10000),
        inv: emptyInv(), fed: 0, biome: 'badlands',
        isDragonEgg: true, noGems: true, beastType: 'dragon',
        sacrificedCreatures: [
          { id: 'dev001', name: 'Dev Alpha',   rarity: { name: 'Common'    } },
          { id: 'dev002', name: 'Dev Beta',    rarity: { name: 'Uncommon'  } },
          { id: 'dev003', name: 'Dev Gamma',   rarity: { name: 'Rare'      } },
          { id: 'dev004', name: 'Dev Delta',   rarity: { name: 'Common'    } },
          { id: 'dev005', name: 'Dev Epsilon', rarity: { name: 'Legendary' } },
        ],
      });
    } else if (item.type === 'chest') {
      setTile(nx, ny, CHEST_CHAR);
    } else if (item.type === 'toggleShiny') {
      devForceShiny = !devForceShiny;
      addLog(`[DEV] Force shiny: ${devForceShiny ? 'ON' : 'OFF'}.`);
      render(); return;
    } else if (item.type === 'krakenEgg') {
      G.worldEggs.set(key, {
        x: nx, y: ny, foodSequence: [], rarityRoll: rand(0, 10000),
        inv: emptyInv(), fed: 0, biome: 'wetlands',
        isDragonEgg: true, noGems: true, beastType: 'kraken',
        sacrificedCreatures: [
          { id: 'dev011', name: 'Dev Alpha',   rarity: { name: 'Common'    } },
          { id: 'dev012', name: 'Dev Beta',    rarity: { name: 'Uncommon'  } },
          { id: 'dev013', name: 'Dev Gamma',   rarity: { name: 'Rare'      } },
          { id: 'dev014', name: 'Dev Delta',   rarity: { name: 'Common'    } },
          { id: 'dev015', name: 'Dev Epsilon', rarity: { name: 'Legendary' } },
        ],
      });
    } else if (item.type === 'dragonBeast') {
      G.worldBeasts.set(key, {
        x: nx, y: ny, beastType: 'dragon', biome: 'badlands',
        phase: item.awake ? 'awake' : 'sleeping',
        gemsReceived: item.awake ? DRAGON_GEM_COST : 0,
        sacrificedCreatures: [],
      });
    } else if (item.type === 'krakenBeast') {
      G.worldBeasts.set(key, {
        x: nx, y: ny, beastType: 'kraken', biome: 'wetlands',
        phase: item.awake ? 'awake' : 'sleeping',
        gemsReceived: item.awake ? DRAGON_GEM_COST : 0,
        sacrificedCreatures: [],
      });
    } else if (item.type === 'griffonEgg') {
      G.worldEggs.set(key, {
        x: nx, y: ny, foodSequence: [], rarityRoll: rand(0, 10000),
        inv: emptyInv(), fed: 0, biome: 'forest',
        isDragonEgg: true, noGems: true, beastType: 'griffon',
        sacrificedCreatures: [
          { id: 'dev021', name: 'Dev Alpha',   rarity: { name: 'Common'    } },
          { id: 'dev022', name: 'Dev Beta',    rarity: { name: 'Uncommon'  } },
          { id: 'dev023', name: 'Dev Gamma',   rarity: { name: 'Rare'      } },
          { id: 'dev024', name: 'Dev Delta',   rarity: { name: 'Common'    } },
          { id: 'dev025', name: 'Dev Epsilon', rarity: { name: 'Legendary' } },
        ],
      });
    } else if (item.type === 'griffonBeast') {
      G.worldBeasts.set(key, {
        x: nx, y: ny, beastType: 'griffon', biome: 'forest',
        phase: item.awake ? 'awake' : 'sleeping',
        gemsReceived: item.awake ? DRAGON_GEM_COST : 0,
        sacrificedCreatures: [],
      });
    }
    addLog(`[DEV] Spawned ${item.label}.`);
    render();
  }

  devEl.addEventListener('click', e => {
    const el = e.target.closest('.dev-item');
    if (!el) return;
    const idx = [...document.getElementById('dev-spawn-list').children].indexOf(el);
    if (idx >= 0) { devSpawn(DEV_ITEMS[idx]); devOpen = false; devRender(); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === '`' || e.key === '~') {
      e.preventDefault(); e.stopPropagation();
      devOpen = !devOpen; devRender(); return;
    }
    if (!devOpen) return;
    e.stopPropagation();
    if (e.key === 'ArrowUp'   || e.key === 'w' || e.key === 'W') { e.preventDefault(); devIdx = Math.max(0, devIdx - 1); devRender(); }
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); devIdx = Math.min(DEV_ITEMS.length - 1, devIdx + 1); devRender(); }
    else if (e.key === 'Enter' || e.key === 'e' || e.key === 'E' || e.key === ' ') { e.preventDefault(); devSpawn(DEV_ITEMS[devIdx]); devOpen = false; devRender(); }
    else if (e.key === 'Escape')    { devOpen = false; devRender(); }
  }, true);
}
