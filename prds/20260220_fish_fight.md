<!--What is a PRD: A PRD(product requirement document> is a document that we use to document a project and its requirements. We use this as a communication tool to describe a project which might get broken down into multiple PRs and guide coding agents through the implementation -->

# PRD: Fish Fight
<!-- In this section, briefly describe what the problem we're solving is and why it's important. -->

We want to revamp our fight logic so that we can more easily model out player and fish stats.
## Context

When the player hooks a fish, we go into a "fight". The fish is caught if the fish hitbox hits a predetermined point or is lost if it goes too far from the player (as defined in LineDistance.cs). It is also lost if the fish breaks the player line (LineTension.cs).

When in a fight, the fish's fsm goes into "FSTFight" and starts to pull on the line. While in "FSTFight", the fish toggles betweeen two substates: "FSTFightStruggle" and "FSTFightRest". These two substates determine how much quickly the fish is moving and how much tension it is adding to the line.

Right now, our fish fight is hard to model through number models alone. This is because our fight logic is dependent on physics (hitboxes + rigidbody velocity) and spread across multiple files.

We need to consolidate the fight logic into one place and abstract our fight to resemble more like an RPG to remedy these problems.

## Requirements
- Move all fight logic into the FightManager.cs
  - Fish no longer decides when it switches between struggle and rest. This is determined by the manager
  - LineTension / LineDistance are handled by fight manager
- Define a line distance variable. When line distance hits 0, then the fish is caught. When line distance hits 100, the fish is lost.
  - Move the fish closer or away from the player dependent on the LineDistance variable
- Define a line tension variable. When line tension hits its maximum, then the fish is lost.
- Give fish two stats:
  - Strength: How quickly line tension accrues when the fish is struggling and player is reeling
  - Speed: How quickly the line distance accrues when the fish is struggling
- Give player two stats:
  - Line Strength: How much line tension the line can accrue before breaking
  - Drag: Prevents the fish from pulling the line fast (think of as defense against the fish's speed)

## Solution

`FightManager` becomes the single source of truth for the fight. It owns two abstract scalar variables — `lineDistance` and `lineTension` — and ticks them every frame based on fish and player stats. Everything else (fish visual movement, line color) reads from FightManager rather than doing its own accounting.

**Abstract fight variables:**

```
lineDistance  float [0, 100]
              0   → fish caught (CATCH)
              100 → fish escaped (LINE_BREAK)

lineTension   float [0, playerLineStrength]
              at max → line breaks (LINE_BREAK)
```

**Tick rules (run inside FightManager.Update):**

```
STRUGGLE phase
  lineDistance += fishSpeed * dt
  lineDistance -= playerDrag * (playerReeling ? 1 : 0) * dt
  lineTension  += fishStrength * dt   (if playerReeling)
  lineTension  -= tensionDecay * dt   (if NOT playerReeling)

REST phase
  lineDistance -= reelSpeed * (playerReeling ? 1 : 0) * dt
  lineTension  -= tensionDecay * dt

Both phases: lineTension clamped [0, playerLineStrength]
             lineDistance clamped [0, 100]
```

**Phase switching (FightManager owns the timers):**

```
FightManager
  ├── struggleTimer  VariableTimer → on end: switch to REST
  └── restTimer      VariableTimer → on end: switch to STRUGGLE

FishFightState.CheckTransitions()
  reads FightManager.currentPhase instead of its own timer
```

**Fish positioning (lineDistance drives world position):**

```
fishTargetPos = lerp(castPos, escapePoint, lineDistance / 100)

FStFight moves the fish toward fishTargetPos each frame.
The fish's swim speed and direction remain physics-based for
visual feel, but the destination is dictated by FightManager.
```

**Stats:**

```
FishStats  (new fields)
  ├── strength  float   tension accrual rate during struggle while player reels
  └── speed     float   lineDistance accrual rate during struggle

PlayerStats  (new fields)
  ├── lineStrength  float   max lineTension before line breaks
  └── drag          float   subtracts from lineDistance accrual per second when reeling
```

**File responsibilities after the change:**

```
FightManager.cs    ← owns lineDistance, lineTension, currentPhase, phase timers,
                      catch/lose detection
FStFight.cs        ← moves fish toward FightManager.fishTargetPos; reads currentPhase
                      for swim speed
FishFightState.cs  ← CheckTransitions reads FightManager.currentPhase; own timer removed
FStFightStruggle   ← visual only: shake/rotation rates; stamina logic removed
FStFightRest       ← visual only: idle shake; reelForce removed
LineTension.cs     ← visual only: reads FightManager.tension/maxTension for line color
LineDistance.cs    ← deleted; catch/lose logic lives in FightManager
```

## Implementation Plan

### Phase 1 — Add Stats to Fish and Player

**FishStats.cs** — add `strength: float` and `speed: float` fields.

**FishData.csv** — add `Strength` and `Speed` columns.

**FishData.cs** — update `LoadFromCsv()` to parse the two new columns into `FishTypeData`.

**FishTypeData** (inside FishData.cs) — add `strength: float` and `speed: float` fields.

**FishGenerator.cs** — populate `strength` and `speed` on the returned `FishStats`.

**PlayerStats.cs** — add `lineStrength: float` and `drag: float` fields (serialized for inspector tuning).

---

### Phase 2 — FightManager Overhaul

Replace the current stub logic with a complete fight tick. Everything that currently lives in `LineTension.cs` and `LineDistance.cs` (tension accumulation, max-tension break, catch detection, escape detection) moves here.

- Add `lineDistance`, `lineTension`, `currentPhase` (enum: STRUGGLE / REST), `struggleTimer`, and `restTimer`.
- `Update()` ticks `lineDistance` and `lineTension` per the rules above, then checks win/lose conditions and calls `FightManager.Land()` or `FightManager.QueueLineBreak()` accordingly.
- Add `fishTargetPos` property: `lerp(castPos, escapePoint, lineDistance / 100)`. `EscapeBounds.GetRandomPos()` is called once on fight start to fix the escape point for that fight.
- Phase timers replace the VariableTimers previously owned by `FStFightStruggle` and `FStFightRest`. Configure their durations in the Inspector on the FightManager GameObject.
- Remove `GetPullForce()`, `GetPullType()`, `CalcPullType()`, and `PullType` enum — they are no longer needed.

---

### Phase 3 — Update Fish Fight States

**FishFightState.cs**
- Remove `stateTime: VariableTimer`.
- `CheckTransitions()` returns `FStFightStruggle` or `FStFightRest` based on `FightManager.currentPhase` rather than a timer.

**FStFightStruggle.cs**
- Remove `stamina`, `_currStamina`, `initStateTime`, and the stamina tick logic.
- Keep the visual shake/rotation fields; `Shake()` can continue to use `isPlayerReeling` for feel.
- `fishForce` property reads `FightManager.fishSpeed` (or removes itself if FStFight drives movement from `fishTargetPos` directly).

**FStFightRest.cs**
- Remove `reelForce`; this is no longer a stat on the substate.
- Keep the idle shake on enter.

**FStFight.cs**
- `FixedTickImpl()` replaces the random `GetNextTarget()` call with `FightManager.fishTargetPos` as the movement target.
- `fightAngleTime` and its random angle logic can be removed; the escape point is now set once per fight by FightManager.

---

### Phase 4 — Slim Down Visual Components

**LineTension.cs**
- Remove: `_tension`, `_delta`, `_pull`, `_reel`, `maxTension`, `Reel()`, `Pull()`, tension accumulation, and the `QueueLineBreak()` call.
- Keep: `ColorLine()`, which now reads `FightManager.lineTension / FightManager.maxTension`.

**LineDistance.cs**
- Delete the file. Its catch and lose detection is now inside FightManager.

---

### Test Plan

1. Catch a Minnow — confirm the catch screen appears (lineDistance reaches 0 while reeling during REST phase).
2. Let a Trout escape — confirm `LINE_BREAK` fires and the fight ends (lineDistance reaches 100 during STRUGGLE without reeling).
3. Reel too hard against a strong fish — confirm line break fires when `lineTension` reaches `playerLineStrength`.
4. Tune a fish with high Speed and confirm it pulls lineDistance faster than one with low Speed.
5. Increase player Drag in the Inspector and confirm it visibly slows lineDistance growth during STRUGGLE.
6. Verify the line renderer color transitions from low-tension (gradient start) to high-tension (gradient end) as `lineTension` rises.
