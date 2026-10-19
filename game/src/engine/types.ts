export type Gender = "f" | "m";
export type Lang = "pt" | "en";
export type I18n = { pt: string; en?: string };

export type AttrKey = "beleza" | "talento" | "contatos" | "carisma" | "juizo";
export type Attributes = Record<AttrKey, number>;

export type OriginId = "nepo" | "teatro_ny" | "ex_crianca" | "modelo" | "influencer" | "garcom" | "atleta" | "imigrante";

export type AwardStatus = "none" | "nominated" | "won";
export type Outcome = "hit" | "popcorn" | "oscar_bait" | "cult" | "flop" | "bomb";

export type Role = {
  actor: string;
  actor_tmdb_id?: number;
  character?: string | null;
  order: number;
  gender: Gender | "nb" | null;
  demand: number;
  oscar: AwardStatus;
  razzie: AwardStatus;
  globe?: AwardStatus;
  cannes?: AwardStatus;
};

export type Film = {
  tmdb_id: number;
  imdb_id?: string | null;
  title: { original?: string | null; en?: string | null; pt?: string | null };
  year: number;
  runtime?: number | null;
  genres: string[];
  director: { tmdb_id: number; name: string; gender?: Gender | "nb" | null } | null;
  producers?: { tmdb_id: number; name: string }[];
  roles: Role[];
  budget: number | null;
  revenue: number | null;
  rt: number | null;
  metacritic?: number | null;
  imdb?: number | null;
  tmdb_vote?: number | null;
  film_awards: { oscar_nominations: number; oscar_wins: number; best_picture: AwardStatus; palme_dor: boolean; razzie_nominations: number };
  poster: string | null;
  blind: { hard?: string; medium?: string; easy?: string };
  blind_en?: { hard?: string; medium?: string; easy?: string };
  flags: string[];
  franchise_id?: string;
  trivia: string[];
  rumors?: { text: I18n; false?: boolean }[];
  revision?: { year: number; text: I18n; prestige_delta: number } | null;
  shoot_days?: number | null;
  refused_by?: { who: string; role?: string; source?: string }[];
  derived: { p_prize: number; p_box: number; p_cult: number; p_scandal: number; ratio: number | null; outcome: Outcome };
  fallback?: boolean;
  era?: [number, number];
  requer_beleza?: number;
};

export type Options = { hollywoodRealista: boolean; idioma: Lang };

export type CreationInput = {
  nome: string;
  genero: Gender;
  anoEstreia: number;
  origem: OriginId;
  atributos: Attributes;
  opcoes: Options;
  seed: string;
};

export type PipelineEntry = {
  tmdb_id: number;
  roleIndex: number;
  assinadoNoCard: number;
  estreiaNoCard: number;
  recusado: number | null;
  ambos: boolean;
};

export type PersonalResult = "ganhou" | "indicado" | "roubou_a_cena" | "fez_o_trabalho" | "miscast" | "razzie";

export type FilmographyEntry = {
  tmdb_id: number;
  year: number;
  roleIndex: number;
  resultado: PersonalResult;
  recusado: number | null;
  cache: number;
  deltas: Partial<Record<MeterKey, number>>;
};

export type MeterKey = "fama" | "prestigio" | "dinheiro" | "heat" | "estabilidade" | "vicio" | "reputacao";
export type Meters = Record<MeterKey, number>;

export type NetworkEntry = { tmdb_id: number; name: string; humor: number; kind: "diretor" | "ficticio" };

export type DeathCause = "od" | "acidente" | "voo";

export type Offer = {
  film: Film;
  roleIndex: number;
  reach: boolean;
  /** ícones já com ruído aplicado (0..1) */
  icons: { prize: number; box: number; cult: number; scandal: number };
  visible: {
    genres: string[];
    budgetBand: "$" | "$$" | "$$$" | "$$$$";
    releaseIn: number;
    blind: string;
    directorName: string | null;
    scriptBand: string | null;
    redFlag: boolean;
    rumors: string[];
  };
};

