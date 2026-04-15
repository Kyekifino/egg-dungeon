'use strict';

// ================================================================
//  EGG DUNGEON
// ================================================================

// ── Config ───────────────────────────────────────────────────────
const VW = 50, VH = 22;
const LIGHT_R     = 6;
const FOOD_NEEDED = 10;
const MAX_LOG     = 8;

// Chunk dimensions & corridor positions (guaranteed connectivity)
const CW = 26, CH = 16;
const CORR_X = 12;   // N-S corridor at this local col in every chunk
const CORR_Y = 7;    // E-W corridor at this local row in every chunk

// ── Food ─────────────────────────────────────────────────────────
const FOOD_INFO = {
  '%': { name: 'Meat',     key: 'meat',     color: '#e05050' },
  '~': { name: 'Fish',     key: 'fish',     color: '#5090e0' },
  '*': { name: 'Berries',  key: 'berries',  color: '#d060d0' },
  '^': { name: 'Mushroom', key: 'mushroom', color: '#50c080' },
  ',': { name: 'Grain',    key: 'grain',    color: '#d0a040' },
};
const FOOD_CHARS   = Object.keys(FOOD_INFO);
const FOOD_KEYS    = ['meat','fish','berries','mushroom','grain'];
const FOOD_KEY_MAP = {'1':'meat','2':'fish','3':'berries','4':'mushroom','5':'grain'};

// ── Cell colours ──────────────────────────────────────────────────
const CLR = {
  bright: { '#':'#777','.':'#2e2e2e','@':'#fff','Θ':'#fff080',
            '%':'#e05050','~':'#5090e0','*':'#d060d0','^':'#50c080',',':'#d0a040' },
  dim:    { '#':'#2e2e2e','.':'#151515','@':'#fff','Θ':'#706020',
            '%':'#601818','~':'#183060','*':'#501850','^':'#185030',',':'#503010' },
};

// ── Rarity ───────────────────────────────────────────────────────
const RARITIES = [
  { name:'Common',    badge:'[C]', color:'#888', threshold:6000  },
  { name:'Uncommon',  badge:'[U]', color:'#50c050', threshold:8500  },
  { name:'Rare',      badge:'[R]', color:'#5090e0', threshold:9700  },
  { name:'Legendary', badge:'[L]', color:'#f0c030', threshold:10001 },
];
const getRarity = roll => RARITIES.find(r => roll < r.threshold) ?? RARITIES.at(-1);

// ── Utilities ─────────────────────────────────────────────────────
const rand    = (a,b) => Math.floor(Math.random()*(b-a))+a;
const escHtml = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const cap     = s => s.charAt(0).toUpperCase()+s.slice(1);

function djb2(str) {
  let h = 5381;
  for (let i=0; i<str.length; i++) h = (((h<<5)+h)+str.charCodeAt(i))|0;
  return h>>>0;
}

function mulberry32(seed) {
  let s = seed>>>0;
  return {
    next() {
      s += 0x6D2B79F5; s|=0;
      let t = Math.imul(s^s>>>15, s|1);
      t ^= t + Math.imul(t^t>>>7, t|61);
      return ((t^t>>>14)>>>0)/0x100000000;
    },
    int(a,b){ return Math.floor(this.next()*(b-a))+a; },
    pick(arr){ return arr[this.int(0,arr.length)]; },
  };
}

const hexDim = (hex,f) => {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  const fh = v => Math.round(v*f).toString(16).padStart(2,'0');
  return `#${fh(r)}${fh(g)}${fh(b)}`;
};

function lerpColor(c1,c2,t) {
  const p=h=>parseInt(h,16);
  const [r1,g1,b1]=[p(c1.slice(1,3)),p(c1.slice(3,5)),p(c1.slice(5,7))];
  const [r2,g2,b2]=[p(c2.slice(1,3)),p(c2.slice(3,5)),p(c2.slice(5,7))];
  const fh = v => Math.round(v).toString(16).padStart(2,'0');
  return `#${fh(r1+(r2-r1)*t)}${fh(g1+(g2-g1)*t)}${fh(b1+(b2-b1)*t)}`;
}

const toID = n => (n>>>0).toString(36).toUpperCase().padStart(7,'0');

// ================================================================
//  INFINITE CHUNK WORLD
//  Every chunk has a guaranteed N-S corridor at local x=CORR_X and
//  E-W corridor at local y=CORR_Y, so the world is always connected.
// ================================================================

let WORLD_SEED = 0;
const chunks   = new Map();

function chunkSeed(cx, cy) {
  let h = WORLD_SEED>>>0;
  h = (Math.imul(h^(h>>>16), 0x45d9f3b)>>>0);
  h = (Math.imul(h^(cx*0x9e3779b9|0), 0x517cc1b7)>>>0);
  h = (Math.imul(h^(cy*0x27d4eb2f|0), 0x6b9b0b)>>>0);
  return h;
}

