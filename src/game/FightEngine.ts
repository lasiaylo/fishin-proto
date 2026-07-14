import { randomRange, perCheckProbability } from "../util/random";
import { easeInEaseOut } from "../util/easing";

const MAX_DISTANCE = 100;
const START_DISTANCE = MAX_DISTANCE / 2;
const IDLE_SPEED = 8;

export type DeltaMode = "Fractional" | "EaseInEaseOut";

export interface FightConfig {
  gracePercent: number;
  restTimeRange: [number, number];
  fightTimeRange: [number, number];
  initialFightRange: [number, number];
  baseSpeed: number;
  minSpeed: number;
  startStruggleWeight: number;
  minStruggleDistance: number;
  distanceMultRange: [number, number];
  thrashMultRange: [number, number];
  critChance: number;
  critMult: number;
  initialBiteAtkMult: number;
  deltaMode: DeltaMode;
  easeScale: number;
  easeMidpoint: number;
  easeSlope: number;
}

export const DEFAULT_FIGHT_CONFIG: FightConfig = {
  restTimeRange: [3, 4],
  fightTimeRange: [1, 3],
  initialFightRange: [2, 4],
  startStruggleWeight: 0.5,
  gracePercent: 0.2,
  minStruggleDistance: 10,
  baseSpeed: 13,
  minSpeed: 4,
  distanceMultRange: [0.9, 1.1],
  thrashMultRange: [0.95, 1.05],
  critChance: 0.125,
  critMult: 1.5,
  initialBiteAtkMult: 1.5,
  deltaMode: "EaseInEaseOut",
  easeScale: 2,
  easeMidpoint: 0.4,
  easeSlope: 0.3,
};

const CRIT_CHECK_INTERVAL = 0.5;
const STRUGGLE_GRACE = 0.5;
const THRASH_MULT = 1.2;
const REEL_DEFENSE_MULT = 0.5;

export const MAX_SIM_TIME = 120;
const SIM_DT = 1 / 60;

export enum Phase {
  REST = "REST",
  STRUGGLE = "STRUGGLE",
}

export enum Outcome {
  WIN = "WIN",
  LOSE_DISTANCE = "LOSE_DISTANCE",
  LOSE_TENSION = "LOSE_TENSION",
  TIMEOUT = "TIMEOUT",
}

export interface FightState {
  distance: number;
  tension: number;
  phase: Phase;
  time: number;
  outcome: Outcome | null;
  crit: boolean;
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

  private startDistance: number = START_DISTANCE;
  private distanceMult: number = 1;
  private critActive: boolean = false;
  private critCheckElapsed: number = 0;
  private critPerCheckChance: number = 0;
  private targetDistance: number = 0;
  private pullDone: boolean = false;

  constructor(
    fishAttack: number,
    fishDefense: number,
    fishThrash: number,
    playerAtk: number,
    playerDef: number,
    lineHp: number,
    startDistance: number = START_DISTANCE,
    targetDistance: number = startDistance,
    config?: Partial<FightConfig>,
    playerSpeedMultiplier: number = 1,
  ) {
    this.fishAtk = fishAttack;
    this.fishDef = fishDefense;
    this.fishThrash = fishThrash;
    this.playerAtk = playerAtk;
    this.playerDef = playerDef;
    this.lineHp = lineHp;
    this.cfg = { ...DEFAULT_FIGHT_CONFIG, ...config };
    this.cfg.baseSpeed *= playerSpeedMultiplier;
    this.startDistance = startDistance;
    this.targetDistance = targetDistance;

    this.distance = startDistance;
    this.tension = 0;
    this.fightElapsed = 0;

    this.phase = Phase.STRUGGLE;
    this.phaseElapsed = 0;
    this.phaseDuration = 0;
    this.outcome = null;

    this.setPhase(Phase.STRUGGLE);
  }

  private setPhase(phase: Phase): void {
    this.phaseElapsed = 0;
    this.critCheckElapsed = 0;
    this.phase = phase;
    this.distanceMult = randomRange(
      this.cfg.distanceMultRange[0],
      this.cfg.distanceMultRange[1],
    );

    if (phase === Phase.STRUGGLE && !this.pullDone) {
      this.phaseDuration = randomRange(
        this.cfg.initialFightRange[0],
        this.cfg.initialFightRange[1],
      );
      this.critActive = false;
      return;
    }

    const range =
      phase === Phase.REST ? this.cfg.restTimeRange : this.cfg.fightTimeRange;
    this.phaseDuration = randomRange(range[0], range[1]);

    if (phase === Phase.REST) {
      const baseCritP = (this.cfg.critChance * this.tension) / this.lineHp;
      const periodicChecks = Math.floor(
        this.phaseDuration / CRIT_CHECK_INTERVAL,
      );
      this.critPerCheckChance = perCheckProbability(
        baseCritP,
        periodicChecks + 1,
      );
      this.critActive = Math.random() < this.critPerCheckChance;
      const firstOffset =
        this.phaseDuration % CRIT_CHECK_INTERVAL || CRIT_CHECK_INTERVAL;
      this.critCheckElapsed = CRIT_CHECK_INTERVAL - firstOffset;
    } else {
      this.critPerCheckChance = 0;
      this.critActive = false;
    }
  }

