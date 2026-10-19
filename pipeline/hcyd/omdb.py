"""OMDb: Rotten Tomatoes, Metacritic e IMDb rating por imdb_id."""
import json

from .config import OMDB_API_KEY, OMDB_BASE
from .http_cache import HttpError, cache_path, get_json


def is_limit_error(data: dict) -> bool:
    """OMDb responde 200 + Response=False quando a cota diária (1000) estoura."""
    if not data or data.get("Response") != "False":
        return False
    err = (data.get("Error") or "").lower()
    return "not found" not in err and "incorrect imdb" not in err


def ratings(imdb_id: str) -> dict:
    if not OMDB_API_KEY:
        raise HttpError("defina OMDB_API_KEY no ambiente")
    params = {"apikey": OMDB_API_KEY, "i": imdb_id, "tomatoes": "true"}
    path = cache_path(OMDB_BASE, params, "omdb")
    if path.exists():
        try:
            if is_limit_error(json.loads(path.read_text(encoding="utf-8"))):
                path.unlink()   # entrada envenenada por um run que estourou a cota
        except ValueError:
            path.unlink()
    data = get_json(OMDB_BASE, params, namespace="omdb", ttl_days=90,
                    cacheable=lambda d: not is_limit_error(d))
    if is_limit_error(data):
        raise HttpError(f"OMDb: {data.get('Error')}")
    return parse(data)


def parse(data: dict) -> dict:
    out = {"rt": None, "metacritic": None, "imdb": None, "box_office_usd": None}
    if not data or data.get("Response") == "False":
        return out
    for r in data.get("Ratings", []):
        if r.get("Source") == "Rotten Tomatoes":
            out["rt"] = _pct(r.get("Value"))
        elif r.get("Source") == "Metacritic":
            out["metacritic"] = _frac(r.get("Value"))
    ms = data.get("Metascore")
    if out["metacritic"] is None and ms and ms != "N/A":
        out["metacritic"] = int(ms)
    ir = data.get("imdbRating")
    if ir and ir != "N/A":
        out["imdb"] = float(ir)
    bo = data.get("BoxOffice")
    if bo and bo != "N/A":
        out["box_office_usd"] = int(bo.replace("$", "").replace(",", ""))
    return out


def _pct(v):
    try:
        return int(str(v).rstrip("%"))
    except (TypeError, ValueError):
        return None


def _frac(v):
    try:
        return int(str(v).split("/")[0])
    except (TypeError, ValueError):
        return None
