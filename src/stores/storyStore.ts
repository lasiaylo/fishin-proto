import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { loadStoryData } from "../util/csvLoader";
import { setAreaUnlocked } from "./unlockStore";
import { useMetrics } from "./metricsStore";
import { usePlayer } from "./playerStore";

// Stats a writer can reference in Story.csv's "when" column.
export interface StorySnapshot {
  casts: number;
  fish: number;
  sits: number;
  money: number;
}

// Game events a writer can hook with "on <event>" in Story.csv's "when"
// column, and the {placeholders} each one fills in.
export const STORY_EVENTS = {
  start: [],
  bite: [],
  crit: [],
  catch: ["fish"],
  escape: [],
  sell: ["fish", "price"],
  birds: ["birds", "payout"],
  nobirds: [],
} as const satisfies Record<string, readonly string[]>;

export type StoryEvent = keyof typeof STORY_EVENTS;

// Actions a writer can name in Story.csv's "action" column.
const STORY_ACTIONS: Record<string, () => void> = {
  "unlock pond": () => setAreaUnlocked("pond", true),
  "unlock sky": () => setAreaUnlocked("sky", true),
};

const COMPARATORS: Record<string, (a: number, b: number) => boolean> = {
  ">=": (a, b) => a >= b,
  "<=": (a, b) => a <= b,
  ">": (a, b) => a > b,
  "<": (a, b) => a < b,
  "=": (a, b) => a === b,
};

export interface StoryBeat {
  row: number;
  // Set for recurring "on <event>" beats; unset beats fire once.
  event?: StoryEvent;
  condition: (s: StorySnapshot) => boolean;
  variants: string[];
  action?: () => void;
}

interface StoryState {
  beats: StoryBeat[];
  firedRows: Set<number>;
}

export const useStory = create(
  subscribeWithSelector<StoryState>(() => ({
    beats: [],
    firedRows: new Set(),
  })),
);

export async function initStoryData() {
  const rows = await loadStoryData();
  const beats: StoryBeat[] = [];
  for (const { row, when, text, action } of rows) {
    try {
      const { event, condition } = compileWhen(when);
      const variants = text
        .split("|")
        .map((t) => t.trim())
        .filter(Boolean);
      variants.forEach((v) => validateText(v, event));
      beats.push({
        row,
        event,
        condition,
        variants,
        action: compileAction(action),
      });
    } catch (e) {
      console.warn(`Story.csv row ${row}: ${(e as Error).message}`);
    }
  }
  useStory.setState({ beats, firedRows: new Set() });
}

export function markBeatFired(row: number) {
  useStory.setState((s) => ({ firedRows: new Set(s.firedRows).add(row) }));
}

export function buildSnapshot(): StorySnapshot {
  const metrics = useMetrics.getState();
  return {
    casts: metrics.totalCasts,
    fish: metrics.totalFishCaught,
    sits: metrics.totalSits,
    money: usePlayer.getState().wallet,
  };
}

// Fills {placeholders} and splits off the [highlighted] part of a line.
export function renderBeatText(
  template: string,
  vars: Record<string, string | number>,
): { msg: string; colored?: string } {
  const filled = template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars[name.toLowerCase()] ?? ""),
  );
  const match = filled.match(/^([^[]*)\[([^\]]*)\](.*)$/);
  if (!match) return { msg: filled };
  // pushEvent shows msg then colored, so text after "]" joins the highlight.
  const [, before, highlighted, after] = match;
  return { msg: before, colored: highlighted + after };
}

function validateText(text: string, event: StoryEvent | undefined) {
  const allowed: readonly string[] = event ? STORY_EVENTS[event] : [];
  for (const [, name] of text.matchAll(/\{(\w*)\}/g)) {
    if (!allowed.includes(name.toLowerCase())) {
      throw new Error(
        allowed.length
          ? `"{${name}}" isn't available here — use one of: ${allowed.map((a) => `{${a}}`).join(", ")}`
          : `"{${name}}" isn't available here — this beat has no {placeholders}`,
      );
    }
  }
  if (!/^[^[\]]*(\[[^[\]]*\][^[\]]*)?$/.test(text)) {
    throw new Error(
      `"${text}" — use one pair of [square brackets] to highlight part of a line`,
    );
  }
}

// Splits an optional leading "on <event>" off the "when" column.
function compileWhen(when: string): {
  event?: StoryEvent;
  condition: (s: StorySnapshot) => boolean;
} {
  const match = when.match(/^on\s+(\S+)(.*)$/i);
  if (!match) return { condition: compileCondition(when) };
  const [, rawEvent, tail] = match;
  const event = rawEvent.toLowerCase();
  if (!(event in STORY_EVENTS)) {
    throw new Error(
      `unknown event "${rawEvent}" — use one of: ${Object.keys(STORY_EVENTS).join(", ")}`,
    );
  }
  const rest = tail.trim();
  if (rest && !/^and\s/i.test(rest)) {
    throw new Error(
      `can't read "${when}" — expected something like "on catch and fish >= 3"`,
    );
  }
  return {
    event: event as StoryEvent,
    condition: rest
      ? compileCondition(rest.replace(/^and\s+/i, ""))
      : () => true,
  };
}

// Compiles e.g. "fish >= 3 and money > 100" into a predicate.
function compileCondition(when: string): (s: StorySnapshot) => boolean {
  if (!when) throw new Error(`"when" is empty`);
  const clauses = when.split(/\s+and\s+/i).map((clause) => {
    const match = clause
      .trim()
      .match(/^(\w+)\s*(>=|<=|>|<|=)\s*(-?\d+(\.\d+)?)$/);
    if (!match) {
      throw new Error(
        `can't read "${clause.trim()}" — expected something like "fish >= 3"`,
      );
    }
    const [, rawStat, op, rawValue] = match;
    const stat = rawStat.toLowerCase() as keyof StorySnapshot;
    if (!(stat in EMPTY_SNAPSHOT)) {
      throw new Error(
        `unknown stat "${rawStat}" — use one of: ${Object.keys(EMPTY_SNAPSHOT).join(", ")}`,
      );
    }
    const compare = COMPARATORS[op];
    const value = Number(rawValue);
    return (s: StorySnapshot) => compare(s[stat], value);
  });
  return (s) => clauses.every((c) => c(s));
}

function compileAction(action: string): (() => void) | undefined {
  if (!action) return undefined;
  const fn = STORY_ACTIONS[action.toLowerCase().replace(/\s+/g, " ")];
  if (!fn) {
    throw new Error(
      `unknown action "${action}" — use one of: ${Object.keys(STORY_ACTIONS).join(", ")}`,
    );
  }
  return fn;
}

const EMPTY_SNAPSHOT: StorySnapshot = { casts: 0, fish: 0, sits: 0, money: 0 };