  private getDelta(attack: number, defense: number): number {
    return FightEngine.computeDelta(attack, defense, this.cfg);
  }

  static computeDelta(
    attack: number,
    defense: number,
    cfg: FightConfig,
  ): number {
    if (cfg.deltaMode === "EaseInEaseOut") {
      const ease = easeInEaseOut(
        attack / (defense * cfg.easeScale),
        cfg.easeSlope,
        cfg.easeMidpoint,
      );
      return (cfg.baseSpeed - cfg.minSpeed) * ease + cfg.minSpeed;
    }
    return cfg.baseSpeed * (attack / (attack + defense));
  }

  private advanceCritCheck(dt: number): void {
    this.critCheckElapsed += dt;
    if (this.critCheckElapsed >= CRIT_CHECK_INTERVAL) {
      this.critCheckElapsed -= CRIT_CHECK_INTERVAL;
      this.critActive = Math.random() < this.critPerCheckChance;
    }
  }

  private applyMovement(dt: number, reel?: boolean): void {
    const isStruggle = this.phase !== Phase.REST;
    const reelGrace = this.phaseElapsed <= STRUGGLE_GRACE;
    const reelThrashMult = reelGrace ? 1 : (reel ?? false) ? THRASH_MULT : 1;
    const reelDefenseMult = (reel ?? false) ? REEL_DEFENSE_MULT : 1;
    const initialBiteAtk =
      isStruggle && !this.pullDone
        ? this.fishAtk * this.cfg.initialBiteAtkMult
        : this.fishAtk;
    const rawDelta = isStruggle
      ? this.getDelta(initialBiteAtk, this.playerDef) * reelDefenseMult
      : -this.getDelta(this.playerAtk, this.fishDef);

    const critMult = !isStruggle && this.critActive ? this.cfg.critMult : 1;
    const delta = rawDelta * this.distanceMult * critMult * dt;
    if (!isStruggle) {
      this.distance += (reel ?? true) ? delta : IDLE_SPEED * dt;
    } else {
      this.distance += delta;
    }

    this.tension += this.fishThrash * (isStruggle ? reelThrashMult : 1) * dt;
    this.fightElapsed += dt;
  }

  private step(dt: number, reel?: boolean): void {
    const remainingInPhase = this.phaseDuration - this.phaseElapsed;
    const remainingPercent = (this.lineHp - this.fightElapsed) / this.lineHp;

    if (dt < remainingInPhase) {
      this.phaseElapsed += dt;
      this.applyMovement(dt, reel);
      if (this.phase === Phase.REST) this.advanceCritCheck(dt);
      if (
        this.phase === Phase.STRUGGLE &&
        !this.pullDone &&
        this.distance >= this.targetDistance
      ) {
        this.pullDone = true;
        this.setPhase(Phase.REST);
      }
    } else {
      const dt1 = remainingInPhase;
      const dt2 = dt - dt1;

      const wasRest = this.phase === Phase.REST;
      this.applyMovement(dt1, reel);
      if (wasRest) this.advanceCritCheck(dt1);

      if (this.phase === Phase.STRUGGLE) this.pullDone = true;
      const next =
        this.phase === Phase.REST
          ? this.distance < this.cfg.minStruggleDistance &&
            remainingPercent < this.cfg.gracePercent
            ? Phase.REST
            : Phase.STRUGGLE
          : Phase.REST;
      this.setPhase(next);

      this.applyMovement(dt2, reel);
      if (this.phase === Phase.REST) this.advanceCritCheck(dt2);
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
    this.distance = this.startDistance;
    this.tension = 0;
    this.fightElapsed = 0;
    this.outcome = null;
    this.phaseElapsed = 0;
    this.phaseDuration = 0;
    this.distanceMult = 1;
    this.critActive = false;
    this.critCheckElapsed = 0;
    this.critPerCheckChance = 0;
    this.pullDone = false;
    this.setPhase(Phase.STRUGGLE);
  }

  runToCompletion(recordHistory = false): {
    history: FightState[];
    outcome: Outcome;
    duration: number;
  } {
    const history: FightState[] = [];

    if (recordHistory) {
      history.push(this.getState());
    }

    while (this.fightElapsed < MAX_SIM_TIME) {
      this.step(SIM_DT);

      if (recordHistory) {
        history.push(this.getState());
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
      crit: this.critActive,
    };
  }
}
