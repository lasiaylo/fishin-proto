import { randomRange } from "../util/random";

const MAX_DISTANCE = 100;
const START_DISTANCE = MAX_DISTANCE / 2;
const IDLE_SPEED = 5;

export interface FightConfig {
  restTimeRange: [number, number];
  fightTimeRange: [number, number];
  baseSpeed: number;
  initStruggleDuration: [number, number];
}

export const DEFAULT_FIGHT_CONFIG: FightConfig = {
  restTimeRange: [2, 4],
  fightTimeRange: [1.0, 4],
  initStruggleDuration: [1.8, 2.2],
  baseSpeed: 30,
};

export const MAX_SIM_TIME = 120;
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

const STRUGGLE_GRACE = 1;
const THRASH_MULT = 1.2;
const REEL_DEFENSE_MULT = 2;

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
      this.phaseDuration = randomRange(
        this.cfg.initStruggleDuration[0],
        this.cfg.initStruggleDuration[1],
      );
      return;
    }
    const range =
      phase === Phase.REST ? this.cfg.restTimeRange : this.cfg.fightTimeRange;

    this.phaseDuration = randomRange(range[0], range[1]);
  }

  private getDelta(attack: number, defense: number): number {
    const atk = attack * this.atkMult;
    let delta = this.cfg.baseSpeed * (atk / (atk + defense));
    return delta;
  }

  private applyMovement(dt: number, reel?: boolean): void {
    const isStruggle = this.phase !== Phase.REST;
    const reelAtkMult = (reel ?? true) ? 1 : 0;
    const reelGrace = this.phaseElapsed <= STRUGGLE_GRACE;
    const reelThrashMult = reelGrace ? 1 : (reel ?? false) ? THRASH_MULT : 1;
    const reelDefenseMult = (reel ?? false) ? REEL_DEFENSE_MULT : 1;
    const rawDelta = isStruggle
      ? this.getDelta(this.fishAtk, this.playerDef * reelDefenseMult)
      : this.getDelta(
          this.playerAtk * this.atkMult * reelAtkMult,
          this.fishDef,
        );

    const delta = rawDelta * dt;
    if (!isStruggle) {
      this.distance += (reel ?? true) ? -delta : IDLE_SPEED * dt;
    } else {
      this.distance += delta;
    }

    this.tension += this.fishThrash * (isStruggle ? reelThrashMult : 0.5) * dt;
    this.fightElapsed += dt;
  }

  private step(dt: number, reel?: boolean): void {
    const remainingInPhase = this.phaseDuration - this.phaseElapsed;

    if (dt < remainingInPhase) {
      this.phaseElapsed += dt;
      this.applyMovement(dt, reel);
    } else {
      const dt1 = remainingInPhase;
      const dt2 = dt - dt1;

      this.applyMovement(dt1, reel);

      const next = this.phase === Phase.REST ? Phase.STRUGGLE : Phase.REST;
      this.setPhase(next);

      this.applyMovement(dt2, reel);
      this.phaseElapsed = dt2;
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

  tick(dt: number, reel?: boolean): FightState {
    if (this.outcome === null) {
      this.step(dt, reel);
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
