import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

const MAX_EVENTS = 30;

interface EventLogState {
  events: string[];
}

export const useEventLog = create(
  subscribeWithSelector<EventLogState>(() => ({
    events: [],
  })),
);

export function pushEvent(msg: string) {
  useEventLog.setState((state) => ({
    events: [msg, ...state.events].slice(0, MAX_EVENTS),
  }));
}
