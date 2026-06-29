
# PRD: Multiple Rods and Bait


## Context

With the addition of a "cast and wait" mechanic, there is design space in allowing players to casts multiple lines at once. 
This will add more avenues for progression in the game and more strategic depth from the player.

With multiple rods, there's also the need to expand the number of lures having BAIT type (currently just LURE_0). Let's create a new item distinction between Baits and Lures. This will more closely mirror real-life fishing and provide more economic options. 

## Requirements
- Rod item
  - A shop upgrade that allows players to purchase another rod.
  - Each rod have their own individual ATTACK / DEFENSE stat that can be upgraded.
  - Shop view needs to be updated to separate the ATTACK / DEFENSE for each rod.
- Multiple cast buttons + reelView on PondView
  - As players buy more rod holders, more cast buttons will show up on the Pondview.
  - These will be directly below one another, with a header "Rod 1". The reelView progress will be moved to the right of each cast button.
  - Move the lure dropdown + xp out of the Inventory view and have it on top of each button.
  - Add a Rod Dropdown that lets players choose which rod goes to which cast button. 
- Bait type in CSV
  - Bait will require cast and wait gameplay.
  - Each bait will have their own wait times. This can be specified in a separate BAIT_CSV and specified to the player in the ShopView when they hover the bait.
  - Player will no longer start out with LURE_0, but instead have BAIT_0 x 10.
  - Unlike Lures, Bait has limited used. Each fight (win or loss) consumes a bait.
  - This means that the shop will need to allow for purchasing multiple of the same bait (limit: 10)
- Inventory
  - Need to show bait count

## Solution

**Bait model**: A new `BaitGameplay.csv` (columns: `ID, WaitMin, WaitMax`) stores per-bait wait windows. Bait IDs are distinguished from lure IDs by a `"BAIT_"` prefix, so `getLureType` can return `BAIT` for any bait without a registry. `playerStore` gains a `baitInventory: Record<string, number>` field alongside the existing `ownedLures: Set<string>`. Both lures and baits are selectable via a unified `selectedItem` field (replacing `selectedLure`). Each fight end (win or loss) decrements the selected bait's count by 1; the cast button is disabled when the count hits 0. `startCastLoop` reads wait times from the bait's loaded data row (`waitMin`/`waitMax`) — this is the default (out-of-prime) range. When the bobber lands in a prime zone, the sampled duration is multiplied by `(1 - WAIT_PRIME_REDUCTION)`, shortening the wait by a flat percentage.

**Rod model**: `playerStore` gains `ownedRods: Array<{id: string, attack: number, defense: number}>` (defaulting to a single entry that absorbs the current global ATK/DEF) and `rodSlotAssignments: string[]` (one entry per visible cast row, each pointing at a rod ID). Buying a rod from the shop appends to both arrays and unlocks that rod's per-rod ATK/DEF upgrade entries. The global `attack`/`defense` fields on `PlayerState` are removed; all combat reads from the assigned rod's stats.

**PondView layout**: `PondView` renders one `RodRow` per entry in `rodSlotAssignments`. Each `RodRow` is fully self-contained — it owns its own `gameState`, rAF loop, and all refs. The row structure top-to-bottom:

```
Rod 1
[rod dropdown      ]
[lure/bait dropdown] [xp bar]   <- hidden when rod = NONE
[cast button] [ReelView          ] <- hidden when rod = NONE
```

The rod dropdown lists `ownedRods` plus a "None" option at the top. When "None" is selected, the lure/bait dropdown, XP bar, and cast button are hidden and the slot is effectively inactive. The lure/bait dropdown lists owned lures and baits (with counts). `startFight` inside each row reads ATK/DEF from the assigned rod's entry.

**Shop changes**: A new `ROD` stat type in `ShopGameplay.csv` registers a rod purchase. New `ROD_ATTACK` / `ROD_DEFENSE` stat types with upgrade IDs encoding the target rod (e.g. `ROD_ATTACK_ROD_2`) apply to a specific rod's stats. `ShopView` groups per-rod upgrades under "Rod N" sub-headers. Bait items use a `BAIT` stat type; buying one calls `addBait(id, 1)` capped at `BAIT_MAX_STACK = 10`. The `isMaxed` check for bait uses `baitInventory[id] >= BAIT_MAX_STACK` rather than the `level` counter. Bait hover tooltips show the wait range from `BaitGameplay.csv`.

