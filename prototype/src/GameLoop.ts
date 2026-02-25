import { isCustomEvent } from "./util/util";

export const UpdateEvent: string = "UPDATE_EVENT";

export interface UpdateEventDetails {
  elapsed: number;
  deltaTime: number;
}

export class GameLoop {
  private running: boolean;
  private currTime: number | null;
  private start: number;
  private shouldStop: boolean;

  constructor() {
    this.running = false;
    this.shouldStop = false;
    this.start = 0;
    this.currTime = 0;
  }

  run() {
    if (this.running) return;
    // TODO: Elapsed time still ticks when paused
    this.currTime = null;
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.shouldStop = true;
  }

  frame = (time: DOMHighResTimeStamp) => {
    if (this.start === undefined) {
      this.start = time;
    }
    if (this.shouldStop) {
      this.shouldStop = false;
      return;
    }

    const newInfo = {
      currTime: time,
      deltaTime: time - (this.currTime ?? time),
    };
    this.currTime = time;
    dispatchEvent(
      new CustomEvent(UpdateEvent, {
        detail: newInfo,
      }),
    );
    requestAnimationFrame(this.frame);
  };
}

export const LOOP = new GameLoop();

export function getEventFn(fn: (detail: any) => void) {
  return (e: Event) => {
    if (!isCustomEvent(e)) return;
    fn(e.detail);
  };
}
