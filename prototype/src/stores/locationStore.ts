import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export enum Location {
  Shop = "Shop",
  Pond = "Pond",
}

interface LocationState {
  current: Location;
}

export const useLocation = create(
  subscribeWithSelector<LocationState>(() => ({
    current: Location.Shop,
  })),
);

export function setLocation(location: Location) {
  useLocation.setState({ current: location });
}
