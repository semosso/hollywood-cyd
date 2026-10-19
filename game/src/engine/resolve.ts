import { BAD_FILM_PENALTY, BILLING_FACTOR, CACHE_BASE_2020, CHAOS, FILM_DELTAS, PERSONAL_DELTAS } from "./constants";
import { tierFor } from "./offers";
import { rngFor } from "./rng";
import { effAttrs } from "./attrs";
import { belezaEfetiva } from "./timeline";
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

export function personalResult(film: Film, roleIndex: number, talentoEfetivo: number, state: State, roll: number, chaosRoll: number, chaosPick: number, out?: { caos?: boolean; prestigioBonus?: number; bisPenalty?: number; penalidade?: number }): PersonalResult {
  const r = film.roles[roleIndex];
  // num filme que deu errado, a crítica procura culpados: penalidade no score pessoal
  const penalty = BAD_FILM_PENALTY[film.derived.outcome] ?? 0;
  const score = talentoEfetivo - r.demand + 0.3 * state.sorte + 0.1 * (state.meters.estabilidade - 5) + (2 * roll - 1) + penalty;
  // a Academia: exige prestígio acumulado e não gosta de bis (Hanks é exceção, você não)
  const prestigioBonus = Math.min(0.6, Math.max(0, state.meters.prestigio) / 100) + (state.flags.includes("campanha_oscar") ? 0.3 : 0);
  const recentWin = state.filmografia.slice(-3).some((f) => f.resultado === "ganhou") ? 1.0 : 0;
  if (out) { out.prestigioBonus = prestigioBonus; out.bisPenalty = recentWin; out.penalidade = penalty; out.caos = false; }
  const oscarScore = score + prestigioBonus - recentWin;
  let res: PersonalResult;
  if (r.oscar === "won" && oscarScore >= 0.5) res = "ganhou";
  else if ((r.oscar === "won" || r.oscar === "nominated") && oscarScore >= -0.3) res = "indicado";
  else if (r.oscar === "none" && ["hit", "oscar_bait", "cult"].includes(film.derived.outcome) && score >= 1.2) res = "roubou_a_cena";
  else if (score >= -1.5) res = "fez_o_trabalho";
  else if ((r.razzie !== "none" && score < -0.5) || (r.oscar === "none" && score < -2.5)) res = "razzie";
  else res = "miscast";
  if (chaosRoll < CHAOS) {
    if (out) out.caos = true;
    const all: PersonalResult[] = ["ganhou", "indicado", "roubou_a_cena", "fez_o_trabalho", "miscast", "razzie"];
    const others = all.filter((x) => x !== res && !(x === "ganhou" && r.oscar === "none"));
    res = others[Math.floor(chaosPick * others.length) % others.length];
  }
  return res;
}

export function cacheFor(film: Film, roleIndex: number, state: State, cpi: Cpi): number {
  const tier = tierFor(state.meters.fama);
  const billing = BILLING_FACTOR[Math.min(5, film.roles[roleIndex].order)] ?? 0.4;
  const budgetFactor = Math.min(2, Math.max(0.3, (film.budget ?? 20e6) / 50e6));
  return inflate(CACHE_BASE_2020[tier] * billing * budgetFactor, state.ano, cpi);
}

