
# PRD: Fish Rarity


## Context

Right now, when players catch a fish, they're shown the fish name. This is fine, but it lacks excitement in the reward screen. Catching a fish means catching a fish. There's no sense of fighting a "monster". 

## Requirements

We will introduce fish rarities: common, uncommon, rare. Fish rarity will be displayed in the UI as:
- Common - Gray
- Uncommon - Blue
- Rare - Gold

Rarity will affect the stats and pricing of the fish as well:

Price:
- Common: 1x
- Uncommon: 1.5x
- Rare: 3x

Stats:
- Common: 1x
- Uncommon: 1.1x
- Rare: 1.3x

Rarities will have the following distribution:
- Common: 60%
- Uncommon: 35%
- Rare: 5%

This change will affect the player's overall income, so be sure to also include this impact on the Economy Modeling. 
There may be upgrades in the future that impact rare chances, but it will not be included in this change.

## Solution

Rarity is rolled at bite time — the moment a fish hooks — and is stored alongside the `InventoryFish` for the remainder of its lifetime (display, sell). The roll is a weighted random draw using the three-tier distribution above.

The rolled rarity scales the fish's base stats (attack, defense, hp, thrash) and sell price by the appropriate multipliers. This means rarer fish are both harder to reel in and worth more when sold — a deliberate risk/reward tradeoff.

```
Bite → rollRarity() → apply stat & price multipliers → fight → catch → display with rarity color → sell
```

**UI changes:**
- Inventory cooler list: fish name is colored by rarity (Radix `gray` / `blue` / `amber`)
- Event log: catch and sell entries are colored by rarity — the whole log line uses the rarity color instead of the default gray

**Economy Model changes:**

The expected rarity earnings multiplier is:

```
E[price_mult] = 0.60×1.0 + 0.35×1.5 + 0.05×3.0 = 1.275
```

However, rarity also changes fight difficulty (stat multiplier), which affects win rate non-linearly. To model this accurately, each fish in the simulation pool is expanded into three rarity variants — one per tier — with stats and base price scaled by the corresponding multipliers. Each variant's spawn weight is `originalWeight × rarityWeight`. The existing fight-trial machinery runs unchanged on these variants.

## Implementation Plan

### Step 1 — Constants (`src/util/constants.ts`)
- Add `Rarity` enum: `COMMON`, `UNCOMMON`, `RARE`
- Add `RARITY_WEIGHTS: Record<Rarity, number>` (`{ COMMON: 0.60, UNCOMMON: 0.35, RARE: 0.05 }`)
- Add `RARITY_PRICE_MULTIPLIER: Record<Rarity, number>` (`{ COMMON: 1.0, UNCOMMON: 1.5, RARE: 3.0 }`)
- Add `RARITY_STAT_MULTIPLIER: Record<Rarity, number>` (`{ COMMON: 1.0, UNCOMMON: 1.1, RARE: 1.3 }`)
- Add `rollRarity(): Rarity` helper using a weighted random draw against `RARITY_WEIGHTS`

### Step 2 — Types
- `src/stores/playerStore.ts`: Add `rarity: Rarity` field to `InventoryFish`; update `addFishToInventory` signature
- `src/stores/fishStore.ts`: Update `randomizeFishStats` to accept and apply a `Rarity`, scaling stats by `RARITY_STAT_MULTIPLIER[rarity]` and `basePrice` by `RARITY_PRICE_MULTIPLIER[rarity]` (on top of the existing ±10% roll). Return `rarity` from the call site so the caller can store it.

### Step 3 — Game logic (bite/hook sites)
- Find where fish is hooked and `randomizeFishStats` is called (likely in `PondView` or a game event handler)
- Call `rollRarity()` there, pass rarity to `randomizeFishStats`, and pass it along to `addFishToInventory`

### Step 4 — UI: Inventory (`src/components/InventoryView.tsx`)
- Map `Rarity` → Radix color token: `COMMON → "gray"`, `UNCOMMON → "blue"`, `RARE → "amber"`
- Apply the color to the `<Code>` element that renders the fish name in the cooler list

### Step 5 — UI: Event log
- Add optional `color` field to `LogEvent` in `src/stores/eventLogStore.ts`; update `pushEvent` to accept it
- In `src/components/EventView.tsx`, pass `event.color` to the `<Text color>` prop (falls back to `"gray"` if absent)
- At call sites for `CAUGHT` and `SOLD_FISH`, pass the rarity's Radix color token when pushing the event — no changes needed to `eventMessages.ts` message text

### Step 6 — Economy Model (`src/game/EconomyModel.ts`)
- Add a `expandFishByRarity(fish: FishData): Array<{ fish: FishData; weight: number }>` helper that returns three rarity variants of a fish with scaled stats/price and weight = `rarityWeight`
- In `evalLure` and `computeLureStats`, expand each fish in the pool into rarity variants before running trials. The variant weight is `originalFishWeight × rarityWeight` (weights still sum to 1 across all variants since rarity weights sum to 1)
- No changes needed to the fight engine or upgrade logic
