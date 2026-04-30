import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateCreature, regenLines, buildAnimSeq, EGG_STAGES, DRAGON_EGG_STAGES, KRAKEN_EGG_STAGES, GRIFFON_EGG_STAGES, MANTICORE_EGG_STAGES, getEggStage, EYE_ROW, generateDragon, regenDragonLines, buildDragonAnimSeq, generateGreatBeast, regenGreatBeastLines, generateKraken, regenKrakenLines, buildKrakenAnimSeq, generateGriffon, regenGriffonLines, buildGriffonAnimSeq, generateManticore, regenManticoreLines, buildManticoreAnimSeq, buildGreatBeastAnimSeq } from '../modules/creature.js';
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

function makeKrakenEgg(overrides = {}) {
  return {
    foodSequence: Array(10).fill('fish'),
    rarityRoll: 0,
    sacrificedCreatures: [
      { id: 'aaa111', name: 'First',  rarity: { name: 'Common'   } },
      { id: 'bbb222', name: 'Second', rarity: { name: 'Uncommon' } },
    ],
    beastType: 'kraken',
    ...overrides,
  };
}

describe('KRAKEN_EGG_STAGES', () => {
  it('has the same number of stages as EGG_STAGES', () => {
    assert.equal(KRAKEN_EGG_STAGES.length, EGG_STAGES.length);
  });

  it('each stage has art and color', () => {
    for (const stage of KRAKEN_EGG_STAGES) {
      assert.ok(Array.isArray(stage.art) && stage.art.length > 0);
      assert.ok(typeof stage.color === 'string');
    }
  });
});

describe('generateKraken', () => {
  it('returns all required fields', () => {
    const k = generateKraken(makeKrakenEgg());
    assert.ok(k.id, 'missing id');
    assert.ok(k.name, 'missing name');
    assert.ok(k.lines, 'missing lines');
    assert.ok(k.color, 'missing color');
    assert.ok(k.rarity, 'missing rarity');
    assert.ok(k.traits, 'missing traits');
    assert.ok(typeof k.hashVal === 'number', 'missing hashVal');
    assert.equal(k.isGreatBeast, true);
    assert.equal(k.beastType, 'kraken');
    assert.equal(k.dom, null);
    assert.equal(k.eyeRow, 5);
  });

  it('lines is a non-empty array of strings', () => {
    const k = generateKraken(makeKrakenEgg());
    assert.ok(Array.isArray(k.lines) && k.lines.length > 0);
    assert.ok(k.lines.every(l => typeof l === 'string'));
  });

  it('traits includes Great Beast', () => {
    const k = generateKraken(makeKrakenEgg());
    assert.ok(k.traits.includes('Great Beast'));
  });

  it('is deterministic for same egg', () => {
    const egg = makeKrakenEgg();
    const a = generateKraken(egg);
    const b = generateKraken(egg);
    assert.equal(a.name, b.name);
    assert.deepEqual(a.lines, b.lines);
    assert.equal(a.hashVal, b.hashVal);
  });

  it('different sacrificed creatures produce different krakens', () => {
    const a = generateKraken(makeKrakenEgg({ sacrificedCreatures: [{ id: 'x1' }, { id: 'x2' }] }));
    const b = generateKraken(makeKrakenEgg({ sacrificedCreatures: [{ id: 'y3' }, { id: 'y4' }] }));
    assert.notEqual(a.hashVal, b.hashVal);
  });

  it('Legendary rarity gets color shifted toward cyan', () => {
    const k = generateKraken(makeKrakenEgg({ rarityRoll: 9800 }));
    const common = generateKraken(makeKrakenEgg({ rarityRoll: 0 }));
    assert.equal(k.rarity.name, 'Legendary');
    assert.notEqual(k.color, common.color);
  });
});

describe('regenKrakenLines', () => {
  it('restores lines from hashVal', () => {
    const k = generateKraken(makeKrakenEgg());
    const originalLines = [...k.lines];
    k.lines = null;
    regenKrakenLines(k);
    assert.deepEqual(k.lines, originalLines);
  });
});

