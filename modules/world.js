// Infinite chunked world: generation, tile access, biome lookup.
// Owns WORLD_SEED and the chunk cache.

import { BIOMES, BIOME_KEYS, FOOD_INFO, FOOD_CHARS, GEM_CHAR, CHEST_CHAR, CW, CH, CORR_X, CORR_Y, djb2, mulberry32, GREAT_BEAST_BIOMES } from './utils.js';

// ── Labrynth zone cache ───────────────────────────────────────────────
// Zone-level maze grids are generated once and sliced per chunk request.
const labrynthZones = new Map();

export let WORLD_SEED = 0;
export const chunks = new Map();
const openedChests = new Set();

export function resetWorld(seed) {
  WORLD_SEED = seed;
  chunks.clear();
  openedChests.clear();
  labrynthZones.clear();
}

export function markChestOpened(wx, wy) { openedChests.add(`${wx},${wy}`); }
export function setOpenedChests(set) { openedChests.clear(); for (const v of set) openedChests.add(v); }
export function getOpenedChests() { return openedChests; }

function chunkSeed(cx, cy) {
  let h = WORLD_SEED >>> 0;
  h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0);
  h = (Math.imul(h ^ ((cx * 0x9e3779b9) | 0), 0x517cc1b7) >>> 0);
  h = (Math.imul(h ^ ((cy * 0x27d4eb2f) | 0), 0x6b9b0b) >>> 0);
  return h;
}

// Biome zones span 3×3 chunks so borders don't flicker every chunk.
// Labrynth appears in ~1/30 zones (rare end-game area).
export function getChunkBiome(chunkX, chunkY) {
  const zx = Math.floor(chunkX / 3), zy = Math.floor(chunkY / 3);
  const h = djb2(`b${WORLD_SEED},${zx},${zy}`);
  if (h % 100 === 0) return 'labrynth';
  return BIOME_KEYS[h % BIOME_KEYS.length];
}

// ── Labrynth zone maze generation ────────────────────────────────────

function generateLabrynthZone(zx, zy) {
  const seed = djb2(`lab${WORLD_SEED},${zx},${zy}`);
  const rng  = mulberry32(seed);
  const W = 3 * CW;   // 78 tiles wide
  const H = 3 * CH;   // 48 tiles tall

  const grid = Array.from({ length: H }, () => Array(W).fill('#'));

  // DFS maze: cells spaced STEP apart, 2-tile-wide corridors
  const STEP = 5;
  const gW = Math.floor((W - 2) / STEP);   // ~15 cells across
  const gH = Math.floor((H - 2) / STEP);   // ~9 cells down

  // Cell center coords (top-left of 2×2 open cell)
  const cx = i => 1 + i * STEP + 1;
  const cy = j => 1 + j * STEP + 1;

  function open(x, y) {
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = '.';
  }

  function openCell(i, j) {
    open(cx(i), cy(j)); open(cx(i) + 1, cy(j));
    open(cx(i), cy(j) + 1); open(cx(i) + 1, cy(j) + 1);
  }

  function carvePassage(i1, j1, i2, j2) {
    const x1 = cx(i1), y1 = cy(j1), x2 = cx(i2), y2 = cy(j2);
    if (i1 === i2) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2) + 1; y++) {
        open(x1, y); open(x1 + 1, y);
      }
    } else {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2) + 1; x++) {
        open(x, y1); open(x, y1 + 1);
      }
    }
  }

  const visited = Array.from({ length: gH }, () => Array(gW).fill(false));

  function dfs(i, j) {
    visited[j][i] = true;
    openCell(i, j);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let k = dirs.length - 1; k > 0; k--) {
      const m = rng.int(0, k + 1);
      [dirs[k], dirs[m]] = [dirs[m], dirs[k]];
    }
    for (const [di, dj] of dirs) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || ni >= gW || nj < 0 || nj >= gH || visited[nj][ni]) continue;
      carvePassage(i, j, ni, nj);
      dfs(ni, nj);
    }
  }

  const startI = Math.floor(gW / 2), startJ = Math.floor(gH / 2);
  dfs(startI, startJ);

  // Enforce CORR corridors on every chunk boundary so cross-biome
  // entry/exit always hits a walkable tile (same guarantee as normal chunks).
  for (let ci = 0; ci < 3; ci++) {
    const colX = ci * CW + CORR_X;
    const rowY = ci * CH + CORR_Y;
    for (let y = 0; y < H; y++) grid[y][colX] = '.';
    for (let x = 0; x < W; x++) grid[rowY][x] = '.';
  }

  const angelLocalX = cx(startI);
  const angelLocalY = cy(startJ);

  return { grid, angelLocalX, angelLocalY };
}

