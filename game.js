'use strict';

// ================================================================
//  EGG DUNGEON
// ================================================================

// ── Version ──────────────────────────────────────────────────────
const VERSION = '1.16';

// ── Patch notes (shown once per version on first load) ───────────
const PATCH_NOTES = {
  '1.13': [
    'Animals now have explicit eyes — every creature blinks',
    'Multi-eyed (mushroom) creatures have 4, 6, or 8 eyes',
    'Egg shakes while waiting to hatch, growing more restless as it fills',
    'Hatched animals occasionally blink and fidget',
    'Collection view: selected creature also blinks and jiggles',
    'Creature art rows are now width-normalised so lines stay aligned',
    'Patch notes added (you are here)',
  ],
  '1.14': [
    'Pre-commit hook now enforces patch notes entry for every version',
  ],
  '1.15': [
    'Sound effects: food pickup, gem pickup, egg hatch jingle',
    'Biome music: each zone has its own looping theme',
    'M key to mute / unmute all audio',
  ],
  '1.16': [
    'Biome music fades out smoothly when crossing into a new zone',
    'Biome music volume reduced',
    'Control hints no longer split across lines',
  ],
};

// ── Config ───────────────────────────────────────────────────────
const VW = 50, VH = 22;
const LIGHT_R      = 6;
const FOOD_NEEDED  = 10;
const MAX_LOG      = 8;
const HUNGER_STEPS = 75;   // steps between hunger events
const GEM_CHAR     = '$';
const GEM_COLOR    = '#80dfff';
const GEM_BOOST    = 1200; // rarity-roll boost per gem fed

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
const FOOD_KEY_MAP = {'1':'meat','2':'fish','3':'berries','4':'mushroom','5':'grain','6':'gem'};

// ── Biomes ───────────────────────────────────────────────────────
const BIOMES = {
  badlands:    { name:'Badlands',    food:'meat',     wallBright:'#7a3a2a', wallDim:'#2e1510', floorBright:'#2e1810', floorDim:'#130a07', accent:'#e05050' },
  wetlands:    { name:'Wetlands',    food:'fish',     wallBright:'#2a4a6a', wallDim:'#101a28', floorBright:'#0e1e2e', floorDim:'#070b12', accent:'#5090e0' },
  forest:      { name:'Forest',      food:'berries',  wallBright:'#2a5a2a', wallDim:'#0e1e0e', floorBright:'#0e1a0e', floorDim:'#060c06', accent:'#d060d0' },
  underground: { name:'Underground', food:'mushroom', wallBright:'#4a2a6a', wallDim:'#1a0e28', floorBright:'#1e0e2e', floorDim:'#0c0712', accent:'#50c080' },
  plains:      { name:'Plains',      food:'grain',    wallBright:'#6a5a2a', wallDim:'#281e0e', floorBright:'#221a08', floorDim:'#0c0b04', accent:'#d0a040' },
};
const BIOME_KEYS = Object.keys(BIOMES);

// ── Cell colours (walls/floors are handled per-biome in renderViewport) ──
const CLR = {
  bright: { '@':'#fff','Θ':'#fff080','%':'#e05050','~':'#5090e0','*':'#d060d0','^':'#50c080',',':'#d0a040','$':'#80dfff' },
  dim:    { '@':'#fff','Θ':'#706020','%':'#601818','~':'#183060','*':'#501850','^':'#185030',',':'#503010','$':'#205060' },
};

