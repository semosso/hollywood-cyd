import { useState } from "react";
import { toToday } from "../engine/resolve";
import { filmById, type Content } from "../engine/run";
import { shareUrl } from "../engine/share";
import type { Lang, State } from "../engine/types";
import { ATTR_HELP, t } from "../i18n/strings";
import { originById } from "../engine/creation";
import { RESULT_SHORT, money, resultLine } from "./format";
import { rngFor } from "../engine/rng";

export function FinalView({ state, lang, content, onRestart }: { state: State; lang: Lang; content: Content; onRestart: () => void }) {
  const ending = content.endings.find((e) => e.id === state.endingId) ?? content.endings[content.endings.length - 1];
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, k: string) => { try { await navigator.clipboard.writeText(text); setCopied(k); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ } };
  const base = typeof location !== "undefined" ? location.origin + location.pathname : "https://example.invalid/";
  const regrets = state.filmografia
    .filter((f) => f.recusado)
    .map((f) => ({ f, mine: filmById(content, f.tmdb_id)!, theirs: filmById(content, f.recusado!)! }))
    .map((x) => ({ ...x, gap: (x.theirs.derived.p_prize + x.theirs.derived.p_box) - (x.mine.derived.p_prize + x.mine.derived.p_box) }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 3);
  const worth = toToday(state.meters.dinheiro, Math.min(2025, state.ano), content.cpi);
  const fill = (s: string) => s.replace("{idade}", String(state.idade));
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="final">
        <div className="eyebrow">{t("finalTitle", lang)} · {state.anoEstreia}–{Math.min(state.ano, 2026)} · {state.idade} {t("age", lang)}</div>
        <h1>{ending.titulo[lang] ?? ending.titulo.pt}</h1>
        <div className="headline">{fill(ending.manchete[lang] ?? ending.manchete.pt)}</div>
        <p style={{ margin: 0 }}>{fill(ending.texto[lang] ?? ending.texto.pt)}</p>
        {state.fim?.tipo === "morte" && <p className="muted" style={{ margin: 0, fontSize: 14 }}>{t("help", lang)}</p>}
        <div>
          <div className="eyebrow">{state.nome}</div>
          <div className="mono" style={{ marginTop: 4 }}>
            {Object.entries(state.atributosIniciais).map(([k, v]) => { const b = originById(state.origem).bonus[k as keyof typeof state.atributosIniciais] ?? 0; return <span key={k} style={{ marginRight: 10 }}>{ATTR_HELP[k].name[lang]} {Math.min(6, v + b)}{b ? <span className="muted"> ({v}+{b})</span> : null}</span>; })}
            <span style={{ color: "var(--accent)" }}>{t("luck", lang)}: {state.sorte}</span>
          </div>
        </div>
        <div>
          <div className="eyebrow">{t("filmography", lang)}</div>
          <div className="filmo" style={{ marginTop: 6 }}>
            {state.filmografia.map((fe, i) => {
              const f = filmById(content, fe.tmdb_id)!;
              const role = f.roles[fe.roleIndex];
              return (
                <div key={i}>
                  <span className="mono muted">{fe.year}</span>
                  <span><b>{f.title[lang] ?? f.title.en}</b>{role.actor ? <span className="muted"> · {t("inTheRoleOf", lang)} {role.actor}</span> : null}</span>
                  <span className="badge">{RESULT_SHORT[fe.resultado]?.[lang] ?? fe.resultado}</span>
                </div>
              );
            })}
          </div>
        </div>
        {regrets.length > 0 && (
          <div>
            <div className="eyebrow">{t("regrets", lang)}</div>
            {regrets.map((x, i) => <div key={i} style={{ fontSize: 15, marginTop: 4 }}>{x.mine.year}: {lang === "en" ? "turned down" : "recusei"} <b>{x.theirs.title[lang] ?? x.theirs.title.en}</b> {lang === "en" ? "to make" : "para fazer"} <b>{x.mine.title[lang] ?? x.mine.title.en}</b>. <span className="muted">{resultLine(x.f.resultado, rngFor(state.seed, "resultline", x.mine.tmdb_id).int(1000), lang)}</span></div>)}
          </div>
        )}
        <dl className="kv">
          <dt>{t("netWorth", lang)}</dt><dd>{money(worth, lang)} <span className="muted">({t("todayDollars", lang)})</span></dd>
          <dt>{t("seed", lang)}</dt><dd className="mono">{state.seed}</dd>
        </dl>
        <div className="row">
          <button onClick={() => copy(shareUrl(base, state, true), "life")}>{copied === "life" ? t("copied", lang) : t("share", lang)}</button>
          <button onClick={() => copy(shareUrl(base, state, false), "seed")}>{copied === "seed" ? t("copied", lang) : t("shareSeed", lang)}</button>
          <button className="primary" onClick={onRestart}>{t("playAgain", lang)}</button>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{t("attribution", lang)}</div>
      </div>
    </div>
  );
}
