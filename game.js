'use strict';

// ================================================================
//  EGG DUNGEON
// ================================================================

// ── Config ───────────────────────────────────────────────────────
const DW = 72, DH = 36;
const VW = 50, VH = 22;
const LIGHT_R = 6;
const FOOD_NEEDED = 10;
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
const FOOD_ORDER = ['meat', 'fish', 'berries', 'mushroom', 'grain'];

// ── Cell colours ──────────────────────────────────────────────────
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
const rand    = (a, b) => Math.floor(Math.random() * (b - a)) + a;
const pick    = arr => arr[rand(0, arr.length)];
const cap     = s => s.charAt(0).toUpperCase() + s.slice(1);
const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ================================================================
//  EGG STAGE ART
// ================================================================

const EGG_STAGES = [
  { // 0 fed — pristine
    color: '#c8b840',
    art: [
      "   _____   ",
      "  /     \\  ",
      " |       | ",
      " |       | ",
      "  \\_____/  ",
    ],
  },
  { // 1–3 fed — warm
    color: '#e0c030',
    art: [
      "   _____   ",
      "  / · · \\  ",
      " | · · · | ",
      " |  · ·  | ",
      "  \\_____/  ",
    ],
  },
  { // 4–6 fed — cracking
    color: '#e89020',
    art: [
      "   __v__   ",
      "  /  |  \\  ",
      " | v | v | ",
      " |  \\|/  | ",
      "  \\_____/  ",
    ],
  },
  { // 7–9 fed — shattering
    color: '#e05010',
    art: [
      "  _/\\_/_   ",
      " / \\ v /\\  ",
      "|  /\\/  \\| ",
      "| /  \\/v | ",
      " \\/______/ ",
    ],
  },
  { // 10 fed — glowing
    color: '#ffffff',
    art: [
      "  *_____*  ",
      " */ * * \\* ",
      " |* * * *| ",
      " |* * * *| ",
      "  \\*___*/  ",
    ],
  },
];

function getEggStage(fed) {
  if (fed >= 10) return 4;
  if (fed >= 7)  return 3;
  if (fed >= 4)  return 2;
  if (fed >= 1)  return 1;
  return 0;
}

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

  if (rooms.length < 2) return generateDungeon();

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

  // Extra loops
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

  const eggRoom = rooms[eggIdx];
  const eggPos  = roomCenter(eggRoom);
  grid[eggPos.y][eggPos.x] = 'Θ';

  // Scatter food
  rooms.forEach((r, i) => {
    if (i === eggIdx) return;
    const n = rand(2, 5);
    let placed = 0;
    for (let t = 0; t < n * 10 && placed < n; t++) {
      const fx = rand(r.x + 1, r.x + r.w - 1);
      const fy = rand(r.y + 1, r.y + r.h - 1);
      if (grid[fy][fx] === '.') { grid[fy][fx] = pick(FOOD_CHARS); placed++; }
    }
  });

  // Player starts in the egg room, offset from the egg
  let startPos = null;
  for (let dx = -eggRoom.w; dx <= eggRoom.w && !startPos; dx++) {
    for (let dy = -eggRoom.h; dy <= eggRoom.h && !startPos; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = eggPos.x + dx, ny = eggPos.y + dy;
      if (nx >= eggRoom.x && nx < eggRoom.x + eggRoom.w &&
          ny >= eggRoom.y && ny < eggRoom.y + eggRoom.h &&
          grid[ny][nx] === '.') {
        startPos = { x: nx, y: ny };
      }
    }
  }
  if (!startPos) startPos = { x: eggPos.x + 1, y: eggPos.y };

  return { grid, rooms, eggPos, startPos };
}

// ================================================================
//  CREATURE GENERATION
// ================================================================

const BASES = {
  meat: [
    "      /\\    /\\      ",
    "     (  \\  //  )    ",
    "    ( >=':':=< )    ",
    "    /|   ()   |\\    ",
    "   / |  /##\\  | \\   ",
    "  (  | |####| |  )  ",
    "   \\ |  \\##/  | /   ",
    "    \\|         |/   ",
    "     /|  ||  |\\     ",
    "    /_\\__|  |__/\\   ",
  ],
  fish: [
    "         ~~~        ",
    "   ><(  o . o  )><  ",
    "    /~~~~~~~~~~~\\   ",
    "   | ~~~~~~~~~~~ |  ",
    "  (  ~~~~~~~~~~~  ) ",
    "   | ~~~~~~~~~~~ |  ",
    "    \\~~~~~~~~~~~/   ",
    "     )~~~~~~~~~(    ",
    "    /    ~~~    \\   ",
    "   ><(         )><  ",
  ],
  berries: [
    "    /\\/\\/\\/\\      ",
    "   /\\/\\/\\/\\/\\     ",
    "    ( ^v^    )      ",
    "   ~[          ]~   ",
    "   ~[  =======  ]~  ",
    "   ~[  =======  ]~  ",
    "   ~[          ]~   ",
    "    /Y        Y\\    ",
    "   / |        | \\   ",
    "  // |        | \\\\  ",
  ],
  mushroom: [
    "    ..oOOOo..       ",
    "   oO        Oo     ",
    "  ( Oo  OO  oO )    ",
    "  (  O  ()  O  )    ",
    "   (            )   ",
    "  (oOOOOOOOOOOOo)   ",
    "   (            )   ",
    "   ( |        | )   ",
    "   ( |        | )   ",
    "   (_/        \\_)   ",
  ],
  grain: [
    "   /|          |\\   ",
    "  / |          | \\  ",
    " (  \\          /  ) ",
    "   ( u        u )   ",
    "   {           }    ",
    "   {  ~~~~~~~  }    ",
    "   {           }    ",
    "    |  |    |  |    ",
    "    |  |    |  |    ",
    "   (U)(        )(U) ",
  ],
};

