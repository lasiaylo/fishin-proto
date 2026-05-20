# PRD: Fishing Minigame

The core gameplay loop of Fishin2Model — cast, fight, catch, sell — is missing its central piece: the fishing fight itself. PondView currently shows a "coming soon" placeholder. This PRD defines a real-time, skill-based fishing minigame that ports the existing `fight_sim.py` simulation to TypeScript, adds player agency via hold-to-reel input, and renders the fight on a Pixi.js canvas.

## Context

**What exists today:**
- `model/fight_sim.py` — A fully modeled fight simulation with STRUGGLE/REST phases, line tension, super attacks, fish stamina, and statistical balancing tools. The simulation is purely automated (stats determine outcome with no player input).
- `prototype/src/components/PondView.tsx` — Placeholder UI with 3 fishing spot buttons that open a "coming soon" dialog.
- `prototype/src/stores/playerStore.ts` — Player stats: `reelStrength` (10), `drag` (1), `lineStrength` (20), `inventoryCapacity` (4), `ownedLures`.
- `prototype/src/stores/fishStore.ts` — Fish catalog loaded from `FishGameplay.csv`. Two fish: Minnow (str:1, spd:10, $1) and Trout (str:2, spd:10, $2, requires LURE_1).
- `prototype/src/stores/inventoryStore.ts` — Inventory with capacity check, add/clear/sell helpers.
- Pixi.js (`@pixi/react` 7.1.2) is installed but mostly unused. `Canvas.tsx` exists with basic shape rendering.
- Game loop dispatches `UPDATE_EVENT` each frame via `requestAnimationFrame`.

**What's missing:** The actual fishing minigame that connects casting to catching. Players currently have no way to catch fish.

## Requirements

1. **Port fight_sim.py** — The TypeScript fight engine must faithfully reproduce the Python simulation's mechanics: two-phase system (STRUGGLE/REST), line tension, super attacks, fish stamina decay, out-leveled checks, and win/lose conditions.

2. **Player agency via hold-to-reel** — Instead of automatic reeling, the player holds a button (mouse/touch) to reel in the fish. This creates a skill element:
   - Reeling during REST phases is effective and safe (the primary catch window).
   - Reeling during STRUGGLE phases is risky: some distance gain but line tension increases.
   - Releasing during STRUGGLE protects the line but lets the fish pull away.
   - Good players read the phases and time their reeling to catch fish above their stat level.

3. **Pixi.js canvas rendering** — The fight plays out on a visual canvas showing fish distance, line state, phase indicators, and a tension gauge.

4. **Full game flow** — Cast at a fishing spot, wait for a bite, play the minigame, get the fish on win (or lose it), return to the pond to cast again.

5. **Fishing spot differentiation** — The 3 spots (Shallow End, Deep End, Far End) provide access to different fish pools.

## Solution

### Fight Engine (TypeScript port of fight_sim.py)

Port the `Fight` class to TypeScript with one key modification: **reeling is conditional on player input**.

**Phase system** (unchanged from fight_sim.py):
- Alternates between STRUGGLE and REST.
- STRUGGLE duration: random `[1.0, 6.0]s`, shortened after fish stamina depletes.
- REST duration: random `[2, 6]s`.
- Super attack: 10% chance per STRUGGLE phase, +10 bonus to fish stats, fixed 6s duration.
- After `FISH_STAMINA + FISH_TIMEOUT` seconds, fish stops struggling (unless out-leveled).

**Hold-to-reel modification:**

When player IS reeling (holding button):
| Phase    | Distance change per tick                          | Tension change per tick              |
|----------|---------------------------------------------------|--------------------------------------|
| REST     | `max(-MAX_REEL, speed - reel) * dt` (same as fight_sim) | None                                |
| STRUGGLE | `(speed - reel) * dt` if tension < line_hp, else `speed * dt` (same as fight_sim) | `(fish_str + bonus) * dt` (same as fight_sim) |

When player is NOT reeling (button released):
| Phase    | Distance change per tick | Tension change per tick |
|----------|--------------------------|-------------------------|
| REST     | `DRIFT_SPEED * dt` (small constant drift away, e.g. 3) | None                    |
| STRUGGLE | `speed * dt` (fish pulls at full speed, no counter-reel) | None (no reel = no tension) |

