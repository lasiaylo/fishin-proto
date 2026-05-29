import { randomRange } from "../util/random";

const MAX_DISTANCE = 100;
const START_DISTANCE = MAX_DISTANCE / 2;

export interface FightConfig {
  restTimeRange: [number, number];
  fightTimeRange: [number, number];
  baseSpeed: number;
  initStruggleDuration: number;
}

export const DEFAULT_FIGHT_CONFIG: FightConfig = {
  restTimeRange: [2, 4],
  fightTimeRange: [1.0, 4],
  baseSpeed: 30,
  initStruggleDuration: 2,
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
  private fishThrash: number;

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

  private atkMult: number = 1;

  constructor(
    fishAttack: number,
    fishDefense: number,
    fishThrash: number,
    playerAtk: number,
    playerDef: number,
    lineHp: number,
    config?: Partial<FightConfig>,
  ) {
    this.fishAtk = fishAttack;
    this.fishDef = fishDefense;
    this.fishThrash = fishThrash;
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
    this.atkMult = randomRange(0.95, 1.05);

    if (phase === Phase.INIT_STRUGGLE) {
      this.phaseDuration = this.cfg.initStruggleDuration;
      return;
    }
    const range =
      phase === Phase.REST ? this.cfg.restTimeRange : this.cfg.fightTimeRange;

    this.phaseDuration = randomRange(range[0], range[1]);
  }

  private getDelta(attack: number, defense: number, bonus: number = 0): number {
    const atk = attack * this.atkMult;
    let delta = this.cfg.baseSpeed * (atk / (atk + defense));
    // console.log(this.phase, delta )
    return delta;
  }

  private applyMovement(dt: number): void {
    const isFight = this.phase !== Phase.REST;
    const rawDelta = isFight
      ? this.getDelta(this.fishAtk, this.playerDef)
      : this.getDelta(this.playerAtk * this.atkMult, this.fishDef);
    const mult = isFight ? 1 : -1;
    this.distance += mult * rawDelta * dt;
    this.tension += this.fishThrash * (isFight ? 1 : 0.5) * dt;
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
    this.atkMult = 1;
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
