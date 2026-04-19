#!/usr/bin/env node
/* eslint-env node */
// smoke.js — loads game.js under Node with minimal DOM stubs.
// Catches initialisation-order errors (TDZ, undefined references) and
// any exception thrown during module-level execution or newGame().
// Run manually: node smoke.js
// Run automatically: wired into .githooks/pre-commit

// ── Minimal DOM stub ─────────────────────────────────────────────
const noop = new Proxy(function(){}, {
  get(t, k) {
    if (k === Symbol.toPrimitive || k === 'valueOf') return () => 0;
    if (k === 'then') return undefined;
    return noop;
  },
  apply() { return noop; },
  set()   { return true; },
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
  getElementById:  () => el(),
  querySelector:   () => null,
  addEventListener: () => {},
};
global.window      = { location: { pathname: '' } };
global.localStorage = { getItem: () => null, setItem: () => {} };

// ── Load ─────────────────────────────────────────────────────────
try {
  await import('./game.js');
} catch (e) {
  console.error('SMOKE TEST FAILED:', e.message);
  process.exit(1);
}

console.log('smoke test passed');
process.exit(0);
