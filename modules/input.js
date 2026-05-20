// Keyboard and click input. Call init(handlers) once on startup.
// Uses callback injection to avoid circular deps with game.js.

import { FOOD_KEY_MAP } from './utils.js';
import { getWorldCoordsFromViewportClick } from './render.js';

const MOVE_KEYS = {
  ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0],
  w: [0,-1], s: [0,1], a: [-1,0], d: [1,0],
  W: [0,-1], S: [0,1], A: [-1,0], D: [1,0],
};

export function init({
  saveGame, loadGame, toggleMute, openFeedback, getG, setSelectedFood,
  tryMove, tryFeed, tryE,
  lockpick, closeChest, isChestActive,
  isBeastOverlayActive, isBeastSacrificeMode,
  enterSacrificeMode, exitSacrificeMode, sacrificeCreature, closeBeastOverlay,
  isAngelOverlayActive, closeAngelOverlay, offerToAngel,
  render, stopColAnims,
  onViewportClick,
}) {
  document.addEventListener('keydown', e => {
    if (!document.getElementById('feedback-overlay').hidden) return;
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveGame(); return; }
    if (e.ctrlKey && e.key === 'o') { e.preventDefault(); loadGame(); return; }
    if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
    if (e.key === '?') { openFeedback(); return; }

    if (isChestActive()) {
      if (e.key === ' ' || e.key === 'e' || e.key === 'E') { e.preventDefault(); lockpick(); }
      else if (e.key === 'Escape') closeChest();
      return;
    }

    const G = getG();
    if (!G) return;

    // Angel overlay open
    if (isAngelOverlayActive()) {
      if (e.key === 'f' || e.key === 'F') { offerToAngel(); return; }
      if (e.key === 'Escape') { closeAngelOverlay(); return; }
      return;
    }

    // Beast overlay open (not in sacrifice mode)
    if (isBeastOverlayActive()) {
      if (FOOD_KEY_MAP[e.key]) { setSelectedFood(FOOD_KEY_MAP[e.key]); render(); return; }
      if (e.key === 'f' || e.key === 'F') { tryFeed(); return; }
      if (e.key === 'c' || e.key === 'C') { enterSacrificeMode(); return; }
      if (e.key === 'Escape') { closeBeastOverlay(); return; }
      return;
    }

    // Sacrifice mode: browsing collection to pick a creature to offer
    if (isBeastSacrificeMode()) {
      const n = G.collection.length;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); if (n > 0) { G.colSelectedIdx = Math.max(0, G.colSelectedIdx - 1); render(); } return;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault(); if (n > 0) { G.colSelectedIdx = Math.min(n - 1, G.colSelectedIdx + 1); render(); } return;
      }
      if (e.key === ' ' || e.key === 'e' || e.key === 'E') { e.preventDefault(); sacrificeCreature(); return; }
      if (e.key === 'Escape') { exitSacrificeMode(); return; }
      return;
    }

    if (e.key === 'e' || e.key === 'E' || e.key === ' ') { e.preventDefault(); tryE(); return; }
    if (e.key === 'c' || e.key === 'C') {
      G.showCollection = !G.showCollection;
      if (!G.showCollection) stopColAnims();
      render(); return;
    }
    if (G.showCollection) {
      const tab    = G.collectionTab ?? 'creatures';
      const arr    = tab === 'divine' ? [] : tab === 'creatures' ? G.collection : (G.greatBeasts ?? []);
      const n      = arr.length;
      const idxKey = tab === 'creatures' ? 'colSelectedIdx' : 'gbSelectedIdx';
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); if (n > 0) { G[idxKey] = Math.max(0, G[idxKey] - 1); render(); } return;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault(); if (n > 0) { G[idxKey] = Math.min(n - 1, G[idxKey] + 1); render(); } return;
      }
      const tabs = ['creatures', 'greatBeasts', ...(G.angel ? ['divine'] : [])];
      const curIdx = tabs.indexOf(tab);
      if (e.key === 'ArrowLeft' || e.key === '[' || e.key === 'a' || e.key === 'A') {
        e.preventDefault(); G.collectionTab = tabs[Math.max(0, curIdx - 1)]; stopColAnims(); render(); return;
      }
      if (e.key === 'ArrowRight' || e.key === ']' || e.key === 'd' || e.key === 'D') {
        e.preventDefault(); G.collectionTab = tabs[Math.min(tabs.length - 1, curIdx + 1)]; stopColAnims(); render(); return;
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

  document.getElementById('inv-list').addEventListener('click', e => {
    const item = e.target.closest('[data-food]');
    if (!item) return;
    setSelectedFood(item.dataset.food);
    render();
  });

  document.getElementById('bottom-panel').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const G = getG();
    if (!G || G.phase === 'animating') return;
    if (btn.dataset.action === 'feed')     tryFeed();
    else if (btn.dataset.action === 'interact') tryE();
  });

  document.getElementById('beast-overlay').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'gem')            tryFeed();
    else if (btn.dataset.action === 'sacrifice') enterSacrificeMode();
    else if (btn.dataset.action === 'close-overlay') closeBeastOverlay();
  });

  document.getElementById('chest-overlay').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'lockpick')   lockpick();
    else if (btn.dataset.action === 'close-chest') closeChest();
  });

  document.getElementById('collection-overlay').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const G = getG();
    if (!G) return;
    if (btn.dataset.action === 'sacrifice-creature') sacrificeCreature();
    else if (btn.dataset.action === 'exit-sacrifice') exitSacrificeMode();
    else if (btn.dataset.action === 'close-collection') { G.showCollection = false; stopColAnims(); render(); }
  });

  document.getElementById('col-tab-creatures').addEventListener('click', () => {
    const G = getG();
    if (!G || G.sacrificeMode) return;
    G.collectionTab = 'creatures'; stopColAnims(); render();
  });

  document.getElementById('col-tab-beasts').addEventListener('click', () => {
    const G = getG();
    if (!G || G.sacrificeMode) return;
    G.collectionTab = 'greatBeasts'; stopColAnims(); render();
  });

  document.getElementById('col-tab-divine').addEventListener('click', () => {
    const G = getG();
    if (!G || G.sacrificeMode || !G.angel) return;
    G.collectionTab = 'divine'; stopColAnims(); render();
  });

  const angelEl = document.getElementById('angel-overlay');
  if (angelEl) {
    angelEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'offer-angel') offerToAngel();
      else if (btn.dataset.action === 'close-angel') closeAngelOverlay();
    });
  }

  document.getElementById('compass').addEventListener('click', e => {
    const btn = e.target.closest('[data-dir]');
    if (!btn) return;
    const G = getG();
    if (!G || G.phase === 'animating' || G.showCollection || G.dragonInteract) return;
    const dirs = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
    const mv = dirs[btn.dataset.dir];
    if (mv) tryMove(mv[0], mv[1]);
  });

  document.getElementById('toolbar').addEventListener('click', e => {
    const btn = e.target.closest('[data-toolbar]');
    if (!btn) return;
    const action = btn.dataset.toolbar;
    if (action === 'mute')         toggleMute();
    else if (action === 'save')    saveGame();
    else if (action === 'load')    loadGame();
    else if (action === 'feedback') openFeedback();
    else if (action === 'collection') {
      const G = getG();
      if (!G) return;
      G.showCollection = !G.showCollection;
      if (!G.showCollection) stopColAnims();
      render();
    }
  });

  if (onViewportClick) {
    const vp = document.getElementById('viewport');
    vp.addEventListener('mousedown', e => e.preventDefault());
    vp.addEventListener('click', e => {
      const G = getG();
      if (!G || G.phase === 'animating') return;
      const coords = getWorldCoordsFromViewportClick(e.clientX, e.clientY);
      if (coords) onViewportClick(coords.wx, coords.wy, e.button);
    });
  }

  // Touch: swipe to step; swipe-and-hold for continuous movement.
  // Swipe a different direction mid-gesture to change direction immediately.
  // touchActive prevents phantom touchmove events that fire after touchend
  // from restarting movement on their own.
  {
    const vp = document.getElementById('viewport');
    let tx = 0, ty = 0;
    let holdTimer   = null; // setTimeout before repeat begins
    let repeatTimer = null; // setInterval for repeat moves
    let touchActive = false;
    let curDir      = null; // [mdx, mdy] while moving, null when stopped
    const SWIPE_MIN   = 20;
    const HOLD_DELAY  = 500;
    const MOVE_REPEAT = 150;

    const stopMove = () => {
      clearTimeout(holdTimer);    holdTimer   = null;
      clearInterval(repeatTimer); repeatTimer = null;
      curDir = null;
    };

    const canMove = () => {
      const G = getG();
      return G && G.phase !== 'animating' && !G.showCollection &&
             !isChestActive() && !isBeastOverlayActive() && !isAngelOverlayActive();
    };

    vp.addEventListener('touchstart', e => {
      touchActive = true;
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
      stopMove();
      e.preventDefault();
    }, { passive: false });

    vp.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!touchActive) return;
      const dx = e.touches[0].clientX - tx;
      const dy = e.touches[0].clientY - ty;
      if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
      if (!canMove()) return;
      const mdx = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : 0;
      const mdy = Math.abs(dx) > Math.abs(dy) ? 0 : (dy > 0 ? 1 : -1);
      if (curDir && curDir[0] === mdx && curDir[1] === mdy) return;
      const wasMoving = curDir !== null;
      stopMove();
      curDir = [mdx, mdy];
      tryMove(mdx, mdy);
      // Reset reference so next direction change needs a fresh 20px swipe.
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
      if (wasMoving) {
        // Direction change while already moving — skip hold delay.
        repeatTimer = setInterval(() => {
          if (!canMove()) { stopMove(); return; }
          tryMove(mdx, mdy);
        }, MOVE_REPEAT);
      } else {
        holdTimer = setTimeout(() => {
          holdTimer = null;
          repeatTimer = setInterval(() => {
            if (!canMove()) { stopMove(); return; }
            tryMove(mdx, mdy);
          }, MOVE_REPEAT);
        }, HOLD_DELAY);
      }
    }, { passive: false });

    vp.addEventListener('touchend', e => {
      touchActive = false;
      const wasDragging = curDir !== null;
      stopMove();
      if (!wasDragging && onViewportClick) {
        const G = getG();
        if (G && G.phase !== 'animating') {
          const coords = getWorldCoordsFromViewportClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
          if (coords) onViewportClick(coords.wx, coords.wy, 0);
        }
      }
    }, { passive: false });

    vp.addEventListener('touchcancel', () => { touchActive = false; stopMove(); });
  }
}
