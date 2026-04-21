// Keyboard and click input. Call init(handlers) once on startup.
// Uses callback injection to avoid circular deps with game.js.

import { FOOD_KEY_MAP } from './utils.js';

const MOVE_KEYS = {
  ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0],
  w: [0,-1], s: [0,1], a: [-1,0], d: [1,0],
  W: [0,-1], S: [0,1], A: [-1,0], D: [1,0],
};

export function init({
  saveGame, loadGame, toggleMute, openFeedback, getG, setSelectedFood,
  tryMove, tryFeed, tryE,
  lockpick, closeChest, isChestActive,
  isDragonActive, isDragonSacrifice,
  enterSacrificeMode, exitSacrificeMode, sacrificeCreature, closeDragonOverlay,
  render, stopColAnims,
}) {
  document.addEventListener('keydown', e => {
    if (!document.getElementById('feedback-overlay').hidden) return;
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveGame(); return; }
    if (e.ctrlKey && e.key === 'o') { e.preventDefault(); loadGame(); return; }
    if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
    if (e.key === '?') { openFeedback(); return; }

    if (isChestActive()) {
      if (e.key === ' ') { e.preventDefault(); lockpick(); }
      else if (e.key === 'Escape') closeChest();
      return;
    }

    const G = getG();
    if (!G) return;

    // Dragon overlay open (not in sacrifice mode)
    if (isDragonActive()) {
      if (FOOD_KEY_MAP[e.key]) { setSelectedFood(FOOD_KEY_MAP[e.key]); render(); return; }
      if (e.key === 'f' || e.key === 'F') { tryFeed(); return; }
      if (e.key === 'c' || e.key === 'C') { enterSacrificeMode(); return; }
      if (e.key === 'Escape') { closeDragonOverlay(); return; }
      return;
    }

    // Sacrifice mode: browsing collection to pick a creature to offer
    if (isDragonSacrifice()) {
      const n = G.collection.length;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); if (n > 0) { G.colSelectedIdx = Math.max(0, G.colSelectedIdx - 1); render(); } return;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault(); if (n > 0) { G.colSelectedIdx = Math.min(n - 1, G.colSelectedIdx + 1); render(); } return;
      }
      if (e.key === ' ') { e.preventDefault(); sacrificeCreature(); return; }
      if (e.key === 'Escape') { exitSacrificeMode(); return; }
      return;
    }

    if (e.key === 'e' || e.key === 'E') { tryE(); return; }
    if (e.key === 'c' || e.key === 'C') {
      G.showCollection = !G.showCollection;
      if (!G.showCollection) stopColAnims();
      render(); return;
    }
    if (G.showCollection) {
      const tab    = G.collectionTab ?? 'creatures';
      const arr    = tab === 'creatures' ? G.collection : (G.greatBeasts ?? []);
      const n      = arr.length;
      const idxKey = tab === 'creatures' ? 'colSelectedIdx' : 'gbSelectedIdx';
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); if (n > 0) { G[idxKey] = Math.max(0, G[idxKey] - 1); render(); } return;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault(); if (n > 0) { G[idxKey] = Math.min(n - 1, G[idxKey] + 1); render(); } return;
      }
      if (e.key === 'ArrowLeft' || e.key === '[') {
        e.preventDefault(); G.collectionTab = 'creatures'; stopColAnims(); render(); return;
      }
      if (e.key === 'ArrowRight' || e.key === ']') {
        e.preventDefault(); G.collectionTab = 'greatBeasts'; stopColAnims(); render(); return;
      }
      return;
    }
    if (e.key === 'f' || e.key === 'F') { tryFeed(); return; }
    if (FOOD_KEY_MAP[e.key]) { setSelectedFood(FOOD_KEY_MAP[e.key]); if (G.phase !== 'animating') render(); return; }
    const mv = MOVE_KEYS[e.key];
    if (mv) { e.preventDefault(); tryMove(mv[0], mv[1]); }
  });

  document.getElementById('col-list').addEventListener('click', e => {
    const entry = e.target.closest('.col-entry');
    const G = getG();
    if (!entry || !G) return;
    const idx = parseInt(entry.dataset.idx);
    if (G.sacrificeMode) {
      G.colSelectedIdx = idx;
    } else {
      const tab = G.collectionTab ?? 'creatures';
      if (tab === 'creatures') G.colSelectedIdx = idx;
      else G.gbSelectedIdx = idx;
    }
    render();
  });
}
