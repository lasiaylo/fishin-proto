import { ActionT, triggerAction, useAction } from "./actionStore";
import { create } from "zustand";
import { getEventFn, UpdateEvent, UpdateEventDetails } from "../GameLoop";
import { MS_IN_SEC } from "../util/constants";

interface ActionCooldown {
  actionT: ActionT;
  elapsed: number;
}

type CooldownState = { [key: number]: ActionCooldown };
export const useCooldown = create<CooldownState>(() => ({}));

export function triggerActionSlot(idx: number) {
  if (!isAvailable(idx)) return;
  const { actionT } = useCooldown.getState()[idx];
  const { cooldown } = useAction.getState()[actionT];

  triggerAction(actionT);
  const fn = getEventFn(({ deltaTime }: UpdateEventDetails) =>
    useCooldown.setState((s) => {
      const { elapsed } = s[idx];
      let newElapsed = elapsed + deltaTime / MS_IN_SEC;

      if (elapsed >= (cooldown ?? 0)) {
        newElapsed = 0;
        removeEventListener(UpdateEvent, fn);
      }
      s[idx].elapsed = newElapsed;
      return {
        ...s,
        [idx]: {
          actionT,
          elapsed: newElapsed,
        },
      };
    }),
  );
  addEventListener(UpdateEvent, fn);
}

export function isAvailable(idx: number) {
  const { actionT, elapsed } = useCooldown.getState()[idx];
  if (actionT === undefined || elapsed === undefined) return false;
  const { cooldown, unlocked } = useAction.getState()[actionT];
  return (
    unlocked !== undefined &&
    unlocked &&
    (cooldown === undefined || cooldown === 0 || elapsed === 0)
  );
}

export function setAction(idx: number, actionT: ActionT) {
  useCooldown.setState((s) => {
    s[idx] = {
      actionT,
      elapsed: 0,
    };
    return s;
  });
}
