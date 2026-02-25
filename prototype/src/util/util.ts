import { MS_IN_SEC } from "./constants";
import { ProduceT, useProduce } from "../stores/produceStore";
import { UpgradeT, useUpgrade } from "../stores/upgradeStore";
import { useResource } from "../stores/resourceStore";
import { MenuT, useMenuUnlock } from "../Menu";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function isCustomEvent(evt: Event): evt is CustomEvent {
  return (evt as CustomEvent).detail !== undefined;
}

export function getRandomInt(min: number, max: number) {
  return Math.floor(getRandom(min, max));
}

export function getRandom(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function pick(obj: any, keys: any) {
  return Object.fromEntries(
    keys.filter((key: any) => key in obj).map((key: any) => [key, obj[key]]),
  );
}

export function getTickRate(rate: number, deltaTime: number) {
  return (rate / MS_IN_SEC) * deltaTime;
}

export function getStore(type: string) {
  let hook = useResource;
  // @ts-ignore
  if (Object.values(ProduceT).includes(type)) {
    // @ts-ignore
    hook = useProduce;
  }
  // @ts-ignore
  if (Object.values(UpgradeT).includes(type)) {
    // @ts-ignore
    hook = useUpgrade;
  }
  // @ts-ignore
  if (Object.values(MenuT).includes(type)) {
    // @ts-ignore
    hook = useMenuUnlock;
  }
  return hook;
}
