export const GRAY = "var(--gray-a9)";
export const LIGHT_GRAY = "var(--gray-a4)";
export const ORANGE = "var(--orange-a7)";
export const LIGHT_ORANGE = "var(--orange-a4)";

export const BORDER_RADIUS = "var(--radius-3)";

export const BUTTON_STYLE = {
  borderRadius: BORDER_RADIUS,
  borderColor: LIGHT_GRAY,
  borderStyle: "solid",
  borderWidth: "1px",
};

export function getFillBackgroundStyle(
  p: number,
  fillColor: string = LIGHT_GRAY,
) {
  return {
    background: `linear-gradient(90deg, ${fillColor} ${p}%, white ${p}%)`,
  };
}
