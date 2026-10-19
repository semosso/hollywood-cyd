import { ATTRS } from "./constants";
import type { Attributes, State } from "./types";

/** Atributos efetivos: base + modificadores temporários ativos (guinadas), limitados a [0, 6]. */
export function effAttrs(state: State): Attributes {
  const out = { ...state.atributos };
  for (const m of state.modificadores) {
    if (!m.atributo || m.ateCard < state.cardsJogados) continue;
    out[m.atributo] = out[m.atributo] + m.delta;
  }
  for (const k of ATTRS) out[k] = Math.max(0, Math.min(6, out[k]));
  return out;
}

export function activeMods(state: State) {
  return state.modificadores.filter((m) => m.ateCard >= state.cardsJogados);
}
