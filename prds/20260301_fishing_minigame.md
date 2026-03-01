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

### Pixi.js Canvas Layout

```
┌──────────────────────────────────────────────────┐
│                                                    │
│  ~~~~~~~~ water surface ~~~~~~~~                   │
│                                                    │
│         │  ← line (white → yellow → red as        │
│         │     tension builds)                      │
│         🐟 ← fish sprite                          │
│                                                    │
│  [ HOLD TO REEL ]  (or touch/hold anywhere)        │
└──────────────────────────────────────────────────┘
```

**Visual elements:**
- **Fish sprite**: Moves horizontally based on `distance`. At distance 0 = caught (near rod). At distance 100 = escaped (far edge).
- **Line**: Connects to fish. Color shifts from white → yellow → red as tension builds toward line_hp, replacing the need for a separate tension indicator.
- **Reel button**: Large button area at bottom. Alternatively, hold-anywhere-on-canvas to reel (more natural).
- **Water surface**: Simple animated wave line to set the scene.

### Game Flow

```
PondView (spot selection)
    │
    ▼
Cast → "Waiting for bite..." (1-3s random delay)
    │
    ▼
Bite! → Fight canvas opens (Pixi.js stage replaces pond view)
    │
    ├─ WIN  → Fish added to inventory → Event logged → Return to PondView
    └─ LOSE → "The fish got away!" → Event logged → Return to PondView
    │
    ▼
PondView (cast again or go to Shop)
```

**Cast-to-fight details:**
1. Player clicks a fishing spot button.
2. A random fish is selected from the spot's fish pool (weighted by availability / lure requirements).
3. Brief cast animation / "Waiting for bite..." text (random 1-3 seconds).
4. Fight canvas appears with the selected fish's stats fed into the fight engine.
5. Fight runs in real-time using `requestAnimationFrame`, reading player stats from `playerStore`.
6. On win: call `addFish()` with the caught fish, `pushEvent()` with catch details. If inventory is full, show a warning before casting.
7. On lose: `pushEvent()` with failure message. No fish added.

### Fishing Spot Differentiation

| Spot         | Fish Pool                        | Description                     |
|--------------|----------------------------------|---------------------------------|
| Shallow End  | Minnow (and other easy fish)     | Starter fish, no lure required  |
| Deep End     | Trout (and mid-tier fish)        | Requires LURE_1 for best fish   |
| Far End      | Future high-tier fish            | Requires advanced lures         |

Each spot filters `getAvailableFish()` further by a spot-specific lure/tier requirement. If a spot has multiple available fish, one is selected randomly (uniform for now; can add weighted rarity later).

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

### Phase 1: Fight Engine
- Port `Fight` class from `fight_sim.py` to TypeScript (e.g. `prototype/src/game/FightEngine.ts`)
- Add hold-to-reel modifier (isReeling boolean that controls which formula branch runs)
- Add `DRIFT_SPEED` constant for not-reeling-during-rest behavior
- Expose a `tick(dt, isReeling)` method that advances the simulation by `dt` seconds
- Return fight state each tick: `{ distance, tension, phase, superAttack, time, outcome }`

### Phase 2: Pixi.js Canvas
- Create `FightCanvas.tsx` component using `@pixi/react`
- Render: fish sprite (simple shape/sprite), line, distance bar, tension bar, phase text
- Wire up `requestAnimationFrame` loop → calls `FightEngine.tick()` → updates Pixi display objects
- Handle mouse/touch input for hold-to-reel (mousedown/touchstart = reeling, mouseup/touchend = release)

### Phase 3: Game Flow Integration
- Update `PondView.tsx`: clicking a spot → selects fish → shows cast wait → transitions to `FightCanvas`
- Wire up win/lose outcomes to `inventoryStore` and `eventLogStore`
- Add inventory-full check before allowing cast
- Add spot-to-fish-pool mapping

### Phase 4: Polish
- Visual feedback: line color shift with tension, phase transition animations, super attack flash
- Sound cues (optional, stretch)
- Water surface animation
- Win/lose result screen before returning to pond

### Test Plan

1. **Fight engine unit tests**: Create a `FightEngine` instance with known stats, call `tick()` in a loop with `isReeling=true` always, and verify it produces similar win/lose distributions to `fight_sim.py` (since always-reeling = the original automatic behavior).
2. **Hold-to-reel behavior**: Verify that not reeling during REST causes drift (distance increases slowly), and not reeling during STRUGGLE prevents tension buildup.
3. **Integration smoke test**: Run the dev server, navigate to The Pond, click Shallow End, play through a fight, verify fish appears in inventory on win and event log updates.
4. **Edge cases**: Test with out-leveled fish (stats way above player), verify inventory-full blocks casting.
