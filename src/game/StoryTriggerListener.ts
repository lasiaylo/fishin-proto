import { useMetrics } from "../stores/metricsStore";
import { pushEvent } from "../stores/eventLogStore";
import { EventMsg } from "../util/eventMessages";

const CAST_MILESTONE = 3;

export class StoryTriggerListener {
  private fired = false;

  constructor() {
    useMetrics.subscribe(
      (s) => s.totalCasts,
      (totalCasts) => {
        if (!this.fired && totalCasts >= CAST_MILESTONE) {
          this.fired = true;
          // pushEvent(EventMsg.STORY_DUMMY);
        }
      },
    );
  }
}

export const storyTriggerListener = new StoryTriggerListener();
