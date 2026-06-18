# Idle RPG Evolved

A modular rebuild of the original single-file idle RPG. The whole game used to
live in one 3,600-line `index.html`; it's now a typed, tested React app with a
framework-agnostic game engine and optional cloud saves.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # typecheck + production build to dist/
npm run test       # run the Vitest suite
npm run typecheck  # tsc, no emit
npm run lint       # eslint
```

The game runs **fully offline** out of the box (progress saved to
`localStorage`). Cloud saves are optional — see below.

## Architecture

```
src/
  game/
    types.ts            # all domain types (GameState, Player, Item, Monster, …)
    data/               # pure content — no logic. Tune the game here.
      classes.ts        #   classes, promotions, growth adjustments
      skills.ts         #   promotion skills
      monsters.ts       #   monster templates
      items.ts          #   rarities, item names, item sets
      constants.ts      #   stat tables, save key/version, final boss
    engine/             # pure, DOM-free game logic (unit-tested)
      state.ts          #   default state, class select, start, rebirth
      stats.ts          #   getPlayerTotalStats, true-damage curve
      combat.ts         #   runTick (the game loop), calculateDamage, skill procs
      loot.ts           #   drops, rarity rolls, monster spawning
      progression.ts    #   level up, promotions, kill/defeat handling
      economy.ts        #   shop, sell, enhance, invest, rebirth points
    save/               # persistence
      migrate.ts        #   versioned migration (legacy-compatible)
      local.ts          #   localStorage + base64 export/import
      cloud.ts          #   Supabase row-per-user save
      index.ts          #   SaveManager (local + cloud orchestration)
  lib/supabase.ts       # Supabase client (null when unconfigured)
  store/
    gameStore.ts        # Zustand store wrapping the engine
    useGameLoop.ts      # 1s tick + 15s autosave driver
    useAuth.ts          # Supabase session → SaveManager user
  ui/                   # React components (reuse the original CSS in styles.css)
  styles.css            # ported verbatim from the legacy game
legacy/index.html       # the original game, kept for reference & parity checks
supabase/schema.sql     # cloud-save table + row-level security
```

### Key design decisions

- **The engine is pure.** Every function takes `(state, ctx)` and mutates the
  passed `GameState`, emitting log lines through `ctx.log` and using `ctx.rng`
  for randomness. No `document`, no globals. This is why it can be unit-tested
  and seeded deterministically (see `engine.test.ts`).
- **Data is separated from logic.** Balancing a monster or adding an item set is
  a one-line edit in `game/data/*` — no need to touch combat code.
- **Saves are versioned and backward-compatible.** `migrateSave` ports the
  legacy v13 format (same `localStorage` key) and deep-merges against defaults,
  so existing players keep their progress.

## Cloud saves (optional)

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.

With those set, the System panel shows a magic-link sign-in. Once signed in,
progress syncs to the `saves` table (one row per user, protected by RLS) and
follows the account across devices. Without them, the auth UI is hidden and the
game stays local-only.

## Bugs fixed during the rebuild

- `resetTransientData` had its reset body wrapped in a nested function that was
  never called — transient buffs (shield charges, battle-rush stacks, …) were
  never actually cleared. Fixed in `engine/state.ts`.
- `levelUp` referenced an undefined `pointsGained` variable (a `ReferenceError`
  waiting to happen). Fixed in `engine/progression.ts`.
- Duplicate/commented `getRarityProbabilities` and dead code removed.
