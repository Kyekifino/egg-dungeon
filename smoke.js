#!/usr/bin/env node
// smoke.js — runs game.js under Node with minimal DOM stubs.
// Catches initialisation-order errors (TDZ, undefined references) and
// any exception thrown during module-level execution or newGame().
// Run manually: node smoke.js
// Run automatically: wired into .githooks/pre-commit

'use strict';

// ── Minimal DOM stub ─────────────────────────────────────────────
// A recursive no-op proxy: any property access or call returns itself.
const noop = new Proxy(function(){}, {
  get(t, k) {
    if (k === Symbol.toPrimitive || k === 'valueOf') return () => 0;
    if (k === 'then') return undefined; // not a Promise
    return noop;
  },
  apply() { return noop; },
  set() { return true; },
});

const el = () => new Proxy({ style:{}, classList:{ add:()=>{}, remove:()=>{} }, dataset:{} }, {
  get(t, k) {
    if (k in t) return t[k];
    if (typeof k === 'symbol') return undefined;
    return noop;
  },
  set(t, k, v) { t[k] = v; return true; },
});

global.document = {
  getElementById : () => el(),
  querySelector  : () => null,
  addEventListener: () => {},
};
global.window = {};   // no AudioContext — audio code self-disables via ensureAudio() null check
global.localStorage = { getItem: () => null, setItem: () => {} };

// ── Load ─────────────────────────────────────────────────────────
try {
  require('./game.js');
} catch (e) {
  console.error('SMOKE TEST FAILED:', e.message);
  process.exit(1);
}

console.log('smoke test passed');
