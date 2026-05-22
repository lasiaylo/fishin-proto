# PRD: React Economy & Fight Simulation Charts

The Python files in `model/` duplicate the fight mechanics already implemented in `FightEngine.ts`. Maintaining two implementations of the same formulas creates drift risk — and already has (different growth constants, different super-attack bonus values). The fix is to move all simulation and visualization into React/TypeScript so balancing work happens in-browser and the Python files can be deleted.

## Context

The project has two parallel simulation systems:

- **`model/fight_sim.py`** — simulates fish fights; **`model/game_model.py`** — simulates the full round-by-round economy (player catches fish, earns money, buys upgrades). Both produce matplotlib charts for balancing.
- **`src/game/FightEngine.ts`** — the live in-game fight engine, used by `PondView` via `requestAnimationFrame`. It implements the same mechanics as `fight_sim.py` but has already diverged (speed growth 1.1 vs 1.06, super-attack bonus 10 vs 100).

There are no charts in the React app today. The existing debug panel (`debug.tsx`) exposes store state and lets the developer force-buy upgrades, but has no simulation tooling.

## Requirements

1. A "Model" view accessible at `localhost/debug` with three chart sections:

   - **Fight Trace** — plot line distance and tension over time for one or more simulated fights against a chosen fish, with phase shading (REST/STRUGGLE/SUPER)
   - **Parameter Sweep** — heatmap showing win% and avg fight time across a grid of player reel strength × drag values for a given fish
   - **Economy Progression** — chart income rate ($/sec) over cumulative time across a full simulated playthrough, with markers for upgrade purchases and lure unlocks

2. All charts must run directly in the browser using `FightEngine.ts` as the fight simulation engine — no calls to Python.

3. The Python model files (`fight_sim.py`, `fight_plot.py`, `game_model.py`, `game_model_plot.py`) are deleted once the React charts are verified.

4. TypeScript constants in `FightEngine.ts` become canonical. Do not change live game constants to match Python.

## Solution

Add a `runToCompletion()` method to `FightEngine` that runs a fight synchronously (tight loop, no RAF) and optionally records a frame history. This enables both multi-trial sweeps and fight replay charting.

Port `game_model.py`'s economy loop to a pure TypeScript function `simulateEconomy()` that uses `FightEngine.runToCompletion()` internally. It accepts fish data, shop data, and starting stats; returns per-round records (income, rate, upgrades bought, fish targeted).

Build a `ModelView` React component rendered as a standalone page at `/debug`. Use Recharts for line/area charts and a CSS grid for the heatmap (grids are small enough that a chart library adds no value there).

```
localhost/           → normal game (App)
localhost/debug      → ModelView (full page)
                        ├── Tab: Fight Trace
                        │   ├── Controls: fish selector, player stats, # trials
                        │   └── ComposedChart: distance + tension over time, phase shading
                        ├── Tab: Parameter Sweep
                        │   ├── Controls: fish selector, reel/drag ranges, trials/cell
                        │   └── CSS grid heatmaps: win% and avg time
                        └── Tab: Economy
                            ├── Controls: starting player stats
                            └── ComposedChart: $/sec rate + upgrade levels over time
```

## Implementation Plan

### Phase 1 — Extend FightEngine

Add to `src/game/FightEngine.ts`:

- Export `FrameRecord` interface: `{ time, distance, tension, phase }`
- `reset()` method — resets state for trial reuse without re-allocating
- `runToCompletion(recordHistory?)` method — synchronous fight loop with a 120s timeout and ±15 distance clamp per step (simulation only, `tick()` unchanged)

### Phase 2 — Economy Model

Create `src/game/EconomyModel.ts`:

- `SimPlayer` type: `{ reelStrength, drag, lineHP }`
- `EconomyRound` type: per-round record with time, income, rate, fish, upgrades
- `simulateEconomy(fishData, shopData, start?)` — port of `game_model.py`'s round loop; uses `FightEngine.runToCompletion()` for fight trials; starting defaults: `reelStrength=3, drag=3, lineHP=20`; one fish caught per round (no inventory multiplier)
- Uses `FishData` and `ShopUpgradeData` from `src/util/csvLoader.ts`

### Phase 3 — ModelView Component

Create `src/components/ModelView.tsx`:

- Loads fish/shop data independently via `loadFishData()` / `loadShopData()` on mount
- Three Radix `Tabs`: Fight Trace, Parameter Sweep, Economy
- Each tab has stat/param inputs and a "Run" button
- Economy simulation runs via `setTimeout(..., 0)` to avoid blocking the UI

**Fight Trace tab:**

- Runs `runToCompletion(true)` per trial; plots histories with Recharts `ComposedChart`
- Two synced subcharts (distance, tension); `ReferenceArea` segments for phase shading on single-trial view

**Parameter Sweep tab:**

- Nested loop over reel × drag grid; runs N trials per cell
- CSS `display: grid` with inline-colored cells; two grids side-by-side (win%, avg time)

**Economy tab:**

- Calls `simulateEconomy()`; plots income rate with Recharts `ComposedChart`
- Upgrade purchase events shown as scatter points; lure unlocks as vertical reference lines
- Second subchart shows upgrade levels over time using `type="stepAfter"` lines

### Phase 4 — Add /debug Route

Add `react-router-dom` to the project. Update `src/main.jsx` to wrap the app in a `<BrowserRouter>` with two routes:

- `/` → existing game (`<App />`)
- `/debug` → `<ModelView />`

`ModelView` renders as a full page (no close button, no overlay). The existing `debug.tsx` panel is unaffected.

### Phase 5 — Delete Python Files

After verifying charts in-browser:

- Delete `model/fight_sim.py`, `model/fight_plot.py`, `model/game_model.py`, `model/game_model_plot.py`
- Update `CLAUDE.md` to remove Python model references

### Test Plan

1. Navigate to `localhost/debug` — ModelView renders as a full page
2. Fight Trace: select Minnow, run 1 trial — chart shows distance reaching 0 (win) with phase shading visible
3. Fight Trace: run 5 trials — multiple lines render, no shading, win% in title
4. Parameter Sweep: select Trout — cells are green where reel/drag is high, red where low
5. Economy: run with defaults — income rate increases over time, upgrade markers visible at expected rounds
6. Play a normal game fight after all changes — confirm live fight still works (no regression in `tick()`)
