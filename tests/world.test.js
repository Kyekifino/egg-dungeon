import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetWorld, getChunk, getTile, setTile, isWalkable, getChunkBiome, getChunkEggSpawn, isRoomTile, getGreatBeastSpawn, getLabrynthAngelPos, chunkX, chunkY, localX, localY, markChestOpened, setOpenedChests, getOpenedChests } from '../modules/world.js';
import { CW, CH, CORR_X, CORR_Y, BIOME_KEYS, CHEST_CHAR, GEM_CHAR, BEAST_TYPES } from '../modules/utils.js';

const ALL_BIOME_KEYS = [...BIOME_KEYS, 'labrynth'];

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
  it('returns a known biome key (including labrynth)', () => {
    const b = getChunkBiome(0, 0);
    assert.ok(ALL_BIOME_KEYS.includes(b));
  });

  it('adjacent zone chunks can share a biome (3×3 zones)', () => {
    assert.ok(ALL_BIOME_KEYS.includes(getChunkBiome(0, 0)));
    assert.ok(ALL_BIOME_KEYS.includes(getChunkBiome(1, 0)));
  });

  it('labrynth chunk has correct dimensions and only . and # tiles', () => {
    let found = false;
    for (let cx = 0; cx < 60 && !found; cx++)
      for (let cy = 0; cy < 60 && !found; cy++)
        if (getChunkBiome(cx, cy) === 'labrynth') {
          const { grid } = getChunk(cx, cy);
          assert.equal(grid.length, CH);
          assert.ok(grid.every(row => row.length === CW));
          for (const row of grid)
            for (const ch of row)
              assert.ok(ch === '.' || ch === '#', `unexpected labrynth tile: ${ch}`);
          found = true;
        }
    assert.ok(found, 'no labrynth chunk found in 3600-chunk scan');
  });

  it('labrynth chunk still has walkable CORR tiles', () => {
    let found = false;
    for (let cx = 0; cx < 60 && !found; cx++)
      for (let cy = 0; cy < 60 && !found; cy++)
        if (getChunkBiome(cx, cy) === 'labrynth') {
          const { grid } = getChunk(cx, cy);
          assert.notEqual(grid[CORR_Y][CORR_X], '#', 'CORR intersection blocked in labrynth');
          found = true;
        }
    assert.ok(found, 'no labrynth chunk found in 3600-chunk scan');
  });
});