## Implementation Plan

### Phase 1 — Bait data layer

**`public/data/Bait/BaitGameplay.csv`** (new file): columns `ID, WaitMin, WaitMax`. Initial row: `BAIT_0, 2, 8`.

**`src/util/csvLoader.ts`**:
- Add `BaitData` interface: `{ id: string, waitMin: number, waitMax: number }`.
- Add `loadBaitData()` async function (fetches `/data/Bait/BaitGameplay.csv`).
- Add `StatName.BAIT = "BAIT"`, `StatName.ROD = "ROD"`, `StatName.ROD_ATTACK = "ROD_ATTACK"`, `StatName.ROD_DEFENSE = "ROD_DEFENSE"` to the `StatName` enum.

**`src/util/constants.ts`**:
- Replace `BASE_LURE_ID` / `BASE_LURE_NAME` with `BASE_BAIT_ID = "BAIT_0"` / `BASE_BAIT_NAME = "Worm"`.
- Add `BAIT_MAX_STACK = 10` and `BAIT_ID_PREFIX = "BAIT_"`.
- Update `getLureType`: return `BAIT` when `lureId.startsWith(BAIT_ID_PREFIX)`, otherwise `LURE`. Remove the `BASE_LURE_ID` comparison.
- Remove global `WAIT_PRIME_MIN/MAX` / `WAIT_DEFAULT_MIN/MAX` constants — wait ranges now come from `BaitData`. Add `WAIT_PRIME_REDUCTION = 0.5` (flat percentage by which the sampled wait is shortened when the bobber is in a prime zone).
- Update `INITIAL_PLAYER_STATE`: replace `ownedLures: new Set([BASE_LURE_ID])` and `selectedLure: BASE_LURE_ID` with `baitInventory: { BAIT_0: 10 }`, `selectedItem: "BAIT_0"`, and `ownedRods: [{id: "ROD_1", attack: INIT_AD, defense: INIT_AD}]`, `rodSlotAssignments: ["ROD_1"]`. Remove the global `attack` / `defense` from the initial state (they live on the rod now).

### Phase 2 — Player store

**`src/stores/playerStore.ts`**:
- Add `baitInventory: Record<string, number>` and `selectedItem: string | null` to `PlayerState`. Remove `selectedLure`.
- Add `ownedRods: Array<{id: string, attack: number, defense: number}>` and `rodSlotAssignments: (string | null)[]` (`null` = "None"). Remove the top-level `attack` / `defense` fields (they now live inside each rod entry).
- Add `consumeBait(id)`: decrements count, floor 0.
- Add `addBait(id, qty)`: increments count, ceiling `BAIT_MAX_STACK`.
- Add `addRod(id)`: appends `{id, attack: INIT_AD, defense: INIT_AD}` to `ownedRods` and pushes `id` to `rodSlotAssignments`.
- Add `assignRodToSlot(slotIdx, rodId)`.
- Add `addToRodStat(rodId, stat, value)`: finds the rod by ID and bumps the named stat.
- Rename all `setSelectedLure` callsites to `setSelectedItem`.

### Phase 3 — Shop store wiring

**`src/stores/shopStore.ts`**:
- Add `BAIT` case in `buyUpgrade` / `setUpgradeLevelDebug`: calls `addBait(upgrade.id, upgrade.valuePerLevel)`. The upgrade's `level` field is not incremented for bait (purchases are unrestricted up to the inventory cap); `isMaxed` for bait returns `baitInventory[id] >= BAIT_MAX_STACK`.
- Add `ROD` case: calls `addRod(upgrade.id)`.
- Add `ROD_ATTACK` case: parse the target rod ID from `upgrade.id` (convention: `ROD_ATTACK_<rodId>`), call `addToRodStat(rodId, "attack", upgrade.valuePerLevel)`.
- Add `ROD_DEFENSE` case: same pattern for defense.
- Remove `ATTACK` and `DEFENSE` global cases (stats now live on rods).

