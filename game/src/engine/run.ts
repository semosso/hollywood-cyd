import { CHAOS, DATA_YEAR_MAX } from "./constants";
import { applyDecay, checkDeath, clampMeters } from "./decay";
import { chooseEnding } from "./endings";
import { availableOptions, contextEvent, pickEvent, resolveEvent } from "./events";
import { buildProjectCard } from "./offers";
import { resolveRelease, type Cpi } from "./resolve";
import { rngFor } from "./rng";
import { effAttrs } from "./attrs";
import { maybeGuinada } from "./guinada";
import { atoFor, yearsPerCard } from "./timeline";
import type { Action, Card, Ending, Film, GameEvent, HistoryEntry, Screen, State } from "./types";
void CHAOS;

export type Content = { films: Film[]; fallbacks: Film[]; events: GameEvent[]; endings: Ending[]; cpi: Cpi };

export function filmById(content: Content, id: number): Film | undefined {
  return content.films.find((f) => f.tmdb_id === id) ?? content.fallbacks.find((f) => f.tmdb_id === id);
}

export function screen(state: State): Screen {
  if (state.fim && !state.pendentes.length) return "final";
  if (state.pendentes.length) return "resolucao";
  if (state.card) return "card";
  return "final";
}

/** Padrão do deck por ato: projeto, vida, projeto, X, projeto (RULES 3.3). */
function slotFor(state: State): "projeto" | "vida" | "X" {
  const pattern = ["projeto", "vida", "projeto", "X", "projeto"] as const;
  return pattern[state.cardsJogados % 5];
}

function nextCard(state: State, content: Content): Card | null {
  const slot = slotFor(state);
  if (slot === "projeto") {
    const pc = buildProjectCard(content.films, content.fallbacks, state);
    if (pc) return pc;
    if (state.ano > DATA_YEAR_MAX) return null;
    // sem projeto possível: cai para vida
  }
  if (slot === "vida" || slot === "projeto") {
    const ev = pickEvent(content.events, "vida", state);
    if (ev) return { kind: "evento", event: ev, showProbabilities: effAttrs(state).juizo >= 3 };
  }
  // X
  const ctx = contextEvent(content.events, state);
  if (ctx) return { kind: "evento", event: ctx, showProbabilities: effAttrs(state).juizo >= 3 };
  const lastRelease = state.filmografia[state.filmografia.length - 1];
  if (lastRelease && state.cardsJogados - state.ultimaEstreiaEm <= 1) {
    const f = filmById(content, lastRelease.tmdb_id);
    if (f && (f.derived.p_prize >= 0.25 || lastRelease.resultado === "indicado" || lastRelease.resultado === "ganhou")) {
      const ev = pickEvent(content.events, "premiacao", state);
      if (ev) return { kind: "evento", event: ev, showProbabilities: effAttrs(state).juizo >= 3 };
    }
  }
  if (!state.destinoVisto && rngFor(state.seed, "destino", atoFor(state)).next() < 0.08) {
    const ev = pickEvent(content.events, "destino", state);
    if (ev) return { kind: "evento", event: ev, showProbabilities: effAttrs(state).juizo >= 3 };
  }
  const tipo = state.proximoX;
  state.proximoX = tipo === "pessoa" ? "midia" : "pessoa";
  const ev = pickEvent(content.events, tipo, state) ?? pickEvent(content.events, state.proximoX, state) ?? pickEvent(content.events, "vida", state);
  if (ev) return { kind: "evento", event: ev, showProbabilities: effAttrs(state).juizo >= 3 };
  return null;
}

/** Fecha o card atual: avança tempo, decai, resolve estreias/revisões pendentes, checa morte e fim, monta o próximo card. */
function advance(state: State, content: Content): void {
  state.cardsJogados += 1;
  const step = yearsPerCard(state);
  state.ano += step;
  state.idade += step;
  applyDecay(state);
  // estreias
  const due = state.pipeline.filter((p) => p.estreiaNoCard <= state.cardsJogados);
  state.pipeline = state.pipeline.filter((p) => p.estreiaNoCard > state.cardsJogados);
  for (const p of due) {
    const film = filmById(content, p.tmdb_id);
    if (!film) continue;
    const recusado = p.recusado ? filmById(content, p.recusado) ?? null : null;
    const r = resolveRelease(state, p, film, recusado, content.cpi);
    state.pendentes.push(r);
    if (r.kind === "estreia") state.historico.push({ card: state.cardsJogados, ano: state.ano, idade: state.idade, tipo: "estreia", titulo: { pt: `${film.title.pt ?? film.title.en} (${film.year || state.ano})`, en: `${film.title.en ?? film.title.pt} (${film.year || state.ano})` }, detalhe: { pt: r.resultado.replace(/_/g, " "), en: r.resultado.replace(/_/g, " ") }, deltas: r.deltas });
  }
  // revisão histórica
  for (const fe of state.filmografia) {
    const f = filmById(content, fe.tmdb_id);
    if (f?.revision && state.ano >= f.revision.year && !state.revisoesFeitas.includes(f.tmdb_id)) {
      state.revisoesFeitas.push(f.tmdb_id);
      state.meters.prestigio += f.revision.prestige_delta;
      state.pendentes.push({ kind: "revisao", film: f, delta: f.revision.prestige_delta });
      state.historico.push({ card: state.cardsJogados, ano: state.ano, idade: state.idade, tipo: "revisao", titulo: { pt: `Revisão histórica: ${f.title.pt ?? f.title.en}`, en: `Historical revision: ${f.title.en ?? f.title.pt}` }, deltas: { prestigio: f.revision.prestige_delta } });
    }
  }
  state.modificadores = state.modificadores.filter((m) => m.ateCard >= state.cardsJogados);
  clampMeters(state);
  if (!state.fim) {
    const causa = checkDeath(state);
    if (causa) state.fim = { tipo: "morte", causa };
  }
  if (state.fim) {
    if (state.fim.tipo === "morte") state.pendentes.push({ kind: "morte", causa: state.fim.causa! });
    state.card = null;
    return;
  }
  if (state.cardsJogados >= state.totalCards) {
    state.fim = { tipo: "cards" };
    state.card = null;
    return;
  }
  const card = nextCard(state, content);
  if (!card) {
    state.fim = { tipo: state.ano > DATA_YEAR_MAX ? "ate_aqui" : "cards" };
    state.card = null;
    return;
  }
  state.card = card;
}

