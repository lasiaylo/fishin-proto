<!--What is a PRD: A PRD(product requirement document> is a document that we use to document a project and its requirements. We use this as a communication tool to describe a project which might get broken down into multiple PRs and guide coding agents through the implementation -->

# PRD: Lure Casting Mechanic

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

```
Idle → CastAnimation → Luring → Fighting
         ↑ release Cast button
                       ↑ lure arrives, bite timer starts
                                    ↑ fish bites + player hooks
```

- **Idle**: Lure dropdown + Location dropdown + Cast button (all in one screen, no more per-spot buttons). Charging is internal to `ChargeButton` — no separate `Casting` game state needed.
- **CastAnimation**: GSAP tween animates the lure distance from 0 → `castTarget`. No interactive button. After tween completes, transitions to Luring and starts the bite timer.
- **Luring**: `LuringView` shown with lure stationary at `castTarget`. A single button ("reel in") cancels back to Idle; it switches to "hook" when the fish bites.
- **Fighting**: Existing fight loop. `FightEngine` starts with `distance = castTarget`.

### ChargeButton (`src/components/ChargeButton.tsx`)

- Reusable component. Props: `children`, `onRelease(chargePercent: number)`, `maxHoldMs` (default 3000), `disabled?`.
- Uses Radix `Button` (`radius="none" variant="outline"`) to match existing button style.
- Tracks `pointerdown` timestamp with a RAF loop; calls `onRelease` with clamped charge percent on `pointerup`/`pointercancel`.
- The button itself is the charge indicator: a CSS `linear-gradient` grows white from left to right as charge increases. Background is transparent (shows page background when uncharged).

### Cast Animation

- Driven by GSAP (`gsap.to`) with `expo.out` easing — fast launch, dramatic slowdown like a shuttlecock.
- Duration scales with charge: `CAST_DURATION_MIN` → `CAST_DURATION_MAX` (short tap is a quick snap, full charge is a full arcing toss).
- GSAP tweens a plain object ref (`castProgressObjRef`) and calls `setCastProgress` on each update.
- On complete: transitions to `Luring`, starts bite timer.

### Component Structure

- **`src/components/StatBar.tsx`** — extracted from `FightView`; shared by both `FightView` and `LuringView`.
- **`src/components/LuringView.tsx`** — handles both `CastAnimation` and `Luring` states. Props: `distance`, `biteReady?`, `onHook?`, `onReelIn?`. Button is always visible; disabled when `onReelIn` is absent (during cast animation).
- **`src/components/FightView.tsx`** — fight-only, all props required.
- **`src/util/easing.ts`** — `easeIn` / `easeInEaseOut` extracted from `FightEngine`.

### Dynamic Start Distance

- `FightEngine` constructor: `startDistance` param (default `START_DISTANCE = 50`) placed before the optional `config` param.
- `PondView.startFight()` passes `castTargetRef.current` as `startDistance`.

### Screen layout

```
IDLE
  lure   [ dropdown ]
  spot   [ dropdown ]
  [ hold to cast ]

CASTING (inside ChargeButton, no game state change)
  [ ████████░░ cast ]  ← gradient fill grows inside button

CAST ANIMATION (LuringView, button disabled)
  [ reel in ]  ← disabled
  lure distance  [ ██████░░░░░░ ] 38 / 100  ← animating via GSAP

LURING (LuringView, button enabled)
  [ reel in → hook ]  ← label switches on bite
  lure distance  [ ████████████ ] 38 / 100  ← frozen

FIGHTING (FightView, existing)
  [ reel ]
  lure distance  [ ██████░░░░░░ ] 38 / 100  ← decreasing on reel
  line hp        [ ████████████ ]
```

## Implementation Plan

### Phase 1 — Restructure Idle UI + ChargeButton Component ✓

- Created `src/components/ChargeButton.tsx`.
- In `PondView`, replaced per-spot buttons with location `<select>` and `<ChargeButton>`.
- Added `CAST_MIN`, `CAST_MAX` constants. `handleCastRelease` computes `castTarget` and enters `CastAnimation`.

### Phase 2 — Cast Animation State ✓

- Added `CastAnimation` to `GameState`.
- Cast animation driven by GSAP `expo.out` tween (replaced initial RAF loop approach).
- Duration interpolated between `CAST_DURATION_MIN` and `CAST_DURATION_MAX` based on charge percent.

### Phase 3 — LuringView Component ✓

- Extracted `StatBar` to `src/components/StatBar.tsx`.
- Created `src/components/LuringView.tsx` for both cast animation and luring display.
- `FightView` restored to fight-only with all props required.

### Phase 4 — Luring Interaction ✓

- `LuringView` shows a single button that is disabled during cast animation and switches between "reel in" / "hook" during luring.
- `PondView` handles `handleReelIn` (cancels bite timers, returns to Idle) and passes `startFight` as `onHook`.

### Phase 5 — Dynamic FightEngine Start Distance ✓

- `FightEngine` constructor: `startDistance` before `config`.
- Updated all call sites (`FightTraceTab`, `ParamSweepTab`, `EconomyModel`).

## Test Plan

1. **Idle screen** shows two dropdowns (lure and spot) and a single Cast button — no per-spot buttons.
2. **Short hold** on Cast produces a lure distance target near 25 with a quick animation; **full hold** produces a target near 75 with a longer toss animation.
3. After releasing Cast, the lure distance bar **animates with an expo-out curve** (fast then dramatic slowdown) before any bite can occur.
4. The **reel-in button is visible but disabled** during the cast animation and becomes enabled once the lure arrives.
5. A **fish bite** during the luring phase switches the button to "hook"; missing the window returns to Idle.
6. The **fight starts** with the lure distance bar already at the cast target (not at 50).
