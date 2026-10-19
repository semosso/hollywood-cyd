import { HOLLYWOOD_REALISTA_IDADE, NOISE, TIER_BUDGET_MAX, TIER_FAMA_MIN, TRAP_RATE } from "./constants";
import { rngFor } from "./rng";
import { effAttrs, activeMods } from "./attrs";
import { isBad, isGolden } from "./guinada";
import { belezaEfetiva, yearsPerCard } from "./timeline";
import type { Film, Lang, Offer, ProjectCard, Role, State, ThirdOption } from "./types";

export function tierFor(fama: number): number {
  let t = 0;
  for (let i = 0; i < TIER_FAMA_MIN.length; i++) if (fama >= TIER_FAMA_MIN[i]) t = i;
  return t;
}

export function filmTier(f: Film): number {
  const b = f.budget ?? 0;
  for (let i = 0; i < TIER_BUDGET_MAX.length; i++) if (b < TIER_BUDGET_MAX[i]) return i;
  return 3;
}

export function budgetBand(f: Film): "$" | "$$" | "$$$" | "$$$$" {
  return (["$", "$$", "$$$", "$$$$"] as const)[filmTier(f)];
}

/** Índice do papel elegível (menor order) para o jogador, ou -1. */
export function eligibleRole(f: Film, state: State): number {
  const minOrder = state.flags.includes("sotaque") && state.meters.fama < 40 ? 2 : 0;
  let best = -1;
  f.roles.forEach((r: Role, i) => {
    if (r.order > 5 || r.order < minOrder) return;
    if (r.gender && r.gender !== state.genero) return;
    if (best === -1 || r.order < f.roles[best].order) best = i;
  });
  return best;
}

export function isExceptional(f: Film, roleIndex: number): boolean {
  return f.roles[roleIndex].oscar !== "none" || f.derived.p_prize >= 0.4;
}

export function pool(films: Film[], state: State): { film: Film; roleIndex: number }[] {
  const step = yearsPerCard(state);
  const comedy = new Set(["Comedy", "Family", "Romance"]);
  const out: { film: Film; roleIndex: number }[] = [];
  for (const f of films) {
    if (f.fallback) continue;
    if (!f.blind?.hard && !f.blind?.medium) continue; // sem descrição às cegas não entra no jogo
    if (f.year < state.ano + 1 || f.year > state.ano + step) continue;
    if (state.usados.includes(f.tmdb_id)) continue;
    const ri = eligibleRole(f, state);
    if (ri < 0) continue;
    if (state.flags.includes("pigeonhole_comedia") && state.meters.prestigio < 30 && !f.genres.some((g) => comedy.has(g))) continue;
    if (state.opcoes.hollywoodRealista && state.genero === "f" && state.idade >= HOLLYWOOD_REALISTA_IDADE && state.meters.fama < 70 && !isExceptional(f, ri)) continue;
    out.push({ film: f, roleIndex: ri });
  }
  return out;
}

export function noisyIcon(seed: string, tmdbId: number, icon: string, p: number): number {
  const u = rngFor(seed, "noise", tmdbId, icon).range(-NOISE, NOISE);
  return Math.min(0.95, Math.max(0.02, p + u));
}

function blindText(f: Film, state: State, lang: Lang): string {
  const c = effAttrs(state).contatos;
  const src = lang === "en" && f.blind_en ? f.blind_en : f.blind;
  const level = c >= 3 ? "medium" : "hard";
  return src[level] ?? src.medium ?? src.hard ?? (lang === "en" ? "A film. Nobody will tell you more." : "Um filme. Ninguém te conta mais que isso.");
}

function scriptBand(f: Film, lang: Lang): string {
  if (f.rt == null) return lang === "en" ? "nobody read the script" : "ninguém leu o roteiro";
  if (f.rt >= 75) return lang === "en" ? "the script is good" : "o texto é bom";
  if (f.rt >= 40) return lang === "en" ? "the script is fine" : "o texto é ok";
  return lang === "en" ? "the script is an excuse" : "o texto é um pretexto";
}

