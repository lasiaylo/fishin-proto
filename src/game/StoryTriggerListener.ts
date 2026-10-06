import { useMetrics } from "../stores/metricsStore";
import { usePlayer } from "../stores/playerStore";
import { pushEvent } from "../stores/eventLogStore";
import {
  buildSnapshot,
  markBeatFired,
  renderBeatText,
  StoryBeat,
  StoryEvent,
  useStory,
} from "../stores/storyStore";

// Fires each one-shot Story.csv beat once, the first time its "when"
// condition holds.
export class StoryTriggerListener {
  private pending = false;

  constructor() {
    useMetrics.subscribe((s) => s, this.schedule);
    usePlayer.subscribe((s) => s.wallet, this.schedule);
    useStory.subscribe((s) => s.beats, this.schedule);
  }

  // Deferred so a beat logs after the game's own line for the same action.
  private schedule = () => {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      this.evaluate();
    });
  };

  private evaluate() {
    const snapshot = buildSnapshot();
    for (const beat of useStory.getState().beats) {
      if (beat.event) continue;
      // Re-read firedRows each time: an action can re-enter evaluate().
      if (useStory.getState().firedRows.has(beat.row)) continue;
      if (!beat.condition(snapshot)) continue;
      markBeatFired(beat.row);
      playBeat(beat);
    }
  }
}

export const storyTriggerListener = new StoryTriggerListener();

// Plays the recurring "on <event>" beat for a game event. When several rows
// match, the lowest one in Story.csv wins.
export function tellStory(
  event: StoryEvent,
  vars: Record<string, string | number> = {},
  style?: { color?: string; legendary?: boolean },
) {
  const snapshot = buildSnapshot();
  const beat = useStory
    .getState()
    .beats.findLast((b) => b.event === event && b.condition(snapshot));
  if (beat) playBeat(beat, vars, style);
}

function playBeat(
  beat: StoryBeat,
  vars: Record<string, string | number> = {},
  style?: { color?: string; legendary?: boolean },
) {
  beat.action?.();
  if (beat.variants.length === 0) return;
  const variant =
    beat.variants[Math.floor(Math.random() * beat.variants.length)];
  const { msg, colored } = renderBeatText(variant, vars);
  pushEvent(msg, colored, style?.color, style?.legendary);
}
