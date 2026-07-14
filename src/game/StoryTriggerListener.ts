import { useMetrics } from "../stores/metricsStore";
import { pushEvent } from "../stores/eventLogStore";
import { EventMsg } from "../util/eventMessages";
import { npcLogin } from "../stores/friendStore";
import { FRIEND_NPC_NAME } from "../util/constants";

const CAST_MILESTONE = 3;
const FISH_MILESTONE = 4;

export class StoryTriggerListener {
  private fired = false;
  private firedNpcLogin = false;
  private firedFriendCasts = false;
  private castsAtNpcLogin: number | null = null;

  constructor() {
    useMetrics.subscribe(
      (s) => s.totalCasts,
      (totalCasts) => {
        if (!this.fired && totalCasts >= CAST_MILESTONE) {
          this.fired = true;
          // pushEvent(EventMsg.STORY_DUMMY);
        }

        if (
          !this.firedFriendCasts &&
          this.castsAtNpcLogin !== null &&
          totalCasts > this.castsAtNpcLogin
        ) {
          this.firedFriendCasts = true;
          pushEvent(EventMsg.FRIEND_CASTS);
        }
      },
    );

    useMetrics.subscribe(
      (s) => s.totalFishCaught,
      (totalFishCaught) => {
        if (!this.firedNpcLogin && totalFishCaught >= FISH_MILESTONE) {
          setTimeout(() => {
            this.firedNpcLogin = true;
            this.castsAtNpcLogin = useMetrics.getState().totalCasts;
            npcLogin(FRIEND_NPC_NAME);
          }, 1000);
        }
      },
    );
  }
}

export const storyTriggerListener = new StoryTriggerListener();
