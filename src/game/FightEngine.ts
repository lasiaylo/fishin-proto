import { randomRange } from "../util/random";

const MAX_DISTANCE = 100;
const START_DISTANCE = MAX_DISTANCE / 2;

export interface FightConfig {
  restTime: [number, number];
  fightTimeRange: [number, number];
  baseSpeed: number;
  baseReel: number;
  initStruggleDuration: number;
  struggleBonus: number;
}

export const DEFAULT_FIGHT_CONFIG: FightConfig = {
  restTime: [3, 4],
  fightTimeRange: [1.0, 4],
  baseSpeed: 10,
  baseReel: 25,
  initStruggleDuration: 2,
  struggleBonus: 10,
};

const MAX_SIM_TIME = 120;
const SIM_DT = 1 / 60;

export enum Phase {
  REST = "REST",
  STRUGGLE = "STRUGGLE",
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
  private fishAtk: number;
  private fishDef: number;

  private playerAtk: number;
  private playerDef: number;
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
    playerAtk: number,
    playerDef: number,
    lineHp: number,
    config?: Partial<FightConfig>,
  ) {
    this.fishAtk = fishSpeed;
    this.fishDef = fishStrength;
    this.playerAtk = playerAtk;
    this.playerDef = playerDef;
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

  private setPhase(phase: Phase): void {
    this.phaseElapsed = 0;
    this.phase = phase;

    if (phase === Phase.REST) {
      this.phaseDuration = randomRange(
        this.cfg.restTime[0],
        this.cfg.restTime[1],
      );
      return;
    }

    if (phase === Phase.INIT_STRUGGLE) {
      this.phaseDuration = this.cfg.initStruggleDuration;
      return;
    }

    this.phaseDuration = randomRange(
      this.cfg.fightTimeRange[0],
      this.cfg.fightTimeRange[1],
    );
  }

  private getDelta(attack: number, defense: number, bonus: number = 0): number {
    return this.cfg.baseReel * (attack / (attack + defense));
  }

  private struggle(dt: number): number {
    const bonus =
      this.phase === Phase.INIT_STRUGGLE ? this.cfg.struggleBonus : 0;
    const delta = this.getDelta(bonus);

    this.tension += (this.fishDef + bonus) * dt;
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

      const next = this.phase === Phase.REST ? Phase.STRUGGLE : Phase.REST;
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