Key insight: In fight_sim.py, the player always reels. The new mechanic splits that into an active choice. **Not reeling during STRUGGLE** means the fish runs freely but the line stays healthy. **Reeling during STRUGGLE** means tension builds (same as fight_sim) but you partially counter the fish. The risk/reward of reeling during STRUGGLE is the core skill expression.

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
DRIFT_SPEED = 3          ← NEW: drift rate when not reeling during REST
```

**Win/Lose conditions** (unchanged):
- Win: `distance <= 0`
- Lose: `distance >= MAX_DISTANCE`

### Pixi.js Canvas — ASCII Style

Both the lure and fight canvases use a minimal ASCII aesthetic: black background, white outlines only (no fills), with the exception of the tension-colored fishing line.

**Fight canvas (`FightCanvas.tsx`):**
- **Fish**: Outline ellipse + tail, drawn at origin and positioned via x/y/scale. Flips horizontally based on movement direction.
- **Line**: Connects rod to fish nose. Color shifts white → yellow → red as tension builds toward line_hp.
- **Water surface**: Animated wave line (sine wave scrolls with time).
- **Outcome text**: "Caught it!" / "The fish got away..." shown on canvas at fight end.

**Lure canvas (`LureCanvas.tsx`):**
- **Hook**: V-shape hanging from a line at center-x, at fish depth.
- **Fish**: Same outline style as fight canvas. Swims back and forth, approaches hook, nibbles or bites.
- **Water surface**: Same animated wave line as fight canvas.

### Persistent Action Button

A single action button is always visible below the canvas. It serves dual purpose:
- **Luring phase**: Shows "Hook!" during a real bite, "Action" otherwise. Click/tap to attempt hook.
- **Fighting phase**: Shows "Reel!". Hold to reel, release to stop.
- **Spacebar**: Mirrors the action button (keydown = press, keyup = release).
- **Disabled** during idle and result states.

### Game Flow

```
PondView (spot selection)
    │
    ▼
Cast → Lure canvas (fish swims, approaches hook)
    │
    ├─ Nibble (fakeout) → fish resets, lure continues
    ├─ Bite → "Hook!" button appears
    │    ├─ Player hooks in time → Fight canvas opens
    │    └─ Player misses → fish releases, lure continues
    └─ Player hooks during nibble → "Too early!", fish resets
    │
    ▼
Fight canvas (hold Reel to catch)
    │
    ├─ WIN  → Result screen (2s) → Fish added to inventory → Return to PondView
    └─ LOSE → Result screen (2s) → Event logged → Return to PondView
    │
    ▼
PondView (cast again or go to Shop)
```

**Cast-to-fight details:**
1. Player clicks a fishing spot button. If inventory is full, a warning is shown and casting is blocked.
2. A random fish is selected from the available pool.
3. Lure canvas appears: fish swims back and forth, periodically approaches the hook.
4. Fish either nibbles (60% — fakeout, ~0.5s) or bites (40% — real, 2s window). Nibbles wiggle at the hook; bites hold steady.
5. Player must press Hook (button or spacebar) only during a real bite. Hooking during a nibble resets the fish. Missing a bite causes the fish to release and swim again.
6. On successful hook: fight canvas appears with the selected fish's stats fed into the fight engine.
7. Fight runs in real-time via Pixi.js `useTick`, reading player stats from `playerStore`.
8. On win: `addFish()` called, result screen shown for 2s, then return to idle.
9. On lose: `pushEvent()` with failure message, result screen shown for 2s, then return to idle.

### Fishing Spots

Three spots are defined (Shallow End, Deep End, Far End) but currently all return the full available fish pool. Spot-based filtering (lure requirements, tier gating) is deferred for future work.

### Store Integration

**Read from:**
- `playerStore`: `reelStrength`, `drag`, `lineStrength` → fight engine params
- `fishStore` + `playerStore.ownedLures` → `getAvailableFish()` per spot
- `inventoryStore`: `isFull()` check before casting

**Write to:**
- `inventoryStore`: `addFish({ name, basePrice })` on win
- `eventLogStore`: `pushEvent()` for cast, catch, and escape events
- No new stores needed. Fight state is local to the minigame component (not persisted).

## Implementation Plan

### Phase 1: Fight Engine ✅
- Ported `Fight` class from `fight_sim.py` to `prototype/src/game/FightEngine.ts`
- Added hold-to-reel modifier (`isReeling` boolean controls formula branch)
- Added `DRIFT_SPEED` constant for not-reeling-during-rest behavior
- Exposes `tick(dt, isReeling)` returning `FightState { distance, tension, phase, time, outcome }`

### Phase 2: Pixi.js Canvas ✅
- Created `FightCanvas.tsx` using `@pixi/react` with ASCII-style rendering (black bg, white outlines)
- Fish outline flips horizontally based on movement direction via scale.x
- Line connects rod to fish nose, color shifts with tension (white → yellow → red)
- Reeling controlled by external action button in PondView (not canvas mousedown)

### Phase 3: Game Flow Integration ✅
- Created `LureCanvas.tsx` — lure phase with nibble/bite mechanic replacing text-based casting/biting
- `PondView.tsx` state machine: idle → luring → fighting → result → idle
- Persistent action button: "Hook!" during bite, "Reel!" during fight, spacebar support
- Inventory-full check before casting
- Win/lose outcomes wired to `inventoryStore` and `eventLogStore`
- 2s result screen before returning to idle

### Phase 4: Polish ✅
- Line color shift with tension
- Animated water surface (sine wave scrolls with time)
- Win/lose result screen with 2s delay
- Fish flips based on movement direction (both canvases)
- Removed debug console.log