export function makeOffer(f: Film, roleIndex: number, state: State, reach: boolean, forceDirector = false): Offer {
  const lang = state.opcoes.idioma;
  const a = effAttrs(state);
  const rumors = a.carisma >= 3 ? (f.rumors ?? []).slice(0, 2).map((r) => r.text[lang] ?? r.text.pt) : [];
  return {
    film: f,
    roleIndex,
    reach,
    icons: {
      prize: noisyIcon(state.seed, f.tmdb_id, "prize", f.derived.p_prize),
      box: noisyIcon(state.seed, f.tmdb_id, "box", f.derived.p_box),
      cult: noisyIcon(state.seed, f.tmdb_id, "cult", f.derived.p_cult),
      scandal: noisyIcon(state.seed, f.tmdb_id, "scandal", f.derived.p_scandal),
    },
    visible: {
      genres: f.genres.slice(0, 2),
      budgetBand: budgetBand(f),
      releaseIn: Math.max(1, f.year - state.ano),
      blind: blindText(f, state, lang),
      directorName: (forceDirector || a.contatos >= 5) && f.director ? f.director.name : null,
      scriptBand: a.talento >= 3 ? scriptBand(f, lang) : null,
      redFlag: a.juizo >= 3 && (f.flags.includes("set_problematico") || f.derived.outcome === "bomb"),
      rumors,
    },
  };
}

/** Monta o card de projeto (RULES 4.3). Retorna null se nem com fallback dá 2 ofertas. */
export function buildProjectCard(films: Film[], fallbacks: Film[], state: State): ProjectCard | null {
  const rng = rngFor(state.seed, "offers", state.cardsJogados);
  const mods = activeMods(state);
  const dourado = mods.find((m) => m.tipo === "boost" && m.dourado);
  const queda = mods.find((m) => m.tipo === "queda");
  let modo: ProjectCard["modo"] = "normal";
  let p = pool(films, state);
  if (dourado) {
    const golden = p.filter((c) => isGolden(c.film));
    if (golden.length >= 1) { p = golden; modo = "dourado"; }
  } else if (queda) {
    p = p.filter((c) => isBad(c.film));
    modo = "queda";
  }
  const tier = modo === "dourado" ? 3 : tierFor(state.meters.fama);
  const redeDir = new Set(state.rede.filter((r) => r.kind === "diretor").map((r) => r.tmdb_id));
  const weight = (c: { film: Film; roleIndex: number }, wantTier: number) => {
    let w = filmTier(c.film) === wantTier ? 1 : filmTier(c.film) === wantTier - 1 ? 0.4 : 0.1;
    if (c.film.director && redeDir.has(c.film.director.tmdb_id)) w *= 3;
    return w;
  };
  let candidates = p.slice();
  // sequência obrigatória
  let A: { film: Film; roleIndex: number } | undefined;
  if (state.flags.includes("contrato_franquia")) {
    const seqs = candidates.filter((c) => c.film.flags.includes("franquia") && c.film.franchise_id && state.flags.includes(`franquia:${c.film.franchise_id}`));
    A = rng.pick(seqs);
  }
  if (!A) A = rng.weighted(candidates, (c) => weight(c, tier));
  if (A) candidates = candidates.filter((c) => c.film.tmdb_id !== A!.film.tmdb_id);
  // Armadilha (RULES 4.3): em metade dos cards normais, a segunda oferta é um filme que deu errado,
  // quando houver um no pool. Os ícones com ruído disfarçam; Juízo ≥ 3 vê a bandeira em bombas e sets problemáticos.
  const wantTrap = modo === "normal" && rng.next() < TRAP_RATE;
  let B = wantTrap ? rng.weighted(candidates.filter((c) => isTrap(c.film) && !(A && isTrap(A.film))), (c) => weight(c, tier) + 0.5) : undefined;
  if (!B) B = rng.weighted(candidates, (c) => {
    let w = weight(c, Math.min(3, tier + 1));
    if (filmTier(c.film) > tier) w *= reachFactor(state);
    if (A) {
      if (c.film.director && A.film.director && c.film.director.tmdb_id === A.film.director.tmdb_id) w *= 0.2;
      if (c.film.genres.some((g) => A!.film.genres.includes(g))) w *= 0.5;
      if (c.film.derived.outcome !== A.film.derived.outcome) w *= 1.5;
    }
    return w;
  });
  const recent = new Set(state.filmografia.slice(-2).map((f) => f.tmdb_id).concat(state.pipeline.map((p) => p.tmdb_id)));
  const fb = rngFor(state.seed, "fallback", state.cardsJogados).shuffle(fallbacks.filter((f) => !recent.has(f.tmdb_id) && eligibleYear(f, state)));
  if (modo === "dourado" && !B) {
    // segunda oferta dourada indisponível: completa com o pool normal
    B = rng.weighted(pool(films, state).filter((c) => c.film.tmdb_id !== A?.film.tmdb_id), (c) => weight(c, tierFor(state.meters.fama)));
  }
  if (!A && fb.length) A = { film: fb.shift()!, roleIndex: 0 };
  if (!B && fb.length) B = { film: fb.shift()!, roleIndex: 0 };
  if (!A || !B) return null;
  let pair: [typeof A, typeof B] = [A, B];
  if (modo === "normal" && rng.next() < 0.5) pair = [B, A];
  const [P, Q] = pair;
  const offers: [Offer, Offer] = [makeOffer(P.film, P.roleIndex, state, filmTier(P.film) > tier, modo === "dourado" && isGolden(P.film)), makeOffer(Q.film, Q.roleIndex, state, filmTier(Q.film) > tier, modo === "dourado" && isGolden(Q.film))];
  const third = thirdOption(state, offers);
  const lang = state.opcoes.idioma;
  let hint: string | null = null;
  if (modo === "dourado") hint = lang === "en" ? "He asked for you personally." : "Ele pediu você pessoalmente.";
  if (modo === "queda") hint = lang === "en" ? "This is what's left." : "É o que sobrou.";
  if (state.opcoes.hollywoodRealista && state.genero === "f" && state.idade >= HOLLYWOOD_REALISTA_IDADE && state.meters.fama < 70) {
    hint = lang === "en" ? "Realistic Hollywood: past 45, only the exceptional reaches you." : "Hollywood realista: a partir dos 45, só o excepcional chega até você.";
  }
  return { kind: "projeto", offers, third, hint, modo };
}

