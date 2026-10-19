import { useEffect, useMemo, useState } from "react";
import { content } from "../engine/content";
import { createState } from "../engine/creation";
import { replay, screen, startRun, step } from "../engine/run";
import { creationFromParams, decodeChoices } from "../engine/share";
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
import { track } from "./track";
import { METER_LABEL } from "./format";

function readLS(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function writeLS(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

export function App() {
  const params = useMemo(() => new URLSearchParams(typeof location !== "undefined" ? location.search : ""), []);
  const [lang, setLangState] = useState<Lang>((readLS("lang") as Lang) || (navigator.language.startsWith("pt") ? "pt" : "en"));
  const setLang = (l: Lang) => { setLangState(l); writeLS("lang", l); try { document.documentElement.lang = l === "pt" ? "pt-BR" : "en"; } catch { /* ignore */ } };
  const [state, setState] = useState<State | null>(null);
  const [tutorial, setTutorial] = useState(readLS("tutorial") !== "done");
  const [about, setAbout] = useState(false);
  const seedParam = params.get("seed");
  const choicesParam = params.get("c");

  useEffect(() => {
    // link completo: reproduz a vida e vai direto para o card final
    if (seedParam && choicesParam) {
      try {
        const input = creationFromParams(params, lang);
        if (input) setState(replay(createState(input), decodeChoices(choicesParam), content));
      } catch { /* cai na criação */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStart = (input: CreationInput) => { track("run/start", `start ${input.anoEstreia} ${input.genero} ${input.origem}`); setState(startRun(createState(input), content)); };
  const act = (a: Action) => setState((s) => {
    if (!s) return s;
    const n = step(s, a, content);
    if (n.endingId && !s.endingId) track(`run/final/${n.endingId}`, `final ${n.endingId}`);
    if (n.fim?.tipo === "morte" && s.fim?.tipo !== "morte") track(`run/morte/${n.fim.causa}`, "morte");
    return n;
  });

  if (about) return <div className="wrap"><About lang={lang} onClose={() => setAbout(false)} /></div>;
  if (!state) return <div className="wrap"><Creation lang={lang} setLang={setLang} initialSeed={seedParam} prefill={seedParam ? creationFromParams(params, lang) : null} onStart={onStart} /><Footer lang={lang} onAbout={() => setAbout(true)} /></div>;
  const scr = screen(state);
  const m = state.meters;
  return (
    <div className="wrap">
      {scr !== "final" && (
        <div className="hud">
          <div><b>{state.nome}</b> <span className="muted">· {state.ano} · {state.idade} {t("age", lang)} · {lang === "en" ? "act" : "ato"} {["I", "II", "III", "IV", "V"][atoFor(state.idade) - 1]} · {state.cardsJogados + 1}/25</span></div>
          <div className="mono">
            <span title={METER_LABEL.fama[lang]}>★ {Math.round(m.fama)}</span>
            <span title={METER_LABEL.prestigio[lang]}>♛ {Math.round(m.prestigio)}</span>
            <span title={METER_LABEL.heat[lang]}>🔥 {m.heat}</span>
            {activeMods(state).map((mod) => (
              <span key={mod.id} style={{ color: mod.tipo === "boost" ? "var(--ok)" : "var(--warn)" }}>{mod.tipo === "boost" ? "★" : "▼"} {mod.atributo ? ATTR_HELP[mod.atributo].name[lang] : ""} {mod.delta > 0 ? "+" : ""}{mod.delta}</span>
            ))}
          </div>
          <div className="attrs" style={{ flexBasis: "100%" }}>
            {ATTRS.map((k) => {
              const eff = k === "beleza" ? belezaEfetiva(state) : effAttrs(state)[k];
              const base = state.atributos[k];
              const cls = eff > base ? "up" : eff < base ? "down" : "";
              return <span key={k} className={cls} title={ATTR_HELP[k].name[lang]}>{ATTR_HELP[k].name[lang].slice(0, 3)} {eff}</span>;
            })}
          </div>
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
