'use strict';

// ================================================================
//  EGG DUNGEON
// ================================================================

// ── Config ───────────────────────────────────────────────────────
const DW = 72, DH = 36;          // dungeon dimensions (cols, rows)
const VW = 50, VH = 22;          // viewport size
const LIGHT_R = 6;                // sight radius
const FOOD_NEEDED = 10;           // items needed to hatch
const MAX_LOG = 7;

// ── Food definitions ──────────────────────────────────────────────
const FOOD_INFO = {
  '%': { name: 'Meat',     key: 'meat',     color: '#e05050' },
  '~': { name: 'Fish',     key: 'fish',     color: '#5090e0' },
  '*': { name: 'Berries',  key: 'berries',  color: '#d060d0' },
  '^': { name: 'Mushroom', key: 'mushroom', color: '#50c080' },
  ',': { name: 'Grain',    key: 'grain',    color: '#d0a040' },
};
const FOOD_CHARS = Object.keys(FOOD_INFO);

// ── Cell colours (in-light / revealed-but-dim) ────────────────────
const CLR = {
  bright: {
    '#': '#777', '.': '#2e2e2e', 'Θ': '#fff080', '@': '#ffffff',
    '%': '#e05050', '~': '#5090e0', '*': '#d060d0', '^': '#50c080', ',': '#d0a040',
  },
  dim: {
    '#': '#2e2e2e', '.': '#151515', 'Θ': '#706020', '@': '#ffffff',
    '%': '#601818', '~': '#183060', '*': '#501850', '^': '#185030', ',': '#503010',
  },
};

// ── Utilities ─────────────────────────────────────────────────────
const rand   = (a, b) => Math.floor(Math.random() * (b - a)) + a;
const pick   = arr => arr[rand(0, arr.length)];
const cap    = s => s.charAt(0).toUpperCase() + s.slice(1);
const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ================================================================
//  DUNGEON GENERATION
// ================================================================

function makeGrid(w, h, fill = '#') {
  return Array.from({ length: h }, () => Array(w).fill(fill));
}

function carveRect(grid, x, y, w, h) {
  for (let gy = y; gy < y + h; gy++)
    for (let gx = x; gx < x + w; gx++)
      grid[gy][gx] = '.';
}

function carveTunnel(grid, ax, ay, bx, by) {
  let x = ax, y = ay;
  while (x !== bx) { grid[y][x] = '.'; x += bx > x ? 1 : -1; }
  while (y !== by) { grid[y][x] = '.'; y += by > y ? 1 : -1; }
  grid[y][x] = '.';
}

