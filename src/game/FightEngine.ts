import { randomRange } from "../util/random";

// ── Constants (match fight_sim.py) ──

const MAX_DISTANCE = 100;
const START_DISTANCE = MAX_DISTANCE / 2;

const REST_TIME: [number, number] = [2, 6];
const FIGHT_TIME_RANGE: [number, number] = [1.0, 6.0];
const BASE_SPEED = 10;
const MIN_SPEED = -40;
const BASE_REEL = 25;
const MAX_REEL = 25;
const SPEED_GROWTH = 1.1;
const REEL_GROWTH = 1.1;
const OUT_LEVELED_THRESHOLD = 4;
const OUT_LEVELED_GROWTH = 1.5;
const ATTACK_CHANCE = 0.1;

const FISH_STAMINA = 30;
const FISH_TIMEOUT = 20;

// ── Types ──

export enum Phase {
  REST = "REST",
  STRUGGLE = "STRUGGLE",
  SUPER_STRUGGLE = "SUPER_STRUGGLE",
}

export type Outcome = "WIN" | "LOSE" | null;

export interface FightState {
  distance: number;
  tension: number;
  phase: Phase;
  time: number;
  outcome: Outcome;
}

// ── Fight Engine ──

export class FightEngine {
  // Fish stats
  private fishSpeed: number;
  private fishStr: number;

  // Player stats
  private reelStr: number;
  private drag: number;
  private lineHp: number;

  // Fight state
  distance: number;
  tension: number;
  time: number;

  phase: Phase;
  private phaseTime: number;
  private phaseDuration: number;

  outcome: Outcome;

  constructor(
    fishSpeed: number,
    fishStrength: number,
    reelStr: number,
    drag: number,
    lineHp: number,
  ) {
    this.fishSpeed = fishSpeed;
    this.fishStr = fishStrength;
    this.reelStr = reelStr;
    this.drag = drag;
    this.lineHp = lineHp;

    this.distance = START_DISTANCE;
    this.tension = 0;
    this.time = 0;

    this.phase = Phase.STRUGGLE;
    this.phaseTime = 0;
    this.phaseDuration = 0;
    this.outcome = null;

    this.setPhase(Phase.STRUGGLE);
  }

  private isOutLeveled(): boolean {
    const speedDelta = this.fishSpeed - this.drag;
    const strDelta = this.fishStr - this.reelStr;
    return (
      speedDelta > OUT_LEVELED_THRESHOLD || strDelta > OUT_LEVELED_THRESHOLD
    );
  }

  private setPhase(phase: Phase): void {
    this.phaseTime = 0;
    this.phase = phase;

    if (phase === Phase.REST) {
      this.phaseDuration = randomRange(REST_TIME[0], REST_TIME[1]);
      return;
    }

    const nextTimeRange = [...FIGHT_TIME_RANGE];
    if (this.time >= FISH_STAMINA + FISH_TIMEOUT && !this.isOutLeveled()) {
      nextTimeRange[0] = 0;
      nextTimeRange[1] = 0;
    } else if (Math.random() <= ATTACK_CHANCE) {
      this.phase = Phase.SUPER_STRUGGLE;
    } else if (this.time < FISH_STAMINA && !this.isOutLeveled()) {
      const delta = this.time - FISH_STAMINA;
      const penalty = (delta / FISH_TIMEOUT) * nextTimeRange[1];
      nextTimeRange[1] = nextTimeRange[1] - penalty;
    }
    this.phaseDuration =
      this.phase === Phase.SUPER_STRUGGLE
        ? 6
        : randomRange(nextTimeRange[0], nextTimeRange[1]);
  }

  private tryPhaseSwitch(dt: number): void {
    this.phaseTime += dt;
    if (this.phaseTime >= this.phaseDuration) {
      const next = this.phase === Phase.REST ? Phase.STRUGGLE : Phase.REST;
      this.setPhase(next);
    }
  }

  private getDelta(bonus: number = 0): number {
    const speedDelta = this.fishSpeed + bonus - this.drag;
    // console.log("fishSpeed", this.fishSpeed, this.drag);

    const outLeveled = this.isOutLeveled();

    let speed = outLeveled
      ? 40
      : BASE_SPEED * Math.pow(SPEED_GROWTH, speedDelta);
    speed = Math.max(MIN_SPEED, speed);

    const reelDelta = this.reelStr - (this.fishStr + bonus);
    const reel = outLeveled ? 20 : BASE_REEL * Math.pow(REEL_GROWTH, reelDelta);
    // console.log("REEL", BASE_REEL, reelDelta, reel, speed);
    return Math.max(-MAX_REEL, speed - reel);
  }

  private struggle(dt: number): number {
    const bonus = this.phase === Phase.SUPER_STRUGGLE ? 10 : 0;
    const delta = this.getDelta(bonus);

    this.tension += (this.fishStr + bonus) * dt;
    return delta;
  }

  private rest(): number {
    return this.getDelta();
  }

  tick(dt: number): FightState {
    if (this.outcome !== null) {
      return this.getState();
    }

    this.tryPhaseSwitch(dt);

    const delta = this.phase !== Phase.REST ? this.struggle(dt) : this.rest();
    this.distance += Math.max(-15.0, Math.min(15.0, delta)) * dt;
    this.time += dt;

    if (this.distance <= 0) {
      this.distance = 0;
      this.outcome = "WIN";
    } else if (this.distance >= MAX_DISTANCE) {
      this.distance = MAX_DISTANCE;
      this.outcome = "LOSE";
    } else if (this.tension >= this.lineHp) {
      this.tension = this.lineHp;
      this.outcome = "LOSE";
    }

    return this.getState();
  }

  getState(): FightState {
    return {
      distance: this.distance,
      tension: this.tension,
      phase: this.phase,
      time: this.time,
      outcome: this.outcome,
    };
  }
}
