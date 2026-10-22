import { useEffect, useMemo, useState } from "react";
import { content } from "../engine/content";
import { createState } from "../engine/creation";
import { relocalize, replay, screen, startRun, step } from "../engine/run";
import { creationFromParams, decodeChoices, shareUrl } from "../engine/share";
import type { Action, CreationInput, Lang, State } from "../engine/types";
import { atoFor } from "../engine/timeline";
import { activeMods, effAttrs } from "../engine/attrs";
import { ATTRS } from "../engine/constants";
import { belezaEfetiva } from "../engine/timeline";
import { ATTR_HELP } from "../i18n/strings";
import { t } from "../i18n/strings";
import { CardView } from "./CardView";
import { Creation } from "./Creation";
import { FinalView } from "./FinalView";
import { ResolutionView } from "./ResolutionView";
import { About } from "./About";
import { LangSwitch } from "./LangSwitch";
import { StatusView } from "./StatusView";
import { track } from "./track";
import { METER_HELP, METER_LABEL } from "./format";

function readLS(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function writeLS(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

export function App() {
  const params = useMemo(() => new URLSearchParams(typeof location !== "undefined" ? location.search : ""), []);
  const [lang, setLangState] = useState<Lang>((readLS("lang") as Lang) || (navigator.language.startsWith("pt") ? "pt" : "en"));
  const setLang = (l: Lang) => { setLangState(l); writeLS("lang", l); setState((s) => (s ? relocalize(s, l) : s)); try { document.documentElement.lang = l === "pt" ? "pt-BR" : "en"; } catch { /* ignore */ } };
  const [state, setState] = useState<State | null>(null);
  const [tutorial, setTutorial] = useState(readLS("tutorial") !== "done");
  const [about, setAbout] = useState(false);
  const [status, setStatus] = useState(false);
  const seedParam = params.get("seed");
  const choicesParam = params.get("c");

  useEffect(() => {
    // link completo: reproduz a vida (carreira terminada vai ao card final; em andamento, volta ao card atual)
    if (seedParam && choicesParam) {
      try {
        const input = creationFromParams(params, lang);
        if (input) setState(replay(createState(input), decodeChoices(choicesParam), content));
      } catch { /* cai na criação */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // o endereço acompanha a carreira: dar reload volta ao card atual, e copiar a URL compartilha o estado atual
  useEffect(() => {
    if (!state) return;
    try { history.replaceState(null, "", shareUrl(location.href, state, true)); } catch { /* ignore */ }
  }, [state]);

  const onStart = (input: CreationInput) => { track("run/start", `start ${input.anoEstreia} ${input.genero} ${input.origem}`); setState(startRun(createState(input), content)); };
  const act = (a: Action) => setState((s) => {
    if (!s) return s;
    const n = step(s, a, content);
    if (n.endingId && !s.endingId) track(`run/final/${n.endingId}`, `final ${n.endingId}`);
    if (n.fim?.tipo === "morte" && s.fim?.tipo !== "morte") track(`run/morte/${n.fim.causa}`, "morte");
    return n;
  });

  const goHome = () => {
    if (state && !state.endingId && !window.confirm(t("leaveRun", lang))) return;
    setAbout(false); setStatus(false); setState(null);
    try { history.replaceState(null, "", location.pathname); window.scrollTo(0, 0); } catch { /* ignore */ }
  };
  const langSwitch = <LangSwitch lang={lang} setLang={setLang} />;
  const topbar = <div className="topbar"><button type="button" className="home" onClick={goHome} title={t("home", lang)}>🎬 {t("title", lang)}</button>{langSwitch}</div>;

  if (about) return <div className="wrap">{topbar}<About lang={lang} onClose={() => setAbout(false)} /></div>;
  if (status && state) return <div className="wrap">{topbar}<StatusView state={state} lang={lang} content={content} onClose={() => setStatus(false)} /></div>;
  if (!state) return <div className="wrap"><div className="topbar">{langSwitch}</div><Creation lang={lang} initialSeed={seedParam} prefill={seedParam ? creationFromParams(params, lang) : null} onStart={onStart} /><Footer lang={lang} onAbout={() => setAbout(true)} /></div>;
  const scr = screen(state);
  const m = state.meters;
  return (
    <div className="wrap">
      {topbar}
      {scr !== "final" && (
        <div className="hud">
          <div><button type="button" className="name" onClick={() => setStatus(true)} title={t("status", lang)}>{state.nome}</button> <span className="muted">· {state.ano} · {state.idade} {t("age", lang)} · {lang === "en" ? "act" : "ato"} {["I", "II", "III"][Math.min(2, atoFor(state) - 1)]} · {Math.min(state.cardsJogados + 1, state.totalCards)}/{state.totalCards}</span></div>
          <button type="button" className="mono meters" onClick={() => setStatus(true)} title={t("status", lang)}>
            <span title={METER_HELP.fama[lang]}>★ {Math.round(m.fama)}<small>{METER_LABEL.fama[lang]}</small></span>
            <span title={METER_HELP.prestigio[lang]}>♛ {Math.round(m.prestigio)}<small>{METER_LABEL.prestigio[lang]}</small></span>
            <span title={METER_HELP.heat[lang]}>🔥 {m.heat}<small>{METER_LABEL.heat[lang]}</small></span>
            {activeMods(state).map((mod) => (
              <span key={mod.id} style={{ color: mod.tipo === "boost" ? "var(--ok)" : "var(--warn)" }}>{mod.tipo === "boost" ? "★" : "▼"} {mod.atributo ? ATTR_HELP[mod.atributo].name[lang] : ""} {mod.delta > 0 ? "+" : ""}{mod.delta}</span>
            ))}
          </button>
          <button type="button" className="attrs" style={{ flexBasis: "100%" }} onClick={() => setStatus(true)} title={t("status", lang)}>
            {ATTRS.map((k) => {
              const eff = k === "beleza" ? belezaEfetiva(state) : effAttrs(state)[k];
              const base = state.atributos[k];
              const cls = eff > base ? "up" : eff < base ? "down" : "";
              return <span key={k} className={cls} title={ATTR_HELP[k].name[lang]}>{ATTR_HELP[k].name[lang].slice(0, 3)} {eff}</span>;
            })}
          </button>
        </div>
      )}
      {scr === "resolucao" && <ResolutionView r={state.pendentes[0]} state={state} lang={lang} content={content} onContinue={() => act({ type: "continuar" })} />}
      {scr === "card" && state.card && <CardView state={state} card={state.card} lang={lang} onAction={act} showTutorial={tutorial && state.card.kind === "projeto"} onTutorialDone={() => { setTutorial(false); writeLS("tutorial", "done"); }} />}
      {scr === "final" && (state.endingId ? <FinalView state={state} lang={lang} content={content} onRestart={() => { setState(null); history.replaceState(null, "", location.pathname); }} /> : <button className="primary" onClick={() => act({ type: "continuar" })}>{t("continue", lang)}</button>)}
      <Footer lang={lang} onAbout={() => setAbout(true)} />
    </div>
  );
}

function Footer({ lang, onAbout }: { lang: Lang; onAbout: () => void }) {
  return (
    <div className="footer">
      {t("attribution", lang)}{" "}
      <button type="button" onClick={onAbout} style={{ padding: "2px 8px", fontSize: 13 }}>{lang === "en" ? "About" : "Sobre"}</button>
    </div>
  );
}
