import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetWorld, getChunk, getTile, setTile, isWalkable, getChunkBiome, chunkX, chunkY, localX, localY } from '../modules/world.js';
import { CW, CH, CORR_X, CORR_Y, BIOME_KEYS } from '../modules/utils.js';

beforeEach(() => resetWorld(42));

describe('chunk generation', () => {
  it('chunk has correct dimensions', () => {
    const { grid } = getChunk(0, 0);
    assert.equal(grid.length, CH);
    assert.ok(grid.every(row => row.length === CW));
  });

  it('guaranteed corridor tiles exist', () => {
    const { grid } = getChunk(0, 0);
    for (let y = 0; y < CH; y++) assert.notEqual(grid[y][CORR_X], '#', `col ${CORR_X} row ${y} blocked`);
    for (let x = 0; x < CW; x++) assert.notEqual(grid[CORR_Y][x], '#', `row ${CORR_Y} col ${x} blocked`);
  });

  it('same seed produces same chunk', () => {
    resetWorld(999);
    const a = getChunk(1, 2);
    resetWorld(999);
    const b = getChunk(1, 2);
    assert.deepEqual(a.grid, b.grid);
  });

  it('different seeds produce different chunks', () => {
    resetWorld(1);
    const a = JSON.stringify(getChunk(0, 0).grid);
    resetWorld(2);
    const b = JSON.stringify(getChunk(0, 0).grid);
    assert.notEqual(a, b);
  });

  it('tiles are only valid chars', () => {
    const valid = new Set(['.', '#', '%', '~', '*', '^', ',', '$', '■']);
    const { grid } = getChunk(0, 0);
    for (const row of grid)
      for (const ch of row)
        assert.ok(valid.has(ch), `unexpected tile: ${ch}`);
  });
});

describe('biome', () => {
  it('returns a known biome key', () => {
    const b = getChunkBiome(0, 0);
    assert.ok(BIOME_KEYS.includes(b));
  });

  it('adjacent zone chunks can share a biome (3×3 zones)', () => {
    // Chunks 0,0 and 1,0 may or may not share — both valid biome keys
    assert.ok(BIOME_KEYS.includes(getChunkBiome(0, 0)));
    assert.ok(BIOME_KEYS.includes(getChunkBiome(1, 0)));
  });
});

describe('coordinate helpers', () => {
  it('chunkX / chunkY round-trip', () => {
    assert.equal(chunkX(CW * 3 + 5), 3);
    assert.equal(chunkY(CH * 2 + 3), 2);
  });

  it('localX / localY wrap correctly', () => {
    assert.equal(localX(CW + 5), 5);
    assert.equal(localY(-1), CH - 1);
  });
});

describe('getTile / setTile', () => {
  it('reads back what was written', () => {
    setTile(5, 5, '.');
    assert.equal(getTile(5, 5), '.');
  });
});

describe('isWalkable', () => {
  it('corridor tiles are walkable', () => {
    assert.equal(isWalkable(CORR_X, CORR_Y), true);
  });
});
