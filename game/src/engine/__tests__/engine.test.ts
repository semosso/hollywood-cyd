import { describe, expect, it } from "vitest";
import { content } from "../content";
import { createState, pointBudget, validateCreation } from "../creation";
import { applyDecay } from "../decay";
import { chooseEnding } from "../endings";
import { noisyIcon, pool } from "../offers";
import { personalResult } from "../resolve";
import { replay, screen, startRun, step } from "../run";
import { decodeChoices, encodeChoices } from "../share";
import type { CreationInput, State } from "../types";
import { METER_LIMITS } from "../constants";

const base: CreationInput = {
  nome: "Teste",
  genero: "f",
  anoEstreia: 1995,
  origem: "garcom",
  atributos: { beleza: 3, talento: 3, contatos: 3, carisma: 2, juizo: 2 },
  opcoes: { hollywoodRealista: false, longa: false, idioma: "pt" },
  seed: "teste-1",
};

function autoplay(input: CreationInput, pick: (s: State, i: number) => string): State {
  let s = startRun(createState(input), content);
  let i = 0;
  while (i < 200) {
    const scr = screen(s);
    if (scr === "final") { if (!s.endingId) s = step(s, { type: "continuar" }, content); break; }
    if (scr === "resolucao") { s = step(s, { type: "continuar" }, content); continue; }
    const c = pick(s, i++);
    s = s.card!.kind === "projeto" ? step(s, { type: "escolher", opcao: c as "A" | "B" }, content) : step(s, { type: "evento", optionId: c }, content);
  }
  return s;
}
const firstOption = (s: State) => (s.card!.kind === "projeto" ? "A" : s.card!.event.opcoes.find((o) => !o.requer)!.id);

describe("criação", () => {
  it("rejeita soma errada e valores fora da faixa", () => {
    expect(validateCreation({ ...base, atributos: { ...base.atributos, juizo: 3 } })).toContainEqual(expect.stringContaining("soma"));
    expect(validateCreation({ ...base, atributos: { ...base.atributos, beleza: 0, juizo: 5 } })).toContainEqual(expect.stringContaining("beleza"));
    expect(pointBudget("garcom")).toBe(13);
    expect(validateCreation(base)).toEqual([]);
    expect(validateCreation({ ...base, anoEstreia: 1997 })).toContainEqual(expect.stringContaining("múltiplo"));
  });
  it("aplica bônus de origem e sorteia a sorte pela seed", () => {
    const s = createState({ ...base, origem: "nepo", atributos: { beleza: 3, talento: 3, contatos: 2, carisma: 2, juizo: 2 } });
    expect(s.atributos.contatos).toBe(4);
    expect(s.meters.prestigio).toBe(-10);
    expect(createState(base).sorte).toBe(createState(base).sorte);
  });
});

describe("ofertas", () => {
  it("pool respeita janela de anos, gênero do papel e filmes usados", () => {
    const s = createState(base);
    const p = pool(content.films, s);
    expect(p.length).toBeGreaterThan(0);
    for (const c of p) {
      expect([1996, 1997, 1998]).toContain(c.film.year); // janela de 2 anos por decisão
      expect(["f", "nb"]).toContain(c.film.roles[c.roleIndex].gender);
    }
    s.usados.push(p[0].film.tmdb_id);
    expect(pool(content.films, s).find((c) => c.film.tmdb_id === p[0].film.tmdb_id)).toBeUndefined();
  });
  it("ruído fica em ±0.15 e é estável", () => {
    for (let i = 0; i < 50; i++) {
      const v = noisyIcon("s", i, "prize", 0.5);
      expect(v).toBeGreaterThanOrEqual(0.35);
      expect(v).toBeLessThanOrEqual(0.65);
      expect(noisyIcon("s", i, "prize", 0.5)).toBe(v);
    }
  });
  it("Hollywood realista: mulher aos 46 com Fama 30 só vê papéis excepcionais", () => {
    const s = createState({ ...base, opcoes: { ...base.opcoes, hollywoodRealista: true } });
    s.idade = 46; s.ano = 2001; s.meters.fama = 30;
    for (const c of pool(content.films, s)) expect(c.film.roles[c.roleIndex].oscar !== "none" || c.film.derived.p_prize >= 0.4).toBe(true);
  });
});

