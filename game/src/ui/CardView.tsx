import { useEffect, useRef, useState } from "react";
import { availableOptions, normalizedResults } from "../engine/events";
import type { Action, Card, Lang, Offer, State } from "../engine/types";
import { t } from "../i18n/strings";
import { TIPO_LABEL, pct } from "./format";

const SWIPE_X = 0.4; // fração da largura para confirmar
const START_PX = 12;  // deslocamento mínimo para decidir se é swipe ou rolagem

export function CardView({ state, card, lang, onAction, showTutorial, onTutorialDone }: { state: State; card: Card; lang: Lang; onAction: (a: Action) => void; showTutorial: boolean; onTutorialDone: () => void }) {
  if (card.kind === "projeto") return <ProjectCard state={state} card={card} lang={lang} onAction={onAction} showTutorial={showTutorial} onTutorialDone={onTutorialDone} />;
  const opts = availableOptions(card.event, state);
  return (
    <div className="swipe">
      <div className="eyebrow">{TIPO_LABEL[card.event.tipo]?.[lang] ?? card.event.tipo}</div>
      <p style={{ fontSize: 18, marginTop: 8 }}>{(card.event.texto[lang] ?? card.event.texto.pt).replace("{idade}", String(state.idade))}</p>
      <div className="evopts">
        {opts.map((o) => {
          const rs = normalizedResults(o, state);
          return (
            <button key={o.id} className={`evopt ${o.disponivel ? "" : "locked"}`} disabled={!o.disponivel} onClick={() => onAction({ type: "evento", optionId: o.id })}>
              <span>{o.rotulo[lang] ?? o.rotulo.pt}</span>
              {!o.disponivel && o.requer && <span className="p">{t("locked", lang)}: {Object.entries(o.requer).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(",") : v}`).join(", ")}</span>}
              {o.disponivel && card.showProbabilities && rs.length > 0 && (
                <span className="p">{rs.map((r) => `${pct(r.p)} ${(r.texto?.[lang] ?? r.texto?.pt ?? "").slice(0, 40)}${(r.texto?.pt?.length ?? 0) > 40 ? "…" : ""}`).join(" · ")}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OfferBox({ o, lang, hot, tag }: { o: Offer; lang: Lang; hot: "left" | "right" | null; tag: "A" | "B" }) {
  const yrs = o.visible.releaseIn === 1 ? t("year", lang) : t("years", lang);
  return (
    <div className={`offer ${hot ? `hot-${hot}` : ""}`}>
      <div className={`tag tag-${tag}`}>{tag === "A" ? "◀ A" : "B ▶"}</div>
      <div className="meta">
        <span>{o.visible.genres.join(" · ") || "—"}</span><span>{o.visible.budgetBand}</span><span>{t("releaseIn", lang)} {o.visible.releaseIn} {yrs}</span>
        {o.reach && <span style={{ color: "var(--accent)" }}>↑ reach</span>}
      </div>
      <div className="blind">{o.visible.blind}</div>
      {o.visible.directorName && <div className="mono" style={{ color: "var(--accent)" }}>dir. {o.visible.directorName}</div>}
      {o.visible.scriptBand && <div className="mono">✎ {o.visible.scriptBand}</div>}
      {o.visible.redFlag && <div className="flag">🚩 {lang === "en" ? "troubled production" : "produção problemática"}</div>}
      {o.visible.rumors.map((r, i) => <div className="rumor" key={i}>🗞️ {r}</div>)}
      <div className="icons">
        <div><b>{pct(o.icons.prize)}</b>🏆 {t("prize", lang)}</div>
        <div><b>{pct(o.icons.box)}</b>💰 {t("box", lang)}</div>
        <div><b>{pct(o.icons.cult)}</b>🔮 {t("cult", lang)}</div>
        <div><b>{pct(o.icons.scandal)}</b>🧨 {t("scandal", lang)}</div>
      </div>
    </div>
  );
}

function ProjectCard({ state, card, lang, onAction, showTutorial, onTutorialDone }: { state: State; card: Extract<Card, { kind: "projeto" }>; lang: Lang; onAction: (a: Action) => void; showTutorial: boolean; onTutorialDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const mode = useRef<"idle" | "swipe" | "scroll">("idle");
  const [animate, setAnimate] = useState(false);
  const w = ref.current?.offsetWidth ?? 360;
  const dx = drag?.x ?? 0;
  const third = card.third;
  // só o eixo horizontal decide; o vertical fica para a rolagem nativa (touch-action: pan-y)
  const intent: "A" | "B" | null = dx < -SWIPE_X * w ? "A" : dx > SWIPE_X * w ? "B" : null;
  const [A, B] = card.offers;
  void state;

  useEffect(() => { setDrag(null); setAnimate(false); mode.current = "idle"; }, [card]);

  const onDown = (e: React.PointerEvent) => { if (showTutorial) return; start.current = { x: e.clientX, y: e.clientY }; mode.current = "idle"; setAnimate(false); };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const mx = e.clientX - start.current.x, my = e.clientY - start.current.y;
    if (mode.current === "idle") {
      if (Math.abs(mx) > START_PX && Math.abs(mx) > Math.abs(my) * 1.2) { mode.current = "swipe"; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); }
      else if (Math.abs(my) > START_PX) { mode.current = "scroll"; start.current = null; return; }
      else return;
    }
    if (mode.current === "swipe") setDrag({ x: mx, y: 0 });
  };
  const onUp = () => {
    if (!start.current) { mode.current = "idle"; return; }
    start.current = null;
    if (mode.current === "swipe" && intent) onAction({ type: "escolher", opcao: intent });
    mode.current = "idle";
    setAnimate(true); setDrag(null);
  };
  const label = intent === "A" ? `◀ ${t("accept", lang)} A` : intent === "B" ? `${t("accept", lang)} B ▶` : "";
  const rot = Math.max(-8, Math.min(8, dx / 25));

  return (
    <div className="stage">
      {showTutorial && (
        <div className="tut"><div>
          <div className="arrows">◀ ▶</div>
          <p style={{ margin: 0 }}>{t("tutorial", lang)}</p>
          <button className="primary" onClick={onTutorialDone}>{t("gotIt", lang)}</button>
        </div></div>
      )}
      <div ref={ref} className={`swipe ${animate ? "animate" : ""}`} style={{ transform: `translate(${dx}px, 0) rotate(${rot}deg)` }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="eyebrow">{lang === "en" ? "two offers" : "duas ofertas"}</span>
          {card.hint && <span className="mono" style={{ color: card.modo === "dourado" ? "var(--ok)" : "var(--warn)" }}>{card.modo === "dourado" ? "★ " : ""}{card.hint}</span>}
        </div>
        <div className="offers">
          <OfferBox o={A} lang={lang} tag="A" hot={intent === "A" || (!intent && dx < -40) ? "left" : null} />
          <OfferBox o={B} lang={lang} tag="B" hot={intent === "B" || (!intent && dx > 40) ? "right" : null} />
        </div>
        {third && <div className={`third ${third.disponivel ? "on" : ""}`}>▲ {third.disponivel ? third.requisito : `${t("locked", lang)} ${third.requisito}`}</div>}
        <div className="preview"><span className={intent ? "on" : ""}>{label}</span></div>
      </div>
      <div className="controls">
        <button onClick={() => onAction({ type: "escolher", opcao: "A" })}>◀ {t("accept", lang)} A</button>
        {third && <button disabled={!third.disponivel} onClick={() => onAction({ type: "escolher", opcao: "terceira" })}>▲ {third.requisito.split(":").slice(1).join(":").trim()}</button>}
        <button onClick={() => onAction({ type: "escolher", opcao: "B" })}>{t("accept", lang)} B ▶</button>
      </div>
    </div>
  );
}
