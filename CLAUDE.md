# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fishin2Model is a React game with a built-in balancing tool.

## Commands

### Dev server

```bash
npm run dev
```

Visit `localhost:5173/model` for the Model view (`src/components/ModelView.tsx`, tabs in `src/components/model/`). It has two parent tabs:

- **Field** — sit income and the fields shop (`FieldTab.tsx`), powered by `src/game/FieldModel.ts`.
- **Fish** — Fight Trace, Parameter Sweep, Economy, and Graphs tabs powered by `src/game/FightEngine.ts` and `src/game/EconomyModel.ts`.

### Other scripts

```bash
npm run build   # production build
npm run lint    # eslint
```

A husky pre-commit hook runs Prettier on staged files via lint-staged.

## Game data

Gameplay data lives in CSVs under `public/data/` (fish, bait, rods, shop, locations, story), loaded with Papa Parse in `src/util/csvLoader.ts`. Game state lives in zustand stores under `src/stores/`.

Story beats are driven by `public/data/Story.csv` and fired by `src/game/StoryTriggerListener.ts`; see `public/data/STORY_README.md` for the row format and the metrics a `when` condition can check.

## Architecture: In-Game Engine vs. Economy Model

The project has two parallel systems that must be kept in sync.

### In-Game Engine (`src/game/FightEngine.ts`, `src/components/PondView.tsx`)

The real-time gameplay loop. `PondView.tsx` drives the cast/lure/fight flow using `requestAnimationFrame` and interval timers. `FightEngine.ts` runs the per-tick fight simulation. These files define what the player actually experiences.

### Economy Model (`src/game/EconomyModel.ts`)

An offline simulation used for balancing. It runs hundreds of rounds analytically (no real-time loop) and outputs income rates, win rates, and upgrade curves shown in the Model tab at `/debug`. It reimplements game mechanics as closed-form expectations so the model can simulate hours of gameplay in milliseconds.

### The rule: keep them in sync

**Any gameplay change that affects timing, bite probability, XP gain, or fight outcomes must be reflected in the economy model.** The model is not automatically derived from the game code — it is a parallel, analytical approximation. Specific things to audit when making a gameplay change:

- **New mechanic timing** (e.g. a wait phase, a new animation): add a corresponding expected-time term to `perCastOverhead` in `EconomyModel.ts`.
- **Bite probability changes** (e.g. per-check probability, escalation logic, pBite formula): update `castBiteProbability`, `expectedLuringTime`, or `expectedWaitTime` (bait).
- **XP gain changes**: update the XP-per-round block in `simulateEconomy` (lure XP goes through `applyLureXp` / `computeLureLevel`).
- **Fields changes** (sit payout/cooldown, `SIT_*` / `WIND` / `UNLOCK_POND` upgrade effects in `src/stores/fieldsStore.ts`, `src/stores/passiveIncomeStore.ts`, or `applyStatEffect` in `src/stores/upgradeStoreFactory.ts`): mirror them in `src/game/FieldModel.ts`, which `EconomyModel.ts` deliberately skips.
- **New tackle behaviour** (e.g. a mechanic that differs between bait and lures): branch on `getTackleType(lureId) === TackleType.BAIT` in any affected economy function.

## Background jobs: no automatic PRs

When running as a background job in this repo, do not open a pull request when finishing a task. Commit the work, but do not push it.

## Recaps

When recapping, don't mention any actions around commits or PRs. The recap should only be able the actual changes to the code that were made.
