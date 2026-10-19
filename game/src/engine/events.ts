import { atoFor } from "./timeline";
import { rngFor } from "./rng";
import type { Effects, EventOption, GameEvent, I18n, MeterKey, Requirements, Resolution, State } from "./types";
import { ATTRS } from "./constants";
import { effAttrs } from "./attrs";

function cmp(expr: string, value: number): boolean {
  const m = /^(>=|<=|==|>|<|!=)?\s*(-?\d+(?:\.\d+)?)$/.exec(expr.trim());
  if (!m) return true;
  const [, op = "==", numS] = m;
  const n = Number(numS);
  switch (op) {
    case ">=": return value >= n;
    case "<=": return value <= n;
    case ">": return value > n;
    case "<": return value < n;
    case "!=": return value !== n;
    default: return value === n;
  }
}

export function meets(req: Requirements | undefined, state: State): boolean {
  if (!req) return true;
  const attrs = effAttrs(state);
  for (const [k, v] of Object.entries(req)) {
    if (k === "flags") { if (!(v as string[]).every((f) => state.flags.includes(f))) return false; continue; }
    if (k === "flags_ausentes") { if ((v as string[]).some((f) => state.flags.includes(f))) return false; continue; }
    if (k === "flags_qualquer") { if (!(v as string[]).some((f) => state.flags.includes(f))) return false; continue; }
    if (k === "genero") { if (state.genero !== v) return false; continue; }
    if (k === "idade") { if (!cmp(v as string, state.idade)) return false; continue; }
    if (k === "ano") { if (!cmp(v as string, state.ano)) return false; continue; }
    if ((ATTRS as string[]).includes(k)) { if (!cmp(v as string, attrs[k as keyof typeof attrs])) return false; continue; }
    if (k in state.meters) { if (!cmp(v as string, state.meters[k as MeterKey])) return false; continue; }
  }
  return true;
}

const REPEAT_AFTER = 5;

export function pickEvent(events: GameEvent[], tipo: GameEvent["tipo"], state: State): GameEvent | null {
  const ato = atoFor(state.idade);
  const basic = (e: GameEvent) => e.tipo === tipo && (!e.atos || e.atos.includes(ato)) && (!e.anos || e.anos.includes(state.ano)) && meets(e.requer, state);
  const fresh = events.filter((e) => basic(e) && (!state.eventosVistos.includes(e.id) || e.unico === false));
  const rng = rngFor(state.seed, "event", tipo, state.cardsJogados);
  const pick = rng.weighted(fresh, (e) => e.peso ?? 1);
  if (pick) return pick;
  // deck seco: repete o que foi visto há mais de REPEAT_AFTER cards (menos contexto e destino)
  if (tipo === "contexto" || tipo === "destino") return null;
  const stale = events.filter((e) => basic(e) && (state.vistosEm[e.id] ?? -99) <= state.cardsJogados - REPEAT_AFTER);
  return rng.weighted(stale, (e) => e.peso ?? 1) ?? null;
}

export function contextEvent(events: GameEvent[], state: State): GameEvent | null {
  const step = Math.max(1, state.ano - (state.ano - 1));
  void step;
  const e = events.find((ev) => ev.tipo === "contexto" && ev.anos?.some((y) => y <= state.ano && !state.contextosVistos.includes(y)) && meets(ev.requer, state));
  return e ?? null;
}

export function availableOptions(ev: GameEvent, state: State): (EventOption & { disponivel: boolean })[] {
  return ev.opcoes.map((o) => ({ ...o, disponivel: meets(o.requer, state) }));
}

export function normalizedResults(o: EventOption, state: State) {
  const rs = (o.resultados ?? []).filter((r) => state.opcoes.modoRealista || !r.so_realista);
  const total = rs.reduce((s, r) => s + r.p, 0) || 1;
  return rs.map((r) => ({ ...r, p: r.p / total }));
}

export function applyEffects(state: State, ef: Effects): void {
  for (const [k, v] of Object.entries(ef)) {
    if (k in state.meters && typeof v === "number") state.meters[k as MeterKey] += v;
  }
  for (const f of ef.flag_add ?? []) if (!state.flags.includes(f)) state.flags.push(f);
  if (ef.flag_remove) state.flags = state.flags.filter((f) => !ef.flag_remove!.includes(f));
  if (ef.contatos_evento) {
    for (let i = 0; i < ef.contatos_evento; i++) state.rede.push({ tmdb_id: -(state.rede.length + 1), name: "contato", humor: 1, kind: "ficticio" });
    state.atributos.contatos = Math.min(6, state.atributos.contatos + (ef.contatos_evento >= 2 ? 1 : 0));
  }
  if (ef.atributo) for (const [k, v] of Object.entries(ef.atributo)) state.atributos[k as keyof typeof state.atributos] = Math.min(6, Math.max(1, state.atributos[k as keyof typeof state.atributos] + (v ?? 0)));
  if (ef.morte && state.opcoes.modoRealista) state.fim = { tipo: "morte", causa: ef.morte };
  if (ef.fim === "largar_tudo") state.fim = { tipo: "saida" };
}

export type EventResolution = Extract<Resolution, { kind: "evento" }>;

export function resolveEvent(state: State, ev: GameEvent, optionId: string): EventResolution {
  const o = ev.opcoes.find((x) => x.id === optionId);
  if (!o) throw new Error(`opção ${optionId} não existe em ${ev.id}`);
  if (!meets(o.requer, state)) throw new Error(`opção ${optionId} indisponível`);
  let efeitos: Effects = o.efeitos ?? {};
  let texto: I18n | null = null;
  const rs = normalizedResults(o, state);
  if (rs.length) {
    const rng = rngFor(state.seed, "eventroll", ev.id, state.cardsJogados);
    const r = rng.weighted(rs, (x) => x.p)!;
    efeitos = { ...efeitos, ...r.efeitos };
    texto = r.texto ?? null;
  }
  applyEffects(state, efeitos);
  if (!state.eventosVistos.includes(ev.id)) state.eventosVistos.push(ev.id);
  state.vistosEm[ev.id] = state.cardsJogados;
  if (ev.tipo === "contexto" && ev.anos) for (const y of ev.anos) if (y <= state.ano && !state.contextosVistos.includes(y)) state.contextosVistos.push(y);
  if (ev.tipo === "destino") state.destinoVisto = true;
  return { kind: "evento", event: ev, optionId, texto, efeitos };
}
