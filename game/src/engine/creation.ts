import { ATTRS, ATTR_CAP, ATTR_MAX, ATTR_MIN, CARDS_PER_ATO, CONTEXT_YEARS, POINT_BUY_TOTAL, YEAR_MAX_DEBUT, YEAR_MIN, YEAR_STEP } from "./constants";
import { numAtosFor } from "./timeline";
import { rngFor } from "./rng";
import type { Attributes, CreationInput, Meters, OriginId, State } from "./types";

export type Origin = {
  id: OriginId;
  bonus: Partial<Attributes>;
  extraPoints?: number;
  idade: number;
  minAno?: number;
  talentoMax?: number;
  meters?: Partial<Meters>;
  flags?: string[];
};

export const ORIGINS: Origin[] = [
  { id: "nepo", bonus: { contatos: 2 }, idade: 20, meters: { prestigio: -10 }, flags: ["sobrenome"] },
  { id: "teatro_ny", bonus: { talento: 1 }, idade: 28, meters: { prestigio: 10, dinheiro: -20_000 } },
  { id: "ex_crianca", bonus: {}, idade: 19, meters: { fama: 25, dinheiro: 2_000_000, vicio: 1 }, flags: ["pais_gastaram"] },
  { id: "modelo", bonus: { beleza: 1 }, idade: 21, flags: ["nao_levada_a_serio"] },
  { id: "influencer", bonus: {}, idade: 22, minAno: 2012, meters: { fama: 40, heat: 5, prestigio: -15 }, flags: ["tweets_antigos"] },
  { id: "garcom", bonus: {}, extraPoints: 1, idade: 22 },
  { id: "atleta", bonus: {}, idade: 23, talentoMax: 1, flags: ["fisico"] },
  { id: "imigrante", bonus: { talento: 1 }, idade: 25, flags: ["sotaque"] },
];

export function originById(id: OriginId): Origin {
  const o = ORIGINS.find((x) => x.id === id);
  if (!o) throw new Error(`origem desconhecida: ${id}`);
  return o;
}

export function pointBudget(origem: OriginId): number {
  return POINT_BUY_TOTAL + (originById(origem).extraPoints ?? 0);
}

export function validateCreation(input: CreationInput): string[] {
  const errs: string[] = [];
  const o = originById(input.origem);
  if (input.anoEstreia < YEAR_MIN || input.anoEstreia > YEAR_MAX_DEBUT) errs.push(`anoEstreia fora de [${YEAR_MIN}, ${YEAR_MAX_DEBUT}]`);
  if ((input.anoEstreia - YEAR_MIN) % YEAR_STEP !== 0) errs.push(`anoEstreia deve ser múltiplo de ${YEAR_STEP} a partir de ${YEAR_MIN}`);
  if (o.minAno && input.anoEstreia < o.minAno) errs.push(`origem ${o.id} exige estreia a partir de ${o.minAno}`);
  let sum = 0;
  for (const k of ATTRS) {
    const v = input.atributos[k];
    if (!Number.isInteger(v) || v < ATTR_MIN || v > ATTR_MAX) errs.push(`${k} fora de [${ATTR_MIN}, ${ATTR_MAX}]`);
    sum += v;
  }
  if (sum !== pointBudget(input.origem)) errs.push(`soma dos atributos deve ser ${pointBudget(input.origem)}, é ${sum}`);
  if (o.talentoMax && input.atributos.talento > o.talentoMax) errs.push(`origem ${o.id}: talento máximo ${o.talentoMax} na criação`);
  if (!input.nome.trim()) errs.push("nome vazio");
  return errs;
}

export function createState(input: CreationInput): State {
  const errs = validateCreation(input);
  if (errs.length) throw new Error(errs.join("; "));
  const o = originById(input.origem);
  const atributos = { ...input.atributos };
  for (const k of ATTRS) atributos[k] = Math.min(ATTR_CAP, atributos[k] + (o.bonus[k] ?? 0));
  const meters: Meters = { fama: 5, prestigio: 0, dinheiro: 5_000, heat: 0, estabilidade: 6, vicio: 0, reputacao: 0, ...(o.meters ?? {}) };
  const sorte = 1 + rngFor(input.seed, "sorte").int(3);
  return {
    seed: input.seed,
    nome: input.nome.trim(),
    genero: input.genero,
    origem: input.origem,
    opcoes: { ...input.opcoes },
    atributosIniciais: { ...input.atributos },
    atributos,
    sorte,
    ano: input.anoEstreia,
    anoEstreia: input.anoEstreia,
    idade: o.idade,
    cardsJogados: 0,
    totalCards: numAtosFor(input.anoEstreia) * CARDS_PER_ATO,
    meters,
    flags: [...(o.flags ?? [])],
    rede: [],
    pipeline: [],
    filmografia: [],
    usados: [],
    eventosVistos: [],
    vistosEm: {},
    contextosVistos: CONTEXT_YEARS.filter((y) => y < input.anoEstreia), // o que aconteceu antes da estreia não é notícia
    revisoesFeitas: [],
    destinoVisto: false,
    ultimaEstreiaEm: -99,
    proximoX: "pessoa",
    pendentes: [],
    modificadores: [],
    card: null,
    fim: null,
    endingId: null,
    escolhas: [],
    historico: [],
  };
}
