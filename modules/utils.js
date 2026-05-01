// Pure constants and utility functions shared across all modules.
// No side effects, no DOM access, no mutable state.

export const VERSION = '1.23';

export const PATCH_NOTES = {
  '1.13': [
    'Animals now have explicit eyes — every creature blinks',
    'Multi-eyed (mushroom) creatures have 4, 6, or 8 eyes',
    'Egg shakes while waiting to hatch, growing more restless as it fills',
    'Hatched animals occasionally blink and fidget',
    'Collection view: selected creature also blinks and jiggles',
    'Creature art rows are now width-normalised so lines stay aligned',
    'Patch notes added (you are here)',
  ],
  '1.14': ['Pre-commit hook now enforces patch notes entry for every version'],
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
  '1.17': ['Fixed: blink animation stopped working after the first keypress'],
  '1.18': [
    'Codebase refactored into ES modules (no gameplay changes)',
    'Unit tests added for world generation, creature creation, and utilities',
    'ESLint and Prettier added for code consistency',
    'Conventional commit messages now enforced',
  ],
  '1.19': ['Fixed: fish and grain creatures from old saves never blinked'],
  '1.20': ['Feedback form added — press ? to send a bug report or suggestion'],
  '1.21': ['Feedback form now connected to live server'],
  '1.22': ['Fixed: game keys no longer fire while the feedback form is open'],
  '1.23': [
    'Eggs now spawn naturally in the world — no more laying your own',
    'Multiple eggs exist at once; feed whichever one you\'re standing next to',
    'Chests added (■): stand adjacent and press E to attempt a lockpick minigame',
    'Successful lockpick yields food and 3 gems',
    'Shiny creatures: 1 in 1000 eggs hatches with a cycling rainbow colour',
    'Gems now boost rarity to a random value in the next tier (more variance)',
    'Legendary eggs can no longer receive gems',
    'Food and gems no longer spawn in hallways',
    'Mute preference now saves and restores across sessions',
    'Badlands and underground music reworked',
    'Fixed: feedback form Submit button returned after resubmitting',
  ],
  '1.24': [
    'Great Beasts: five ancient creatures now roam the world — Dragon, Kraken, Griffon, Manticore, and Demon',
    'Approach a Great Beast and offer 25 gems to wake it, then sacrifice 5 creatures to summon its egg',
    'Great Beast eggs hatch into legendary companions with unique silhouettes, animations, and sound',
    'Mouse controls: compass arrows (↑←→↓) for movement, click inventory to select food',
    'Toolbar added at the top right: quick buttons for Collection, Mute, Save, Load, and Feedback',
    'All key interactions clickable — feed hints, interact prompts, beast overlay actions, and collection controls',
    'Missing a chest lockpick now destroys the chest — one attempt only',
  ],
};

// Viewport dimensions
export const VW = 50;
export const VH = 22;

// Game config
export const LIGHT_R = 6;
export const FOOD_NEEDED = 10;
export const MAX_LOG = 8;
export const HUNGER_STEPS = 75;
export const GEM_CHAR = '$';
export const GEM_COLOR = '#80dfff';
export const CHEST_CHAR = '■';
export const DRAGON_GEM_COST = 25;
export const DRAGON_CREATURE_COST = 5;