function getLabrynthZone(zx, zy) {
  const key = `${zx},${zy}`;
  if (!labrynthZones.has(key)) labrynthZones.set(key, generateLabrynthZone(zx, zy));
  return labrynthZones.get(key);
}

// Returns world coords of the Angel for the labrynth zone containing chunk
// (cx, cy), or null if this chunk isn't the zone centre chunk.
export function getLabrynthAngelPos(cx, cy) {
  if (getChunkBiome(cx, cy) !== 'labrynth') return null;
  const zx = Math.floor(cx / 3), zy = Math.floor(cy / 3);
  if (cx !== zx * 3 + 1 || cy !== zy * 3 + 1) return null;   // only centre chunk
  const zone = getLabrynthZone(zx, zy);
  return {
    wx: zx * 3 * CW + zone.angelLocalX,
    wy: zy * 3 * CH + zone.angelLocalY,
  };
}

export function generateChunk(cx, cy) {
  const biomeKey = getChunkBiome(cx, cy);

  // Labrynth: slice from zone-level DFS maze; no items or rooms
  if (biomeKey === 'labrynth') {
    const zx = Math.floor(cx / 3), zy = Math.floor(cy / 3);
    const zone = getLabrynthZone(zx, zy);
    const offX = (cx - zx * 3) * CW, offY = (cy - zy * 3) * CH;
    const grid = Array.from({ length: CH }, (_, y) =>
      Array.from({ length: CW }, (_, x) => zone.grid[offY + y][offX + x])
    );
    return { grid };
  }

  const grid = Array.from({ length: CH }, () => Array(CW).fill('#'));
  const rng = mulberry32(chunkSeed(cx, cy));
  const biomeFood = BIOMES[biomeKey].food;
  const biomeFoodCh = FOOD_CHARS.find(c => FOOD_INFO[c].key === biomeFood);

  // Guaranteed corridors (infinite connectivity)
  for (let y = 0; y < CH; y++) grid[y][CORR_X] = '.';
  for (let x = 0; x < CW; x++) grid[CORR_Y][x] = '.';

  // Random rooms
  const n = rng.int(2, 5);
  for (let i = 0; i < n; i++) {
    const rw = rng.int(4, 10), rh = rng.int(3, 6);
    const rx = rng.int(1, CW - rw - 1), ry = rng.int(1, CH - rh - 1);
    for (let y = ry; y < ry + rh; y++)
      for (let x = rx; x < rx + rw; x++)
        grid[y][x] = '.';
    const rmx = rx + Math.floor(rw / 2), rmy = ry + Math.floor(rh / 2);
    let x = rmx; while (x !== CORR_X) { grid[rmy][x] = '.'; x += CORR_X > x ? 1 : -1; }
    let y = rmy; while (y !== CORR_Y) { grid[y][rmx] = '.'; y += CORR_Y > y ? 1 : -1; }
  }

  // Scatter items on floor tiles
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      if (grid[y][x] !== '.') continue;
      const r = rng.next();
      if (x === CORR_X || y === CORR_Y) continue;
      if (r < 0.0005) {
        grid[y][x] = CHEST_CHAR;
      } else if (r < 0.0015) {
        grid[y][x] = GEM_CHAR;
      } else if (r < 0.03) {
        grid[y][x] = rng.next() < 0.65 ? biomeFoodCh : FOOD_CHARS[rng.int(0, FOOD_CHARS.length)];
      }
    }

  return { grid };
}

