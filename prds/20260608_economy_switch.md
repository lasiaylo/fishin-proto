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

Introduce a lightweight `csvConfigStore` (Zustand) that tracks the active filename for fish and shop CSVs (defaulting to `FishGameplay.csv` / `ShopGameplay.csv`). When the active filenames change, the fish and shop stores re-fetch their data using the new paths.

The Debug panel (`debug.tsx`) gets a new **CSV Switcher** section: two `<select>` dropdowns populated with known CSV variants discovered at runtime (files named `FishGameplay*.csv` / `ShopGameplay*.csv` served from `public/data/`), plus a **Reload** button that triggers a re-fetch. `loadFishData` and `loadShopGameplayData` in `csvLoader.ts` accept an optional filename parameter; the stores pass the currently active names from `csvConfigStore`.

### Model Economy Tab — CSV Switching

Add a **CSV Pairs** control strip above the Economy charts. A user can define one or more `{ fishCSV, shopCSV, label }` pairs using dropdowns (same known-file list) and add/remove rows. Each pair is run through `simulateEconomy` independently, which already accepts `fishData`/`shopData` as parameters, so the tab just loads and passes the right data per pair.

The Income Rate ($/s) and Income Rate ($/round) charts switch to multi-line mode: one `<Line>` per pair, colored and labelled by the pair's label. The LurePurchases table gains one `TimeSincePrev (s)` column per pair, with the pair label as the column header.

When only one pair is selected the UI is identical to today's behavior.

### Model Economy Tab — CSV Generation

Add a collapsible **Generate CSVs** panel below the existing Economy controls with two sub-sections: **Fish** and **Shop**.

**FUNCTION_SELECT component**: A `<select>` toggling between `LINEAR` and `EXPONENTIAL`. Visible numeric inputs change based on the selection (StartValue + GrowthRate for LINEAR; StartValue + ScaleFactor + GrowthRate for EXPONENTIAL).

**Fish Generator**: Two FUNCTION_SELECTs (Attack/Defense curve; BasePrice curve), a variance input (0–1, e.g. `0.1` → ±10%), and a level count. A live preview table shows generated rows following the layout from the Requirements section (one fish at level 0, three fish per subsequent level). A **Download FishGameplay.csv** button writes the result.

**Shop Generator**: Per-stat controls — ATTACK (price curve + ValuePerLevel + upgrade count), DEFENSE (same), LURE (price curve + lure count). A live preview table shows the generated rows with the correct Requirement chain for lures. A **Download ShopGameplay.csv** button writes the result.

Generated CSVs match the existing column format exactly so they can be dropped into `public/data/` and used immediately via the CSV switcher.

## Implementation Plan

### Phase 1 — In-Game CSV Switching

1. **`csvConfigStore.ts`** — New Zustand store with `fishCSV` and `shopCSV` string fields, defaulting to `FishGameplay.csv` / `ShopGameplay.csv`. Expose a `setCsvConfig` action.
2. **`csvLoader.ts`** — Add optional `fishFile` / `shopFile` parameters to `loadFishData` and `loadShopGameplayData`. Callers that omit them fall back to the defaults.
3. **`fishStore.ts` / `shopStore.ts`** — When `csvConfigStore` changes, re-invoke the loader with the new filenames and replace store data.
4. **`debug.tsx` — CSV Switcher section** — Two `<select>` dropdowns hard-coding the known CSV variant names (e.g. `FishGameplay.csv`, `FishGameplay2.csv`), bound to `csvConfigStore`. Selecting a new value triggers the store re-fetch.

### Phase 2 — Model Economy Tab: CSV Switching

1. **CSV pair state in `EconomyTab.tsx`** — Replace the single `fishData`/`shopData` props with a list of `CsvPair` objects `{ fishCSV, shopCSV, label }`. Add UI to add/remove pairs and pick filenames from the same known-file list.
2. **Data loading per pair** — When pairs change, fetch each pair's fish and shop CSVs using `loadFishData` / `loadShopGameplayData` with the filename param from Phase 1. Store results alongside each pair.
3. **Multi-run simulation** — Run `simulateEconomy` once per pair on demand, keyed by pair label. Store all results arrays.
4. **Income Rate charts** — Update Income Rate ($/s) and Income Rate ($/round) to render one `<Line>` per pair, each with a distinct color from `COLORS` and labeled by `pair.label`.
5. **LurePurchases table** — Recompute `lureRows` per pair. Pivot the table: rows are lures, columns are `TimeSincePrev (s)` per pair (header = pair label).

### Phase 3 — Model Economy Tab: CSV Generation

1. **`FunctionSelect` component** — A self-contained input group: a `<select>` for `LINEAR` / `EXPONENTIAL`, then the matching numeric inputs. Exposes `(lvl: number) => number` via a prop callback or derived value. Lives in `shared.tsx` or a new `CsvGenerator.tsx`.
2. **`generateFishCSV` utility** — Pure function taking two `FunctionConfig` objects, variance, and level count. Returns a `string[][]` row array following the PRD layout (1 fish at level 0, 3 fish per subsequent level with Min/Middle/Max multipliers, `LURE_N` requirement per level).
3. **`generateShopCSV` utility** — Pure function taking ATTACK config (price curve, ValuePerLevel, upgrade count), DEFENSE config (same), and LURE config (price curve, lure count). Returns rows with space-separated prices and chained lure Requirements.
4. **Fish Generator UI section** — Two `FunctionSelect` inputs, a variance `NumInput`, a level count `NumInput`. Preview table updates live by calling `generateFishCSV`. Download button serializes to CSV and triggers a browser file download.
5. **Shop Generator UI section** — Per-stat control groups for ATTACK, DEFENSE, LURE. Preview table + Download button, same pattern as Fish Generator.
6. **Wire into `EconomyTab.tsx`** — Wrap both generators in a collapsible panel below the existing simulation controls.