// Alternate variants per type for more variety
const BASE_VARIANTS = {
  meat: [
    "     /\\      /\\     ",
    "    ( _\\    /_ )    ",
    "   ( >':::::< )     ",
    "   /  ) (  ( )  \\   ",
    "  / / |  ##  | \\ \\  ",
    " (  ( |######|  ) ) ",
    "  \\ \\ |  ##  | / /  ",
    "   \\  )      (  /   ",
    "    \\ /| || |\\ /    ",
    "     V_|    |_V     ",
  ],
  fish: [
    "      ~~~ ~~~       ",
    "  ><<( o   o )>>    ",
    "   /~~~~~~~~~~~~~\\  ",
    "  / ~~~~~~~~~~~~~ \\ ",
    " ( ~~~~~~~~~~~~~~~) ",
    "  \\ ~~~~~~~~~~~~~ / ",
    "   \\~~~~~~~~~~~~~/  ",
    "    \\   ~~~~~   /   ",
    "     ><(     )><    ",
    "      ~~ ~~~ ~~     ",
  ],
  berries: [
    "  /\\/\\  /\\/\\       ",
    "  (  \\/\\/  )       ",
    "  ( >^v^<  )        ",
    " ~=[         ]=~    ",
    " ~=[ ======= ]=~    ",
    " ~=[ ======= ]=~    ",
    " ~=[         ]=~    ",
    "   / Y     Y \\      ",
    "  /  |     |  \\     ",
    " /Y  |     |  Y\\    ",
  ],
  mushroom: [
    "  ...oOOOOo...      ",
    " oO          Oo     ",
    "( Oo oO  Oo oO )    ",
    "(  O  ()()  O  )    ",
    " (              )   ",
    "(  oOOOOOOOOOo  )   ",
    " (              )   ",
    "  \\  |      |  /    ",
    "   \\ |      | /     ",
    "    \\|      |/      ",
  ],
  grain: [
    "  /||          ||\\  ",
    " / ||          || \\ ",
    "(   \\          /   )",
    "  ( uw        wu )  ",
    "   {            }   ",
    "   {  ~~~~~~~~  }   ",
    "   {            }   ",
    "    \\  |    |  /    ",
    "     \\ |    | /     ",
    "     (U)    (U)     ",
  ],
};

const CREATURE_COLOR = {
  meat: '#e05050', fish: '#5090e0', berries: '#d060d0',
  mushroom: '#50c080', grain: '#d0a040',
};

const NAME_POOLS = {
  meat:     { pre: ['Fang','Claw','Blood','Iron','Snarl','Gore'],    suf: ['claw','fang','jaw','bite','rend','crush']   },
  fish:     { pre: ['Scale','Fin','Wave','Tide','Depth','Brine'],    suf: ['fin','scale','gill','drift','slick','eel']  },
  berries:  { pre: ['Wing','Sky','Crest','Dawn','Bright','Ember'],   suf: ['wing','feather','beak','song','gust','ash'] },
  mushroom: { pre: ['Spore','Gloom','Shade','Murk','Glow','Dread'],  suf: ['spore','cap','stalk','eye','mold','void']   },
  grain:    { pre: ['Fluff','Meadow','Downy','Plump','Soft','Round'],suf: ['ear','tuft','seed','puff','hay','mane']     },
};

