import { create } from "zustand";
import { addMoney } from "./playerStore";

// Where each currency's passive income is paid. Adding a currency here gives
// it a passive-income slot and a row in the debug panel.
export const CURRENCY_SINKS = {
  money: addMoney,
} satisfies Record<string, (amount: number) => number>;

export type Currency = keyof typeof CURRENCY_SINKS;

export const CURRENCIES = Object.keys(CURRENCY_SINKS) as Currency[];

interface PassiveIncome {
  // Rate per second contributed by each source (e.g. an upgrade id), summed.
  sources: Record<string, number>;
  // Debug knobs: scale the summed rate, replace it outright, or stop it.
  multiplier: number;
  override: number | null;
  paused: boolean;
}

const emptyIncome = (): PassiveIncome => ({
  sources: {},
  multiplier: 1,
  override: null,
  paused: false,
});

export const usePassiveIncome = create<Record<Currency, PassiveIncome>>(
  () =>
    Object.fromEntries(CURRENCIES.map((c) => [c, emptyIncome()])) as Record<
      Currency,
      PassiveIncome
    >,
);

function computeRate(income: PassiveIncome): number {
  if (income.paused) return 0;
  if (income.override !== null) return income.override;
  const sum = Object.values(income.sources).reduce((a, b) => a + b, 0);
  return sum * income.multiplier;
}

export function getPassiveRate(currency: Currency): number {
  return computeRate(usePassiveIncome.getState()[currency]);
}

export function usePassiveRate(currency: Currency): number {
  return usePassiveIncome((s) => computeRate(s[currency]));
}

function patch(currency: Currency, update: Partial<PassiveIncome>) {
  usePassiveIncome.setState((s) => ({
    [currency]: { ...s[currency], ...update },
  }));
}

export function setPassiveSource(
  currency: Currency,
  sourceId: string,
  ratePerSec: number,
) {
  const sources = { ...usePassiveIncome.getState()[currency].sources };
  if (ratePerSec === 0) delete sources[sourceId];
  else sources[sourceId] = ratePerSec;
  patch(currency, { sources });
}

export function setPassiveMultiplier(currency: Currency, multiplier: number) {
  patch(currency, { multiplier: Math.max(0, multiplier) });
}

export function setPassiveOverride(currency: Currency, rate: number | null) {
  patch(currency, { override: rate === null ? null : Math.max(0, rate) });
}

export function setPassivePaused(currency: Currency, paused: boolean) {
  patch(currency, { paused });
}

// Fractional earnings carried between ticks, so the wallet stays whole.
const remainders = Object.fromEntries(CURRENCIES.map((c) => [c, 0])) as Record<
  Currency,
  number
>;

// Running total paid out per currency, so views can tell passive gains apart
// from active ones (e.g. to keep them out of the wallet popup).
const paidTotals = Object.fromEntries(CURRENCIES.map((c) => [c, 0])) as Record<
  Currency,
  number
>;

export function getPassivePaidTotal(currency: Currency): number {
  return paidTotals[currency];
}

function credit(currency: Currency, amount: number) {
  const total = remainders[currency] + amount;
  const whole = Math.floor(total);
  remainders[currency] = total - whole;
  if (whole <= 0) return;
  paidTotals[currency] += CURRENCY_SINKS[currency](whole);
}

// Debug fast-forward: pays `seconds` worth of the current rate at once.
export function grantPassiveSeconds(currency: Currency, seconds: number) {
  credit(currency, getPassiveRate(currency) * seconds);
}

const TICK_MS = 250;
let lastTick = Date.now();

// Elapsed time comes from the clock rather than the interval, so a throttled
// background tab still earns the full amount when it next ticks.
setInterval(() => {
  const now = Date.now();
  const seconds = (now - lastTick) / 1000;
  lastTick = now;
  for (const currency of CURRENCIES) {
    const rate = getPassiveRate(currency);
    if (rate > 0) credit(currency, rate * seconds);
  }
}, TICK_MS);
