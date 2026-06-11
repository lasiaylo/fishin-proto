<!--What is a PRD: A PRD(product requirement document> is a document that we use to document a project and its requirements. We use this as a communication tool to describe a project which might get broken down into multiple PRs and guide coding agents through the implementation -->

# PRD: Lure Casting Mechanic

This PRD is a follow up to the Lure Casting Mechanic, outlining fish hooking and fight behavior.

## Context

Right now, after the player casts their lure, there is a timer that goes off determining when a fish will hook. The fish is then chosen at random, and the fight begins at whatever line distance the lure was at when the hooking happens.

We want to change this behavior in order to:

- Give players more control on what fish they want to catch
- Give designers more control on the fish fights

## Requirements

### Catch Zones & Random Encounters

- There will be 3 different line distance zones that fish will be able to be caught in:
  - CLOSE: 5-30
  - MID: 30-60
  - FAR: 50-80
- When players cast a lure, their lure will enter different zones as they reel in. Every 5ft they reel, randomly check if they hook a fish. If they do, start a fight for a valid fish for that zone + lure.

### Start Fight Distance

- When hooking, fish will automatically start struggling up to a predefined Starting Line Distance (+/- variance). We can probably still cap the struggle time to the current struggle durations to ensure that not too much lineHP is lost.
- If they are hooked beyond that Starting Line Distance, then struggle for a shorter amount of time.

### CSV

Let gameplay designers define:

- What zone the fish can spawn in
- What their desired Starting Line Distance is

## Solution

### Zones

Three named distance zones are defined as constants:

```
CLOSE: 5–30
MID:   30–60
FAR:   50–80
```

Each fish is assigned one or more eligible zones in `FishGameplay.csv`. During the luring loop, the active zone is derived from the current lure distance.

### Distance-Based Bite Check

The timer-based `scheduleBite` is removed. Instead, every 5 units the player reels in, a bite check fires. The check:

1. Determines the current zone from `luringDistance`
2. Filters the location's fish pool to candidates eligible for that zone (and the player's lure)
3. Rolls a random bite chance — if it hits, `startFight` is called immediately with the matching fish

This gives players agency: reeling through a zone increases bite exposure; pausing holds position.

### Start Fight Distance

The fight always starts at the current lure distance. `FightEngine` is responsible for pulling the line out to the fish's `startingDistance`.

On bite, `PondView` passes `luringDistance` to `FightEngine` as normal. `FightEngine` receives the fish's `startingDistance` (already randomized) as a separate parameter. The engine always opens with a **pull phase** — an automatic STRUGGLE before the normal rest/struggle cycle begins.

- If `luringDistance < startingDistance`: the pull phase runs until distance reaches `startingDistance`, subject to the normal `fightTimeRange` cap.
- If `luringDistance >= startingDistance`: the pull phase still occurs, but uses the minimum `fightTimeRange` duration — a brief, fixed struggle before the normal cycle begins.

```
0 (player) ──────────────────────────────────── Cast
                CLOSE        MID          FAR
              5      30   30     50   50      80

Lure at 25 (CLOSE zone), fish startingDistance = 40:
  → pull phase runs until distance = 40, then normal fight

Lure at 55 (MID zone), fish startingDistance = 40:
  → pull phase runs for fightTimeRange[0], then normal fight
```

The pull phase consumes line HP (the fish is fighting). The player can reel during the pull phase but cannot prevent it from completing.

### CSV Changes

`FishGameplay.csv` gains two new columns:

| Column | Type                                       | Example   |
| ------ | ------------------------------------------ | --------- |
| `Zone` | space-separated enum (`CLOSE` `MID` `FAR`) | `MID FAR` |
| `HP`   | number                                     | `40`      |

`HP` is the fish's target line distance when it hooks — the distance it will try to pull the line to at the start of the fight. The column was originally named `StartingDistance` but was renamed to `HP` for clarity.

Variance is not a CSV concern — `randomizeFishStats` applies a multiplier to `hp` the same way it already does for `attack` and `defense`, using the existing `HOOK_ROLL` range.

### avgZoneDistance Helper

`csvLoader.ts` exports `avgZoneDistance(zones: Zone[]): number`, which returns the midpoint of the **union** of all zone ranges for a fish. For example, a fish with zones `MID FAR` spans [30, 80], giving a midpoint of 55. This is used by the model tools and `EconomyModel` to set the `fightStartDistance` (the lure position when the fight starts) when simulating fights outside the game loop.

---

## Implementation Plan

### Phase 1 — CSV & Data Model ✅

- Added `Zone` and `HP` columns to `FishGameplay.csv`
- Updated `FishData` interface in `csvLoader.ts` with `zones: Zone[]` and `hp: number`
- Updated `parseFishRow` to parse the new columns (positional: `row[6]` = zones, `row[7]` = hp)
- Defined a `Zone` enum (`CLOSE | MID | FAR`), `getZone(distance): Zone | null`, and `avgZoneDistance(zones): number` helpers
- In `randomizeFishStats`, applied a multiplier to `hp` using the existing `HOOK_ROLL` range

### Phase 2 — Zone-Filtered Fish Selection ✅

- Added `pickFishForZone(locationId, zone)` in `locationStore.ts` that filters candidates by zone before the weighted random pick
- Fish is no longer chosen at cast time; selection happens at bite time in `checkBite`

### Phase 3 — Distance-Based Bite Check ✅

- Removed `scheduleBite`, `cancelBite`, and `biteTimerRef`; removed `BITE_DELAY` constant
- Added `lastBiteCheckDistanceRef` tracking the last distance threshold checked
- In `startLuringLoop`, after each movement update, checks if the lure has moved ≥ `BITE_CHECK_INTERVAL` (5) units since the last check; if so, calls `checkBite(currentDistance)`
- `checkBite` resolves the zone, rolls a flat `BITE_CHANCE` (0.35), calls `pickFishForZone`, and on a hit sets `caughtFishRef.current` and calls `startFight()`

### Phase 4 — Fight Start Distance ✅

- Added `targetDistance` parameter to `FightEngine`'s constructor (defaults to `startDistance`)
- Removed `randomStartPhase()` — fights always open with STRUGGLE
- Added `pullDone` flag to track when the pull phase has completed
- Pull phase duration logic in `setPhase`:
  - If `distance < targetDistance`: use `fightTimeRange[1]` (max struggle time)
  - If `distance >= targetDistance`: use `fightTimeRange[0]` (min struggle time — brief acknowledgment)
- Mid-tick early exit: if in the pull phase and `distance >= targetDistance` is reached, immediately set `pullDone = true` and transition to REST without waiting for the phase timer
- After the pull phase, the normal rest/struggle cycle resumes
- `reset()` also resets `pullDone` and starts fresh with STRUGGLE
- In `PondView.startFight`, passes `luringDistanceRef.current` as `startDistance` and `fish.hp` as `targetDistance`
- In `EconomyModel.runTrials`, passes `avgZoneDistance(fish.zones)` as `startDistance` and `fish.hp` as `targetDistance`

### Phase 5 — Model Tool Wiring ✅

- `FightTraceTab` and `ParamSweepTab` now expose two new inputs: **Start Distance** (initialized from `avgZoneDistance(fish.zones)`) and **HP** (from `fish.hp`)
- Both are passed to `FightEngine` so simulated fights reflect the fish's zone and target distance
