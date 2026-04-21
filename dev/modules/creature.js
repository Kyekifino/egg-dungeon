// Creature generation (fully deterministic from hash), art constants,
// egg visual stages, and hatch animation sequence.

import { BIOMES, FOOD_KEYS, getRarity, djb2, mulberry32, cap, toID, hexDim, lerpColor } from './utils.js';

// ── Egg visual stages (10 lines, matches creature art height) ────────
export const EGG_STAGES = [
  { color: '#a09028', art: [
    '              ', '   ________   ', '  /        \\  ', ' |          | ',
    ' |          | ', ' |          | ', '  \\________/  ', '              ', '              ', '              '] },
  { color: '#d0a820', art: [
    '              ', '   ________   ', '  / ·  · · \\  ', ' | · ·  ·   | ',
    ' |  · · ·   | ', ' | ·  · · · | ', '  \\________/  ', '              ', '              ', '              '] },
  { color: '#e08810', art: [
    '              ', '   ___v____   ', '  /   |    \\  ', ' | v  |     | ',
    ' |    v     | ', ' |    |  v  | ', '  \\___v____/  ', '              ', '              ', '              '] },
  { color: '#e05800', art: [
    '      *       ', '   __/\\_____  ', '  /v  \\ v   \\ ', ' |  /\\ \\   v| ',
    ' | /  \\/\\   | ', ' |/   / \\v  | ', '  \\/\\_/  \\_/  ', '      *       ', '              ', '              '] },
  { color: '#ffffff', art: [
    '    *   *     ', '  *_________* ', ' */ · * · · \\*', ' |* · · * · *|',
    '*|· * · · * ·|*', ' |* · * · · *|', ' *\\· · * · /*', '  *_________* ', '    *   *     ', '              '] },
];

export const getEggStage = fed => fed >= 10 ? 4 : fed >= 7 ? 3 : fed >= 4 ? 2 : fed >= 1 ? 1 : 0;

// ── Hatch animation frames ──────────────────────────────────────────
const ANIM_CRACK1 = [
  '    *   *     ', '  *__v_v___*  ', ' */ · v · · \\*', ' |· v · · · | ',
  '*|· · v · · |*', ' |· · · v · | ', ' *\\· · v · /* ', '  *___v____*  ', '    *   *     ', '              '];
const ANIM_CRACK2 = [
  '  *   *   *   ', '  _/\\*_/\\___  ', ' /  \\*/  \\  \\ ', '|*  /\\*   |  |',
  '| */  \\*  |  |', '|*   /  \\*|  |', ' \\*/    \\*/  /', '  *___*___*   ', '  *   *   *   ', '              '];
const ANIM_BURST = [
  ' *  * * * *   ', '* * * * * * * ', ' * * * * * *  ', '* * * * * * * ',
  ' * * * * * *  ', '* * * * * * * ', ' * * * * * *  ', '* * * * * * * ', ' *  * * * *   ', '              '];

export function buildAnimSeq(creature) {
  const s4 = EGG_STAGES[4].art;
  return [
    { lines: s4,             color: '#ffffff',                   delay: 320 },
    { lines: s4,             color: '#ffff88',                   delay: 200 },
    { lines: ANIM_CRACK1,    color: '#ffaa00',                   delay: 180 },
    { lines: ANIM_CRACK2,    color: '#ff6600',                   delay: 150 },
    { lines: ANIM_BURST,     color: '#ffffff',                   delay: 130 },
    { lines: ANIM_BURST,     color: '#ffcc88',                   delay: 100 },
    { lines: creature.lines, color: hexDim(creature.color, 0.22), delay: 220 },
    { lines: creature.lines, color: hexDim(creature.color, 0.50), delay: 200 },
    { lines: creature.lines, color: hexDim(creature.color, 0.80), delay: 260 },
    { lines: creature.lines, color: creature.color,              delay: 0   },
  ];
}