function generateChunk(cx, cy) {
  const grid = Array.from({length:CH}, ()=>Array(CW).fill('#'));
  const rng  = mulberry32(chunkSeed(cx, cy));

  // Guaranteed corridors (infinite connectivity)
  for (let y=0; y<CH; y++) grid[y][CORR_X] = '.';
  for (let x=0; x<CW; x++) grid[CORR_Y][x] = '.';

  // Random rooms
  const n = rng.int(2,5);
  for (let i=0; i<n; i++) {
    const rw=rng.int(4,10), rh=rng.int(3,6);
    const rx=rng.int(1,CW-rw-1), ry=rng.int(1,CH-rh-1);
    for (let y=ry; y<ry+rh; y++)
      for (let x=rx; x<rx+rw; x++)
        grid[y][x]='.';
    // Connect room center to both corridors
    const rmx=rx+Math.floor(rw/2), rmy=ry+Math.floor(rh/2);
    let x=rmx; while(x!==CORR_X){ grid[rmy][x]='.'; x+=CORR_X>x?1:-1; }
    let y=rmy; while(y!==CORR_Y){ grid[y][rmx]='.'; y+=CORR_Y>y?1:-1; }
  }

  // Scatter food (~4% on floor tiles)
  for (let y=0; y<CH; y++)
    for (let x=0; x<CW; x++)
      if (grid[y][x]==='.' && rng.next()<0.04)
        grid[y][x]=FOOD_CHARS[rng.int(0,FOOD_CHARS.length)];

  return { grid };
}

function getChunk(cx,cy) {
  const key=`${cx},${cy}`;
  if (!chunks.has(key)) chunks.set(key, generateChunk(cx,cy));
  return chunks.get(key);
}

const cx  = wx => Math.floor(wx/CW);
const cy  = wy => Math.floor(wy/CH);
const lx  = wx => ((wx%CW)+CW)%CW;
const ly  = wy => ((wy%CH)+CH)%CH;

function getTile(wx,wy)     { return getChunk(cx(wx),cy(wy)).grid[ly(wy)][lx(wx)]; }
function setTile(wx,wy,ch)  { getChunk(cx(wx),cy(wy)).grid[ly(wy)][lx(wx)]=ch; }
function isWalkable(wx,wy)  { return getTile(wx,wy)!=='#'; }

// Room = 3+ cardinal neighbours walkable (corridors have ≤2)
function isRoomTile(wx,wy) {
  return [[0,-1],[0,1],[-1,0],[1,0]].filter(([dx,dy])=>isWalkable(wx+dx,wy+dy)).length>=3;
}

// ================================================================
//  EGG VISUAL STAGES  (10 lines, matches creature art height)
// ================================================================

const EGG_STAGES = [
  { color:'#a09028', art:[
    "              ","   ________   ","  /        \\  "," |          | ",
    " |          | "," |          | ","  \\________/  ","              ","              ","              "]},
  { color:'#d0a820', art:[
    "              ","   ________   ","  / ·  · · \\  "," | · ·  ·   | ",
    " |  · · ·   | "," | ·  · · · | ","  \\________/  ","              ","              ","              "]},
  { color:'#e08810', art:[
    "              ","   ___v____   ","  /   |    \\  "," | v  |     | ",
    " |    v     | "," |    |  v  | ","  \\___v____/  ","              ","              ","              "]},
  { color:'#e05800', art:[
    "      *       ","   __/\\_____  ","  /v  \\ v   \\ "," |  /\\ \\   v| ",
    " | /  \\/\\   | "," |/   / \\v  | ","  \\/\\_/  \\_/  ","      *       ","              ","              "]},
  { color:'#ffffff', art:[
    "    *   *     ","  *_________* "," */ · * · · \\*"," |* · · * · *|",
    "*|· * · · * ·|*"," |* · * · · *|"," *\\· · * · /*","  *_________* ","    *   *     ","              "]},
];

const getEggStage = fed => fed>=10?4:fed>=7?3:fed>=4?2:fed>=1?1:0;

// ── Hatch animation frames ────────────────────────────────────────
const ANIM_CRACK1 = [
  "    *   *     ","  *__v_v___*  "," */ · v · · \\*"," |· v · · · | ",
  "*|· · v · · |*"," |· · · v · | "," *\\· · v · /* ","  *___v____*  ","    *   *     ","              "];
const ANIM_CRACK2 = [
  "  *   *   *   ","  _/\\*_/\\___  "," /  \\*/  \\  \\ ","|*  /\\*   |  |",
  "| */  \\*  |  |","|*   /  \\*|  |"," \\*/    \\*/  /","  *___*___*   ","  *   *   *   ","              "];
