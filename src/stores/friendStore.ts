import { create } from "zustand";
import { pushEvent } from "./eventLogStore";
import { EventMsg } from "../util/eventMessages";
import { getTipById, useTipData } from "./tipStore";
import { InventoryFish, removeFishFromInventory } from "./playerStore";
import { GIFT_COOLDOWN_MS } from "../util/constants";

interface PendingGift {
  tipId: string;
}

interface FriendState {
  chatroom: string[];
  pendingGift: PendingGift | null;
  collectedTipIds: string[];
  lastGiftedAt: Record<string, number>;
  giftedFish: InventoryFish[];
}

export const useFriend = create<FriendState>(() => ({
  chatroom: [],
  pendingGift: null,
  collectedTipIds: [],
  lastGiftedAt: {},
  giftedFish: [],
}));

export function npcLogin(name: string) {
  if (useFriend.getState().chatroom.includes(name)) return;
  useFriend.setState((s) => ({ chatroom: [...s.chatroom, name] }));
  pushEvent(EventMsg.NPC_LOGIN(name));
}

export function openGiftRequest() {
  const { pendingGift, collectedTipIds } = useFriend.getState();
  if (pendingGift) return;

  const { tipData } = useTipData.getState();
  const nextTip = tipData.find((t) => !collectedTipIds.includes(t.id));
  if (!nextTip) return;

  useFriend.setState({ pendingGift: { tipId: nextTip.id } });
}

export function acceptGift() {
  const { pendingGift } = useFriend.getState();
  if (!pendingGift) return;

  const tip = getTipById(pendingGift.tipId);
  useFriend.setState((s) => ({
    collectedTipIds: [...s.collectedTipIds, pendingGift.tipId],
    pendingGift: null,
  }));

  if (tip) {
    const msg = EventMsg.GIFT_ACCEPTED(tip.title);
    pushEvent(msg[0], msg[1], "cyan");
  }
}

export function ignoreGift() {
  useFriend.setState({ pendingGift: null });
}

export function isGiftAvailable(name: string, now: number = Date.now()) {
  const lastGiftedAt = useFriend.getState().lastGiftedAt[name];
  return lastGiftedAt === undefined || now - lastGiftedAt >= GIFT_COOLDOWN_MS;
}

export function giftFish(name: string, index: number) {
  if (!isGiftAvailable(name)) return;

  const fish = removeFishFromInventory(index);
  if (!fish) return;

  useFriend.setState((s) => ({
    giftedFish: [...s.giftedFish, fish],
    lastGiftedAt: { ...s.lastGiftedAt, [name]: Date.now() },
  }));
}