// ── Rarity ───────────────────────────────────────────────────────
const RARITIES = [
  { name:'Common',    badge:'[C]', color:'#888',    threshold:6000  },
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

// Biome zones span 3×3 chunks so borders don't flicker every chunk
function getChunkBiome(chunkX, chunkY) {
  const zx = Math.floor(chunkX/3), zy = Math.floor(chunkY/3);
  const h  = djb2(`b${WORLD_SEED},${zx},${zy}`);
  return BIOME_KEYS[h % BIOME_KEYS.length];
}

function generateChunk(cx, cy) {
  const grid = Array.from({length:CH}, ()=>Array(CW).fill('#'));
  const rng  = mulberry32(chunkSeed(cx, cy));
  const biomeKey   = getChunkBiome(cx, cy);
  const biomeFood  = BIOMES[biomeKey].food;
  const biomeFoodCh = FOOD_CHARS.find(c => FOOD_INFO[c].key === biomeFood);

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
    const rmx=rx+Math.floor(rw/2), rmy=ry+Math.floor(rh/2);
    let x=rmx; while(x!==CORR_X){ grid[rmy][x]='.'; x+=CORR_X>x?1:-1; }
    let y=rmy; while(y!==CORR_Y){ grid[y][rmx]='.'; y+=CORR_Y>y?1:-1; }
  }

  // Scatter items on floor tiles
  for (let y=0; y<CH; y++)
    for (let x=0; x<CW; x++) {
      if (grid[y][x] !== '.') continue;
      const r = rng.next();
      if (r < 0.003) {
        grid[y][x] = GEM_CHAR;          // ~0.3% gem
      } else if (r < 0.04) {
        // food: 65% biome type, 35% random
        grid[y][x] = rng.next() < 0.65
          ? biomeFoodCh
          : FOOD_CHARS[rng.int(0, FOOD_CHARS.length)];
      }
    }

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

// Line pools: each type has 10 row-pools with 4+ options.
// generateCreature picks one option per row, giving 4^10 = 1M+ combos per type.
const BODY_PARTS = {
  meat: [
    // row 0 – ears/top
    ["      /\\    /\\      ","     /\\      /\\     ","   _/  \\    /  \\_   ","    ^|        |^    "],
    // row 1 – upper head
    ["     (  \\  //  )    ","    ( _\\    /_ )    ","   (    \\  /    )   ","    ( --\\  /-- )    "],
    // row 2 – face/eyes (exactly 2 lowercase o eyes per option)
    ["    ( >=o:o:=< )    ","   ( >o::::o< )     ","    ( >o---o< )     ","   (  >=o=o=<  )    "],
    // row 3 – muzzle
    ["    /|   ()   |\\    ","   /  ) (  ( )  \\   ","    /|  (oo)  |\\    ","   / |  {  }  | \\   "],
    // row 4 – upper body
    ["   / |  /##\\  | \\   ","  / / |  ##  | \\ \\  ","   / | |####| | \\   ","  /  |  /##\\  |  \\  "],
    // row 5 – mid body
    ["  (  | |####| |  )  "," (  ( |######|  ) ) ","  (  |/######\\|  )  ","  (  ||######||  )  "],
    // row 6 – lower body
    ["   \\ |  \\##/  | /   ","  \\ \\ |  ##  | / /  ","   \\ | \\####/ | /   ","  \\ / |\\##/| / \\   "],
    // row 7 – waist
    ["    \\|         |/   ","   \\  )      (  /   ","     \\         /    ","    \\|  ~~~  |/     "],
    // row 8 – upper legs
    ["     /|  ||  |\\     ","    \\ /| || |\\ /    ","    /|  /||\\  |\\    ","   / |  ||  | \\     "],
    // row 9 – feet
    ["    /_\\__|  |__/\\   ","     V_|    |_V     ","    /__|    |__\\    ","   /___\\  /___\\     "],
  ],
  fish: [
    // row 0 – dorsal fin
    ["         ~~~        ","        ~~~~~       ","       ~~^~~        ","      ~~~ ~~~       "],
    // row 1 – face/eyes (exactly 2 lowercase o eyes per option; . is accent not eye)
    ["   ><(  o   o  )><  ","  ><<( o   o )>>    ","   >>(  .o o.  )<<  ","   ><( o  ~  o )><  "],
    // row 2 – body top
    ["    /~~~~~~~~~~~\\   ","   /~~~~~~~~~~~~~\\  ","    /===========\\   ","   /~ ~ ~ ~ ~ ~ ~\\  "],
    // row 3 – upper body
    ["   | ~~~~~~~~~~~ |  ","  / ~~~~~~~~~~~~~ \\ ","   |=============|  ","   |~ ~ ~ ~ ~ ~ ~|  "],
    // row 4 – mid body
    ["  (  ~~~~~~~~~~~  ) "," ( ~~~~~~~~~~~~~~~) ","  (  ===========  ) ","  ( ~ ~ ~ ~ ~ ~ ~ ) "],
    // row 5 – lower body (narrowing toward tail, distinct from row 3)
    ["   | -~-~-~-~-~- |  ","   \\ ·  ·  ·  · /   ","   |* ~ * ~ * ~ |   ","   |-~-~-~-~-~--|   "],
    // row 6 – body bottom
    ["    \\~~~~~~~~~~~/   ","   \\~~~~~~~~~~~~~/  ","    \\===========/   ","    \\~ ~ ~ ~ ~ ~/   "],
    // row 7 – tail root
    ["     )~~~~~~~~~(    ","    )~~~~~~~~~~~(   ","     )=========(    ","    )~ ~ ~ ~ ~ ~(   "],
    // row 8 – tail body
    ["    /    ~~~    \\   ","   /    ~~~~~    \\  ","    /    ===    \\   ","   /   ~ ~ ~ ~   \\  "],
    // row 9 – tail fins
    ["   ><(         )><  ","    ><(       )><   ","  ><   (     )   >< ","      ~~ ~~~ ~~     "],
  ],
  berries: [
    // row 0 – feather crest
    ["    /\\/\\/\\/\\      ","  /\\/\\  /\\/\\      ","    ^  ^  ^  ^      ","   /\\v    v/\\      "],
    // row 1 – upper head
    ["   /\\/\\/\\/\\/\\     ","  (  \\/\\/  )       ","  ( /\\ /\\ )         ","   ( \\vv/ )         "],
    // row 2 – face (bird: o eyes flank the ^brow/beak; exactly 2 o eyes per option)
    ["    ( o^v^o    )    ","  ( >o^v^o<  )      ","    ( o^.^o    )    ","   ( o^-^o v  )     "],
    // row 3 – neck/wing top
    ["   ~[          ]~   ","  ~=[         ]=~   ","   ~{          }~   ","  =[            ]=  "],
    // row 4 – wing upper
    ["   ~[  =======  ]~  "," ~=[ ======= ]=~    ","   ~[  ~~~~~  ]~    ","  ~[ ========= ]~   "],
    // row 5 – wing lower
    ["   ~[  -------  ]~  "," ~=[ - - - - - ]=~  ","   ~[  v v v v  ]~  ","  ~[ --------- ]~   "],
    // row 6 – body base (narrower/heavier than neck top)
    ["   ~[__________]~   ","  ~=( -------- )=~  ","   ~[  v v v v  ]~  ","  ~={ ~~~~~~~~ }=~  "],
    // row 7 – leg top
    ["    /Y        Y\\    ","   / Y        Y \\   ","    (Y        Y)    ","   / |        | \\   "],
    // row 8 – leg mid
    ["   / |        | \\   ","  /  |        |  \\  ","   (/|        |\\)   ","  ( /|        |\\ )  "],
    // row 9 – talons
    ["  // |        | \\\\  "," /Y  |        |  Y\\ ","  /Y |        | Y\\  "," (\\/ |        | \\/) "],
  ],
  mushroom: [
    // row 0 – cap top
    ["    ..oOOOo..       ","  ...oOOOOo...      ","   ..OOooOO..       ","  ..oOOOOOOo..      "],
    // row 1 – cap curve
    ["   oO        Oo     "," oO          Oo     ","  oO          Oo    "," oOo          oOo   "],
    // row 2 – cap spots/eyes
    ["  ( Oo  OO  oO )    ","( Oo oO  Oo oO )    ","  ( OO  oo  OO )    "," (oO  OO  OO  oO)   "],
    // row 3 – cap face (Multi-eyed: lowercase o only, unaffected by O fill-sub; 4/4/6/8 eyes)
    ["  (o o  (--)  o o)  "," ( o o  ()()  o o ) ","  (o o o ()  o o o) "," (o o o o  o o o o) "],
    // row 4 – gills top
    ["   (            )   "," (              )   ","   (  --------  )   ","  (   ========   )  "],
    // row 5 – body spots
    ["  (oOOOOOOOOOOOo)   ","(  oOOOOOOOOOo  )   ","  ( OOoooOOoooO )   "," (oOoOOOOOoOo)      "],
    // row 6 – gills bottom
    ["   (            )   "," (              )   ","   (  --------  )   ","  (   ~~~~~~~~   )  "],
    // row 7 – stalk upper
    ["   ( |        | )   ","  (  |        |  )  ","  ( | |      | | )  ","   (  \\      /  )   "],
    // row 8 – stalk lower (flares or narrows, distinct from row 7)
    ["     ( |    | )     ","      ||      ||     ","    \\|        |/    ","   (  \\      /  )   "],
    // row 9 – base
    ["   (_/        \\_)   ","  (_//        \\\\_)  ","  (__|        |__)  ","    \\|        |/    "],
  ],
  grain: [
    // row 0 – ear tufts
    ["   /|          |\\   ","  /||          ||\\  "," ~~|            |~~ ","  /| ~~      ~~ |\\  "],
    // row 1 – upper head + eyes (exactly 2 lowercase o eyes per option)
    ["  / | o      o | \\  "," / || o      o || \\ ","  /~| o      o |~\\  "," /  \\ o      o /  \\ "],
    // row 2 – shoulders
    [" (  \\          /  ) ","(   \\          /   )"," ( ~~\\        /~~ ) ","(  ~ \\        / ~  )"],
    // row 3 – arms
    ["   ( u        u )   ","  ( uw        wu )  ","   ( u~       ~u )  ","  ( uu        uu )  "],
    // row 4 – upper body
    ["   {           }    ","   {            }   ","  {               } ","   {~           ~}  "],
    // row 5 – belly
    ["   {  ~~~~~~~  }    ","   {  ~~~~~~~~  }   ","  {   ~~~~~~~   }   ","   {   ~~~~~   }    "],
    // row 6 – lower body (tummy detail, distinct from row 4)
    ["   { ·  ·  ·  · }   ","  {  - - - - - -  } ","   {  ~ · ~ · ~  }  ","   {   ·  ·  ·   }  "],
    // row 7 – hips
    ["    |  |    |  |    ","    \\  |    |  /    ","    |  \\    /  |    ","   |   |    |   |   "],
    // row 8 – legs (distinct from row 7)
    ["   (|  |    |  |)   ","    |~ |    | ~|    ","     \\)|    |(//    ","   | | |    | | |   "],
    // row 9 – feet
    ["   (U)(        )(U) ","     (U)    (U)     ","   (U) (    ) (U)   ","  (UU)(      )(UU)  "],
  ],
};

// After row-pool selection, the dominant texture character is substituted
// with one of several alternatives — adds one more RNG dimension (5 options).
const FILL_SUBS = {
  meat:     { from:'#', to:['#','X','=','+','*'] },
  fish:     { from:'~', to:['~','=','-','*','·'] },
  berries:  { from:'=', to:['=','-','+','*','·'] },
  mushroom: { from:'O', to:['O','0','@','*','+'] },
  grain:    { from:'~', to:['~','=','-','^','·'] },
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

// Reverse of TRAIT_NAMES — used to recover dom/sec from old save data that predates
// storing dom/sec directly on the creature.
const TRAIT_TO_FOOD = Object.fromEntries(
  Object.entries(TRAIT_NAMES).map(([k,v]) => [v,k])
);

// Regenerate creature.lines from its hash + dom/sec.
// Mirrors the art-generation portion of generateCreature exactly.
// Safe to call on old saves: falls back to TRAIT_TO_FOOD when dom isn't stored.
function regenLines(c) {
  const dom = c.dom ?? TRAIT_TO_FOOD[c.traits?.[0]];
  if (!dom || !BODY_PARTS[dom]) return;
  const sec = c.sec ?? TRAIT_TO_FOOD[c.traits?.[1]] ?? null;

  const rng   = mulberry32(c.hashVal);
  const lines = BODY_PARTS[dom].map(rowPool => rng.pick(rowPool));

  const fillSub = FILL_SUBS[dom];
  const fillCh  = rng.pick(fillSub.to);
  if (fillCh !== fillSub.from)
    for (let i=0; i<lines.length; i++) lines[i] = lines[i].split(fillSub.from).join(fillCh);

  if (sec && sec !== dom) {
    switch(sec) {
      case 'mushroom': lines[2]=lines[2].replace('.','O').replace('()','(O)'); break;
      case 'berries':  { const l=lines[4].trim(); lines[4]='~'+l.padEnd(18)+'~'; break; }
      case 'fish':     lines[0]='         ~~~        '; break;
      case 'meat':     lines[9]=lines[9].replace(/\(([A-Za-z])/g,'/($1'); break;
      case 'grain':    lines[6]=lines[6].replace(/[-=|]/g,'~'); break;
    }
  }

  if (c.rarity?.name === 'Legendary') lines[0] = '   * * * * * * *   ';
  c.lines = centerLines(lines);
}

// Normalize a creature's lines so they all share the same width.
// Center-pads shorter lines with spaces so rows stay aligned when
// the display element uses text-align:center.
function centerLines(lines) {
  const w = Math.max(...lines.map(l => l.length));
  return lines.map(l => {
    const pad = w - l.length;
    if (!pad) return l;
    return ' '.repeat(Math.floor(pad/2)) + l + ' '.repeat(Math.ceil(pad/2));
  });
}

function rankFoods(inv) {
  return Object.entries(inv)
    .filter(([k,v])=>v>0 && FOOD_KEYS.includes(k))
    .sort(([,a],[,b])=>b-a).map(([k])=>k);
}

// All creature properties deterministically derived from hash.
// Biome of the egg's home chunk gives a +3 bonus to its food type.
function generateCreature(egg) {
  const { foodSequence, rarityRoll, inv, biome } = egg;
  const hashStr = foodSequence.join(',') + ':' + rarityRoll;
  const hashVal = djb2(hashStr);
  const rng     = mulberry32(hashVal);
  const rarity  = getRarity(rarityRoll);

  // Apply biome influence: biome food gets a small bonus count
  const invB = {...inv};
  if (biome && BIOMES[biome]) invB[BIOMES[biome].food] = (invB[BIOMES[biome].food]||0) + 3;
  const ranked  = rankFoods(invB);
  const dom     = ranked[0] ?? rng.pick(FOOD_KEYS);
  const sec     = ranked[1] ?? null;

  const lines = BODY_PARTS[dom].map(rowPool => rng.pick(rowPool));

  // Character-level texture substitution
  const fillSub = FILL_SUBS[dom];
  const fillCh  = rng.pick(fillSub.to);
  if (fillCh !== fillSub.from)
    for (let i=0; i<lines.length; i++) lines[i] = lines[i].split(fillSub.from).join(fillCh);

  if (sec && sec !== dom) {
    switch(sec) {
      case 'mushroom': lines[2]=lines[2].replace('.','O').replace('()','(O)'); break;
      case 'berries':  { const l=lines[4].trim(); lines[4]='~'+l.padEnd(18)+'~'; break; }
      case 'fish':     lines[0]='         ~~~        '; break;
      case 'meat':     lines[9]=lines[9].replace(/\(([A-Za-z])/g,'/($1'); break;
      case 'grain':    lines[6]=lines[6].replace(/[-=|]/g,'~'); break;
    }
  }

  if (rarity.name==='Legendary') lines[0]='   * * * * * * *   ';
  const centeredLines = centerLines(lines);

  const np  = NAME_POOLS[dom];
  const pre = np.pre[Math.floor(rng.next()*np.pre.length)];
  const suf = sec ? NAME_POOLS[sec].suf[Math.floor(rng.next()*NAME_POOLS[sec].suf.length)]
                  : np.suf[Math.floor(rng.next()*np.suf.length)];
  const title = TITLE_POOLS[dom][Math.floor(rng.next()*TITLE_POOLS[dom].length)];
  const name  = cap(pre+suf)+' '+title;

  let color = CREATURE_COLOR[dom];
  if (rarity.name==='Legendary')     color='#f0d040';
  else if (rarity.name==='Rare')     color=lerpColor(color,'#88aaff',0.35);
  else if (rarity.name==='Uncommon') color=lerpColor(color,'#aaffaa',0.15);

  const traits = rankFoods(inv).map(k=>TRAIT_NAMES[k]);
  const diet   = Object.entries(inv).filter(([k,v])=>v>0&&FOOD_KEYS.includes(k)).map(([k,v])=>`${v}x ${k}`).join(', ');
  const id     = toID(hashVal);

  return { id, hashVal, hashStr, name, color, rarity, lines: centeredLines, traits, diet, dom, sec };
}

// ================================================================
//  GAME STATE
// ================================================================

let G             = null;
let animCancelled = false;
let selectedFood  = 'meat';   // persists across eggs

// ── Idle animations ───────────────────────────────────────────────
let idleGen            = 0;   // incremented on hard renders; in-flight frames bail when stale
let eggShakeTimer      = null;
let creatureBlinkTimer = null;
let creatureJiggleTimer= null;
let colIdleGen         = 0;   // separate counter for collection-panel animations
let colBlinkTimer      = null;
let colJiggleTimer     = null;

// Which row index holds the face/eyes for each food type
// grain eyes are in row 1 (upper head); all others as before
const EYE_ROW = { meat:2, fish:1, berries:2, mushroom:3, grain:1 };
// Eyes are always lowercase o; blink closes them to -

function stopIdleAnims() {
  idleGen++;
  clearTimeout(eggShakeTimer);
  clearTimeout(creatureBlinkTimer);
  clearTimeout(creatureJiggleTimer);
  eggShakeTimer = creatureBlinkTimer = creatureJiggleTimer = null;
}

function stopColAnims() {
  colIdleGen++;
  clearTimeout(colBlinkTimer);
  clearTimeout(colJiggleTimer);
  colBlinkTimer = colJiggleTimer = null;
}

// Returns the creature currently selected in the collection panel.
function getColSelected() {
  const {collection} = G;
  if (!collection?.length) return null;
  const order = {'Legendary':0,'Rare':1,'Uncommon':2,'Common':3};
  const sorted = [...collection].sort((a,b) =>
    (order[a.rarity.name]??9)-(order[b.rarity.name]??9)||a.name.localeCompare(b.name));
  return sorted[Math.max(0, Math.min(G.colSelectedIdx, sorted.length-1))];
}

// Shift every line in an art array laterally by dx chars (±1 for wobble)
function shiftArt(lines, dx) {
  if (!dx) return lines;
  return lines.map(l =>
    dx > 0 ? ' '.repeat(dx) + l.slice(0, l.length - dx)
           : l.slice(-dx) + ' '.repeat(-dx)
  );
}

function triggerEggShake() {
  eggShakeTimer = null;
  if (G?.phase !== 'playing' || !G.egg) return;
  const stage = EGG_STAGES[getEggStage(G.egg.fed)];
  const gen   = ++idleGen;
  // Wobble: right → centre → left → centre → right → centre
  const offsets = [1, 0, -1, 0, 1, 0];
  let fi = 0;
  (function nextFrame() {
    if (idleGen !== gen) return;
    document.getElementById('egg-display').innerHTML =
      shiftArt(stage.art, offsets[fi])
        .map(l => `<span style="color:${stage.color}">${escHtml(l)}</span>`).join('\n');
    if (++fi < offsets.length) setTimeout(nextFrame, 70);
  })();
  // Frequency scales with how fed the egg is (gets more restless)
  const delay = Math.max(400, 2200 - G.egg.fed * 180);
  eggShakeTimer = setTimeout(triggerEggShake, delay);
}

function triggerCreatureBlink() {
  creatureBlinkTimer = null;
  if (G?.phase !== 'hatched' || !G.creature) return;
  const c  = G.creature;
  const ri = EYE_ROW[c.dom] ?? 2;
  const orig   = c.lines[ri];
  const closed = orig.replace(/o/g, '-');
  if (closed === orig) {
    creatureBlinkTimer = setTimeout(triggerCreatureBlink, 3000);
    return;
  }
  const gen     = ++idleGen;
  const blinked = [...c.lines];
  blinked[ri]   = closed;
  document.getElementById('egg-display').innerHTML =
    blinked.map(l => `<span style="color:${c.color}">${escHtml(l)}</span>`).join('\n');
  setTimeout(() => {
    if (idleGen !== gen) return;
    document.getElementById('egg-display').innerHTML =
      c.lines.map(l => `<span style="color:${c.color}">${escHtml(l)}</span>`).join('\n');
    creatureBlinkTimer = setTimeout(triggerCreatureBlink, 2500 + rand(0, 2000));
  }, 180);
}

function triggerCreatureJiggle() {
  creatureJiggleTimer = null;
  if (G?.phase !== 'hatched' || !G.creature) return;
  const c   = G.creature;
  const gen = ++idleGen;
  const offsets = [1, 0, -1, 0];
  let fi = 0;
  (function nextFrame() {
    if (idleGen !== gen) return;
    document.getElementById('egg-display').innerHTML =
      shiftArt(c.lines, offsets[fi])
        .map(l => `<span style="color:${c.color}">${escHtml(l)}</span>`).join('\n');
    if (++fi < offsets.length) setTimeout(nextFrame, 70);
  })();
  creatureJiggleTimer = setTimeout(triggerCreatureJiggle, 6000 + rand(0, 8000));
}

function triggerColBlink() {
  colBlinkTimer = null;
  if (!G?.showCollection) return;
  const c = getColSelected();
  if (!c) return;
  const ri     = EYE_ROW[c.dom] ?? 2;
  const orig   = c.lines[ri];
  const closed = orig.replace(/o/g, '-');
  if (closed === orig) {
    colBlinkTimer = setTimeout(triggerColBlink, 3000);
    return;
  }
  const gen     = ++colIdleGen;
  const blinked = [...c.lines];
  blinked[ri]   = closed;
  document.getElementById('col-art').innerHTML =
    blinked.map(l => `<span style="color:${c.color}">${escHtml(l)}</span>`).join('\n');
  setTimeout(() => {
    if (colIdleGen !== gen) return;
    document.getElementById('col-art').innerHTML =
      c.lines.map(l => `<span style="color:${c.color}">${escHtml(l)}</span>`).join('\n');
    colBlinkTimer = setTimeout(triggerColBlink, 2500 + rand(0, 2000));
  }, 180);
}

function triggerColJiggle() {
  colJiggleTimer = null;
  if (!G?.showCollection) return;
  const c = getColSelected();
  if (!c) return;
  const gen     = ++colIdleGen;
  const offsets = [1, 0, -1, 0];
  let fi = 0;
  (function nextFrame() {
    if (colIdleGen !== gen) return;
    document.getElementById('col-art').innerHTML =
      shiftArt(c.lines, offsets[fi])
        .map(l => `<span style="color:${c.color}">${escHtml(l)}</span>`).join('\n');
    if (++fi < offsets.length) setTimeout(nextFrame, 70);
  })();
  colJiggleTimer = setTimeout(triggerColJiggle, 6000 + rand(0, 8000));
}

// ================================================================
//  AUDIO
// ================================================================

let audioCtx   = null;
let masterGain = null;
let biomeGain  = null;   // gain bus for the current biome loop
let muted      = false;
let biomeLoopId  = 0;
let activeBiome  = null;

// MIDI note number → Hz
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

// Biome music: each entry has bpm, oscillator wave, volume, and a note sequence
// Notes are [midi, durationInBeats]
const BIOME_MUSIC = {
  badlands:    { bpm:100, wave:'sawtooth', vol:0.04, notes:[
    [50,1.5],[53,0.5],[57,1  ],[60,1  ],
    [57,0.5],[55,0.5],[53,1  ],
    [50,0.5],[58,0.5],[57,1  ],
    [55,0.5],[53,0.5],[50,2  ],
  ]},
  wetlands:    { bpm: 75, wave:'sine',     vol:0.05, notes:[
    [57,1  ],[60,0.5],[64,0.5],[67,1  ],
    [66,0.5],[64,0.5],[62,1  ],
    [60,0.5],[59,0.5],[57,2  ],
  ]},
  forest:      { bpm:120, wave:'triangle', vol:0.05, notes:[
    [60,0.5],[64,0.5],[67,0.5],[69,0.5],
    [67,0.5],[64,0.5],[62,0.5],[60,0.5],
    [64,0.5],[67,1  ],[69,0.5],
    [67,0.5],[64,0.5],[60,0.5],[62,0.5],[60,1],
  ]},
  underground: { bpm: 55, wave:'square',   vol:0.03, notes:[
    [57,2  ],[58,1  ],[55,2  ],
    [57,1  ],[53,1.5],[52,0.5],[50,2  ],
  ]},
  plains:      { bpm: 90, wave:'triangle', vol:0.05, notes:[
    [67,0.5],[69,0.5],[71,1  ],
    [67,0.5],[64,0.5],[62,1  ],
    [60,0.5],[62,0.5],[64,0.5],[67,0.5],
    [69,1  ],[67,1  ],
  ]},
};

function ensureAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(midi, startTime, duration, waveType, peak, ctx, outNode) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = waveType;
  osc.frequency.value = midiHz(midi);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + 0.01);
  gain.gain.setValueAtTime(peak, startTime + duration * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(outNode ?? masterGain);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function startBiomeLoop(biomeKey) {
  if (biomeKey === activeBiome) return;
  const ctx = ensureAudio();
  if (!ctx) return;

  // Fade out the old biome bus so in-flight notes don't linger
  if (biomeGain) {
    const old = biomeGain;
    old.gain.cancelScheduledValues(ctx.currentTime);
    old.gain.setTargetAtTime(0, ctx.currentTime, 0.15); // ~0.45 s to silence
    setTimeout(() => { try { old.disconnect(); } catch(_) {} }, 900);
    biomeGain = null;
  }

  activeBiome = biomeKey;
  biomeLoopId++;
  const myId  = biomeLoopId;
  const music = BIOME_MUSIC[biomeKey];
  if (!music) return;

  // New gain bus for new biome, fade in gently
  const newBus = ctx.createGain();
  newBus.gain.setValueAtTime(0, ctx.currentTime);
  newBus.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
  newBus.connect(masterGain);
  biomeGain = newBus;
  const myBus = newBus;

  function schedule(startTime) {
    if (biomeLoopId !== myId) return;
    const ctx  = ensureAudio();
    if (!ctx) return;
    const beat = 60 / music.bpm;
    let   t    = startTime;
    let   totalDur = 0;
    for (const [midi, beats] of music.notes) {
      const dur = beats * beat;
      playTone(midi, t, dur * 0.88, music.wave, music.vol, ctx, myBus);
      t        += dur;
      totalDur += dur;
    }
    const delay = (startTime + totalDur - ctx.currentTime) * 1000 - 300;
    setTimeout(() => schedule(startTime + totalDur), Math.max(0, delay));
  }

  schedule(ctx.currentTime + 0.05);
}

function sfxPickup() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t   = ctx.currentTime;
  [[76,0.06],[79,0.06],[83,0.1]].forEach(([m,d],i) => {
    playTone(m, t + i * 0.055, d, 'square', 0.12, ctx);
  });
}

function sfxGem() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t   = ctx.currentTime;
  [69,73,76,81].forEach((m,i) => {
    playTone(m, t + i * 0.065, 0.1 + i * 0.02, 'triangle', 0.13, ctx);
  });
  playTone(88, t + 0.26, 0.4, 'sine', 0.07, ctx);
}

function sfxHatch() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t   = ctx.currentTime;
  const seq = [[60,0.08],[64,0.08],[67,0.08],[72,0.28]];
  let time  = t;
  seq.forEach(([m,d]) => { playTone(m, time, d, 'triangle', 0.15, ctx); time += d + 0.01; });
  // add a brief harmony chord at the final note
  playTone(64, t + 0.25, 0.32, 'triangle', 0.08, ctx);
  playTone(67, t + 0.25, 0.32, 'triangle', 0.08, ctx);
}

function toggleMute() {
  muted = !muted;
  if (masterGain) {
    masterGain.gain.setTargetAtTime(muted ? 0 : 1, audioCtx.currentTime, 0.05);
  }
  const ctrl = document.getElementById('controls');
  if (muted) ctrl.dataset.muted = '1';
  else       delete ctrl.dataset.muted;
  renderControls();
}

function renderControls() {
  const base = 'WASD:&nbsp;move &nbsp;·&nbsp; 1-6:&nbsp;select &nbsp;·&nbsp; F:&nbsp;feed &nbsp;·&nbsp; R:&nbsp;lay&nbsp;egg &nbsp;·&nbsp; C:&nbsp;collection &nbsp;·&nbsp; M:&nbsp;mute &nbsp;·&nbsp; Ctrl+S/O:&nbsp;save/load';
  const mTag = muted ? ' &nbsp;<span style="color:#e05050">[MUTED]</span>' : '';
  document.getElementById('controls').innerHTML = base + mTag;
}

// ================================================================
//  INVENTORY
// ================================================================

function emptyInv() { return {meat:0,fish:0,berries:0,mushroom:0,grain:0,gem:0}; }

function newGame() {
  animCancelled = true;
  stopIdleAnims();
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
      biome:        getChunkBiome(cx(eggX), cy(eggY)),
    },
    phase:          'playing',
    creature:       null,
    collection:     [],
    revealed:       new Set(),
    showCollection: false,
    colSelectedIdx: 0,
    steps:          0,
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
  if (G.egg && nx===G.egg.x && ny===G.egg.y) return;

  G.px=nx; G.py=ny;
  G.steps++;

  const tile=getTile(nx,ny);
  if (tile === GEM_CHAR) {
    G.inventory.gem++;
    setTile(nx,ny,'.');
    addLog('Found a gem! Feed it to the egg (key 6, then F).');
    sfxGem();
  } else {
    const info=FOOD_INFO[tile];
    if (info) {
      G.inventory[info.key]++;
      setTile(nx,ny,'.');
      addLog(`Picked up ${info.name}!`);
      sfxPickup();
    }
  }

  // Hunger: periodically consume a random food item
  if (G.steps % HUNGER_STEPS === 0) {
    const available = FOOD_KEYS.filter(k => G.inventory[k] > 0);
    if (available.length > 0) {
      const k = available[Math.floor(Math.random() * available.length)];
      G.inventory[k]--;
      addLog(`Hungry! You ate some ${k}.`);
    }
  }

  updateFOV();
  render();
}