const TITLE_POOLS = {
  meat:     ['the Fierce', 'the Relentless', 'the Savage', 'the Hungry', 'the Feral'],
  fish:     ['the Swift',  'the Deep',       'the Slippery','the Silent','the Ancient'],
  berries:  ['the Radiant','the Free',       'the Wandering','the Bright','the Blazing'],
  mushroom: ['the Eerie',  'the Ancient',    'the Strange', 'the Watchful','the Dreaming'],
  grain:    ['the Fluffy', 'the Gentle',     'the Round',   'the Warm',   'the Plump'],
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

  // Randomly pick base or variant
  const useVariant = Math.random() < 0.5 && BASE_VARIANTS[dom];
  const lines = (useVariant ? BASE_VARIANTS[dom] : BASES[dom]).map(l => l);

  // Secondary food modifies one line
  if (sec && sec !== dom) {
    switch (sec) {
      case 'mushroom': // extra eyes on head line
        lines[2] = lines[2].replace(/[·.]/g, 'O').replace('()', '(O)');
        break;
      case 'berries': // wings on mid body
        lines[4] = '~' + lines[4].trim().padEnd(18) + '~';
        break;
      case 'fish': // dorsal fin on top
        lines[0] = '        ~~~~~       ';
        break;
      case 'meat': // claws on feet
        lines[9] = lines[9].replace(/\(([A-Za-z])/g, '/($1').replace(/([A-Za-z])\)/g, '$1)\\');
        break;
      case 'grain': // fluffy belly
        lines[6] = lines[6].replace(/[-=|]/g, '~');
        break;
    }
  }

  // Name
  const np  = NAME_POOLS[dom];
  const pre = pick(np.pre);
  const suf = sec ? pick(NAME_POOLS[sec].suf) : pick(np.suf);
  const title = pick(TITLE_POOLS[dom]);
  const name  = cap(pre + suf) + ' ' + title;

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
  // Reset view state first
  document.getElementById('game-view').hidden = false;
  document.getElementById('hatch-view').hidden = true;
  document.getElementById('hatch-content').innerHTML = '';

  const { grid, rooms, eggPos, startPos } = generateDungeon();
  G = {
    grid,
    revealed: makeGrid(DW, DH, false),
    rooms,
    eggPos,
    px: startPos.x,
    py: startPos.y,
    inventory: emptyInv(),
    eggInv:    emptyInv(),
    eggFed:    0,
    phase:     'playing',
    creature:  null,
    log: ['You stand before the Egg.', 'Bring it food and feed it (F)!'],
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

  // Feed one item at a time, in fixed priority order
  const key = FOOD_ORDER.find(k => G.inventory[k] > 0);
  if (!key) {
    addLog('You have no food to offer!');
    render();
    return;
  }

  G.inventory[key]--;
  G.eggInv[key]++;
  G.eggFed++;
  addLog(`You feed the egg ${key}. (${G.eggFed}/${FOOD_NEEDED})`);

  render(); // show updated count (including 10/10) before hatching

  if (G.eggFed >= FOOD_NEEDED) {
    setTimeout(hatch, 900);
  }
}

function hatch() {
  G.phase    = 'hatched';
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
      if (gx === px && gy === py) { html += span('@', CLR.bright['@']); continue; }

      const inLight = Math.hypot(gx - px, gy - py) <= LIGHT_R;
      const seen    = revealed[gy][gx];
      if (!seen && !inLight) { html += span(' ', '#000'); continue; }

      const ch    = grid[gy][gx];
      const table = inLight ? CLR.bright : CLR.dim;
      html += span(ch, table[ch] || (inLight ? '#aaa' : '#333'));
    }
    if (vy < VH - 1) html += '\n';
  }
  return html;
}

function renderNormal() {
  document.getElementById('game-view').hidden = false;
  document.getElementById('hatch-view').hidden = true;

  document.getElementById('viewport').innerHTML = renderViewport();

  // Inventory
  let invHtml = '';
  for (const [ch, info] of Object.entries(FOOD_INFO)) {
    const count = G.inventory[info.key];
    const color = count > 0 ? info.color : '#333';
    invHtml += `<div style="color:${color}">${escHtml(ch)} ${info.name.padEnd(8)} x${count}</div>`;
  }
  document.getElementById('inv-list').innerHTML = invHtml;

  // Egg stage art
  const stage = EGG_STAGES[getEggStage(G.eggFed)];
  const eggArtHtml = stage.art
    .map(l => `<span style="color:${stage.color}">${escHtml(l)}</span>`)
    .join('\n');
  document.getElementById('egg-stage').innerHTML = eggArtHtml;

  // Progress bar
  const pct    = Math.min(1, G.eggFed / FOOD_NEEDED);
  const filled = Math.floor(pct * 10);
  const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const barClr = pct >= 1 ? '#ffffff' : (pct > 0 ? '#c09030' : '#333');
  document.getElementById('egg-bar').innerHTML = `<span style="color:${barClr}">${bar}</span>`;
  document.getElementById('egg-fed').textContent = `${G.eggFed} / ${FOOD_NEEDED} fed`;

  // Proximity hint
  const dist = Math.abs(G.px - G.eggPos.x) + Math.abs(G.py - G.eggPos.y);
  document.getElementById('egg-hint').textContent = dist <= 1 ? 'Press F to feed!' : '';

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
