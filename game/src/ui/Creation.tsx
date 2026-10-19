import { useMemo, useState } from "react";
import { ATTRS, DEBUT_YEARS } from "../engine/constants";
import { ORIGINS, originById, pointBudget, validateCreation } from "../engine/creation";
import { randomSeed } from "../engine/rng";
import type { Attributes, CreationInput, Gender, Lang, OriginId } from "../engine/types";
import { ATTR_HELP, ORIGIN_HELP, t } from "../i18n/strings";

/** Distribuição padrão que fecha a conta de cada origem: 3,3,2,2,2 (12) e o ponto extra do Garçom em Contatos. */
function defaultAttrs(origem: OriginId): Attributes {
  const a: Attributes = { beleza: 3, talento: 3, contatos: 2, carisma: 2, juizo: 2 };
  const o = originById(origem);
  let extra = pointBudget(origem) - 12;
  if (extra > 0) a.contatos += extra;
  if (o.talentoMax && a.talento > o.talentoMax) { extra = a.talento - o.talentoMax; a.talento = o.talentoMax; a.juizo += extra; }
  return a;
}

// Nomes artísticos: primeiro nome de uma estrela, sobrenome de outra. "Scarlett Pitt", "Denzel Streep".
const FIRST_F = ["Scarlett", "Meryl", "Julia", "Viola", "Cate", "Nicole", "Zendaya", "Greta", "Florence", "Saoirse", "Margot", "Michelle", "Halle", "Winona", "Jodie", "Sigourney", "Uma", "Salma", "Penélope", "Lupita", "Emma", "Natalie", "Reese", "Sandra", "Whoopi", "Glenn", "Sharon", "Demi", "Angela", "Tilda"];
const FIRST_M = ["Denzel", "Leonardo", "Keanu", "Brad", "Joaquin", "Idris", "Timothée", "Pedro", "Javier", "Mahershala", "Oscar", "Jake", "Ryan", "Adam", "Paul", "Daniel", "Cillian", "Benedict", "Chadwick", "Austin", "Willem", "Jeff", "Harrison", "Samuel", "Forest", "Morgan", "Christoph", "Rami", "Ke Huy", "Brendan"];
const LAST = ["Pitt", "Streep", "Washington", "Blanchett", "Phoenix", "Chalamet", "Kidman", "Reeves", "Robbie", "Portman", "Pfeiffer", "Bardem", "Nyong'o", "Theron", "Gosling", "Driver", "Day-Lewis", "Murphy", "Cumberbatch", "Boseman", "Dafoe", "Goldblum", "Ford", "Jackson", "Whitaker", "Freeman", "Waltz", "Malek", "Fraser", "Stone", "Lawrence", "Pugh", "Ronan", "Ryder", "Foster", "Weaver", "Thurman", "Hayek", "Cruz", "Witherspoon", "Bullock", "Goldberg", "Close", "Moore", "Bassett", "Swinton", "Yeoh", "Quan", "Butler", "Elba"];

function randomName(g: Gender): string {
  const first = g === "f" ? FIRST_F : FIRST_M;
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  const f = pick(first);
  let l = pick(LAST);
  while (l === "Streep" && f === "Meryl" || l === "Pitt" && f === "Brad" || `${f} ${l}`.length > 22) l = pick(LAST);
  return `${f} ${l}`;
}

export function Creation({ lang, setLang, initialSeed, prefill, onStart }: { lang: Lang; setLang: (l: Lang) => void; initialSeed: string | null; prefill: CreationInput | null; onStart: (i: CreationInput) => void }) {
  const [genero, setGenero] = useState<Gender>(prefill?.genero ?? "f");
  const [nome, setNome] = useState(randomName(prefill?.genero ?? "f"));
  const [ano, setAno] = useState(prefill?.anoEstreia ?? 1995);
  const [origem, setOrigem] = useState<OriginId>(prefill?.origem ?? "garcom");
  const [attrs, setAttrs] = useState<Attributes>(prefill?.atributos ?? defaultAttrs(prefill?.origem ?? "garcom"));
  const [hollywoodRealista, setHollywoodRealista] = useState(prefill?.opcoes.hollywoodRealista ?? false);
  const [longa, setLonga] = useState(prefill?.opcoes.longa ?? false);
  const [seed, setSeed] = useState(initialSeed ?? randomSeed());
  const budget = pointBudget(origem);
  const used = ATTRS.reduce((s, k) => s + attrs[k], 0);
  const left = budget - used;
  const input: CreationInput = { nome, genero, anoEstreia: ano, origem, atributos: attrs, opcoes: { hollywoodRealista, longa, idioma: lang }, seed };
  const errors = useMemo(() => validateCreation(input), [nome, genero, ano, origem, attrs, hollywoodRealista, longa, seed, lang]);
  const bump = (k: keyof Attributes, d: number) => setAttrs((a) => ({ ...a, [k]: Math.min(5, Math.max(1, a[k] + d)) }));
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
            <button type="button" onClick={() => setNome(randomName(genero))} aria-label="random name">🎲</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="genero">{t("gender", lang)}</label>
          <select id="genero" value={genero} onChange={(e) => { const g = e.target.value as Gender; setGenero(g); setNome(randomName(g)); }}>
            <option value="f">{t("f", lang)}</option>
            <option value="m">{t("m", lang)}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ano">{t("debut", lang)}</label>
          <select id="ano" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {DEBUT_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <section className="stack" style={{ gap: 8 }}>
        <div className="eyebrow">{t("origin", lang)}</div>
        <div className="origins">
          {ORIGINS.filter((o) => !o.minAno || ano >= o.minAno).map((o) => (
            <label key={o.id} className="origin">
              <input type="radio" name="origem" value={o.id} checked={origem === o.id} onChange={() => { setOrigem(o.id); setAttrs(defaultAttrs(o.id)); }} />
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
        <label className="toggle"><input type="checkbox" checked={longa} onChange={(e) => setLonga(e.target.checked)} /><span><b>{t("longa", lang)}</b><div className="d">{t("longaHelp", lang)}</div></span></label>
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
