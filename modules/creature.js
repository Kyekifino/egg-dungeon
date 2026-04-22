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

export const DRAGON_EGG_STAGES = [
  { color: '#6b1a00', art: [
    '              ', '   ________   ', '  /        \\  ', ' |    /\\    | ',
    ' |   (  )   | ', ' |    \\/    | ', '  \\________/  ', '              ', '              ', '              '] },
  { color: '#cc3300', art: [
    '              ', '   ________   ', '  / ·  · · \\  ', ' | · /\\ ·   | ',
    ' |  ·  · ·  | ', ' | · /\\ ·   | ', '  \\________/  ', '              ', '              ', '              '] },
  { color: '#e05500', art: [
    '      ^       ', '   ___^____   ', '  /   ^    \\  ', ' | ^  |     | ',
    ' |    ^     | ', ' |    |  ^  | ', '  \\___^____/  ', '      ^       ', '              ', '              '] },
  { color: '#ff6600', art: [
    '      *       ', '   __/\\_____  ', '  /^  \\ ^   \\ ', ' |  /\\ \\   ^| ',
    ' | /  \\/\\   | ', ' |/   / \\^  | ', '  \\/\\^/  \\^/  ', '      *       ', '              ', '              '] },
  { color: '#ffcc00', art: [
    '  *   *   *   ', '  *_________* ', ' */ ^ * ^ · \\*', ' |* ^ · ^ * *|',
    '*|· * ^ · ^ ·|*', ' |* · ^ * · *|', ' *\\· ^ * · /*', '  *_________* ', '  *   *   *   ', '              '] },
];

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
// 14 rows × 8 options, ~24 chars wide. Hash selects one option per row.
export const DRAGON_BODY_PARTS = [
  // Row 0: horns / crown
  [
    '        /\\   /\\        ',
    '       /|\\ /|\\         ',
    '      /\\  * *  /\\      ',
    '         ^^^  ^^^       ',
    '      >>  /\\   /\\  <<  ',
    '       *=/\\   /\\=*     ',
    '      /\\ /\\ /\\ /\\      ',
    '       *--/\\ /\\--*     ',
  ],
  // Row 1: head dome
  [
    '       ( ===== )        ',
    '      (( ===== ))       ',
    '       { ===== }        ',
    '      [  =====  ]       ',
    '       < ===== >        ',
    '      *( ===== )*       ',
    '      /[ ===== ]\\       ',
    '       ( ~~~~~ )        ',
  ],
  // Row 2: eyes  (EYE_ROW = 2 — blink swaps o → -)
  [
    '      ( o     o )       ',
    '     (  o     o  )      ',
    '      ( o~~   o )       ',
    '      (  o   o  )       ',
    '      [ o     o ]       ',
    '      < o     o >       ',
    '      { o     o }       ',
    '     *( o     o )*      ',
  ],
  // Row 3: snout / maw
  [
    '      ( >=---=< )       ',
    '      ( >=====< )       ',
    '     (  >-----<  )      ',
    '      ( >~~~~~< )       ',
    '      [ >=====< ]       ',
    '      ( >*****< )       ',
    '     (  >=====<  )      ',
    '      ( >|||I|< )       ',
  ],
  // Row 4: neck
  [
    '       \\  ===  /        ',
    '       /  ===  \\        ',
    '      (   ===   )       ',
    '       |  ===  |        ',
    '      *|  ===  |*       ',
    '      /|  ===  |\\       ',
    '       \\  ~~~  /        ',
    '       >  ===  <        ',
  ],
  // Row 5: upper wing attachment
  [
    '  *\\   |=========| /*   ',
    '  /\\   |=========| /\\   ',
    '   *   |=========|   *  ',
    '  \\*   |=========|  */  ',
    ' *=\\   |=========| /=*  ',
    ' /|\\   |=========| /|\\ ',
    '  ^\\   |=========|  /^  ',
    ' <*\\   |=========|  /*> ',
  ],
  // Row 6: wings spread
  [
    ' *  \\  |=========|  / * ',
    '*    \\ |=========| /   *',
    ' *  (  |=========|  ) * ',
    '*    ( |=========| )   *',
    ' * /\\  |=========|  /\\ *',
    '*  --  |=========|  --  *',
    ' * ^^  |=========|  ^^ *',
    '*  =\\  |=========|  /=  *',
  ],
  // Row 7: upper body
  [
    '    ( \\|=========|/ )   ',
    '     \\ |=========| /    ',
    '    (   |=========|   ) ',
    '    ( \\ |=========| /)  ',
    '    [  \\|=========|/  ] ',
    '    *( \\|=========|/ )* ',
    '   (  * |=========| *  )',
    '    ( = |=========| = ) ',
  ],
  // Row 8: body
  [
    '     ( |=========| )    ',
    '      \\|=========|/     ',
    '     (||=========||)    ',
    '      ( ========= )     ',
    '     [ |=========| ]    ',
    '     *||=========||*    ',
    '    ( ( ========= ) )   ',
    '      <|=========|>     ',
  ],
  // Row 9: lower body
  [
    '      ||=========||     ',
    '      |{=========}|     ',
    '     /||=========||\\ ',
    '     ( |=========| )    ',
    '     *||=========||*    ',
    '      ||~~~~~~~~~||     ',
    '      [|=========|]     ',
    '     (>|=========|<)    ',
  ],
  // Row 10: hips / haunches
  [
    '     /|  =======  |\\    ',
    '    / |  =======  | \\   ',
    '    ( |  =======  | )   ',
    '     \\|  =======  |/    ',
    '    *[|  =======  |]*   ',
    '    /[|  =======  |]\\   ',
    '    <(|  =======  |)>   ',
    '     ||  =======  ||    ',
  ],
  // Row 11: upper legs
  [
    '   (/ \\           / \\)  ',
    '   (|  \\         /  |)  ',
    '  ( |  |         |  | ) ',
    '   (|  \\         /  |)  ',
    '  ([   \\         /   ]) ',
    '   *|  |         |  |*  ',
    '  ( |  (         )  | ) ',
    '  ((   \\         /   )) ',
  ],
  // Row 12: lower legs
  [
    '  (|   |         |   |) ',
    '   |   |         |   |  ',
    '  /|   \\         /   |\\ ',
    ' ( |   |         |   | )',
    '  [|   |         |   |] ',
    ' *||   |         |   ||*',
    '  ||   |         |   || ',
    ' (||   \\         /   ||)',
  ],
  // Row 13: claws / feet
  [
    ' (_)  (_)       (_)  (_)',
    '  V    V         V    V ',
    ' (U) (V)         (V) (U)',
    '  \\_/  \\_/     \\_/  \\_/ ',
    ' /V\\  /V\\       /V\\  /V\\',
    '  >>   >>        >>   >> ',
    ' {_}  {_}       {_}  {_}',
    ' *V*  *V*        *V*  *V*',
  ],
];