function eligibleYear(f: Film, state: State): boolean {
  const era = f.era;
  if (era && (state.ano < era[0] || state.ano > era[1])) return false;
  if (f.requer_beleza && belezaEfetiva(state) < f.requer_beleza) return false;
  return true;
}

/** Uma armadilha: filme que deu errado (flop/bomb) ou que só faz dinheiro sem crítica, sem chance real de prêmio. */
export function isTrap(f: Film): boolean {
  return ["flop", "bomb"].includes(f.derived.outcome) || (f.derived.outcome === "popcorn" && (f.rt ?? 100) < 50 && f.derived.p_prize < 0.2);
}

/** Beleza efetiva pesa nas ofertas acima do seu tamanho (reach): 0.5× com Beleza 0, 1.25× com Beleza 5. */
export function reachFactor(state: State): number {
  return 0.5 + 0.15 * belezaEfetiva(state);
}

export function thirdOption(state: State, offers: [Offer, Offer]): ThirdOption | null {
  const lang = state.opcoes.idioma;
  const a = effAttrs(state);
  const anyFlag = offers.some((o) => o.visible.redFlag);
  if (anyFlag) {
    return { id: "recusar_ambos", requisito: lang === "en" ? "Judgment 4: turn both down" : "Juízo 4: recusar os dois", disponivel: a.juizo >= 4 };
  }
  return { id: "ambos", requisito: lang === "en" ? "Connections 4: do both" : "Contatos 4: fazer os dois", disponivel: a.contatos >= 4 };
}
