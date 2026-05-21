export const EventMsg = {
  WELCOME: "Welcome to the fishing game!",
  BITING: "A fish is biting!",
  ESCAPED: "It got away...",
  NO_FISH: "No fish available to catch!",

  HOOKED: (name: string) => `Hooked a ${name}!`,
  CAUGHT: (name: string, price: number) => `Caught a ${name}! +$${price}`,
  GOT_AWAY: (name: string) => `The ${name} got away...`,
  CASTING: (spot: string) => `Casting at ${spot}...`,
  BOUGHT: (id: string, level: number) => `Bought ${id} Level ${level}`,
} as const;
