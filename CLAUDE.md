# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fishin2Model is a React game with a built-in balancing tool.

## Commands

### Dev server

```bash
npm run dev
```

Visit `localhost:5173/debug` for the Model view — fight trace, parameter sweep, and economy simulation charts powered by `src/game/FightEngine.ts` and `src/game/EconomyModel.ts`.

## Architecture: In-Game Engine vs. Economy Model

The project has two parallel systems that must be kept in sync.

### In-Game Engine (`src/game/FightEngine.ts`, `src/components/PondView.tsx`)

The real-time gameplay loop. `PondView.tsx` drives the cast/lure/fight flow using `requestAnimationFrame` and interval timers. `FightEngine.ts` runs the per-tick fight simulation. These files define what the player actually experiences.

### Economy Model (`src/game/EconomyModel.ts`)

An offline simulation used for balancing. It runs hundreds of rounds analytically (no real-time loop) and outputs income rates, win rates, and upgrade curves shown in the Model tab at `/debug`. It reimplements game mechanics as closed-form expectations so the model can simulate hours of gameplay in milliseconds.

### The rule: keep them in sync

**Any gameplay change that affects timing, bite probability, XP gain, or fight outcomes must be reflected in the economy model.** The model is not automatically derived from the game code — it is a parallel, analytical approximation. Specific things to audit when making a gameplay change:

- **New mechanic timing** (e.g. a wait phase, a new animation): add a corresponding expected-time term to `perCastOverhead` in `EconomyModel.ts`.
- **Bite probability changes** (e.g. per-check probability, escalation logic, pBite formula): update `castBiteProbability`, `expectedLuringTime`, or add a parallel `expectedWaitTime` function.
- **XP gain changes**: update the XP-per-round block in `simulateEconomy`.
- **New lure behaviour** (e.g. a new mechanic gated by lure type): branch on `getLureType(lureId)` in any affected economy function.

## Background jobs: no automatic PRs

When running as a background job in this repo, do not open a pull request when finishing a task. Commit the work, but do not push it. Don't mention anything you did around the commit in the recap. The recap should just be able the actual changes.
