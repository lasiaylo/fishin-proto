import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

const MAX_EVENTS = 30;

export interface LogEvent {
  id: number;
  msg: string;
}

interface EventLogState {
  events: LogEvent[];
  nextId: number;
}

export const useEventLog = create(
  subscribeWithSelector<EventLogState>(() => ({
    events: [],
    nextId: 0,
  })),
);

export function pushEvent(msg: string) {
  useEventLog.setState((state) => ({
    events: [{ id: state.nextId, msg }, ...state.events].slice(0, MAX_EVENTS),
    nextId: state.nextId + 1,
  }));
}
