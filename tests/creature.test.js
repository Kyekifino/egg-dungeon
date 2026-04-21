import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateCreature, regenLines, buildAnimSeq, EGG_STAGES, DRAGON_EGG_STAGES, getEggStage, EYE_ROW, generateDragon, regenDragonLines, buildDragonAnimSeq, generateGreatBeast, regenGreatBeastLines } from '../modules/creature.js';
import { emptyInv, FOOD_KEYS, RARITIES } from '../modules/utils.js';

function makeEgg(overrides = {}) {
  return {
    foodSequence: ['meat', 'meat', 'fish', 'berries', 'mushroom', 'grain', 'meat', 'fish', 'berries', 'mushroom'],
    rarityRoll: 0,
    inv: { ...emptyInv(), meat: 4, fish: 2, berries: 2, mushroom: 1, grain: 1 },
    fed: 10,
    biome: 'badlands',
    ...overrides,
  };
}

describe('generateCreature', () => {
  it('returns all required fields', () => {
    const c = generateCreature(makeEgg());
    assert.ok(c.name, 'missing name');
    assert.ok(c.lines, 'missing lines');
    assert.ok(c.color, 'missing color');
    assert.ok(c.rarity, 'missing rarity');
    assert.ok(c.traits, 'missing traits');
    assert.ok(c.diet, 'missing diet');
    assert.ok(c.dom, 'missing dom');
    assert.ok(typeof c.hashVal === 'number', 'missing hashVal');
    assert.ok(typeof c.id === 'string', 'missing id');
  });

  it('lines is a non-empty array of strings', () => {
    const c = generateCreature(makeEgg());
    assert.ok(Array.isArray(c.lines) && c.lines.length > 0);
    assert.ok(c.lines.every(l => typeof l === 'string'));
  });

  it('rarity is a known rarity object', () => {
    const c = generateCreature(makeEgg());
    assert.ok(RARITIES.some(r => r.name === c.rarity.name));
  });

  it('is deterministic for same egg', () => {
    const egg = makeEgg();
    const a = generateCreature(egg);
    const b = generateCreature(egg);
    assert.equal(a.name, b.name);
    assert.deepEqual(a.lines, b.lines);
  });

  it('different eggs produce different creatures', () => {
    const allMeat = { foodSequence: Array(10).fill('meat'), inv: { ...emptyInv(), meat: 10 } };
    const allFish = { foodSequence: Array(10).fill('fish'), inv: { ...emptyInv(), fish: 10 } };
    const a = generateCreature(makeEgg(allMeat));
    const b = generateCreature(makeEgg(allFish));
    assert.notEqual(a.dom, b.dom);
  });

  it('dom is one of the food keys', () => {
    const c = generateCreature(makeEgg());
    assert.ok(FOOD_KEYS.includes(c.dom));
  });
});

describe('regenLines', () => {
  it('restores lines from hashVal', () => {
    const c = generateCreature(makeEgg());
    const originalLines = [...c.lines];
    c.lines = null;
    regenLines(c);
    assert.deepEqual(c.lines, originalLines);
  });

  it('writes dom back when missing (blink regression)', () => {
    // Simulate old save: creature has traits but no dom field stored
    const c = generateCreature(makeEgg());
    const expectedDom = c.dom;
    delete c.dom;
    delete c.sec;
    regenLines(c);
    assert.equal(c.dom, expectedDom, 'dom must be set after regenLines so eye row lookup works');
  });

  it('eye row has o after regenLines for all food types', () => {
    for (const dom of ['meat', 'fish', 'berries', 'mushroom', 'grain']) {
      const inv = { ...emptyInv(), [dom]: 10 };
      const egg = makeEgg({ foodSequence: Array(10).fill(dom), inv });
      const c = generateCreature(egg);
      delete c.dom; delete c.sec; // simulate missing dom
      regenLines(c);
      const ri = EYE_ROW[c.dom];
      assert.ok(ri !== undefined, `EYE_ROW missing for dom=${dom}`);
      assert.ok(c.lines[ri].includes('o'), `no eyes in row ${ri} for dom=${dom}: "${c.lines[ri]}"`);
    }
  });
});

