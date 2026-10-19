import type { Content } from "./run";
import type { Ending, Film, GameEvent } from "./types";
import films from "../data/films.sample.json";
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

export const content: Content = {
  films: films as unknown as Film[],
  fallbacks: fallbacks as unknown as Film[],
  events: [...vida, ...pessoa, ...midia, ...premiacao, ...contexto, ...destino] as unknown as GameEvent[],
  endings: endings as unknown as Ending[],
  cpi: cpiTable,
};