describe('buildKrakenAnimSeq', () => {
  it('returns a non-empty array', () => {
    const k = generateKraken(makeKrakenEgg());
    const seq = buildKrakenAnimSeq(k);
    assert.ok(Array.isArray(seq) && seq.length > 0);
  });

  it('last frame has delay 0 (stop signal)', () => {
    const k = generateKraken(makeKrakenEgg());
    const seq = buildKrakenAnimSeq(k);
    assert.equal(seq.at(-1).delay, 0);
  });

  it('every frame has lines array and string color', () => {
    const k = generateKraken(makeKrakenEgg());
    for (const frame of buildKrakenAnimSeq(k)) {
      assert.ok(Array.isArray(frame.lines));
      assert.ok(typeof frame.color === 'string');
    }
  });
});

describe('GRIFFON_EGG_STAGES', () => {
  it('has the same number of stages as EGG_STAGES', () => {
    assert.equal(GRIFFON_EGG_STAGES.length, EGG_STAGES.length);
  });
  it('each stage has art and color', () => {
    for (const stage of GRIFFON_EGG_STAGES) {
      assert.ok(stage.color, 'missing color');
      assert.ok(Array.isArray(stage.art) && stage.art.length > 0, 'missing art');
    }
  });
});

function makeGriffonEgg(overrides = {}) {
  return {
    foodSequence: ['berries', 'berries', 'berries', 'berries', 'berries'],
    rarityRoll: 0,
    sacrificedCreatures: [],
    beastType: 'griffon',
    isDragonEgg: true,
    noGems: true,
    biome: 'forest',
    ...overrides,
  };
}

describe('generateGriffon', () => {
  it('returns all required fields', () => {
    const g = generateGriffon(makeGriffonEgg());
    assert.ok(g.id, 'missing id');
    assert.ok(g.name, 'missing name');
    assert.ok(g.lines, 'missing lines');
    assert.ok(g.color, 'missing color');
    assert.ok(g.rarity, 'missing rarity');
    assert.ok(g.traits, 'missing traits');
    assert.ok(typeof g.hashVal === 'number', 'missing hashVal');
    assert.equal(g.isGreatBeast, true);
    assert.equal(g.beastType, 'griffon');
    assert.equal(g.dom, null);
  });

  it('lines is a non-empty array of strings', () => {
    const g = generateGriffon(makeGriffonEgg());
    assert.ok(Array.isArray(g.lines) && g.lines.length > 0);
    assert.ok(g.lines.every(l => typeof l === 'string'));
  });

  it('traits includes Great Beast', () => {
    const g = generateGriffon(makeGriffonEgg());
    assert.ok(g.traits.includes('Great Beast'));
  });

  it('is deterministic for same egg', () => {
    const egg = makeGriffonEgg();
    const a = generateGriffon(egg);
    const b = generateGriffon(egg);
    assert.deepEqual(a.lines, b.lines);
    assert.equal(a.name, b.name);
    assert.equal(a.color, b.color);
  });

  it('different sacrificed creatures produce different griffons', () => {
    const a = generateGriffon(makeGriffonEgg({ sacrificedCreatures: [{ id: 'x1' }, { id: 'x2' }] }));
    const b = generateGriffon(makeGriffonEgg({ sacrificedCreatures: [{ id: 'y3' }, { id: 'y4' }] }));
    assert.notEqual(a.hashVal, b.hashVal);
  });

  it('Legendary rarity gets color shifted toward yellow', () => {
    const g = generateGriffon(makeGriffonEgg({ rarityRoll: 9800 }));
    const common = generateGriffon(makeGriffonEgg({ rarityRoll: 0 }));
    assert.notEqual(g.color, common.color);
  });
});

describe('regenGriffonLines', () => {
  it('restores lines from hashVal', () => {
    const g = generateGriffon(makeGriffonEgg());
    const originalLines = [...g.lines];
    g.lines = null;
    regenGriffonLines(g);
    assert.deepEqual(g.lines, originalLines);
  });
});

