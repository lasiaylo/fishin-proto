import { create } from "zustand";
import { RT, useResource } from "./resourceStore";
import { getRandomInt } from "../util/util";
import { DISPLAY_MULT } from "../components/FieldView";

export interface Field {
  display: Set<number>;
}

export const useField = create<Field>(() => ({
  display: new Set(),
}));

export function initField() {
  // useResource.subscribe((s) => s.FieldFlower.amount, setFlower);
}

function setFlower(curr: number) {
  const delta = Math.floor(curr - useField.getState().display.size);
  if (delta === 0) return;
  if (delta >= 0) {
    increment(delta);
  } else {
    decrement(Math.abs(delta));
  }
}

function decrement(val: number) {
  useField.setState((s) => {
    const { display } = s;
    if (val >= display.size) return { display: new Set() };

    Array.from({ length: val }, () =>
      display.delete(display.values().next().value),
    );
    return { display: new Set([...display]) };
  });
}

function increment(val: number) {
  useField.setState((s) => {
    const { display } = s;
    const limit =
      useResource.getState()[RT.FieldFlower].capacity * DISPLAY_MULT;

    Array.from({ length: val }, () => {
      let num = getRandomInt(0, limit);
      while (display.has(num)) {
        num = getRandomInt(0, limit);
      }
      display.add(num);
    });

    return {
      display: new Set([...display]),
    };
  });
}
