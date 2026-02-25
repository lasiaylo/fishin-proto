// import { MS_IN_MIN, MS_IN_SEC } from "./util/constants";
//
// import { StoryRepo, StoryT } from "./StoryRepo";
//
// export interface IStory {
//   desc: string | string[];
//   fn?: () => void;
// }
//
// export const StoryLogData: Array<string> = [];
// let storyQueue: Array<IStory> = [];
// let timerId: any | undefined;
// const duration = 2 * MS_IN_SEC;
// const politePublished: Set<StoryT> = new Set();
//
// export function publish(storyT: StoryT) {
//   const { desc, fn } = StoryRepo[storyT] as IStory;
//   if (fn) fn();
//
//   if (typeof desc === "string") {
//     StoryLogData.push(desc);
//     return;
//   }
//   desc.forEach((line) => StoryLogData.push(line));
// }
//
// export function polite(storyT: StoryT) {
//   const { desc, fn } = StoryRepo[storyT] as IStory;
//   if (fn) fn();
//   if (
//     timerId != undefined ||
//     storyQueue.length > 0 ||
//     politePublished.has(storyT)
//   )
//     return;
//   politePublished.add(storyT);
//   setTimeout(() => politePublished.delete(storyT), 5 * MS_IN_MIN);
//   publish(storyT);
// }
//
// export function queue(storyT: StoryT) {
//   const story = StoryRepo[storyT] as IStory;
//   const { desc, fn } = story;
//   if (
//     StoryLogData[StoryLogData.length - 1] === desc ||
//     storyQueue[storyQueue.length - 1]?.desc === desc
//   )
//     return;
//
//   storyQueue.push(story);
//
//   if (timerId !== undefined) return;
//
//   const popStory = () => {
//     if (storyQueue.length === 0) {
//       timerId = undefined;
//       return;
//     }
//     // TODO: Change to deque
//     const { desc, fn } = storyQueue.shift() as IStory;
//     if (typeof desc === "string") {
//       StoryLogData.push(desc);
//       if (fn) fn();
//       timerId = setTimeout(popStory, duration);
//       return;
//     }
//
//     const popArray = () => {
//       if (desc.length === 0) {
//         setTimeout(popStory, duration);
//         return;
//       }
//
//       const line = desc.shift() as string;
//       StoryLogData.push(line);
//       if (story.fn && desc.length === 0) story.fn();
//       timerId = setTimeout(popArray, duration);
//     };
//     popArray();
//   };
//   popStory();
// }
