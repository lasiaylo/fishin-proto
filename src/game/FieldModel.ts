import {
  StatName,
  type Requirement,
  type ShopUpgradeData,
} from "../util/csvLoader";
import {
  FIELDS_SIT_COOLDOWN_MS,
  FIELDS_SIT_PAYOUT,
  MIN_SIT_COOLDOWN_MS,
} from "../util/constants";

// Offline model of the fields section: the player sits every time the
// cooldown is ready, and spends the payouts on the fields shop. Mirrors
// `sit` in fieldsStore.ts, the passive ticker in passiveIncomeStore.ts, and
// the SIT_* / WIND cases of `applyStatEffect` in upgradeStoreFactory.ts —
// keep them in sync.

const FIELD_STATS = new Set<StatName>([
  StatName.SIT_PAYOUT,
  StatName.SIT_COOLDOWN,
  StatName.UNLOCK_POND,
  StatName.WIND,
]);

export interface FieldOptions {
  maxMinutes: number;
  // Seconds between the cooldown finishing and the player pressing sit.
  reactionDelayS: number;
  // End the run as soon as the pond is bought.
  stopAtPond: boolean;
}

export const DEFAULT_FIELD_OPTIONS: FieldOptions = {
  maxMinutes: 10,
  reactionDelayS: 0,
  stopAtPond: false,
};

export interface FieldSample {
  time: number; // seconds
  money: number;
  totalEarned: number;
  payout: number;
  cooldownMs: number;
  windPerS: number;
  incomePerMin: number;
}

export interface FieldPurchase {
  time: number;
  id: string;
  level: number;
  cost: number;
  sits: number; // sits taken by the time of the purchase
}

export interface FieldResult {
  samples: FieldSample[];
  purchases: FieldPurchase[];
  totalSits: number;
  totalEarned: number;
  pondUnlockedAt: number | null;
  endTime: number;
  finalIncomePerMin: number;
}

interface FieldState {
  levels: Record<string, number>;
  money: number;
}

function sitPayout(
  upgrades: ShopUpgradeData[],
  levels: Record<string, number>,
) {
  let payout = FIELDS_SIT_PAYOUT;
  for (const u of upgrades)
    if (u.stat === StatName.SIT_PAYOUT)
      payout += (levels[u.id] ?? 0) * u.valuePerLevel;
  return Math.max(0, Math.round(payout));
}

function sitCooldownMs(
  upgrades: ShopUpgradeData[],
  levels: Record<string, number>,
) {
  let cooldown = FIELDS_SIT_COOLDOWN_MS;
  for (const u of upgrades)
    if (u.stat === StatName.SIT_COOLDOWN)
      cooldown -= (levels[u.id] ?? 0) * u.valuePerLevel;
  return Math.max(MIN_SIT_COOLDOWN_MS, cooldown);
}

// Passive money per second from WIND upgrades.
function windRate(upgrades: ShopUpgradeData[], levels: Record<string, number>) {
  let rate = 0;
  for (const u of upgrades)
    if (u.stat === StatName.WIND) rate += (levels[u.id] ?? 0) * u.valuePerLevel;
  return rate;
}

// Money per second while sitting back-to-back, plus passive wind income.
function incomeRate(
  upgrades: ShopUpgradeData[],
  levels: Record<string, number>,
  reactionDelayS: number,
) {
  const period =
    sitCooldownMs(upgrades, levels) / 1000 + Math.max(0, reactionDelayS);
  const sitRate = period > 0 ? sitPayout(upgrades, levels) / period : 0;
  return sitRate + windRate(upgrades, levels);
}

function nextPrice(u: ShopUpgradeData, levels: Record<string, number>) {
  const level = levels[u.id] ?? 0;
  return level < u.prices.length ? u.prices[level] : null;
}

function available(
  upgrades: ShopUpgradeData[],
  levels: Record<string, number>,
): ShopUpgradeData[] {
  const byId = new Map(upgrades.map((u) => [u.id, u]));
  // Mirrors the shop's meetsRequirements: a bare ID needs that upgrade maxed,
  // ID:N needs level N, and IDs with no upgrade row count as met.
  const meets = ({ id, level }: Requirement) => {
    const req = byId.get(id);
    if (!req) return true;
    return (levels[id] ?? 0) >= (level ?? req.prices.length);
  };
  return upgrades.filter(
    (u) => nextPrice(u, levels) !== null && u.requirements.every(meets),
  );
}

