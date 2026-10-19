import { METER_LIMITS } from "./constants";
import { meets } from "./events";
import { rngFor } from "./rng";
import type { Ending, MeterKey, State } from "./types";

function norm(k: MeterKey, v: number): number {
  const [lo, hi] = METER_LIMITS[k];
  if (k === "dinheiro") return Math.min(1, Math.max(0, Math.log10(Math.max(1, v)) / 9)); // 0..1e9
  return (v - lo) / (hi - lo);
}

export function distance(state: State, e: Ending): number {
  if (!e.alvo) return 0.5;
  let s = 0, n = 0;
  for (const [k, v] of Object.entries(e.alvo)) {
    const key = k as MeterKey;
    const d = norm(key, state.meters[key]) - norm(key, v as number);
    s += d * d; n++;
  }
  return n ? Math.sqrt(s / n) : 0.5;
}

export function chooseEnding(endings: Ending[], state: State): Ending {
  const fim = state.fim;
  if (fim?.tipo === "morte") {
    const d = endings.filter((e) => e.requer?.morte === fim.causa);
    if (d.length) return d[0];
  }
  if (fim?.tipo === "saida") {
    const d = endings.filter((e) => e.requer?.fim === "largar_tudo" && meets(e.requer, state));
    if (d.length) return d[0];
  }
  const elig = endings.filter((e) => !e.requer?.morte && !e.requer?.fim && meets(e.requer, state));
  const fallback = endings.find((e) => e.id === "esquecido") ?? endings[0];
  if (!elig.length) return fallback;
  const scored = elig.map((e) => ({ e, d: distance(state, e) })).sort((a, b) => a.d - b.d);
  const best = scored[0].d;
  const ties = scored.filter((x) => x.d - best < 0.05).map((x) => x.e);
  if (ties.length === 1) return ties[0];
  return rngFor(state.seed, "ending").weighted(ties, (e) => 1 / Math.max(0.001, e.raridade)) ?? ties[0];
}
