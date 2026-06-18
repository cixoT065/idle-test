# Revamp roadmap

This document tracks the infra revamp. **Phase 1 (foundation) is done.** The
sections below are the remaining, mostly-mechanical work.

## ✅ Gameplay v2 — Systems revamp (complete)

A deliberate balance break (bumped `SAVE_KEY`/`SAVE_VERSION` → 15, old saves reset):

- **Stats:** every stat has a role — STR melee+DEF, INT magic+true dmg, DEX
  finesse+accuracy+crit, AGL evasion + **attack speed** (multi-attacks/tick, cap
  2.5x), CON HP (+regen). Fixed the HP formula (class base HP + CON, multiplicative
  rebirth HP). Rebirth gained Crit DMG / Attack Speed / Drop Rate bonuses.
- **Equipment:** 5 slots (weapon/helm/body/legs/accessory), **class-biased drops**
  (~75% your class), per-slot core stats, **affixes** (lifesteal/%HP/reflect/…),
  stronger wave scaling.
- **Sets:** LR sets are now **5-piece** with tiered set skills at 2/5, 4/5, 5/5
  (`grantsSkill`), surfaced via `getActiveSkills`/`hasSkill`.
- **Bosses & combat:** mutant/elite **modifiers** (Vampiric/Armored/Swift/Frenzied/
  Volatile) with richer rewards; **boss phases** (enrage <50%, frenzy <25%);
  challenging a boss now spends the kill counter (no degenerate re-challenge loop).
- **Classes/skills:** L70 is a real choice — each tier-2 class offers two capstones
  (12 new passive capstone skills via `data/skills.ts capstonePassives`).
- Engine stays pure/tested (21 unit tests incl. a full auto-played smoke run).

## ✅ Phase 1 — Foundation (complete)

- Vite + React + TypeScript project, strict mode, path aliases.
- Game data extracted into typed `game/data/*` modules.
- Pure, DOM-free game engine ported from the legacy script (combat, skills,
  loot, progression, economy) — unit-tested with a seeded RNG.
- Versioned save layer: legacy-compatible local saves, base64 export/import,
  and Supabase cloud sync behind a `SaveManager`.
- Zustand store + 1s tick / 15s autosave loop.
- React UI reusing the original CSS (profile, combat, logs, shop, inventory,
  blacksmith, rebirth, class/promotion modals, auth bar).
- Latent bugs fixed (see README).

## ✅ Retention & idle systems (complete)

Three tiers of engagement features layered on the v2 combat core:

- **Offline progression** (`engine/offline.ts`): on load, estimates kills/gold/XP/drops
  for time away (60% efficiency, 12h cap) from a `lastSeen` save stamp; shown in a
  welcome-back modal.
- **Automation** (`engine/automation.ts`): auto-equip / auto-sell / auto-boss /
  auto-potion, each unlocked once with rebirth points and configured in the Rebirth tab.
- **Endless waves**: the wave-35 cap is gone; scaling continues for an always-rising
  ceiling.
- **Achievements** (`data/achievements.ts`) & **daily login/objectives**
  (`engine/meta.ts`): a Goals tab; achievement rewards fold into the rebirth-bonus
  multipliers (persist through rebirth, reset on New Game).
- **Champions**: rare ⭐ elites with boosted stats + guaranteed boss-tier loot; two new
  monster modifiers (Giant, Berserk).
- **Loadouts** (`engine/meta.ts`): 3 sidebar gear presets for farm/boss swapping.
- **Juice**: kill-streak counter (top bar + combat), legendary-drop screen flash,
  champion banner.
- Covered by `engine/meta.test.ts` (offline, automation, achievements, dailies,
  loadouts, endless waves).

## Phase 2 — Parity & polish

- [x] Port the **Game Info modal** content (stats/items/combat/classes/rebirth/
      drop-rate tables) → `ui/InfoModal.tsx`, opened from the System panel.
- [x] Item **tooltips** with full stat breakdown + equip preview using
      `getPlayerTotalStats(state, hypotheticalItem)` → `ui/ItemTooltip.tsx` +
      `ui/tooltip.ts`, wired into inventory and equipment.
- [x] "Challenge Final Boss" button (engine `challengeFinalBoss` / `isFinalBoss`)
      → opt-in, **always available** in the combat panel (when not already in a boss
      fight). Each wave boss cleared weakens it −2.5% (floor 10%); resets each run /
      on rebirth. Never auto-triggered.
- [x] Inventory sorting/filtering and stack-sell for SR+/all rarities.
      Rarity/type filters + rarity/value/name sort in `ui/Tabs.tsx`; a
      filter-aware "Sell Shown" stack-sell (engine `sellItems`, confirms before
      dumping SSR+). `sellByRarity` now delegates to `sellItems`.
- [x] ~~Verify numeric parity against `legacy/index.html`~~ — **obsolete:** the
      Gameplay v2 revamp intentionally diverges from the legacy balance.

## Phase 3 — Tooling & quality

- [ ] ESLint flat config + CI (typecheck + test + build on PR).
- [ ] Prettier + format-on-commit.
- [ ] Expand engine test coverage to each skill proc (Bleed, Arcane Power,
      Reality Break, Aegis Block, …) using seeded RNG.
- [ ] Bundle-size budget; code-split Supabase out of the initial chunk.

## Phase 4 — Backend depth (optional)

- [ ] Server-authoritative save validation (anti-tamper) via a Supabase Edge
      Function instead of trusting the client blob.
- [ ] Leaderboards (max wave / rebirth points) — new table + RLS read policy.
- [ ] Conflict resolution UI when local and cloud saves diverge (currently
      cloud wins on load).

## Notes for contributors

- Engine functions must stay pure: take `(state, ctx)`, never touch the DOM or
  `Math.random` directly (use `ctx.rng`). This keeps them testable.
- Tune gameplay in `game/data/*`, not in the engine.
- When changing the persisted shape, bump `SAVE_VERSION` and add a migration
  step in `game/save/migrate.ts`.
