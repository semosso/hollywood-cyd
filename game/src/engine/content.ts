import type { Content } from "./run";
import type { Ending, Film, GameEvent } from "./types";
import sample from "../data/films.sample.json";
import pipelineFilms from "../data/films.json";
import fallbacks from "../data/fallbacks.json";
import endings from "../data/endings.json";
import cpi from "../data/cpi.json";
import vida from "../data/events/vida.json";
import pessoa from "../data/events/pessoa.json";
import midia from "../data/events/midia.json";
import premiacao from "../data/events/premiacao.json";
import contexto from "../data/events/contexto.json";
import destino from "../data/events/destino.json";

const cpiTable: Record<string, number> = Object.fromEntries(Object.entries(cpi).filter(([k]) => /^\d{4}$/.test(k))) as Record<string, number>;

/** Junta o dataset do pipeline (dados reais completos) com o sample (descrições às cegas escritas à mão). */
function mergeFilms(): Film[] {
  const bySample = new Map((sample as unknown as Film[]).map((f) => [f.tmdb_id, f]));
  const fromPipeline = pipelineFilms as unknown as Film[];
  if (!fromPipeline.length) return sample as unknown as Film[];
  const seen = new Set<number>();
  const out: Film[] = fromPipeline.map((f) => {
    seen.add(f.tmdb_id);
    const s = bySample.get(f.tmdb_id);
    if (!s) return f;
    return {
      ...f,
      blind: Object.keys(f.blind ?? {}).length ? f.blind : s.blind,
      blind_en: f.blind_en ?? s.blind_en,
      flags: f.flags?.length ? f.flags : (s.flags ?? []),
      trivia: f.trivia?.length ? f.trivia : (s.trivia ?? []),
      rumors: f.rumors?.length ? f.rumors : s.rumors,
      revision: f.revision ?? s.revision,
      refused_by: f.refused_by?.length ? f.refused_by : s.refused_by,
      franchise_id: f.franchise_id ?? s.franchise_id,
      title: { ...f.title, pt: f.title.pt ?? s.title.pt },
    };
  });
  for (const s of bySample.values()) if (!seen.has(s.tmdb_id)) out.push(s);
  return out;
}

export const content: Content = {
  films: mergeFilms(),
  fallbacks: fallbacks as unknown as Film[],
  events: [...vida, ...pessoa, ...midia, ...premiacao, ...contexto, ...destino] as unknown as GameEvent[],
  endings: endings as unknown as Ending[],
  cpi: cpiTable,
};