function roomCenter(r) {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

function roomsOverlap(a, b, pad = 2) {
  return a.x - pad < b.x + b.w && b.x - pad < a.x + a.w &&
         a.y - pad < b.y + b.h && b.y - pad < a.y + a.h;
}

function generateDungeon() {
  const grid = makeGrid(DW, DH);
  const rooms = [];

  for (let tries = 0; tries < 400 && rooms.length < 12; tries++) {
    const w = rand(5, 13), h = rand(4, 8);
    const x = rand(1, DW - w - 1), y = rand(1, DH - h - 1);
    const r = { x, y, w, h };
    if (!rooms.some(o => roomsOverlap(r, o))) {
      rooms.push(r);
      carveRect(grid, x, y, w, h);
    }
  }

  if (rooms.length < 2) return generateDungeon(); // retry if too few rooms

  // Sort left-to-right, then connect sequentially
  rooms.sort((a, b) => roomCenter(a).x - roomCenter(b).x);
  for (let i = 1; i < rooms.length; i++) {
    const a = roomCenter(rooms[i - 1]);
    const b = roomCenter(rooms[i]);
    if (Math.random() < 0.5) {
      carveTunnel(grid, a.x, a.y, b.x, a.y);
      carveTunnel(grid, b.x, a.y, b.x, b.y);
    } else {
      carveTunnel(grid, a.x, a.y, a.x, b.y);
      carveTunnel(grid, a.x, b.y, b.x, b.y);
    }
  }

  // Extra loops for navigability
  for (let i = 0; i < 2; i++) {
    const ai = rand(0, rooms.length);
    let bi = rand(0, rooms.length - 1);
    if (bi >= ai) bi++;
    const a = roomCenter(rooms[ai]), b = roomCenter(rooms[bi]);
    carveTunnel(grid, a.x, a.y, b.x, a.y);
    carveTunnel(grid, b.x, a.y, b.x, b.y);
  }

  // Egg room: most central
  const midX = DW / 2, midY = DH / 2;
  let eggIdx = 0, eggDist = Infinity;
  rooms.forEach((r, i) => {
    const c = roomCenter(r);
    const d = Math.hypot(c.x - midX, c.y - midY);
    if (d < eggDist) { eggIdx = i; eggDist = d; }
  });

  const eggPos = roomCenter(rooms[eggIdx]);
  grid[eggPos.y][eggPos.x] = 'Θ';

  // Scatter food in non-egg rooms
  rooms.forEach((r, i) => {
    if (i === eggIdx) return;
    const n = rand(2, 5);
    let placed = 0;
    for (let t = 0; t < n * 10 && placed < n; t++) {
      const fx = rand(r.x + 1, r.x + r.w - 1);
      const fy = rand(r.y + 1, r.y + r.h - 1);
      if (grid[fy][fx] === '.') {
        grid[fy][fx] = pick(FOOD_CHARS);
        placed++;
      }
    }
  });

  // Player starts in first non-egg room
  const startIdx = eggIdx === 0 ? 1 : 0;
  const startPos = roomCenter(rooms[startIdx]);

  return { grid, rooms, eggPos, startPos };
}

// ================================================================
//  CREATURE GENERATION
// ================================================================

// Base ASCII art per dominant food (7 lines, ~13 chars each)
const BASES = {
  meat: [
    "    /\\  /\\   ",
    "   ( >':< )  ",
    "   /|    |\\  ",
    "  ( |####| ) ",
    "   \\|    |/  ",
    "    /|  |\\   ",
    "   /_|  |_\\  ",
  ],
  fish: [
    "    ~~~~~    ",
    " ><(  . . )> ",
    "  /~~~~~~~\\  ",
    " ( ~~~~~~~ ) ",
    "  \\~~~~~~/>< ",
    "    ~~~~~    ",
    "             ",
  ],
  berries: [
    "  /\\/\\/\\    ",
    "   (^v^  )   ",
    " ~[       ]~ ",
    " ~[ ===== ]~ ",
    " ~[       ]~ ",
    "   /Y   Y\\   ",
    "  //     \\\\  ",
  ],
  mushroom: [
    "  ..oOOo..   ",
    "  (Oo  oO)   ",
    "   (      )  ",
    "  (oOOOOOo)  ",
    "   (      )  ",
    "    | || |   ",
    "   (_)  (_)  ",
  ],
  grain: [
    " /|      |\\  ",
    "(  \\    /  ) ",
    "  ( uwu  )   ",
    "   { ~~~ }   ",
    "   {     }   ",
    "    |   |    ",
    "   (U) (U)   ",
  ],
};

const CREATURE_COLOR = {
  meat: '#e05050', fish: '#5090e0', berries: '#d060d0',
  mushroom: '#50c080', grain: '#d0a040',
};

const NAME_POOLS = {
  meat:     { pre: ['Fang','Claw','Blood','Iron','Snarl'],   suf: ['claw','fang','jaw','bite','rend']   },
  fish:     { pre: ['Scale','Fin','Wave','Tide','Depth'],     suf: ['fin','scale','gill','drift','slick']},
  berries:  { pre: ['Wing','Sky','Crest','Dawn','Bright'],    suf: ['wing','feather','beak','song','gust']},
  mushroom: { pre: ['Spore','Gloom','Shade','Murk','Glow'],   suf: ['spore','cap','stalk','eye','mold']  },
  grain:    { pre: ['Fluff','Meadow','Downy','Plump','Toft'], suf: ['ear','tuft','seed','puff','hay']    },
};

const TITLE_POOLS = {
  meat:     ['the Fierce', 'the Relentless', 'the Savage', 'the Hungry'],
  fish:     ['the Swift',  'the Deep',       'the Slippery','the Silent'],
  berries:  ['the Radiant','the Free',       'the Wandering','the Bright'],
  mushroom: ['the Eerie',  'the Ancient',    'the Strange', 'the Watchful'],
  grain:    ['the Fluffy', 'the Gentle',     'the Round',   'the Warm'],
};

const TRAIT_NAMES = {
  meat: 'Carnivore', fish: 'Aquatic', berries: 'Aerial',
  mushroom: 'Multi-eyed', grain: 'Fluffy',
};

function rankFoods(inv) {
  return Object.entries(inv)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([k]) => k);
}