export type ProjectCard = { kind: "projeto"; offers: [Offer, Offer]; third: ThirdOption | null; hint: string | null; modo: "normal" | "dourado" | "queda" };
export type ThirdOption = { id: "ambos" | "recusar_ambos"; requisito: string; disponivel: boolean };

export type EventOptionResult = { p: number; efeitos: Effects; texto?: I18n };
export type EventOption = { id: string; rotulo: I18n; requer?: Requirements; efeitos?: Effects; resultados?: EventOptionResult[] };
export type GameEvent = {
  id: string;
  tipo: "vida" | "pessoa" | "midia" | "premiacao" | "contexto" | "destino";
  atos?: number[];
  anos?: number[];
  peso?: number;
  unico?: boolean;
  requer?: Requirements;
  texto: I18n;
  baseado_em?: { quem: string; ano: number; o_que: string; link?: string }[];
  opcoes: EventOption[];
};
export type Requirements = Partial<Record<AttrKey | MeterKey | "idade" | "ano", string>> & {
  flags?: string[];
  flags_ausentes?: string[];
  flags_qualquer?: string[];
  genero?: Gender;
};
export type Effects = Partial<Record<MeterKey, number>> & {
  flag_add?: string[];
  flag_remove?: string[];
  contatos_evento?: number;
  atributo?: Partial<Attributes>;
  morte?: DeathCause;
  fim?: "largar_tudo";
};

export type EventCard = { kind: "evento"; event: GameEvent; showProbabilities: boolean };

export type Card = ProjectCard | EventCard;

export type Resolution =
  | {
      kind: "estreia";
      film: Film;
      roleIndex: number;
      resultado: PersonalResult;
      cache: number;
      deltas: Partial<Record<MeterKey, number>>;
      recusado: Film | null;
      rumorFalso: string | null;
    }
  | { kind: "evento"; event: GameEvent; optionId: string; texto: I18n | null; efeitos: Effects }
  | { kind: "revisao"; film: Film; delta: number }
  | { kind: "guinada"; mod: Modifier }
  | { kind: "morte"; causa: DeathCause };

export type Ending = {
  id: string;
  categoria: string;
  raridade: number;
  requer?: Requirements & { morte?: DeathCause; fim?: string };
  alvo?: Partial<Record<MeterKey, number>>;
  titulo: I18n;
  manchete: I18n;
  texto: I18n;
};

export type Modifier = {
  id: string;
  tipo: "boost" | "queda";
  atributo: AttrKey | null;
  delta: number;
  /** último card (cardsJogados) em que o modificador vale */
  ateCard: number;
  /** boost: o próximo card de projeto é "dourado" (diretor foda). queda: cards de projeto só trazem ofertas ruins. */
  dourado?: boolean;
  origem: string;
  texto: I18n;
};

export type Screen = "criacao" | "resolucao" | "card" | "final";

export type State = {
  seed: string;
  nome: string;
  genero: Gender;
  origem: OriginId;
  opcoes: Options;
  atributosIniciais: Attributes;
  atributos: Attributes;
  sorte: number;
  ano: number;
  anoEstreia: number;
  idade: number;
  cardsJogados: number;
  meters: Meters;
  flags: string[];
  rede: NetworkEntry[];
  pipeline: PipelineEntry[];
  filmografia: FilmographyEntry[];
  usados: number[];
  eventosVistos: string[];
  vistosEm: Record<string, number>;
  contextosVistos: number[];
  revisoesFeitas: number[];
  destinoVisto: boolean;
  ultimaEstreiaEm: number;
  proximoX: "pessoa" | "midia";
  pendentes: Resolution[];
  modificadores: Modifier[];
  card: Card | null;
  fim: { tipo: "cards" | "morte" | "saida" | "ate_aqui"; causa?: DeathCause } | null;
  endingId: string | null;
  escolhas: string[];
};

export type Action =
  | { type: "escolher"; opcao: "A" | "B" | "terceira" }
  | { type: "evento"; optionId: string }
  | { type: "continuar" };
