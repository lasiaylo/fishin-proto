# PRD: Friend
## Context

A large part of fishing is the oral exchange of knowledge that is learned only through experience. I want this game to reflect on this experience, allowing players to feel like they've both grown in the game and also as a player. Alongside this, I want to experiment on the feeling of parallel play. 
To first start testing this feeling, I want to introduce an NPC that will parallel play with the player, offering them tips and gifts as they help each other out in their journey.

## Requirements
- Chatroom List:
  - Underneath the event log, show a current list of all active players at a location.
  - Whenever an NPC joins, show their name "Big Ghost" in the chatroom
- Gift request:
  - At certain points, an NPC will open a gift request to the player. Show this as an alert under the chatroom interface. The player can choose to accept or ignore it.
  - Accepting a gift will post an event to the event log and add the gift to the player's inventory.
- Tips:
  - The NPC can gift a tip, which will show up in the player's InventoryView
  - The TipView will show a list of collected tip titles. Hovering over a title will show a popup of the full tip.

Both the NPC logging in and the Gift request will be triggered at certain points in the game (i.e. after 10 casts).  I haven't quite figured that out yet, so let's have these events trigger only on button presses:
- n -> NPC logs in
- m -> NPC opens a gift request containing a tip

## Solution

**Tips are a static CSV catalog, like everything else.** A new top-level `public/data/Tips.csv` (columns: `id,title,text`) holds the flavor content — no gameplay/display split like `Fish`/`Shop`/`Bait` need, since a tip has no numeric stat, only a title and a body. A new `src/stores/tipStore.ts` (`useTipData`, `initTipData()`) loads it once at startup the same way `baitStore`/`rodStore`/`fishStore` load their static catalogs, via a new `loadTipData()` in `csvLoader.ts` following the existing `loadBaitData` shape (single fetch + `parseCSV`, no display-map merge needed).

**`friendStore` holds the mutable NPC/chat state**, separate from the static tip catalog — mirroring the existing split between a static `*Data` store and the mutable state that references it (e.g. `baitStore` vs. `baitInventory` on `playerStore`). It tracks: `chatroom: string[]` (names currently "present" — starts empty, gains `"Big Ghost"` once the NPC logs in), `pendingGift: { tipId: string } | null` (at most one open request at a time), and `collectedTipIds: string[]` (accepted tips, in acceptance order — this is what `TipView` reads). `FRIEND_NPC_NAME = "Big Ghost"` lives in `constants.ts`; there's only one NPC today so it isn't data-driven.

**Chatroom UI sits directly under `EventView`.** A new `ChatroomView.tsx` renders the `chatroom` roster as a plain list (same `Text size="1" color="gray"` styling as `EventView`'s event lines, for visual continuity), and, when `pendingGift` is set, an inline alert block beneath the roster with "accept"/"ignore" `MyButton`s — not a full-screen overlay like `EndOfDayPopup`, since the PRD calls for it to sit "under the chatroom interface" as part of the same small side panel, not interrupt play. `App.jsx` wraps `EventView` and the new `ChatroomView` in a column `Flex` so they stack in the same left-hand slot, while `ActionsSection`/`InventoryView` remain unaffected siblings.

**Accepting a gift moves a tip id into `collectedTipIds` and posts an event; ignoring just clears `pendingGift`.** Since the only gift content this PRD implements is a tip, `pendingGift` models that directly (`{ tipId }`) rather than introducing a generic `Gift`/`Item` type for a single case — there's no other content type to unify against yet. `acceptGift()` appends to `collectedTipIds`, clears `pendingGift`, and calls `pushEvent(EventMsg.GIFT_ACCEPTED(tip.title))` (new `EventMsg` entry, colored like the existing `CAUGHT`/`SOLD_FISH` two-part messages). `ignoreGift()` only clears `pendingGift` — no event, no inventory change.

**`TipView` is a new component mounted inside `InventoryView`**, as a fourth stacked section alongside "cooler" and "tackle box." It maps `collectedTipIds` to their `tipStore` titles and renders each as a `Text` row wrapped in a Radix `Tooltip` (the same primitive `MyButton` already uses for its hover description) showing the tip's full `text` on hover — no new hover/popup mechanism needed.

**The two debug hotkeys slot into `App.jsx`'s existing `handleKey`**, alongside the `` ` `` and `Escape` `if` blocks (no switch refactor, no new listener): `n` calls `friendStore.npcLogin(FRIEND_NPC_NAME)` (adds to `chatroom` if not already present, and posts an `EventMsg.NPC_LOGIN` event — same pairing of "state change + event log entry" already used for other actions in this file); `m` calls `friendStore.openGiftRequest()`, which picks the first `tipStore` entry not already in `collectedTipIds` and sets it as `pendingGift` (a no-op, matching `forceEndDay`'s already-true no-op, if a gift is already pending or every tip has been collected).

