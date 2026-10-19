"""Junta TMDB + OMDb + Wikidata + curadoria num registro por filme, no esquema do doc (15.3)."""
from __future__ import annotations

from . import omdb as omdb_mod
from . import tmdb as tmdb_mod
from . import wikidata as wd_mod
from . import blind as blind_mod

# Exigência dramática do papel por gênero (1 a 5). Combinado com indicação real.
GENRE_DEMAND = {
    "Drama": 3, "History": 3, "War": 3, "Romance": 2, "Crime": 3, "Thriller": 2, "Mystery": 2,
    "Horror": 2, "Music": 3, "Comedy": 2, "Action": 1, "Adventure": 1, "Science Fiction": 2,
    "Fantasy": 2, "Western": 2, "Family": 1, "Animation": 1, "Documentary": 1, "TV Movie": 1,
}


def role_demand(genres: list[str], nominated: bool, won: bool = False) -> int:
    base = max((GENRE_DEMAND.get(g, 2) for g in genres), default=2)
    if won:
        base = max(base, 4)
    elif nominated:
        base = max(base, 3)
    return min(5, base)


def _person_awards(awards: list[dict], name: str) -> dict:
    """Resume os prêmios de uma pessoa por este filme: {'oscar': 'won'|'nominated'|'none', 'razzie': ..., ...}."""
    out = {}
    for a in awards:
        if a["person"] != name or not a["acting"]:
            continue
        fam = a["family"]
        status = "won" if a["kind"].endswith("_win") else "nominated"
        if out.get(fam) != "won":
            out[fam] = status
    return out


def _film_awards(awards: list[dict]) -> dict:
    noms = [a for a in awards if a["kind"] == "film_nomination" and a["family"] == "oscar"]
    wins = [a for a in awards if a["kind"] == "film_win" and a["family"] == "oscar"]
    bp = "none"
    if any("Best Picture" in a["award"] for a in wins):
        bp = "won"
    elif any("Best Picture" in a["award"] for a in noms):
        bp = "nominated"
    return {
        "oscar_nominations": len({a["award"] for a in noms} | {a["award"] for a in wins}),
        "oscar_wins": len({a["award"] for a in wins}),
        "best_picture": bp,
        "palme_dor": any(a["family"] == "cannes" and a["kind"] == "film_win" for a in awards),
        "razzie_nominations": len({a["award"] for a in awards if a["family"] == "razzie"}),
    }


def build_film(m: dict, ratings: dict | None, awards: list[dict], curation: dict | None, director_credits: dict | None = None, oscar_wins: dict[str, int] | None = None, director_credits_pt: dict | None = None, births: dict[int, int | None] | None = None) -> dict:
    genres = [g["name"] for g in m.get("genres", [])]
    year = int((m.get("release_date") or "0000")[:4]) or None
    roles = []
    for c in tmdb_mod.top_cast(m, 6):
        pa = _person_awards(awards, c["name"])
        nominated = pa.get("oscar") in ("won", "nominated")
        won = pa.get("oscar") == "won"
        roles.append({
            "actor": c["name"],
            "actor_tmdb_id": c["tmdb_id"],
            "character": c["character"],
            "order": c["order"],
            "gender": c["gender"],
            "age": (year - births[c["tmdb_id"]]) if (births and births.get(c["tmdb_id"]) and year) else None,
            "demand": role_demand(genres, nominated, won),
            "oscar": pa.get("oscar", "none"),
            "razzie": pa.get("razzie", "none"),
            "globe": pa.get("globe", "none"),
            "cannes": pa.get("cannes_actor", "none"),
        })
    ext = m.get("external_ids") or {}
    cur = curation or {}
    rec = {
        "tmdb_id": m["id"],
        "imdb_id": m.get("imdb_id") or ext.get("imdb_id"),
        "title": {"original": m.get("original_title"), "en": m.get("title"), "pt": cur.get("title_pt") or tmdb_mod.pt_br_title(m)},
        "year": year,
        "runtime": m.get("runtime"),
        "genres": genres,
        "director": tmdb_mod.director(m),
        "producers": tmdb_mod.producers(m),
        "roles": roles,
        "budget": m.get("budget") or None,
        "revenue": m.get("revenue") or None,
        "rt": (ratings or {}).get("rt"),
        "metacritic": (ratings or {}).get("metacritic"),
        "imdb": (ratings or {}).get("imdb"),
        "tmdb_vote": m.get("vote_average"),
        "film_awards": _film_awards(awards),
        "poster": tmdb_mod.poster_url(m.get("poster_path")),
        "blind": cur.get("blind") or {},
        "blind_en": cur.get("blind_en") or {},
        "blind_auto": False,
        "flags": cur.get("flags") or [],
        "trivia": cur.get("trivia") or [],
        "revision": cur.get("revision"),
        "shoot_days": cur.get("shoot_days"),
        "refused_by": cur.get("refused_by") or [],
    }
    if not rec["blind"]:
        my_index = next((i for i, r in enumerate(roles) if r["order"] == 0), 0)
        pt, en = blind_mod.generate(rec, m, director_credits, oscar_wins or {}, my_index, director_credits_pt)
        rec["blind"], rec["blind_en"], rec["blind_auto"] = pt, en, True
    rec["derived"] = derive(rec)
    return rec


def derive(rec: dict) -> dict:
    """Ícones de potencial e classificação do filme, a partir dos dados reais (o ruído entra no jogo, não aqui)."""
    budget, revenue = rec.get("budget") or 0, rec.get("revenue") or 0
    ratio = (revenue / budget) if budget and revenue else None
    rt = rec.get("rt")
    fa = rec["film_awards"]
    acting_noms = sum(1 for r in rec["roles"] if r["oscar"] != "none")
    prize = 0.02
    if fa["oscar_nominations"]:
        prize = 0.25 + 0.05 * min(fa["oscar_nominations"], 10)
    if acting_noms:
        prize = max(prize, 0.45)
    if fa["best_picture"] != "none":
        prize = max(prize, 0.6)
    box = 0.1
    if ratio is not None:
        box = 0.9 if ratio >= 4 else 0.7 if ratio >= 2.5 else 0.5 if ratio >= 1.5 else 0.25 if ratio >= 1 else 0.1
    elif revenue >= 300_000_000:
        box = 0.8
    cult = 0.05
    if rt is not None and rt >= 85 and (ratio is None or ratio < 2):
        cult = 0.35
    scandal = 0.05
    if fa["razzie_nominations"]:
        scandal = 0.3
    outcome = "flop"
    if (rt or 0) >= 85 and fa["oscar_nominations"] >= 4 and (ratio is None or ratio < 4):
        outcome = "oscar_bait"
    elif ratio is not None and ratio >= 3 and (rt or 0) >= 70:
        outcome = "hit"
    elif ratio is not None and ratio >= 2.5:
        outcome = "popcorn"
    elif (rt or 0) >= 85:
        outcome = "cult"
    elif ratio is not None and ratio < 1 and (rt or 0) < 40:
        outcome = "bomb"
    elif ratio is not None and ratio < 1:
        outcome = "flop"
    elif (rt or 0) >= 40:
        outcome = "morno"   # pagou a conta, ninguém lembra: move de lado
    return {
        "p_prize": round(min(prize, 0.95), 2),
        "p_box": round(box, 2),
        "p_cult": round(cult, 2),
        "p_scandal": round(scandal, 2),
        "ratio": round(ratio, 2) if ratio else None,
        "outcome": outcome,
    }