function tryFeed() {
  if (G.phase==='animating') return;
  if (!G.egg) { addLog('No egg to feed! Press R in a room.'); render(); return; }
  const dist=Math.abs(G.px-G.egg.x)+Math.abs(G.py-G.egg.y);
  if (dist>1) { addLog('Move adjacent to the Egg (Θ) to feed it.'); render(); return; }
  if (G.egg.fed >= FOOD_NEEDED) return;
  const key=selectedFood;

  // Gem: boost rarity roll instead of feeding
  if (key === 'gem') {
    if (G.inventory.gem === 0) { addLog('No gems! Find $ in the dungeon.'); render(); return; }
    G.inventory.gem--;
    G.egg.rarityRoll = Math.min(9999, G.egg.rarityRoll + GEM_BOOST);
    addLog(`Fed a gem! Rarity boosted to ${getRarity(G.egg.rarityRoll).name}.`);
    render();
    return;
  }

  if (G.inventory[key]===0) { addLog(`No ${key} in inventory! (select 1-5)`); render(); return; }
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
  if (!isRoomTile(G.px,G.py)) { addLog('You must be in a room to lay an egg.'); render(); return; }

  // Must not be adjacent to any hallway tile (would risk blocking paths)
  const nearHallway = [[0,-1],[0,1],[-1,0],[1,0]].some(([ddx,ddy])=>{
    const nx=G.px+ddx, ny=G.py+ddy;
    return isWalkable(nx,ny) && !isRoomTile(nx,ny);
  });
  if (nearHallway) { addLog('Too close to a hallway. Move deeper into the room.'); render(); return; }

  const candidates=[[0,-1],[0,1],[-1,0],[1,0]]
    .filter(([ddx,ddy])=>getTile(G.px+ddx,G.py+ddy)==='.');
  if (candidates.length===0) { addLog('No empty space adjacent to lay an egg!'); render(); return; }

  const [ddx,ddy]=candidates[rand(0,candidates.length)];
  const biomeKey = getChunkBiome(cx(G.px), cy(G.py));
  G.egg={
    x:G.px+ddx, y:G.py+ddy,
    foodSequence:[], rarityRoll:rand(0,10000),
    inv:emptyInv(), fed:0,
    biome: biomeKey,
  };
  G.phase    ='playing';
  G.creature =null;
  addLog(`Egg laid! [${BIOMES[biomeKey].name}]`);
  autoSave();
  render();
  eggShakeTimer = setTimeout(triggerEggShake, 1500);
}