// ── Body part pools ─────────────────────────────────────────────────
// 10 row-pools × 4+ options per food type → 4^10 = 1M+ combos per type.
export const BODY_PARTS = {
  meat: [
    ['      /\\    /\\      ', '     /\\      /\\     ', '   _/  \\    /  \\_   ', '    ^|        |^    '],
    ['     (  \\  //  )    ', '    ( _\\    /_ )    ', '   (    \\  /    )   ', '    ( --\\  /-- )    '],
    ['    ( >=o:o:=< )    ', '   ( >o::::o< )     ', '    ( >o---o< )     ', '   (  >=o=o=<  )    '],
    ['    /|   ()   |\\    ', '   /  ) (  ( )  \\   ', '    /|  (oo)  |\\    ', '   / |  {  }  | \\   '],
    ['   / |  /##\\  | \\   ', '  / / |  ##  | \\ \\  ', '   / | |####| | \\   ', '  /  |  /##\\  |  \\  '],
    ['  (  | |####| |  )  ', ' (  ( |######|  ) ) ', '  (  |/######\\|  )  ', '  (  ||######||  )  '],
    ['   \\ |  \\##/  | /   ', '  \\ \\ |  ##  | / /  ', '   \\ | \\####/ | /   ', '  \\ / |\\##/| / \\   '],
    ['    \\|         |/   ', '   \\  )      (  /   ', '     \\         /    ', '    \\|  ~~~  |/     '],
    ['     /|  ||  |\\     ', '    \\ /| || |\\ /    ', '    /|  /||\\  |\\    ', '   / |  ||  | \\     '],
    ['    /_\\__|  |__/\\   ', '     V_|    |_V     ', '    /__|    |__\\    ', '   /___\\  /___\\     '],
  ],
  fish: [
    ['         ~~~        ', '        ~~~~~       ', '       ~~^~~        ', '      ~~~ ~~~       '],
    ['   ><(  o   o  )><  ', '  ><<( o   o )>>    ', '   >>(  .o o.  )<<  ', '   ><( o  ~  o )><  '],
    ['    /~~~~~~~~~~~\\   ', '   /~~~~~~~~~~~~~\\  ', '    /===========\\   ', '   /~ ~ ~ ~ ~ ~ ~\\  '],
    ['   | ~~~~~~~~~~~ |  ', '  / ~~~~~~~~~~~~~ \\ ', '   |=============|  ', '   |~ ~ ~ ~ ~ ~ ~|  '],
    ['  (  ~~~~~~~~~~~  ) ', ' ( ~~~~~~~~~~~~~~~) ', '  (  ===========  ) ', '  ( ~ ~ ~ ~ ~ ~ ~ ) '],
    ['   | -~-~-~-~-~- |  ', '   \\ ·  ·  ·  · /   ', '   |* ~ * ~ * ~ |   ', '   |-~-~-~-~-~--|   '],
    ['    \\~~~~~~~~~~~/   ', '   \\~~~~~~~~~~~~~/  ', '    \\===========/   ', '    \\~ ~ ~ ~ ~ ~/   '],
    ['     )~~~~~~~~~(    ', '    )~~~~~~~~~~~(   ', '     )=========(    ', '    )~ ~ ~ ~ ~ ~(   '],
    ['    /    ~~~    \\   ', '   /    ~~~~~    \\  ', '    /    ===    \\   ', '   /   ~ ~ ~ ~   \\  '],
    ['   ><(         )><  ', '    ><(       )><   ', '  ><   (     )   >< ', '      ~~ ~~~ ~~     '],
  ],
  berries: [
    ['    /\\/\\/\\/\\      ', '  /\\/\\  /\\/\\      ', '    ^  ^  ^  ^      ', '   /\\v    v/\\      '],
    ['   /\\/\\/\\/\\/\\     ', '  (  \\/\\/  )       ', '  ( /\\ /\\ )         ', '   ( \\vv/ )         '],
    ['    ( o^v^o    )    ', '  ( >o^v^o<  )      ', '    ( o^.^o    )    ', '   ( o^-^o v  )     '],
    ['   ~[          ]~   ', '  ~=[         ]=~   ', '   ~{          }~   ', '  =[            ]=  '],
    ['   ~[  =======  ]~  ', ' ~=[ ======= ]=~    ', '   ~[  ~~~~~  ]~    ', '  ~[ ========= ]~   '],
    ['   ~[  -------  ]~  ', ' ~=[ - - - - - ]=~  ', '   ~[  v v v v  ]~  ', '  ~[ --------- ]~   '],
    ['   ~[__________]~   ', '  ~=( -------- )=~  ', '   ~[  v v v v  ]~  ', '  ~={ ~~~~~~~~ }=~  '],
    ['    /Y        Y\\    ', '   / Y        Y \\   ', '    (Y        Y)    ', '   / |        | \\   '],
    ['   / |        | \\   ', '  /  |        |  \\  ', '   (/|        |\\)   ', '  ( /|        |\\ )  '],
    ['  // |        | \\\\  ', ' /Y  |        |  Y\\ ', '  /Y |        | Y\\  ', ' (\\/ |        | \\/) '],
  ],
  mushroom: [
    ['    ..oOOOo..       ', '  ...oOOOOo...      ', '   ..OOooOO..       ', '  ..oOOOOOOo..      '],
    ['   oO        Oo     ', ' oO          Oo     ', '  oO          Oo    ', ' oOo          oOo   '],
    ['  ( Oo  OO  oO )    ', '( Oo oO  Oo oO )    ', '  ( OO  oo  OO )    ', ' (oO  OO  OO  oO)   '],
    ['  (o o  (--)  o o)  ', ' ( o o  ()()  o o ) ', '  (o o o ()  o o o) ', ' (o o o o  o o o o) '],
    ['   (            )   ', ' (              )   ', '   (  --------  )   ', '  (   ========   )  '],
    ['  (oOOOOOOOOOOOo)   ', '(  oOOOOOOOOOo  )   ', '  ( OOoooOOoooO )   ', ' (oOoOOOOOoOo)      '],
    ['   (            )   ', ' (              )   ', '   (  --------  )   ', '  (   ~~~~~~~~   )  '],
    ['   ( |        | )   ', '  (  |        |  )  ', '  ( | |      | | )  ', '   (  \\      /  )   '],
    ['     ( |    | )     ', '      ||      ||     ', '    \\|        |/    ', '   (  \\      /  )   '],
    ['   (_/        \\_)   ', '  (_//        \\\\_)  ', '  (__|        |__)  ', '    \\|        |/    '],
  ],
  grain: [
    ['   /|          |\\   ', '  /||          ||\\  ', ' ~~|            |~~ ', '  /| ~~      ~~ |\\  '],
    ['  / | o      o | \\  ', ' / || o      o || \\ ', '  /~| o      o |~\\  ', ' /  \\ o      o /  \\ '],
    [' (  \\          /  ) ', '(   \\          /   )', ' ( ~~\\        /~~ ) ', '(  ~ \\        / ~  )'],
    ['   ( u        u )   ', '  ( uw        wu )  ', '   ( u~       ~u )  ', '  ( uu        uu )  '],
    ['   {           }    ', '   {            }   ', '  {               } ', '   {~           ~}  '],
    ['   {  ~~~~~~~  }    ', '   {  ~~~~~~~~  }   ', '  {   ~~~~~~~   }   ', '   {   ~~~~~   }    '],
    ['   { ·  ·  ·  · }   ', '  {  - - - - - -  } ', '   {  ~ · ~ · ~  }  ', '   {   ·  ·  ·   }  '],
    ['    |  |    |  |    ', '    \\  |    |  /    ', '    |  \\    /  |    ', '   |   |    |   |   '],
    ['   (|  |    |  |)   ', '    |~ |    | ~|    ', '     \\)|    |(//    ', '   | | |    | | |   '],
    ['   (U)(        )(U) ', '     (U)    (U)     ', '   (U) (    ) (U)   ', '  (UU)(      )(UU)  '],
  ],
};

