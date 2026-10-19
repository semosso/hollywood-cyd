import { useEffect, useMemo, useState } from "react";
import { content } from "../engine/content";
import { createState } from "../engine/creation";
import { replay, screen, startRun, step } from "../engine/run";
import { creationFromParams, decodeChoices } from "../engine/share";
import type { Action, CreationInput, Lang, State } from "../engine/types";
import { atoFor } from "../engine/timeline";
import { t } from "../i18n/strings";
import { CardView } from "./CardView";
import { Creation } from "./Creation";
import { FinalView } from "./FinalView";
import { ResolutionView } from "./ResolutionView";
import { METER_LABEL } from "./format";

function readLS(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function writeLS(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

export function App() {
  const params = useMemo(() => new URLSearchParams(typeof location !== "undefined" ? location.search : ""), []);
  const [lang, setLangState] = useState<Lang>((readLS("lang") as Lang) || (navigator.language.startsWith("pt") ? "pt" : "en"));
  const setLang = (l: Lang) => { setLangState(l); writeLS("lang", l); };
  const [state, setState] = useState<State | null>(null);
  const [tutorial, setTutorial] = useState(readLS("tutorial") !== "done");
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

  const onStart = (input: CreationInput) => setState(startRun(createState(input), content));
  const act = (a: Action) => setState((s) => (s ? step(s, a, content) : s));

  if (!state) return <div className="wrap"><Creation lang={lang} setLang={setLang} initialSeed={seedParam} prefill={seedParam ? creationFromParams(params, lang) : null} onStart={onStart} /><Footer lang={lang} /></div>;
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
          </div>
        </div>
      )}
      {scr === "resolucao" && <ResolutionView r={state.pendentes[0]} state={state} lang={lang} content={content} onContinue={() => act({ type: "continuar" })} />}
      {scr === "card" && state.card && <CardView state={state} card={state.card} lang={lang} onAction={act} showTutorial={tutorial && state.card.kind === "projeto"} onTutorialDone={() => { setTutorial(false); writeLS("tutorial", "done"); }} />}
      {scr === "final" && (state.endingId ? <FinalView state={state} lang={lang} content={content} onRestart={() => { setState(null); history.replaceState(null, "", location.pathname); }} /> : <button className="primary" onClick={() => act({ type: "continuar" })}>{t("continue", lang)}</button>)}
      <Footer lang={lang} />
    </div>
  );
}

function Footer({ lang }: { lang: Lang }) {
  return <div className="footer">{t("attribution", lang)}</div>;
}
