import type { Lang } from "../engine/types";

const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: "pt", label: "PT", name: "Português" },
  { id: "en", label: "EN", name: "English" },
];

export function LangSwitch({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="langswitch" role="group" aria-label="language">
      {LANGS.map((l) => (
        <button key={l.id} type="button" aria-pressed={lang === l.id} title={l.name} onClick={() => setLang(l.id)}>{l.label}</button>
      ))}
    </div>
  );
}