function startHatch() {
  stopIdleAnims();
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
    setTimeout(()=>{ if(!animCancelled){G.phase='hatched';sfxHatch();render();creatureBlinkTimer=setTimeout(triggerCreatureBlink,2500);creatureJiggleTimer=setTimeout(triggerCreatureJiggle,6000+rand(0,8000));} }, 400);
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
      const biome=BIOMES[getChunkBiome(cx(gx),cy(gy))];
      let color;
      if      (ch==='#') color=inLight?biome.wallBright:biome.wallDim;
      else if (ch==='.') color=inLight?biome.floorBright:biome.floorDim;
      else { const t=inLight?CLR.bright:CLR.dim; color=t[ch]||(inLight?'#aaa':'#333'); }
      html+=span(ch, color);
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
    const clr=count>0?color:'#555';
    const bg=sel?'background:#151515;':'';
    html+=`<div style="color:${clr};${bg}">${sel?'►':' '}${idx+1} ${ch} ${key.padEnd(8)} x${count}</div>`;
  });
  // Gems
  const gc=G.inventory.gem||0;
  const gs=selectedFood==='gem';
  html+=`<div style="color:${gc>0?GEM_COLOR:'#555'};${gs?'background:#151515;':''}">${gs?'►':' '}6 ${GEM_CHAR} gem      x${gc}</div>`;
  document.getElementById('inv-list').innerHTML=html;
}