describe('buildGriffonAnimSeq', () => {
  it('returns a non-empty array', () => {
    const g = generateGriffon(makeGriffonEgg());
    assert.ok(Array.isArray(buildGriffonAnimSeq(g)) && buildGriffonAnimSeq(g).length > 0);
  });
  it('last frame has delay 0', () => {
    const g = generateGriffon(makeGriffonEgg());
    const seq = buildGriffonAnimSeq(g);
    assert.equal(seq.at(-1).delay, 0);
  });
  it('every frame has lines array and string color', () => {
    const g = generateGriffon(makeGriffonEgg());
    for (const frame of buildGriffonAnimSeq(g)) {
      assert.ok(Array.isArray(frame.lines));
      assert.ok(typeof frame.color === 'string');
    }
  });
});

describe('MANTICORE_EGG_STAGES', () => {
  it('has the same number of stages as EGG_STAGES', () => {
    assert.equal(MANTICORE_EGG_STAGES.length, EGG_STAGES.length);
  });
  it('each stage has art and color', () => {
    for (const stage of MANTICORE_EGG_STAGES) {
      assert.ok(stage.color, 'missing color');
      assert.ok(Array.isArray(stage.art) && stage.art.length > 0, 'missing art');
    }
  });
});

function makeManticoreEgg(overrides = {}) {
  return {
    foodSequence: ['grain', 'grain', 'grain', 'grain', 'grain'],
    rarityRoll: 0,
    sacrificedCreatures: [],
    beastType: 'manticore',
    isDragonEgg: true,
    noGems: true,
    biome: 'plains',
    ...overrides,
  };
}

describe('generateManticore', () => {
  it('returns all required fields', () => {
    const m = generateManticore(makeManticoreEgg());
    assert.ok(m.id, 'missing id');
    assert.ok(m.name, 'missing name');
    assert.ok(m.lines, 'missing lines');
    assert.ok(m.color, 'missing color');
    assert.ok(m.rarity, 'missing rarity');
    assert.ok(m.traits, 'missing traits');
    assert.ok(typeof m.hashVal === 'number', 'missing hashVal');
    assert.equal(m.isGreatBeast, true);
    assert.equal(m.beastType, 'manticore');
    assert.equal(m.dom, null);
    assert.equal(m.eyeRow, 4);
  });

  it('lines is a non-empty array of strings', () => {
    const m = generateManticore(makeManticoreEgg());
    assert.ok(Array.isArray(m.lines) && m.lines.length > 0);
    assert.ok(m.lines.every(l => typeof l === 'string'));
  });

  it('traits includes Great Beast', () => {
    const m = generateManticore(makeManticoreEgg());
    assert.ok(m.traits.includes('Great Beast'));
  });

  it('is deterministic for same egg', () => {
    const egg = makeManticoreEgg();
    const a = generateManticore(egg);
    const b = generateManticore(egg);
    assert.deepEqual(a.lines, b.lines);
    assert.equal(a.name, b.name);
    assert.equal(a.color, b.color);
  });

  it('different sacrificed creatures produce different manticores', () => {
    const a = generateManticore(makeManticoreEgg({ sacrificedCreatures: [{ id: 'x1' }, { id: 'x2' }] }));
    const b = generateManticore(makeManticoreEgg({ sacrificedCreatures: [{ id: 'y3' }, { id: 'y4' }] }));
    assert.notEqual(a.hashVal, b.hashVal);
  });

  it('Legendary rarity gets color shifted toward yellow-gold', () => {
    const m = generateManticore(makeManticoreEgg({ rarityRoll: 9800 }));
    const common = generateManticore(makeManticoreEgg({ rarityRoll: 0 }));
    assert.equal(m.rarity.name, 'Legendary');
    assert.notEqual(m.color, common.color);
  });
});

