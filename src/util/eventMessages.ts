export const EventMsg = {
  WELCOME: "the water is calm",
  CAST: "the line whips through the air",
  LAND_BAD: "it lands like a rock",
  LAND_GOOD: "it lands like a feather",
  BITING: "something bites!",
  ESCAPED: "it got away...",

  CRIT: "crit!",
  CAUGHT: (name: string) => ["caught a ", `${name}`],
  SOLD_FISH: (name: string, price: number) => ["sold ", `${name} +${price}`],

  STORY_DUMMY: "you feel something stir in the water...",

  NPC_LOGIN: (name: string) => `a ${name} comes by`,
  GIFT_ACCEPTED: (title: string) => ["received a tip: ", title],
} as const;