function renderLog() {
  const el=document.getElementById('log');
  el.innerHTML=G.log.map(m=>`<div class="log-line">&gt; ${escHtml(m)}</div>`).join('');
  el.scrollTop=el.scrollHeight;
}

// ── Egg direction ─────────────────────────────────────────────────
function eggDirection() {
  if (!G.egg) return null;
  const dx=G.egg.x-G.px, dy=G.egg.y-G.py;
  const dist=Math.round(Math.hypot(dx,dy));
  if (dist===0) return {arrow:'·',dist};
  const shifted=(Math.atan2(dy,dx)+2*Math.PI)%(2*Math.PI);
  const sector=Math.round(shifted/(Math.PI/4))%8;
  return {arrow:['→','↘','↓','↙','←','↖','↑','↗'][sector],dist};
}

function renderWorldPanel() {
  const biomeKey=getChunkBiome(cx(G.px),cy(G.py));
  const biome=BIOMES[biomeKey];
  document.getElementById('world-biome').innerHTML=
    `<span style="color:${biome.accent}">◈ ${biome.name}</span>`;
  startBiomeLoop(biomeKey);
  const dir=eggDirection();
  document.getElementById('world-egg').textContent=
    dir ? `${dir.arrow} Egg ${dir.dist}m` : 'no egg';
}