export const BEAST_REGISTRY = {
  dragon: {
    char: 'Ω',
    colorBright: '#ff6020', colorDim: '#601808',
    biome: 'badlands', spawnRate: 20,
    awakenColor: '#ff8040',
    title: 'Ancient Dragon',
    overlayTitle: 'Ω  ANCIENT DRAGON',
    dormantFlavor: 'The dragon lies dormant, scales flickering with dying embers...',
    dormantFlavColor: '#888',
    awakenFlavor: 'The dragon stirs, ancient eyes regarding you with hunger.',
    awakenFlavColor: '#ff8040',
    eggLabel: 'Dragon Egg',
    dissolveClr1: '#ff6020', dissolveClr2: '#993010',
    flashClr1: '#ff8040',   flashClr2: '#cc2010',
    eggClr: '#8b2500',
    dissolveLog: 'The dragon dissolves into embers! A Dragon Egg remains...',
    dissolveArtKey: 'embers',
  },
  kraken: {
    char: 'Ψ',
    colorBright: '#40c0ff', colorDim: '#0a3050',
    biome: 'wetlands', spawnRate: 20,
    awakenColor: '#40c0ff',
    title: 'Ancient Kraken',
    overlayTitle: 'Ψ  ANCIENT KRAKEN',
    dormantFlavor: 'The kraken lies dormant, tentacles drifting in the cold dark...',
    dormantFlavColor: '#888',
    awakenFlavor: 'The kraken stirs, vast eyes regarding you from the depths.',
    awakenFlavColor: '#40c0ff',
    eggLabel: 'Kraken Egg',
    dissolveClr1: '#40c0ff', dissolveClr2: '#104060',
    flashClr1: '#40e0ff',   flashClr2: '#1080b0',
    eggClr: '#0a2a40',
    dissolveLog: 'The kraken sinks into the deep! A Kraken Egg bobs to the surface...',
    dissolveArtKey: 'splash',
  },
  griffon: {
    char: 'Λ',
    colorBright: '#d4b020', colorDim: '#503808',
    biome: 'forest', spawnRate: 20,
    awakenColor: '#f0c820',
    title: 'Ancient Griffon',
    overlayTitle: 'Λ  ANCIENT GRIFFON',
    dormantFlavor: 'The griffon slumbers, great wings folded, eyes half-closed...',
    dormantFlavColor: '#888',
    awakenFlavor: 'The griffon raises its proud head, keen eyes fixing upon you.',
    awakenFlavColor: '#f0c820',
    eggLabel: 'Griffon Egg',
    dissolveClr1: '#e0c040', dissolveClr2: '#705010',
    flashClr1: '#f0d020',   flashClr2: '#c09018',
    eggClr: '#1a3010',
    dissolveLog: 'The griffon fades into golden light! A Griffon Egg drifts down...',
    dissolveArtKey: 'feathers',
  },
  manticore: {
    char: 'Ξ',
    colorBright: '#c87828', colorDim: '#4a2c0a',
    biome: 'plains', spawnRate: 20,
    awakenColor: '#e89030',
    title: 'Ancient Manticore',
    overlayTitle: 'Ξ  ANCIENT MANTICORE',
    dormantFlavor: 'The manticore lies coiled, tail arched overhead, eyes half-closed...',
    dormantFlavColor: '#888',
    awakenFlavor: 'The manticore raises its terrible head, stinger gleaming with venom.',
    awakenFlavColor: '#e89030',
    eggLabel: 'Manticore Egg',
    dissolveClr1: '#c87828', dissolveClr2: '#4a2c0a',
    flashClr1: '#e89030',   flashClr2: '#a05010',
    eggClr: '#5a3010',
    dissolveLog: 'The manticore dissolves into golden dust! A Manticore Egg settles in the sand...',
    dissolveArtKey: 'dust',
  },
  demon: {
    char: 'Δ',
    colorBright: '#9030d0', colorDim: '#280850',
    biome: 'underground', spawnRate: 20,
    awakenColor: '#c040e0',
    title: 'Ancient Demon',
    overlayTitle: 'Δ  ANCIENT DEMON',
    dormantFlavor: 'The demon lies dormant, wings folded, emanating cold dread from the dark...',
    dormantFlavColor: '#888',
    awakenFlavor: 'The demon unfurls its great wings, violet eyes blazing with malice.',
    awakenFlavColor: '#c040e0',
    eggLabel: 'Demon Egg',
    dissolveClr1: '#9030d0', dissolveClr2: '#280850',
    flashClr1: '#c040e0',   flashClr2: '#6020a0',
    eggClr: '#180438',
    dissolveLog: 'The demon dissolves into shadow! A Demon Egg pulses in the darkness...',
    dissolveArtKey: 'shadow',
  },
};

export const BEAST_TYPES = Object.keys(BEAST_REGISTRY);

// Named char constants derived from registry (kept for import compatibility)
export const DRAGON_CHAR    = BEAST_REGISTRY.dragon.char;
export const KRAKEN_CHAR    = BEAST_REGISTRY.kraken.char;
export const GRIFFON_CHAR   = BEAST_REGISTRY.griffon.char;
export const MANTICORE_CHAR = BEAST_REGISTRY.manticore.char;
export const DEMON_CHAR     = BEAST_REGISTRY.demon.char;

// Chunk dimensions & corridor positions (guaranteed connectivity)
export const CW = 26;
export const CH = 16;
export const CORR_X = 12;
export const CORR_Y = 7;