/** Resolve uma estreia: devolve a Resolution e muta o state (medidores, flags, rede, filmografia). */
export function resolveRelease(state: State, entry: PipelineEntry, film: Film, recusado: Film | null, cpi: Cpi): Resolution {
  const rng = rngFor(state.seed, "release", film.tmdb_id, entry.assinadoNoCard);
  const talento = effAttrs(state).talento - (entry.ambos ? 1 : 0);
  const info: { caos?: boolean; prestigioBonus?: number; bisPenalty?: number; penalidade?: number } = {};
  const resultado = personalResult(film, entry.roleIndex, talento, state, rng.next(), rng.next(), rng.next(), info);
  const role = film.roles[entry.roleIndex];
  const billing = BILLING_FACTOR[Math.min(5, role.order)] ?? 0.4;
  const fd = FILM_DELTAS[film.derived.outcome];
  const pd = PERSONAL_DELTAS[resultado];
  const cache = cacheFor(film, entry.roleIndex, state, cpi);
  // Beleza efetiva: 0.8× com 0, 1.0× com 2, 1.3× com 5 (só sobre ganhos de fama do filme)
  const belezaFator = fd.fama > 0 ? 0.8 + 0.1 * belezaEfetiva(state) : 1;
  const deltas: Partial<Record<MeterKey, number>> = {
    fama: Math.round(fd.fama * billing * belezaFator) + pd.fama,
    prestigio: fd.prestigio + pd.prestigio,
    heat: fd.heat,
    estabilidade: pd.estabilidade,
    dinheiro: cache,
  };
  if ((film.flags ?? []).includes("tirano_genial")) {
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
  if ((film.flags ?? []).includes("franquia")) {
    if (!state.flags.includes("contrato_franquia")) state.flags.push("contrato_franquia");
    if (film.franchise_id && !state.flags.includes(`franquia:${film.franchise_id}`)) state.flags.push(`franquia:${film.franchise_id}`);
  }
  if (((film.flags ?? []).includes("terror") || (film.flags ?? []).includes("acao")) && rng.next() < 0.15 && !state.flags.includes("lesao")) state.flags.push("lesao");
  if (film.derived.outcome === "morno" && rng.next() < 0.3) {
    state.rede.push({ tmdb_id: -(state.rede.length + 1), name: "contato", humor: 1, kind: "ficticio" });
  }
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
  const fatores = { talento, demand: role.demand, sorte: state.sorte, estabilidade: state.meters.estabilidade, penalidade: info.penalidade ?? 0, belezaFator: fd.fama > 0 ? 0.8 + 0.1 * belezaEfetiva(state) : 1, prestigioBonus: info.prestigioBonus ?? 0, bisPenalty: info.bisPenalty ?? 0, caos: !!info.caos };
  return { kind: "estreia", film, roleIndex: entry.roleIndex, resultado, cache, deltas, recusado, rumorFalso, fatores };
}

const REGRET: Record<string, { pt: string; en: string }[]> = {
  oscar: [
    { pt: "Alguém ganhou o Oscar no seu lugar.", en: "Someone won the Oscar in your place." },
    { pt: "Quem ficou com o papel subiu no palco e agradeceu 'a coragem do estúdio'. Você desligou a TV.", en: "Whoever took the part went on stage and thanked 'the studio's courage'. You turned the TV off." },
    { pt: "O papel que você recusou virou uma estatueta na estante de outra pessoa. Seu agente não comenta.", en: "The part you turned down became a statue on someone else's shelf. Your agent doesn't bring it up." },
  ],
  better: [
    { pt: "Seu agente ainda toca no assunto.", en: "Your agent still brings it up." },
    { pt: "Você assistiu no cinema, no fundo, de boné. Era bom. Era muito bom.", en: "You watched it in a theater, in the back, in a cap. It was good. It was very good." },
    { pt: "Em toda entrevista daqui para a frente alguém vai perguntar sobre esse.", en: "In every interview from now on, someone will ask about that one." },
    { pt: "Dizem que o roteiro foi reescrito depois que você saiu. Dizem que melhorou.", en: "They say the script was rewritten after you passed. They say it got better." },
  ],
  worse: [
    { pt: "Você escapou. Ninguém nunca vai saber.", en: "You dodged one. Nobody will ever know." },
    { pt: "O filme que você recusou passou em avião entre um documentário sobre golfinhos e nada.", en: "The film you passed on played on airplanes between a dolphin documentary and nothing." },
    { pt: "Quem aceitou ainda está explicando esse em entrevistas.", en: "Whoever said yes is still explaining that one in interviews." },
    { pt: "Seu agente, pela primeira vez, elogiou o seu faro.", en: "Your agent, for once, praised your instincts." },
  ],
  bomb: [
    { pt: "Você recusou uma bomba. O estúdio fingiu que o filme nunca existiu, e você também.", en: "You turned down a bomb. The studio pretended the film never existed, and so do you." },
    { pt: "O outro filme perdeu tanto dinheiro que o executivo que te ofereceu agora vende vinho.", en: "The other film lost so much money that the executive who offered it now sells wine." },
  ],
  even: [
    { pt: "Podia ter sido qualquer um dos dois.", en: "Could have gone either way." },
    { pt: "Os dois estrearam no mesmo mês. Ninguém notou nenhum dos dois.", en: "Both opened the same month. Nobody noticed either." },
    { pt: "Você nunca pensou nisso de novo, o que diz alguma coisa.", en: "You never thought about it again, which says something." },
  ],
};

export function regretLine(film: Film, recusado: Film | null, lang: Lang, genero?: "f" | "m", pick = 0): string | null {
  if (!recusado) return null;
  const myRoles = recusado.roles.filter((r) => !genero || !r.gender || r.gender === genero);
  const mine = film.derived.p_prize + film.derived.p_box;
  const theirs = recusado.derived.p_prize + recusado.derived.p_box;
  let key = "even";
  if (myRoles.some((r) => r.oscar === "won")) key = "oscar";
  else if (recusado.derived.outcome === "bomb") key = "bomb";
  else if (theirs - mine > 0.4) key = "better";
  else if (mine - theirs > 0.4) key = "worse";
  const list = REGRET[key];
  const item = list[((pick % list.length) + list.length) % list.length];
  return item[lang] ?? item.pt;
}

/** Uma frase explicando o resultado pelos atributos (RULES 6.2), para o jogador sentir o que pesou. */
/** Nomes de atributo vêm entre crases; a UI os destaca. */
export function whyLine(r: { resultado: PersonalResult; fatores: { talento: number; demand: number; sorte: number; estabilidade: number; penalidade: number; belezaFator: number; prestigioBonus: number; bisPenalty: number; caos: boolean } }, lang: Lang): string {
  const f = r.fatores;
  const parts: string[] = [];
  const pt = lang === "pt";
  const gap = f.talento - f.demand;
  if (f.caos) parts.push(pt ? "Hollywood não faz sentido: o resultado saiu do nada" : "Hollywood makes no sense: this came out of nowhere");
  else {
    if (gap >= 1) parts.push(pt ? `Talento ${f.talento} para um papel nível ${f.demand}: sobrou` : `Talent ${f.talento} for a level ${f.demand} role: plenty`);
    else if (gap === 0) parts.push(pt ? `Talento ${f.talento} para um papel nível ${f.demand}: no limite` : `Talent ${f.talento} for a level ${f.demand} role: just enough`);
    else parts.push(pt ? `Talento ${f.talento} para um papel nível ${f.demand}: faltou` : `Talent ${f.talento} for a level ${f.demand} role: not enough`);
    if (f.penalidade < 0) parts.push(pt ? "o filme afundou e levou gente junto" : "the film sank and took people with it");
    if (f.estabilidade <= 3) parts.push(pt ? "a `Estabilidade` lá embaixo: você chegou ao set destruído(a)" : "`Stability` at rock bottom: you arrived on set in pieces");
    if (f.sorte === 3) parts.push(pt ? "e a `Sorte` estava do seu lado" : "and `Luck` was on your side");
    if (f.sorte === 1 && gap <= 0) parts.push(pt ? "e a `Sorte`, como sempre, não ajudou" : "and `Luck`, as always, didn't help");
    if (r.resultado === "ganhou" && f.prestigioBonus >= 0.3) parts.push(pt ? "o `Prestígio` acumulado fechou a conta" : "accumulated `Prestige` closed the deal");
    if (f.bisPenalty > 0 && (r.resultado === "indicado" || r.resultado === "fez_o_trabalho")) parts.push(pt ? "a Academia não dá bis" : "the Academy doesn't do encores");
  }
  if (f.belezaFator >= 1.2) parts.push(pt ? "e a `Beleza` rendeu fama extra" : "and `Looks` brought extra fame");
  if (f.belezaFator <= 0.9) parts.push(pt ? "e a `Beleza` já não rende o que rendia" : "and `Looks` don't pay what they used to");
  return parts.join("; ") + ".";
}
