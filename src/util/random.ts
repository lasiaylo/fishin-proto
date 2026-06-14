export const randomRange = (min: number, max: number) => {
  return min + Math.random() * (max - min);
};

export function perCheckProbability(target: number, numChecks: number): number {
  return 1 - (1 - Math.min(target, 1)) ** (1 / numChecks);
}
