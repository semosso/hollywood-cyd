/** Link de compartilhamento: ?seed=…&g=f&y=1995&o=garcom&a=3.3.3.2.2&h=0&c=<escolhas em base64url>. */
import { ATTRS } from "./constants";
import type { Attributes, CreationInput, Gender, Lang, OriginId, State } from "./types";

export function encodeChoices(choices: string[]): string {
  const b = btoa(unescape(encodeURIComponent(choices.join(","))));
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeChoices(c: string): string[] {
  if (!c) return [];
  const b = c.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((c.length + 3) % 4);
  const s = decodeURIComponent(escape(atob(b)));
  return s ? s.split(",") : [];
}

export function encodeAttrs(a: Attributes): string {
  return ATTRS.map((k) => a[k]).join(".");
}

export function decodeAttrs(s: string | null): Attributes | null {
  if (!s) return null;
  const parts = s.split(".").map(Number);
  if (parts.length !== ATTRS.length || parts.some((n) => !Number.isInteger(n))) return null;
  return Object.fromEntries(ATTRS.map((k, i) => [k, parts[i]])) as Attributes;
}

export function shareUrl(base: string, state: State, withChoices: boolean): string {
  const u = new URL(base);
  u.searchParams.set("seed", state.seed);
  u.searchParams.set("g", state.genero);
  u.searchParams.set("y", String(state.anoEstreia));
  u.searchParams.set("o", state.origem);
  u.searchParams.set("a", encodeAttrs(state.atributosIniciais));
  u.searchParams.set("h", state.opcoes.hollywoodRealista ? "1" : "0");
  u.searchParams.set("l", state.opcoes.longa ? "1" : "0");
  u.searchParams.set("n", state.nome);
  if (withChoices && state.escolhas.length) u.searchParams.set("c", encodeChoices(state.escolhas));
  return u.toString();
}

/** Lê os parâmetros de criação de um link. Retorna null se faltar o essencial. */
export function creationFromParams(p: URLSearchParams, lang: Lang): CreationInput | null {
  const seed = p.get("seed");
  const atributos = decodeAttrs(p.get("a"));
  if (!seed || !atributos) return null;
  return {
    nome: p.get("n") || "—",
    genero: (p.get("g") as Gender) || "f",
    anoEstreia: Math.max(1975, Math.min(2020, Math.round(Number(p.get("y") || 1995) / 5) * 5)),
    origem: (p.get("o") as OriginId) || "garcom",
    atributos,
    opcoes: { hollywoodRealista: p.get("h") === "1", longa: p.get("l") === "1", idioma: lang },
    seed,
  };
}
