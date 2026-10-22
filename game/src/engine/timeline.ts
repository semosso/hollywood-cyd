import { ATOS, DATA_YEAR_MAX, MIN_CARDS, YEARS_PER_CARD_LONGA, YEARS_PER_CARD_NORMAL } from "./constants";
import type { State } from "./types";

/** Anos que cada decisão avança, em média: 2,5 no ritmo normal, 1,25 na carreira longa. É só uma conta interna de tempo. */
export function yearsPerCardFor(longa: boolean): number {
  return longa ? YEARS_PER_CARD_LONGA : YEARS_PER_CARD_NORMAL;
}

/** Ano em que o card de índice `card` acontece: o ano de estreia mais o ritmo médio, arredondado (os passos reais são inteiros). */
export function yearAt(anoEstreia: number, longa: boolean, card: number): number {
  return anoEstreia + Math.round(card * yearsPerCardFor(longa));
}

/** Anos que passam entre o card atual e o seguinte. */
export function stepAt(state: State, card = state.cardsJogados): number {
  const { anoEstreia, opcoes } = state;
  return yearAt(anoEstreia, opcoes.longa, card + 1) - yearAt(anoEstreia, opcoes.longa, card);
}

/** Total de decisões: as que cabem até 2025 no ritmo escolhido, nunca menos que MIN_CARDS (RULES 3.1). */
export function totalCardsFor(anoEstreia: number, longa: boolean): number {
  const cabem = Math.floor((DATA_YEAR_MAX - anoEstreia) / yearsPerCardFor(longa));
  return Math.max(MIN_CARDS, cabem);
}

/** Ato 1..3 pela fração da carreira já jogada (início, meio, fim). Eventos declaram `atos` nessa escala. */
export function atoFor(state: Pick<State, "cardsJogados" | "totalCards">): number {
  const frac = state.cardsJogados / Math.max(1, state.totalCards);
  return Math.min(ATOS, 1 + Math.floor(frac * ATOS));
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
