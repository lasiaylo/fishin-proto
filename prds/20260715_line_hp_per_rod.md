
# PRD: Line HP Per Rod

## Context

`lineHP` (how much tension a line can take before snapping) currently lives as a single global stat on `PlayerStats`/`PlayerState` (`src/stores/playerStore.ts`), defaulting to `20` in `INITIAL_PLAYER_STATE`. Every rod the player owns shares this one value.

The game already has an established pattern for per-rod, levelable combat stats — `attack`/`defense` — via `Rod.attackLevel`/`defenseLevel`, `RodData.attackLevels`/`defenseLevels` (arrays indexed by level, loaded from `RodGameplay.csv`), a `StatName.ROD_ATTACK`/`ROD_DEFENSE` shop-upgrade type, and the `setRodLevel`/`applyStatEffect`/`applyUpgrade` wiring that connects a shop purchase to a specific owned rod. `lineHP` should move onto rods using this same pattern, rather than staying a global player stat, so that different rods can meaningfully trade off line durability against attack/defense/speed.

`FightEngine.ts` (the real-time fight simulation) already takes `lineHp` as a plain constructor argument decoupled from `PlayerStats` — it has no knowledge of where the value comes from, so only its callers need to change.

## Requirements

- Each rod has its own Line HP stat, upgradeable independently of other rods — structurally equivalent to how Attack and Defense already work per rod.
- A new shop upgrade per owned rod (e.g. "line") lets the player spend currency to raise that rod's Line HP, following the same purchase/leveling/pricing mechanics as the existing per-rod Attack/Defense upgrades (unlocks once the rod is owned, has a fixed number of levels with a price curve, shown in the shop's "rods" category).
- The player-facing line-HP bar and fight resolution (crit chance, line-break condition) must reflect the Line HP of whichever rod is actually equipped in that cast, not a single shared value.
- The offline economy/balancing model (`EconomyModel.ts`, the Model tab at `/debug`) must simulate each rod's own Line HP so balancing curves stay accurate once rods diverge.
- The debug CSV generator (which procedurally builds `ShopGameplay.csv` price curves) must be able to generate the new per-rod Line HP upgrade rows alongside the existing per-rod Attack/Defense generation, so designers can tune its price curve the same way.
- Session CSV export/import (used for recording and replaying play sessions in the Model tab) must continue to capture line HP, now sourced from the equipped rod rather than the player.

## Solution

Move `lineHP` off `PlayerStats` and onto the rod data model, mirroring `attack`/`defense` exactly:

- **Data**: `RodGameplay.csv` gains a `LineHP` column (a space-separated list of per-level values, like `Attack`/`Defense`) parsed into a new `RodData.lineHpLevels: number[]`. Each owned `Rod` gains a `lineHpLevel: number` (starting at 0), the same way it already tracks `attackLevel`/`defenseLevel`. The rod's current line HP is resolved via the same level-lookup helper used for attack/defense.
- **Shop upgrade**: A new stat type, `ROD_LINE_HP`, is added alongside `ROD_ATTACK`/`ROD_DEFENSE`. Upgrade rows are added to `ShopGameplay.csv` per rod (e.g. `ROD_1_LINE_HP`, `ROD_2_LINE_HP`), following the existing `<ROD_ID>_ATTACK` / `<ROD_ID>_DEFENSE` id convention, price-curve shape, and "requires the rod to be owned" gating. Purchasing it raises that specific rod's `lineHpLevel`, using the same code path that already applies attack/defense purchases to a specific rod.
- **Gameplay & fight resolution**: Anywhere the game currently reads the player's global `lineHP` to run a fight (live gameplay in `PondView.tsx`, the line-HP bar in `ReelView.tsx`, session logging) instead reads it from the currently equipped rod's stats, the same way attack/defense/speed are already read per-rod.
- **Economy model**: The offline balancing simulation (`EconomyModel.ts`) resolves line HP per simulated rod instead of from a shared player value, and its "cheapest upgrade" purchasing heuristic and CSV-round-export logic are updated to know about the new stat type and where the value now lives.
- **Debug tooling**: The Model tab's standalone simulation controls (Economy, Graphs, Fight Trace sub-tabs) default their Line HP sliders from the modeled rod's data instead of the old global default. The CSV generator gains a Line HP price-curve control mirroring its existing Attack/Defense controls, producing the new per-rod upgrade rows when generating `ShopGameplay.csv`.
- **Balance continuity**: Initial data is chosen so that, at level 0, every rod's Line HP equals today's global value (20), and the new upgrade's price curve mirrors that rod's existing Attack/Defense price curve — so nothing about current game balance changes until a player actually buys the new upgrade. Exact tuning is just CSV data and can be adjusted independently later.

