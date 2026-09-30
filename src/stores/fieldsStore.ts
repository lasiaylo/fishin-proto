import { create } from "zustand";
import { addMoney } from "./playerStore";
import {
  FIELDS_PARTICLE_LIFETIME_MS,
  FIELDS_WIND_COOLDOWN_MS,
  FIELDS_WIND_PARTICLE_COUNT,
  FIELDS_WIND_PARTICLE_VALUE,
} from "../util/constants";

// Coordinates are px relative to the grass image box. Particles drift from
// origin to (x, y), where they float until collected or expired.
export interface GrassParticle {
  id: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

interface FieldsState {
  readyAt: number;
  particles: GrassParticle[];
  // Upgradable via the fields shop; start at the base constants.
  particleCount: number;
  cooldownMs: number;
}

export const useFields = create<FieldsState>(() => ({
  readyAt: 0,
  particles: [],
  particleCount: FIELDS_WIND_PARTICLE_COUNT,
  cooldownMs: FIELDS_WIND_COOLDOWN_MS,
}));

const MIN_WIND_COOLDOWN_MS = 500;

const GRASS_WIDTH = 147;
const GRASS_TOP = 150;
const GRASS_BOTTOM = 270;

let nextParticleId = 0;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function spawnParticle(): GrassParticle {
  const originX = randomBetween(0, GRASS_WIDTH);
  const originY = randomBetween(GRASS_TOP, GRASS_BOTTOM);
  // Mostly up and to the right, like it's carried by the wind.
  const angle = randomBetween(Math.PI * -0.15, Math.PI * 0.4);
  const distance = randomBetween(60, 200);
  return {
    id: nextParticleId++,
    originX,
    originY,
    x: originX + Math.cos(angle) * distance,
    y: originY + Math.sin(angle) * distance,
  };
}

export function canWind(): boolean {
  return Date.now() >= useFields.getState().readyAt;
}

export function wind() {
  if (!canWind()) return;
  const { particleCount, cooldownMs } = useFields.getState();
  const spawned = Array.from({ length: particleCount }, spawnParticle);
  useFields.setState((s) => ({
    readyAt: Date.now() + cooldownMs,
    particles: [...s.particles, ...spawned],
  }));
  for (const p of spawned) {
    setTimeout(() => removeParticle(p.id), FIELDS_PARTICLE_LIFETIME_MS);
  }
}

export function setWindParticleCount(count: number) {
  useFields.setState({ particleCount: Math.max(0, Math.round(count)) });
}

export function setWindCooldownMs(ms: number) {
  useFields.setState({ cooldownMs: Math.max(MIN_WIND_COOLDOWN_MS, ms) });
}

export function removeParticle(id: number) {
  useFields.setState((s) => ({
    particles: s.particles.filter((p) => p.id !== id),
  }));
}

// Takes a particle off the field. Returns false if it was already gone, so
// the caller only starts one flight (and one payout) per particle. The money
// is added by depositParticle once the collected particle reaches the wallet.
export function collectParticle(id: number): boolean {
  if (!useFields.getState().particles.some((p) => p.id === id)) return false;
  removeParticle(id);
  return true;
}

export function depositParticle() {
  addMoney(FIELDS_WIND_PARTICLE_VALUE);
}