const ANIM_BURST  = [
  " *  * * * *   ","* * * * * * * "," * * * * * *  ","* * * * * * * ",
  " * * * * * *  ","* * * * * * * "," * * * * * *  ","* * * * * * * "," *  * * * *   ","              "];

function buildAnimSeq(creature) {
  const s4 = EGG_STAGES[4].art;
  return [
    {lines:s4,            color:'#ffffff',                    delay:320},
    {lines:s4,            color:'#ffff88',                    delay:200},
    {lines:ANIM_CRACK1,   color:'#ffaa00',                    delay:180},
    {lines:ANIM_CRACK2,   color:'#ff6600',                    delay:150},
    {lines:ANIM_BURST,    color:'#ffffff',                    delay:130},
    {lines:ANIM_BURST,    color:'#ffcc88',                    delay:100},
    {lines:creature.lines,color:hexDim(creature.color,0.22),  delay:220},
    {lines:creature.lines,color:hexDim(creature.color,0.50),  delay:200},
    {lines:creature.lines,color:hexDim(creature.color,0.80),  delay:260},
    {lines:creature.lines,color:creature.color,               delay:0  },
  ];
}

// ================================================================
//  CREATURE GENERATION  (fully deterministic from hash)
// ================================================================

const BASES = {
  meat:[
    "      /\\    /\\      ","     (  \\  //  )    ","    ( >=':':=< )    ",
    "    /|   ()   |\\    ","   / |  /##\\  | \\   ","  (  | |####| |  )  ",
    "   \\ |  \\##/  | /   ","    \\|         |/   ","     /|  ||  |\\     ",
    "    /_\\__|  |__/\\   "],
  fish:[
    "         ~~~        ","   ><(  o . o  )><  ","    /~~~~~~~~~~~\\   ",
    "   | ~~~~~~~~~~~ |  ","  (  ~~~~~~~~~~~  ) ","   | ~~~~~~~~~~~ |  ",
    "    \\~~~~~~~~~~~/   ","     )~~~~~~~~~(    ","    /    ~~~    \\   ",
    "   ><(         )><  "],
  berries:[
    "    /\\/\\/\\/\\      ","   /\\/\\/\\/\\/\\     ","    ( ^v^    )      ",
    "   ~[          ]~   ","   ~[  =======  ]~  ","   ~[  =======  ]~  ",
    "   ~[          ]~   ","    /Y        Y\\    ","   / |        | \\   ",
    "  // |        | \\\\  "],
  mushroom:[
    "    ..oOOOo..       ","   oO        Oo     ","  ( Oo  OO  oO )    ",
    "  (  O  ()  O  )    ","   (            )   ","  (oOOOOOOOOOOOo)   ",
    "   (            )   ","   ( |        | )   ","   ( |        | )   ",
    "   (_/        \\_)   "],
  grain:[
    "   /|          |\\   ","  / |          | \\  "," (  \\          /  ) ",
    "   ( u        u )   ","   {           }    ","   {  ~~~~~~~  }    ",
    "   {           }    ","    |  |    |  |    ","    |  |    |  |    ",
    "   (U)(        )(U) "],
};
const BASE_VARS = {
  meat:[
    "     /\\      /\\     ","    ( _\\    /_ )    ","   ( >':::::< )     ",
    "   /  ) (  ( )  \\   ","  / / |  ##  | \\ \\  "," (  ( |######|  ) ) ",
    "  \\ \\ |  ##  | / /  ","   \\  )      (  /   ","    \\ /| || |\\ /    ",
    "     V_|    |_V     "],
  fish:[
    "      ~~~ ~~~       ","  ><<( o   o )>>    ","   /~~~~~~~~~~~~~\\  ",
    "  / ~~~~~~~~~~~~~ \\ "," ( ~~~~~~~~~~~~~~~) ","  \\ ~~~~~~~~~~~~~ / ",
    "   \\~~~~~~~~~~~~~/  ","    \\   ~~~~~   /   ","     ><(     )><    ",
    "      ~~ ~~~ ~~     "],
  berries:[
    "  /\\/\\  /\\/\\       ","  (  \\/\\/  )       ","  ( >^v^<  )        ",
    " ~=[         ]=~    "," ~=[ ======= ]=~    "," ~=[ ======= ]=~    ",
    " ~=[         ]=~    ","   / Y     Y \\      ","  /  |     |  \\     ",
    " /Y  |     |  Y\\    "],
  mushroom:[
    "  ...oOOOOo...      "," oO          Oo     ","( Oo oO  Oo oO )    ",
    "(  O  ()()  O  )    "," (              )   ","(  oOOOOOOOOOo  )   ",
    " (              )   ","  \\  |      |  /    ","   \\ |      | /     ",
    "    \\|      |/      "],
  grain:[
    "  /||          ||\\  "," / ||          || \\ ","(   \\          /   )",
    "  ( uw        wu )  ","   {            }   ","   {  ~~~~~~~~  }   ",
    "   {            }   ","    \\  |    |  /    ","     \\ |    | /     ",
    "     (U)    (U)     "],
};

