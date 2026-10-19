import { activeMods, effAttrs } from "../engine/attrs";
import { ATTRS } from "../engine/constants";
import { filmById, type Content } from "../engine/run";
import { belezaEfetiva } from "../engine/timeline";
import type { Lang, MeterKey, State } from "../engine/types";
import { ATTR_HELP, t } from "../i18n/strings";
import { METER_HELP, METER_LABEL, RESULT_SHORT, money } from "./format";

const METER_ICON: Record<string, string> = { fama: "★", prestigio: "♛", heat: "🔥", dinheiro: "$" };

const BARS: { k: MeterKey; lo: number; hi: number }[] = [
  { k: "fama", lo: 0, hi: 100 }, { k: "prestigio", lo: -20, hi: 100 }, { k: "heat", lo: 0, hi: 10 },
  { k: "estabilidade", lo: 0, hi: 10 }, { k: "vicio", lo: 0, hi: 10 }, { k: "reputacao", lo: -5, hi: 5 },
];

export function StatusView({ state, lang, content, onClose }: { state: State; lang: Lang; content: Content; onClose: () => void }) {
  const eff = effAttrs(state);
  const mods = activeMods(state);
  const pt = lang === "pt";
  return (
    <div className="swipe reveal" role="dialog" aria-label={t("status", lang)}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div><div className="eyebrow">{t("status", lang)}</div><h2>{state.nome}</h2></div>
        <button onClick={onClose}>{t("close", lang)}</button>
      </div>
      <div className="mono muted">{state.anoEstreia} → {state.ano} · {state.idade} {t("age", lang)} · {state.cardsJogados}/{state.totalCards} {pt ? "decisões" : "decisions"} · {t("seed", lang)}: {state.seed}</div>

      <section>
        <div className="eyebrow">{t("attrs", lang)}</div>
        <div className="statgrid">
          {ATTRS.map((k) => {
            const v = k === "beleza" ? belezaEfetiva(state) : eff[k];
            const base = state.atributos[k];
            const mod = mods.find((m) => m.atributo === k);
            return (
              <div key={k} className="statrow">
                <span>{ATTR_HELP[k].name[lang]}</span>
                <span className="pips">{"●".repeat(Math.min(6, v))}{"○".repeat(Math.max(0, 6 - v))}</span>
                <span className={`mono ${v > base ? "up" : v < base ? "down" : "muted"}`}>{v}{v !== base ? ` (${base}${mod ? `, ${mod.delta > 0 ? "+" : ""}${mod.delta} ${pt ? "por" : "for"} ${mod.ateCard - state.cardsJogados + 1} ${pt ? "cards" : "cards"}` : pt ? ", idade" : ", age"})` : ""}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="eyebrow">{t("meters", lang)}</div>
        <div className="statgrid">
          {BARS.map(({ k, lo, hi }) => {
            const v = state.meters[k];
            const pctv = Math.round((100 * (v - lo)) / (hi - lo));
            return (
              <div key={k} className="statrow">
                <span>{METER_ICON[k] ? METER_ICON[k] + " " : ""}{METER_LABEL[k][lang]}</span>
                <span className="bar"><i style={{ width: `${pctv}%` }} /></span>
                <span className="mono">{Math.round(v)}</span>
                {METER_HELP[k] && <span className="help">{METER_HELP[k][lang]}</span>}
              </div>
            );
          })}
          <div className="statrow"><span>$ {METER_LABEL.dinheiro[lang]}</span><span /><span className="mono">{money(state.meters.dinheiro, lang)}</span><span className="help">{METER_HELP.dinheiro[lang]}</span></div>
        </div>
      </section>

      {state.pipeline.length > 0 && (
        <section>
          <div className="eyebrow">{t("inProduction", lang)}</div>
          {state.pipeline.map((_p, i) => <div key={i} className="muted">· {pt ? "assinado, estreia no próximo card" : "signed, opens next card"}</div>)}
        </section>
      )}

      {state.filmografia.length > 0 && (
        <section>
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
        </section>
      )}

      {state.rede.filter((r) => r.kind === "diretor").length > 0 && (
        <section>
          <div className="eyebrow">{t("network", lang)}</div>
          <div className="row" style={{ gap: 6 }}>
            {state.rede.filter((r) => r.kind === "diretor").map((r) => <span key={r.tmdb_id} className="badge" title={r.humor >= 0 ? (pt ? "gostou de você" : "likes you") : (pt ? "não gostou de você" : "does not like you")}>{r.humor >= 0 ? "☺" : "☹"} {r.name}</span>)}
            {state.rede.some((r) => r.kind === "ficticio") && <span className="muted mono">+{state.rede.filter((r) => r.kind === "ficticio").length} {pt ? "contatos" : "contacts"}</span>}
          </div>
        </section>
      )}

      <section>
        <div className="eyebrow">{t("history", lang)}</div>
        <div className="hist">
          {state.historico.length === 0 && <div className="muted">{pt ? "Nada ainda. Sua carreira começa agora." : "Nothing yet. Your career starts now."}</div>}
          {[...state.historico].reverse().map((h, i) => (
            <div key={i} className="histrow">
              <span className="mono muted">{h.ano}</span>
              <span>
                <b>{h.titulo[lang] ?? h.titulo.pt}</b>
                {h.detalhe && <div className="muted" style={{ fontSize: 14 }}>{h.detalhe[lang] ?? h.detalhe.pt}</div>}
                {h.deltas && Object.values(h.deltas).some((v) => v) && (
                  <div className="deltas" style={{ marginTop: 2 }}>
                    {Object.entries(h.deltas).filter(([, v]) => v).map(([k, v]) => <span key={k} className={(v ?? 0) > 0 ? "up" : "down"}>{METER_LABEL[k]?.[lang] ?? k} {(v ?? 0) > 0 ? "↑" : "↓"} {k === "dinheiro" ? money(Math.abs(v ?? 0), lang) : Math.abs(v ?? 0)}</span>)}
                  </div>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
      <button className="primary" onClick={onClose}>{t("close", lang)}</button>
    </div>
  );
}
