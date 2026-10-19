"""Uso:
  python -m hcyd resolve     # acha o tmdb_id dos filmes do CSV que não têm id (precisa de chave TMDB)
  python -m hcyd fetch       # baixa TMDB + OMDb + Wikidata para todos os filmes (cache em pipeline/cache)
  python -m hcyd build       # gera data/films.json e data/people.json a partir do cache + curadoria
  python -m hcyd status      # mostra o que já está no cache e o que falta
"""
import csv
import json
import sys
from pathlib import Path

from . import build as build_mod
from . import curation, omdb, tmdb, wikidata
from .config import CACHE_DIR, CURATION_DIR, DATA_DIR, OMDB_API_KEY, TMDB_API_KEY, TMDB_READ_TOKEN
from .http_cache import HttpError


def _log(msg):
    print(msg, file=sys.stderr)


def cmd_resolve():
    rows = curation.films_list()
    out = CURATION_DIR / "films.resolved.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["tmdb_id", "title", "year", "why", "resolved_title", "resolved_year", "confidence"])
        for r in rows:
            if r["tmdb_id"]:
                w.writerow([r["tmdb_id"], r["title"], r["year"], r["why"], "", "", "given"])
                continue
            res = tmdb.search_movie(r["title"], r["year"])
            if not res:
                w.writerow(["", r["title"], r["year"], r["why"], "", "", "NOT FOUND"])
                _log(f"não achei: {r['title']} ({r['year']})")
                continue
            best = res[0]
            conf = "high" if len(res) == 1 or best.get("popularity", 0) > 2 * (res[1].get("popularity", 0) or 0.01) else "check"
            w.writerow([best["id"], r["title"], r["year"], r["why"], best.get("title"), (best.get("release_date") or "")[:4], conf])
    _log(f"escrito {out}. Revise as linhas 'check' e 'NOT FOUND', depois copie os ids para films.csv.")


def cmd_fetch():
    rows = curation.films_list()
    missing = [r["title"] for r in rows if not r["tmdb_id"]]
    if missing:
        _log(f"{len(missing)} filmes sem tmdb_id (rode `resolve` primeiro): {missing[:5]}...")
    done = 0
    for r in rows:
        if not r["tmdb_id"]:
            continue
        try:
            m = tmdb.movie(r["tmdb_id"])
        except HttpError as e:
            _log(f"TMDB falhou para {r['title']}: {e}")
            continue
        imdb_id = m.get("imdb_id") or (m.get("external_ids") or {}).get("imdb_id")
        if imdb_id:
            try:
                wikidata.fetch(imdb_id)
            except HttpError as e:
                _log(f"Wikidata falhou para {r['title']}: {e}")
            if OMDB_API_KEY:
                try:
                    omdb.ratings(imdb_id)
                except HttpError as e:
                    _log(f"OMDb falhou para {r['title']}: {e}")
        done += 1
        if done % 25 == 0:
            _log(f"{done}/{len(rows)}")
    _log(f"fetch concluído: {done} filmes")


def _cached_movie(tmdb_id: int) -> dict | None:
    # Reaproveita o cache sem exigir chave: procura o arquivo do movie no cache.
    d = CACHE_DIR / "tmdb_movie"
    if not d.exists():
        return None
    for p in d.glob("*.json"):
        data = json.loads(p.read_text(encoding="utf-8"))
        if data.get("id") == tmdb_id:
            return data
    return None


def cmd_build():
    rows = curation.films_list()
    films, people = [], {}
    for r in rows:
        if not r["tmdb_id"]:
            continue
        m = _cached_movie(r["tmdb_id"])
        if not m:
            _log(f"sem cache TMDB para {r['title']} (rode `fetch`)")
            continue
        imdb_id = m.get("imdb_id") or (m.get("external_ids") or {}).get("imdb_id")
        awards = []
        ratings = None
        if imdb_id:
            try:
                awards = wikidata.fetch(imdb_id)
            except HttpError:
                pass
            if OMDB_API_KEY:
                try:
                    ratings = omdb.ratings(imdb_id)
                except HttpError:
                    pass
        rec = build_mod.build_film(m, ratings, awards, curation.blind_for(r["tmdb_id"]))
        rec["why"] = r["why"]
        if r["year"] and rec["year"] and abs(r["year"] - rec["year"]) > 1:
            _log(f"ATENÇÃO: tmdb_id {r['tmdb_id']} no CSV é '{r['title']}' ({r['year']}) mas o TMDB devolveu '{rec['title']['en']}' ({rec['year']}). Confira o id.")
        films.append(rec)
        d = rec.get("director")
        if d:
            p = people.setdefault(d["tmdb_id"], {"tmdb_id": d["tmdb_id"], "name": d["name"], "gender": d.get("gender"), "films": []})
            p["films"].append({"tmdb_id": rec["tmdb_id"], "year": rec["year"], "title": rec["title"]["en"]})
    films.sort(key=lambda x: (x["year"] or 0, x["title"]["en"] or ""))
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "films.json").write_text(json.dumps(films, ensure_ascii=False, indent=1), encoding="utf-8")
    (DATA_DIR / "people.json").write_text(json.dumps(sorted(people.values(), key=lambda p: p["name"]), ensure_ascii=False, indent=1), encoding="utf-8")
    _log(f"data/films.json: {len(films)} filmes; data/people.json: {len(people)} diretores")
    missing_blind = [f["title"]["en"] for f in films if not f["blind"]]
    _log(f"sem descrição às cegas: {len(missing_blind)}")


def cmd_status():
    rows = curation.films_list()
    with_id = [r for r in rows if r["tmdb_id"]]
    cached = sum(1 for r in with_id if _cached_movie(r["tmdb_id"]))
    blind = sum(1 for r in with_id if curation.blind_for(r["tmdb_id"]))
    print(f"filmes no CSV: {len(rows)} | com tmdb_id: {len(with_id)} | no cache TMDB: {cached} | com descrição às cegas: {blind}")
    print(f"TMDB key: {'sim' if (TMDB_API_KEY or TMDB_READ_TOKEN) else 'NÃO'} | OMDb key: {'sim' if OMDB_API_KEY else 'NÃO'} | Wikidata: sem chave")


def main(argv=None):
    argv = argv or sys.argv[1:]
    cmds = {"resolve": cmd_resolve, "fetch": cmd_fetch, "build": cmd_build, "status": cmd_status}
    if not argv or argv[0] not in cmds:
        print(__doc__)
        return 2
    cmds[argv[0]]()
    return 0