describe('regenManticoreLines', () => {
  it('restores lines from hashVal', () => {
    const m = generateManticore(makeManticoreEgg());
    const originalLines = [...m.lines];
    m.lines = null;
    regenManticoreLines(m);
    assert.deepEqual(m.lines, originalLines);
  });

  it('restores eyeRow on regen', () => {
    const m = generateManticore(makeManticoreEgg());
    m.eyeRow = undefined;
    regenManticoreLines(m);
    assert.equal(m.eyeRow, 4);
  });
});

describe('buildManticoreAnimSeq', () => {
  it('returns a non-empty array', () => {
    const m = generateManticore(makeManticoreEgg());
    assert.ok(Array.isArray(buildManticoreAnimSeq(m)) && buildManticoreAnimSeq(m).length > 0);
  });
  it('last frame has delay 0', () => {
    const m = generateManticore(makeManticoreEgg());
    assert.equal(buildManticoreAnimSeq(m).at(-1).delay, 0);
  });
  it('every frame has lines array and string color', () => {
    const m = generateManticore(makeManticoreEgg());
    for (const frame of buildManticoreAnimSeq(m)) {
      assert.ok(Array.isArray(frame.lines));
      assert.ok(typeof frame.color === 'string');
    }
  });
});

describe('buildGreatBeastAnimSeq', () => {
  it('returns dragon anim for dragon', () => {
    const d = generateDragon(makeDragonEgg());
    const seq = buildGreatBeastAnimSeq(d);
    assert.ok(Array.isArray(seq) && seq.length > 0);
  });

  it('returns kraken anim for kraken', () => {
    const k = generateKraken(makeKrakenEgg());
    const seq = buildGreatBeastAnimSeq(k);
    assert.ok(Array.isArray(seq) && seq.length > 0);
    assert.notDeepEqual(seq, buildDragonAnimSeq(generateDragon(makeDragonEgg())));
  });

  it('returns griffon anim for griffon', () => {
    const g = generateGriffon(makeGriffonEgg());
    const seq = buildGreatBeastAnimSeq(g);
    assert.ok(Array.isArray(seq) && seq.length > 0);
    assert.notDeepEqual(seq, buildDragonAnimSeq(generateDragon(makeDragonEgg())));
  });

  it('returns manticore anim for manticore', () => {
    const m = generateManticore(makeManticoreEgg());
    const seq = buildGreatBeastAnimSeq(m);
    assert.ok(Array.isArray(seq) && seq.length > 0);
    assert.notDeepEqual(seq, buildDragonAnimSeq(generateDragon(makeDragonEgg())));
  });

  it('generateGreatBeast returns kraken for beastType kraken', () => {
    const k = generateGreatBeast(makeKrakenEgg());
    assert.equal(k.beastType, 'kraken');
    assert.equal(k.isGreatBeast, true);
  });

  it('generateGreatBeast returns griffon for beastType griffon', () => {
    const g = generateGreatBeast(makeGriffonEgg());
    assert.equal(g.beastType, 'griffon');
    assert.equal(g.isGreatBeast, true);
  });

  it('generateGreatBeast returns manticore for beastType manticore', () => {
    const m = generateGreatBeast(makeManticoreEgg());
    assert.equal(m.beastType, 'manticore');
    assert.equal(m.isGreatBeast, true);
  });

  it('regenGreatBeastLines works for kraken', () => {
    const k = generateKraken(makeKrakenEgg());
    const originalLines = [...k.lines];
    k.lines = null;
    regenGreatBeastLines(k);
    assert.deepEqual(k.lines, originalLines);
  });

  it('regenGreatBeastLines works for griffon', () => {
    const g = generateGriffon(makeGriffonEgg());
    const originalLines = [...g.lines];
    g.lines = null;
    regenGreatBeastLines(g);
    assert.deepEqual(g.lines, originalLines);
  });

  it('regenGreatBeastLines works for manticore', () => {
    const m = generateManticore(makeManticoreEgg());
    const originalLines = [...m.lines];
    m.lines = null;
    regenGreatBeastLines(m);
    assert.deepEqual(m.lines, originalLines);
  });
});
