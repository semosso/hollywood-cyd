/**
 * Guinadas (RULES 6.6): com baixa probabilidade, um evento pessoal joga a carreira muito para cima
 * ou muito para baixo por alguns cards. Boost: +atributo e o próximo card de projeto é "dourado"
 * (um diretor foda te chamou). Queda: −atributo e os cards de projeto só trazem ofertas ruins.
 */
import { rngFor } from "./rng";
import type { AttrKey, GameEvent, Modifier, State } from "./types";

export const GUINADA_BASE = 0.05;       // por evento pessoal resolvido
export const GUINADA_POR_SORTE = 0.02;  // ± por ponto de sorte em relação a 2
export const GUINADA_DURACAO = 2;       // cards

const BOOSTS: { atributo: AttrKey; delta: number; texto: { pt: string; en: string } }[] = [
  { atributo: "contatos", delta: 2, texto: { pt: "Numa festa em que você quase não foi, alguém te apresenta a um diretor que está montando elenco. Ele quer te ver na segunda-feira. De repente, todo mundo atende o seu telefone.", en: "At a party you almost skipped, someone introduces you to a director who is casting. He wants to see you Monday. Suddenly everyone takes your calls." } },
  { atributo: "carisma", delta: 2, texto: { pt: "Uma semana sem telefone, longe de tudo. Você volta diferente. As pessoas notam antes de você. Um diretor que nunca te olhou pergunta quem você é.", en: "A week without a phone, away from everything. You come back different. People notice before you do. A director who never looked at you asks who you are." } },
  { atributo: "talento", delta: 2, texto: { pt: "Um relacionamento que presta. Você dorme. Você lê. Você faz o melhor teste da sua vida para um diretor que não faz testes.", en: "A relationship that works. You sleep. You read. You give the best audition of your life to a director who doesn't hold auditions." } },
];

const QUEDAS: { atributo: AttrKey; delta: number; texto: { pt: string; en: string } }[] = [
  { atributo: "contatos", delta: -3, texto: { pt: "A pessoa com quem você discutiu naquela festa é mais poderosa do que você pensava. As ligações param de ser retornadas. Seu agente diz que 'agora não é hora de ser exigente'.", en: "The person you argued with at that party is more powerful than you thought. Calls stop being returned. Your agent says 'now is not the time to be picky'." } },
  { atributo: "juizo", delta: -2, texto: { pt: "Um término, um processo e uma semana que não acaba. Você aceita a primeira coisa que aparece, e depois a segunda. Nenhuma das duas é boa.", en: "A breakup, a lawsuit and a week that won't end. You take the first thing that comes along, then the second. Neither is good." } },
  { atributo: "carisma", delta: -2, texto: { pt: "Uma foto, uma frase fora de contexto, uma semana de manchetes. Os produtores 'adoram você', mas 'o momento não é bom'. Só sobra o que ninguém mais quis.", en: "A photo, a quote out of context, a week of headlines. Producers 'love you', but 'the timing isn't right'. Only what nobody else wanted is left." } },
];

export function maybeGuinada(state: State, ev: GameEvent): Modifier | null {
  if (!["vida", "pessoa", "midia", "destino"].includes(ev.tipo)) return null;
  const rng = rngFor(state.seed, "guinada", ev.id, state.cardsJogados);
  const p = GUINADA_BASE + GUINADA_POR_SORTE * (state.sorte - 2);
  if (rng.next() >= p) return null;
  // direção: estabilidade puxa para cima, vício puxa para baixo
  const pPos = Math.min(0.75, Math.max(0.25, 0.5 + 0.04 * (state.meters.estabilidade - 5) - 0.04 * state.meters.vicio));
  const positiva = rng.next() < pPos;
  const pick = rng.pick(positiva ? BOOSTS : QUEDAS)!;
  return {
    id: `${ev.id}@${state.cardsJogados}`,
    tipo: positiva ? "boost" : "queda",
    atributo: pick.atributo,
    delta: pick.delta,
    ateCard: state.cardsJogados + GUINADA_DURACAO,
    dourado: positiva,
    origem: ev.id,
    texto: pick.texto,
  };
}

/** Pool "dourado": filmes de diretor foda, ignorando tier. */
export function isGolden(f: { flags?: string[]; derived: { p_prize: number }; film_awards: { oscar_nominations: number }; director: unknown }): boolean {
  return !!f.director && ((f.flags ?? []).includes("autor") || (f.flags ?? []).includes("tirano_genial") || f.derived.p_prize >= 0.4 || f.film_awards.oscar_nominations >= 4);
}

/** Pool "ruim": o que sobra quando ninguém te quer. */
export function isBad(f: { derived: { outcome: string; p_prize: number }; fallback?: boolean }): boolean {
  return !!f.fallback || ["flop", "bomb", "popcorn"].includes(f.derived.outcome) && f.derived.p_prize < 0.3;
}