export const DRAGON_FILL_SUBS = { from: '=', to: ['=', '#', '~', 'X', '+', '*', '^', '-'] };

export const DRAGON_BASE_COLORS = [
  '#e06020',  // fire orange
  '#cc1a1a',  // deep crimson
  '#20a844',  // emerald
  '#7020cc',  // arcane violet
  '#1a60d8',  // sapphire
  '#b08020',  // bronze
  '#c01878',  // blood rose
  '#1a8888',  // jade teal
  '#884400',  // rust
  '#406020',  // deep forest
  '#cc6000',  // molten amber
  '#302080',  // deep indigo
];

export const DRAGON_NAME_POOLS = {
  pre: ['Ignis','Pyrax','Cinder','Embyr','Scorx','Flare','Grimm','Slag','Forge','Crag','Sear','Brax','Char','Blaze','Infern','Pyral',
        'Vex','Drak','Gorlax','Vorn','Keld','Thrak','Obsid','Kryx','Ruun','Glaiv','Dusk','Nox','Vael','Crypt','Morg','Zyx'],
  suf: ['wyrm','scale','fang','claw','wing','fire','blaze','scorch','brand','char','smelt','drake','bane','ash','coal','forge',
        'spine','wrath','horn','skull','ire','rend','void','doom','veil','storm','siege','rift','spite','gale','tide','grim'],
};