// Picks the next thing to save for. Rate upgrades go by gain-per-cost; while
// the pond is still locked, one is only worth it if buying it first gets the
// pond sooner than saving straight for it.
function pickTarget(
  upgrades: ShopUpgradeData[],
  state: FieldState,
  reactionDelayS: number,
): ShopUpgradeData | null {
  const options = available(upgrades, state.levels);
  const rate = incomeRate(upgrades, state.levels, reactionDelayS);

  let best: ShopUpgradeData | null = null;
  let bestRoi = 0;
  for (const u of options) {
    if (u.stat === StatName.UNLOCK_POND) continue;
    const gained = { ...state.levels, [u.id]: (state.levels[u.id] ?? 0) + 1 };
    const roi =
      (incomeRate(upgrades, gained, reactionDelayS) - rate) /
      nextPrice(u, state.levels)!;
    if (roi > bestRoi) {
      bestRoi = roi;
      best = u;
    }
  }

  const pond = options.find((u) => u.stat === StatName.UNLOCK_POND);
  if (!pond) return best;
  if (!best || rate <= 0) return pond;

  const pondPrice = nextPrice(pond, state.levels)!;
  const bestPrice = nextPrice(best, state.levels)!;
  const newRate = incomeRate(
    upgrades,
    { ...state.levels, [best.id]: (state.levels[best.id] ?? 0) + 1 },
    reactionDelayS,
  );
  const direct = Math.max(0, pondPrice - state.money) / rate;
  const viaUpgrade =
    Math.max(0, bestPrice - state.money) / rate +
    (pondPrice - Math.max(0, state.money - bestPrice)) / newRate;
  return viaUpgrade < direct ? best : pond;
}

const MAX_SAMPLES = 400;

export function simulateField(
  shopData: ShopUpgradeData[],
  options: FieldOptions = DEFAULT_FIELD_OPTIONS,
): FieldResult {
  const upgrades = shopData.filter((u) => FIELD_STATS.has(u.stat));
  const reactionDelayS = Math.max(0, options.reactionDelayS);
  const maxTime = Math.max(0, options.maxMinutes) * 60;
  const sampleStep = maxTime / MAX_SAMPLES;

  const state: FieldState = { levels: {}, money: 0 };
  const samples: FieldSample[] = [];
  const purchases: FieldPurchase[] = [];
  let totalEarned = 0;
  let totalSits = 0;
  let pondUnlockedAt: number | null = null;
  let lastSampleTime = -Infinity;
  let time = 0;
  let nextSitAt = 0;

  const sample = (t: number, force = false) => {
    if (!force && t - lastSampleTime < sampleStep) return;
    lastSampleTime = t;
    samples.push({
      time: t,
      money: state.money,
      totalEarned,
      payout: sitPayout(upgrades, state.levels),
      cooldownMs: sitCooldownMs(upgrades, state.levels),
      windPerS: windRate(upgrades, state.levels),
      incomePerMin: incomeRate(upgrades, state.levels, reactionDelayS) * 60,
    });
  };

  sample(0, true);

  while (nextSitAt <= maxTime) {
    // Wind accrues continuously, but is credited (and spent) only at sits —
    // close enough with cooldowns of a few seconds.
    const wind = windRate(upgrades, state.levels) * (nextSitAt - time);
    state.money += wind;
    totalEarned += wind;
    time = nextSitAt;
    // The cooldown starts from the sit, so a cooldown upgrade bought with
    // this payout only shortens the following wait.
    const payout = sitPayout(upgrades, state.levels);
    nextSitAt =
      time + sitCooldownMs(upgrades, state.levels) / 1000 + reactionDelayS;
    state.money += payout;
    totalEarned += payout;
    totalSits++;

    let bought = false;
    for (;;) {
      const target = pickTarget(upgrades, state, reactionDelayS);
      if (!target) break;
      const price = nextPrice(target, state.levels)!;
      if (state.money < price) break;
      if (!bought) sample(time, true);
      bought = true;
      state.money -= price;
      const level = (state.levels[target.id] ?? 0) + 1;
      state.levels[target.id] = level;
      purchases.push({
        time,
        id: target.id,
        level,
        cost: price,
        sits: totalSits,
      });
      if (target.stat === StatName.UNLOCK_POND) pondUnlockedAt = time;
    }
    sample(time, bought);

    if (options.stopAtPond && pondUnlockedAt !== null) break;
  }
  sample(time, true);

  return {
    samples,
    purchases,
    totalSits,
    totalEarned,
    pondUnlockedAt,
    endTime: time,
    finalIncomePerMin: incomeRate(upgrades, state.levels, reactionDelayS) * 60,
  };
}
