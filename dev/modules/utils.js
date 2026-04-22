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
export const DRAGON_CHAR = 'Ω';
export const KRAKEN_CHAR = 'Ψ';
export const GRIFFON_CHAR = 'Λ';
export const DRAGON_GEM_COST = 25;
export const DRAGON_CREATURE_COST = 5;

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

export const GREAT_BEAST_BIOMES = {
  badlands: { beastType: 'dragon',  spawnRate: 20 },
  wetlands: { beastType: 'kraken',  spawnRate: 20 },
  forest:   { beastType: 'griffon', spawnRate: 20 },
};

export const CLR = {
  bright: { '@':'#fff','Θ':'#fff080','%':'#e05050','~':'#5090e0','*':'#d060d0','^':'#50c080',',':'#d0a040','$':'#80dfff','■':'#c8a020','Ω':'#ff6020','Ψ':'#40c0ff','Λ':'#d4b020' },
  dim:    { '@':'#fff','Θ':'#706020','%':'#601818','~':'#183060','*':'#501850','^':'#185030',',':'#503010','$':'#205060','■':'#5a3a08','Ω':'#601808','Ψ':'#0a3050','Λ':'#503808' },
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
