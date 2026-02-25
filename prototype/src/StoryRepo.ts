// import { ActionRepo, HiddenItemRepo } from "./ActionRepo";

export enum StoryT {
  INTRO,
  STOKE_FIRST,
  STOKE_SECOND,
  STOKE,
  JIMBY,
  MORE_JIMBY,
  NEED_TO_GATHER,
  GATHER,
  BURN,
}

// export const StoryRepo: { [key in StoryT]: IStory } = {
//   [StoryT.INTRO]: {
//     desc: "it's freezing. there's a faint flame",
//   },
//   [StoryT.STOKE_FIRST]: {
//     desc: "light fills the woods. warmth envelops you",
//   },
//   [StoryT.STOKE_SECOND]: {
//     desc: "the fire grows",
//   },
//   [StoryT.STOKE]: {
//     desc: "the fire roars.",
//   },
//   [StoryT.JIMBY]: {
//     desc: [
//       "a tubby cat waddles in from the dark",
//       "he sits next to you and stares into the flames",
//       "you feel warmer",
//     ],
//     // fn: () => (ResourceRepo[RT.WARMTH].maxAmount = 200),
//   },
//   [StoryT.MORE_JIMBY]: {
//     desc: "Another cat wanders in. She looks willing to help",
//   },
//   [StoryT.NEED_TO_GATHER]: {
//     desc: "the light expands. you see kindling around you...",
//     fn: () => {
//       // ActionRepo.Burn.isLocked = false;
//       // ActionRepo[ActionT.VENTURE].isLocked = false;
//       // ActionRepo.Stoke = HiddenItemRepo["STOKE_NEW"];
//       // ActionRepo.Stoke.isLocked = false;
//       // ShopRepo.Garden.isLocked = false;
//     },
//   },
//   [StoryT.GATHER]: {
//     desc: "flowers",
//   },
//   [StoryT.BURN]: {
//     desc: "the fire drowns out all noise as it consumes",
//   },
// };
//
// const triggers = [
//   {
//     type: StoryT.JIMBY,
//     costs: {
//       [RT.Warmth]: 5,
//     },
//   },
//   {
//     type: StoryT.NEED_TO_GATHER,
//     costs: {
//       [RT.Warmth]: 10,
//     },
//   },
//   {
//     type: StoryT.MORE_JIMBY,
//     costs: {
//       [RT.Warmth]: 30,
//     },
//   },
// ];
//
// interface IStoryNeeds {
//   type: StoryT;
//   costs: Costs;
// }
//
// export class StoryTrigger {
//   private stories: IStoryNeeds[];
//
//   constructor() {
//     this.stories = triggers;
//   }
//
//   start() {
//     //   TODO: Trigger story events on resource
//     this.stories.map(
//       ({ type, costs }) =>
//         new ResourceListener(
//           () => costs,
//           () => queue(type),
//           true,
//         ),
//     );
//   }
//
//   debug(n: number) {
//     const maxes: Costs = {};
//     const toTrigger = this.stories.slice(0, n);
//     toTrigger.forEach(({ type, costs }) => {
//       publish(type);
//       Object.entries(costs).forEach(([type, amount]) => {
//         if (!(type in maxes)) {
//           // @ts-ignore
//           maxes[type] = amount;
//           return;
//         }
//         // @ts-ignore
//         maxes[type] = Math.max(maxes[type], amount);
//       });
//     });
//     Object.entries(maxes).forEach(([type, amount]) => {
//       // @ts-ignore
//       ResourceRepo[type].amount = amount;
//     });
//     this.stories = this.stories.slice(n);
//   }
//
//   update = (details: UpdateEventDetails) => {
//     const { elapsed } = details;
//   };
// }
