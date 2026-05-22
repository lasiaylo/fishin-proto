import { randomRange } from "../util/random";

const MAX_DISTANCE = 100;
const START_DISTANCE = MAX_DISTANCE / 2;
const OUT_LEVELED_GROWTH = 1.5;

export interface FightConfig {
  restTime: [number, number];
  fightTimeRange: [number, number];
  baseSpeed: number;
  minSpeed: number;
  baseReel: number;
  maxReel: number;
  speedGrowth: number;
  reelGrowth: number;
  outLeveledThreshold: number;
  attackChance: number;
  fishStamina: number;
  fishTimeout: number;
  superStruggleDuration: number;
  initStruggleDuration: number;
  struggleBonus: number;
}

export const DEFAULT_FIGHT_CONFIG: FightConfig = {
  restTime: [2, 6],
  fightTimeRange: [1.0, 6.0],
  baseSpeed: 10,
  minSpeed: -40,
  baseReel: 25,
  maxReel: 25,
  speedGrowth: 1.1,
  reelGrowth: 1.1,
  outLeveledThreshold: 4,
  attackChance: 0.1,
  fishStamina: 30,
  fishTimeout: 20,
  superStruggleDuration: 6,
  initStruggleDuration: 2,
  struggleBonus: 10,
};

const MAX_SIM_TIME = 120;
const SIM_DT = 1 / 60;

export enum Phase {
  REST = "REST",
  STRUGGLE = "STRUGGLE",
  SUPER_STRUGGLE = "SUPER_STRUGGLE",
  INIT_STRUGGLE = "INIT_STRUGGLE",
}

export enum Outcome {
  WIN = "WIN",
  LOSE_DISTANCE = "LOSE_DISTANCE",
  LOSE_TENSION = "LOSE_TENSION",
  TIMEOUT = "TIMEOUT",
}

export interface FrameRecord {
  time: number;
  distance: number;
  tension: number;
  phase: Phase;
}

export interface FightState {
  distance: number;
  tension: number;
  phase: Phase;
  time: number;
  outcome: Outcome | null;
}

export class FightEngine {
  private fishSpeed: number;
  private fishStr: number;

  private reelStr: number;
  private drag: number;
  private lineHp: number;

  distance: number;
  tension: number;
  fightElapsed: number;

  phase: Phase;
  private phaseElapsed: number;
  private phaseDuration: number;

  outcome: Outcome | null;

  private cfg: FightConfig;

  constructor(
    fishSpeed: number,
    fishStrength: number,
    reelStr: number,
    drag: number,
    lineHp: number,
    config?: Partial<FightConfig>,
  ) {
    this.fishSpeed = fishSpeed;
    this.fishStr = fishStrength;
    this.reelStr = reelStr;
    this.drag = drag;
    this.lineHp = lineHp;
    this.cfg = { ...DEFAULT_FIGHT_CONFIG, ...config };

    this.distance = START_DISTANCE;
    this.tension = 0;
    this.fightElapsed = 0;

    this.phase = Phase.STRUGGLE;
    this.phaseElapsed = 0;
    this.phaseDuration = 0;
    this.outcome = null;

    this.setPhase(Phase.INIT_STRUGGLE);
  }

  private isOutLeveled(): boolean {
    const speedDelta = this.fishSpeed - this.drag;
    const strDelta = this.fishStr - this.reelStr;
    return (
      speedDelta > this.cfg.outLeveledThreshold ||
      strDelta > this.cfg.outLeveledThreshold
    );
  }

  private setPhase(phase: Phase): void {
    this.phaseElapsed = 0;
    this.phase = phase;

    if (
      this.fightElapsed >= this.cfg.fishStamina + this.cfg.fishTimeout &&
      !this.isOutLeveled()
    ) {
      this.phase = Phase.REST;
    }

    if (phase === Phase.REST) {
      this.phaseDuration = randomRange(
        this.cfg.restTime[0],
        this.cfg.restTime[1],
      );
      return;
    }

    if (phase === Phase.SUPER_STRUGGLE) {
      this.phaseDuration = this.cfg.superStruggleDuration;
      return;
    }

    if (phase === Phase.INIT_STRUGGLE) {
      this.phaseDuration = this.cfg.initStruggleDuration;
      return;
    }

    // The upper range of fight stage goes down as the fight goes on
    const nextTimeRange = [...this.cfg.fightTimeRange];
    if (this.fightElapsed < this.cfg.fishStamina && !this.isOutLeveled()) {
      const delta = this.fightElapsed - this.cfg.fishStamina;
      const penalty = (delta / this.cfg.fishTimeout) * nextTimeRange[1];
      nextTimeRange[1] = Math.max(nextTimeRange[0], nextTimeRange[1] - penalty);
    }
    this.phaseDuration = randomRange(nextTimeRange[0], nextTimeRange[1]);
  }

