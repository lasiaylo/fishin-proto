# Bird Tab

This PRD the birding minigame as prefaced by the game_actions PRD.

## Context

As per the game_actions PRD, there are now tabs in the game that each represent a minigame. There is the pray and fishing minigame. What is needed now is the birding minigame.

## Requirements

### Tab

There needs to be a tab labeled "Bird" that the player can switch to

### Minigame

For this minigame, the player is tasked to press the singular "Observe" button when there are alot of birds on the screen. Doing this will result in Feathers (working name).
The more birds that are on the screen, the higher the points. Observing birds will cause all of them to fly off, so it's up to the player to observe at the best moment.

**Bird Spawn**

- There are a maximum of 10 birds available at a time.
- Birds will fly in on a n (let's start with n=30) second cycle. "Earlier" birds will have a longer cycle than "later" birds. So the 1st bird may have a full 30 second cycle (30 seconds on screen, 30 seconds off screen), and the 10th bird will have a 10 second cycle. Let's keep this shrink forumla adjustable.

**Observing**

- Observing will be on a 30 second cooldown
- A bird observed yields 1 feather. Each simultaneous additional bird observed grants a 20% bonus to the total amount
- Birds will be represented by a yellow square that flies onto the scene. This will be eventually replaced by an actual asset.

## Solution

### The flock is a simulation, the birds are a view of it

The scoring question — "how many birds are on the ground right now" — has to have one answer, and
it has to be an answer a test can ask for without a scene. So the flock is a plain object, `BirdFlock` in
`Core/State/`, sitting beside `PrayAction` and exposed as `GameState.birds`. It owns ten birds,
each bird's timing, the observe cooldown, and the payout. It knows nothing about transforms,
prefabs or cameras.

The GameObjects read `flock.birds` and fly accordingly. What the player counts and what the game
pays for are the same list, by construction, rather than by two systems agreeing.

### One ticker for every action

`PrayController.Update` currently ticks `GameState.pray`, which was the honest amount of machinery
for one button. It is not the honest amount for two, and the bird flock has to keep flying while
the player is on the fish tab — a flock that only advances while you are looking at it is a flock
whose cycles mean nothing.

So the shared ticker the pray PRD deferred lands here: `ActionTicker`, a component on the `Action`
GameObject, ticking `GameState.pray` and `GameState.birds` once per frame. `PrayController` and
`BirdController` stop ticking and go back to being views. When Plant arrives it adds one line.

### Each bird is its own metronome

A bird is a square wave: on the ground for its cycle, away for its cycle, forever. Ten birds with
ten different cycles is the whole spawn system — no spawner, no pool, no cap check. Ten birds is
the maximum because there are ten of them.

Cycles are spread linearly between `birdCycleMax` (30s) and `birdCycleMin` (10s):

```
  bird   1     2     3     4     5     6     7     8     9    10
  cycle 30.0  27.8  25.6  23.3  21.1  18.9  16.7  14.4  12.2  10.0
```

A straight lerp, rather than a decay constant, because the requirement names both ends — "the 1st
bird may have a full 30 second cycle, and the 10th bird will have a 10 second cycle" — and a lerp
hits both exactly while staying two numbers a designer can move. Swapping in a geometric falloff is
one method body if the curve wants a different shape.

Every bird starts away, and bird _i_ first lands `i * birdStagger` seconds in (3s by
default). Without the stagger every bird is in phase at t=0, all ten land at once on the opening
frame, and the game hands out its maximum payout before the player has understood what a bird is.
With it, the flock trickles in and the periods drift apart on their own.

```
  bird 10  ▁▁▁███████▁▁▁▁▁▁▁███████▁▁▁▁▁▁▁███████▁▁▁▁
  bird  7  ▁▁▁▁▁▁████████████▁▁▁▁▁▁▁▁▁▁▁▁████████████
  bird  1  ▁▁▁▁▁▁▁▁▁███████████████████████▁▁▁▁▁▁▁▁▁▁
           t=0        █ landed   ▁ away          t=60
```

Observing scatters every landed bird — its away phase starts over, so the fast birds come back
first and the flock rebuilds from the bottom of the table. Birds that were already away are
untouched and keep their own timing, which is why a few of them wander in during the cooldown.

### What an observation is worth

`feathers = round(n × (1 + featherBonusPerBird × (n − 1)))`, with `n` the birds on the ground at
the moment of the press and the bonus at 20%:

```
  birds     1    2    3    4    5    6    7    8    9   10
  feathers  1    2    4    6    9   12   15   19   23   28
```

Read as a bonus applied once per additional bird rather than compounded per bird, which is the
kinder of the two readings of the requirement — the compounding one pays 52 at ten birds, which
makes anything short of a near-full shore feel like money left on the table. The curve above is
already superlinear enough to make waiting the interesting choice, and the constant is in tuning if
it wants to be sharper.

Five birds are on the ground at any given moment on average, so a patient player is choosing
between roughly 9 feathers now and roughly 20 for a wait they may not get. That is the minigame.

**The button greys out for the cooldown and nothing else.** Observing empty ground pays nothing
and still spends the 30 seconds, exactly as praying at full stamina grants nothing and still spends
its cooldown. The player is never stopped from taking a bad moment; that is the whole game, and a
button that refuses the worst moment has already told them which moments are worth taking.

### Feathers sit beside the wallet

`feathers` on `PlayerState`, a `FeathersChanged` event re-broadcast as `FeatherEvent` in
`GameState.Reset()` on the line under stamina's, and `AddFeathers`. Same shape as the wallet, minus
the spending half, because nothing sells feathers yet.

The readout is a plain label under `money` in `InventoryView.uxml`, not a bar: feathers have no cap,
so there is no proportion to draw. `InventoryController` listens to `FeatherEvent` exactly as it
listens to `MoneyEvent`.

"Feathers" being a working name is worth keeping cheap to change — it appears in one label in the
uxml and one line in `LogText`, and nowhere else the player can read.

### The birds are GameObjects that land on the ground

The flock is part of the world, not a layer drawn on top of it. A `Birds` object under
`__ENVIRONMENT__` carries a `BirdFlockView` component, a bird prefab, and ten landing transforms
scattered across the ground around the pond — the shore, the grass, the rocks the player walks past.
`BirdFlockView` instantiates the ten birds once at startup and then does nothing but keep each
GameObject agreeing with its entry in `GameState.birds`.

Birds on the ground rather than in the air is what makes the count readable. Ten specks against
open sky are ten specks at unknowable depths; ten birds standing on the ground the player already
knows the shape of are ten countable things, at a scale the shot has already established. It also
puts them where the player is looking while fishing.

The landing spots are authored transforms, not sampled from the NavMesh. Birds are scenery with a
number attached — they do not path, avoid each other, or care where the player is standing — and
hand-placing ten spots is both less machinery and better composition than anything sampling would
find. They should sit clear of the water and clear of where the player stands to cast.

Ten birds that never churn do not want a pool. `FishPool` exists because fish are spawned and
released constantly and their count is not knowable up front; the flock's count is fixed forever, so
the birds are instantiated once and parked when they are away.

A bird is `Bird.prefab`: a billboarded quad with an unlit yellow material, so it reads as a square
from wherever the camera is. Swapping in `P_VFX_Bird_01` from the Meadow pack later is a prefab
change and nothing else — no code knows what a bird looks like.

### A bird is four states

Motion in this game is states, so the bird gets the house treatment: `BdStAway`, `BdStFlyIn`,
`BdStGround` and `BdStFlyOut` on the prefab, discovered by a `FiniteStateMachine` like every other
entity, living in `Scripts/Birds/` behind its own asmdef the way the fish do. `Bd` rather than `B`
because `BSt*` is already the bobber's.

- **`BdStAway`** — parked out of sight, renderer off. Transitions to `BdStFlyIn` when the flock
  lands this bird.
- **`BdStFlyIn`** — descends from an entry point above and outside the scene to its landing spot
  over `birdFlyDuration` (0.6s), a duration rather than a speed so an arrival takes the same time
  wherever it comes from.
- **`BdStGround`** — stands on the spot with a small idle hop, so ten stationary squares don't read
  as a screenshot. Transitions out when the flock scatters this bird.
- **`BdStFlyOut`** — climbs back out the way it came, then `BdStAway`.

The landing spot is jittered a little on each arrival so a returning bird is not obviously the same
bird, and the entry point is above and outward from it, so an arrival reads as a bird dropping in
and a departure as the flock scattering upward.

**A bird counts from the frame it leaves `BdStAway`.** The fly-in is the animation of appearing, not
a state before appearing, and at 0.6s there is no window in which the ground and the score disagree.

### The camera does not follow the tab

World birds have a problem UI birds did not: the camera might not be pointed at them. The obvious
fix is to have the bird tab claim the camera — `CameraFocus` already decides what the view looks at
in response to events, so it could take `TabEvent` as one more.

**It doesn't, deliberately.** A tab that seizes the camera makes the tabs feel like separate
screens rather than different things to do at one pond, and it puts a second author on the view: a
cast in flight and a tab selection would each think they own it. `CameraFocus` is a fishing
behaviour, and stretching it to arbitrate between actions is the wrong shape.

What replaces it is composition. Landing the birds on the ground means the flock sits in the shot
the player already has: the alcove camera looks at the shore, and the landing spots are chosen from
points that camera can see. A player working a rod can look over, see nine birds standing on the
bank, and decide whether the switch is worth dropping their reel for — and the same shot is the one
they count in on the bird tab.

The cost is that the count is only as legible as the default framing makes it. If ten birds on the
bank turn out to be hard to read, the fix is the framing or the spread of the landing spots, not a
camera that moves when a tab is pressed.

### The tab holds only the button

```
   ┌──────────────────────────────────────────────┐
   │                                              │   ← the world, in the shot fishing left up
   │    ▪    ▪        ▪         ▪      ▪          │
   │ ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂ │   ← the shore they land on
   ├──────────────────────────┐                   │
   │ actionsContent           │                   │
   │   birdView               │                   │
   │     observeButton        │                   │
   ├──────────────────────────┤                   │
   │  pray  │  fish  │  bird  │                   │
   └──────────────────────────┴───────────────────┘
      .actions — bottom left, 250px
```

`birdView` joins `pondView` and `prayView` under `actionsContent`, and holds one thing: the observe
button, built exactly like the cast and pray buttons — a fill behind a label, with the fill sweeping
the cooldown. `BirdController` gates it and calls `Observe`. It never learns what a bird looks like;
that is `BirdFlockView`'s job, and the two only meet at `GameState.birds`.

### TabController stops counting to two

`TabController` currently holds two buttons, two views and an `isFish` boolean. A third tab makes
that arrangement embarrassing, and a fourth is already planned. It becomes a small list of tab,
button and view, selected by matching — Plant is then one entry and one uxml block.

`GameTab` gains `BIRD`. Nothing else has to learn about it: `PondController` already releases a
held reel on any tab that is not `FISH`, so walking away from a charging cast to look at birds
behaves exactly like walking away to pray.

### Tuning

`SimTuning` gains a Birds section — `birdCount` (10), `birdCycleMax` (30s), `birdCycleMin` (10s),
`birdStagger` (3s), `birdFlyDuration` (0.6s), `observeCooldown` (30s) and `featherBonusPerBird`
(0.2) — surfaced through `SimConstants` like everything else.

Timing is tuning; geometry is the scene. Where the ten landing spots are and where birds enter from
are authored on the `Birds` object, because they are things you judge by looking at the shot, not by
reading a number.

### Assumptions and risks

- **Feathers buy nothing.** This PRD mints a currency with no sink, which is the same shape of
  promise as a tab that does nothing. It is acceptable only because the birding loop is legible
  without one; the shop entry should follow quickly.
- **The 30s cooldown and the 30s longest cycle are a coincidence.** They came from different
  sentences in the requirements and interlock badly on purpose-looking terms: the slowest bird
  returns almost exactly when the button re-arms. Tune them as a pair, and expect one of them to
  move.
- **The rhythm is deterministic, so it is learnable.** Fixed cycles and a fixed stagger mean a
  perfect observe schedule exists and a sufficiently patient player will find it. That is fine for
  a first pass — a legible pattern is what makes the minigame feel like a minigame — but if it goes
  rote, per-arrival jitter on the cycle is the smallest fix and `VariableTimer` already exists.
- **Birds keep landing and leaving while the player is fishing.** Consistent with the water not
  freezing when the player looks away, and on the ground they are visible from the fishing shot, so
  a full shore is something the player can notice mid-cast. The cost is that a perfect alignment can
  happen while nobody is looking, which costs the player nothing they had.
- **`EconomyModel` knows nothing about feathers.** It models $/s, and feathers are not dollars.
  Nothing to do here, but the model is now describing a smaller share of the game than its name
  suggests.
- **The world can hide a bird the score still pays for.** `GameState.birds` is authoritative: a
  bird behind a rock, clipped by the near plane, or off the edge of the frame is still landed and
  still counts. If playtesting shows the ground is hard to read, the fix is the framing or the
  spread of the landing spots — or, failing that, putting the number back on the button — never a
  second count taken from the renderer.
- **Nothing reframes for the birds.** They are counted in whatever shot the fishing state has put
  up, which is the alcove camera except while a cast is out — and during a cast the view is on the
  bobber, where the flock may be out of frame entirely. A player who wants to count reels in first.
  That is the price of leaving the camera to the fishing.
- **Nothing is saved.** Feathers and the flock reset with `GameState`, like everything else.

## Implementation Plan

Three phases. The first is invisible, the second is playable, the third is the game.

### Phase 1: The flock

1. Add `feathers`, `FeathersChanged` and `AddFeathers` to `PlayerState`, plus `FeatherEvent` in
   `Core/Events.cs` wired in `GameState.Reset()` beside stamina.
2. Add the Birds section to `SimTuning` and `SimConstants`.
3. Add `BirdFlock` in `Core/State/`: ten birds with lerped cycles and staggered starts, a `Tick`,
   a `landedCount`, `canObserve`, `cooldownProgress`, and an `Observe` that pays the formula,
   scatters every landed bird, and announces itself.
4. Expose it as `GameState.birds`.
5. Add `ActionTicker` to the `Action` GameObject, ticking pray and birds; remove the `Tick` call
   from `PrayController`.

Ends with a flock nobody can see and tests that prove it flies.

### Phase 2: The tab and the button

1. Add `BIRD` to `GameTab` and generalize `TabController` to a list of tabs.
2. Add `birdTab` to `tabBar` and `birdView` to `actionsContent` in `ActionsView.uxml`, with the
   observe button built like the cast button.
3. Add `BirdController`: it drives the fill from `cooldownProgress`, gates the button on
   `canObserve`, and calls `Observe`. For this phase only, the label carries the count —
   `observe 4` — so the tab is playable before there is anything to look at.
4. Add the feather label to `InventoryView.uxml` and bind it in `InventoryController`.
5. Add an observed line to `LogText`, posted by `StoryTriggerListener` off a new `ObserveEvent`.

Ends with a working minigame played by reading a number.

### Phase 3: The flock in the world

1. Add `Bird.prefab`: a billboarded quad, unlit yellow, with a `FiniteStateMachine` and the four
   bird states.
2. Add `Scripts/Birds/` with its own asmdef, and `BdStAway`, `BdStFlyIn`, `BdStGround` and
   `BdStFlyOut` under `Scripts/Birds/States/`, transitioning on the flock's landed flag and on
   arrival.
3. Add the `Birds` object to the scene under `__ENVIRONMENT__`: ten landing transforms placed on the
   ground around the pond and `BirdFlockView` holding the prefab. It instantiates ten birds at
   startup and hands each one its entry in `GameState.birds`.
4. Check the alcove camera actually shows the landing spots, and nudge either the shot or the spots
   until it does.
5. Drop the count from the button label. The ground is the readout now.

Ends with a minigame played by watching.

### Test Plan

- **`BirdFlockTests` on the metronome:** the first bird's cycle is `birdCycleMax` and the last is
  `birdCycleMin`; a bird is landed for exactly its cycle and away for exactly its cycle; nothing has
  landed at t=0 and the flock fills in on the stagger.
- **`BirdFlockTests` on the payout:** the formula's values for one bird, a middling flock and a full
  one; an observe scatters every landed bird and leaves the ones that were already away alone; a
  scattered bird returns after its own cycle, so the fast birds come back first.
- **`BirdFlockTests` on the gate:** observing during the cooldown pays nothing and scatters nothing;
  observing with nothing landed pays nothing and still spends the cooldown, as a wasted pray does.
- **A `PlayerState` test** that feathers accumulate and announce, mirroring the wallet's.
- **A play-through in the world:** open the bird tab, watch the squares drop in and take off, and
  confirm the number of birds on the ground matches what an observe pays. Observe at a peak and
  confirm the log line, the feather readout and the scattered flock agree.
- **A play-through across tabs:** switch to fish during the cooldown, cast, come back, and confirm
  the flock kept flying and the cooldown kept running. Start a charge on the cast button, switch to
  the bird tab mid-charge, and confirm the rod drops its reel the way it does for pray.
- **A camera play-through:** confirm switching tabs never moves the camera, and that the flock is
  countable from the alcove shot the fishing state leaves up.
