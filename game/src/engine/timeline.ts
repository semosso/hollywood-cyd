import { YEARS_PER_CARD } from "./constants";
import type { State } from "./types";

/** Ato 1..5 pela idade (RULES 3.1). */
export function atoFor(idade: number): number {
  if (idade <= 26) return 1;
  if (idade <= 32) return 2;
  if (idade <= 38) return 3;
  if (idade <= 45) return 4;
  return 5;
}

export function yearsPerCard(state: State): number {
  return YEARS_PER_CARD[atoFor(state.idade) - 1];
}

export function belezaEfetiva(state: State): number {
  const { idade } = state;
  let b = state.atributos.beleza;
  if (idade >= 35) b -= 1;
  if (idade >= 45) b -= 1;
  if (idade >= 55) b -= 1;
  if (state.flags.includes("cirurgia")) b += idade < 50 ? 1 : -1;
  if (state.flags.includes("fisico") && idade < 35) b += 1;
  return Math.max(0, b);
}
