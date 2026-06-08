# PRD: Economy Generation and Switching

## Context

Currently, the game uses `public/data/FishGameplay.csv` and `ShopGameplay.csv` to determine game progression values. These are being edited by hand, making game balancing difficult and unscalable.
We need a way to readily generate new FishGameplay and ShopGameplay values and easily test them.

## Requirements

### In-Game CSV Switching

- Add a section in the In-Game Debug Panel that allows for switching of values from the different CSV files, i.e. switching from `FishGameplay1.csv` to `FishGameplay2.csv` on the fly.
- This applies only

### Model Economy Tab CSV switching

- Add a section on the Economy tab on the Model page that allows for switching of Fish and Shop CSVs.
- Multiple pairs of CSVs can be selected at a time. When this happens, show the Income Rate (\$/s) and Income Rate (\$/rounds) graphs, and provide a line for each CSV pair. Also show the LurePurchases table, showing the TimeSincePrev column for each CSV pair.

### Model Economy Tab CSV generation

- Add a section on the Economy tab that allows for the testing and generation of new CSVs

**FUNCTION_SELECT input component**

A FUNCTION_SELECT input component will allow users to select different functions that determine the progression curve of a particular stat. Each function has different inputs that will appear accordingly.
The functions are as follows:

- LINEAR
  - Inputs: `StartValue`, `GrowthRate`
  - Formula: `StartValue + GrowthRate * LVL`
- EXPONENTIAL
  - Inputs: `StartValue`, `ScaleFactor`, `GrowthRate`
  - Formula: `StartValue + ScaleFactor * LVL^GrowthRate`

The LVL variable will vary based on what stat the FUNCTION_SELECT input is for, i.e. for any shop upgrades, the LVL will be the upgrade level of a given stat.

**FishGameplay CSV generation**
We need the following inputs:

- FUNCTION_SELECT input that determines both fish Attack and Defense
- FUNCTION_SELECT input that determines BasePrice
- Number input that determines the Min, Middle, Max fish values. This will determine the % range in stats between each level, i.e. an input of 0.1 means Min = 0.9, Middle = 1, Max = 1.1.
- Number input that determines how many "Levels" to generate for.

Using these, we can generate a FishGamePlay.csv as such:

| ID     | Attack        | Defense       | Thrash | BasePrice     | RequiredLure |
| ------ | ------------- | ------------- | ------ | ------------- | ------------ |
| FISH_1 | FN1(0)        | FN1(0)        | 1      | FN2(0)        |              |
| FISH_2 | FN1(1 \* Min) | FN1(1 \* Min) | 1      | FN2(1 \* Min) | LURE_1       |
| FISH_3 | FN1(1)        | FN1(1)        | 1      | FN2(1)        | LURE_1       |
| FISH_4 | FN1(1\* Max)  | FN1(1 \* Max) | 1      | FN2(1 \* Max) | LURE_1       |
| FISH_5 | FN1(2 \* Min) | FN1(2 \* Min) | 1      | FN2(2 \* Min) | LURE_2       |
| FISH_6 | FN1(2)        | FN1(2)        | 1      | FN2(2)        | LURE_2       |
| FISH_7 | FN1(2 \* Max) | FN1(2 \* Max) | 1      | FN2(2 \* Max) | LURE_2       |

Where FN1 is the first FUNCTION_SELECT input and FN2 is the second

Note that:

- Each "Level" has 3 fish, with the exception to the first level, which always has one.
- For each level, the RequiredLure increases.

**ShopGameplay CSV generation**
We will generate on the following stats:

- ATTACK
  - FUNCTION_SELECT for the price
  - Number input for ValuePerLevel
  - Number input for the number for upgrades
- DEFENSE
  - FUNCTION_SELECT for the price
  - Number input for ValuePerLevel
  - Number input for the number for upgrades
- LURE
  - FUNCTION_SELECT for the price
  - Number input for the number of lures

Using these, we can generate a ShopGameplay.csv as such:

| ID      | Price                   | Stat    | ValuePerLevel | Requirement |
| ------- | ----------------------- | ------- | ------------- | ----------- |
| ATTACK  | FN1(0) FN1(1)... FN1(N) | ATTACK  | N             |             |
| DEFENSE | FN2(0) FN2(1)... FN2(N) | DEFENSE | N             |             |
| LURE_1  | FN3(0)                  | LURE    | 1             |             |
| LURE_2  | FN3(1)                  | LURE    | 1             | LURE_1      |
| LURE_3  | FN3(2)                  | LURE    | 1             | LURE_2      |

Note that each lure is required by the previous lure.

## Solution

### In-Game CSV Switching

Fish gameplay CSVs live in `public/data/Fish/` and shop gameplay CSVs in `public/data/Shop/`. A Vite plugin (`csvManifestPlugin` in `vite.config.js`) reads both directories at build/dev startup and exposes their contents as the virtual module `virtual:csv-manifest` (`FISH_CSVS`, `SHOP_CSVS` string arrays). In dev mode, adding a file to either folder invalidates the module and triggers a full page reload.

`csvConfigStore` (Zustand) imports from the virtual module and tracks the currently active filenames, defaulting to the first entry of each list. `loadFishData` and `loadShopData` in `csvLoader.ts` accept an optional filename parameter and fetch from the appropriate subdirectory (`/data/Fish/` or `/data/Shop/`).

The Debug panel (`debug.tsx`) gets a **CSV Switcher** section: two `<select>` dropdowns populated from `FISH_CSVS` / `SHOP_CSVS`. Selecting a fish CSV immediately calls `initFish(newFile)`. Selecting a shop CSV calls `resetAllUpgradesDebug()` to undo any applied stat changes, then `initShop(newFile)`.

### Model Economy Tab — CSV Switching

`EconomyTab` drops its `fishData` and `shopData` props entirely and manages its own CSV pairs. A **CSV Pairs** section (simulation mode only) renders one row per pair: a color swatch, label input, Fish CSV dropdown, Shop CSV dropdown, and a Remove button. An **+ Add Pair** button appends a new row. Pair data is loaded lazily via `useEffect` whenever a pair is added or its CSV selection changes; the Run button shows "Loading…" until all pairs have data.

`simulateEconomy` is called once per pair on each run, results stored by pair ID.

The Income Rate ($/s) and Income Rate ($/round) charts render one `<Line data={...}>` per pair using Recharts' per-series data override, each in its `COLORS[i]` color with a Legend. Lure purchase vertical reference lines are shown on both Income Rate charts in all modes (single and multi-pair), colored to their respective pair's `COLORS[i]`.

When multiple pairs are active, all single-pair charts (Lure Income Rates, Lure Win %, Avg Remaining Line HP, Fish Income Rate, Catch Time, Player Stats, Upgrade Levels) are hidden.

The LurePurchases table pivots to one row per lure name (unioned across all pairs) with one `TimeSincePrev (s)` column per pair. The Cost column is hidden in multi-pair mode.

### Model Economy Tab — CSV Generation

Add a collapsible **Generate CSVs** panel below the existing Economy controls with two sub-sections: **Fish** and **Shop**.

**FUNCTION_SELECT component**: A `<select>` toggling between `LINEAR` and `EXPONENTIAL`. Visible numeric inputs change based on the selection (StartValue + GrowthRate for LINEAR; StartValue + ScaleFactor + GrowthRate for EXPONENTIAL).

**Fish Generator**: Two FUNCTION_SELECTs (Attack/Defense curve; BasePrice curve), a variance input (0–1, e.g. `0.1` → ±10%), and a level count. A live preview table shows generated rows following the layout from the Requirements section (one fish at level 0, three fish per subsequent level). A **Download FishGameplay.csv** button writes the result.

**Shop Generator**: Per-stat controls — ATTACK (price curve + ValuePerLevel + upgrade count), DEFENSE (same), LURE (price curve + lure count). A live preview table shows the generated rows with the correct Requirement chain for lures. A **Download ShopGameplay.csv** button writes the result.

Generated CSVs match the existing column format exactly so they can be dropped into `public/data/` and used immediately via the CSV switcher.

## Implementation Plan

### Phase 1 — In-Game CSV Switching