export function startRun(state: State, content: Content): State {
  const s = structuredClone(state);
  s.card = nextCard(s, content);
  if (!s.card) s.fim = { tipo: "ate_aqui" };
  return s;
}

export function step(state: State, action: Action, content: Content): State {
  const s = structuredClone(state);
  const scr = screen(s);
  if (action.type === "continuar") {
    if (scr === "resolucao") s.pendentes.shift();
    if (s.fim && !s.pendentes.length && !s.endingId) s.endingId = chooseEnding(content.endings, s).id;
    return s;
  }
  if (scr !== "card" || !s.card) return s;
  if (action.type === "escolher" && s.card.kind === "projeto") {
    const [A, B] = s.card.offers;
    const sign = (o: typeof A, recusado: number | null, ambos: boolean) => {
      s.pipeline.push({ tmdb_id: o.film.tmdb_id, roleIndex: o.roleIndex, assinadoNoCard: s.cardsJogados, estreiaNoCard: s.cardsJogados + 1, recusado, ambos });
      if (!o.film.fallback) s.usados.push(o.film.tmdb_id);
    };
    const refuse = (o: typeof A) => { if (!o.film.fallback) s.usados.push(o.film.tmdb_id); };
    if (action.opcao === "A") { sign(A, B.film.tmdb_id, false); refuse(B); }
    else if (action.opcao === "B") { sign(B, A.film.tmdb_id, false); refuse(A); }
    else {
      const t = s.card.third;
      if (!t || !t.disponivel) return state;
      if (t.id === "ambos") { sign(A, null, true); sign(B, null, true); s.meters.estabilidade -= 2; }
      else { refuse(A); refuse(B); s.meters.fama -= 3; s.meters.prestigio += 1; }
    }
    s.escolhas.push(`p:${action.opcao}`);
    const chosen = action.opcao === "A" ? A : action.opcao === "B" ? B : null;
    s.historico.push({ card: s.cardsJogados, ano: s.ano, idade: s.idade, tipo: "projeto", titulo: chosen ? { pt: `Aceitou a oferta ${action.opcao}`, en: `Took offer ${action.opcao}` } : { pt: s.card.third?.id === "ambos" ? "Aceitou as duas ofertas" : "Recusou as duas ofertas", en: s.card.third?.id === "ambos" ? "Took both offers" : "Turned both down" }, detalhe: chosen ? { pt: chosen.visible.blind, en: chosen.visible.blind } : undefined });
    advance(s, content);
    return s;
  }
  if (action.type === "evento" && s.card.kind === "evento") {
    const ev = s.card.event;
    const opt = availableOptions(ev, s).find((o) => o.id === action.optionId);
    if (!opt || !opt.disponivel) return state;
    const r = resolveEvent(s, ev, action.optionId);
    s.escolhas.push(`e:${action.optionId}`);
    const g = maybeGuinada(s, ev);
    if (g) { s.modificadores.push(g); s.pendentes.unshift({ kind: "guinada", mod: g }); }
    if (r.texto || Object.keys(r.efeitos).length || ev.baseado_em?.length) s.pendentes.unshift(r);
    const dEf: Record<string, number> = {};
    for (const [k, v] of Object.entries(r.efeitos)) if (typeof v === "number") dEf[k] = v;
    s.historico.push({ card: s.cardsJogados, ano: s.ano, idade: s.idade, tipo: "evento", titulo: { pt: ev.texto.pt.slice(0, 90) + (ev.texto.pt.length > 90 ? "…" : ""), en: (ev.texto.en ?? ev.texto.pt).slice(0, 90) + "…" }, detalhe: { pt: `${opt.rotulo.pt}${r.texto ? ". " + r.texto.pt : ""}`, en: `${opt.rotulo.en ?? opt.rotulo.pt}${r.texto ? ". " + (r.texto.en ?? r.texto.pt) : ""}` }, deltas: dEf } as HistoryEntry);
    if (g) s.historico.push({ card: s.cardsJogados, ano: s.ano, idade: s.idade, tipo: "guinada", titulo: { pt: g.tipo === "boost" ? "Guinada para cima" : "Maré baixa", en: g.tipo === "boost" ? "Swing up" : "Low tide" }, detalhe: g.texto });
    advance(s, content);
    return s;
  }
  return s;
}

/** Reproduz uma run a partir da seed e das escolhas (link de compartilhamento). */
export function replay(initial: State, choices: string[], content: Content): State {
  let s = startRun(initial, content);
  for (const c of choices) {
    while (screen(s) === "resolucao") s = step(s, { type: "continuar" }, content);
    if (screen(s) !== "card") break;
    const [k, v] = c.split(":");
    s = k === "p" ? step(s, { type: "escolher", opcao: v as "A" | "B" | "terceira" }, content) : step(s, { type: "evento", optionId: v }, content);
  }
  while (screen(s) === "resolucao") s = step(s, { type: "continuar" }, content);
  if (s.fim && !s.endingId) s = step(s, { type: "continuar" }, content);
  return s;
}
