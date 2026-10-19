"""TMDB: detalhes, elenco, equipe, ids externos e título em pt-BR."""
from .config import TMDB_API_KEY, TMDB_BASE, TMDB_IMG, TMDB_READ_TOKEN
from .http_cache import HttpError, get_json

GENDER = {0: None, 1: "f", 2: "m", 3: "nb"}


def _auth():
    if TMDB_READ_TOKEN:
        return {}, {"Authorization": f"Bearer {TMDB_READ_TOKEN}"}
    if TMDB_API_KEY:
        return {"api_key": TMDB_API_KEY}, {}
    raise HttpError("defina TMDB_API_KEY (v3) ou TMDB_READ_TOKEN (v4) no ambiente")


def search_movie(title: str, year: int | None = None) -> list[dict]:
    params, headers = _auth()
    params.update({"query": title, "include_adult": "false", "language": "en-US"})
    if year:
        params["primary_release_year"] = year
    data = get_json(f"{TMDB_BASE}/search/movie", params, headers, namespace="tmdb_search", ttl_days=30)
    return data.get("results", [])


def discover(year: int, page: int = 1, min_votes: int = 300, bad: bool = False) -> list[dict]:
    """Filmes mais votados de um ano (EUA/inglês), sem animação (16) nem documentário (99).
    bad=True: só os mal avaliados (nota ≤ 5.5) com público suficiente para serem conhecidos: os fracassos famosos."""
    params, headers = _auth()
    params.update({
        "primary_release_year": year, "sort_by": "vote_count.desc", "with_original_language": "en",
        "without_genres": "16,99", "vote_count.gte": min_votes if not bad else max(120, min_votes // 3), "include_adult": "false", "page": page, "language": "en-US",
    })
    if bad:
        params["vote_average.lte"] = 5.5
    data = get_json(f"{TMDB_BASE}/discover/movie", params, headers, namespace="tmdb_discover", ttl_days=30)
    return data.get("results", [])


def movie(tmdb_id: int) -> dict:
    """Detalhes + credits + external_ids + translations numa chamada só."""
    params, headers = _auth()
    params.update({"language": "en-US", "append_to_response": "credits,external_ids,translations,release_dates,keywords"})
    return get_json(f"{TMDB_BASE}/movie/{tmdb_id}", params, headers, namespace="tmdb_movie", ttl_days=90)


def person(tmdb_id: int) -> dict:
    params, headers = _auth()
    params.update({"language": "en-US"})
    return get_json(f"{TMDB_BASE}/person/{tmdb_id}", params, headers, namespace="tmdb_person", ttl_days=180)


def poster_url(path: str | None, size: str = "w500") -> str | None:
    return f"{TMDB_IMG}/{size}{path}" if path else None


def pt_br_title(m: dict) -> str | None:
    for t in (m.get("translations") or {}).get("translations", []):
        if t.get("iso_3166_1") == "BR" and t.get("iso_639_1") == "pt":
            title = (t.get("data") or {}).get("title")
            if title:
                return title
    return None


def birth_year(p: dict | None) -> int | None:
    b = (p or {}).get("birthday")
    try:
        return int(b[:4]) if b else None
    except (TypeError, ValueError):
        return None


def top_cast(m: dict, n: int = 4) -> list[dict]:
    cast = sorted((m.get("credits") or {}).get("cast", []), key=lambda c: c.get("order", 999))
    return [
        {
            "tmdb_id": c["id"],
            "name": c["name"],
            "character": c.get("character"),
            "order": c.get("order"),
            "gender": GENDER.get(c.get("gender"), None),
        }
        for c in cast[:n]
    ]


def director(m: dict) -> dict | None:
    for c in (m.get("credits") or {}).get("crew", []):
        if c.get("job") == "Director":
            return {"tmdb_id": c["id"], "name": c["name"], "gender": GENDER.get(c.get("gender"))}
    return None


def producers(m: dict) -> list[dict]:
    return [
        {"tmdb_id": c["id"], "name": c["name"]}
        for c in (m.get("credits") or {}).get("crew", [])
        if c.get("job") in ("Producer", "Executive Producer")
    ][:6]


def person_credits(tmdb_id: int, language: str = "en-US") -> dict:
    """Filmografia da pessoa (cast + crew). Usada para descrever o diretor sem nomeá-lo."""
    params, headers = _auth()
    params.update({"language": language})
    ns = "tmdb_person_credits" if language == "en-US" else "tmdb_person_credits_" + language.replace("-", "_")
    return get_json(f"{TMDB_BASE}/person/{tmdb_id}/movie_credits", params, headers, namespace=ns, ttl_days=90)


def pt_br_overview(m: dict) -> str | None:
    """Sinopse em português: pt-BR primeiro, pt-PT como segunda opção. Nunca devolve inglês."""
    best = None
    for t in (m.get("translations") or {}).get("translations", []):
        if t.get("iso_639_1") != "pt":
            continue
        ov = (t.get("data") or {}).get("overview")
        if not ov:
            continue
        if t.get("iso_3166_1") == "BR":
            return ov
        best = best or ov
    return best


def keywords(m: dict) -> list[str]:
    kw = (m.get("keywords") or {}).get("keywords", [])
    return [k["name"] for k in kw if k.get("name")]