**`public/data/Shop/ShopGameplay.csv`**:
- Remove `ATTACK`, `ATTACK_2`, `DEFENSE`, `DEFENSE_2` rows (replaced by per-rod entries).
- Add:
  - `ROD_2, 50, ROD, 1,`
  - `ROD_ATTACK_ROD_1, 20 20 20 20, ROD_ATTACK, 1,`
  - `ROD_DEFENSE_ROD_1, 20 20 20 20, ROD_DEFENSE, 1,`
  - `ROD_ATTACK_ROD_2, 30 30 30 30, ROD_ATTACK, 1, ROD_2`
  - `ROD_DEFENSE_ROD_2, 30 30 30 30, ROD_DEFENSE, 1, ROD_2`
  - `BAIT_0, 5, BAIT, 1,` (replenish Worm bait, ×10 cap)

**`public/data/ShopDisplay.csv`**:
- Add display rows for all new upgrade IDs (names, descriptions, categories).

### Phase 4 — Bait consumption in fight

**`src/components/PondView.tsx`**:
- Replace all references to `selectedLure` with `selectedItem`.
- In `finishFight`: after lure XP is granted, if `getLureType(selectedItem) === LureType.BAIT`, call `consumeBait(selectedItem)`.
- In `startCastLoop`: look up the active item's `BaitData` row (from a loaded bait registry) to get `waitMin` / `waitMax`. Sample the timer from `[waitMin, waitMax]` (the default range). If the bobber is in a prime zone, multiply the sample by `(1 - WAIT_PRIME_REDUCTION)` before starting the countdown.
- Disable the cast button when `getLureType(selectedItem) === BAIT && baitInventory[selectedItem] === 0`.

### Phase 5 — Inventory view

**`src/components/InventoryView.tsx`**:
- Remove the lure dropdown and XP bar (moved to `RodRow` in Phase 6).
- Add a bait section: for each entry in `baitInventory`, show `"[name] × [count]"`. Names resolved from the loaded `BaitData` array.

### Phase 6 — Multi-rod PondView

**`src/components/PondView.tsx`**:
- Extract the entire cast/fight state (all refs + `gameState` + `luringDistance` + `fightState`) into a `RodRow` component. `RodRow` accepts `slotIndex: number` as a prop and reads its assigned rod's stats from `ownedRods` via `rodSlotAssignments[slotIndex]`.
- `PondView` reads `rodSlotAssignments.length` and renders that many `RodRow` components in a vertical flex column.
- Each `RodRow` layout (using a nested flex):
  - Row header: `"Rod {slotIndex + 1}"`
  - Rod assignment dropdown (lists "None" + `ownedRods`; current assignment pre-selected; on change calls `assignRodToSlot`)
  - If assigned rod is not "None": lure/bait select dropdown + XP progress bar (hidden for baits), then horizontal flex with cast/idle/reel controls on the left and `ReelView` on the right
  - If assigned rod is "None": nothing else is rendered for that slot
- `startFight` inside each `RodRow` reads `attack`/`defense` from `ownedRods.find(r => r.id === assignedRodId)`.

### Phase 7 — ShopView grouping

**`src/components/ShopView.tsx`**:
- Within the "rod upgrades" category, detect `ROD_ATTACK_*` / `ROD_DEFENSE_*` IDs and group them under a "Rod N" sub-header derived from the upgrade's target rod.
- Bait items (stat = `BAIT`) render with a hover tooltip showing the wait range (fetched from the loaded `BaitData` registry).
- The disabled state for bait shop buttons uses the inventory-cap check instead of `isMaxed`.

### Phase 8 — Economy Model

**`src/game/EconomyModel.ts`**:

**`expectedWaitTime`** — currently reads `WAIT_PRIME_MIN` / `WAIT_PRIME_MAX` from constants (both removed). Change signature to `expectedWaitTime(bait: BaitData): number`. Assume optimal play (player always in a prime zone): return `(bait.waitMin + bait.waitMax) / 2 * (1 - WAIT_PRIME_REDUCTION)`.