const CREATURE_COLOR = {
  meat:'#e05050', fish:'#5090e0', berries:'#d060d0', mushroom:'#50c080', grain:'#d0a040'
};

const NAME_POOLS = {
  meat:    {pre:['Fang','Claw','Blood','Iron','Snarl','Gore','Rend','Bone','Dire','Grim'],
            suf:['claw','fang','jaw','bite','rend','crush','slash','gnaw','maw','tear']},
  fish:    {pre:['Scale','Fin','Wave','Tide','Depth','Brine','Coral','Drift','Foam','Ebb'],
            suf:['fin','scale','gill','drift','slick','eel','wake','surge','kelp','lure']},
  berries: {pre:['Wing','Sky','Crest','Dawn','Bright','Ember','Plume','Gale','Wisp','Zeph'],
            suf:['wing','feather','beak','song','gust','ash','crest','flare','soar','talon']},
  mushroom:{pre:['Spore','Gloom','Shade','Murk','Glow','Dread','Pall','Veil','Mist','Blight'],
            suf:['spore','cap','stalk','eye','mold','void','rot','shade','bloom','pore']},
  grain:   {pre:['Fluff','Meadow','Downy','Plump','Soft','Round','Wool','Burr','Tuft','Mote'],
            suf:['ear','tuft','seed','puff','hay','mane','fluff','bristle','brush','wisp']},
};

const TITLE_POOLS = {
  meat:    ['the Fierce','the Relentless','the Savage','the Hungry','the Feral',
            'the Bloodthirsty','the Ruthless','the Fearsome','the Merciless','the Wrathful'],
  fish:    ['the Swift','the Deep','the Slippery','the Silent','the Ancient',
            'the Unfathomed','the Abyssal','the Tidal','the Murky','the Lurking'],
  berries: ['the Radiant','the Free','the Wandering','the Bright','the Blazing',
            'the Soaring','the Brilliant','the Vivid','the Luminous','the Untamed'],
  mushroom:['the Eerie','the Ancient','the Strange','the Watchful','the Dreaming',
            'the Unknowable','the Cryptic','the Eldritch','the Lurking','the Hollow'],
  grain:   ['the Fluffy','the Gentle','the Round','the Warm','the Plump',
            'the Cozy','the Soft','the Jolly','the Bountiful','the Drowsy'],
};

const TRAIT_NAMES = {
  meat:'Carnivore', fish:'Aquatic', berries:'Aerial', mushroom:'Multi-eyed', grain:'Fluffy'
};

function rankFoods(inv) {
  return Object.entries(inv).filter(([,v])=>v>0).sort(([,a],[,b])=>b-a).map(([k])=>k);
}