describe('getLabrynthAngelPos', () => {
  it('returns null for non-labrynth chunks', () => {
    for (let cx = 0; cx < 10; cx++)
      for (let cy = 0; cy < 10; cy++)
        if (getChunkBiome(cx, cy) !== 'labrynth')
          assert.equal(getLabrynthAngelPos(cx, cy), null);
  });

  it('returns a position for the centre chunk of a labrynth zone', () => {
    let pos = null;
    outer: for (let zx = 0; zx < 20; zx++)
      for (let zy = 0; zy < 20; zy++) {
        const cx = zx * 3 + 1, cy = zy * 3 + 1;
        if (getChunkBiome(cx, cy) === 'labrynth') {
          pos = getLabrynthAngelPos(cx, cy);
          break outer;
        }
      }
    assert.ok(pos !== null, 'no labrynth centre chunk found in scan');
    assert.equal(typeof pos.wx, 'number');
    assert.equal(typeof pos.wy, 'number');
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

describe('item tile generation', () => {
  it('some chunks contain chest tiles', () => {
    let found = false;
    outer: for (let cx = 0; cx < 25 && !found; cx++)
      for (let cy = 0; cy < 25 && !found; cy++) {
        const { grid } = getChunk(cx, cy);
        for (const row of grid)
          if (row.includes(CHEST_CHAR)) { found = true; break outer; }
      }
    assert.ok(found, 'no chest tile found in 625-chunk scan');
  });

  it('some chunks contain gem tiles', () => {
    let found = false;
    outer: for (let cx = 0; cx < 25 && !found; cx++)
      for (let cy = 0; cy < 25 && !found; cy++) {
        const { grid } = getChunk(cx, cy);
        for (const row of grid)
          if (row.includes(GEM_CHAR)) { found = true; break outer; }
      }
    assert.ok(found, 'no gem tile found in 625-chunk scan');
  });
});

describe('getChunkEggSpawn', () => {
  it('returns null for most chunks (~85% spawn rate)', () => {
    let nullCount = 0;
    for (let cx = 0; cx < 5; cx++)
      for (let cy = 0; cy < 5; cy++)
        if (getChunkEggSpawn(cx, cy) === null) nullCount++;
    assert.ok(nullCount > 0, 'expected some chunks to have no egg spawn');
  });

  it('returns spawn with wx, wy, rarityRoll for qualifying chunks', () => {
    let spawn = null;
    for (let cx = 0; cx < 10 && !spawn; cx++)
      for (let cy = 0; cy < 10 && !spawn; cy++)
        spawn = getChunkEggSpawn(cx, cy);
    assert.ok(spawn !== null, 'no egg spawn found in 100-chunk scan');
    assert.equal(typeof spawn.wx, 'number');
    assert.equal(typeof spawn.wy, 'number');
    assert.ok(spawn.rarityRoll >= 0 && spawn.rarityRoll < 10000);
  });

  it('spawn wx/wy lands on a floor tile', () => {
    let spawn = null;
    for (let cx = 0; cx < 10 && !spawn; cx++)
      for (let cy = 0; cy < 10 && !spawn; cy++)
        spawn = getChunkEggSpawn(cx, cy);
    assert.ok(spawn !== null);
    assert.equal(getTile(spawn.wx, spawn.wy), '.');
  });
});

describe('isRoomTile', () => {
  it('returns true at corridor intersection (4 walkable neighbours)', () => {
    assert.equal(isRoomTile(CORR_X, CORR_Y), true);
  });

  it('returns false somewhere in the map (corridor-only tile or wall)', () => {
    let falseSeen = false;
    for (let wx = 0; wx < CW * 3 && !falseSeen; wx++)
      for (let wy = 0; wy < CH * 3 && !falseSeen; wy++)
        if (!isRoomTile(wx, wy)) falseSeen = true;
    assert.ok(falseSeen, 'expected at least one tile with < 3 walkable neighbours');
  });
});

describe('getGreatBeastSpawn', () => {
  it('returns null for a non-badlands chunk', () => {
    let tested = false;
    for (let cx = 0; cx < 30 && !tested; cx++) {
      for (let cy = 0; cy < 30 && !tested; cy++) {
        if (getChunkBiome(cx, cy) !== 'badlands') {
          assert.equal(getGreatBeastSpawn(cx, cy), null);
          tested = true;
        }
      }
    }
    assert.ok(tested, 'could not find a non-badlands chunk in scan range');
  });

  it('returns null for most badlands chunks (zone hash not qualifying)', () => {
    let nullSeen = false;
    for (let cx = 0; cx < 50 && !nullSeen; cx++) {
      for (let cy = 0; cy < 50 && !nullSeen; cy++) {
        if (getChunkBiome(cx, cy) === 'badlands' && getGreatBeastSpawn(cx, cy) === null)
          nullSeen = true;
      }
    }
    assert.ok(nullSeen, 'expected most badlands chunks to return null');
  });

  it('returns spawn with wx, wy, beastType for qualifying chunk', () => {
    let spawn = null;
    for (let cx = 0; cx < 100 && !spawn; cx++)
      for (let cy = 0; cy < 100 && !spawn; cy++)
        spawn = getGreatBeastSpawn(cx, cy);
    assert.ok(spawn !== null, 'no great beast spawn found in 10000-chunk scan');
    assert.equal(typeof spawn.wx, 'number');
    assert.equal(typeof spawn.wy, 'number');
    assert.ok(BEAST_TYPES.includes(spawn.beastType));
  });
});

describe('openedChests', () => {
  beforeEach(() => resetWorld(42));

  it('markChestOpened / getOpenedChests round-trips', () => {
    markChestOpened(5, 10);
    assert.ok(getOpenedChests().has('5,10'));
  });

  it('setOpenedChests replaces the set', () => {
    markChestOpened(1, 2);
    setOpenedChests(new Set(['3,4', '5,6']));
    assert.ok(!getOpenedChests().has('1,2'));
    assert.ok(getOpenedChests().has('3,4'));
  });

  it('regenerated chunk has opened chest replaced with floor', () => {
    resetWorld(42);
    let chestWx, chestWy;
    outer: for (let cx = 0; cx < 50 && chestWx === undefined; cx++)
      for (let cy = 0; cy < 50 && chestWx === undefined; cy++) {
        const chunk = getChunk(cx, cy);
        const lh = chunk.grid.length, lw = chunk.grid[0].length;
        for (let ly = 0; ly < lh; ly++)
          for (let lx = 0; lx < lw; lx++)
            if (chunk.grid[ly][lx] === CHEST_CHAR) {
              chestWx = cx * lw + lx;
              chestWy = cy * lh + ly;
              break outer;
            }
      }
    assert.ok(chestWx !== undefined, 'no chest found in scan');
    resetWorld(42);
    setOpenedChests(new Set([`${chestWx},${chestWy}`]));
    assert.equal(getTile(chestWx, chestWy), '.', 'opened chest should regenerate as floor');
  });
});
