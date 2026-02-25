<!--What is a PRD: A PRD(product requirement document> is a document that we use to document a project and its requirements. We use this as a communication tool to describe a project which might get broken down into multiple PRs and guide coding agents through the implementation -->

# PRD: Fishing game prototype in React

We want to make a fishing game prototype in React. This will be used to test the economy for the actual game

## Context

We want to make a fishing game similar to the model specified in `model/game_model.py` and `20260224_game_model.md`, whilst reusing the code already created in `prototype/`. `prototype/` has code for an entirely different game that's irrelevant to what we're trying to make, but it contains components that could be reused. We'll reuse what we can and make new components as needed.

## Requirements
We want to make an idle game centered around fishing in React.

This idle game will look and play similarly to "A Dark Room" (https://adarkroom.doublespeakgames.com/). 

The gameplay loop will be:
1. Travel to a fishing area
2. Go fishing
3. Travel back to the shop to sell fish
4. Buy upgrades at shop

The screen will look as follows
┌─────────────────────────────────────────────────────────┐
│ Event Log │ Actions Section               | Inventory	  │ 
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘

### Event Log
The Event log will be a running log of events that occur in the game. For example, if the player catches a fish, the log will display "Fish Caught: Minnow". The log will display the 20 most recent messages.

### Actions Section
The actions page will display:
1. Location tab
	- Displays a list of locations. The current location will be bolded
2. Actions relavent to the location. 
	- Actions are displayed as buttons

Example diagram:
┌─────────────────────────────────────────────────────────┐
│ *The Shop* │ The Pond | Location 3                	  │ 
│                                                         │
│	┌───────────────────┐   ┌───────────────────┐		  │	
│	│ Upgrade name (20$)│   │ Upgrade 2    (1$) │		  │
│	└───────────────────┘   └───────────────────┘ 		  │
└─────────────────────────────────────────────────────────┘

We will have two locations to start off with:
1. The Shop
2. The Pond

#### The Shop
The Shop is where players can spend their money to buy upgrades. Upgrades are specified in the `data/ShopGameplay.csv`. Each upgrade will be shown as a button as such:
┌───────────────────┐
│ Upgrade name (20$)│ 
└───────────────────┘

If the player can't afford the upgrade, then the button will be grayed out.

#### The Pond
The Pond is where players can go fishing. There will be three options
1. Fish Shallow End
2. Fish Deep End
3. Fish Far End

All of these options will initiate the fishing minigame. The only difference between them is the kind of fish the mini game will be for. This will be implemented in a later PRD. For now, let's show a popover modal with an X button to close it.

### Inventory
The inventory will show
1. How much money the player has
2. What fish the player has and how much is left in their inventory

Example diagram:
┌────────────────────┐
│ Money: $2000       │
│ Fish (3 / 4)       │ 
│    Minow           │
│    Trout           │
│    Minow           │
└────────────────────┘
## Solution

### New Game State

Replace the existing prototype stores (resources, vectors, produce, etc.) with stores that model the fishing game:

- **`playerStore`** — Holds wallet (money), player stats (`reelStrength`, `drag`, `lineStrength`), inventory capacity, and owned lures. Stats match the columns in `data/ShopGameplay.csv`.
- **`inventoryStore`** — Holds a list of caught fish (name, basePrice). Capped at the player's inventory capacity. Tracks current count vs max.
- **`shopStore`** — Loads upgrade data from `data/ShopGameplay.csv`. Tracks which upgrades have been purchased and at what level. Each upgrade has a list of prices per level (space-separated in the CSV).
- **`fishStore`** — Loads fish data from `data/FishGameplay.csv`. Provides available fish filtered by the player's owned lures.
- **`locationStore`** — Tracks the current location (Shop or Pond). Used by the Actions Section to decide which actions to render.
- **`eventLogStore`** — A capped array of recent event strings (max 20). New entries push to the front; oldest entries are dropped.

### Data Loading

CSV files (`data/FishGameplay.csv`, `data/ShopGameplay.csv`) are loaded at startup. Since Vite serves the `public/` folder as static assets, copy (or symlink) the CSV files into `prototype/public/data/` and fetch them on app init.

### Layout

The top-level layout is a three-column flex container matching the wireframe:

```
┌──────────────┬─────────────────────────┬──────────────────┐
│  Event Log   │    Actions Section      │    Inventory     │
│  (fixed-w)   │    (flex-grow)          │    (fixed-w)     │
│              │                         │                  │
│  scrollable  │  [Tab: Shop | Pond]     │  Money: $2000    │
│  last 20     │                         │  Fish (3/4)      │
│  messages    │  (location-specific     │    Minnow        │
│              │   action buttons)       │    Trout         │
│              │                         │    Minnow        │
└──────────────┴─────────────────────────┴──────────────────┘
```

### Actions Section

The Actions Section has a **tab bar** at the top with one tab per location. Clicking a tab sets the current location. The active tab is bolded.

**Shop tab:** Renders one button per upgrade from `ShopGameplay.csv`. Each button shows `{upgrade name} ({price}$)`. If the player can't afford it or it's maxed, the button is disabled/grayed out. Purchasing deducts money, increments the upgrade level, and applies the stat change to `playerStore`. Also sells all fish in inventory (adds their total basePrice to wallet) and logs a message.

**Pond tab:** Renders three buttons — "Fish Shallow End", "Fish Deep End", "Fish Far End". Clicking any button opens a popover/modal dialog with placeholder content and an X button to close it. The fishing minigame implementation is deferred to a later PRD.

### Reusable Components

- **`StoryLog`** — Already exists and renders a scrollable list. Repurpose for the Event Log by connecting it to `eventLogStore`.
- **`UpgradeButton`** — Already exists and handles cost display + affordability checks. Adapt for shop upgrades.
- **Radix UI** — Continue using `@radix-ui/themes` for buttons, tabs, dialogs, scroll areas, and layout primitives.

### Selling Fish

When the player navigates to the Shop (clicks the Shop tab), all fish in inventory are automatically sold. The total sale price is added to the wallet, inventory is cleared, and a log message like "Sold 4 fish for $8" is pushed to the event log.

## Implementation Plan

### Phase 1: Data Layer
1. Copy `data/FishGameplay.csv` and `data/ShopGameplay.csv` into `prototype/public/data/`
2. Create a `prototype/src/util/csvLoader.ts` utility that fetches and parses these CSVs into typed arrays (fish list and shop upgrade list)
3. Create `eventLogStore` — a Zustand store holding an array of strings (max 20) with a `pushEvent(msg)` action
4. Create `playerStore` — wallet (starts at 0), stats (`reelStrength: 10`, `drag: 1`, `lineStrength: 20`), inventory capacity (starts at 4), owned lures (Set)
5. Create `inventoryStore` — array of caught fish objects, with `addFish`, `clearInventory`, `isFull` derived state
6. Create `shopStore` — loads from CSV, tracks `upgradeLevel` per upgrade ID, exposes `buyUpgrade(id)` which deducts cost, increments level, and applies stat to `playerStore`
7. Create `fishStore` — loads from CSV, exposes `getAvailableFish()` filtered by owned lures
8. Create `locationStore` — simple enum store (`Shop | Pond`), with `setLocation` action

### Phase 2: Layout & Event Log
1. Replace `App.jsx` content with the three-column layout (Event Log | Actions | Inventory)
2. Adapt `StoryLog` (or create `EventLog` component) to read from `eventLogStore` and render the 20 most recent messages in a scrollable area
3. Style columns with Radix `Flex` — fixed width for Event Log and Inventory, flex-grow for Actions

### Phase 3: Inventory Panel
1. Create `InventoryPanel` component showing wallet from `playerStore` and fish list from `inventoryStore`
2. Display format: "Money: ${wallet}" at top, then "Fish ({count} / {capacity})" header, then a list of fish names

### Phase 4: Actions Section — Tabs & Location Switching
1. Create `ActionsSection` component with a tab bar (Radix `Tabs`) for each location
2. Clicking a tab calls `locationStore.setLocation`
3. The active tab renders the corresponding location view

### Phase 5: The Shop
1. Create `ShopView` component that renders upgrade buttons from `shopStore`
2. Each button shows "{ID} ({price}$)" and is disabled if the player can't afford it or the upgrade is maxed
3. On arriving at the Shop (tab switch), auto-sell all fish: clear inventory, add total price to wallet, push event log message
4. On purchase: deduct money, apply upgrade, push event log message (e.g. "Bought LINE_STR Level 2")

### Phase 6: The Pond
1. Create `PondView` component with three buttons: "Fish Shallow End", "Fish Deep End", "Fish Far End"
2. Clicking any button opens a Radix `Dialog` modal with placeholder text ("Fishing minigame coming soon...") and an X close button
3. Push an event log message when the modal opens (e.g. "Cast line into the shallow end...")

### Phase 7: Cleanup + Debug Panel
1. Deleted all unused old stores (`resourceStore`, `vectorStore`, `produceStore`, `upgradeStore`, `actionStore`, `cooldownStore`, `fuelStore`, `FieldStore`, `delivererStore`, `ventureStore`, `workerStore`) and old components (`ResourceView`, `StoryLog`, `produceView`, `homeView`, `yardView`, `FieldView`, `HoverButton`, `UpgradeView`, `Venture`, `WorkerView`, `world`, `nodePrototype`, `menuSection`, `unlocks`, `DescriptionView`, `HoverPopover`, `Deliverer`, `Canvas`, `upgradeButton`, `Menu`, `GameLoop`, `Story`, `StoryRepo`, `OneShotVector`, `TransferVector`, `Costs`, `Ease`, `util/util`)
2. Rewrote `debug.tsx` as a fishing-game debug panel with three sections:
   - **Money** — text input + button to call `addMoney()` from `playerStore`
   - **Inventory** — button per fish type from `fishStore` to call `addFish()`, plus "Clear Inventory"
   - **Shop Upgrades** — force-buy button per upgrade (bypasses cost check), shows current level
   - **StoreView** — raw JSON display of `playerStore` and `shopStore` state
3. Wired the debug panel into `App.jsx`, toggled by pressing the backtick key (`` ` ``). Renders as a fixed overlay pinned to the bottom of the viewport (max 80vh, scrollable)

### Test Plan

1. **Data loading** — App starts without errors; fish and shop data are loaded (verify via console or debug component)
2. **Event log** — Events appear in the log panel and cap at 20 entries; oldest messages are dropped
3. **Location switching** — Clicking Shop and Pond tabs switches the displayed actions; active tab is visually distinct
4. **Shop upgrades** — Upgrade buttons show correct prices; buying deducts money and disables the button when unaffordable or maxed; player stats update
5. **Selling fish** — Navigating to Shop sells all fish in inventory; wallet increases by the correct total; inventory clears
6. **Inventory display** — Inventory panel shows current money and fish count / capacity accurately after catches and sales
7. **Pond modal** — Clicking any fishing button opens a modal; the X button closes it; event log records the action
8. **Build** — `npm run build` succeeds with no errors
