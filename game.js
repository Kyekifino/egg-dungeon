'use strict';

// ================================================================
//  EGG DUNGEON
// ================================================================

// ── Config ───────────────────────────────────────────────────────
const DW = 72, DH = 36;
const VW = 50, VH = 22;
const LIGHT_R  = 6;
const FOOD_NEEDED = 10;
const MAX_LOG  = 8;

// ── Food definitions ──────────────────────────────────────────────
const FOOD_INFO = {
  '%': { name: 'Meat',     key: 'meat',     color: '#e05050' },
  '~': { name: 'Fish',     key: 'fish',     color: '#5090e0' },
  '*': { name: 'Berries',  key: 'berries',  color: '#d060d0' },
  '^': { name: 'Mushroom', key: 'mushroom', color: '#50c080' },
  ',': { name: 'Grain',    key: 'grain',    color: '#d0a040' },
};
const FOOD_CHARS = Object.keys(FOOD_INFO);

// Food order for display / selection
const FOOD_KEYS = ['meat', 'fish', 'berries', 'mushroom', 'grain'];
const FOOD_KEY_MAP = { '1': 'meat', '2': 'fish', '3': 'berries', '4': 'mushroom', '5': 'grain' };

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

function hexDim(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = v => Math.round(v * factor).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

// ================================================================
//  EGG STAGE ART  (10 lines each, matching creature art height)
// ================================================================

const EGG_STAGES = [
  { // 0 fed — pristine
    color: '#a09028',
    art: [
      "              ",
      "   ________   ",
      "  /        \\  ",
      " |          | ",
      " |          | ",
      " |          | ",
      "  \\________/  ",
      "              ",
      "              ",
      "              ",
    ],
  },
  { // 1–3 fed — warm
    color: '#d0a820',
    art: [
      "              ",
      "   ________   ",
      "  / ·  · · \\  ",
      " | · ·  ·   | ",
      " |  · · ·   | ",
      " | ·  · · · | ",
      "  \\________/  ",
      "              ",
      "              ",
      "              ",
    ],
  },
  { // 4–6 fed — cracking
    color: '#e08810',
    art: [
      "              ",
      "   ___v____   ",
      "  /   |    \\  ",
      " | v  |     | ",
      " |    v     | ",
      " |    |  v  | ",
      "  \\___v____/  ",
      "              ",
      "              ",
      "              ",
    ],
  },
  { // 7–9 fed — shattering
    color: '#e05800',
    art: [
      "      *       ",
      "   __/\\_____  ",
      "  /v  \\ v   \\ ",
      " |  /\\ \\   v| ",
      " | /  \\/\\   | ",
      " |/   / \\v  | ",
      "  \\/\\_/  \\_/  ",
      "      *       ",
      "              ",
      "              ",
    ],
  },
  { // 10 fed — glowing
    color: '#ffffff',
    art: [
      "    *   *     ",
      "  *_________* ",
      " */ · * · · \\*",
      " |* · · * · *|",
      "*|· * · · * ·|*",
      " |* · * · · *|",
      " *\\· · * · /*",
      "  *_________* ",
      "    *   *     ",
      "              ",
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
//  HATCH ANIMATION FRAMES
// ================================================================

const ANIM_CRACK1 = [
  "    *   *     ",
  "  *__v_v___*  ",
  " */ · v · · \\*",
  " |· v · · · | ",
  "*|· · v · · |*",
  " |· · · v · | ",
  " *\\· · v · /* ",
  "  *___v____*  ",
  "    *   *     ",
  "              ",
];

const ANIM_CRACK2 = [
  "  *   *   *   ",
  "  _/\\*_/\\___  ",
  " /  \\*/  \\  \\ ",
  "|*  /\\*   |  |",
  "| */  \\*  |  |",
  "|*   /  \\*|  |",
  " \\*/    \\*/  /",
  "  *___*___*   ",
  "  *   *   *   ",
  "              ",
];

const ANIM_BURST = [
  " *  * * * *   ",
  "* * * * * * * ",
  " * * * * * *  ",
  "* * * * * * * ",
  " * * * * * *  ",
  "* * * * * * * ",
  " * * * * * *  ",
  "* * * * * * * ",
  " *  * * * *   ",
  "              ",
];

function buildAnimSequence(creature) {
  const s4 = EGG_STAGES[4].art;
  return [
    { lines: s4,             color: '#ffffff',                    delay: 320 },
    { lines: s4,             color: '#ffff88',                    delay: 200 },
    { lines: ANIM_CRACK1,    color: '#ffaa00',                    delay: 180 },
    { lines: ANIM_CRACK2,    color: '#ff6600',                    delay: 150 },
    { lines: ANIM_BURST,     color: '#ffffff',                    delay: 130 },
    { lines: ANIM_BURST,     color: '#ffcc88',                    delay: 100 },
    { lines: creature.lines, color: hexDim(creature.color, 0.22), delay: 220 },
    { lines: creature.lines, color: hexDim(creature.color, 0.50), delay: 200 },
    { lines: creature.lines, color: hexDim(creature.color, 0.78), delay: 260 },
    { lines: creature.lines, color: creature.color,               delay: 0   },
  ];
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

  const eggRoom = rooms[eggIdx];
  const eggPos  = roomCenter(eggRoom);
  grid[eggPos.y][eggPos.x] = 'Θ';

  // Scatter food in non-egg rooms
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
  meat:     { pre: ['Fang','Claw','Blood','Iron','Snarl','Gore'],    suf: ['claw','fang','jaw','bite','rend','crush']    },
  fish:     { pre: ['Scale','Fin','Wave','Tide','Depth','Brine'],    suf: ['fin','scale','gill','drift','slick','eel']   },
  berries:  { pre: ['Wing','Sky','Crest','Dawn','Bright','Ember'],   suf: ['wing','feather','beak','song','gust','ash']  },
  mushroom: { pre: ['Spore','Gloom','Shade','Murk','Glow','Dread'],  suf: ['spore','cap','stalk','eye','mold','void']    },
  grain:    { pre: ['Fluff','Meadow','Downy','Plump','Soft','Round'],suf: ['ear','tuft','seed','puff','hay','mane']      },
};

const TITLE_POOLS = {
  meat:     ['the Fierce','the Relentless','the Savage','the Hungry','the Feral'],
  fish:     ['the Swift', 'the Deep',      'the Slippery','the Silent','the Ancient'],
  berries:  ['the Radiant','the Free',     'the Wandering','the Bright','the Blazing'],
  mushroom: ['the Eerie', 'the Ancient',   'the Strange','the Watchful','the Dreaming'],
  grain:    ['the Fluffy','the Gentle',    'the Round','the Warm','the Plump'],
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

  const useVariant = Math.random() < 0.5 && BASE_VARIANTS[dom];
  const lines = (useVariant ? BASE_VARIANTS[dom] : BASES[dom]).map(l => l);

  if (sec && sec !== dom) {
    switch (sec) {
      case 'mushroom': lines[2] = lines[2].replace('.', 'O').replace('()', '(O)'); break;
      case 'berries':  lines[4] = '~' + lines[4].trim() + '~'; break;
      case 'fish':     lines[0] = '         ~~~        '; break;
      case 'meat':     lines[9] = lines[9].replace(/\(([A-Za-z])/g, '/($1'); break;
      case 'grain':    lines[6] = lines[6].replace(/[-=|]/g, '~'); break;
    }
  }

  const np    = NAME_POOLS[dom];
  const pre   = pick(np.pre);
  const suf   = sec ? pick(NAME_POOLS[sec].suf) : pick(np.suf);
  const title = pick(TITLE_POOLS[dom]);
  const name  = cap(pre + suf) + ' ' + title;

  const traits = ranked.map(k => TRAIT_NAMES[k]);
  const diet   = Object.entries(eggInv)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v}x ${k}`)
    .join(', ');

  return { lines, name, color: CREATURE_COLOR[dom], traits, diet };
}

// ================================================================
//  GAME STATE
// ================================================================

let G            = null;
let animCancelled = false;         // cancels in-flight animation on restart
let selectedFood = 'meat';         // persists across games

function emptyInv() {
  return { meat: 0, fish: 0, berries: 0, mushroom: 0, grain: 0 };
}

function newGame() {
  animCancelled = true;            // stop any running animation
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
    phase:     'playing',          // 'playing' | 'animating' | 'hatched'
    creature:  null,
    animFrames: [],
    animFrame:  0,
    log: ['You stand before the Egg.', 'Collect food and feed it (F)!'],
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
      if (nx >= 0 && nx < DW && ny >= 0 && ny < DH)
        if (Math.hypot(dx, dy) <= LIGHT_R) revealed[ny][nx] = true;
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

  const key = selectedFood;
  if (G.inventory[key] === 0) {
    addLog(`No ${key} in your inventory! (select with 1-5)`);
    render();
    return;
  }

  G.inventory[key]--;
  G.eggInv[key]++;
  G.eggFed++;
  addLog(`You feed the egg ${key}. (${G.eggFed}/${FOOD_NEEDED})`);

  render(); // show updated state (including 10/10) before hatching

  if (G.eggFed >= FOOD_NEEDED) {
    setTimeout(startHatch, 900);
  }
}

function startHatch() {
  G.creature   = generateCreature(G.eggInv);
  G.phase      = 'animating';
  G.animFrames = buildAnimSequence(G.creature);
  G.animFrame  = 0;
  animCancelled = false;
  addLog('THE EGG HATCHES!');
  runAnimFrame();
}

function runAnimFrame() {
  if (animCancelled) return;

  const frame = G.animFrames[G.animFrame];
  renderAnimFrame(frame);

  if (frame.delay === 0) {
    // Last frame — settle into hatched state
    setTimeout(() => {
      if (!animCancelled) {
        G.phase = 'hatched';
        render();
      }
    }, 400);
    return;
  }

  G.animFrame++;
  setTimeout(runAnimFrame, frame.delay);
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

function renderInventory() {
  let html = '';
  FOOD_KEYS.forEach((key, idx) => {
    const ch      = FOOD_CHARS.find(c => FOOD_INFO[c].key === key);
    const info    = FOOD_INFO[ch];
    const count   = G.inventory[key];
    const isSel   = selectedFood === key;
    const baseClr = count > 0 ? info.color : '#2e2e2e';
    const bg      = isSel ? 'background:#151515;' : '';
    const marker  = isSel ? '►' : ' ';
    html += `<div style="color:${baseClr};${bg}">${marker}${idx + 1} ${ch} ${key.padEnd(8)} x${count}</div>`;
  });
  document.getElementById('inv-list').innerHTML = html;
}

function renderLog() {
  const el = document.getElementById('log');
  el.innerHTML = G.log.map(m => `<div class="log-line">&gt; ${escHtml(m)}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function renderBottomPlaying() {
  const stage = EGG_STAGES[getEggStage(G.eggFed)];
  document.getElementById('egg-display').innerHTML =
    stage.art.map(l => `<span style="color:${stage.color}">${escHtml(l)}</span>`).join('\n');

  const pct    = Math.min(1, G.eggFed / FOOD_NEEDED);
  const filled = Math.floor(pct * 10);
  const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const barClr = pct >= 1 ? '#ffffff' : (pct > 0 ? '#c09030' : '#333');

  const selCh   = FOOD_CHARS.find(c => FOOD_INFO[c].key === selectedFood);
  const selInfo = FOOD_INFO[selCh];
  const selCount = G.inventory[selectedFood];
  const dist    = Math.abs(G.px - G.eggPos.x) + Math.abs(G.py - G.eggPos.y);

  document.getElementById('egg-info').innerHTML = `
    <div id="egg-bar"><span style="color:${barClr}">${bar}</span></div>
    <div id="egg-fed-count">${G.eggFed} / ${FOOD_NEEDED} fed</div>
    <div style="margin-top:4px;font-size:0.78rem;color:#444">
      Selected: <span style="color:${selInfo.color}">${selCh} ${selectedFood}</span>
      &nbsp;(x${selCount})
    </div>
    <div id="feed-hint">${dist <= 1 ? 'Press F to feed!' : ''}</div>
  `;
}

function renderAnimFrame(frame) {
  document.getElementById('egg-display').innerHTML =
    frame.lines.map(l => `<span style="color:${frame.color}">${escHtml(l)}</span>`).join('\n');

  const bar = '█'.repeat(10);
  document.getElementById('egg-info').innerHTML = `
    <div id="egg-bar"><span style="color:#ffffff">${bar}</span></div>
    <div id="egg-fed-count">${FOOD_NEEDED} / ${FOOD_NEEDED} fed</div>
    <div id="anim-label" style="margin-top:8px;">HATCHING...</div>
  `;
}

function renderBottomHatched() {
  const { creature } = G;
  document.getElementById('egg-display').innerHTML =
    creature.lines.map(l => `<span style="color:${creature.color}">${escHtml(l)}</span>`).join('\n');

  document.getElementById('egg-info').innerHTML = `
    <div id="creature-name-display" style="color:${creature.color}">
      &ldquo;${escHtml(creature.name)}&rdquo;
    </div>
    <div id="creature-traits-display">${creature.traits.join(' &middot; ')}</div>
    <div id="creature-diet-display">${escHtml(creature.diet)}</div>
    <div id="restart-hint">Press R to hatch another</div>
  `;
}

function render() {
  if (G.phase === 'animating') return; // animation drives its own bottom panel updates

  document.getElementById('viewport').innerHTML = renderViewport();
  renderInventory();
  renderLog();

  if (G.phase === 'playing')  renderBottomPlaying();
  if (G.phase === 'hatched')  renderBottomHatched();
}

// ================================================================
//  INPUT
// ================================================================

const MOVE_KEYS = {
  ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0],
  w:[0,-1], s:[0,1], a:[-1,0], d:[1,0],
  W:[0,-1], S:[0,1], A:[-1,0], D:[1,0],
};

document.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') { newGame(); return; }
  if (e.key === 'f' || e.key === 'F') { tryFeed(); return; }
  if (FOOD_KEY_MAP[e.key]) {
    selectedFood = FOOD_KEY_MAP[e.key];
    if (G && G.phase === 'playing') render();
    return;
  }
  const mv = MOVE_KEYS[e.key];
  if (mv) { e.preventDefault(); tryMove(mv[0], mv[1]); }
});

// ================================================================
//  START
// ================================================================

newGame();
