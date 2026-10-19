import { useMemo, useState } from "react";
import { ATTRS, YEAR_MAX_DEBUT, YEAR_MIN } from "../engine/constants";
import { ORIGINS, originById, pointBudget, validateCreation } from "../engine/creation";
import { randomSeed } from "../engine/rng";
import type { Attributes, CreationInput, Gender, Lang, OriginId } from "../engine/types";
import { ATTR_HELP, ORIGIN_HELP, t } from "../i18n/strings";

const NAMES_F = ["Dakota Vance", "Marisol Reyes", "June Calloway", "Priya Sandoval", "Nova Lindqvist", "Camila Duarte"];
const NAMES_M = ["Rhett Calloway", "Theo Marchetti", "Dev Anand Price", "Lucas Ferreira", "Jalen Brooks", "Mateo Salinas"];

export function Creation({ lang, setLang, initialSeed, prefill, onStart }: { lang: Lang; setLang: (l: Lang) => void; initialSeed: string | null; prefill: CreationInput | null; onStart: (i: CreationInput) => void }) {
  const [genero, setGenero] = useState<Gender>(prefill?.genero ?? "f");
  const [nome, setNome] = useState((prefill?.genero ?? "f") === "f" ? NAMES_F[0] : NAMES_M[0]);
  const [ano, setAno] = useState(prefill?.anoEstreia ?? 1995);
  const [origem, setOrigem] = useState<OriginId>(prefill?.origem ?? "garcom");
  const [attrs, setAttrs] = useState<Attributes>(prefill?.atributos ?? { beleza: 3, talento: 3, contatos: 2, carisma: 2, juizo: 2 });
  const [hollywoodRealista, setHollywoodRealista] = useState(prefill?.opcoes.hollywoodRealista ?? false);
  const [seed, setSeed] = useState(initialSeed ?? randomSeed());
  const budget = pointBudget(origem);
  const used = ATTRS.reduce((s, k) => s + attrs[k], 0);
  const left = budget - used;
  const input: CreationInput = { nome, genero, anoEstreia: ano, origem, atributos: attrs, opcoes: { hollywoodRealista, idioma: lang }, seed };
  const errors = useMemo(() => validateCreation(input), [nome, genero, ano, origem, attrs, hollywoodRealista, seed, lang]);
  const bump = (k: keyof Attributes, d: number) => setAttrs((a) => ({ ...a, [k]: Math.min(5, Math.max(1, a[k] + d)) }));
  const names = genero === "f" ? NAMES_F : NAMES_M;
  const bonus = originById(origem).bonus;
  const talentoMax = originById(origem).talentoMax;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <header className="stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="eyebrow">Hollywood · 1975–2025</span>
          <select aria-label="language" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            <option value="pt">Português</option>
            <option value="en">English</option>
          </select>
        </div>
        <h1>{t("title", lang)}</h1>
        <p className="muted" style={{ margin: 0 }}>{t("tagline", lang)}</p>
      </header>

      <div className="row">
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="nome">{t("name", lang)}</label>
          <div className="row" style={{ gap: 6 }}>
            <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
            <button type="button" onClick={() => setNome(names[Math.floor(Math.random() * names.length)])} aria-label="random name">🎲</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="genero">{t("gender", lang)}</label>
          <select id="genero" value={genero} onChange={(e) => { const g = e.target.value as Gender; setGenero(g); setNome((g === "f" ? NAMES_F : NAMES_M)[0]); }}>
            <option value="f">{t("f", lang)}</option>
            <option value="m">{t("m", lang)}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ano">{t("debut", lang)}</label>
          <input id="ano" type="number" min={YEAR_MIN} max={YEAR_MAX_DEBUT} value={ano} onChange={(e) => setAno(Number(e.target.value))} style={{ width: 100 }} />
        </div>
      </div>

      <section className="stack" style={{ gap: 8 }}>
        <div className="eyebrow">{t("origin", lang)}</div>
        <div className="origins">
          {ORIGINS.filter((o) => !o.minAno || ano >= o.minAno).map((o) => (
            <label key={o.id} className="origin">
              <input type="radio" name="origem" value={o.id} checked={origem === o.id} onChange={() => { setOrigem(o.id); if (o.talentoMax) setAttrs((a) => ({ ...a, talento: Math.min(a.talento, o.talentoMax!) })); }} />
              <span><b>{ORIGIN_HELP[o.id].name[lang]}</b><div className="d">{ORIGIN_HELP[o.id][lang]}</div></span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="eyebrow">{t("attrs", lang)}</div>
          <div className="mono" style={{ color: left === 0 ? "var(--ok)" : "var(--warn)" }}>{left} {t("pointsLeft", lang)}</div>
        </div>
        {ATTRS.map((k) => (
          <div className="attr" key={k}>
            <div>
              <b>{ATTR_HELP[k].name[lang]}</b> <span className="pips">{"●".repeat(attrs[k])}{"○".repeat(5 - attrs[k])}{bonus[k] ? <span className="bonus">{"●".repeat(bonus[k]!)}</span> : null}</span>
              {bonus[k] ? <span className="mono" style={{ color: "var(--ok)", marginLeft: 8 }}>+{bonus[k]} {lang === "en" ? "from origin" : "de origem"} = {Math.min(6, attrs[k] + bonus[k]!)}</span> : null}
              {k === "talento" && talentoMax ? <span className="mono" style={{ color: "var(--warn)", marginLeft: 8 }}>{lang === "en" ? `max ${talentoMax} from origin` : `máximo ${talentoMax} de origem`}</span> : null}
            </div>
            <div className="ctl">
              <button type="button" onClick={() => bump(k, -1)} disabled={attrs[k] <= 1} aria-label={`- ${k}`}>−</button>
              <span style={{ width: 16, textAlign: "center" }}>{attrs[k]}</span>
              <button type="button" onClick={() => bump(k, 1)} disabled={attrs[k] >= 5 || left <= 0 || (k === "talento" && !!talentoMax && attrs[k] >= talentoMax)} aria-label={`+ ${k}`}>+</button>
            </div>
            <div className="help">{ATTR_HELP[k][lang]}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="eyebrow">{t("options", lang)}</div>
        <label className="toggle"><input type="checkbox" checked={hollywoodRealista} onChange={(e) => setHollywoodRealista(e.target.checked)} /><span><b>{t("hollywood", lang)}</b><div className="d">{t("hollywoodHelp", lang)}</div></span></label>
        <div className="toggle" style={{ gridTemplateColumns: "1fr" }}>
          <div className="field"><label htmlFor="seed">{t("seed", lang)}</label>
            <div className="row" style={{ gap: 6 }}><input id="seed" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ flex: 1, minWidth: 0 }} /><button type="button" onClick={() => setSeed(randomSeed())}>🎲</button></div>
            <div className="d" style={{ marginTop: 6 }}>{t("seedHelp", lang)}</div>
          </div>
        </div>
      </section>

      <button className="primary" disabled={errors.length > 0} onClick={() => onStart(input)} style={{ padding: 14 }}>{t("start", lang)}</button>
      {errors.length > 0 && <div className="mono" style={{ color: "var(--warn)" }}>{errors.join(" · ")}</div>}
    </div>
  );
}
