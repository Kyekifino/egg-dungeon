# Egg Dungeon — AI Session Guide

Browser ASCII roguelike. Vanilla JS, no build step, ES modules served directly from the filesystem.

## Architecture

Dependency graph (no circular deps):

```
utils.js  ──────────────────────────────────────────────┐
world.js  → utils                                        │
creature.js → utils                                      ├─→ game.js (orchestrator)
state.js  (no deps)                                      │
audio.js  (no deps on other modules)                     │
render.js → utils, world, creature, state, audio        │
input.js  → utils                                       ─┘
```

### modules/

| File | Owns |
|------|------|
| `utils.js` | Pure constants and helpers (VERSION, PATCH_NOTES, BIOMES, FOOD_INFO, etc.) |
| `world.js` | Infinite chunked world: generation, tile access, chunk cache, biome lookup |
| `creature.js` | Creature generation, egg stages, hatch animation sequence |
| `state.js` | Shared mutable state: `G` (game object) and `selectedFood`. Exported as `let` bindings so importers get live values |
| `audio.js` | AudioContext, biome music loop, SFX, mute toggle |
| `render.js` | All DOM rendering, idle animation timers (blink, jiggle, egg shake) |
| `input.js` | Keyboard and click handlers. Initialised via `Input.init(handlers)` to avoid circular deps |

### game.js

~250-line orchestrator. Contains: `newGame`, `tryMove`, `tryFeed`, `trySpawnEgg`, `startHatch`, `runAnimFrame`, save/load, patch notes display, startup.

## Key patterns

**Live bindings**: `G` and `selectedFood` are `let` exports from `state.js`. All modules that import them always see the current value — no need to pass them as arguments.

**Idle animation cancellation**: `idleGen` (in render.js) is incremented on every hard render. In-flight blink/jiggle callbacks bail early when `idleGen !== gen`.

**Input decoupling**: `input.js` exports `init(handlers)`. `game.js` passes callbacks in. This keeps input.js dependency-free from game.js.

## Dev process

**Pre-commit hook** (`.githooks/pre-commit`):
1. Smoke test (`node smoke.js`)
2. ESLint (`npm run lint`)
3. Unit tests with ≥50% line coverage (`npm test`)
4. Checks PATCH_NOTES entry exists for next version
5. Bumps VERSION in `modules/utils.js` and re-stages it

**Commit messages** must follow conventional commits: `type(scope): description`
Valid types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`, `ci`, `build`

**Version** lives in `modules/utils.js` → `export const VERSION`. Add a `PATCH_NOTES[next_version]` entry before committing, or the hook will block.

## Running

Open `index.html` in a browser. No server required for gameplay.

```sh
# Run tests
npm test

# Lint
npm run lint

# Smoke test
node smoke.js
```

Install hooks once after cloning:
```sh
git config core.hooksPath .githooks
```