// All creature properties deterministically derived from hash
function generateCreature(egg) {
  const { foodSequence, rarityRoll, inv } = egg;
  const hashStr = foodSequence.join(',') + ':' + rarityRoll;
  const hashVal = djb2(hashStr);
  const rng     = mulberry32(hashVal);
  const rarity  = getRarity(rarityRoll);
  const ranked  = rankFoods(inv);
  const dom     = ranked[0] ?? rng.pick(FOOD_KEYS);
  const sec     = ranked[1] ?? null;

  const useVar  = rng.next() < 0.5;
  const lines   = (useVar ? BASE_VARS[dom] : BASES[dom]).map(l=>l);

  if (sec && sec !== dom) {
    switch(sec) {
      case 'mushroom': lines[2]=lines[2].replace('.','O').replace('()','(O)'); break;
      case 'berries':  { const l=lines[4].trim(); lines[4]='~'+l.padEnd(18)+'~'; break; }
      case 'fish':     lines[0]='         ~~~        '; break;
      case 'meat':     lines[9]=lines[9].replace(/\(([A-Za-z])/g,'/($1'); break;
      case 'grain':    lines[6]=lines[6].replace(/[-=|]/g,'~'); break;
    }
  }

  // Legendary gets a golden shimmer line
  if (rarity.name==='Legendary') lines[0]='   * * * * * * *   ';

  const np  = NAME_POOLS[dom];
  const pre = np.pre[Math.floor(rng.next()*np.pre.length)];
  const suf = sec ? NAME_POOLS[sec].suf[Math.floor(rng.next()*NAME_POOLS[sec].suf.length)]
                  : np.suf[Math.floor(rng.next()*np.suf.length)];
  const title = TITLE_POOLS[dom][Math.floor(rng.next()*TITLE_POOLS[dom].length)];
  const name  = cap(pre+suf)+' '+title;

  let color = CREATURE_COLOR[dom];
  if (rarity.name==='Legendary')       color='#f0d040';
  else if (rarity.name==='Rare')       color=lerpColor(color,'#88aaff',0.35);
  else if (rarity.name==='Uncommon')   color=lerpColor(color,'#aaffaa',0.15);

  const traits = ranked.map(k=>TRAIT_NAMES[k]);
  const diet   = Object.entries(inv).filter(([,v])=>v>0).map(([k,v])=>`${v}x ${k}`).join(', ');
  const id     = toID(hashVal);

  return { id, hashVal, hashStr, name, color, rarity, lines, traits, diet };
}

// ================================================================
//  GAME STATE
// ================================================================

let G             = null;
let animCancelled = false;
let selectedFood  = 'meat';   // persists across eggs

function emptyInv() { return {meat:0,fish:0,berries:0,mushroom:0,grain:0}; }

function newGame() {
  animCancelled = true;
  WORLD_SEED    = rand(0, 0xFFFFFF);
  chunks.clear();

  // Pre-warm starting chunks
  for (let dcy=-1; dcy<=1; dcy++) for (let dcx=-1; dcx<=1; dcx++) getChunk(dcx,dcy);

  // Initial egg at corridor intersection of chunk (0,0)
  const eggX = CORR_X, eggY = CORR_Y;   // world (12, 7)
  setTile(eggX, eggY, '.');              // clear any generated food under egg

  G = {
    px: eggX+1, py: eggY,               // start directly adjacent
    inventory:  emptyInv(),
    egg: {
      x: eggX, y: eggY,
      foodSequence: [],
      rarityRoll:   rand(0, 10000),
      inv:          emptyInv(),
      fed:          0,
    },
    phase:          'playing',
    creature:       null,
    collection:     [],
    revealed:       new Set(),
    showCollection: false,
    colSelectedIdx: 0,
    animFrames:     [],
    animFrame:      0,
    log: ['You stand beside the Egg.','Collect food and feed it (F)!'],
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
  const {revealed,px,py} = G;
  for (let dy=-LIGHT_R-1; dy<=LIGHT_R+1; dy++)
    for (let dx=-LIGHT_R-1; dx<=LIGHT_R+1; dx++) {
      const nx=px+dx, ny=py+dy;
      if (Math.hypot(dx,dy)<=LIGHT_R) revealed.add(`${nx},${ny}`);
    }
}

// ================================================================
//  GAME LOGIC
// ================================================================

function tryMove(dx,dy) {
  if (G.phase==='animating') return;
  const nx=G.px+dx, ny=G.py+dy;
  if (!isWalkable(nx,ny)) return;
  if (G.egg && nx===G.egg.x && ny===G.egg.y) return;  // can't walk onto egg

  G.px=nx; G.py=ny;

  const tile=getTile(nx,ny);
  const info=FOOD_INFO[tile];
  if (info) {
    G.inventory[info.key]++;
    setTile(nx,ny,'.');
    addLog(`Picked up ${info.name}!`);
  }
  updateFOV();
  render();
}

function tryFeed() {
  if (G.phase==='animating') return;
  if (!G.egg) { addLog('No egg to feed! Press R in a room.'); render(); return; }
  const dist=Math.abs(G.px-G.egg.x)+Math.abs(G.py-G.egg.y);
  if (dist>1) { addLog('Move adjacent to the Egg (Θ) to feed it.'); render(); return; }
  const key=selectedFood;
  if (G.inventory[key]===0) { addLog(`No ${key} in your inventory! (select with 1-5)`); render(); return; }

  G.inventory[key]--;
  G.egg.inv[key]++;
  G.egg.foodSequence.push(key);
  G.egg.fed++;
  addLog(`Fed the egg ${key}. (${G.egg.fed}/${FOOD_NEEDED})`);
  render();
  if (G.egg.fed>=FOOD_NEEDED) setTimeout(startHatch, 900);
}

function trySpawnEgg() {
  if (G.phase==='animating') return;
  if (G.egg) { addLog('An egg already exists!'); render(); return; }
  if (!isRoomTile(G.px,G.py)) { addLog('You must be in a room (not a hallway) to lay an egg.'); render(); return; }

  const candidates=[[0,-1],[0,1],[-1,0],[1,0]]
    .filter(([dx,dy])=>getTile(G.px+dx,G.py+dy)==='.');
  if (candidates.length===0) { addLog('No empty space adjacent to lay an egg!'); render(); return; }

  const [dx,dy]=candidates[rand(0,candidates.length)];
  G.egg={
    x:G.px+dx, y:G.py+dy,
    foodSequence:[], rarityRoll:rand(0,10000),
    inv:emptyInv(), fed:0,
  };
  G.phase    ='playing';
  G.creature =null;
  addLog('You lay a new egg!');
  render();
}

function startHatch() {
  G.creature   =generateCreature(G.egg);
  G.phase      ='animating';
  G.animFrames =buildAnimSeq(G.creature);
  G.animFrame  =0;
  animCancelled=false;

  // Add to collection if new (by hash)
  if (!G.collection.find(c=>c.hashVal===G.creature.hashVal)) {
    G.collection.push({...G.creature, date:new Date().toLocaleDateString()});
  }
  addLog(`THE EGG HATCHES!  [${G.creature.rarity.name}]`);
  G.egg=null;   // egg is gone
  autoSave();
  runAnimFrame();
}

function runAnimFrame() {
  if (animCancelled) return;
  const frame=G.animFrames[G.animFrame];
  renderAnimFrame(frame);
  if (frame.delay===0) {
    setTimeout(()=>{ if(!animCancelled){G.phase='hatched';render();} }, 400);
    return;
  }
  G.animFrame++;
  setTimeout(runAnimFrame, frame.delay);
}

// ================================================================
//  RENDERING
// ================================================================

const span = (ch,color) => `<span style="color:${color}">${escHtml(ch)}</span>`;

function renderViewport() {
  const {px,py,revealed,egg} = G;
  const camX=px-Math.floor(VW/2), camY=py-Math.floor(VH/2);
  let html='';
  for (let vy=0; vy<VH; vy++) {
    const gy=camY+vy;
    for (let vx=0; vx<VW; vx++) {
      const gx=camX+vx;
      if (gx===px&&gy===py)             { html+=span('@',CLR.bright['@']); continue; }
      if (egg&&gx===egg.x&&gy===egg.y)  { html+=span('Θ',CLR.bright['Θ']); continue; }
      const inLight=Math.hypot(gx-px,gy-py)<=LIGHT_R;
      const seen=revealed.has(`${gx},${gy}`);
      if (!seen&&!inLight)              { html+=span(' ','#000'); continue; }
      const ch=getTile(gx,gy);
      const t=inLight?CLR.bright:CLR.dim;
      html+=span(ch, t[ch]||(inLight?'#aaa':'#333'));
    }
    if (vy<VH-1) html+='\n';
  }
  return html;
}

function renderInventory() {
  let html='';
  FOOD_KEYS.forEach((key,idx)=>{
    const ch=FOOD_CHARS.find(c=>FOOD_INFO[c].key===key);
    const {color}=FOOD_INFO[ch];
    const count=G.inventory[key];
    const sel=selectedFood===key;
    const clr=count>0?color:'#2e2e2e';
    const bg=sel?'background:#151515;':'';
    html+=`<div style="color:${clr};${bg}">${sel?'►':' '}${idx+1} ${ch} ${key.padEnd(8)} x${count}</div>`;
  });
  document.getElementById('inv-list').innerHTML=html;
}

function renderLog() {
  const el=document.getElementById('log');
  el.innerHTML=G.log.map(m=>`<div class="log-line">&gt; ${escHtml(m)}</div>`).join('');
  el.scrollTop=el.scrollHeight;
}

function renderBottomPlaying() {
  if (!G.egg) {
    document.getElementById('egg-display').innerHTML=
      `<span style="color:#2a2a2a">${EGG_STAGES[0].art.join('\n').replace(/./g,' ')}</span>`;
    document.getElementById('egg-info').innerHTML=
      `<div id="no-egg-msg">No egg.<br><br>Stand in a room and<br>press R to lay one.</div>`;
    return;
  }
  const stage=EGG_STAGES[getEggStage(G.egg.fed)];
  document.getElementById('egg-display').innerHTML=
    stage.art.map(l=>`<span style="color:${stage.color}">${escHtml(l)}</span>`).join('\n');

  const pct=Math.min(1,G.egg.fed/FOOD_NEEDED);
  const filled=Math.floor(pct*10);
  const bar='█'.repeat(filled)+'░'.repeat(10-filled);
  const barClr=pct>=1?'#fff':pct>0?'#c09030':'#333';
  const selCh=FOOD_CHARS.find(c=>FOOD_INFO[c].key===selectedFood);
  const selClr=FOOD_INFO[selCh].color;
  const dist=Math.abs(G.px-G.egg.x)+Math.abs(G.py-G.egg.y);

  document.getElementById('egg-info').innerHTML=`
    <div id="egg-bar"><span style="color:${barClr}">${bar}</span></div>
    <div id="egg-fed-count">${G.egg.fed} / ${FOOD_NEEDED} fed</div>
    <div style="margin-top:3px;font-size:.78rem;color:#444">
      Selected: <span style="color:${selClr}">${selCh} ${selectedFood}</span>
      &nbsp;(x${G.inventory[selectedFood]})
    </div>
    <div id="feed-hint">${dist===1?'Press F to feed!':''}</div>`;
}

function renderAnimFrame(frame) {
  document.getElementById('egg-display').innerHTML=
    frame.lines.map(l=>`<span style="color:${frame.color}">${escHtml(l)}</span>`).join('\n');
  document.getElementById('egg-info').innerHTML=
    `<div id="egg-bar"><span style="color:#fff">${'█'.repeat(10)}</span></div>
     <div id="egg-fed-count">${FOOD_NEEDED} / ${FOOD_NEEDED} fed</div>
     <div id="anim-label" style="margin-top:8px">HATCHING...</div>`;
}

function renderBottomHatched() {
  const {creature}=G;
  document.getElementById('egg-display').innerHTML=
    creature.lines.map(l=>`<span style="color:${creature.color}">${escHtml(l)}</span>`).join('\n');
  const r=creature.rarity;
  document.getElementById('egg-info').innerHTML=`
    <div id="creature-name-display" style="color:${creature.color}">&ldquo;${escHtml(creature.name)}&rdquo;</div>
    <div id="creature-rarity-display" style="color:${r.color}">${r.badge} ${r.name}</div>
    <div id="creature-traits-display">${creature.traits.join(' &middot; ')}</div>
    <div id="creature-diet-display">${escHtml(creature.diet)}</div>
    <div id="creature-id-display">ID: ${creature.id}</div>
    <div id="restart-hint">Press R in a room to lay another egg</div>`;
}

function renderCollection() {
  const {collection}=G;
  document.getElementById('col-count').textContent=`${collection.length} hatched`;

  const order={'Legendary':0,'Rare':1,'Uncommon':2,'Common':3};
  const sorted=[...collection].sort((a,b)=>
    (order[a.rarity.name]??9)-(order[b.rarity.name]??9)||a.name.localeCompare(b.name));

  if (collection.length===0) {
    document.getElementById('col-list').innerHTML=
      '<div style="color:#333;padding:12px 0;text-align:center">No creatures hatched yet.</div>';
    document.getElementById('col-art').innerHTML='';
    document.getElementById('col-detail-info').innerHTML=
      '<div style="color:#333;font-size:0.8rem">Hatch an egg to fill your collection.</div>';
    return;
  }

  G.colSelectedIdx=Math.max(0,Math.min(G.colSelectedIdx,sorted.length-1));
  const sel=sorted[G.colSelectedIdx];

  document.getElementById('col-list').innerHTML=sorted.map((c,i)=>`
    <div class="col-entry${i===G.colSelectedIdx?' col-selected':''}" data-idx="${i}">
      <div class="col-name">
        <span style="color:${c.rarity.color}">${c.rarity.badge}</span>
        &nbsp;<span style="color:${c.color}">&ldquo;${escHtml(c.name)}&rdquo;</span>
      </div>
      <div class="col-id">${c.date||''}</div>
    </div>`).join('');

  const selEl=document.querySelector('#col-list .col-selected');
  if (selEl) selEl.scrollIntoView({block:'nearest'});

  document.getElementById('col-art').innerHTML=
    sel.lines.map(l=>`<span style="color:${sel.color}">${escHtml(l)}</span>`).join('\n');

  document.getElementById('col-detail-info').innerHTML=`
    <div style="color:${sel.color};font-size:0.85rem">&ldquo;${escHtml(sel.name)}&rdquo;</div>
    <div style="color:${sel.rarity.color};font-size:0.75rem">${sel.rarity.badge} ${sel.rarity.name}</div>
    <div style="color:#555;font-size:0.72rem">${sel.traits.join(' &middot; ')}</div>
    <div style="color:#444;font-size:0.68rem">${escHtml(sel.diet)}</div>
    <div style="color:#2e2e2e;font-size:0.65rem">ID: ${sel.id}</div>`;
}

function render() {
  if (G.phase==='animating') return;

  // Toggle collection vs game area
  const showCol=G.showCollection;
  document.getElementById('game-area').hidden=showCol;
  document.getElementById('collection-overlay').hidden=!showCol;

  if (showCol) { renderCollection(); }
  else {
    document.getElementById('viewport').innerHTML=renderViewport();
    renderInventory();
    renderLog();
  }

  // Bottom panel always renders
  if (G.phase==='playing')  renderBottomPlaying();
  if (G.phase==='hatched')  renderBottomHatched();
}

// ================================================================
//  SAVE / LOAD
// ================================================================

function buildSaveData() {
  const chunkData={};
  for (const [key,chunk] of chunks) chunkData[key]=chunk.grid;
  return {
    version:2, worldSeed:WORLD_SEED, selectedFood,
    player:{ x:G.px, y:G.py, inventory:G.inventory },
    egg: G.egg,
    phase: G.phase==='animating'?'playing':G.phase,
    creature: G.creature,
    collection: G.collection,
    chunkData,
    revealed:[...G.revealed],
    log: G.log,
  };
}

function applySaveData(data) {
  animCancelled=true;
  WORLD_SEED=data.worldSeed;
  chunks.clear();
  for (const [key,grid] of Object.entries(data.chunkData||{}))
    chunks.set(key,{grid});
  selectedFood=data.selectedFood||'meat';
  G={
    px:data.player.x, py:data.player.y,
    inventory:data.player.inventory||emptyInv(),
    egg:data.egg||null,
    phase:data.phase||'playing',
    creature:data.creature||null,
    collection:data.collection||[],
    revealed:new Set(data.revealed||[]),
    showCollection:false,
    colSelectedIdx:0,
    animFrames:[], animFrame:0,
    log:data.log||[],
  };
  updateFOV();
}

async function saveGame() {
  const json=JSON.stringify(buildSaveData(),null,2);
  try {
    if (window.showSaveFilePicker) {
      const handle=await window.showSaveFilePicker({
        suggestedName:'egg-dungeon.json',
        types:[{description:'JSON Save File',accept:{'application/json':['.json']}}],
      });
      const w=await handle.createWritable();
      await w.write(json); await w.close();
    } else {
      const a=document.createElement('a');
      a.href='data:application/json;charset=utf-8,'+encodeURIComponent(json);
      a.download='egg-dungeon.json'; a.click();
    }
    addLog('Game saved!');
  } catch(e) { if(e.name!=='AbortError') addLog('Save failed.'); }
  render();
}

async function loadGame() {
  try {
    let text;
    if (window.showOpenFilePicker) {
      const [handle]=await window.showOpenFilePicker({
        types:[{description:'JSON Save File',accept:{'application/json':['.json']}}],
      });
      text=await (await handle.getFile()).text();
    } else {
      text=await new Promise((res,rej)=>{
        const inp=document.getElementById('load-input');
        inp.onchange=async()=>{ const f=inp.files[0]; if(!f)rej(new Error('no file')); res(await f.text()); inp.value=''; };
        inp.click();
      });
    }
    applySaveData(JSON.parse(text));
    addLog('Game loaded!');
    render();
  } catch(e) { if(e.name!=='AbortError'){ addLog('Load failed.'); console.error(e); } }
}

// ================================================================
//  AUTO-SAVE / AUTO-LOAD  (localStorage)
// ================================================================

function autoSave() {
  try { localStorage.setItem('egg-dungeon-save', JSON.stringify(buildSaveData())); } catch(e) {}
}

function autoLoad() {
  try {
    const saved=localStorage.getItem('egg-dungeon-save');
    if (!saved) return false;
    applySaveData(JSON.parse(saved));
    addLog('Welcome back!');
    render();
    return true;
  } catch(e) { return false; }
}

// ================================================================
//  INPUT
// ================================================================

const MOVE_KEYS={
  ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],
  w:[0,-1],s:[0,1],a:[-1,0],d:[1,0],
  W:[0,-1],S:[0,1],A:[-1,0],D:[1,0],
};

document.addEventListener('keydown',e=>{
  if (e.ctrlKey&&e.key==='s') { e.preventDefault(); saveGame(); return; }
  if (e.ctrlKey&&e.key==='o') { e.preventDefault(); loadGame(); return; }
  if (!G) return;
  if (e.key==='c'||e.key==='C') { G.showCollection=!G.showCollection; render(); return; }
  if (G.showCollection) {
    const n=G.collection.length;
    if (e.key==='ArrowUp'||e.key==='w'||e.key==='W') {
      e.preventDefault(); if(n>0){G.colSelectedIdx=Math.max(0,G.colSelectedIdx-1);render();} return;
    }
    if (e.key==='ArrowDown'||e.key==='s'||e.key==='S') {
      e.preventDefault(); if(n>0){G.colSelectedIdx=Math.min(n-1,G.colSelectedIdx+1);render();} return;
    }
    return;
  }
  if (e.key==='r'||e.key==='R') { trySpawnEgg(); return; }
  if (e.key==='f'||e.key==='F') { tryFeed(); return; }
  if (FOOD_KEY_MAP[e.key]) { selectedFood=FOOD_KEY_MAP[e.key]; if(G.phase!=='animating') render(); return; }
  const mv=MOVE_KEYS[e.key];
  if (mv) { e.preventDefault(); tryMove(mv[0],mv[1]); }
});

document.getElementById('col-list').addEventListener('click',e=>{
  const entry=e.target.closest('.col-entry');
  if (entry&&G) { G.colSelectedIdx=parseInt(entry.dataset.idx); render(); }
});

// ================================================================
//  START
// ================================================================

if (!autoLoad()) newGame();
