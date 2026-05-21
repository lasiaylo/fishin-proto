# PRD: Fishing Minigame

The core gameplay loop of Fishin2Model — cast, fight, catch, sell — is missing its central piece: the fishing fight itself. PondView currently shows a "coming soon" placeholder. This PRD defines a real-time fishing minigame that ports the existing `fight_sim.py` simulation to TypeScript and displays the fight as a set of health bars.

## Context

**What exists today:**
- `model/fight_sim.py` — A fully modeled fight simulation with STRUGGLE/REST phases, line tension, super attacks, fish stamina, and statistical balancing tools. The simulation is purely automated (stats determine outcome with no player input).
- ~~`prototype/src/components/PondView.tsx`~~ — Removed. Was a placeholder UI with 3 fishing spot buttons that opened a "coming soon" dialog.
- `prototype/src/stores/playerStore.ts` — Player stats: `reelStrength` (10), `drag` (1), `lineStrength` (20), `ownedLures`.
- `prototype/src/stores/fishStore.ts` — Fish catalog loaded from `FishGameplay.csv`. Two fish: Minnow (str:1, spd:10, $1) and Trout (str:2, spd:10, $2, requires LURE_1).
- Game loop dispatches `UPDATE_EVENT` each frame via `requestAnimationFrame`.

**What's missing:** The actual fishing minigame that connects casting to catching. Players currently have no way to catch fish.

## Requirements

1. **Port fight_sim.py** — The TypeScript fight engine must faithfully reproduce the Python simulation's mechanics: two-phase system (STRUGGLE/REST), line tension, super attacks, fish stamina decay, out-leveled checks, and win/lose conditions.

2. **Health bar fight UI** — The fight plays out as two health bars: Fish Distance (how close the fish is to being reeled in) and Tension (line stress, loses on overflow). Phase indicator shows STRUGGLE vs REST.

3. **Full game flow** — Cast at a fishing spot, wait for a bite, play the minigame, get the fish on win (or lose it), return to the pond to cast again.

4. **Fishing spot differentiation** — The 3 spots (Shallow End, Deep End, Far End) provide access to different fish pools.

## Solution

### Fight Engine (TypeScript port of fight_sim.py)

Port the `Fight` class to TypeScript. The simulation runs automatically — reeling is always active, matching fight_sim.py exactly. Outcome is determined by player stats, not real-time input.

**Phase system** (unchanged from fight_sim.py):
- Alternates between STRUGGLE and REST.
- STRUGGLE duration: random `[1.0, 6.0]s`, shortened after fish stamina depletes.
- REST duration: random `[2, 6]s`.
- Super attack: 10% chance per STRUGGLE phase, +10 bonus to fish stats, fixed 6s duration.
- After `FISH_STAMINA + FISH_TIMEOUT` seconds, fish stops struggling (unless out-leveled).

**Tick formulas** (identical to fight_sim.py):

| Phase    | Distance change per tick                          | Tension change per tick              |
|----------|---------------------------------------------------|--------------------------------------|
| REST     | `max(-MAX_REEL, speed - reel) * dt`               | None                                 |
| STRUGGLE | `(speed - reel) * dt` if tension < line_hp, else `speed * dt` | `(fish_str + bonus) * dt` |

**Constants** (match fight_sim.py):
```
MAX_DISTANCE = 100
START_DISTANCE = 50
REST_TIME = [2, 6]
FIGHT_TIME = [1.0, 6.0]
BASE_SPEED = 10
MIN_SPEED = -40
BASE_REEL = 25
MAX_REEL = 25
SPEED_GROWTH = 1.1
REEL_GROWTH = 1.1
OUT_LEVELED_THRESHOLD = 4
ATTACK_CHANCE = 0.1
FISH_STAMINA = 30
FISH_TIMEOUT = 20
```

**Win/Lose conditions** (unchanged):
- Win: `distance <= 0`
- Lose: `distance >= MAX_DISTANCE`

### Fight UI — Health Bars