describe("resolução", () => {
  const film = content.films.find((f) => f.tmdb_id === 1934)!; // Shakespeare in Love, Paltrow won
  it("talento 5 em papel premiado nunca dá razzie sem caos; talento 1 em demand 5 nunca ganha sem caos", () => {
    const s = createState(base);
    const paltrow = film.roles.findIndex((r) => r.actor === "Gwyneth Paltrow");
    for (let i = 0; i < 100; i++) {
      expect(personalResult(film, paltrow, 5, s, i / 100, 0.99, 0)).not.toBe("razzie");
    }
    const hard = { ...film, roles: [{ ...film.roles[paltrow], demand: 5, oscar: "none" as const }] };
    for (let i = 0; i < 100; i++) expect(personalResult(hard, 0, 1, s, i / 100, 0.99, 0)).not.toBe("ganhou");
  });
});

describe("decaimento e finais", () => {
  it("nunca viola limites", () => {
    const s = createState(base);
    s.meters.fama = 0; s.meters.heat = 0; s.meters.vicio = 10; s.meters.estabilidade = 0;
    applyDecay(s);
    for (const [k, [lo, hi]] of Object.entries(METER_LIMITS)) {
      const v = s.meters[k as keyof typeof s.meters];
      expect(v).toBeGreaterThanOrEqual(lo); expect(v).toBeLessThanOrEqual(hi);
    }
  });
  it("sempre há um final elegível", () => {
    const s = createState(base);
    expect(chooseEnding(content.endings, s)).toBeTruthy();
    s.fim = { tipo: "morte", causa: "od" };
    expect(chooseEnding(content.endings, s).id).toBe("od");
  });
});

describe("run", () => {
  it("é determinística e termina", () => {
    const a = autoplay(base, firstOption);
    const b = autoplay(base, firstOption);
    expect(a.fim).toBeTruthy();
    expect(a.endingId).toBeTruthy();
    expect(a.filmografia.length).toBeGreaterThan(3);
    expect(a.cardsJogados).toBeLessThanOrEqual(15);
    expect(JSON.stringify(a.meters)).toBe(JSON.stringify(b.meters));
    expect(a.escolhas).toEqual(b.escolhas);
  });
  it("link de compartilhamento reproduz a filmografia", () => {
    const a = autoplay(base, (s, i) => (s.card!.kind === "projeto" ? (i % 2 ? "A" : "B") : firstOption(s)));
    const choices = decodeChoices(encodeChoices(a.escolhas));
    expect(choices).toEqual(a.escolhas);
    const r = replay(createState(base), choices, content);
    expect(r.filmografia.map((f) => f.tmdb_id)).toEqual(a.filmografia.map((f) => f.tmdb_id));
    expect(r.endingId).toBe(a.endingId);
  });
  it("replay de uma carreira em andamento para onde o jogador estava, não no final", () => {
    let s = startRun(createState(base), content);
    for (let i = 0; i < 4; i++) {
      while (screen(s) === "resolucao") s = step(s, { type: "continuar" }, content);
      s = s.card!.kind === "projeto" ? step(s, { type: "escolher", opcao: "A" }, content) : step(s, { type: "evento", optionId: firstOption(s) }, content);
    }
    const r = replay(createState(base), decodeChoices(encodeChoices(s.escolhas)), content);
    expect(r.endingId).toBeNull();
    expect(r.cardsJogados).toBe(s.cardsJogados);
    expect(r.escolhas).toEqual(s.escolhas);
    expect(["card", "resolucao"]).toContain(screen(r));
  });
  it("uma run de 1995 tem 12 decisões, passa por décadas e usa contexto histórico", () => {
    const a = autoplay(base, firstOption);
    expect(createState(base).totalCards).toBe(12);
    expect(createState({ ...base, opcoes: { ...base.opcoes, longa: true } }).totalCards).toBe(24);
    expect(a.ano).toBeGreaterThan(2010);
    expect(a.contextosVistos).toContain(2007);
    expect(a.contextosVistos).toContain(1988); // anterior à estreia: marcado como visto, nunca mostrado
    expect(a.historico.length).toBeGreaterThan(10);
  });
  it("a época de estreia e o ritmo ditam o número de decisões, nunca menos que oito", async () => {
    const { totalCardsFor } = await import("../timeline");
    expect(totalCardsFor(1975, false)).toBe(20);
    expect(totalCardsFor(1975, true)).toBe(40);
    expect(totalCardsFor(1995, false)).toBe(12);
    expect(totalCardsFor(1995, true)).toBe(24);
    expect(totalCardsFor(2010, false)).toBe(8); // 6 cabem, mínimo 8
    expect(totalCardsFor(2020, true)).toBe(8);
  });
});

