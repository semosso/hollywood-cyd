"""Descrições às cegas geradas a partir dos dados (sem curadoria humana).

Três níveis (hard / medium / easy), em pt e en, construídos com: gênero, faixa de orçamento,
sinopse com o título mascarado, descrição do diretor pela filmografia anterior (sem nome),
co-stars premiados e um fato de produção. Onde existir descrição escrita à mão (curation/blind),
ela tem prioridade no build.
"""
from __future__ import annotations

import re
import unicodedata

MASK = "▇▇▇"
GENRE_IDS = {28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama",
             10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
             878: "Science Fiction", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"}
# (nome, feminino?) para concordância: "num drama" / "numa comédia"
GENRE_PT = {"Action": "filme de ação", "Adventure": "filme de aventura", "Animation": "animação", "Comedy": "comédia", "Crime": "filme policial",
            "Documentary": "documentário", "Drama": "drama", "Family": "filme de família", "Fantasy": "fantasia", "History": "filme histórico",
            "Horror": "terror", "Music": "filme musical", "Mystery": "mistério", "Romance": "romance", "Science Fiction": "ficção científica",
            "TV Movie": "filme de TV", "Thriller": "thriller", "War": "filme de guerra", "Western": "faroeste"}
GENRE_PT_FEM = {"Animation", "Comedy", "Fantasy", "Science Fiction"}


def pt_num(g: str) -> str:
    """'num drama' / 'numa comédia'."""
    return ("numa " if g in GENRE_PT_FEM else "num ") + GENRE_PT.get(g, g.lower())


def pt_um(g: str) -> str:
    return ("uma " if g in GENRE_PT_FEM else "um ") + GENRE_PT.get(g, g.lower())
GENRE_EN = {"Action": "action film", "Adventure": "adventure film", "Animation": "animated film", "Comedy": "comedy", "Crime": "crime film",
            "Documentary": "documentary", "Drama": "drama", "Family": "family film", "Fantasy": "fantasy film", "History": "period piece",
            "Horror": "horror film", "Music": "music film", "Mystery": "mystery", "Romance": "romance", "Science Fiction": "sci-fi film",
            "TV Movie": "TV movie", "Thriller": "thriller", "War": "war film", "Western": "western"}
STOP = {"the", "and", "for", "with", "from", "part", "uma", "um", "the", "dos", "das", "los", "las", "les", "der", "die", "das", "del", "una", "los"}
# nomes de personagem genéricos que não devem ser mascarados
GENERIC_CHARS = {"himself", "herself", "narrator", "voice", "man", "woman", "boy", "girl", "mother", "father", "doctor", "dr", "mr", "mrs", "ms", "the", "young", "old", "uncredited", "self", "additional", "voices"}


def character_words(m: dict) -> set[str]:
    """Tokens dos nomes de personagem do elenco (para sumir da sinopse)."""
    out: set[str] = set()
    for c in (m.get("credits") or {}).get("cast", [])[:12]:
        for w in re.findall(r"[\w']+", _norm(c.get("character") or "")):
            w = w.strip("'")
            if len(w) >= 3 and w not in GENERIC_CHARS and not w.isdigit():
                out.add(w)
    return out
BUDGET_PT = ["Orçamento de um sofá.", "Orçamento modesto.", "Orçamento de estúdio.", "Orçamento de blockbuster."]
BUDGET_EN = ["Couch-cushion budget.", "Modest budget.", "Studio budget.", "Blockbuster budget."]


def _norm(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def title_words(*titles: str | None) -> set[str]:
    out: set[str] = set()
    for t in titles:
        if not t:
            continue
        for w in re.findall(r"[\w']+", _norm(t)):
            if len(w) >= 3 and w not in STOP and not w.isdigit():
                out.add(w)
    return out


def mask(text: str | None, words: set[str]) -> str:
    if not text:
        return ""
    if not words:
        return text
    pattern = re.compile(r"\b(" + "|".join(re.escape(w) for w in sorted(words, key=len, reverse=True)) + r")\w*\b", re.IGNORECASE)
    def rep(m: re.Match) -> str:
        return MASK
    # trabalha sobre o texto original, comparando sem acentos
    out, i = [], 0
    norm = _norm(text)
    if len(norm) != len(text):  # normalização mudou o tamanho (ligaduras); cai no modo simples
        return pattern.sub(rep, text)
    for m in pattern.finditer(norm):
        out.append(text[i:m.start()]); out.append(MASK); i = m.end()
    out.append(text[i:])
    return "".join(out)


def first_sentence(text: str, max_len: int = 160) -> str:
    text = text.strip()
    m = re.search(r"^(.{20,}?[.!?])(\s|$)", text)
    s = m.group(1) if m else text
    if len(s) > max_len:
        s = s[: max_len].rsplit(" ", 1)[0] + "…"
    return s


def budget_tier(budget: int | None) -> int:
    b = budget or 0
    for i, cap in enumerate((15e6, 50e6, 120e6)):
        if b < cap:
            return i
    return 3


def genre_main(genres: list[str]) -> str:
    order = ["Animation", "Documentary", "Horror", "Western", "War", "Science Fiction", "Fantasy", "Music", "Crime", "Thriller", "Mystery", "Action", "Adventure", "History", "Romance", "Comedy", "Drama", "Family", "TV Movie"]
    for g in order:
        if g in genres:
            return g
    return genres[0] if genres else "Drama"


def director_prior(credits: dict | None, year: int, director_id: int | None) -> list[dict]:
    """Filmes dirigidos antes de `year`, mais votados primeiro."""
    if not credits:
        return []
    prior = [c for c in credits.get("crew", []) if c.get("job") == "Director" and (c.get("release_date") or "9999")[:4] < str(year) and (c.get("vote_count") or 0) >= 50]
    prior.sort(key=lambda c: -(c.get("vote_count") or 0))
    return prior


def describe_prior(c: dict, lang: str) -> str:
    """Só gênero e ano do filme anterior: curto, e sem nomes que entreguem o diretor de bandeja."""
    g = GENRE_IDS.get((c.get("genre_ids") or [0])[0], "Drama")
    yr = (c.get("release_date") or "")[:4]
    if lang == "pt":
        return f"o diretor de {pt_um(g)} de {yr}"
    gname = GENRE_EN.get(g, g.lower())
    return f"the director of a {yr} {gname}"


def director_line(credits: dict | None, year: int, director_id: int | None, lang: str, level: str) -> str:
    prior = director_prior(credits, year, director_id)
    n = len(prior)
    if lang == "pt":
        if n == 0:
            head = "Um diretor estreante"
        elif n == 1:
            head = "Um diretor no segundo filme"
        else:
            head = f"Um diretor com {n} filmes no currículo"
        if level == "medium" and prior:
            head = describe_prior(prior[0], "pt")
            head = head[0].upper() + head[1:]
        return head
    if n == 0:
        head = "A first-time director"
    elif n == 1:
        head = "A director on his second film"
    else:
        head = f"A director with {n} films behind him"
    if level == "medium" and prior:
        head = describe_prior(prior[0], "en")
        head = head[0].upper() + head[1:]
    return head


def costar_line(roles: list[dict], my_index: int, oscar_wins: dict[str, int], lang: str) -> str:
    others = [r for i, r in enumerate(roles) if i != my_index and r.get("actor")]
    won = [r for r in others if oscar_wins.get(r["actor"], 0) > 0 or r.get("oscar") == "won"]
    nom = [r for r in others if r.get("oscar") == "nominated"]
    if won:
        return "Você contracena com alguém que já ganhou o Oscar." if lang == "pt" else "You share the screen with an Oscar winner."
    if nom:
        return "Um colega de elenco vai ser indicado por este filme." if lang == "pt" else "A castmate will be nominated for this one."
    return ""


def production_fact(rec: dict, lang: str) -> str:
    rt = rec.get("runtime") or 0
    if rt >= 170:
        return "Quase três horas." if lang == "pt" else "Nearly three hours long."
    if rt and rt <= 90:
        return "Dura menos de hora e meia." if lang == "pt" else "Under ninety minutes."
    if lang == "pt":
        return ""  # as palavras-chave do TMDB são só em inglês
    kws = [k for k in (rec.get("_keywords") or []) if len(k) > 3][:2]
    words = rec.get("_title_words") or set()
    kws = [k for k in kws if not (title_words(k) & words)]
    if kws:
        return ("Palavras-chave: " if lang == "pt" else "Keywords: ") + ", ".join(kws) + "."
    return ""


def generate(rec: dict, m: dict, credits: dict | None, oscar_wins: dict[str, int], my_index: int, credits_pt: dict | None = None) -> tuple[dict, dict]:
    """Devolve (blind_pt, blind_en) com hard/medium/easy."""
    from .tmdb import keywords, pt_br_overview  # import tardio para facilitar testes
    words = title_words(rec["title"].get("en"), rec["title"].get("original"), rec["title"].get("pt")) | character_words(m)
    rec["_title_words"] = words
    rec["_keywords"] = keywords(m)
    g = genre_main(rec["genres"])
    tier = budget_tier(rec.get("budget"))
    # Sem sinopse em português, a descrição fica só com gênero, orçamento e ficha técnica: nada de inglês no meio.
    ov_pt = mask(pt_br_overview(m) or "", words)
    ov_en = mask(m.get("overview") or "", words)
    year = rec["year"] or 0
    did = (rec.get("director") or {}).get("tmdb_id")
    dname = (rec.get("director") or {}).get("name")
    out = {}
    for lang, ov, gmap, budget in (("pt", ov_pt, GENRE_PT, BUDGET_PT), ("en", ov_en, GENRE_EN, BUDGET_EN)):
        gname = gmap.get(g, g.lower())
        s1 = first_sentence(ov, 120) if ov else ""
        fact = production_fact(rec, lang)
        if lang == "pt":
            cr = credits_pt or credits
            hard = f"{director_line(cr, year, did, 'pt', 'hard')} quer você {pt_num(g)}. {budget[tier]} {s1}".strip()
            medium = f"{director_line(cr, year, did, 'pt', 'medium')} quer você {pt_num(g)}. {s1} {fact}".strip()
            easy = f"{dname or 'O diretor'} quer você {pt_num(g)}. {first_sentence(ov, 220) if ov else fact}".strip()
        else:
            hard = f"{director_line(credits, year, did, 'en', 'hard')} wants you in a {gname}. {budget[tier]} {s1}".strip()
            medium = f"{director_line(credits, year, did, 'en', 'medium')} wants you in a {gname}. {s1} {fact}".strip()
            easy = f"{dname or 'The director'} wants you in a {gname}. {first_sentence(ov, 220)}".strip()
        out[lang] = {"hard": re.sub(r"\s+", " ", hard), "medium": re.sub(r"\s+", " ", medium), "easy": re.sub(r"\s+", " ", easy)}
    rec.pop("_title_words", None); rec.pop("_keywords", None)
    return out["pt"], out["en"]
