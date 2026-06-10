<!--What is a PRD: A PRD(product requirement document> is a document that we use to document a project and its requirements. We use this as a communication tool to describe a project which might get broken down into multiple PRs and guide coding agents through the implementation -->

# PRD: <description>

This PRD outlines the new casting mechanic.

## Context

When players are fishing, they need to choose a lure and then choose a fishing spot. When choosing a fishing spot, they are automatically transitioned into the hooking minigame. This part of the gameplay feels too quick and untrue to what we normally associate with fishing.

This feature will go in-line with a wider effort to slow down gameplay to feel more relaxing, like fishing.

## Requirements

- Replace the current location selection to a dropdown menu, to be selected alongside the lure.
- Introduce a new "cast" button.
  - This button can be held down to "charge up" a cast. The longer it is held, the further the lure is thrown
- When a cast is thrown, transition to the FightView screen. The lineDistance will increase from 0 to [25, 75], depending on how charged the cast was.
- Once the line distance reached its location, show the "reel/hook" button. The hooking minigame will continue as normal.

## Solution

### State Machine

Add two new states to `GameState` in `PondView`:

```
Idle → Casting → CastAnimation → Luring → Fighting
         ↑ hold Cast button
                 ↑ release, lure flies
                               ↑ lure arrives, bite timer starts
                                            ↑ fish bites + player hooks
```

- **Idle**: Lure dropdown + Location dropdown + Cast button (all in one screen, no more per-spot buttons)
- **Casting**: Cast button is held. A charge bar fills up over a max hold duration (e.g. 3s). Releasing transitions to CastAnimation.
- **CastAnimation**: The lure distance bar animates from 0 → `castTarget` (25–75, mapped from charge %). No buttons. After animation completes, transitions to Luring and starts the bite timer.
- **Luring**: FightView is shown with the lure stationary at `castTarget`. A "reel in" button cancels back to Idle. When the fish bites, the "hook" button appears.
- **Fighting**: Existing fight loop. FightEngine starts with `distance = castTarget` instead of the hardcoded 50.

### Cast Charge

- A reusable `ChargeButton` component handles all charge logic internally.
- It accepts `onRelease(chargePercent: number)` and `maxHoldMs` props.
- Internally tracks `pointerdown` timestamp and runs a `requestAnimationFrame` loop to update the fill.
- The button renders a fill layer (`position: absolute`, `width: chargePercent%`) behind the label — the button itself is the indicator.
- On `pointerup`/`pointercancel`, calls `onRelease` with the clamped charge percent and resets.
- PondView receives the charge percent and computes `castTarget = lerp(25, 75, chargePercent)`.

### Cast Animation in FightView

- FightView receives a new optional prop `castMode` with shape `{ progress: number; target: number }`.
- When `castMode` is set, the lure distance bar shows `progress` (animating up to `target`), and the reel/hook button is hidden.
- PondView drives `progress` via a `requestAnimationFrame` loop during `CastAnimation` state.

### Dynamic Start Distance

- `FightEngine` constructor accepts an optional `startDistance` parameter (default `50`).
- PondView passes `castTarget` when constructing `FightEngine`.

### Screen layout

```
IDLE
  lure   [ dropdown ]
  spot   [ dropdown ]
  [ hold to cast ]

CASTING
  [ ████████░░ cast ]  ← fill grows inside button itself

CAST ANIMATION (FightView, no buttons)
  lure distance  [ ██████░░░░░░ ] 38 / 100  ← animating

LURING (FightView)
  [ reel in ]   [ hook ]  ← hook appears on bite
  lure distance  [ ████████████ ] 38 / 100  ← frozen

FIGHTING (FightView, existing)
  [ reel ]
  lure distance  [ ██████░░░░░░ ] 38 / 100  ← decreasing on reel
  line hp        [ ████████████ ]
```

## Implementation Plan

### Phase 1 — Restructure Idle UI + ChargeButton Component

- Create `src/components/ChargeButton.tsx`. Props: `children`, `onRelease(chargePercent: number)`, `maxHoldMs` (default 3000), `disabled?`.
- Internally: `chargePercent` state, `rafRef` and `startRef` refs. `pointerdown` starts the RAF loop; `pointerup`/`pointercancel` calls `onRelease` and resets.
- Renders a `<button>` with `position: relative`. The fill layer is `position: absolute; left: 0; top: 0; height: 100%; width: ${chargePercent}%; pointer-events: none` with a distinct background.
- In `PondView`, replace the per-spot `MyButton` list with a `<select>` for location (alongside the existing lure `<select>`).
- Add `<ChargeButton onRelease={(pct) => handleCastRelease(pct)}>hold to cast</ChargeButton>` below the dropdowns.
- `handleCastRelease` computes `castTarget = lerp(25, 75, pct / 100)` and transitions to `CastAnimation`.

### Phase 2 — Cast Animation State

- Add `CastAnimation` and `Casting` to the `GameState` enum.
- Add `castTarget: number` and `castProgress: number` state values to `PondView`.
- In `CastAnimation`, run a `requestAnimationFrame` loop that increments `castProgress` at a fixed speed (e.g. 40 units/sec) until it reaches `castTarget`.
- Once `castProgress >= castTarget`: transition to `Luring`, call `scheduleBite()`.
- Render: pass `castMode={{ progress: castProgress, target: castTarget }}` to `FightView`.

### Phase 3 — FightView Cast Mode

- Add optional prop `castMode?: { progress: number; target: number }` to `FightViewProps`.
- When `castMode` is present: render only the lure distance `StatBar` (showing `castMode.progress`), no reel/hook button.
- The existing `fading` + stat bars remain unchanged for the fight phase.

### Phase 4 — Luring Inside FightView

- Add props `lureBiteReady?: boolean`, `onHook?: () => void`, `onReelIn?: () => void` to `FightViewProps`.
- When `gameState === Luring`: render FightView with lure distance frozen at `castTarget`, and show "reel in" / "hook" buttons using those props.
- Remove the old Luring/Missed render branch from PondView (the one that showed a bare `MyButton`).

### Phase 5 — Dynamic FightEngine Start Distance

- Add `startDistance?: number` parameter to `FightEngine` constructor (default `START_DISTANCE = 50`).
- In `PondView.startFight()`, pass `castTarget` as `startDistance`.

### Test Plan

1. **Idle screen** shows two dropdowns (lure and spot) and a single Cast button — no per-spot buttons.
2. **Short hold** on Cast produces a lure distance target near 25; **full hold** produces a target near 75.
3. After releasing Cast, the lure distance bar **animates from 0** to the target before any bite can occur.
4. The **hook / reel-in buttons are hidden** during the cast animation and only appear once the lure has arrived.
5. A **fish bite** during the luring phase shows the hook button; missing the window returns to Idle.
6. The **fight starts** with the lure distance bar already at the cast target (not at 50).
