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
  opcoes: { modoRealista: true, hollywoodRealista: false, idioma: "pt" },
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
      expect(c.film.year).toBe(1996);
      expect(c.film.roles[c.roleIndex].gender === "f" || c.film.roles[c.roleIndex].gender == null).toBe(true);
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
  it("Hollywood realista: mulher aos 40 com Fama 30 só vê papéis excepcionais", () => {
    const s = createState({ ...base, opcoes: { ...base.opcoes, hollywoodRealista: true } });
    s.idade = 41; s.ano = 2001; s.meters.fama = 30;
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
  it("uma run de 1995 passa por décadas e usa contexto histórico", () => {
    const a = autoplay(base, firstOption);
    expect(a.ano).toBeGreaterThan(2010);
    expect(a.contextosVistos.length).toBeGreaterThan(0);
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
