<!--What is a PRD: A PRD(product requirement document> is a document that we use to document a project and its requirements. We use this as a communication tool to describe a project which might get broken down into multiple PRs and guide coding agents through the implementation -->

# PRD: Economy Model — Casting & Luring Timing

## Context

The lure_casting and fish_starting_location PRDs introduced two phases that now occur before every fight: a cast animation (1–2 seconds) and a luring/reel-in phase where the player reels back until a fish bites. A CAST_DISTANCE upgrade was also added, allowing players to unlock longer casts.

The Economy Model was not updated to reflect any of this. It used a flat `CAST_WAIT_TIME = 5` seconds as overhead per catch, which ignores the actual mechanics. It also never applied the CAST_DISTANCE upgrade during simulation, meaning `castMax` never changed as the player progressed.

## Requirements

- The economy simulation must account for the time spent charging a cast, animating the cast, reeling the lure in, and displaying the catch result — not a flat constant.
- The cast distance used in simulation must be capped at the furthest zone any fish in the current lure's pool can spawn in (no point casting farther than where fish live).
- The CAST_DISTANCE upgrade must be applied during simulation so that castMax grows as the player buys upgrades, affecting subsequent rounds.
- Designers must be able to set a starting Cast Max value in the Economy tab alongside the existing Attack, Defense, Line HP, and Inventory starting stats.

## Solution

### Per-cast overhead

Each cast cycle now has four time components:

1. **Charge time** — the player holds the cast button. Duration scales with how hard they charge (lerped from 0 to `CAST_CHARGE_DURATION` based on charge fraction `castT`).
2. **Cast animation** — the lure travels to its target. Duration lerped from `CAST_DURATION_MIN` to `CAST_DURATION_MAX` based on `castT`.
3. **Luring time** — the player reels the lure back in until a bite occurs (or reels fully in). Estimated using `expectedLuringTime`.
4. **Result display** — `RESULT_DURATION` (1 second) shown after each catch or miss.

### Effective cast distance

The model casts to `effectiveCast = min(player.castMax, maxZoneDist)`, where `maxZoneDist` is the maximum distance of the furthest valid zone across all fish in the chosen lure's pool. `castT` is then `(effectiveCast - CAST_MIN) / (player.castMax - CAST_MIN)`, normalizing charge fraction for the lerps above.

### Expected luring time

`expectedLuringTime(effectiveCast)` steps through zones FAR → MID → CLOSE. For each zone the lure passes through, it applies `TARGET_BITE_CHANCE` (70%) and adds the weighted zone traversal distance to the expected reel distance. Any remaining probability (no bite in any zone) contributes a full `effectiveCast` reel-in. Total distance divided by `LURING_REEL_MAX_SPEED` gives time in seconds.

```
expectedDistance = 0
survivalProb = 1

for each zone (FAR → MID → CLOSE):
  if effectiveCast < zone.min: skip
  entryDistance = min(effectiveCast, zone.max)
  reelDistance  = entryDistance - zone.min
  expectedDistance += survivalProb × 0.7 × reelDistance
  survivalProb     *= 0.3

expectedDistance += survivalProb × effectiveCast   ← no-bite fallback

luringTime = expectedDistance / LURING_REEL_MAX_SPEED
```

## Implementation Plan

### Phase 1 — Export shared constants ✅

- `src/components/PondView.tsx`: export `CAST_MIN`, `CAST_DURATION_MIN`, `CAST_DURATION_MAX`, `CAST_CHARGE_DURATION`, `LURING_REEL_MAX_SPEED`, `REEL_MIN`, `RESULT_DURATION`.
- `src/util/zones.ts`: export `TARGET_BITE_CHANCE`.
- `src/util/easing.ts`: add and export `lerp(a, b, t)`.

### Phase 2 — Update EconomyModel ✅

- Remove `CAST_WAIT_TIME`.
- Import the shared constants and `lerp`.
- Add `expectedLuringTime(effectiveCast: number): number`.
- Add `CAST_DISTANCE` case to `applyUpgrade` (increments `player.castMax`).
- Add `CAST_DISTANCE` case to `statValue` in `cheapestUpgrade` (tie-breaking).
- Replace the round time line with the computed `perCastOverhead + avgFightTime` formula.

### Phase 3 — Update EconomyTab ✅

- Add `castMax` state initialized from `INITIAL_PLAYER_STATE.castMax`.
- Pass `castMax` to `simulateEconomy`.
- Add a Cast Max `NumInput` alongside the existing stat inputs.

### Test Plan

1. Open `localhost:5173/debug` → Economy tab.
2. Run a simulation with default starting stats. Confirm round times reflect actual cast + luring overhead rather than a flat 5 seconds.
3. Observe that the simulation purchases `DISTANCE_1` and that `castMax` grows in subsequent rounds.
4. Change the Cast Max starting value and confirm the Income Rate chart responds accordingly.
