import { useMetrics } from "../stores/metricsStore";
import { usePlayer } from "../stores/playerStore";
import { pushEvent } from "../stores/eventLogStore";
import { markBeatFired, StorySnapshot, useStory } from "../stores/storyStore";

// Fires each Story.csv beat once, the first time its "when" condition holds.
export class StoryTriggerListener {
  constructor() {
    useMetrics.subscribe((s) => s, this.evaluate);
    usePlayer.subscribe((s) => s.wallet, this.evaluate);
    useStory.subscribe((s) => s.beats, this.evaluate);
  }

  private evaluate() {
    const metrics = useMetrics.getState();
    const snapshot: StorySnapshot = {
      casts: metrics.totalCasts,
      fish: metrics.totalFishCaught,
      sits: metrics.totalSits,
      money: usePlayer.getState().wallet,
    };
    for (const beat of useStory.getState().beats) {
      // Re-read firedRows each time: an action can re-enter evaluate().
      if (useStory.getState().firedRows.has(beat.row)) continue;
      if (!beat.condition(snapshot)) continue;
      markBeatFired(beat.row);
      beat.action?.();
      if (beat.variants.length > 0) {
        pushEvent(
          beat.variants[Math.floor(Math.random() * beat.variants.length)],
        );
      }
    }
  }
}

export const storyTriggerListener = new StoryTriggerListener();