1. **`public/data/Fish/` and `public/data/Shop/`** — Create subdirectories; move `FishGameplay.csv` and `ShopGameplay.csv` into them respectively.
2. **`vite.config.js` — `csvManifestPlugin`** — Reads both directories at startup, exposes `FISH_CSVS` / `SHOP_CSVS` via `virtual:csv-manifest`. Invalidates the module and triggers a full reload when files are added or removed in dev.
3. **`src/csv-manifest.d.ts`** — Type declaration for the virtual module.
4. **`csvConfigStore.ts`** — New Zustand store importing from `virtual:csv-manifest`; tracks active `fishCSV` / `shopCSV`, defaulting to the first entry of each list.
5. **`csvLoader.ts`** — Add optional filename parameters to `loadFishData`, `loadShopData`, and `loadShopGameplayData`; fetch paths updated to `/data/Fish/` and `/data/Shop/`.
6. **`fishStore.ts` / `shopStore.ts`** — `initFish` and `initShop` accept an optional filename and pass it through to the loader.
7. **`debug.tsx` — CSV Switcher section** — Two `<select>` dropdowns populated from `FISH_CSVS` / `SHOP_CSVS`. Selecting a fish CSV calls `initFish(newFile)`; selecting a shop CSV calls `resetAllUpgradesDebug()` then `initShop(newFile)`.

### Phase 2 — Model Economy Tab: CSV Switching

1. **`EconomyTab.tsx` — remove props** — Drop `fishData` and `shopData` from the component signature; update `ModelView.tsx` accordingly.
2. **CSV pair state** — Add `CsvPair[]` state (`{ id, fishCSV, shopCSV, label }`), per-pair loaded data (`Record<id, { fish, shop }>`), and per-pair simulation results (`Record<id, EconomyRound[]>`).
3. **CSV Pairs UI** — Render a row per pair (color swatch, label input, Fish/Shop dropdowns, Remove button) above the simulation controls, simulation mode only. "Loading…" button state while any pair's CSV data is in flight.
4. **Data loading** — `useEffect` fetches fish and shop data for any pair that doesn't have it yet; clears loaded data and results when a pair's CSV selection changes.
5. **Multi-run simulation** — `runSim` iterates all pairs, calls `simulateEconomy` per pair, stores results by pair ID.
6. **Income Rate charts** — Single-pair: unchanged (lure regions, upgrade dots). Multi-pair: one `<Line data={...}>` per pair via Recharts per-series data override, each in `COLORS[i]` with a Legend.
7. **Lure purchase reference lines** — Always shown on both Income Rate charts; colored `COLORS[i]` to match the pair that triggered the purchase. Keys include pair ID to avoid collisions.
8. **Single-pair chart visibility** — Lure Income Rates, Lure Win %, Avg Remaining Line HP, Fish Income Rate, Catch Time, Player Stats, and Upgrade Levels are all hidden when multiple pairs are active.
9. **LurePurchases table** — Rows keyed by lure name (unioned across all pairs); one `TimeSincePrev (s)` column per pair. Cost column hidden in multi-pair mode.

### Phase 3 — Model Economy Tab: CSV Generation

1. **`FunctionSelect` component** — A self-contained input group: a `<select>` for `LINEAR` / `EXPONENTIAL`, then the matching numeric inputs. Exposes `(lvl: number) => number` via a prop callback or derived value. Lives in `shared.tsx` or a new `CsvGenerator.tsx`.
2. **`generateFishCSV` utility** — Pure function taking two `FunctionConfig` objects, variance, and level count. Returns a `string[][]` row array following the PRD layout (1 fish at level 0, 3 fish per subsequent level with Min/Middle/Max multipliers, `LURE_N` requirement per level).
3. **`generateShopCSV` utility** — Pure function taking ATTACK config (price curve, ValuePerLevel, upgrade count), DEFENSE config (same), and LURE config (price curve, lure count). Returns rows with space-separated prices and chained lure Requirements.
4. **Fish Generator UI section** — Two `FunctionSelect` inputs, a variance `NumInput`, a level count `NumInput`. Preview table updates live by calling `generateFishCSV`. Download button serializes to CSV and triggers a browser file download.
5. **Shop Generator UI section** — Per-stat control groups for ATTACK, DEFENSE, LURE. Preview table + Download button, same pattern as Fish Generator.
6. **Wire into `EconomyTab.tsx`** — Wrap both generators in a collapsible panel below the existing simulation controls.