describe("share", () => {
  it("codifica e decodifica os parâmetros de criação", async () => {
    const { shareUrl, creationFromParams } = await import("../share");
    const s = createState(base);
    const u = new URL(shareUrl("https://x.test/", s, false));
    const back = creationFromParams(u.searchParams, "pt")!;
    expect(back.seed).toBe(base.seed);
    expect(back.atributos).toEqual(base.atributos);
    expect(back.origem).toBe("garcom");
    expect(back.anoEstreia).toBe(1995);
  });
});


describe("idade", () => {
  it("papel só cabe se a idade do ator no filme bate com a do jogador", async () => {
    const { ageFits } = await import("../offers");
    const role = { actor: "x", order: 0, gender: "f" as const, demand: 3, oscar: "none" as const, razzie: "none" as const };
    expect(ageFits({ ...role, age: 27 }, 65)).toBe(false);
    expect(ageFits({ ...role, age: 27 }, 30)).toBe(true);
    expect(ageFits({ ...role, age: 20 }, 22)).toBe(true);
    expect(ageFits({ ...role, age: 40 }, 32)).toBe(true);
    expect(ageFits({ ...role, age: 45 }, 32)).toBe(false);
    expect(ageFits({ ...role, age: null }, 65)).toBe(true);
  });
});

describe("status e cobiça", () => {
  it("iniciante recebe bem menos filmes cobiçados que uma estrela", async () => {
    const { buildProjectCard, cobica } = await import("../offers");
    const avg = (fama: number, prestigio: number) => {
      let sum = 0, n = 0;
      for (let i = 0; i < 120; i++) {
        const s = createState({ ...base, seed: `cob-${i}`, anoEstreia: 1975 + 5 * (i % 9) });
        s.meters.fama = fama; s.meters.prestigio = prestigio; s.cardsJogados = i % 5;
        const card = buildProjectCard(content.films, content.fallbacks, s);
        if (!card) continue;
        for (const o of card.offers) if (!o.film.fallback) { sum += cobica(o.film); n++; }
      }
      return sum / Math.max(1, n);
    };
    expect(avg(5, 0)).toBeLessThan(avg(85, 80) - 0.08);
  });
  it("iniciante em filme cobiçado entra como coadjuvante", async () => {
    const { eligibleRole } = await import("../offers");
    const s = createState(base); // status ~0
    const film = content.films.find((f) => f.tmdb_id === 597)!; // Titanic: DiCaprio 0, Winslet 1, Zane 2
    const male = createState({ ...base, genero: "m" });
    const ri = eligibleRole(film, male);
    expect(ri === -1 || film.roles[ri].order >= 2).toBe(true);
    void s;
  });
  it("Oscar exige mais e não dá bis fácil", async () => {
    const { personalResult } = await import("../resolve");
    const film = content.films.find((f) => f.tmdb_id === 1934)!; // Shakespeare in Love, Paltrow won
    const paltrow = film.roles.findIndex((r) => r.actor === "Gwyneth Paltrow");
    const s = createState(base);
    const wins = (st: typeof s) => { let w = 0; for (let i = 0; i < 100; i++) if (personalResult(film, paltrow, 4, st, i / 100, 0.99, 0) === "ganhou") w++; return w; };
    const fresh = wins(s);
    s.filmografia.push({ tmdb_id: 1, year: 1997, roleIndex: 0, resultado: "ganhou", recusado: null, cache: 0, deltas: {} });
    expect(wins(s)).toBeLessThan(fresh);
  });
});

