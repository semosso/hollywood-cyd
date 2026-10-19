import { CARDS_PER_ATO, DATA_YEAR_MAX, MAX_ATOS, MIN_ATOS, YEARS_PER_ATO } from "./constants";
import type { State } from "./types";

/** Quantos atos cabem entre a estreia e o fim dos dados: 1 a 3 atos de 10 anos (RULES 3.1). */
export function numAtosFor(anoEstreia: number): number {
  const decadas = Math.floor((DATA_YEAR_MAX + 1 - anoEstreia) / YEARS_PER_ATO);
  return Math.max(MIN_ATOS, Math.min(MAX_ATOS, decadas));
}

/** Ato 1..3 pelo número de cards jogados (5 por ato). */
export function atoFor(state: Pick<State, "cardsJogados">): number {
  return Math.floor(state.cardsJogados / CARDS_PER_ATO) + 1;
}

export function yearsPerCard(_state: State): number {
  return YEARS_PER_ATO / CARDS_PER_ATO; // 2 anos por decisão
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