// After row-pool selection, the dominant texture character is substituted.
export const FILL_SUBS = {
  meat:     { from: '#', to: ['#', 'X', '=', '+', '*'] },
  fish:     { from: '~', to: ['~', '=', '-', '*', '·'] },
  berries:  { from: '=', to: ['=', '-', '+', '*', '·'] },
  mushroom: { from: 'O', to: ['O', '0', '@', '*', '+'] },
  grain:    { from: '~', to: ['~', '=', '-', '^', '·'] },
};

export const CREATURE_COLOR = {
  meat: '#e05050', fish: '#5090e0', berries: '#d060d0', mushroom: '#50c080', grain: '#d0a040',
};

export const NAME_POOLS = {
  meat:     { pre: ['Fang','Claw','Blood','Iron','Snarl','Gore','Rend','Bone','Dire','Grim'],
              suf: ['claw','fang','jaw','bite','rend','crush','slash','gnaw','maw','tear'] },
  fish:     { pre: ['Scale','Fin','Wave','Tide','Depth','Brine','Coral','Drift','Foam','Ebb'],
              suf: ['fin','scale','gill','drift','slick','eel','wake','surge','kelp','lure'] },
  berries:  { pre: ['Wing','Sky','Crest','Dawn','Bright','Ember','Plume','Gale','Wisp','Zeph'],
              suf: ['wing','feather','beak','song','gust','ash','crest','flare','soar','talon'] },
  mushroom: { pre: ['Spore','Gloom','Shade','Murk','Glow','Dread','Pall','Veil','Mist','Blight'],
              suf: ['spore','cap','stalk','eye','mold','void','rot','shade','bloom','pore'] },
  grain:    { pre: ['Fluff','Meadow','Downy','Plump','Soft','Round','Wool','Burr','Tuft','Mote'],
              suf: ['ear','tuft','seed','puff','hay','mane','fluff','bristle','brush','wisp'] },
};