export const FOOD_INFO = {
  '%': { name: 'Meat', key: 'meat', color: '#e05050' },
  '~': { name: 'Fish', key: 'fish', color: '#5090e0' },
  '*': { name: 'Berries', key: 'berries', color: '#d060d0' },
  '^': { name: 'Mushroom', key: 'mushroom', color: '#50c080' },
  ',': { name: 'Grain', key: 'grain', color: '#d0a040' },
};
export const FOOD_CHARS = Object.keys(FOOD_INFO);
export const FOOD_KEYS = ['meat', 'fish', 'berries', 'mushroom', 'grain'];
export const FOOD_KEY_MAP = {
  '1': 'meat', '2': 'fish', '3': 'berries', '4': 'mushroom', '5': 'grain', '6': 'gem',
};

export const BIOMES = {
  badlands:    { name:'Badlands',    food:'meat',     wallBright:'#7a3a2a', wallDim:'#2e1510', floorBright:'#2e1810', floorDim:'#130a07', accent:'#e05050' },
  wetlands:    { name:'Wetlands',    food:'fish',     wallBright:'#2a4a6a', wallDim:'#101a28', floorBright:'#0e1e2e', floorDim:'#070b12', accent:'#5090e0' },
  forest:      { name:'Forest',      food:'berries',  wallBright:'#2a5a2a', wallDim:'#0e1e0e', floorBright:'#0e1a0e', floorDim:'#060c06', accent:'#d060d0' },
  underground: { name:'Underground', food:'mushroom', wallBright:'#4a2a6a', wallDim:'#1a0e28', floorBright:'#1e0e2e', floorDim:'#0c0712', accent:'#50c080' },
  plains:      { name:'Plains',      food:'grain',    wallBright:'#6a5a2a', wallDim:'#281e0e', floorBright:'#221a08', floorDim:'#0c0b04', accent:'#d0a040' },
};
export const BIOME_KEYS = Object.keys(BIOMES);

export const GREAT_BEAST_BIOMES = Object.fromEntries(
  Object.entries(BEAST_REGISTRY).map(([type, def]) => [def.biome, { beastType: type, spawnRate: def.spawnRate }])
);

export const CLR = {
  bright: { '@':'#fff','Θ':'#fff080','%':'#e05050','~':'#5090e0','*':'#d060d0','^':'#50c080',',':'#d0a040','$':'#80dfff','■':'#c8a020',
    ...Object.fromEntries(Object.values(BEAST_REGISTRY).map(b => [b.char, b.colorBright])) },
  dim:    { '@':'#fff','Θ':'#706020','%':'#601818','~':'#183060','*':'#501850','^':'#185030',',':'#503010','$':'#205060','■':'#5a3a08',
    ...Object.fromEntries(Object.values(BEAST_REGISTRY).map(b => [b.char, b.colorDim])) },
};

export const RARITIES = [
  { name: 'Common',    badge: '[C]', color: '#888',    threshold: 6000  },
  { name: 'Uncommon',  badge: '[U]', color: '#50c050', threshold: 8500  },
  { name: 'Rare',      badge: '[R]', color: '#5090e0', threshold: 9700  },
  { name: 'Legendary', badge: '[L]', color: '#f0c030', threshold: 10001 },
];
export const getRarity = roll => RARITIES.find(r => roll < r.threshold) ?? RARITIES.at(-1);

export const emptyInv = () => ({ meat: 0, fish: 0, berries: 0, mushroom: 0, grain: 0, gem: 0 });

export const rand = (a, b) => Math.floor(Math.random() * (b - a)) + a;
export const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function mulberry32(seed) {
  let s = seed >>> 0;
  return {
    next() {
      s += 0x6D2B79F5; s |= 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    },
    int(a, b) { return Math.floor(this.next() * (b - a)) + a; },
    pick(arr) { return arr[this.int(0, arr.length)]; },
  };
}

export const hexDim = (hex, f) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const fh = v => Math.round(v * f).toString(16).padStart(2, '0');
  return `#${fh(r)}${fh(g)}${fh(b)}`;
};

export function lerpColor(c1, c2, t) {
  const p = h => parseInt(h, 16);
  const [r1, g1, b1] = [p(c1.slice(1, 3)), p(c1.slice(3, 5)), p(c1.slice(5, 7))];
  const [r2, g2, b2] = [p(c2.slice(1, 3)), p(c2.slice(3, 5)), p(c2.slice(5, 7))];
  const fh = v => Math.round(v).toString(16).padStart(2, '0');
  return `#${fh(r1 + (r2 - r1) * t)}${fh(g1 + (g2 - g1) * t)}${fh(b1 + (b2 - b1) * t)}`;
}

export const toID = n => (n >>> 0).toString(36).toUpperCase().padStart(7, '0');
