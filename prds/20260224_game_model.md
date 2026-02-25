<!--What is a PRD: A PRD(product requirement document> is a document that we use to document a project and its requirements. We use this as a communication tool to describe a project which might get broken down into multiple PRs and guide coding agents through the implementation -->

# PRD: Game Model
We need to create an accurate model of our game in order to calculate stats for game mechanics like fish stats and shop items price / efficacy. We want to model the player's income over time, as this will be the core progression curve that will govern all other stats.

## Context
### Current Gameplay
The gameplay loop is:
1. Walk to fishing spot
2. Fish
3. Walk back to shop
4. Sell fish and purchase upgrades

A player can only fish until their inventory is full (4 fishes), so calculating a player's income over time can be done by calculating the sum of all fish the player can get divided by how long it takes for the player to make a round trip.

The time it takes to make a round trip is calculated by:
```
  Time = 2 * SHOP_TRAVEL_TIME (hard coded) + 4 * CAST_WAIT_TIME (hard coded) + 4 * fightTime(player_stats, fish_stats)
``` 

After a round trip, the player will purchase upgrades at the shop. These upgrades can either reduce the fight time (Increasing player strength allows them to pull fish in faster) or unlock new fish (a lure upgrade).

In the tools/ folder, we have a `fight_sim.py` script that calculates how long a fish fight takes. Right now, it's using hard coded values such as LINE_HP, FISH_SPEED, FISH_STRENGTH. We want to have these instead be read from a csv.

We have existing csv's in `Assets/Data/FishData.csv` and `Assets/Data/ShopUpgrades.csv`, but these contain some data superflous to the game mechanics.

## Requirements
### Calculate Income Over Time
Create a new script that lets us calculate the player's income over time. We do this by writing a script that simulates play. We can assume the player is making perfect plays (playing the fish fights efficiently, aiming for the most cost effective fish) and buying the cheapest items at the shop available to them.

The model should be a simplification of the game mechanics, not a complete emulation of the game code.

### Modify csvs to be easier to balance
Normalize existing csv's to contain only info pertaining to gameplay vs visuals (i.e in `FishData.csv`, `SpriteIndex` should be in visuals, but `Strength` should be in gameplay). After splitting, use the gameplay csv's to inform the model.


## Solution

### CSV Split

Split each existing CSV into a **gameplay** CSV and a **visual** CSV. The gameplay CSVs become the single source of truth for the model and the fight sim.

**FishData.csv** splits into:
- `Assets/Data/FishGameplay.csv` — `ID, Name, BasePrice, BaseWeight, Strength, Speed, RequiredLure`
- `Assets/Data/FishVisual.csv` — `ID, SpriteIndex`

**ShopUpgrades.csv** splits into:
- `Assets/Data/ShopGameplay.csv` — `ID, Price, Stat, ValuePerLevel`
- `Assets/Data/ShopVisual.csv` — `ID, Upgrade, Description`

`ShopGameplay.csv` adds two new columns so the model knows *what* each upgrade does mechanically:
- `Stat` — which player stat this upgrade modifies (e.g. `lineStrength`, `inventory`)
- `ValuePerLevel` — how much the stat increases per upgrade level (e.g. `1`)

### Refactor fight_sim.py

Replace the hardcoded constants in `fight_sim.py` with a function that accepts fish stats and player stats as parameters. The existing `Fight` class becomes reusable: instantiated with a fish's `speed`/`strength` and the player's current `reelStrength`/`drag`/`lineStrength`. It returns `(outcome, duration)` as it does today.

### Income Model Script

Create a new `tools/game_model.py` script that simulates the full progression loop:

```
┌─────────────────────────────────────────────────────────┐
│                    Simulation Loop                       │
│                                                         │
│  1. Load FishGameplay.csv and ShopGameplay.csv          │
│  2. Initialize player stats (defaults from PlayerStats) │
│  3. For each round trip:                                │
│     a. Pick the best winnable fish (highest price/time) │
│     b. Simulate 1 fight, multiply duration by inventory │
│     c. Calculate round trip time:                       │
│        2*TRAVEL + N*(CAST_WAIT + fight_time)            │
│     d. Calculate income = N * fish price                │
│     e. Calculate rate = income / round_time ($/sec)     │
│     f. Record: (round, cumulative_time, rate)           │
│     g. Buy cheapest available upgrade with earnings     │
│     h. Apply upgrade to player stats                    │
│     i. Repeat until all upgrades purchased or cap       │
│                                                         │
│  Output: table + matplotlib plot of $/sec over time     │
└─────────────────────────────────────────────────────────┘
```

The model assumes perfect play:
- Player always reels optimally (reels during REST, holds during STRUGGLE when tension allows)
- Player targets the fish with the best income rate (price / fight_time)
- Player buys the cheapest available upgrade after each round trip

### Update Unity C# Loaders

Update the C# CSV loaders (`FishStats`, `UpgradeManager`) to read from the new split CSVs. The gameplay fields stay the same — only the file path and which columns are present changes. Visual CSVs get loaded by their respective visual/UI components.

## Implementation Plan

### Phase 1: Split CSVs
1. Create `Assets/Data/FishGameplay.csv` with columns `ID, Name, BasePrice, BaseWeight, Strength, Speed, RequiredLure`
2. Create `Assets/Data/FishVisual.csv` with columns `ID, SpriteIndex`
3. Create `Assets/Data/ShopGameplay.csv` with columns `ID, Price, Stat, ValuePerLevel`
4. Create `Assets/Data/ShopVisual.csv` with columns `ID, Upgrade, Description`
5. Delete the original `FishData.csv` and `ShopUpgrades.csv`

### Phase 2: Update Unity C# Loaders
1. Update `FishData` to read from both `FishGameplay.csv` and `FishVisual.csv`, merging gameplay and visual data by ID into a single `FishTypeData`
2. Update `ShopUpgradesData` to read from both `ShopGameplay.csv` and `ShopVisual.csv`, merging gameplay and visual data by ID into a single `Upgrade` (add `Stat`, `ValuePerLevel` fields)

### Phase 3: Refactor fight_sim.py
1. Make `Fight.__init__` accept `fish_speed`, `fish_strength`, `reel_str`, `drag`, `line_hp` as parameters instead of reading globals
2. Keep the `plot()` function and `__main__` block working (default to hardcoded test values)

### Phase 4: Create game_model.py
1. Import the refactored `Fight` class from `fight_sim`
2. Add a helper function `load_fish_data(csv_path)` that reads `FishGameplay.csv` and returns a list of fish dicts
3. Add a helper function `load_shop_data(csv_path)` that reads `ShopGameplay.csv` and returns a list of upgrade dicts
4. Define simulation constants: `SHOP_TRAVEL_TIME`, `CAST_WAIT_TIME`, default player stats (`reelStrength=10`, `drag=1`, `lineStrength=20`, `inventory=4`)
5. Implement the round-trip loop:
   - For each round: pick best winnable fish (filtered by which lures the player has purchased — empty `RequiredLure` means always available), simulate one fight and multiply duration by inventory
   - After each round: attempt to buy the cheapest affordable upgrade, apply stat changes
   - Track cumulative time and per-round income rate (income / round_time)
6. Output a summary table (round #, cumulative time, $/sec, fish, upgrades bought)
7. Plot income rate over time using matplotlib ($/sec on Y, cumulative time on X)