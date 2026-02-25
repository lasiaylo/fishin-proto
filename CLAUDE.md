# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fishin2Model is a two-part project: a **React/TypeScript incremental game prototype** (`prototype/`) and a **Python simulation engine** (`model/`) for economy balancing. The prototype is an idle/incremental game with resource management, tile purchasing, population growth, and production chains.

## Commands

### Prototype (React/Vite)

```bash
cd prototype
npm run dev        # Dev server on port 8000 (auto-opens browser)
npm run build      # Production build to dist/
npm run lint       # ESLint
npm run preview    # Serve production build locally
```

Pre-commit hook runs Prettier on all staged files via Husky + lint-staged.

### Model (Python)

```bash
source model/venv/bin/activate
python model/game_model.py    # Economy simulation with matplotlib plots
python model/fight_sim.py     # Fish fight mechanics simulation
```

## Architecture

### Game Loop & Event System

`GameLoop.ts` drives the game via `requestAnimationFrame`. It dispatches a `CustomEvent("UPDATE_EVENT")` each frame with `{ currTime, deltaTime }`. Stores subscribe to this event using `getEventFn()` to process tick-based updates.

### State Management (Zustand Stores)

All game state lives in Zustand stores with `subscribeWithSelector` middleware. Stores are in `prototype/src/stores/`:

- **`resourceStore.ts`** — Core resources (Money, Production, Jimby, Food, ExcessFood, CitySpace, Space). Each resource has `amount`, `capacity`, `baseCapacity`. The enum `RT` keys all resource access.
- **`vectorStore.ts`** — Passive generators that produce resources each tick. Enum `VectorT`. Rate = `amount * baseRate`. `initVectors()` wires up cross-store subscriptions (e.g., Jimby count drives Money generation rate).
- **`produceStore.ts`** — Production chains with progress bars (Kindle, Bakery, Housing).
- **`upgradeStore.ts`**, `cooldownStore.ts`, `fuelStore.ts`, `FieldStore.ts`, `actionStore.ts`, `delivererStore.ts`, `ventureStore.ts`, `workerStore.ts` — Other game systems.

### Cost System

`prototype/src/util/Costs.ts` handles exponential pricing. A `Cost` has `initCosts[]` (stepped base prices) and `growthRate` (exponential multiplier after init costs are exhausted). `useAtCost()` / `useEveryAtCost()` are hooks that reactively check affordability. `deductCost()` subtracts from resources.

### Naming Conventions

- **Type enums use short suffixes**: `RT` (ResourceType), `VectorT`, `ProduceT`
- **Store hooks**: `useResource`, `useVector`, etc. — Zustand selector pattern for minimal re-renders
- **Files**: Stores are lowercase (`resourceStore.ts`), components are PascalCase (`.tsx`)

### UI

Built with Radix UI (`@radix-ui/themes`) with accent gray / gray mauve theming. Pixi.js (`@pixi/react`) is available for 2D canvas rendering (currently commented out in App). Styling uses SCSS in `prototype/src/styles/`.