export const TITLE_POOLS = {
  meat:     ['the Fierce','the Relentless','the Savage','the Hungry','the Feral','the Bloodthirsty','the Ruthless','the Fearsome','the Merciless','the Wrathful'],
  fish:     ['the Swift','the Deep','the Slippery','the Silent','the Ancient','the Unfathomed','the Abyssal','the Tidal','the Murky','the Lurking'],
  berries:  ['the Radiant','the Free','the Wandering','the Bright','the Blazing','the Soaring','the Brilliant','the Vivid','the Luminous','the Untamed'],
  mushroom: ['the Eerie','the Ancient','the Strange','the Watchful','the Dreaming','the Unknowable','the Cryptic','the Eldritch','the Lurking','the Hollow'],
  grain:    ['the Fluffy','the Gentle','the Round','the Warm','the Plump','the Cozy','the Soft','the Jolly','the Bountiful','the Drowsy'],
};

export const TRAIT_NAMES = {
  meat: 'Carnivore', fish: 'Aquatic', berries: 'Aerial', mushroom: 'Multi-eyed', grain: 'Fluffy',
};

// Which row index holds the face/eyes for each food type
export const EYE_ROW = { meat: 2, fish: 1, berries: 2, mushroom: 3, grain: 1 };

// Reverse map used to recover dom/sec from old saves that predate storing those fields directly
const TRAIT_TO_FOOD = Object.fromEntries(Object.entries(TRAIT_NAMES).map(([k, v]) => [v, k]));

// Normalize lines to a shared width so rows stay aligned.
export function centerLines(lines) {
  const w = Math.max(...lines.map(l => l.length));
  return lines.map(l => {
    const pad = w - l.length;
    if (!pad) return l;
    return ' '.repeat(Math.floor(pad / 2)) + l + ' '.repeat(Math.ceil(pad / 2));
  });
}

export function rankFoods(inv) {
  return Object.entries(inv)
    .filter(([k, v]) => v > 0 && FOOD_KEYS.includes(k))
    .sort(([, a], [, b]) => b - a)
    .map(([k]) => k);
}