export function getChunk(cx, cy) {
  const key = `${cx},${cy}`;
  if (chunks.has(key)) {
    const chunk = chunks.get(key);
    chunks.delete(key);
    chunks.set(key, chunk);
    return chunk;
  }
  const chunk = generateChunk(cx, cy);
  for (let ly = 0; ly < CH; ly++)
    for (let lx = 0; lx < CW; lx++)
      if (chunk.grid[ly][lx] === CHEST_CHAR && openedChests.has(`${cx * CW + lx},${cy * CH + ly}`))
        chunk.grid[ly][lx] = '.';
  chunks.set(key, chunk);
  return chunk;
}

// Coordinate helpers
export const chunkX = wx => Math.floor(wx / CW);
export const chunkY = wy => Math.floor(wy / CH);
export const localX = wx => ((wx % CW) + CW) % CW;
export const localY = wy => ((wy % CH) + CH) % CH;

export function getTile(wx, wy) {
  return getChunk(chunkX(wx), chunkY(wy)).grid[localY(wy)][localX(wx)];
}

export function setTile(wx, wy, ch) {
  getChunk(chunkX(wx), chunkY(wy)).grid[localY(wy)][localX(wx)] = ch;
}

export function isWalkable(wx, wy) { const t = getTile(wx, wy); return t !== '#' && t !== CHEST_CHAR; }

// Returns deterministic wild-egg spawn info for a chunk, or null (~15% of chunks).
export function getChunkEggSpawn(cx, cy) {
  if (getChunkBiome(cx, cy) === 'labrynth') return null;
  const rng = mulberry32(chunkSeed(cx, cy) ^ 0x3a7f9d2c);
  if (rng.next() > 0.15) return null;
  const chunk = getChunk(cx, cy);
  const candidates = [];
  for (let ly = 0; ly < CH; ly++)
    for (let lx = 0; lx < CW; lx++)
      if (chunk.grid[ly][lx] === '.' && lx !== CORR_X && ly !== CORR_Y)
        candidates.push([cx * CW + lx, cy * CH + ly]);
  if (candidates.length === 0) return null;
  const [wx, wy] = candidates[rng.int(0, candidates.length)];
  return { wx, wy, rarityRoll: rng.int(0, 10000) };
}

// Room = 3+ cardinal neighbours walkable (corridors have ≤2)
export function isRoomTile(wx, wy) {
  return [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => isWalkable(wx + dx, wy + dy)).length >= 3;
}

// Returns {wx, wy, beastType} for a great beast spawn in this chunk, or null.
// Each biome in GREAT_BEAST_BIOMES has one beast per spawnRate badlands chunks.
export function getGreatBeastSpawn(cx, cy) {
  const biomeKey = getChunkBiome(cx, cy);
  const cfg = GREAT_BEAST_BIOMES[biomeKey];
  if (!cfg) return null;

  const h = djb2(`gb${WORLD_SEED},${cx},${cy}`);
  if (h % cfg.spawnRate !== 0) return null;

  const chunk = getChunk(cx, cy);
  const rng = mulberry32(h ^ 0x6b4e2f1a);
  const candidates = [];
  for (let ly = 0; ly < CH; ly++)
    for (let lx = 0; lx < CW; lx++)
      if (chunk.grid[ly][lx] === '.' && lx !== CORR_X && ly !== CORR_Y)
        candidates.push([cx * CW + lx, cy * CH + ly]);
  if (!candidates.length) return null;
  const [wx, wy] = candidates[rng.int(0, candidates.length)];
  return { wx, wy, beastType: cfg.beastType };
}
