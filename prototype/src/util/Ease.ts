// Sourced from https://easings.net/

export function easeOutSine(x: number): number {
  return Math.sin((x * Math.PI) / 2);
}

export function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

export function easeInCubic(x: number): number {
  return x * x * x;
}