// Regenerate creature.lines from its hash + dom/sec.
// Mirrors the art-generation portion of generateCreature exactly.
// Safe to call on old saves: falls back to TRAIT_TO_FOOD when dom isn't stored.
export function regenLines(c) {
  const dom = c.dom ?? TRAIT_TO_FOOD[c.traits?.[0]];
  if (!dom || !BODY_PARTS[dom]) return;
  c.dom = dom;
  const sec = c.sec ?? TRAIT_TO_FOOD[c.traits?.[1]] ?? null;
  c.sec = sec;

  const rng = mulberry32(c.hashVal);
  const lines = BODY_PARTS[dom].map(rowPool => rng.pick(rowPool));

  const fillSub = FILL_SUBS[dom];
  const fillCh = rng.pick(fillSub.to);
  if (fillCh !== fillSub.from)
    for (let i = 0; i < lines.length; i++) lines[i] = lines[i].split(fillSub.from).join(fillCh);

  if (sec && sec !== dom) {
    switch (sec) {
      case 'mushroom': lines[2] = lines[2].replace('.', 'O').replace('()', '(O)'); break;
      case 'berries':  { const l = lines[4].trim(); lines[4] = '~' + l.padEnd(18) + '~'; break; }
      case 'fish':     lines[0] = '         ~~~        '; break;
      case 'meat':     lines[9] = lines[9].replace(/\(([A-Za-z])/g, '/($1'); break;
      case 'grain':    lines[6] = lines[6].replace(/[-=|]/g, '~'); break;
    }
  }

  if (c.rarity?.name === 'Legendary') lines[0] = '   * * * * * * *   ';
  c.lines = centerLines(lines);
}

// ── Dragon body part pools ───────────────────────────────────────────
// 14 rows × 4 options, ~24 chars wide. Hash selects one option per row.
export const DRAGON_BODY_PARTS = [
  // Row 0: horns / crown
  [
    '        /\\   /\\        ',
    '       /|\\ /|\\         ',
    '      /\\  * *  /\\      ',
    '         ^^^  ^^^       ',
  ],
  // Row 1: head dome
  [
    '       ( ===== )        ',
    '      (( ===== ))       ',
    '       { ===== }        ',
    '      [  =====  ]       ',
  ],
  // Row 2: eyes  (EYE_ROW = 2 — blink swaps o → -)
  [
    '      ( o     o )       ',
    '     (  o     o  )      ',
    '      ( o~~   o )       ',
    '      (  o   o  )       ',
  ],
  // Row 3: snout / maw
  [
    '      ( >=---=< )       ',
    '      ( >=====< )       ',
    '     (  >-----<  )      ',
    '      ( >~~~~~< )       ',
  ],
  // Row 4: neck
  [
    '       \\  ===  /        ',
    '       /  ===  \\        ',
    '      (   ===   )       ',
    '       |  ===  |        ',
  ],
  // Row 5: upper wing attachment
  [
    '  *\\   |=========| /*   ',
    '  /\\   |=========| /\\   ',
    '   *   |=========|   *  ',
    '  \\*   |=========|  */  ',
  ],
  // Row 6: wings spread
  [
    ' *  \\  |=========|  / * ',
    '*    \\ |=========| /   *',
    ' *  (  |=========|  ) * ',
    '*    ( |=========| )   *',
  ],
  // Row 7: upper body
  [
    '    ( \\|=========|/ )   ',
    '     \\ |=========| /    ',
    '    (   |=========|   ) ',
    '    ( \\ |=========| /)  ',
  ],
  // Row 8: body
  [
    '     ( |=========| )    ',
    '      \\|=========|/     ',
    '     (||=========||)    ',
    '      ( ========= )     ',
  ],
  // Row 9: lower body
  [
    '      ||=========||     ',
    '      |{=========}|     ',
    '     /||=========||\\ ',
    '     ( |=========| )    ',
  ],
  // Row 10: hips / haunches
  [
    '     /|  =======  |\\    ',
    '    / |  =======  | \\   ',
    '    ( |  =======  | )   ',
    '     \\|  =======  |/    ',
  ],
  // Row 11: upper legs
  [
    '   (/ \\           / \\)  ',
    '   (|  \\         /  |)  ',
    '  ( |  |         |  | ) ',
    '   (|  \\         /  |)  ',
  ],
  // Row 12: lower legs
  [
    '  (|   |         |   |) ',
    '   |   |         |   |  ',
    '  /|   \\         /   |\\ ',
    ' ( |   |         |   | )',
  ],
  // Row 13: claws / feet
  [
    ' (_)  (_)       (_)  (_)',
    '  V    V         V    V ',
    ' (U) (V)         (V) (U)',
    '  \\_/  \\_/     \\_/  \\_/ ',
  ],
];

export const DRAGON_FILL_SUBS = { from: '=', to: ['=', '#', '~', 'X', '+'] };

export const DRAGON_NAME_POOLS = {
  pre: ['Ignis','Pyrax','Cinder','Embyr','Scorx','Flare','Grimm','Slag','Forge','Crag','Sear','Brax','Char','Blaze','Infern','Pyral'],
  suf: ['wyrm','scale','fang','claw','wing','fire','blaze','scorch','brand','char','smelt','drake','bane','ash','coal','forge'],
};

export const DRAGON_TITLE_POOLS = [
  'the Ancient', 'the Burning', 'the Eternal', 'the Vast', 'the Terrible',
  'the Undying', 'the Merciless', 'the Colossus', 'the Scorching', 'the Boundless',
  'the Primordial', 'the Infernal', 'the Desolate', 'the Smoldering', 'the Ravenous', 'the Immortal',
];

export const DRAGON_BASE_COLOR = '#e06020';

// All dragon properties deterministically derived from hash.
// Hash mixes sacrificed creature IDs + food sequence + rarity roll.
export function generateDragon(dragonEgg) {
  const { foodSequence, rarityRoll, sacrificedCreatures } = dragonEgg;
  const sacrificedIds = (sacrificedCreatures || []).map(c => c.id).sort();
  const hashStr = sacrificedIds.join(',') + ':' + foodSequence.join(',') + ':' + rarityRoll;
  const hashVal = djb2(hashStr);
  const rng = mulberry32(hashVal);
  const rarity = getRarity(rarityRoll);

  const lines = DRAGON_BODY_PARTS.map(rowPool => rng.pick(rowPool));

  const fillCh = rng.pick(DRAGON_FILL_SUBS.to);
  if (fillCh !== DRAGON_FILL_SUBS.from)
    for (let i = 0; i < lines.length; i++)
      lines[i] = lines[i].split(DRAGON_FILL_SUBS.from).join(fillCh);

  if (rarity.name === 'Legendary') lines[0] = '  * * * * * * * * *  ';
  const centeredLines = centerLines(lines);

  const pre = DRAGON_NAME_POOLS.pre[Math.floor(rng.next() * DRAGON_NAME_POOLS.pre.length)];
  const suf = DRAGON_NAME_POOLS.suf[Math.floor(rng.next() * DRAGON_NAME_POOLS.suf.length)];
  const title = DRAGON_TITLE_POOLS[Math.floor(rng.next() * DRAGON_TITLE_POOLS.length)];
  const name = cap(pre + suf) + ' ' + title;

  let color = DRAGON_BASE_COLOR;
  if (rarity.name === 'Legendary')     color = '#f0c030';
  else if (rarity.name === 'Rare')     color = lerpColor(color, '#8888ff', 0.35);
  else if (rarity.name === 'Uncommon') color = lerpColor(color, '#ffaa44', 0.30);

  const diet = foodSequence.length
    ? Object.entries(foodSequence.reduce((a, k) => { a[k] = (a[k] || 0) + 1; return a; }, {}))
        .map(([k, v]) => `${v}x ${k}`).join(', ')
    : 'none';

  const id = toID(hashVal);
  const shiny = rng.int(0, 1000) === 0;

  return {
    id, hashVal, hashStr, name, color, rarity, lines: centeredLines,
    diet, dom: null, sec: null, shiny,
    isGreatBeast: true, beastType: 'dragon',
    sacrificedCreatureIds: sacrificedIds,
    traits: ['Great Beast'],
  };
}

export function regenDragonLines(d) {
  const rng = mulberry32(d.hashVal);
  const lines = DRAGON_BODY_PARTS.map(rowPool => rng.pick(rowPool));
  const fillCh = rng.pick(DRAGON_FILL_SUBS.to);
  if (fillCh !== DRAGON_FILL_SUBS.from)
    for (let i = 0; i < lines.length; i++)
      lines[i] = lines[i].split(DRAGON_FILL_SUBS.from).join(fillCh);
  if (d.rarity?.name === 'Legendary') lines[0] = '  * * * * * * * * *  ';
  d.lines = centerLines(lines);
}

export function buildDragonAnimSeq(dragon) {
  const pad = Array(4).fill('              ');
  const s4ext     = [...EGG_STAGES[4].art, ...pad];
  const crack1ext = [...ANIM_CRACK1,        ...pad];
  const crack2ext = [...ANIM_CRACK2,        ...pad];
  const burstExt  = [...ANIM_BURST,         ...pad];
  return [
    { lines: s4ext,          color: '#ffffff',                    delay: 320 },
    { lines: s4ext,          color: '#ffff88',                    delay: 200 },
    { lines: crack1ext,      color: '#ffaa00',                    delay: 180 },
    { lines: crack2ext,      color: '#ff6600',                    delay: 150 },
    { lines: burstExt,       color: '#ffffff',                    delay: 130 },
    { lines: burstExt,       color: '#ffcc88',                    delay: 100 },
    { lines: dragon.lines,   color: hexDim(dragon.color, 0.22),  delay: 220 },
    { lines: dragon.lines,   color: hexDim(dragon.color, 0.50),  delay: 200 },
    { lines: dragon.lines,   color: hexDim(dragon.color, 0.80),  delay: 260 },
    { lines: dragon.lines,   color: dragon.color,                delay: 0   },
  ];
}

// Dispatcher — extend with new beastType cases as new Great Beasts are added.
export function generateGreatBeast(egg) {
  switch (egg.beastType) {
    case 'dragon': return generateDragon(egg);
    default:       return generateDragon(egg);
  }
}

export function regenGreatBeastLines(b) {
  switch (b.beastType) {
    case 'dragon': regenDragonLines(b); break;
    default:       regenDragonLines(b);
  }
}

// All creature properties deterministically derived from hash.
// Biome of the egg's home chunk gives a +3 bonus to its food type.
export function generateCreature(egg) {
  const { foodSequence, rarityRoll, inv, biome } = egg;
  const hashStr = foodSequence.join(',') + ':' + rarityRoll;
  const hashVal = djb2(hashStr);
  const rng = mulberry32(hashVal);
  const rarity = getRarity(rarityRoll);

  const invB = { ...inv };
  if (biome && BIOMES[biome]) invB[BIOMES[biome].food] = (invB[BIOMES[biome].food] || 0) + 3;
  const ranked = rankFoods(invB);
  const dom = ranked[0] ?? rng.pick(FOOD_KEYS);
  const sec = ranked[1] ?? null;

  const lines = BODY_PARTS[dom].map(rowPool => rng.pick(rowPool));

  const fillSub = FILL_SUBS[dom];
  const fillCh = rng.pick(fillSub.to);
  if (fillCh !== fillSub.from)
    for (let i = 0; i < lines.length; i++) lines[i] = lines[i].split(fillSub.from).join(fillCh);

  if (sec && sec !== dom) {
    switch (sec) {
      case 'mushroom': lines[2] = lines[2].replace('.', 'O').replace('()', '(O)'); break;
      case 'berries':  { const l = lines[4].trim(); lines[4] = '~' + l.padEnd(18) + '~'; break; }
      case 'fish':     lines[0] = '         ~~~        '; break;
      case 'meat':     lines[9] = lines[9].replace(/\(([A-Za-z])/g, '/($1'); break;
      case 'grain':    lines[6] = lines[6].replace(/[-=|]/g, '~'); break;
    }
  }

  if (rarity.name === 'Legendary') lines[0] = '   * * * * * * *   ';
  const centeredLines = centerLines(lines);

  const np = NAME_POOLS[dom];
  const pre = np.pre[Math.floor(rng.next() * np.pre.length)];
  const suf = sec
    ? NAME_POOLS[sec].suf[Math.floor(rng.next() * NAME_POOLS[sec].suf.length)]
    : np.suf[Math.floor(rng.next() * np.suf.length)];
  const title = TITLE_POOLS[dom][Math.floor(rng.next() * TITLE_POOLS[dom].length)];
  const name = cap(pre + suf) + ' ' + title;

  let color = CREATURE_COLOR[dom];
  if (rarity.name === 'Legendary')     color = '#f0d040';
  else if (rarity.name === 'Rare')     color = lerpColor(color, '#88aaff', 0.35);
  else if (rarity.name === 'Uncommon') color = lerpColor(color, '#aaffaa', 0.15);

  const traits = rankFoods(inv).map(k => TRAIT_NAMES[k]);
  const diet = Object.entries(inv)
    .filter(([k, v]) => v > 0 && FOOD_KEYS.includes(k))
    .map(([k, v]) => `${v}x ${k}`)
    .join(', ');
  const id = toID(hashVal);

  const shiny = rng.int(0, 1000) === 0;
  return { id, hashVal, hashStr, name, color, rarity, lines: centeredLines, traits, diet, dom, sec, shiny };
}
