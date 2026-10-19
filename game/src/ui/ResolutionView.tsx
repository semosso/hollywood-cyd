import { regretLine, toToday, whyLine } from "../engine/resolve";
import type { Lang, Resolution, State } from "../engine/types";
import type { Content } from "../engine/run";
import { t } from "../i18n/strings";
import { METER_LABEL, OUTCOME_LABEL, TIPO_LABEL, money, resultLine } from "./format";
import { rngFor } from "../engine/rng";
import { ATTR_HELP } from "../i18n/strings";

export function ResolutionView({ r, state, lang, content, onContinue }: { r: Resolution; state: State; lang: Lang; content: Content; onContinue: () => void }) {
  return (
    <div className="swipe reveal">
      {r.kind === "estreia" && <Release r={r} state={state} lang={lang} content={content} />}
      {r.kind === "evento" && (
        <>
          <div className="eyebrow">{TIPO_LABEL[r.event.tipo]?.[lang] ?? r.event.tipo}</div>
          <p style={{ margin: 0 }}>{r.texto ? (r.texto[lang] ?? r.texto.pt) : (r.event.opcoes.find((o) => o.id === r.optionId)?.rotulo[lang] ?? "")}</p>
          <Deltas d={r.efeitos as Record<string, number>} lang={lang} />
          {r.event.baseado_em?.length ? (
            <div className="refused">
              <b>{t("basedOn", lang)}</b>
              {r.event.baseado_em.map((b, i) => <div key={i}>{b.quem}, {b.ano}. {b.o_que}. {b.link && <a href={b.link} target="_blank" rel="noreferrer">↗</a>}</div>)}
            </div>
          ) : null}
        </>
      )}
      {r.kind === "revisao" && (
        <>
          <div className="eyebrow">{t("revision", lang)} · {r.film.title[lang] ?? r.film.title.en}</div>
          <p style={{ margin: 0 }}>{r.film.revision?.text[lang] ?? r.film.revision?.text.pt}</p>
          <Deltas d={{ prestigio: r.delta }} lang={lang} />
        </>
      )}
      {r.kind === "guinada" && (
        <>
          <div className="eyebrow" style={{ color: r.mod.tipo === "boost" ? "var(--ok)" : "var(--warn)" }}>{r.mod.tipo === "boost" ? "★ " + t("guinadaUp", lang) : "▼ " + t("guinadaDown", lang)}</div>
          <p style={{ margin: 0, fontSize: 18 }}>{r.mod.texto[lang] ?? r.mod.texto.pt}</p>
          {r.mod.atributo && (
            <div className="deltas"><span className={r.mod.delta > 0 ? "up" : "down"}>{ATTR_HELP[r.mod.atributo].name[lang]} {r.mod.delta > 0 ? "+" : ""}{r.mod.delta} {t("forCards", lang)} {r.mod.ateCard - state.cardsJogados} {t("cards", lang)}</span></div>
          )}
          <p className="muted" style={{ margin: 0 }}>{r.mod.tipo === "boost" ? t("goldenNext", lang) : t("badNext", lang)}</p>
        </>
      )}
      {r.kind === "morte" && (
        <>
          <div className="eyebrow">{t("death", lang)}</div>
          <h2>{state.nome}, {state.idade} {t("age", lang)}</h2>
          <p className="muted" style={{ margin: 0 }}>{t("help", lang)}</p>
        </>
      )}
      <button className="primary" onClick={onContinue}>{t("continue", lang)}</button>
    </div>
  );
}

function Deltas({ d, lang }: { d: Record<string, number | unknown>; lang: Lang }) {
  const items = Object.entries(d).filter(([k, v]) => typeof v === "number" && v !== 0 && k in METER_LABEL) as [string, number][];
  if (!items.length) return null;
  return (
    <div className="deltas">
      {items.map(([k, v]) => <span key={k} className={v > 0 ? "up" : "down"}>{METER_LABEL[k][lang]} {v > 0 ? "↑" : "↓"} {k === "dinheiro" ? money(Math.abs(v), lang) : Math.abs(v)}</span>)}
    </div>
  );
}