function renderBottomPlaying() {
  idleGen++;
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

  const isGem=selectedFood==='gem';
  const selCh=isGem?null:FOOD_CHARS.find(c=>FOOD_INFO[c].key===selectedFood);
  const selClr=isGem?GEM_COLOR:(selCh?FOOD_INFO[selCh].color:'#888');
  const selLabel=isGem?`${GEM_CHAR} gem`:`${selCh} ${selectedFood}`;
  const selAmt=isGem?G.inventory.gem:G.inventory[selectedFood];

  const dist=Math.abs(G.px-G.egg.x)+Math.abs(G.py-G.egg.y);
  const feedMsg=dist===1?(isGem?'Press F to boost rarity!':'Press F to feed!'):'';

  const eggBiome=G.egg.biome?BIOMES[G.egg.biome]:null;
  const biomeLabel=eggBiome
    ?`<span style="color:${eggBiome.accent};font-size:.72rem">◈ ${eggBiome.name} egg</span> `:'';

  const currRarity=getRarity(G.egg.rarityRoll);

  document.getElementById('egg-info').innerHTML=`
    <div id="egg-bar"><span style="color:${barClr}">${bar}</span></div>
    <div id="egg-fed-count">${G.egg.fed} / ${FOOD_NEEDED} fed &nbsp;<span style="color:${currRarity.color}">${currRarity.badge}</span></div>
    <div style="margin-top:3px;font-size:.78rem;color:#6a6a6a">
      Selected: <span style="color:${selClr}">${selLabel}</span> &nbsp;(x${selAmt})
    </div>
    <div style="margin-top:2px">${biomeLabel}</div>
    <div id="feed-hint">${feedMsg}</div>`;
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
  idleGen++;
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
      '<div style="color:#5a5a5a;padding:12px 0;text-align:center">No creatures hatched yet.</div>';
    document.getElementById('col-art').innerHTML='';
    document.getElementById('col-detail-info').innerHTML=
      '<div style="color:#5a5a5a;font-size:0.8rem">Hatch an egg to fill your collection.</div>';
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

  colIdleGen++;   // cancel any in-flight col animation
  document.getElementById('col-art').innerHTML=
    sel.lines.map(l=>`<span style="color:${sel.color}">${escHtml(l)}</span>`).join('\n');
  if (!colBlinkTimer)  colBlinkTimer  = setTimeout(triggerColBlink,  2500 + rand(0, 2000));
  if (!colJiggleTimer) colJiggleTimer = setTimeout(triggerColJiggle, 6000 + rand(0, 8000));

  document.getElementById('col-detail-info').innerHTML=`
    <div style="color:${sel.color};font-size:0.85rem">&ldquo;${escHtml(sel.name)}&rdquo;</div>
    <div style="color:${sel.rarity.color};font-size:0.75rem">${sel.rarity.badge} ${sel.rarity.name}</div>
    <div style="color:#7a7a7a;font-size:0.72rem">${sel.traits.join(' &middot; ')}</div>
    <div style="color:#606060;font-size:0.68rem">${escHtml(sel.diet)}</div>
    <div style="color:#555;font-size:0.65rem">ID: ${sel.id}</div>`;
}