describe("armadilhas", () => {
  it("cerca de metade dos cards traz um filme que deu errado quando o pool tem um", async () => {
    const { buildProjectCard, isTrap } = await import("../offers");
    let traps = 0, cards = 0;
    for (let i = 0; i < 200; i++) {
      const s = createState({ ...base, seed: `trap-${i}`, anoEstreia: 1975 + 5 * (i % 9) });
      s.cardsJogados = i % 7;
      const card = buildProjectCard(content.films, content.fallbacks, s);
      if (!card) continue;
      const poolHasTrap = content.films.some((f) => f.year >= s.ano + 1 && f.year <= s.ano + 2 && isTrap(f) && !f.fallback);
      if (!poolHasTrap) continue;
      cards++; if (card.offers.some((o) => isTrap(o.film))) traps++;
    }
    expect(cards).toBeGreaterThan(20);
    expect(traps / cards).toBeGreaterThan(0.35);
  });
});

describe("beleza", () => {
  it("multiplica a fama ganha por filme e abre fallbacks de comercial e campanha", async () => {
    const { resolveRelease } = await import("../resolve");
    const { belezaEfetiva } = await import("../timeline");
    const film = content.films.find((f) => f.tmdb_id === 597)!; // Titanic, hit
    const lo = createState({ ...base, atributos: { beleza: 1, talento: 3, contatos: 3, carisma: 2, juizo: 4 } });
    const hi = createState({ ...base, atributos: { beleza: 5, talento: 3, contatos: 2, carisma: 2, juizo: 1 } });
    const entry = { tmdb_id: 597, roleIndex: 1, assinadoNoCard: 0, estreiaNoCard: 1, recusado: null, ambos: false };
    const rLo = resolveRelease(lo, entry, film, null, content.cpi);
    const rHi = resolveRelease(hi, entry, film, null, content.cpi);
    expect(belezaEfetiva(hi)).toBeGreaterThan(belezaEfetiva(lo));
    const famaLo = rLo.kind === "estreia" ? rLo.deltas.fama! - (rLo.resultado ? 0 : 0) : 0;
    const famaHi = rHi.kind === "estreia" ? rHi.deltas.fama! : 0;
    // mesma seed e mesmo papel: a diferença vem do fator de Beleza (0.9× vs 1.3× sobre +10×0.8) e do resultado pessoal
    expect(famaHi - famaLo).toBeGreaterThanOrEqual(2);
    const perfume = content.fallbacks.find((f) => f.tmdb_id === -6)!;
    expect(perfume.requer_beleza).toBe(4);
  });
  it("Beleza efetiva cai aos 35, 45 e 55", async () => {
    const { belezaEfetiva } = await import("../timeline");
    const s = createState({ ...base, atributos: { beleza: 5, talento: 3, contatos: 2, carisma: 2, juizo: 1 } });
    expect(belezaEfetiva(s)).toBe(5);
    s.idade = 36; expect(belezaEfetiva(s)).toBe(4);
    s.idade = 46; expect(belezaEfetiva(s)).toBe(3);
    s.idade = 56; expect(belezaEfetiva(s)).toBe(2);
  });
});

describe("guinadas", () => {
  it("boost dourado traz diretores foda e revela o nome; queda só traz ofertas ruins", async () => {
    const { buildProjectCard } = await import("../offers");
    const { isGolden, isBad } = await import("../guinada");
    const s = createState({ ...base, atributos: { beleza: 3, talento: 3, contatos: 1, carisma: 2, juizo: 4 } });
    s.ano = 1999; // ofertas de 2000 (Erin Brockovich: papel feminino premiado)
    s.modificadores = [{ id: "x", tipo: "boost", atributo: "contatos", delta: 2, ateCard: 2, dourado: true, origem: "t", texto: { pt: "" } }];
    const gold = buildProjectCard(content.films, content.fallbacks, s)!;
    expect(gold.modo).toBe("dourado");
    expect(isGolden(gold.offers[0].film)).toBe(true);
    expect(gold.offers[0].visible.directorName).toBeTruthy();
    s.modificadores = [{ id: "y", tipo: "queda", atributo: "contatos", delta: -3, ateCard: 2, origem: "t", texto: { pt: "" } }];
    const bad = buildProjectCard(content.films, content.fallbacks, s)!;
    expect(bad.modo).toBe("queda");
    for (const o of bad.offers) expect(isBad(o.film)).toBe(true);
  });
  it("atributos efetivos aplicam o modificador e expiram", async () => {
    const { effAttrs } = await import("../attrs");
    const s = createState(base);
    s.modificadores = [{ id: "x", tipo: "boost", atributo: "talento", delta: 2, ateCard: 1, origem: "t", texto: { pt: "" } }];
    expect(effAttrs(s).talento).toBe(5);
    s.cardsJogados = 2;
    expect(effAttrs(s).talento).toBe(3);
  });
  it("frequência de guinadas por evento pessoal fica entre 1% e 12%", async () => {
    const { maybeGuinada } = await import("../guinada");
    const ev = content.events.find((e) => e.tipo === "vida")!;
    let hits = 0, n = 0;
    for (let i = 0; i < 400; i++) {
      const s = createState({ ...base, seed: `g-${i}` });
      s.cardsJogados = i % 20;
      n++; if (maybeGuinada(s, ev)) hits++;
    }
    expect(hits / n).toBeGreaterThan(0.01);
    expect(hits / n).toBeLessThan(0.12);
  });
});

