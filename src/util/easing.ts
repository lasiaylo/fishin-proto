function easeIn(x: number, midpoint: number, slope: number): number {
  const s = 2 / (1 - slope) - 1;
  return x ** s / midpoint ** (s - 1);
}

export function easeInEaseOut(
  x: number,
  slope: number,
  midpoint: number,
): number {
  if (x <= 0) return 0;
  if (x < midpoint) return easeIn(x, midpoint, slope);
  if (x <= 1) return 1 - easeIn(1 - x, 1 - midpoint, slope);
  return 1;
}