  private getDelta(bonus: number = 0): number {
    const speedDelta = this.fishSpeed + bonus - this.drag;

    const outLeveled = this.isOutLeveled();

    let fishSpeed = outLeveled
      ? 40
      : this.cfg.baseSpeed * Math.pow(this.cfg.speedGrowth, speedDelta);
    fishSpeed = Math.max(this.cfg.minSpeed, fishSpeed);

    const reelDelta = this.reelStr - (this.fishStr + bonus);
    const reel = outLeveled
      ? 20
      : this.cfg.baseReel * Math.pow(this.cfg.reelGrowth, reelDelta);
    return Math.max(-this.cfg.maxReel, fishSpeed - reel);
  }

  private struggle(dt: number): number {
    const bonus =
      this.phase === Phase.SUPER_STRUGGLE || this.phase === Phase.INIT_STRUGGLE
        ? this.cfg.struggleBonus
        : 0;
    const delta = this.getDelta(bonus);

    this.tension += (this.fishStr + bonus) * dt;
    return delta;
  }

  private rest(): number {
    return this.getDelta();
  }

  private applyMovement(dt: number): void {
    const rawDelta =
      this.phase !== Phase.REST ? this.struggle(dt) : this.rest();
    this.distance += rawDelta * dt;
    this.fightElapsed += dt;
  }

  private step(dt: number): void {
    const remainingInPhase = this.phaseDuration - this.phaseElapsed;

    if (dt >= remainingInPhase) {
      const dt1 = remainingInPhase;
      const dt2 = dt - dt1;

      this.applyMovement(dt1);

      const next =
        this.phase === Phase.REST
          ? Math.random() <= this.cfg.attackChance
            ? Phase.SUPER_STRUGGLE
            : Phase.STRUGGLE
          : Phase.REST;
      this.setPhase(next);

      this.applyMovement(dt2);
      this.phaseElapsed = dt2;
    } else {
      this.phaseElapsed += dt;
      this.applyMovement(dt);
    }

    if (this.distance <= 0) {
      this.distance = 0;
      this.outcome = Outcome.WIN;
    } else if (this.distance >= MAX_DISTANCE) {
      this.distance = MAX_DISTANCE;
      this.outcome = Outcome.LOSE_DISTANCE;
    } else if (this.tension >= this.lineHp) {
      this.tension = this.lineHp;
      this.outcome = Outcome.LOSE_TENSION;
    }
  }

  tick(dt: number): FightState {
    if (this.outcome === null) {
      this.step(dt);
    }
    return this.getState();
  }

  reset(): void {
    this.distance = START_DISTANCE;
    this.tension = 0;
    this.fightElapsed = 0;
    this.outcome = null;
    this.phaseElapsed = 0;
    this.phaseDuration = 0;
    this.setPhase(Phase.INIT_STRUGGLE);
  }

  runToCompletion(recordHistory = false): {
    history: FrameRecord[];
    outcome: Outcome;
    duration: number;
  } {
    const history: FrameRecord[] = [];

    if (recordHistory) {
      history.push({
        time: this.fightElapsed,
        distance: this.distance,
        tension: this.tension,
        phase: this.phase,
      });
    }

    while (this.fightElapsed < MAX_SIM_TIME) {
      this.step(SIM_DT);

      if (recordHistory) {
        history.push({
          time: this.fightElapsed,
          distance: this.distance,
          tension: this.tension,
          phase: this.phase,
        });
      }

      if (this.outcome !== null) {
        return { history, outcome: this.outcome, duration: this.fightElapsed };
      }
    }

    return { history, outcome: Outcome.TIMEOUT, duration: this.fightElapsed };
  }

  getState(): FightState {
    return {
      distance: this.distance,
      tension: this.tension,
      phase: this.phase,
      time: this.fightElapsed,
      outcome: this.outcome,
    };
  }
}
