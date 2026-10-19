import { createElement, type ReactNode } from "react";
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
  morno: { pt: "morno: passou, pagou a conta, ninguém lembra", en: "lukewarm: came, paid the bills, went" },
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

export const TIPO_LABEL: Record<string, { pt: string; en: string }> = {
  vida: { pt: "vida pessoal", en: "personal life" }, pessoa: { pt: "pessoa", en: "people" }, midia: { pt: "imprensa", en: "press" },
  premiacao: { pt: "temporada de prêmios", en: "awards season" }, contexto: { pt: "o mundo lá fora", en: "the world outside" }, destino: { pt: "destino", en: "fate" },
};

export const RESULT_SHORT: Record<string, { pt: string; en: string }> = {
  ganhou: { pt: "ganhou o Oscar", en: "won the Oscar" }, indicado: { pt: "indicado", en: "nominated" }, roubou_a_cena: { pt: "roubou a cena", en: "stole the scene" },
  fez_o_trabalho: { pt: "fez o trabalho", en: "did the job" }, miscast: { pt: "miscast", en: "miscast" }, razzie: { pt: "Razzie", en: "Razzie" },
};

/** Variações de "o que aconteceu com você", sorteadas por seed + filme (RULES 6.2). */
export const RESULT_LINES: Record<string, { pt: string; en: string }[]> = {
  ganhou: [
    { pt: "Você ganhou o Oscar. Esqueceu de agradecer alguém importante.", en: "You won the Oscar. You forgot to thank someone important." },
    { pt: "Você ganhou o Oscar. A estatueta pesa quatro quilos e a sua mãe chorou em rede nacional.", en: "You won the Oscar. The statue weighs nine pounds and your mother cried on live TV." },
    { pt: "Você ganhou o Oscar. No dia seguinte, três roteiros ruins e um ótimo chegam ao seu agente.", en: "You won the Oscar. The next day, three bad scripts and one great one land on your agent's desk." },
    { pt: "Você ganhou o Oscar. A orquestra começou a tocar aos 44 segundos. Você continuou.", en: "You won the Oscar. The orchestra started at 44 seconds. You kept going." },
    { pt: "Você ganhou o Oscar. Um colega de elenco aplaudiu sem levantar.", en: "You won the Oscar. A castmate clapped without standing up." },
    { pt: "Você ganhou o Oscar. Alguém já está escrevendo que foi 'o ano fraco'.", en: "You won the Oscar. Someone is already writing that it was 'a weak year'." },
  ],
  indicado: [
    { pt: "Indicado(a). Perdeu na noite. Todo mundo achou injusto, por uma semana.", en: "Nominated. Lost on the night. Everyone called it unfair, for a week." },
    { pt: "Indicado(a). Você ensaiou a cara de 'feliz por quem ganhou' no espelho. Funcionou mais ou menos.", en: "Nominated. You rehearsed the 'happy for the winner' face in the mirror. It sort of worked." },
    { pt: "Indicado(a). Seu nome vem antes de 'indicado ao Oscar' em todo pôster pelo resto da vida.", en: "Nominated. 'Oscar nominee' goes before your name on every poster for the rest of your life." },
    { pt: "Indicado(a). O almoço dos indicados rendeu três contatos e uma intoxicação alimentar.", en: "Nominated. The nominees' luncheon yielded three contacts and food poisoning." },
    { pt: "Indicado(a). Perdeu para alguém que fez um biopic com prótese no nariz.", en: "Nominated. Lost to someone who did a biopic with a prosthetic nose." },
    { pt: "Indicado(a). Sua família assistiu da sala de casa. Sua avó disse que você estava magro(a) demais.", en: "Nominated. Your family watched from the living room. Your grandmother said you looked too thin." },
  ],
  roubou_a_cena: [
    { pt: "Você roubou a cena. O protagonista não gostou.", en: "You stole the scene. The lead didn't like it." },
    { pt: "Você roubou a cena. Tem onze minutos de tela e a única frase que todo mundo repete.", en: "You stole the scene. Eleven minutes of screen time and the one line everybody quotes." },
    { pt: "Você roubou a cena. A crítica usou a palavra 'revelação', como se você não trabalhasse há anos.", en: "You stole the scene. Critics used the word 'revelation', as if you hadn't been working for years." },
    { pt: "Você roubou a cena. O diretor cortou duas das suas melhores e ainda assim.", en: "You stole the scene. The director cut two of your best and it still happened." },
    { pt: "Você roubou a cena. Agora todo mundo quer você no papel do melhor amigo.", en: "You stole the scene. Now everyone wants you as the best friend." },
    { pt: "Você roubou a cena. Seu GIF já existe.", en: "You stole the scene. Your GIF already exists." },
  ],
  fez_o_trabalho: [
    { pt: "Você fez o trabalho. Ninguém reclamou. Ninguém lembrou.", en: "You did the job. Nobody complained. Nobody remembered." },
    { pt: "Você fez o trabalho. A crítica escreveu 'competente', que é como se chama 'esquecível' quando se gosta de você.", en: "You did the job. Critics wrote 'competent', which is how they say 'forgettable' when they like you." },
    { pt: "Você fez o trabalho. Seu nome aparece nos créditos entre o diretor de fotografia e o cachorro.", en: "You did the job. Your name appears in the credits between the cinematographer and the dog." },
    { pt: "Você fez o trabalho. Alguém te reconheceu num aeroporto e errou o filme.", en: "You did the job. Someone recognized you at an airport and got the film wrong." },
    { pt: "Você fez o trabalho. O cachê pagou um ano de aluguel e um sofá bom.", en: "You did the job. The fee paid a year of rent and a good couch." },
    { pt: "Você fez o trabalho. O filme passa em TV aberta às 15h de domingo e você muda de canal.", en: "You did the job. The film airs on a Sunday at 3 p.m. and you change the channel." },
    { pt: "Você fez o trabalho. 'Sólido(a)', escreveram. Como uma mesa.", en: "You did the job. 'Solid', they wrote. Like a table." },
  ],
  miscast: [
    { pt: "A crítica te escolheu como o problema do filme.", en: "The critics singled you out as the film's problem." },
    { pt: "Miscast. A crítica usou a palavra 'perdido(a)'. Você não estava perdido(a); estava mal dirigido(a). Ninguém quis saber.", en: "Miscast. Critics used the word 'lost'. You weren't lost; you were badly directed. Nobody cared." },
    { pt: "Miscast. Um crítico escreveu que você 'parecia querer estar em outro filme'. Queria.", en: "Miscast. One critic wrote you 'seemed to want to be in another film'. You did." },
    { pt: "Miscast. O sotaque. Todo mundo falou do sotaque.", en: "Miscast. The accent. Everybody talked about the accent." },
    { pt: "Miscast. A química com o par romântico foi comparada a uma reunião de condomínio.", en: "Miscast. Your chemistry with the love interest was compared to a condo board meeting." },
    { pt: "Miscast. Seu agente disse 'ninguém vai lembrar disso'. Ele estava mentindo e sabia.", en: "Miscast. Your agent said 'nobody will remember this'. He was lying and knew it." },
  ],
  razzie: [
    { pt: "Indicado(a) ao Razzie. Você não foi buscar. Deveria.", en: "Nominated for a Razzie. You didn't show up. You should have." },
    { pt: "Indicado(a) ao Razzie. Você foi buscar, fez piada e saiu melhor do que entrou.", en: "Nominated for a Razzie. You showed up, made a joke and left better than you came in." },
    { pt: "Razzie. Daqui a vinte anos alguém vai dizer que era 'incompreendido'. Vai ser mentira.", en: "Razzie. Twenty years from now someone will call it 'misunderstood'. They'll be lying." },
    { pt: "Razzie. O filme virou sessão da meia-noite com plateia gritando as falas. As suas, principalmente.", en: "Razzie. The film became a midnight screening with the crowd yelling the lines. Yours, mostly." },
    { pt: "Razzie. Seu nome vira resposta de quiz de bar.", en: "Razzie. Your name becomes a pub quiz answer." },
    { pt: "Razzie. A única crítica positiva veio do site do estúdio.", en: "Razzie. The only positive review came from the studio's own website." },
  ],
};

export function resultLine(resultado: string, index: number, lang: "pt" | "en"): string {
  const list = RESULT_LINES[resultado] ?? [];
  if (!list.length) return RESULT_LABEL[resultado]?.[lang] ?? resultado;
  const item = list[((index % list.length) + list.length) % list.length];
  return item[lang] ?? item.pt;
}

export const METER_LABEL: Record<string, { pt: string; en: string }> = {
  fama: { pt: "Fama", en: "Fame" }, prestigio: { pt: "Prestígio", en: "Prestige" }, dinheiro: { pt: "Dinheiro", en: "Money" },
  heat: { pt: "Heat", en: "Heat" }, estabilidade: { pt: "Estabilidade", en: "Stability" }, vicio: { pt: "Vício", en: "Addiction" }, reputacao: { pt: "Reputação", en: "Reputation" },
};

/** Texto com `crases` vira <code class="attr"> (nomes de atributo nas explicações). */
export function inline(text: string): ReactNode[] {
  return text.split("`").map((piece, i) => (i % 2 ? createElement("code", { className: "attr", key: i }, piece) : piece));
}