```
'n' ──► friendStore.npcLogin("Big Ghost") ──► chatroom: [...,"Big Ghost"]  ──► event log: "Big Ghost joined"
                                                        │
                                              ChatroomView renders roster

'm' ──► friendStore.openGiftRequest() ──► pendingGift = { tipId }
                                                        │
                                        ChatroomView shows accept/ignore alert
                                            ┌───────────┴────────────┐
                                       accept()                  ignore()
                                            │                         │
                              collectedTipIds += tipId          pendingGift = null
                              pendingGift = null
                              event log: "received a tip: <title>"
                                            │
                                     TipView (in InventoryView)
                              lists collected titles; hover ──► full text (Tooltip)
```

This feature has no timing, bite-probability, XP, or fight-outcome effect — chatroom presence, gift requests, and tips are flavor/side systems triggered only by debug hotkeys for now, with no wallet or fish-catch impact — so per the `CLAUDE.md` sync rule, no `EconomyModel.ts` changes are needed for this phase.

## Implementation Plan

### Phase 1 — Tips data + static catalog
**`public/data/Tips.csv`** (new): `id,title,text` rows, a handful of sample tips.
**`src/util/csvLoader.ts`**: add `TipData { id, title, text }` interface and `loadTipData()`, following `loadBaitData`'s single-fetch-plus-`parseCSV` shape (no display-map merge).
**`src/stores/tipStore.ts`** (new): `useTipData` holding the loaded `TipData[]`, plus `initTipData()` called from `App.jsx`'s startup `useEffect` alongside the other `init*` calls.

### Phase 2 — `friendStore`
**`src/util/constants.ts`**: add `FRIEND_NPC_NAME = "Big Ghost"`.
**`src/stores/friendStore.ts`** (new): state — `chatroom: string[]`, `pendingGift: { tipId: string } | null`, `collectedTipIds: string[]`.
- `npcLogin(name)` — appends `name` to `chatroom` if not already present; pushes `EventMsg.NPC_LOGIN(name)`.
- `openGiftRequest()` — no-op if `pendingGift` is already set or every `tipStore` id is already in `collectedTipIds`; otherwise picks the first uncollected tip id and sets `pendingGift = { tipId }`.
- `acceptGift()` — no-op if `pendingGift` is null; otherwise appends `pendingGift.tipId` to `collectedTipIds`, clears `pendingGift`, and pushes `EventMsg.GIFT_ACCEPTED(title)` (title looked up from `tipStore`).
- `ignoreGift()` — clears `pendingGift` only.

### Phase 3 — Event messages
**`src/util/eventMessages.ts`**: add `NPC_LOGIN: (name: string) => \`${name} logs in\`` and `GIFT_ACCEPTED: (title: string) => ["received a tip: ", title]`, matching the existing `CAUGHT`/`SOLD_FISH` two-part colored-message shape.

### Phase 4 — Chatroom UI
**`src/components/ChatroomView.tsx`** (new): reads `chatroom` and `pendingGift` from `friendStore`. Renders the roster as `Text` rows (same size/color as `EventView`'s lines). When `pendingGift` is set, renders an alert block underneath with the pending tip's title/teaser and two `MyButton`s calling `acceptGift()` / `ignoreGift()`.
**`src/App.jsx`**: wrap `<EventView />` and the new `<ChatroomView />` in a `Flex direction="column"` so the chatroom sits directly under the event log in the same left-hand column; add `initTipData()` to the startup `useEffect`; extend `handleKey` with `if (e.key === "n") npcLogin(FRIEND_NPC_NAME);` and `if (e.key === "m") openGiftRequest();`.

### Phase 5 — TipView
**`src/components/TipView.tsx`** (new): reads `collectedTipIds` from `friendStore` and the full catalog from `tipStore`, rendering one `Text` row per collected tip (title only), each wrapped in a Radix `Tooltip` (`content={tip.text}`, same props shape as `MyButton`'s) showing the full tip body on hover.
**`src/components/InventoryView.tsx`**: render `<TipView />` as a fourth section, below "tackle box", following the same `Flex direction="column" gap` sectioning already used for "cooler" and "tackle box".