## Implementation Plan

### Phase 1 — Data model
- `src/util/csvLoader.ts`: add `StatName.ROD_LINE_HP`; add `lineHpLevels: number[]` to `RodData`; parse the new `LineHP` CSV column in `loadRodData()`; classify `ROD_LINE_HP` under the `"rods"` shop category.
- `src/util/constants.ts`: add `lineHpLevel: number` to the `Rod` interface; remove `lineHP` from `INITIAL_PLAYER_STATE` (now implicit via each rod's level-0 value); give the starting rod `lineHpLevel: 0`.
- `public/data/Rod/RodGameplay.csv`: add a `LineHP` column for each rod, seeded so level 0 equals the current global value (20) for every rod.

### Phase 2 — Player & rod stores
- `src/stores/playerStore.ts`: remove `lineHP` from `PlayerStats`; give newly-purchased rods a starting `lineHpLevel: 0`; allow `setRodLevel` to target the new level field.
- `src/stores/rodStore.ts`: include the resolved `lineHP` value in the per-rod stats accessor used throughout gameplay code (`getRodStats`).

### Phase 3 — Shop upgrade
- `src/stores/upgradeStoreFactory.ts`: teach the upgrade-purchase logic to apply a `ROD_LINE_HP` purchase to the correct owned rod, mirroring the existing `ROD_ATTACK`/`ROD_DEFENSE` handling.
- `src/components/UpgradeCatalogGrid.tsx`: keep a maxed-out Line HP upgrade tile visible in the shop, matching current Attack/Defense behavior.
- `public/data/Shop/ShopGameplay.csv` and `public/data/ShopDisplay.csv`: add a Line HP upgrade entry (id, price curve, display name/description) per existing rod.

### Phase 4 — Live gameplay
- `src/components/PondView.tsx`: fight-start and fight-resolution logic reads Line HP from the currently equipped rod (same lookup already used for attack/defense/speed) instead of the player's global stat.
- `src/util/roundSerializer.ts` / session logging: the recorded Line HP value for a round comes from the rod that fought, not the player.

### Phase 5 — Economy model & debug tooling
- `src/game/EconomyModel.ts`: fight-trial simulation, remaining-line-HP calculations, and the "pick cheapest available upgrade" purchasing heuristic all resolve Line HP per simulated rod rather than from a shared player value.
- Model tab (`EconomyTab.tsx`, `GraphsTab.tsx`, `FightTraceTab.tsx`): default their standalone Line HP controls from the modeled rod's data rather than the old global constant.
- `src/components/model/CsvGenerator.tsx`: add a Line HP price-curve control (mirroring the existing per-rod Attack/Defense controls) so generated `ShopGameplay.csv` files include the new per-rod upgrade rows.

### Test Plan

- Fighting with the starting rod behaves identically to today (line-HP bar, crit chance, break condition) — confirms the level-0 seed data preserves current balance.
- Buying the new "line" upgrade for a rod in the shop increases that rod's line HP on the next fight, and does not affect any other owned rod.
- With two rods equipped with different Line HP levels, each rod's fight independently reflects its own value.
- The Model tab's Economy/Graphs/Fight Trace sub-tabs run without errors and show sane Line HP defaults sourced from rod data.
- The CSV generator produces a per-rod Line HP upgrade row for every generated rod, with a reasonable price curve.
- A recorded play session, exported to CSV and re-imported, round-trips the correct per-rod line HP value.