The fight is displayed as two labeled bars updated each tick:
- **Fish Distance** — fills left-to-right from 0 to `MAX_DISTANCE` (100). Winning means driving it to 0.
- **Tension** — fills left-to-right from 0 to `line_hp`. Losing means letting it reach `line_hp`.
- A phase label ("STRUGGLE" / "REST" / "SUPER ATTACK") sits above the bars.
- Outcome text ("Caught it!" / "The fish got away...") replaces the bars at fight end.

No Pixi.js or canvas required for the fight — plain React + Radix UI progress bars.

### Persistent Action Button

A single action button is always visible. It serves as the hook trigger during the lure phase:
- **Luring phase**: Disabled until the fish bites. Enables and shows "Hook!" when a bite occurs. Player clicks (or presses spacebar) to hook the fish. Missing the bite window re-disables the button until the next bite.
- **Disabled** during idle, fighting, and result states.

### Game Flow

```
PondView (spot selection)
    │
    ▼
Luring — Hook button disabled, waiting for bite
    │
    ├─ Bite → "Hook!" button enables (2s window)
    │    ├─ Player hooks in time → Fight UI opens
    │    └─ Player misses → button re-disables, wait for next bite
    │
    ▼
Fight UI — health bars (plays out automatically)
    │
    ├─ WIN  → Result screen (2s) → Money added → Return to PondView
    └─ LOSE → Result screen (2s) → Event logged → Return to PondView
    │
    ▼
PondView (cast again or go to Shop)
```

**Cast-to-fight details:**
1. Player clicks a fishing spot button.
2. A random fish is selected from the available pool.
3. Luring state begins: action button is disabled, showing "Waiting...". After a random delay, the fish bites.
4. On bite: button enables and shows "Hook!" for a 2s window. Player presses button or spacebar to hook.
5. Missing the window re-disables the button; another bite arrives after a random delay.
6. On successful hook: fight UI appears with the selected fish's stats fed into the fight engine.
7. Fight runs in real-time via `requestAnimationFrame`, reading player stats from `playerStore`.
8. On win: `addMoney()` called, result screen shown for 2s, then return to idle.
9. On lose: `pushEvent()` with failure message, result screen shown for 2s, then return to idle.

### Fishing Spots

Three spots are defined (Shallow End, Deep End, Far End) but currently all return the full available fish pool. Spot-based filtering (lure requirements, tier gating) is deferred for future work.

### Store Integration

**Read from:**
- `playerStore`: `reelStrength`, `drag`, `lineStrength` → fight engine params
- `fishStore` + `playerStore.ownedLures` → `getAvailableFish()` per spot

**Write to:**
- `playerStore`: `addMoney(fish.basePrice)` on win
- `eventLogStore`: `pushEvent()` for cast, catch, and escape events
- No new stores needed. Fight state is local to the minigame component (not persisted).

## Implementation Plan

### Phase 1: Fight Engine ✅
- Ported `Fight` class from `fight_sim.py` to `prototype/src/game/FightEngine.ts`
- Reeling is always active; formulas match fight_sim.py exactly
- Exposes `tick(dt)` returning `FightState { distance, tension, phase, time, outcome }`

### Phase 2: Game Flow ✅
- Recreated `src/components/PondView.tsx` with state machine: idle → luring → fighting → result → idle
- Luring state: action button disabled until fish bites, enables as "Hook!" for a 2s window; spacebar also triggers hook
- Win/lose outcomes wired to `playerStore.addMoney()` and `eventLogStore.pushEvent()`
- 2s result screen before returning to idle
- Added Pond / Shop tabs to `src/components/ActionsSection.tsx` via Radix UI `Tabs`

### Phase 3: Fight UI ✅
- Created `src/components/FightView.tsx` — two Radix UI progress bars (Fish Distance, Tension) updated each `requestAnimationFrame` tick
- Phase label color-coded: green (REST), amber (STRUGGLE), red (SUPER ATTACK)
- `PondView.tsx` passes `FightState` and `lineHp` to `FightView`; fight transitions to the result screen on outcome