**`perCastOverhead`** — add a `bait: BaitData | undefined` parameter. For `LureType.BAIT`, pass `bait!` to `expectedWaitTime`; for `LureType.LURE`, the existing `expectedLuringTime` call is unchanged. Update the two `LureType.CAST_AND_WAIT` / `LureType.CAST_AND_LURE` comparisons to `LureType.BAIT` / `LureType.LURE`.

**`simulateEconomy`** — four changes:

- **`LureType` references**: update both `isWait` checks (`LureType.CAST_AND_WAIT` → `LureType.BAIT`).

- **Bait cost**: for a `BAIT` lure, each fight (win or loss) consumes one bait. Expected fights per round = `inventorySize / winRate`. Bait unit price comes from the `BAIT` shop entry matching the active lure ID. Compute `baitCostPerRound = (inventorySize / winRate) * baitUnitPrice` and deduct it from `wallet` each round alongside income. Expose `baitCost: number` in `EconomyRound`. For `LURE` types, `baitCost = 0`.

- **Multiple rods**: track `rodCount` (starts at 1) alongside `player`. Round time = `(inventorySize * catchTime) / rodCount` — rods fish in parallel so wall-clock time scales down. Use the average ATK/DEF across all owned rods for fight simulation (the model does not simulate heterogeneous rods per slot). Add `rodCount: number` to `EconomyRound`.

- **`applyUpgrade`** — add cases for the new stat types:
  - `BAIT`: no-op (bait is modeled as a continuous cost, not an upgrade level).
  - `ROD`: increment the local `rodCount` tracker.
  - `ROD_ATTACK` / `ROD_DEFENSE`: parse the target rod index from the upgrade ID and bump that rod's stat entry; recompute the average ATK/DEF passed to fight simulation.

**`cheapestUpgrade`** — add `BAIT` and `ROD` / `ROD_ATTACK` / `ROD_DEFENSE` to the stat value switch so they are not excluded from purchase consideration.

**`EconomyRound`** — add `baitCost: number` and `rodCount: number` fields.

### Phase 9 — CSV Generator



**`src/components/model/CsvGenerator.tsx`**:

**`generateShopRows`** — add a bait replenishment section at the end of the generated rows. For each bait tier `i` from `0` to `baitCount - 1`, emit:

```
BAIT_i, [price], BAIT, 1, [requirement]
```

where `requirement` is empty for `BAIT_0` and `LURE_i` for `BAIT_i` (bait tiers unlock alongside the corresponding lure). The price is computed from a `baitFn: FunctionConfig`. Add `baitFn`, `baitCount` parameters to `generateShopRows` and wire them through `ShopGenerator` state with a `DEFAULT_BAIT_FN` and a `BAIT` section in the UI matching the existing `LURE` block.

**New `generateBaitRows` function** — generates rows for `BaitGameplay.csv` (columns: `ID, WaitMin, WaitMax`) for each tier `i` from `0` to `baitCount - 1`. Wait times come from two new `FunctionConfig` inputs: `waitMinFn` and `waitMaxFn`. Add this to `ShopGenerator` (not a separate panel — bait wait times are a balancing concern alongside shop prices) and expose a "Download BaitGameplay.csv" button next to the existing shop download button.

**`SHOP_DEFAULTS`** — add `baitFn: DEFAULT_BAIT_FN`, `baitCount: 1`, `waitMinFn: DEFAULT_WAIT_MIN_FN`, `waitMaxFn: DEFAULT_WAIT_MAX_FN`. Persist these keys to `SHOP_STORAGE_KEY` alongside the existing fields.

**`getGeneratedShopRows`** — pass the new bait params through so the function stays in sync with what the panel produces.

### Test Plan

- Bait count starts at 10; decrements on fight end (both win and loss); cast button becomes disabled at 0.
- Buying Worm Bait from shop: count increments by 1, button grays out at 10.
- Buying Rod 2: a second `RodRow` appears in PondView; the rod dropdown on each row lists both rods.
- Per-rod ATK/DEF shop upgrades appear only after buying the corresponding rod.
- Both rod rows can be in an active cast/fight state simultaneously and independently.
- Assigning Rod 2 to slot 1 via the rod dropdown; verify the fight uses Rod 2's ATK/DEF.
- Lure/bait dropdown and rod dropdown selection persist independently per slot across fights.
