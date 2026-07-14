import { useMetrics } from "../stores/metricsStore";
import { pushEvent } from "../stores/eventLogStore";
import { EventMsg } from "../util/eventMessages";
import { npcLogin } from "../stores/friendStore";
import { FRIEND_NPC_NAME } from "../util/constants";

const CAST_MILESTONE = 3;
const FISH_MILESTONE = 10;

export class StoryTriggerListener {
  private fired = false;
  private firedNpcLogin = false;

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

    useMetrics.subscribe(
      (s) => s.totalFishCaught,
      (totalFishCaught) => {
        if (!this.firedNpcLogin && totalFishCaught >= FISH_MILESTONE) {
          this.firedNpcLogin = true;
          npcLogin(FRIEND_NPC_NAME);
        }
      },
    );
  }
}

export const storyTriggerListener = new StoryTriggerListener();