describe('buildAnimSeq', () => {
  it('returns a non-empty array', () => {
    const c = generateCreature(makeEgg());
    const seq = buildAnimSeq(c);
    assert.ok(Array.isArray(seq) && seq.length > 0);
  });

  it('last frame has delay 0 (stop signal)', () => {
    const c = generateCreature(makeEgg());
    const seq = buildAnimSeq(c);
    assert.equal(seq.at(-1).delay, 0);
  });

  it('every frame has lines and color', () => {
    const c = generateCreature(makeEgg());
    for (const frame of buildAnimSeq(c)) {
      assert.ok(Array.isArray(frame.lines));
      assert.ok(typeof frame.color === 'string');
    }
  });
});

describe('EGG_STAGES / getEggStage', () => {
  it('getEggStage returns 0 when unfed', () => {
    assert.equal(getEggStage(0), 0);
  });

  it('getEggStage returns last stage when fully fed', () => {
    assert.equal(getEggStage(10), EGG_STAGES.length - 1);
  });

  it('each stage has art and color', () => {
    for (const stage of EGG_STAGES) {
      assert.ok(Array.isArray(stage.art) && stage.art.length > 0);
      assert.ok(typeof stage.color === 'string');
    }
  });
});

describe('DRAGON_EGG_STAGES', () => {
  it('has the same number of stages as EGG_STAGES', () => {
    assert.equal(DRAGON_EGG_STAGES.length, EGG_STAGES.length);
  });

  it('each stage has art and color', () => {
    for (const stage of DRAGON_EGG_STAGES) {
      assert.ok(Array.isArray(stage.art) && stage.art.length > 0);
      assert.ok(typeof stage.color === 'string');
    }
  });
});

function makeDragonEgg(overrides = {}) {
  return {
    foodSequence: Array(10).fill('meat'),
    rarityRoll: 0,
    sacrificedCreatures: [
      { id: 'aaa111', name: 'FirstCreature', rarity: { name: 'Common' } },
      { id: 'bbb222', name: 'SecondCreature', rarity: { name: 'Uncommon' } },
    ],
    beastType: 'dragon',
    ...overrides,
  };
}

describe('generateDragon', () => {
  it('returns all required fields', () => {
    const d = generateDragon(makeDragonEgg());
    assert.ok(d.id, 'missing id');
    assert.ok(d.name, 'missing name');
    assert.ok(d.lines, 'missing lines');
    assert.ok(d.color, 'missing color');
    assert.ok(d.rarity, 'missing rarity');
    assert.ok(d.traits, 'missing traits');
    assert.ok(typeof d.hashVal === 'number', 'missing hashVal');
    assert.equal(d.isGreatBeast, true);
    assert.equal(d.beastType, 'dragon');
    assert.equal(d.dom, null);
  });

  it('lines is a non-empty array of strings', () => {
    const d = generateDragon(makeDragonEgg());
    assert.ok(Array.isArray(d.lines) && d.lines.length > 0);
    assert.ok(d.lines.every(l => typeof l === 'string'));
  });

  it('traits includes Great Beast', () => {
    const d = generateDragon(makeDragonEgg());
    assert.ok(d.traits.includes('Great Beast'));
  });

  it('is deterministic for same egg', () => {
    const egg = makeDragonEgg();
    const a = generateDragon(egg);
    const b = generateDragon(egg);
    assert.equal(a.name, b.name);
    assert.deepEqual(a.lines, b.lines);
    assert.equal(a.hashVal, b.hashVal);
  });

  it('different sacrificed creatures produce different dragons', () => {
    const a = generateDragon(makeDragonEgg({ sacrificedCreatures: [{ id: 'x1' }, { id: 'x2' }] }));
    const b = generateDragon(makeDragonEgg({ sacrificedCreatures: [{ id: 'y3' }, { id: 'y4' }] }));
    assert.notEqual(a.hashVal, b.hashVal);
  });

  it('handles missing sacrificedCreatures gracefully', () => {
    const d = generateDragon({ ...makeDragonEgg(), sacrificedCreatures: undefined });
    assert.ok(d.id);
  });

  it('Legendary rarity gets a color shifted toward gold', () => {
    const d = generateDragon(makeDragonEgg({ rarityRoll: 9800 }));
    const common = generateDragon(makeDragonEgg({ rarityRoll: 0 }));
    assert.equal(d.rarity.name, 'Legendary');
    assert.notEqual(d.color, common.color);
  });

  it('Rare rarity gets a color blended toward blue', () => {
    const d = generateDragon(makeDragonEgg({ rarityRoll: 9000 }));
    assert.equal(d.rarity.name, 'Rare');
    assert.notEqual(d.color, '#e06020');
  });

  it('Uncommon rarity gets a color blended toward orange', () => {
    const d = generateDragon(makeDragonEgg({ rarityRoll: 7000 }));
    assert.equal(d.rarity.name, 'Uncommon');
    assert.notEqual(d.color, '#e06020');
  });

  it('produces fill-substituted lines when fill char is not =', () => {
    // Try enough distinct eggs to hit a non-= fill substitution
    let fillHit = false;
    for (let i = 0; i < 20 && !fillHit; i++) {
      const d = generateDragon(makeDragonEgg({ rarityRoll: i * 37 + 13,
        sacrificedCreatures: [{ id: `s${i}` }, { id: `t${i}` }] }));
      for (const line of d.lines) {
        if (['#','~','X','+','*','^','-'].some(ch => line.includes(ch))) {
          fillHit = true; break;
        }
      }
    }
    assert.ok(fillHit, 'expected at least one dragon to use fill substitution');
  });
});

