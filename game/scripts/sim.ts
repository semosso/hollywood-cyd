/**
 * Simulador de balanceamento: joga N carreiras com políticas aleatórias e escreve data/balance.md.
 * Roda no workflow de dados depois do build, para que a calibração acompanhe os dados reais.
 *   npx tsx scripts/sim.ts [N] [saida]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { content } from "../src/engine/content";
import { createState, pointBudget, ORIGINS } from "../src/engine/creation";
import { ATTRS } from "../src/engine/constants";
import { mulberry32, fnv1a } from "../src/engine/rng";
import { screen, startRun, step } from "../src/engine/run";
import type { Attributes, CreationInput, OriginId, State } from "../src/engine/types";

const N = Number(process.argv[2] || 1500);
const OUT = resolve(process.argv[3] || "../data/balance.md");

function randomAttrs(rng: ReturnType<typeof mulberry32>, budget: number, talentoMax?: number): Attributes {
  const a: Attributes = { beleza: 1, talento: 1, contatos: 1, carisma: 1, juizo: 1 };
  let left = budget - 5;
  while (left > 0) {
    const k = ATTRS[rng.int(ATTRS.length)];
    if (a[k] >= 5 || (k === "talento" && talentoMax && a[k] >= talentoMax)) continue;
    a[k]++; left--;
  }
  return a;
}

function play(i: number): State {
  const rng = mulberry32(fnv1a("sim-" + i));
  const origins = ORIGINS.filter((o) => !o.minAno);
  const o = origins[rng.int(origins.length)];
  const input: CreationInput = {
    nome: "Sim", genero: rng.next() < 0.5 ? "f" : "m", anoEstreia: 1975 + rng.int(46), origem: o.id as OriginId,
    atributos: randomAttrs(rng, pointBudget(o.id as OriginId), o.talentoMax), opcoes: { modoRealista: true, hollywoodRealista: rng.next() < 0.3, idioma: "pt" }, seed: "sim-" + i,
  };
  let s = startRun(createState(input), content);
  for (let guard = 0; guard < 400; guard++) {
    const scr = screen(s);
    if (scr === "final") { if (!s.endingId) s = step(s, { type: "continuar" }, content); break; }
    if (scr === "resolucao") { s = step(s, { type: "continuar" }, content); continue; }
    const c = s.card!;
    if (c.kind === "projeto") {
      const r = rng.next();
      const op = c.third?.disponivel && r < 0.15 ? "terceira" : r < 0.575 ? "A" : "B";
      s = step(s, { type: "escolher", opcao: op }, content);
    } else {
      const opts = c.event.opcoes.filter((op) => { try { return step(s, { type: "evento", optionId: op.id }, content) !== s; } catch { return false; } });
      const pick = opts[rng.int(opts.length)] ?? c.event.opcoes[0];
      s = step(s, { type: "evento", optionId: pick.id }, content);
    }
  }
  return s;
}

const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const endings = new Map<string, number>(), results = new Map<string, number>(), outcomes = new Map<string, number>(), fins = new Map<string, number>();
let films = 0, fallbacks = 0, guinadas = 0, deaths = 0, sumFama = 0, sumPrest = 0, sumMoney = 0, cards = 0, yearsEnd = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const s = play(i);
  count(endings, s.endingId ?? "?");
  count(fins, s.fim?.tipo ?? "?");
  if (s.fim?.tipo === "morte") deaths++;
  for (const f of s.filmografia) { films++; if (f.tmdb_id < 0) fallbacks++; count(results, f.resultado); const film = content.films.find((x) => x.tmdb_id === f.tmdb_id); if (film) count(outcomes, film.derived.outcome); }
  guinadas += s.escolhas.length ? s.modificadores.length : 0;
  sumFama += s.meters.fama; sumPrest += s.meters.prestigio; sumMoney += s.meters.dinheiro; cards += s.cardsJogados; yearsEnd += s.ano - s.anoEstreia;
}
const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;
const table = (m: Map<string, number>, d: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} | ${pct(v, d)} |`).join("\n");
const md = `# Relatório de balanceamento

Gerado por \`scripts/sim.ts\` com ${N} carreiras de política aleatória, ${content.films.length} filmes jogáveis (${content.films.filter((f) => (f as { blind_auto?: boolean }).blind_auto).length} com descrição automática), ${content.events.length} eventos, ${content.endings.length} finais. ${new Date().toISOString().slice(0, 10)}, ${((Date.now() - t0) / 1000).toFixed(1)}s.

## Médias por carreira
| métrica | valor |
|---|---|
| cards jogados | ${(cards / N).toFixed(1)} |
| anos de carreira | ${(yearsEnd / N).toFixed(1)} |
| filmes | ${(films / N).toFixed(2)} (fallbacks: ${pct(fallbacks, films)}) |
| Fama final | ${(sumFama / N).toFixed(1)} |
| Prestígio final | ${(sumPrest / N).toFixed(1)} |
| Dinheiro final | US$ ${(sumMoney / N / 1e6).toFixed(1)} mi |
| mortes | ${pct(deaths, N)} |

## Como as runs terminam
| tipo | n | % |
|---|---|---|
${table(fins, N)}

## Finais
| final | n | % |
|---|---|---|
${table(endings, N)}

## Resultado pessoal por estreia
| resultado | n | % |
|---|---|---|
${table(results, films)}

## Classificação dos filmes aceitos
| outcome | n | % |
|---|---|---|
${table(outcomes, films - fallbacks)}
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, md);
console.log(md);
