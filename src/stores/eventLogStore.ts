import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

const MAX_EVENTS = 30;

export interface LogEvent {
  id: number;
  msg: string;
  colored?: string;
  color?: string;
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

export function pushEvent(msg: string, colored?: string, color?: string) {
  useEventLog.setState((state) => ({
    events: [{ id: state.nextId, msg, colored, color }, ...state.events].slice(0, MAX_EVENTS),
    nextId: state.nextId + 1,
  }));
}

export function clearEvents() {
  useEventLog.setState({ events: [] });
}
