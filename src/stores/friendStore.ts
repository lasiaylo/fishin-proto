import { create } from "zustand";
import { pushEvent } from "./eventLogStore";
import { EventMsg } from "../util/eventMessages";
import { getTipById, useTipData } from "./tipStore";

interface PendingGift {
  tipId: string;
}

interface FriendState {
  chatroom: string[];
  pendingGift: PendingGift | null;
  collectedTipIds: string[];
}

export const useFriend = create<FriendState>(() => ({
  chatroom: [],
  pendingGift: null,
  collectedTipIds: [],
}));

export function npcLogin(name: string) {
  useFriend.setState((s) =>
    s.chatroom.includes(name) ? s : { chatroom: [...s.chatroom, name] },
  );
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