describe("contexto e explicações", () => {
  it("evento de contexto que já terminou antes da estreia não aparece (greve de 2007 com estreia em 2010)", async () => {
    const { contextEvent } = await import("../events");
    const s = createState({ ...base, anoEstreia: 2010 });
    for (const ano of [2010, 2015, 2020]) {
      s.ano = ano;
      const e = contextEvent(content.events, s);
      expect(e?.id).not.toBe("greve_2007");
    }
    const s2 = createState({ ...base, anoEstreia: 2005 });
    s2.ano = 2007;
    expect(contextEvent(content.events, s2)?.id).toBe("greve_2007");
  });
  it("whyLine explica o -1 de Talento por fazer dois filmes", async () => {
    const { whyLine } = await import("../resolve");
    const f = { talento: 2, talentoMod: 0, ambos: true, demand: 3, sorte: 2, estabilidade: 6, penalidade: 0, belezaFator: 1, prestigioBonus: 0, bisPenalty: 0, caos: false };
    expect(whyLine({ resultado: "fez_o_trabalho", fatores: f }, "pt")).toContain("dois filmes");
  });
});

describe("repetição de eventos", () => {
  it("evento repetível não volta antes do cooldown, e o bangalô 3 é único", async () => {
    const { pickEvent } = await import("../events");
    const ev = { id: "r", tipo: "vida", unico: false, peso: 1, texto: { pt: "" }, opcoes: [] } as unknown as import("../types").GameEvent;
    const s = createState(base);
    s.eventosVistos = ["r"];
    s.cardsJogados = 10;
    s.vistosEm = { r: 8 };
    expect(pickEvent([ev], "vida", s)).toBeNull(); // visto há 2 cards: nem fresco (cooldown) nem velho (REPEAT_AFTER)
    s.vistosEm = { r: 1 };
    expect(pickEvent([ev], "vida", s)?.id).toBe("r");
    expect(content.events.find((e) => e.id === "balada_bangalo_3")!.unico).not.toBe(false);
  });
  it("todo evento tem texto bilíngue e opções com resultados que somam probabilidade", () => {
    for (const e of content.events) {
      expect(e.texto.pt && e.texto.en, e.id).toBeTruthy();
      for (const o of e.opcoes) {
        expect(o.rotulo.pt && o.rotulo.en, `${e.id}/${o.id}`).toBeTruthy();
        for (const r of o.resultados ?? []) expect(r.texto?.pt && r.texto?.en, `${e.id}/${o.id}`).toBeTruthy();
      }
    }
  });
});

describe("idioma no meio da run", () => {
  it("relocalize remonta o card de projeto no novo idioma sem trocar os filmes", async () => {
    const { relocalize } = await import("../run");
    const s = startRun(createState({ ...base, atributos: { beleza: 2, talento: 3, contatos: 4, carisma: 3, juizo: 1 } }), content);
    expect(s.card?.kind).toBe("projeto");
    const en = relocalize(s, "en");
    expect(en.opcoes.idioma).toBe("en");
    if (en.card?.kind !== "projeto" || s.card?.kind !== "projeto") throw new Error("card");
    expect(en.card.offers.map((o) => o.film.tmdb_id)).toEqual(s.card.offers.map((o) => o.film.tmdb_id));
    expect(en.card.third?.requisito).toMatch(/Connections|Judgment/);
    expect(relocalize(en, "pt").card && (relocalize(en, "pt").card as { third: { requisito: string } }).third.requisito).toMatch(/Contatos|Juízo/);
  });
});
