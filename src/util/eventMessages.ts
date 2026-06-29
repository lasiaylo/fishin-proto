export const EventMsg = {
  WELCOME: "it's dark and the water is calm.",
  CAST: "the line whips through the air.",
  LAND_BAD: "it lands like a rock",
  LAND_GOOD: "it lands like a feather",
  BITING: "something bites!",
  ESCAPED: "it got away...",

  CRIT: "crit!",
  CAUGHT: (name: string) => ["caught a ", `${name}`],
  SOLD_FISH: (name: string, price: number) => ["sold ", `${name} +${price}`],
  BOUGHT: (id: string, level: number) => `bought ${id} level ${level}`,
} as const;
