# PRD: Gifting Friends
## Context

Right now, when an NPC logs in, their name just shows up in the chatroom. Nothing else happens, however. In real life, friends in a chatroom are always doing something.

This PRD outlines features that'll make NPCs feel more lively and give players more chances to interact with them.

## Requirements
- Chat Room Popup
  - Hovering over an NPC's name will show a pop-up.
  - This popup will:
    - Show what the NPC is currently doing (use dummy text for now).
    - Their gift availability 
    - Gift button
- Gifts
  - NPCs will be available to be gifted to every 7 minutes. 
  - Clicking the Gift Button in the Chatroom popup show a popup for gifting. Players can give any one fish currently in their cooler.
  - Giving a gift does nothing for now, but let's keep track of gifted fish.

- Inventory Locking
  - Clicking on a fish in the cooler "locks" it, preventing it from being sold.
  - Clicking on a locked fish "unlocks" it, making it able to be sold.
  - Locked fish have a lock icon next to them. 
  - Hovering over an unlocked fish shows the lock icon.
 
## Solution

**The chatroom popup is a Radix `HoverCard`, not the `Tooltip` `MyButton`/`TipView` already use.** `Tooltip` is reserved for inert text in this codebase; the popup here needs to host a clickable Gift button, and Radix's `Tooltip` isn't meant to hold interactive children on hover. `HoverCard` is the primitive built for exactly this ("hover reveals a rich, interactive popover"), so it's a new import but the natural fit rather than stretching `Tooltip`. In `ChatroomView.tsx`, each name in the `chatroom` roster gets wrapped in `HoverCard.Root`/`HoverCard.Trigger`/`HoverCard.Content` instead of a plain `Text` row. `HoverCard.Content` renders three things stacked in a `Flex direction="column"`: a dummy activity line (new `NPC_ACTIVITY_DUMMY = "watching their line"` constant — there's only one NPC and the PRD says dummy text is fine, so no per-NPC activity table yet), a gift-availability line, and a `MyButton` labeled "gift".

**Gift availability is a 7-minute cooldown keyed by NPC name, computed the same way in both the hover-card label and the button's disabled state.** `friendStore` gains `lastGiftedAt: Record<string, number>` (ms timestamp of the last successful gift to that name; an absent key means "never gifted, always available" — mirrors how `chatroom` already keys presence off the name string rather than an NPC id, since there's still only one NPC type). A new `GIFT_COOLDOWN_MS = 7 * 60 * 1000` constant lives in `constants.ts` next to the other timing constants. `friendStore` exports a pure helper `isGiftAvailable(name, now = Date.now())` so `ChatroomView` and the gift button both derive the same true/false instead of duplicating the arithmetic. Because the popover only exists while the `HoverCard.Content` is mounted, a live "available in Xm Ys" countdown can use a plain `useEffect` + `setInterval(1000)` scoped to that content (no new global ticking timer) — the interval starts on mount and is cleared on unmount, which Radix already handles by mounting/unmounting `HoverCard.Content` on hover in/out.

**Clicking "gift" opens a new `GiftDialog.tsx`, a Radix `Dialog` (also new to the codebase) rather than another `HoverCard`.** Picking one of several fish is a deliberate, modal choice — not a glanceable hover — so it gets its own component and its own open/close state (`giftDialogOpen`, local to `ChatroomView`, the same lightweight local-`useState` pattern `InventoryView` already uses for its sale popup). `GiftDialog` reads `usePlayer((s) => s.inventory)` (the cooler) and renders one row per fish with the same `Code`/`RARITY_COLOR` styling `InventoryView` uses for the cooler list; an empty cooler renders a single "cooler is empty" row instead of blank space. Clicking a row calls `giftFish(name, index)` and closes the dialog.

**`giftFish` is a new friendStore action, deliberately not reusing `acceptGift`.** `acceptGift`/`pendingGift` (from the earlier friend PRD) model the NPC gifting *the player* a tip and log an event; `giftFish` models the reverse direction — the player gifting the NPC a fish — and per this PRD "does nothing for now," so it must NOT push an event or touch the wallet, unlike `acceptGift`. `giftFish(name, index)` no-ops if `!isGiftAvailable(name)` or `inventory[index]` doesn't exist; otherwise it calls a new `removeFishFromInventory(index)` in `playerStore` (playerStore owns `inventory`, so it — not friendStore — is responsible for mutating it; today only bulk `sellAllFish()` exists, there's no per-slot removal yet), appends the removed fish to a new `giftedFish: InventoryFish[]` array in `friendStore` state (this is the "let's keep track of gifted fish" requirement — an append-only log, same shape as `collectedTipIds` tracking accepted tips), and sets `lastGiftedAt[name] = Date.now()`.

**Inventory locking reuses the cooler rows `InventoryView` already renders, adding click-to-toggle instead of a new list.** `InventoryFish` (in `playerStore.ts`) gains a `locked: boolean` field, defaulted `false` in `addFishToInventory`. A new `toggleFishLock(index)` flips it. The cooler `Code` rows in `InventoryView` become clickable (`onClick={() => toggleFishLock(i)}`); a new `LOCK_SYMBOL` constant (single-glyph, matching the existing `CURRENCY_SYMBOL`/`DREAM_POINT_SYMBOL` convention) renders next to a row when `item.locked` is true, and next to an unlocked row only while hovered — tracked with a local `hoveredIndex` state and `onMouseEnter`/`onMouseLeave`, the same scale of local state `InventoryView` already keeps for its sale-amount popup.

