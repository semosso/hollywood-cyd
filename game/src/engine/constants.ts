import type { AttrKey, MeterKey, Outcome, PersonalResult } from "./types";

export const MAX_CARDS = 25;
export const POINT_BUY_TOTAL = 12;
export const ATTR_MIN = 1;
export const ATTR_MAX = 5;
export const ATTR_CAP = 6;
export const YEAR_MIN = 1975;
export const YEAR_MAX_DEBUT = 2020;
export const DATA_YEAR_MAX = 2025;
export const NOISE = 0.15;
export const HOLLYWOOD_REALISTA_IDADE = 45;
export const CHAOS = 0.1;
export const ATTRS: AttrKey[] = ["beleza", "talento", "contatos", "carisma", "juizo"];

export const METER_LIMITS: Record<MeterKey, [number, number]> = {
  fama: [0, 100],
  prestigio: [-20, 100],
  dinheiro: [-1e9, 1e12],
  heat: [0, 10],
  estabilidade: [0, 10],
  vicio: [0, 10],
  reputacao: [-5, 5],
};

export const YEARS_PER_CARD = [1, 1, 1, 2, 3]; // por ato (índice 0 = ato I)

export const TIER_BUDGET_MAX = [15e6, 50e6, 120e6, Infinity];
export const TIER_FAMA_MIN = [0, 20, 45, 70];
export const CACHE_BASE_2020 = [30_000, 300_000, 2_000_000, 8_000_000];
export const BILLING_FACTOR = [1.0, 0.8, 0.6, 0.5, 0.4, 0.4];

export const FILM_DELTAS: Record<Outcome, { fama: number; prestigio: number; heat: number }> = {
  hit: { fama: 10, prestigio: 3, heat: 3 },
  popcorn: { fama: 8, prestigio: -1, heat: 3 },
  oscar_bait: { fama: 6, prestigio: 7, heat: 2 },
  cult: { fama: 2, prestigio: 6, heat: 1 },
  flop: { fama: -4, prestigio: -2, heat: 1 },
  bomb: { fama: -7, prestigio: -5, heat: 2 },
};

export const PERSONAL_DELTAS: Record<PersonalResult, { fama: number; prestigio: number; estabilidade: number; flag?: string }> = {
  ganhou: { fama: 10, prestigio: 15, estabilidade: 1, flag: "oscar_won" },
  indicado: { fama: 5, prestigio: 8, estabilidade: 0, flag: "oscar_nom" },
  roubou_a_cena: { fama: 5, prestigio: 5, estabilidade: 0 },
  fez_o_trabalho: { fama: 0, prestigio: 0, estabilidade: 0 },
  miscast: { fama: -2, prestigio: -4, estabilidade: -1 },
  razzie: { fama: 2, prestigio: -8, estabilidade: -2, flag: "razzie" },
};

export const CONTEXT_YEARS = [1988, 2007, 2017, 2020, 2023];
