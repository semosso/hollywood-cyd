import type { Lang } from "../engine/types";

export function money(n: number, lang: Lang): string {
  const abs = Math.abs(n);
  const f = (v: number, s: string) => `${n < 0 ? "-" : ""}US$ ${v.toLocaleString(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: v < 10 ? 1 : 0 })}${s}`;
  if (abs >= 1e9) return f(abs / 1e9, lang === "pt" ? " bi" : "B");
  if (abs >= 1e6) return f(abs / 1e6, lang === "pt" ? " mi" : "M");
  if (abs >= 1e3) return f(abs / 1e3, lang === "pt" ? " mil" : "K");
  return f(abs, "");
}

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export const OUTCOME_LABEL: Record<string, { pt: string; en: string }> = {
  hit: { pt: "sucesso de crítica e público", en: "critical and commercial hit" },
  popcorn: { pt: "pipoca: bilheteria sim, crítica não", en: "popcorn: box office yes, critics no" },
  oscar_bait: { pt: "isca de Oscar", en: "Oscar bait" },
  cult: { pt: "cult: a crítica amou, ninguém viu", en: "cult: critics loved it, nobody saw it" },
  flop: { pt: "flop", en: "flop" },
  bomb: { pt: "bomba: perdeu dinheiro e a crítica", en: "bomb: lost money and the critics" },
};

export const RESULT_LABEL: Record<string, { pt: string; en: string }> = {
  ganhou: { pt: "Você ganhou o Oscar. Esqueceu de agradecer alguém importante.", en: "You won the Oscar. You forgot to thank someone important." },
  indicado: { pt: "Indicado(a). Perdeu na noite. Todo mundo achou injusto, por uma semana.", en: "Nominated. Lost on the night. Everyone called it unfair, for a week." },
  roubou_a_cena: { pt: "Você roubou a cena. O protagonista não gostou.", en: "You stole the scene. The lead didn't like it." },
  fez_o_trabalho: { pt: "Você fez o trabalho. Ninguém reclamou. Ninguém lembrou.", en: "You did the job. Nobody complained. Nobody remembered." },
  miscast: { pt: "A crítica te escolheu como o problema do filme.", en: "The critics singled you out as the film's problem." },
  razzie: { pt: "Indicado(a) ao Razzie. Você não foi buscar. Deveria.", en: "Nominated for a Razzie. You didn't show up. You should have." },
};

export const METER_LABEL: Record<string, { pt: string; en: string }> = {
  fama: { pt: "Fama", en: "Fame" }, prestigio: { pt: "Prestígio", en: "Prestige" }, dinheiro: { pt: "Dinheiro", en: "Money" },
  heat: { pt: "Heat", en: "Heat" }, estabilidade: { pt: "Estabilidade", en: "Stability" }, vicio: { pt: "Vício", en: "Addiction" }, reputacao: { pt: "Reputação", en: "Reputation" },
};