describe('regenDragonLines', () => {
  it('restores lines from hashVal', () => {
    const d = generateDragon(makeDragonEgg());
    const originalLines = [...d.lines];
    d.lines = null;
    regenDragonLines(d);
    assert.deepEqual(d.lines, originalLines);
  });

  it('applies Legendary line override on regen', () => {
    const d = generateDragon(makeDragonEgg({ rarityRoll: 9800 }));
    d.lines = null;
    regenDragonLines(d);
    assert.ok(d.lines[0].includes('*'), 'Legendary top row should have stars');
  });
});

describe('buildDragonAnimSeq', () => {
  it('returns a non-empty array', () => {
    const d = generateDragon(makeDragonEgg());
    const seq = buildDragonAnimSeq(d);
    assert.ok(Array.isArray(seq) && seq.length > 0);
  });

  it('last frame has delay 0 (stop signal)', () => {
    const d = generateDragon(makeDragonEgg());
    const seq = buildDragonAnimSeq(d);
    assert.equal(seq.at(-1).delay, 0);
  });

  it('every frame has lines array and string color', () => {
    const d = generateDragon(makeDragonEgg());
    for (const frame of buildDragonAnimSeq(d)) {
      assert.ok(Array.isArray(frame.lines));
      assert.ok(typeof frame.color === 'string');
    }
  });

  it('all frames have the same row count as dragon lines', () => {
    const d = generateDragon(makeDragonEgg());
    const seq = buildDragonAnimSeq(d);
    for (const frame of seq) {
      assert.equal(frame.lines.length, d.lines.length);
    }
  });
});

describe('generateGreatBeast / regenGreatBeastLines', () => {
  it('generateGreatBeast returns dragon for beastType dragon', () => {
    const d = generateGreatBeast(makeDragonEgg());
    assert.equal(d.beastType, 'dragon');
    assert.equal(d.isGreatBeast, true);
  });

  it('generateGreatBeast falls through to dragon for unknown beastType', () => {
    const d = generateGreatBeast({ ...makeDragonEgg(), beastType: 'unknown' });
    assert.ok(d.id);
  });

  it('regenGreatBeastLines works for dragon', () => {
    const d = generateDragon(makeDragonEgg());
    const originalLines = [...d.lines];
    d.lines = null;
    regenGreatBeastLines(d);
    assert.deepEqual(d.lines, originalLines);
  });

  it('regenGreatBeastLines falls through to dragon for unknown beastType', () => {
    const d = generateDragon(makeDragonEgg());
    d.beastType = 'unknown';
    const originalLines = [...d.lines];
    d.lines = null;
    regenGreatBeastLines(d);
    assert.deepEqual(d.lines, originalLines);
  });
});
