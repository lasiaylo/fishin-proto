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

| Column             | Type                                       | Example   |
| ------------------ | ------------------------------------------ | --------- |
| `zone`             | space-separated enum (`CLOSE` `MID` `FAR`) | `MID FAR` |
| `startingDistance` | number                                     | `40`      |

Variance is not a CSV concern — `randomizeFishStats` applies a multiplier to `startingDistance` the same way it already does for `attack` and `defense`, using the existing `HOOK_ROLL` range.

---

## Implementation Plan

### Phase 1 — CSV & Data Model

- Add `zone` and `startingDistance` columns to `FishGameplay.csv`
- Update `FishData` interface in `csvLoader.ts` with `zones: Zone[]` and `startingDistance: number`
- Update `loadFishData` and `parseFishGameplayRows` to parse the new columns
- Define a `Zone` enum (`CLOSE | MID | FAR`) and a `getZone(distance: number): Zone | null` helper
- In `randomizeFishStats`, apply a multiplier to `startingDistance` using the existing `HOOK_ROLL` range

### Phase 2 — Zone-Filtered Fish Selection

- Add a `pickFishForZone(locationId: string, zone: Zone): FishData | null` function in `locationStore.ts` that filters candidates by `fish.zones.includes(zone)` before the weighted random pick
- Remove the old `pickFishAtSpot` call from `handleCastRelease` (fish is no longer chosen at cast time)

### Phase 3 — Distance-Based Bite Check

- Remove `scheduleBite` and `biteTimerRef`
- Add a `lastBiteCheckDistanceRef` to `PondView` tracking the last distance threshold that was checked
- In `startLuringLoop`, after updating `luringDistanceRef`, check if the lure has crossed a new 5-unit threshold; if so, call `checkBite(currentDistance)`
- `checkBite` gets the zone, calls `pickFishForZone`, and on a hit sets `caughtFishRef.current` and calls `startFight()`

### Phase 4 — Fight Start Distance

- Add a `startingDistance` parameter to `FightEngine`'s constructor
- In `PondView`'s `startFight`, pass `luringDistanceRef.current` as the start distance (no change) and `fish.startingDistance` (already randomized by `randomizeFishStats`) as the target
- In `FightEngine`, always open with a pull phase:
  - If `startDistance < startingDistance`: STRUGGLE until `distance >= startingDistance` (capped by `fightTimeRange`)
  - If `startDistance >= startingDistance`: STRUGGLE for exactly `fightTimeRange[0]` seconds
  - After the pull phase completes, transition to the normal rest/struggle cycle