function Release({ r, state, lang, content }: { r: Extract<Resolution, { kind: "estreia" }>; state: State; lang: Lang; content: Content }) {
  const f = r.film;
  const role = f.roles[r.roleIndex];
  const others = f.roles.filter((_, i) => i !== r.roleIndex).slice(0, 3).map((x) => x.actor).filter(Boolean);
  const title = f.title[lang] ?? f.title.en ?? f.title.original ?? "";
  const regret = regretLine(f, r.recusado, lang, state.genero, rngFor(state.seed, "regret", f.tmdb_id).int(1000));
  const fa = f.film_awards;
  return (
    <>
      <div className="eyebrow">{t("revealed", lang)}</div>
      {f.poster && <img className="poster" src={f.poster} alt="" />}
      <h2>{title}{f.year ? ` (${f.year})` : ""}</h2>
      {!f.fallback && (
        <p style={{ margin: 0 }}>
          {f.director && <>dir. <b>{f.director.name}</b>. </>}
          {role.actor && <><span className="muted">{t("inTheRoleOf", lang)}</span> <b>{role.actor}</b>{role.character ? ` (${role.character})` : ""}. </>}
          {others.length > 0 && <><span className="muted">{t("alongside", lang)}</span> {others.join(", ")}.</>}
        </p>
      )}
      <div>
        <div className="eyebrow">{t("whatHappenedFilm", lang)}</div>
        <dl className="kv">
          {f.budget ? <><dt>{t("budget", lang)}</dt><dd>{money(f.budget, lang)}</dd></> : null}
          {f.revenue ? <><dt>{t("revenue", lang)}</dt><dd>{money(f.revenue, lang)} <span className="muted">({money(toToday(f.revenue, f.year, content.cpi), lang)} {t("todayDollars", lang)})</span></dd></> : null}
          {f.rt != null && <><dt>{t("critics", lang)}</dt><dd>{f.rt}% RT{f.metacritic ? ` · ${f.metacritic} MC` : ""}</dd></>}
          {(fa.oscar_nominations > 0 || fa.oscar_wins > 0) && <><dt>{t("oscars", lang)}</dt><dd>{fa.oscar_nominations} {t("nominations", lang)}, {fa.oscar_wins} {t("wins", lang)}{fa.best_picture === "won" ? " · Best Picture" : ""}</dd></>}
          <dt>—</dt><dd>{OUTCOME_LABEL[f.derived.outcome][lang]}</dd>
        </dl>
      </div>
      <div>
        <div className="eyebrow">{t("whatHappenedYou", lang)}</div>
        <p style={{ margin: "4px 0 8px" }}>{resultLine(r.resultado, rngFor(state.seed, "resultline", f.tmdb_id).int(1000), lang)}</p>
        <Deltas d={r.deltas as Record<string, number>} lang={lang} />
        <div className="why">{whyLine(r, lang)}</div>
        <div className="mono muted" style={{ marginTop: 6 }}>{t("fee", lang)}: {money(r.cache, lang)}</div>
      </div>
      {r.recusado && (
        <div className="refused">
          <b>{t("youRefused", lang)}:</b> {r.recusado.title[lang] ?? r.recusado.title.en} ({r.recusado.year}){r.recusado.director ? `, ${r.recusado.director.name}` : ""}. {OUTCOME_LABEL[r.recusado.derived.outcome][lang]}.
          {r.recusado.roles.some((x) => x.oscar === "won") ? "" : ""} <i>{regret}</i>
        </div>
      )}
      {f.refused_by && f.refused_by.length > 0 && <div className="refused"><b>{t("refusedIRL", lang)}:</b> {f.refused_by.map((x) => `${x.who}${x.role ? ` (${x.role})` : ""}`).join(", ")}</div>}
      {r.rumorFalso && <div className="refused"><b>{t("rumorWasFalse", lang)}:</b> {r.rumorFalso}</div>}
      {lang === "pt" && f.trivia.slice(0, 2).map((tr, i) => <div key={i} className="muted" style={{ fontSize: 14 }}>· {tr}</div>)}
      <div className="mono muted">{state.ano} · {state.idade} {t("age", lang)}</div>
    </>
  );
}
