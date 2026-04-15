#!/usr/bin/env node
// smoke.js — runs game.js under Node with minimal DOM stubs.
// Catches initialisation-order errors (TDZ, undefined references) and
// any exception thrown during module-level execution or newGame().
// Run manually: node smoke.js
// Run automatically: wired into .githooks/pre-commit

'use strict';

// ── Minimal DOM stub ─────────────────────────────────────────────
const el = () => new Proxy({ style:{}, classList:{ add:()=>{}, remove:()=>{} } }, {
  get(t, k) {
    if (k in t) return t[k];
    if (typeof k === 'symbol') return undefined;
    // Any property read returns a no-op function or empty string
    return typeof t[k] !== 'undefined' ? t[k] : () => el();
  },
  set(t, k, v) { t[k] = v; return true; },
});

global.document = {
  getElementById : () => el(),
  querySelector  : () => null,
  addEventListener: () => {},
};
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };

// ── Load ─────────────────────────────────────────────────────────
try {
  require('./game.js');
} catch (e) {
  console.error('SMOKE TEST FAILED:', e.message);
  process.exit(1);
}

console.log('smoke test passed');