export const DRAGON_TITLE_POOLS = [
  'the Ancient','the Burning','the Eternal','the Vast','the Terrible',
  'the Undying','the Merciless','the Colossus','the Scorching','the Boundless',
  'the Primordial','the Infernal','the Desolate','the Smoldering','the Ravenous','the Immortal',
  'the Ruinous','the Abyssal','the Sovereign','the Wrathful','the Forsaken',
  'the Venomous','the Ashen','the Thunderous','the Dreadful','the Voracious',
  'the Relentless','the Unyielding','the Catastrophic',
];

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

  const baseColor = DRAGON_BASE_COLORS[hashVal % DRAGON_BASE_COLORS.length];
  let color = baseColor;
  if (rarity.name === 'Legendary')     color = lerpColor(baseColor, '#f8e040', 0.55);
  else if (rarity.name === 'Rare')     color = lerpColor(baseColor, '#6090ff', 0.42);
  else if (rarity.name === 'Uncommon') color = lerpColor(baseColor, '#ffcc44', 0.28);

  const diet = foodSequence.length
    ? Object.entries(foodSequence.reduce((a, k) => { a[k] = (a[k] || 0) + 1; return a; }, {}))
        .map(([k, v]) => `${v}x ${k}`).join(', ')
    : 'none';

  const id = toID(hashVal);
  const shiny = rng.int(0, 100) === 0;

  return {
    id, hashVal, hashStr, name, color, rarity, lines: centeredLines,
    diet, dom: null, sec: null, shiny,
    isGreatBeast: true, beastType: 'dragon',
    sacrificedCreatureIds: sacrificedIds,
    traits: ['Great Beast', 'Dragon'],
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

// ── Kraken egg stages ───────────────────────────────────────────────
export const KRAKEN_EGG_STAGES = [
  { color: '#0a2a40', art: [
    '              ', '   ________   ', '  /        \\  ', ' |    ~~    | ',
    ' |   (  )   | ', ' |    ~~    | ', '  \\________/  ', '    ~~~~~~    ', '              ', '              '] },
  { color: '#0e4060', art: [
    '              ', '   ________   ', '  / ~  ~ ~ \\  ', ' | ~ ~~  ~  | ',
    ' |  ~ ~ ~   | ', ' | ~  ~ ~ ~ | ', '  \\________/  ', '    ~~~~~~    ', '              ', '              '] },
  { color: '#1060a0', art: [
    '      ~       ', '   ___~____   ', '  /   ~    \\  ', ' | ~  |     | ',
    ' |    ~     | ', ' |    |  ~  | ', '  \\___~____/  ', '    ~~~~~~    ', '              ', '              '] },
  { color: '#1888cc', art: [
    '      *       ', '   __/\\_____  ', '  /~  \\ ~   \\ ', ' |  /\\ \\   ~| ',
    ' | /  \\/\\   | ', ' |/   / \\~  | ', '  \\/\\~/  \\~/  ', '      *       ', '              ', '              '] },
  { color: '#40e0ff', art: [
    '  ~   ~   ~   ', '  ~_________~ ', ' ~/ ~ * ~ · \\~', ' |~ · ~ * ~ ~|',
    '~|· ~ · ~ * ·|~', ' |~ · ~ * · ~|', ' ~\\· ~ * · /~ ', '  ~_________~ ', '  ~   ~   ~   ', '              '] },
];

const KRAKEN_ANIM_WAVE1 = [
  '  ~   ~   ~   ', '  ~__~_~___~  ', ' ~/ · ~ · · \\~', ' |· ~ · · · | ',
  '~|· · ~ · · |~', ' |· · · ~ · | ', ' ~\\· · ~ · /~ ', '  ~___~____~  ',
  '  ~   ~   ~   ', '              ', '              ', '              ', '              ', '              '];
const KRAKEN_ANIM_WAVE2 = [
  '  ~   ~   ~   ', '  _/\\~_/\\___  ', ' /  \\~/  \\  \\ ', '|~  /\\~   |  |',
  '| ~/  \\~  |  |', '|~   /  \\~|  |', ' \\~/    \\~/  /', '  ~___~___~   ',
  '  ~   ~   ~   ', '              ', '              ', '              ', '              ', '              '];
const KRAKEN_ANIM_SPLASH = [
  '~  ~ ~ ~ ~    ', '~ ~ ~ ~ ~ ~ ~ ', ' ~ ~ ~ ~ ~ ~  ', '~ ~ ~ ~ ~ ~ ~ ',
  ' ~ ~ ~ ~ ~ ~  ', '~ ~ ~ ~ ~ ~ ~ ', ' ~ ~ ~ ~ ~ ~  ', '~ ~ ~ ~ ~ ~ ~ ',
  '~  ~ ~ ~ ~    ', '              ', '              ', '              ', '              ', '              '];

// ── Kraken body part pools ───────────────────────────────────────────
// 14 rows × 8 options. Squid silhouette: torpedo mantle (rows 0-3),
// neck (row 4), head with eyes at row 5 (not row 2), beak (row 6),
// then 7 rows of spreading tentacles dominate the lower body.
export const KRAKEN_BODY_PARTS = [
  // Row 0: mantle tip — narrow pointed top
  [
    '         /          ',
    '        /           ',
    '        ( ~~ )       ',
    '       /~~~~        ',
    '        ( -- )       ',
    '       (  ~~  )      ',
    '        /~~~~       ',
    '       ( ~~~~ )      ',
  ],
  // Row 1: upper mantle — widening
  [
    '      /  ~~~~~~      ',
    '      ( ~~~~~~~~~~ )  ',
    '      (  ~~~~~~~~  )  ',
    '      [  ~~~~~~~~  ]  ',
    '      {  ~~~~~~~~  }  ',
    '      <  ~~~~~~~~  >  ',
    '     /   ~~~~~~~~    ',
    '      ( --------- )   ',
  ],
  // Row 2: mantle widest
  [
    '   (   ~~~~~~~~~~~~~~   )  ',
    '  (    ~~~~~~~~~~~~~~    ) ',
    '   [   ~~~~~~~~~~~~~~   ]  ',
    '   {   ~~~~~~~~~~~~~~   }  ',
    '   <   ~~~~~~~~~~~~~~   >  ',
    '  [(   ~~~~~~~~~~~~~~   )] ',
    '   (  ~~~~~~~~~~~~~~~~  )  ',
    '   (  ~~~----~~~~----~~~)   ',
  ],
  // Row 3: lower mantle — narrows toward neck
  [
    '      ~~~~~~~~~~~~  /  ',
    '    (  ~~~~~~~~~~~~  )  ',
    '    )  ~~~~~~~~~~~~  (  ',
    '    [  ~~~~~~~~~~~~  ]  ',
    '    {  ~~~~~~~~~~~   }  ',
    '    <  ~~~~~~~~~~~~  >  ',
    '    /  ~~~~~~~~~~~     ',
    '    (  -----------   )  ',
  ],
  // Row 4: neck / mantle base — narrow connector
  [
    '       (  ~~~~  )       ',
    '       [  ~~~~  ]       ',
    '       {  ~~~~  }       ',
    '        ( ~~~~ )        ',
    '       (  ----  )       ',
    '          ~~  /        ',
    '       <  ~~~~  >       ',
    '        ( ~~~~ )        ',
  ],
  // Row 5: head — prominent eyes; eyeRow = 5 (blink swaps o → -)
  [
    '     ( o    ~~~~    o )  ',
    '    (  o    ~~~~    o ) ',
    '     [ o    ~~~~    o ] ',
    '    (  o           o  ) ',
    '     { o    ~~~~    o } ',
    '    <  o    ~~~~    o > ',
    '     ( o    ----    o ) ',
    '    *( o    ~~~~    o )* ',
  ],
  // Row 6: beak / maw — below the eyes
  [
    '      (  >~~~~~~~<  )   ',
    '      (  >=======<  )   ',
    '     (   >~~~~~~~<   )  ',
    '      [  >~~~~~~~<  ]   ',
    '      (  >-------<  )   ',
    '     (   >=======<   )  ',
    '      {  >~~~~~~~<  }   ',
    '      (  >*~~~~~*<  )   ',
  ],
  // Row 7: tentacle crown — erupts much wider than head
  [
    '  ~~(    )~~~~~~~~~~~~~(    )~~  ',
    ' ~~~(   )~~~~~~~~~~~~~(   )~~~   ',
    '  ~)     (~~~~~~~~~~~~~)    (~   ',
    '  ~~(~   )~~~~~~~~~~~~~(   ~)~~  ',
    ' ~~   (  ~~~~~~~~~~~~~  )   ~~   ',
    '  ~~)   (~~~~~~~~~~~~~)   (~~    ',
    ' ~~~    (~~~~~~~~~~~~~)    ~~~   ',
    '  ~~(~) (~~~~~~~~~~~~~) (~)~~    ',
  ],
  // Row 8: tentacles spreading outward
  [
    ' ~(    )~                ~(    )~  ',
    ' ~~   )~                  ~(   ~~  ',
    ' ~)    ~                  ~    (~  ',
    ' ~(~   )                  (   ~)~  ',
    '~(      ~                ~      )~ ',
    ' ~~   ~~                  ~~   ~~  ',
    ' ~)   (                    )   (~  ',
    '~~)    ~                  ~    (~~  ',
  ],
  // Row 9: tentacles spreading wider
  [
    '~(    )~                    ~(    )~ ',
    '~~   )~                      ~(   ~~ ',
    '~)    ~                      ~    (~ ',
    '~(~   )                      (   ~)~ ',
    '(      ~                    ~      ) ',
    '~~   ~~                      ~~   ~~ ',
    '~)   (                        )   (~ ',
    '~~)   ~                      ~   (~~ ',
  ],
  // Row 10: tentacles mid — spreading further
  [
    '(    )~                      ~(    )  ',
    '~   )~                        ~(   ~  ',
    ')    ~                        ~    (  ',
    '(~   )                        (   ~)  ',
    '(     ~                      ~     )  ',
    '~   ~~                        ~~   ~  ',
    ')   (                          )   (  ',
    '~)   ~                        ~   (~  ',
  ],
  // Row 11: tentacles lower — wider still
  [
    '(    )~                        ~(    ) ',
    '~   )~                          ~(   ~ ',
    ')    ~                          ~    ( ',
    '(~   )                          (   ~) ',
    '(     ~                        ~     ) ',
    '~   ~~                          ~~   ~ ',
    ')   (                            )   ( ',
    '~)   ~                          ~   (~ ',
  ],
  // Row 12: tentacles nearing tips — very wide spread
  [
    '(   )~                            ~(   ) ',
    '~  )~                              ~(  ~  ',
    ')   ~                              ~   (  ',
    '(~  )                              (  ~)  ',
    '(    ~                            ~    )  ',
    '~  ~~                              ~~  ~  ',
    ')  (                                )  (  ',
    '~)  ~                              ~  (~  ',
  ],
  // Row 13: tentacle tips — fully spread, trailing off
  [
    '(~)  (~)                        (~)  (~)  ',
    '~~    ~~                          ~~    ~~  ',
    '~~)  (~~                        ~~)  (~~    ',
    '(~)  (~~                        ~~)  (~)    ',
    '~(~)(~)                          (~)(~)~    ',
    '~~~  ~~~                        ~~~  ~~~    ',
    '(~)  ~~~                        ~~~  (~)    ',
    '~     ~                          ~     ~    ',
  ],
];
export const KRAKEN_FILL_SUBS = { from: '~', to: ['~', '-', '=', '*', '^', '+', '#', '.'] };

export const KRAKEN_BASE_COLORS = [
  '#1a60b0',  // ocean blue
  '#0a8060',  // sea green
  '#3020a0',  // abyssal purple
  '#007878',  // teal
  '#1a4880',  // midnight blue
  '#207840',  // kelp green
  '#5030c0',  // deep violet
  '#008890',  // cyan teal
  '#006b6b',  // dark teal
  '#40108a',  // deep purple
  '#006040',  // dark sea
  '#1a3070',  // navy
];

export const KRAKEN_NAME_POOLS = {
  pre: ['Abys','Neth','Gloom','Murk','Tide','Brine','Vex','Drown','Maw','Cthul','Lurk','Gyre',
        'Vast','Void','Coil','Surge','Rift','Slith','Fathom','Loch','Pelag','Ink','Wrak','Squall',
        'Maelm','Trench','Sable','Dusk','Brack','Deep','Nox','Chasm'],
  suf: ['kraken','maw','coil','tide','deep','abyss','surge','clutch','grasp','swell','brine','rift',
        'fathom','wrath','doom','veil','dread','current','squall','lure','clutch','hollow','spiral','pull',
        'trench','churn','flood','wave','drift','sink','gulf','wake'],
};

export const KRAKEN_TITLE_POOLS = [
  'the Ancient','the Bottomless','the Eternal','the Vast','the Hungering',
  'the Undying','the Merciless','the Unfathomable','the Crushing','the Boundless',
  'the Primordial','the Abyssal','the Desolate','the Sunken','the Ravenous','the Immortal',
  'the Ruinous','the Devouring','the Sovereign','the Wrathful','the Forsaken',
  'the Lurking','the Drowned','the Thunderous','the Dreadful','the Voracious',
  'the Relentless','the Unyielding','the Fathomless',
];

export function generateKraken(krakenEgg) {
  const { foodSequence, rarityRoll, sacrificedCreatures } = krakenEgg;
  const sacrificedIds = (sacrificedCreatures || []).map(c => c.id).sort();
  const hashStr = sacrificedIds.join(',') + ':' + foodSequence.join(',') + ':' + rarityRoll;
  const hashVal = djb2(hashStr);
  const rng = mulberry32(hashVal);
  const rarity = getRarity(rarityRoll);

  const lines = KRAKEN_BODY_PARTS.map(rowPool => rng.pick(rowPool));

  const fillCh = rng.pick(KRAKEN_FILL_SUBS.to);
  if (fillCh !== KRAKEN_FILL_SUBS.from)
    for (let i = 0; i < lines.length; i++)
      lines[i] = lines[i].split(KRAKEN_FILL_SUBS.from).join(fillCh);

  if (rarity.name === 'Legendary') lines[0] = '  ~ ~ ~ ~ ~ ~ ~ ~ ~  ';
  const centeredLines = centerLines(lines);

  const pre = KRAKEN_NAME_POOLS.pre[Math.floor(rng.next() * KRAKEN_NAME_POOLS.pre.length)];
  const suf = KRAKEN_NAME_POOLS.suf[Math.floor(rng.next() * KRAKEN_NAME_POOLS.suf.length)];
  const title = KRAKEN_TITLE_POOLS[Math.floor(rng.next() * KRAKEN_TITLE_POOLS.length)];
  const name = cap(pre + suf) + ' ' + title;

  const baseColor = KRAKEN_BASE_COLORS[hashVal % KRAKEN_BASE_COLORS.length];
  let color = baseColor;
  if (rarity.name === 'Legendary')     color = lerpColor(baseColor, '#40e8ff', 0.55);
  else if (rarity.name === 'Rare')     color = lerpColor(baseColor, '#80ffcc', 0.42);
  else if (rarity.name === 'Uncommon') color = lerpColor(baseColor, '#88ccff', 0.28);

  const diet = foodSequence.length
    ? Object.entries(foodSequence.reduce((a, k) => { a[k] = (a[k] || 0) + 1; return a; }, {}))
        .map(([k, v]) => `${v}x ${k}`).join(', ')
    : 'none';

  const id = toID(hashVal);
  const shiny = rng.int(0, 100) === 0;

  return {
    id, hashVal, hashStr, name, color, rarity, lines: centeredLines,
    diet, dom: null, sec: null, shiny,
    isGreatBeast: true, beastType: 'kraken', eyeRow: 5,
    sacrificedCreatureIds: sacrificedIds,
    traits: ['Great Beast', 'Kraken'],
  };
}

export function regenKrakenLines(k) {
  k.eyeRow = 5;
  const rng = mulberry32(k.hashVal);
  const lines = KRAKEN_BODY_PARTS.map(rowPool => rng.pick(rowPool));
  const fillCh = rng.pick(KRAKEN_FILL_SUBS.to);
  if (fillCh !== KRAKEN_FILL_SUBS.from)
    for (let i = 0; i < lines.length; i++)
      lines[i] = lines[i].split(KRAKEN_FILL_SUBS.from).join(fillCh);
  if (k.rarity?.name === 'Legendary') lines[0] = '  ~ ~ ~ ~ ~ ~ ~ ~ ~  ';
  k.lines = centerLines(lines);
}

export function buildKrakenAnimSeq(kraken) {
  const pad = Array(4).fill('              ');
  const s4ext      = [...KRAKEN_EGG_STAGES[4].art, ...pad];
  const wave1ext   = [...KRAKEN_ANIM_WAVE1];
  const wave2ext   = [...KRAKEN_ANIM_WAVE2];
  const splashExt  = [...KRAKEN_ANIM_SPLASH];
  return [
    { lines: s4ext,          color: '#40e0ff',                    delay: 320 },
    { lines: s4ext,          color: '#88ffff',                    delay: 200 },
    { lines: wave1ext,       color: '#20b0e0',                    delay: 180 },
    { lines: wave2ext,       color: '#1080c0',                    delay: 150 },
    { lines: splashExt,      color: '#88ffff',                    delay: 130 },
    { lines: splashExt,      color: '#40d0ff',                    delay: 100 },
    { lines: kraken.lines,   color: hexDim(kraken.color, 0.22),  delay: 220 },
    { lines: kraken.lines,   color: hexDim(kraken.color, 0.50),  delay: 200 },
    { lines: kraken.lines,   color: hexDim(kraken.color, 0.80),  delay: 260 },
    { lines: kraken.lines,   color: kraken.color,                delay: 0   },
  ];
}

// ── Griffon egg stages ─────────────────────────────────────────────
export const GRIFFON_EGG_STAGES = [
  { color: '#1a3010', art: [
    '              ', '   ________   ', '  /        \\  ', ' |    /\\    | ',
    ' |   (  )   | ', ' |    \\/    | ', '  \\________/  ', '              ', '              ', '              '] },
  { color: '#2a5a18', art: [
    '              ', '   ________   ', '  / ^  ^ ^ \\  ', ' | ^ ^^  ^  | ',
    ' |  ^ ^ ^   | ', ' | ^  ^ ^ ^ | ', '  \\________/  ', '              ', '              ', '              '] },
  { color: '#608018', art: [
    '      ^       ', '   ___^____   ', '  /   ^    \\  ', ' | ^  |     | ',
    ' |    ^     | ', ' |    |  ^  | ', '  \\___^____/  ', '      ^       ', '              ', '              '] },
  { color: '#b08010', art: [
    '      *       ', '   __/\\_____  ', '  /^  \\ ^   \\ ', ' |  /\\ \\   ^| ',
    ' | /  \\/\\   | ', ' |/   / \\^  | ', '  \\/\\^/  \\^/  ', '      *       ', '              ', '              '] },
  { color: '#f0c820', art: [
    '  ^   ^   ^   ', '  ^_________^ ', ' ^/ ^ * ^ · \\^', ' |^ · ^ * ^ ^|',
    '^|· ^ · ^ * ·|^', ' |^ · ^ * · ^|', ' ^\\· ^ * · /^ ', '  ^_________^ ', '  ^   ^   ^   ', '              '] },
];

const GRIFFON_ANIM_FLAP1 = [
  '  ^   ^   ^   ', '  ^__^_^___^  ', ' ^/ · ^ · · \\^', ' |· ^ · · · | ',
  '^|· · ^ · · |^', ' |· · · ^ · | ', ' ^\\· · ^ · /^ ', '  ^___^____^  ',
  '  ^   ^   ^   ', '              ', '              ', '              ', '              ', '              '];
const GRIFFON_ANIM_FLAP2 = [
  '  ^   ^   ^   ', '  _/\\^_/\\___  ', ' /  \\^/  \\  \\ ', '|^  /\\^   |  |',
  '| ^/  \\^  |  |', '|^   /  \\^|  |', ' \\^/    \\^/  /', '  ^___^___^   ',
  '  ^   ^   ^   ', '              ', '              ', '              ', '              ', '              '];
const GRIFFON_ANIM_BURST = [
  '^  ^ ^ ^ ^    ', '^ ^ ^ ^ ^ ^ ^ ', ' ^ ^ ^ ^ ^ ^  ', '^ ^ ^ ^ ^ ^ ^ ',
  ' ^ ^ ^ ^ ^ ^  ', '^ ^ ^ ^ ^ ^ ^ ', ' ^ ^ ^ ^ ^ ^  ', '^ ^ ^ ^ ^ ^ ^ ',
  '^  ^ ^ ^ ^    ', '              ', '              ', '              ', '              ', '              '];

// ── Griffon body part pools ──────────────────────────────────────────
// 14 rows × 8 options. Eagle head (rows 0-4), spread wings (rows 5-7),
// lion body/belly (rows 8-9), lion haunches/legs/paws (rows 10-13).
// Fill char '^' substituted throughout for feather texture variation.
export const GRIFFON_BODY_PARTS = [
  // Row 0: eagle crown — crest feathers pointing upward
  [
    '      ^ ^ ^ ^ ^      ',
    '     ^^ ^ ^ ^ ^^     ',
    '    ^ ^^ ^ ^^ ^ ^    ',
    '      ^^^  ^  ^^^     ',
    '     ^  ^ ^ ^  ^     ',
    '    ^ ^ ^ ^ ^ ^ ^    ',
    '     ^^^ ^^^ ^^^      ',
    '      ^^ ^ ^ ^^       ',
  ],
  // Row 1: eagle head dome — feathered, round
  [
    '      ( ^^^^^^^ )     ',
    '     (( ^^^^^^^ ))    ',
    '      { ^^^^^^^ }     ',
    '     [  ^^^^^^^  ]    ',
    '      < ^^^^^^^ >     ',
    '     *( ^^^^^^^ )*    ',
    '     /[ ^^^^^^^ ]\\   ',
    '      ( ------- )     ',
  ],
  // Row 2: eyes  (EYE_ROW = 2 — blink swaps o → -)
  [
    '      ( o     o )     ',
    '     (  o     o  )    ',
    '      ( o^^   o )     ',
    '      (  o   o  )     ',
    '      [ o     o ]     ',
    '      < o     o >     ',
    '      { o     o }     ',
    '     *( o     o )*    ',
  ],
  // Row 3: hooked eagle beak — short and curved, distinct from dragon snout
  [
    '       (  >^<  )      ',
    '       ( >^^^< )      ',
    '      (  >>^<<  )     ',
    '       [ >^-< ]       ',
    '       (  >-<  )      ',
    '      (  >^^<   )     ',
    '       { >^< }        ',
    '      *( >^< )*       ',
  ],
  // Row 4: feathered collar / neck
  [
    '       {  ^^^  }      ',
    '       [  ^^^  ]      ',
    '      {{  ^^^  }}     ',
    '       (  ^^^  )      ',
    '       {  ---  }      ',
    '       [  ---  ]      ',
    '      {   ^^^   }     ',
    '       (  ---  )      ',
  ],
  // Row 5: wing shoulders — feather tufts fan outward from oval chest
  [
    '   v^^   ( ^^^ )   ^^v   ',
    '  ^vv    ( ^^^ )    vv^  ',
    '  v^^    { ^^^ }    ^^v  ',
    '   ^^^   [ ^^^ ]   ^^^   ',
    '  v^v    ( --- )    v^v  ',
    '  ^^v    { ^^^ }    v^^  ',
    '   ^vv   ( ^^^ )   vv^   ',
    '  v^^    [ ^^^ ]    ^^v  ',
  ],
  // Row 6: wings spread wide as layered feathers
  [
    ' v^  vvv  ( ^^^^^ )  vvv  ^v',
    ' ^   ^^^  ( ^^^^^ )  ^^^   ^ ',
    'v^ v^vv   { ^^^^^ }   vv^v ^v',
    ' ^  ^^^^  [ ^^^^^ ]  ^^^^  ^ ',
    'v^   v^^  ( ----- )  ^^v   ^v',
    ' ^   vvv  { ^^^^^ }  vvv   ^ ',
    'v^   ^^^  ( ^^^^^ )  ^^^   ^v',
    ' ^  v^vv  [ ^^^^^ ]  vv^v  ^ ',
  ],
  // Row 7: wings taper, broad oval chest
  [
    ' v^  ^^  ( ^^^^^^^ )  ^^  ^v ',
    '  ^  v^v ( ^^^^^^^ ) v^v  ^  ',
    ' v^   vv { ^^^^^^^ } vv   ^v ',
    '  ^   ^^ [ ^^^^^^^ ] ^^   ^  ',
    ' v^   vv ( ------- ) vv   ^v ',
    '  ^  vvv { ^^^^^^^ } vvv  ^  ',
    ' v^  ^^^ ( ^^^^^^^ ) ^^^  ^v ',
    '  ^  v^v [ ^^^^^^^ ] v^v  ^  ',
  ],
  // Row 8: lion chest — round, no vertical bars
  [
    '     ( ^^^^^^^^^ )     ',
    '    ( ( ^^^^^^^^^ ) )  ',
    '    { ( ^^^^^^^^^ ) }  ',
    '     [ ^^^^^^^^^ ]     ',
    '    *( ^^^^^^^^^ )*    ',
    '     { ^^^^^^^^^ }     ',
    '    (  ^^^^^^^^^ )     ',
    '    [  ^^^^^^^^^ ]     ',
  ],
    // Row 9: lion belly / midsection — rounded, uses - not ^
  [
    '     ( --------- )     ',
    '     ( ========= )     ',
    '     [ --------- ]     ',
    '    ( (--------- ) )   ',
    '     { --------- }     ',
    '     ( --- --- -- )    ',
    '     [ === === == ]    ',
    '    ( ----------- )    ',
  ],
  // Row 10: lion haunches — powerful, wide
  [
    '    /|  -------  |\\   ',
    '   / |  -------  | \\  ',
    '   ( |  -------  | )  ',
    '    \\|  -------  |/   ',
    '   *[|  -------  |]*  ',
    '   /[|  -------  |]\\ ',
    '   <(|  -------  |)>  ',
    '    ||  -------  ||   ',
  ],
  // Row 11: lion upper legs
  [
    '  (/ \\            / \\)  ',
    '  (|  \\          /  |)  ',
    ' ( |  |          |  | ) ',
    '  (|  \\          /  |)  ',
    ' ([   \\          /   ]) ',
    '  *|  |          |  |*  ',
    ' ( |  (          )  | ) ',
    ' ((   \\          /   )) ',
  ],
  // Row 12: lion lower legs
  [
    ' (|   |          |   |) ',
    '  |   |          |   |  ',
    ' /|   \\          /   |\\ ',
    '( |   |          |   | )',
    ' [|   |          |   |] ',
    '*||   |          |   ||*',
    ' ||   |          |   || ',
    '(||   \\          /   ||)',
  ],
  // Row 13: lion paws — rounded pads, distinct from dragon claws
  [
    ' (oo)(oo)        (oo)(oo) ',
    '  UU  UU          UU  UU  ',
    ' (U) (U)          (U) (U) ',
    '  uu  uu          uu  uu  ',
    ' (uu)(uu)        (uu)(uu) ',
    '  UU   UU        UU   UU  ',
    ' {U}  {U}        {U}  {U} ',
    '  U    U            U    U  ',
  ],
];

export const GRIFFON_FILL_SUBS = { from: '^', to: ['^', '*', '=', 'v', '+', '~', '-', '#'] };

export const GRIFFON_BASE_COLORS = [
  '#c09018',  // golden
  '#d07020',  // amber
  '#a07030',  // tawny
  '#c0a020',  // harvest gold
  '#b06010',  // burnt sienna
  '#d4b000',  // bright gold
  '#8a6020',  // dark honey
  '#c8840c',  // bronze
  '#e0c040',  // pale gold
  '#a08030',  // warm tan
  '#c07018',  // rust gold
  '#b09028',  // wheat
];

export const GRIFFON_NAME_POOLS = {
  pre: ['Aur','Sol','Gale','Swift','Crest','Pyre','Gilt','Lum','Talm','Aeri','Storm','Veil','Flare','Gild','Cirr',
        'Zeph','Halo','Aero','Loft','Blaze','Forge','Dawn','Dusk','Claw','Talon','Regal','Keen','Vex','Surge','Prow'],
  suf: ['wing','crest','talon','feather','beak','soar','gale','strike','plume','fang','valor','pride','mane','crown',
        'pinion','mantle','swoop','reign','perch','rush','gust','flight','peak','sky','claw','lance','rise','sun','gold','fire'],
};

export const GRIFFON_TITLE_POOLS = [
  'the Noble','the Swift','the Proud','the Watchful','the Undying',
  'the Ancient','the Regal','the Keen','the Fierce','the Boundless',
  'the Primordial','the Soaring','the Majestic','the Vigilant','the Resplendent','the Immortal',
  'the Radiant','the Unbroken','the Sovereign','the Wrathful','the Hallowed',
  'the Golden','the Exalted','the Ferocious','the Glorious','the Unyielding',
  'the Relentless','the Indomitable','the Luminous',
];

export function generateGriffon(griffonEgg) {
  const { foodSequence, rarityRoll, sacrificedCreatures } = griffonEgg;
  const sacrificedIds = (sacrificedCreatures || []).map(c => c.id).sort();
  const hashStr = sacrificedIds.join(',') + ':' + foodSequence.join(',') + ':' + rarityRoll;
  const hashVal = djb2(hashStr);
  const rng = mulberry32(hashVal);
  const rarity = getRarity(rarityRoll);

  const lines = GRIFFON_BODY_PARTS.map(rowPool => rng.pick(rowPool));

  const fillCh = rng.pick(GRIFFON_FILL_SUBS.to);
  if (fillCh !== GRIFFON_FILL_SUBS.from)
    for (let i = 0; i < lines.length; i++)
      lines[i] = lines[i].split(GRIFFON_FILL_SUBS.from).join(fillCh);

  if (rarity.name === 'Legendary') lines[0] = '  ^ ^ ^ ^ ^ ^ ^ ^ ^  ';
  const centeredLines = centerLines(lines);

  const pre = GRIFFON_NAME_POOLS.pre[Math.floor(rng.next() * GRIFFON_NAME_POOLS.pre.length)];
  const suf = GRIFFON_NAME_POOLS.suf[Math.floor(rng.next() * GRIFFON_NAME_POOLS.suf.length)];
  const title = GRIFFON_TITLE_POOLS[Math.floor(rng.next() * GRIFFON_TITLE_POOLS.length)];
  const name = cap(pre + suf) + ' ' + title;

  const baseColor = GRIFFON_BASE_COLORS[hashVal % GRIFFON_BASE_COLORS.length];
  let color = baseColor;
  if (rarity.name === 'Legendary')     color = lerpColor(baseColor, '#fff080', 0.55);
  else if (rarity.name === 'Rare')     color = lerpColor(baseColor, '#a0e0ff', 0.42);
  else if (rarity.name === 'Uncommon') color = lerpColor(baseColor, '#ffe080', 0.28);

  const diet = foodSequence.length
    ? Object.entries(foodSequence.reduce((a, k) => { a[k] = (a[k] || 0) + 1; return a; }, {}))
        .map(([k, v]) => `${v}x ${k}`).join(', ')
    : 'none';

  const id = toID(hashVal);
  const shiny = rng.int(0, 100) === 0;

  return {
    id, hashVal, hashStr, name, color, rarity, lines: centeredLines,
    diet, dom: null, sec: null, shiny,
    isGreatBeast: true, beastType: 'griffon',
    sacrificedCreatureIds: sacrificedIds,
    traits: ['Great Beast', 'Griffon'],
  };
}

export function regenGriffonLines(g) {
  const rng = mulberry32(g.hashVal);
  const lines = GRIFFON_BODY_PARTS.map(rowPool => rng.pick(rowPool));
  const fillCh = rng.pick(GRIFFON_FILL_SUBS.to);
  if (fillCh !== GRIFFON_FILL_SUBS.from)
    for (let i = 0; i < lines.length; i++)
      lines[i] = lines[i].split(GRIFFON_FILL_SUBS.from).join(fillCh);
  if (g.rarity?.name === 'Legendary') lines[0] = '  ^ ^ ^ ^ ^ ^ ^ ^ ^  ';
  g.lines = centerLines(lines);
}

export function buildGriffonAnimSeq(griffon) {
  const pad = Array(4).fill('              ');
  const s4ext    = [...GRIFFON_EGG_STAGES[4].art, ...pad];
  const flap1ext = [...GRIFFON_ANIM_FLAP1];
  const flap2ext = [...GRIFFON_ANIM_FLAP2];
  const burstExt = [...GRIFFON_ANIM_BURST];
  return [
    { lines: s4ext,         color: '#f0c820',                    delay: 320 },
    { lines: s4ext,         color: '#fff8a0',                    delay: 200 },
    { lines: flap1ext,      color: '#e0a820',                    delay: 180 },
    { lines: flap2ext,      color: '#c08010',                    delay: 150 },
    { lines: burstExt,      color: '#fff8a0',                    delay: 130 },
    { lines: burstExt,      color: '#f0c820',                    delay: 100 },
    { lines: griffon.lines, color: hexDim(griffon.color, 0.22), delay: 220 },
    { lines: griffon.lines, color: hexDim(griffon.color, 0.50), delay: 200 },
    { lines: griffon.lines, color: hexDim(griffon.color, 0.80), delay: 260 },
    { lines: griffon.lines, color: griffon.color,               delay: 0   },
  ];
}

// Dispatcher — extend with new beastType cases as new Great Beasts are added.
export function generateGreatBeast(egg) {
  switch (egg.beastType) {
    case 'kraken':  return generateKraken(egg);
    case 'griffon': return generateGriffon(egg);
    case 'dragon':  return generateDragon(egg);
    default:        return generateDragon(egg);
  }
}

export function regenGreatBeastLines(b) {
  switch (b.beastType) {
    case 'kraken':  regenKrakenLines(b);  break;
    case 'griffon': regenGriffonLines(b); break;
    case 'dragon':  regenDragonLines(b);  break;
    default:        regenDragonLines(b);
  }
}

export function buildGreatBeastAnimSeq(beast) {
  switch (beast.beastType) {
    case 'kraken':  return buildKrakenAnimSeq(beast);
    case 'griffon': return buildGriffonAnimSeq(beast);
    default:        return buildDragonAnimSeq(beast);
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

  const shiny = rng.int(0, 100) === 0;
  return { id, hashVal, hashStr, name, color, rarity, lines: centeredLines, traits, diet, dom, sec, shiny };
}
