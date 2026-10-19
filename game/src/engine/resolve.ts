import { BILLING_FACTOR, CACHE_BASE_2020, CHAOS, FILM_DELTAS, PERSONAL_DELTAS } from "./constants";
import { tierFor } from "./offers";
import { rngFor } from "./rng";
import { effAttrs } from "./attrs";
import type { Film, Lang, MeterKey, PersonalResult, PipelineEntry, Resolution, State } from "./types";

export type Cpi = Record<string, number>;

export function inflate(usd2020: number, toYear: number, cpi: Cpi): number {
  const base = cpi["2020"] ?? 258.8;
  const y = Math.min(2025, Math.max(1975, toYear));
  return Math.round((usd2020 * (cpi[String(y)] ?? base)) / base);
}

export function toToday(usd: number, fromYear: number, cpi: Cpi): number {
  const y = Math.min(2025, Math.max(1975, fromYear));
  return Math.round((usd * (cpi["2025"] ?? 322)) / (cpi[String(y)] ?? 322));
}

export function personalResult(film: Film, roleIndex: number, talentoEfetivo: number, state: State, roll: number, chaosRoll: number, chaosPick: number): PersonalResult {
  const r = film.roles[roleIndex];
  const score = talentoEfetivo - r.demand + 0.3 * state.sorte + 0.1 * (state.meters.estabilidade - 5) + (2 * roll - 1);
  let res: PersonalResult;
  if (r.oscar === "won" && score >= 0) res = "ganhou";
  else if ((r.oscar === "won" || r.oscar === "nominated") && score >= -0.5) res = "indicado";
  else if (r.oscar === "none" && ["hit", "oscar_bait", "cult"].includes(film.derived.outcome) && score >= 1.2) res = "roubou_a_cena";
  else if (score >= -1.2) res = "fez_o_trabalho";
  else if ((r.razzie !== "none" && score < -0.5) || score < -2.0) res = "razzie";
  else res = "miscast";
  if (chaosRoll < CHAOS) {
    const all: PersonalResult[] = ["ganhou", "indicado", "roubou_a_cena", "fez_o_trabalho", "miscast", "razzie"];
    const others = all.filter((x) => x !== res && !(x === "ganhou" && r.oscar === "none"));
    res = others[Math.floor(chaosPick * others.length) % others.length];
  }
  return res;
}

export function cacheFor(film: Film, roleIndex: number, state: State, cpi: Cpi): number {
  const tier = tierFor(state.meters.fama);
  const billing = BILLING_FACTOR[Math.min(3, film.roles[roleIndex].order)] ?? 0.5;
  const budgetFactor = Math.min(3, Math.max(0.3, (film.budget ?? 20e6) / 50e6));
  return inflate(CACHE_BASE_2020[tier] * billing * budgetFactor, state.ano, cpi);
}

/** Resolve uma estreia: devolve a Resolution e muta o state (medidores, flags, rede, filmografia). */
export function resolveRelease(state: State, entry: PipelineEntry, film: Film, recusado: Film | null, cpi: Cpi): Resolution {
  const rng = rngFor(state.seed, "release", film.tmdb_id, entry.assinadoNoCard);
  const talento = effAttrs(state).talento - (entry.ambos ? 1 : 0);
  const resultado = personalResult(film, entry.roleIndex, talento, state, rng.next(), rng.next(), rng.next());
  const role = film.roles[entry.roleIndex];
  const billing = BILLING_FACTOR[Math.min(3, role.order)] ?? 0.5;
  const fd = FILM_DELTAS[film.derived.outcome];
  const pd = PERSONAL_DELTAS[resultado];
  const cache = cacheFor(film, entry.roleIndex, state, cpi);
  const deltas: Partial<Record<MeterKey, number>> = {
    fama: Math.round(fd.fama * billing) + pd.fama,
    prestigio: fd.prestigio + pd.prestigio,
    heat: fd.heat,
    estabilidade: pd.estabilidade,
    dinheiro: cache,
  };
  if (film.flags.includes("tirano_genial")) {
    deltas.estabilidade = (deltas.estabilidade ?? 0) - 2;
    const key = `tirano:${film.director?.tmdb_id ?? film.tmdb_id}`;
    if (!state.flags.includes(key)) {
      state.flags.push(key);
      state.atributos.talento = Math.min(6, state.atributos.talento + 1);
    }
  }
  if (["flop", "bomb"].includes(film.derived.outcome)) deltas.estabilidade = (deltas.estabilidade ?? 0) - 1;
  for (const [k, v] of Object.entries(deltas)) state.meters[k as MeterKey] += v ?? 0;
  if (pd.flag && !state.flags.includes(pd.flag)) state.flags.push(pd.flag);
  if (film.flags.includes("franquia")) {
    if (!state.flags.includes("contrato_franquia")) state.flags.push("contrato_franquia");
    if (film.franchise_id && !state.flags.includes(`franquia:${film.franchise_id}`)) state.flags.push(`franquia:${film.franchise_id}`);
  }
  if ((film.flags.includes("terror") || film.flags.includes("acao")) && rng.next() < 0.15 && !state.flags.includes("lesao")) state.flags.push("lesao");
  if (film.director) {
    const humor = resultado === "razzie" || resultado === "miscast" ? -1 : 1;
    const ex = state.rede.find((r) => r.kind === "diretor" && r.tmdb_id === film.director!.tmdb_id);
    if (ex) ex.humor += humor;
    else state.rede.push({ tmdb_id: film.director.tmdb_id, name: film.director.name, humor, kind: "diretor" });
  }
  state.filmografia.push({ tmdb_id: film.tmdb_id, year: film.year || state.ano, roleIndex: entry.roleIndex, resultado, recusado: recusado?.tmdb_id ?? null, cache, deltas });
  state.ultimaEstreiaEm = state.cardsJogados;
  let rumorFalso: string | null = null;
  if (effAttrs(state).carisma >= 3) {
    const f = (film.rumors ?? []).find((r) => r.false);
    if (f) rumorFalso = f.text[state.opcoes.idioma] ?? f.text.pt;
  }
  return { kind: "estreia", film, roleIndex: entry.roleIndex, resultado, cache, deltas, recusado, rumorFalso };
}

export function regretLine(film: Film, recusado: Film | null, lang: Lang, genero?: "f" | "m"): string | null {
  if (!recusado) return null;
  const myRoles = recusado.roles.filter((r) => !genero || !r.gender || r.gender === genero);
  const mine = film.derived.p_prize + film.derived.p_box;
  const theirs = recusado.derived.p_prize + recusado.derived.p_box;
  const wonElsewhere = myRoles.some((r) => r.oscar === "won");
  if (wonElsewhere) return lang === "en" ? "Someone won the Oscar in your place." : "Alguém ganhou o Oscar no seu lugar.";
  if (theirs - mine > 0.4) return lang === "en" ? "Your agent still brings it up." : "Seu agente ainda toca no assunto.";
  if (mine - theirs > 0.4) return lang === "en" ? "You dodged one. Nobody will ever know." : "Você escapou. Ninguém nunca vai saber.";
  return lang === "en" ? "Could have gone either way." : "Podia ter sido qualquer um dos dois.";
}
