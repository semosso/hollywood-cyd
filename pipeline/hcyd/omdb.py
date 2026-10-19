"""OMDb: Rotten Tomatoes, Metacritic e IMDb rating por imdb_id."""
from .config import OMDB_API_KEY, OMDB_BASE
from .http_cache import HttpError, get_json


def ratings(imdb_id: str) -> dict:
    if not OMDB_API_KEY:
        raise HttpError("defina OMDB_API_KEY no ambiente")
    data = get_json(OMDB_BASE, {"apikey": OMDB_API_KEY, "i": imdb_id, "tomatoes": "true"},
                    namespace="omdb", ttl_days=90)
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
