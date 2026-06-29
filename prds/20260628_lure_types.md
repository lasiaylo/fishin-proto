
# PRD: Lure Types


## Context

This game originally had a cast and wait mechanic, where the player would cast the bobber and then wait for the fish to bite. This was replaced with the current mechanic of casting and reeling, where fish will only bite when the player is actively reeling the lure.

Now, we want to have both mechanics available, depending on the lure that the player has equipped. This will allow for some variety in gameplay and a better sense of progression.

## Requirements

- Cast and Wait Mechanic
  - After the player casts their lure, a hidden timer is initialized with a random duration. When the timer expires, a fish bites.
  - The timer does not start until the bobber is fully stationary, and resets whenever the bobber moves.
  - The player can reel during the wait, which moves the lure back normally. The wait only ends without a bite if the player reels all the way in.
- Prime locations
  - Wait lures use a separate set of zones (different distance ranges from cast-and-lure zones).
  - If the bobber is stationary inside a prime zone, the timer duration is sampled from a shorter range. Outside any prime zone it is sampled from a longer range.
  - A bite is always guaranteed when the timer fires — prime zones reduce how long the player waits, not whether they get a bite.
- Lure Types
  - Depending on the lure, players will need to cast and lure (the current system) or cast and wait.
  - We need a way to distinguish between the two. For now, let's have only LURE_0 (the default lure) be cast and wait. All the bought lures are cast and lure.

## Solution

Introduce a `LureType` enum (`CAST_AND_WAIT` | `CAST_AND_LURE`) and a helper `getLureType(lureId)` that returns `CAST_AND_WAIT` for `LURE_0` and `CAST_AND_LURE` for everything else. This keeps the distinction in one place and avoids scattering lure-ID string checks.

**Cast and Wait flow**: After the cast animation completes, the game enters a new `GameState.Waiting` state. A `requestAnimationFrame` loop runs (same structure as luring) and handles reel movement at normal speed. The bite is driven by a countdown timer rather than a probability check:

- The timer does not start until `luringReelSpeedRef === 0` (bobber fully stationary).
- On becoming stationary, `getWaitZones(distance)` determines whether the bobber is in a prime zone. A random duration is sampled from `[WAIT_PRIME_MIN, WAIT_PRIME_MAX]` (in zone) or `[WAIT_DEFAULT_MIN, WAIT_DEFAULT_MAX]` (out of zone).
- If the bobber moves (reel speed > 0 at any point), the countdown resets to `null`. It will be re-sampled the next time the bobber comes to rest.
- When the countdown reaches 0: `pickFishForZone` selects a fish using the wait zones at the current distance, and `startFight()` is called directly (the bite is guaranteed).
- If the lure is reeled all the way to 0 without a bite, `handleReelIn()` is called as normal.

`getBiteChance` and `emptyReelCount` are not used in wait mode — the timer replaces probability-based checks entirely.

**Cast and Lure flow**: unchanged from today.

## Implementation Plan

### 1. `src/util/constants.ts`

- Add `export enum LureType { CAST_AND_WAIT = "cast_and_wait", CAST_AND_LURE = "cast_and_lure" }`.
- Add `export function getLureType(lureId: string): LureType` — returns `CAST_AND_WAIT` when `lureId === BASE_LURE_ID`, otherwise `CAST_AND_LURE`.
- Add `WAIT_ZONE_RANGES: Record<Zone, [number, number]>` — the distance ranges for wait-lure prime zones (separate from `ZONE_RANGES` used by cast-and-lure).
- Add four timer constants: `WAIT_PRIME_MIN`, `WAIT_PRIME_MAX` (seconds, bobber in a prime zone) and `WAIT_DEFAULT_MIN`, `WAIT_DEFAULT_MAX` (seconds, bobber outside any prime zone).

### 2. `src/components/PondView.tsx`

- Add `GameState.Waiting = "waiting"` to the enum.
- Add `waitCountdownRef = useRef<number | null>(null)` — `null` means the timer is not active; a positive number is the remaining seconds until bite.
- **Replace `startLuringLoop` with a single `startCastLoop(castDistance: number)`** that handles both lure types:
  - Resolves `lureLevel` and determines the new game state (`GameState.Luring` or `GameState.Waiting`) based on `getLureType(selectedLure)`. Captures the new game state as a local `const` before the loop — this avoids reading stale React state inside the rAF closure.
  - Sets game state, then initialises `luringDistanceRef`, `castDistanceRef`, `lastBiteCheckDistanceRef`, `luringLastTimeRef`, `luringReelSpeedRef`, `isReelingRef`, and (for `Waiting`) resets `waitCountdownRef.current = null`.
  - Resolves `effectiveReelMaxSpeed` from `lureReelMaxSpeed(lureLevel)`.
  - Runs one rAF loop:
    - Shared every frame: compute `dt`, update reel speed (accel/decel), advance `luringDistanceRef`, call `setLuringDistance`, call `handleReelIn()` and return if distance reaches 0.
    - **If `GameState.Luring`**: existing distance-based bite check (`lastBiteCheckDistanceRef` delta + `checkBite`).
    - **If `GameState.Waiting`**:
      - If `luringReelSpeedRef.current > 0`: reset `waitCountdownRef.current = null`.
      - If stationary and `waitCountdownRef.current === null`: call `getWaitZones(luringDistanceRef.current)`, draw from `[WAIT_PRIME_MIN, WAIT_PRIME_MAX]` or `[WAIT_DEFAULT_MIN, WAIT_DEFAULT_MAX]`, assign to `waitCountdownRef.current`.
      - Decrement `waitCountdownRef.current` by `dt`.
      - When `<= 0`: call `pickFishForZone` with the current wait zones, set `caughtFishRef`, push `EventMsg.BITING`, call `startFight()`, and return.
- Modify `handleCastRelease` `onComplete` callback to call `startCastLoop` (replacing the previous `startLuringLoop` call).
- The `GameState.Waiting` render branch is identical to `GameState.Luring` — combine them into a single condition (`gameState === GameState.Luring || gameState === GameState.Waiting`).

### 3. `src/util/zones.ts`

- Add `export function getWaitZones(distance: number): Zone[]` — mirrors `getZones` but filters against `WAIT_ZONE_RANGES` instead of `ZONE_RANGES`.
- `getBiteChance` is not used in wait mode; no changes needed there.

### 4. `src/game/EconomyModel.ts`

Three things change for `LURE_0` (cast-and-wait) vs cast-and-lure:

**New `expectedWaitTime` helper** — the wait equivalent of `expectedLuringTime`:
- Assumes optimal play: the player always casts into a prime zone, so the timer is always drawn from `[WAIT_PRIME_MIN, WAIT_PRIME_MAX]`.
- Expected time: `(WAIT_PRIME_MIN + WAIT_PRIME_MAX) / 2` (midpoint of a uniform draw).

**`perCastOverhead` — branch on lure type:**
- Import `getLureType` and `LureType` from constants.
- After computing `effectiveCast`, branch: `CAST_AND_WAIT` → use `expectedWaitTime()`; `CAST_AND_LURE` → existing `expectedLuringTime` call.

**`simulateEconomy` — two changes:**
- `pBite`: for `CAST_AND_WAIT` set `pBite = 1` (the timer always fires; every cast yields a bite). For `CAST_AND_LURE` keep the existing `castBiteProbability` call.
- XP block: for `CAST_AND_WAIT`, `avgLuringDist = 0` (the lure never moves), so `xpPerRound = castsPerRound * winRate * XP_WIN` (no distance XP term).
