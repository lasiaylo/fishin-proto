import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { loadStoryData } from "../util/csvLoader";
import { FRIEND_NPC_NAME } from "../util/constants";
import { npcLogin, openGiftRequest } from "./friendStore";
import { setAreaUnlocked } from "./unlockStore";

// Stats a writer can reference in Story.csv's "when" column.
export interface StorySnapshot {
  casts: number;
  fish: number;
  sits: number;
  money: number;
}

// Actions a writer can name in Story.csv's "action" column.
const STORY_ACTIONS: Record<string, () => void> = {
  "npc friend": () => npcLogin(FRIEND_NPC_NAME),
  gift: () => openGiftRequest(),
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
      beats.push({
        row,
        condition: compileCondition(when),
        variants: text
          .split("|")
          .map((t) => t.trim())
          .filter(Boolean),
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
