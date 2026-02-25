// import {
//   getEventFn,
//   UpdateEvent,
//   UpdateEventDetails,
// } from "../effects/useUpdate";
// import { ResourceRepo } from "../repos/ResourceRepo";
// import { Resource } from "../Resource";
// import { MS_IN_SEC } from "../util/constants";
// import { RT } from "../stores/resourceStore";
//
// export class OneShotVector {
//   private resource: Resource;
//   private rate: number;
//   private readonly target?: number;
//   private total: number;
//   protected callback: (e: Event) => void;
//   private readonly onFinish: (() => void) | undefined;
//
//   constructor(type: RT, rate: number, duration?: number) {
//     this.resource = ResourceRepo[type];
//     this.rate = rate / MS_IN_SEC;
//     if (duration) {
//       this.target = rate * duration;
//     }
//     this.total = 0;
//     this.callback = getEventFn(this.update);
//     addEventListener(UpdateEvent, this.callback);
//   }
//
//   update = ({ deltaTime }: UpdateEventDetails) => {
//     if (this.target && this.total >= this.target) {
//       this.resource.amount = Math.round(this.resource.amount);
//       removeEventListener(UpdateEvent, this.callback);
//       if (this.onFinish) this.onFinish();
//       return;
//     }
//     const rate = this.rate * deltaTime;
//     const delta = this.target ? Math.min(rate, this.target - this.total) : rate;
//     this.resource.addAmount(delta);
//     this.total += delta;
//   };
// }
//
// export function add(rt: RT, val: number) {
//   //   TODO: Implement
// }
