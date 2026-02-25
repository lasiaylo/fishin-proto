import { MS_IN_SEC } from "../util/constants";
import { addRate, RT, useResource } from "../stores/resourceStore";
import { getEventFn, UpdateEvent, UpdateEventDetails } from "../GameLoop";

export class TransferVector {
  public growthRate: number;
  public burnRates: { [key in RT]?: number };
  public amount: number;
  private name: string;
  private target: RT;
  private duration?: number;
  private targetAmount?: number;
  private endOnDeplete: boolean;
  private callback: (e: Event) => void;
  private elapsed: number;
  private total: number;
  private running: boolean;

  constructor(
    name: string,
    target: RT,
    growthRate: number,
    burnRates: { [key in RT]?: number },
    duration?: number,
    targetAmount?: number,
    endOnDeplete: boolean = true,
    amount: number = 1,
  ) {
    this.name = name;
    this.target = target;
    this.setGrowthRate(growthRate);
    this.burnRates = burnRates;
    this.duration = duration ? duration * MS_IN_SEC : undefined;
    this.targetAmount = targetAmount;
    this.endOnDeplete = endOnDeplete;
    this.elapsed = 0;
    this.total = 0;
    this.running = false;
    this.amount = amount;

    this.callback = getEventFn(this.update);
  }

  update = ({ deltaTime }: UpdateEventDetails) => {
    const {
      target,
      burnRates,
      duration,
      targetAmount,
      endOnDeplete,
      growthRate,
      total,
    } = this;
    const { amount } = useResource.getState()[target];
    const isDepleted = this.isDepleted();
    if (
      (duration && this.elapsed >= duration) ||
      (targetAmount && total >= targetAmount) ||
      (endOnDeplete && isDepleted)
    ) {
      this.stop();
      return;
    }
    if (isDepleted) {
      return;
    }

    this.elapsed += deltaTime;
    const rate = growthRate * deltaTime;
    const delta = targetAmount ? Math.min(rate, amount - total) : rate;
    const depletedMult = this.getDepletedMult(deltaTime);
    addRate(
      this.name,
      this.target,
      growthRate * depletedMult * this.amount * MS_IN_SEC,
      delta * depletedMult * this.amount,
    );
    Object.entries(burnRates).forEach(([type, burnRate]) => {
      addRate(
        this.name,
        RT[type as keyof typeof RT],
        -burnRate * this.amount,
        (-burnRate * deltaTime * depletedMult * this.amount) / MS_IN_SEC,
      );
    });
  };

  getDepletedMult(deltaTime: number) {
    return Math.min(
      ...Object.entries(this.burnRates).map(([type, cost]) =>
        Math.min(
          useResource.getState()[RT[type as keyof typeof RT]].amount /
            ((cost * deltaTime * this.amount) / MS_IN_SEC),
          1,
        ),
      ),
    );
  }

  isDepleted() {
    return Object.keys(this.burnRates).some(
      (type) =>
        useResource.getState()[RT[type as keyof typeof RT]].amount === 0,
    );
  }

  stop() {
    removeEventListener(UpdateEvent, this.callback);
    this.running = false;
    addRate(this.name, this.target, 0, 0);
    Object.entries(this.burnRates).forEach(([type, burnRate]) => {
      addRate(this.name, RT[type as keyof typeof RT], 0, 0);
    });
  }

  run() {
    if (this.running) return;
    addEventListener(UpdateEvent, this.callback);
    this.running = true;
  }

  setGrowthRate(val: number) {
    this.growthRate = val / MS_IN_SEC;
  }
}
