import { RT, useResource } from "../stores/resourceStore";
import { UpgradeT, useUpgrade } from "../stores/upgradeStore";
import { ProduceT, useProduce } from "../stores/produceStore";
import { MenuT } from "../Menu";
import { getStore } from "../util/util";

export interface Unlockable {
  unlocked?: boolean;
}

type UnlockStage = {
  req: ProduceT | RT | UpgradeT;
  amount?: number;
  unlocks?: (ProduceT | UpgradeT | MenuT)[];
  locks?: (ProduceT | UpgradeT | MenuT)[];
  debugUnlock?: { [key in ProduceT | UpgradeT]?: number };
};

export const UNLOCK_CONFIG: UnlockStage[] = [
  {
    req: ProduceT.TheBakery,
    unlocks: [MenuT.Bakery, ProduceT.Housing],
    debugUnlock: {
      [ProduceT.Kindle]: 4,
    },
  },
  {
    req: RT.Jimby,
    unlocks: [],
  },
];

export function initUnlocks() {
  UNLOCK_CONFIG.forEach(({ req, amount, unlocks, locks }) => {
    unlocks?.forEach((type) => subscribe(req, amount, unlock(type)));
    locks?.forEach((type) => subscribe(req, amount, unlock(type, false)));
  });
}

function subscribe(
  type: ProduceT | RT | UpgradeT,
  amount: number | undefined,
  fn: () => void,
) {
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
  const unsub = hook.subscribe(
    //@ts-ignore
    (s) => s[type].amount,
    (val) => {
      if (val >= (amount ?? 1)) {
        fn();
        unsub();
      }
    },
  );
}

export function unlock(
  type: ProduceT | UpgradeT | MenuT,
  unlocked: boolean = true,
) {
  return () =>
    getStore(type).setState((s) => ({
      ...s,
      [type]: {
        // @ts-ignore
        ...s[type],
        unlocked: unlocked,
      },
    }));
}
