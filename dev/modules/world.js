// Infinite chunked world: generation, tile access, biome lookup.
// Owns WORLD_SEED and the chunk cache.

import { BIOMES, BIOME_KEYS, FOOD_INFO, FOOD_CHARS, GEM_CHAR, CHEST_CHAR, CW, CH, CORR_X, CORR_Y, djb2, mulberry32, GREAT_BEAST_BIOMES } from './utils.js';

export let WORLD_SEED = 0;
export const chunks = new Map();
const openedChests = new Set();

export function resetWorld(seed) {
  WORLD_SEED = seed;
  chunks.clear();
  openedChests.clear();
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

// Biome zones span 3×3 chunks so borders don't flicker every chunk
export function getChunkBiome(chunkX, chunkY) {
  const zx = Math.floor(chunkX / 3), zy = Math.floor(chunkY / 3);
  const h = djb2(`b${WORLD_SEED},${zx},${zy}`);
  return BIOME_KEYS[h % BIOME_KEYS.length];
}

export function generateChunk(cx, cy) {
  const grid = Array.from({ length: CH }, () => Array(CW).fill('#'));
  const rng = mulberry32(chunkSeed(cx, cy));
  const biomeKey = getChunkBiome(cx, cy);
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
