export const EventMsg = {
  WELCOME: "you're a ghost and you must fish.",
  BITING: "something bites!",
  ESCAPED: "it got away...",
  NO_FISH: "no fish available to catch.",

  CRIT: "crit!",
  HOOKED: () => `hooked a fish!`,
  CAUGHT: (name: string) => `caught a ${name}!`,
  SOLD_FISH: (name: string, price: number) => `sold ${name} for $${price}`,
  CASTING: (spot: string) => `casting at ${spot}...`,
  BOUGHT: (id: string, level: number) => `bought ${id} level ${level}`,
} as const;
