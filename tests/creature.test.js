import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateCreature, regenLines, buildAnimSeq, EGG_STAGES, getEggStage, EYE_ROW } from '../modules/creature.js';
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
