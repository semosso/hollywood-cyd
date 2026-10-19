import { METER_LIMITS } from "./constants";
import { rngFor } from "./rng";
import type { DeathCause, MeterKey, State } from "./types";

export function clampMeters(state: State): void {
  for (const k of Object.keys(METER_LIMITS) as MeterKey[]) {
    const [lo, hi] = METER_LIMITS[k];
    state.meters[k] = Math.min(hi, Math.max(lo, state.meters[k]));
  }
}

/** RULES 6.4. Roda uma vez por card, antes de montar o próximo. */
export function applyDecay(state: State): void {
  state.meters.heat = Math.max(0, state.meters.heat - 1);
  if (state.cardsJogados - state.ultimaEstreiaEm >= 2) state.meters.fama -= 3;
  if (state.meters.vicio >= 5 && state.meters.estabilidade <= 3) state.meters.vicio += 1;
  clampMeters(state);
}

/** RULES 6.5: morte automática por vício. */
export function checkDeath(state: State): DeathCause | null {
  if (state.meters.vicio >= 7) {
    const p = 0.05 * (state.meters.vicio - 6);
    if (rngFor(state.seed, "od", state.cardsJogados).next() < p) return "od";
  }
  return null;
}