function generateCreature(eggInv) {
  const ranked = rankFoods(eggInv);
  const dom = ranked[0] || 'grain';
  const sec = ranked[1] || null;

  // Copy base art
  const lines = BASES[dom].map(l => l);

  // Secondary food modifies one line
  if (sec && sec !== dom) {
    switch (sec) {
      case 'mushroom': // extra eye on head
        lines[1] = lines[1].replace('.', 'O');
        break;
      case 'berries': // wings appear on mid body
        lines[3] = '~' + lines[3].slice(1, -1) + '~';
        break;
      case 'fish': // fin on top
        lines[0] = '     ~~~     ';
        break;
      case 'meat': // claws on feet
        lines[6] = lines[6].replace(/\(([A-Z_|/\\])/g, '<($1');
        break;
      case 'grain': // fluffy belly
        lines[4] = lines[4].replace(/[-|]/g, '~');
        break;
    }
  }

  // Name
  const np = NAME_POOLS[dom];
  const pre = pick(np.pre);
  const suf = sec ? pick(NAME_POOLS[sec].suf) : pick(np.suf);
  const title = pick(TITLE_POOLS[dom]);
  const name = cap(pre + suf) + ' ' + title;

  // Traits
  const traits = ranked.map(k => TRAIT_NAMES[k]);

  // Diet summary
  const diet = Object.entries(eggInv)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v}x ${k}`)
    .join(', ');

  return { lines, name, color: CREATURE_COLOR[dom], traits, diet };
}

// ================================================================
//  GAME STATE
// ================================================================

let G = null;

function emptyInv() {
  return { meat: 0, fish: 0, berries: 0, mushroom: 0, grain: 0 };
}

function newGame() {
  const { grid, rooms, eggPos, startPos } = generateDungeon();
  G = {
    grid,
    revealed: makeGrid(DW, DH, false),
    rooms,
    eggPos,
    px: startPos.x,
    py: startPos.y,
    inventory: emptyInv(),
    eggInv:    emptyInv(),   // cumulative food fed to egg
    eggFed:    0,
    phase:     'playing',    // 'playing' | 'hatched'
    creature:  null,
    log: ['You descend into the dungeon.', 'Collect food and feed the Egg (Θ)!'],
  };
  updateFOV();
  render();
}

function addLog(msg) {
  G.log.push(msg);
  if (G.log.length > MAX_LOG) G.log.shift();
}

// ================================================================
//  FIELD OF VIEW
// ================================================================

function updateFOV() {
  const { revealed, px, py } = G;
  for (let dy = -LIGHT_R - 1; dy <= LIGHT_R + 1; dy++) {
    for (let dx = -LIGHT_R - 1; dx <= LIGHT_R + 1; dx++) {
      const nx = px + dx, ny = py + dy;
      if (nx >= 0 && nx < DW && ny >= 0 && ny < DH) {
        if (Math.hypot(dx, dy) <= LIGHT_R) revealed[ny][nx] = true;
      }
    }
  }
}

// ================================================================
//  GAME LOGIC
// ================================================================

function tryMove(dx, dy) {
  if (G.phase !== 'playing') return;
  const nx = G.px + dx, ny = G.py + dy;
  if (nx < 0 || nx >= DW || ny < 0 || ny >= DH) return;
  const cell = G.grid[ny][nx];
  if (cell === '#') return;

  G.px = nx; G.py = ny;

  // Pick up food
  const info = FOOD_INFO[cell];
  if (info) {
    G.inventory[info.key]++;
    G.grid[ny][nx] = '.';
    addLog(`Picked up ${info.name}!`);
  }

  updateFOV();
  render();
}

function tryFeed() {
  if (G.phase !== 'playing') return;

  const dist = Math.abs(G.px - G.eggPos.x) + Math.abs(G.py - G.eggPos.y);
  if (dist > 1) {
    addLog('Move next to the Egg (Θ) to feed it.');
    render();
    return;
  }

  const total = Object.values(G.inventory).reduce((a, b) => a + b, 0);
  if (total === 0) {
    addLog('You have no food to offer!');
    render();
    return;
  }

  // Transfer inventory to egg
  const parts = [];
  for (const [k, v] of Object.entries(G.inventory)) {
    if (v > 0) {
      G.eggInv[k] += v;
      parts.push(`${v}x ${k}`);
      G.inventory[k] = 0;
    }
  }
  G.eggFed += total;
  addLog(`You feed the egg: ${parts.join(', ')}. (${G.eggFed}/${FOOD_NEEDED})`);

  if (G.eggFed >= FOOD_NEEDED) {
    hatch();
  } else {
    render();
  }
}

function hatch() {
  G.phase = 'hatched';
  G.creature = generateCreature(G.eggInv);
  render();
}

// ================================================================
//  RENDERING
// ================================================================

function span(ch, color) {
  return `<span style="color:${color}">${escHtml(ch)}</span>`;
}

function renderViewport() {
  const { grid, revealed, px, py } = G;
  const camX = Math.max(0, Math.min(DW - VW, px - Math.floor(VW / 2)));
  const camY = Math.max(0, Math.min(DH - VH, py - Math.floor(VH / 2)));

  let html = '';
  for (let vy = 0; vy < VH; vy++) {
    const gy = camY + vy;
    for (let vx = 0; vx < VW; vx++) {
      const gx = camX + vx;
      if (gx >= DW || gy >= DH) { html += span(' ', '#000'); continue; }

      // Player
      if (gx === px && gy === py) { html += span('@', CLR.bright['@']); continue; }

      const inLight = Math.hypot(gx - px, gy - py) <= LIGHT_R;
      const seen    = revealed[gy][gx];

      if (!seen && !inLight) { html += span(' ', '#000'); continue; }

      const ch    = grid[gy][gx];
      const table = inLight ? CLR.bright : CLR.dim;
      const color = table[ch] || (inLight ? '#aaa' : '#333');
      html += span(ch, color);
    }
    if (vy < VH - 1) html += '\n';
  }
  return html;
}

function renderNormal() {
  document.getElementById('game-view').hidden = false;
  document.getElementById('hatch-view').hidden = true;

  // Viewport
  document.getElementById('viewport').innerHTML = renderViewport();

  // Inventory
  let invHtml = '';
  for (const [ch, info] of Object.entries(FOOD_INFO)) {
    const count = G.inventory[info.key];
    const color = count > 0 ? info.color : '#333';
    invHtml += `<div style="color:${color}">${escHtml(ch)} ${info.name.padEnd(8)} x${count}</div>`;
  }
  document.getElementById('inv-list').innerHTML = invHtml;

  // Egg progress bar
  const pct    = Math.min(1, G.eggFed / FOOD_NEEDED);
  const filled = Math.floor(pct * 10);
  const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const barClr = pct >= 1 ? '#f0e060' : (pct > 0 ? '#a09030' : '#333');
  document.getElementById('egg-bar').innerHTML = `<span style="color:${barClr}">${bar}</span>`;
  document.getElementById('egg-fed').textContent = `${G.eggFed} / ${FOOD_NEEDED} fed`;

  // Proximity hint
  const dist = Math.abs(G.px - G.eggPos.x) + Math.abs(G.py - G.eggPos.y);
  const hint = dist <= 1 ? 'Press F to feed!' : '';
  document.getElementById('egg-hint').textContent = hint;

  // Log
  const logEl = document.getElementById('log');
  logEl.innerHTML = G.log.map(m => `<div class="log-line">&gt; ${escHtml(m)}</div>`).join('');
  logEl.scrollTop = logEl.scrollHeight;
}

function renderHatch() {
  document.getElementById('game-view').hidden = true;
  document.getElementById('hatch-view').hidden = false;

  const { creature } = G;
  const artHtml = creature.lines
    .map(l => `<span style="color:${creature.color}">${escHtml(l)}</span>`)
    .join('\n');

  document.getElementById('hatch-content').innerHTML = `
    <div id="hatch-title">✦ &nbsp; THE EGG HATCHES &nbsp; ✦</div>
    <pre id="creature-art">${artHtml}</pre>
    <div id="creature-name" style="color:${creature.color}">&ldquo;${escHtml(creature.name)}&rdquo;</div>
    <div id="creature-traits">Traits: ${creature.traits.join(' &middot; ')}</div>
    <div id="creature-diet">Diet: ${escHtml(creature.diet)}</div>
    <div id="hatch-restart">Press R to hatch another</div>
  `;
}

function render() {
  if (G.phase === 'hatched') renderHatch();
  else renderNormal();
}

// ================================================================
//  INPUT
// ================================================================

const MOVE_KEYS = {
  ArrowUp:    [ 0, -1], ArrowDown:  [ 0,  1],
  ArrowLeft:  [-1,  0], ArrowRight: [ 1,  0],
  w: [0,-1], s: [0,1], a: [-1,0], d: [1,0],
  W: [0,-1], S: [0,1], A: [-1,0], D: [1,0],
};

document.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') { newGame(); return; }
  if (e.key === 'f' || e.key === 'F') { tryFeed(); return; }
  const mv = MOVE_KEYS[e.key];
  if (mv) { e.preventDefault(); tryMove(mv[0], mv[1]); }
});

// ================================================================
//  START
// ================================================================

newGame();