function render() {
  if (G.phase==='animating') return;

  const showCol=G.showCollection;
  document.getElementById('game-area').hidden=showCol;
  document.getElementById('collection-overlay').hidden=!showCol;

  if (showCol) { renderCollection(); }
  else {
    document.getElementById('viewport').innerHTML=renderViewport();
    renderInventory();
    renderWorldPanel();
    renderLog();
  }

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
    version:3, worldSeed:WORLD_SEED, selectedFood,
    player:{ x:G.px, y:G.py, inventory:G.inventory },
    egg: G.egg,
    phase: G.phase==='animating'?'playing':G.phase,
    creature: G.creature,
    collection: G.collection.map(({lines:_,...c})=>c),
    chunkData,
    revealed:[...G.revealed],
    log: G.log,
    steps: G.steps,
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
    inventory:{...emptyInv(),...(data.player.inventory||{})},
    egg:data.egg||null,
    phase:data.phase||'playing',
    creature:data.creature||null,
    collection:data.collection||[],
    revealed:new Set(data.revealed||[]),
    showCollection:false,
    colSelectedIdx:0,
    steps:data.steps||0,
    animFrames:[], animFrame:0,
    log:data.log||[],
  };
  // Regenerate art from hash so collection always reflects latest generation code
  G.collection.forEach(regenLines);
  if (G.creature) regenLines(G.creature);
  updateFOV();
  if (G.phase==='playing' && G.egg) eggShakeTimer = setTimeout(triggerEggShake, 1500);
  if (G.phase==='hatched' && G.creature) {
    creatureBlinkTimer  = setTimeout(triggerCreatureBlink,  2500);
    creatureJiggleTimer = setTimeout(triggerCreatureJiggle, 6000 + rand(0, 8000));
  }
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
  if (e.key==='m'||e.key==='M') { toggleMute(); return; }
  if (!G) return;
  if (e.key==='c'||e.key==='C') {
    G.showCollection=!G.showCollection;
    if (!G.showCollection) stopColAnims();
    render(); return;
  }
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
//  PATCH NOTES
// ================================================================

function checkPatchNotes() {
  const SEEN_KEY = 'egg-dungeon-patch-seen';
  if (localStorage.getItem(SEEN_KEY) === VERSION) return;
  const notes = PATCH_NOTES[VERSION];
  if (!notes) return;

  document.getElementById('patch-version').textContent = 'v' + VERSION;
  document.getElementById('patch-notes-list').innerHTML =
    notes.map(n => `<div class="patch-note">${escHtml(n)}</div>`).join('');
  document.getElementById('patch-overlay').removeAttribute('hidden');

  function dismiss(e) {
    e.stopPropagation();   // prevent keystroke from reaching game handlers
    document.getElementById('patch-overlay').setAttribute('hidden', '');
    localStorage.setItem(SEEN_KEY, VERSION);
    document.removeEventListener('keydown', dismiss, true);
    document.getElementById('patch-overlay').removeEventListener('click', dismiss);
  }
  document.addEventListener('keydown', dismiss, true);   // capture so game never sees it
  document.getElementById('patch-overlay').addEventListener('click', dismiss);
}

// ================================================================
//  START
// ================================================================

document.getElementById('version').textContent = 'v' + VERSION;
renderControls();
if (!autoLoad()) newGame();
checkPatchNotes();