**Locking must actually block the sale, which means touching `sellAllFish` and its one caller.** `sellAllFish()` (in `playerStore.ts`) currently sells and clears the entire `inventory` unconditionally. It's changed to partition `inventory` into locked/unlocked, sum and pay out only the unlocked subset, and keep the locked fish in `inventory` afterward. Its only caller, `ActionsSection.tsx`'s `handleTabChange`, snapshots `inventory` before calling `sellAllFish()` and then loops over it to push a `SOLD_FISH` event per fish (`src/components/ActionsSection.tsx:29`) — that loop must filter to `!fish.locked` too, or a locked fish that didn't actually sell would still log a false "sold" event.

```
hover "big ghost" ──► HoverCard.Content mounts
                            │
              ┌─────────────┼──────────────────┐
        activity text   isGiftAvailable()   gift button
        (dummy string)   label + countdown       │
                                                click
                                                   │
                                        GiftDialog opens, lists cooler
                                                   │
                                          click a fish row
                                                   │
                                    giftFish(name, index)
                                          │              │
                          removeFishFromInventory(index)  giftedFish += fish
                                                          lastGiftedAt[name] = now

click cooler row (InventoryView) ──► toggleFishLock(i) ──► item.locked flips
                                                                  │
                                            sellAllFish() skips locked fish
```

Neither system changes per-cast timing, bite probability, XP, or fight-outcome math — gifting only moves a fish that was already caught out of the cooler without paying for it (an opt-in player choice, not a change to the expected-value formulas `EconomyModel.ts` computes), and locking only delays when a fish is sold. Per the `CLAUDE.md` sync rule, no `EconomyModel.ts` changes are needed for this phase.

## Implementation Plan

### Phase 1 — Inventory locking
**`src/util/constants.ts`**: add `LOCK_SYMBOL` (single glyph, alongside `CURRENCY_SYMBOL`/`DREAM_POINT_SYMBOL`).
**`src/stores/playerStore.ts`**: add `locked: boolean` to `InventoryFish` (default `false` in `addFishToInventory`); add `toggleFishLock(index: number)`; change `sellAllFish()` to only sell+remove fish where `!locked`, leaving locked fish in `inventory`.
**`src/components/ActionsSection.tsx`**: filter the pre-`sellAllFish()` inventory snapshot to `!fish.locked` before looping to push `SOLD_FISH` events (`handleTabChange`, around line 29).
**`src/components/InventoryView.tsx`**: make each cooler `Code` row clickable (`toggleFishLock(i)`); add local `hoveredIndex` state; render `LOCK_SYMBOL` next to a row when `item.locked` or when `hoveredIndex === i`.

### Phase 2 — Gift cooldown + gifted-fish tracking
**`src/util/constants.ts`**: add `GIFT_COOLDOWN_MS = 7 * 60 * 1000` and `NPC_ACTIVITY_DUMMY = "watching their line"`.
**`src/stores/playerStore.ts`**: add `removeFishFromInventory(index: number)` — removes and returns the fish at that slot (no-op / `undefined` if out of range).
**`src/stores/friendStore.ts`**: add state `lastGiftedAt: Record<string, number>` and `giftedFish: InventoryFish[]`; add `isGiftAvailable(name: string, now?: number): boolean` (pure, reads `lastGiftedAt` + `GIFT_COOLDOWN_MS`); add `giftFish(name: string, index: number)` — no-op if gift unavailable or slot empty, otherwise calls `removeFishFromInventory`, appends to `giftedFish`, sets `lastGiftedAt[name] = Date.now()`. No event log, no wallet/XP change.

### Phase 3 — Chatroom hover popup
**`src/components/ChatroomView.tsx`**: wrap each roster name in `HoverCard.Root`/`Trigger`/`Content` (replacing the plain `Text` row); `Content` renders the dummy activity line, an availability line driven by `isGiftAvailable`/`lastGiftedAt` with a `setInterval`-based live countdown scoped to the content's mount lifecycle, and a `MyButton` labeled "gift" that sets local `giftDialogOpen = true` (and records which name is being gifted to, for the single-NPC case just `FRIEND_NPC_NAME`).

### Phase 4 — Gift dialog
**`src/components/GiftDialog.tsx`** (new): Radix `Dialog.Root open={giftDialogOpen} onOpenChange={...}`; `Dialog.Content` lists `usePlayer((s) => s.inventory)` as `Code`/`RARITY_COLOR` rows (same styling `InventoryView` uses for the cooler), or a "cooler is empty" row when empty; clicking a row calls `giftFish(FRIEND_NPC_NAME, index)` and closes the dialog.
**`src/components/ChatroomView.tsx`**: render `<GiftDialog />`, passing/owning `giftDialogOpen`.
