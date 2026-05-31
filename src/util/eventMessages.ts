export const EventMsg = {
  WELCOME: "you're a ghost and you have a fishing rod.",
  BITING: "something bites!",
  ESCAPED: "it got away...",
  NO_FISH: "no fish available to catch.",

  HOOKED: () => `Hooked a fish!`,
  CAUGHT: (name: string) => `Caught a ${name}!`,
  SOLD_FISH: (name: string, price: number) => `Sold ${name} for $${price}`,
  CASTING: (spot: string) => `Casting at ${spot}...`,
  BOUGHT: (id: string, level: number) => `Bought ${id} Level ${level}`,
} as const;
