import { useMetrics } from "../stores/metricsStore";
import { pushEvent } from "../stores/eventLogStore";
import { EventMsg } from "../util/eventMessages";
import { npcLogin } from "../stores/friendStore";
import { FRIEND_NPC_NAME } from "../util/constants";

const CAST_MILESTONE = 3;
const FISH_MILESTONE = 3;

export class StoryTriggerListener {
  constructor() {
    useMetrics.subscribe(
      (s) => s.totalFishCaught,
      (totalFishCaught) => {
        if (totalFishCaught === FISH_MILESTONE) {
          setTimeout(() => {
            npcLogin(FRIEND_NPC_NAME);
            setTimeout(() => {
              pushEvent(EventMsg.FRIEND_CASTS);
            }, 2000);
          }, 1000);
        }
      },
    );
  }
}

export const storyTriggerListener = new StoryTriggerListener();
