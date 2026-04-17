import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { djb2, mulberry32, lerpColor, hexDim, getRarity, emptyInv, toID, escHtml, cap, rand } from '../modules/utils.js';

describe('djb2', () => {
  it('is deterministic', () => {
    assert.equal(djb2('hello'), djb2('hello'));
  });
  it('returns unsigned 32-bit integer', () => {
    const h = djb2('test');
    assert.ok(h >= 0 && h <= 0xFFFFFFFF);
  });
  it('different strings produce different hashes', () => {
    assert.notEqual(djb2('foo'), djb2('bar'));
  });
});

describe('mulberry32', () => {
  it('produces values in [0, 1)', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
    }
  });
  it('int(a, b) returns integer in [a, b)', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 50; i++) {
      const v = rng.int(3, 8);
      assert.ok(Number.isInteger(v) && v >= 3 && v < 8);
    }
  });
  it('is seeded deterministically', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 10; i++) assert.equal(a.next(), b.next());
  });
  it('different seeds produce different sequences', () => {
    const a = mulberry32(1).next();
    const b = mulberry32(2).next();
    assert.notEqual(a, b);
  });
});

describe('lerpColor', () => {
  it('returns first color at t=0', () => {
    assert.equal(lerpColor('#ff0000', '#0000ff', 0), '#ff0000');
  });
  it('returns second color at t=1', () => {
    assert.equal(lerpColor('#ff0000', '#0000ff', 1), '#0000ff');
  });
  it('returns midpoint at t=0.5', () => {
    assert.equal(lerpColor('#000000', '#ffffff', 0.5), '#808080');
  });
});

describe('hexDim', () => {
  it('dims a color by factor 0 to black', () => {
    assert.equal(hexDim('#ffffff', 0), '#000000');
  });
  it('keeps color unchanged at factor 1', () => {
    assert.equal(hexDim('#aabbcc', 1), '#aabbcc');
  });
});

describe('getRarity', () => {
  it('returns Common for low rolls', () => {
    assert.equal(getRarity(0).name, 'Common');
    assert.equal(getRarity(5999).name, 'Common');
  });
  it('returns Legendary for near-max rolls', () => {
    assert.equal(getRarity(9999).name, 'Legendary');
  });
});

describe('emptyInv', () => {
  it('returns all zeros', () => {
    const inv = emptyInv();
    assert.deepEqual(inv, { meat: 0, fish: 0, berries: 0, mushroom: 0, grain: 0, gem: 0 });
  });
  it('returns a new object each time', () => {
    const a = emptyInv(), b = emptyInv();
    a.meat = 5;
    assert.equal(b.meat, 0);
  });
});

describe('toID', () => {
  it('pads to 7 chars', () => {
    assert.equal(toID(0).length, 7);
    assert.equal(toID(1).length, 7);
  });
  it('is deterministic', () => {
    assert.equal(toID(12345), toID(12345));
  });
});

describe('escHtml', () => {
  it('escapes &, <, >', () => {
    assert.equal(escHtml('<b>a&b</b>'), '&lt;b&gt;a&amp;b&lt;/b&gt;');
  });
  it('returns plain strings unchanged', () => {
    assert.equal(escHtml('hello world'), 'hello world');
  });
});

describe('cap', () => {
  it('capitalises first letter', () => {
    assert.equal(cap('hello'), 'Hello');
  });
  it('leaves already-capitalised strings unchanged', () => {
    assert.equal(cap('World'), 'World');
  });
});

describe('rand', () => {
  it('returns integer in [a, b)', () => {
    for (let i = 0; i < 200; i++) {
      const v = rand(2, 7);
      assert.ok(Number.isInteger(v) && v >= 2 && v < 7);
    }
  });
});
