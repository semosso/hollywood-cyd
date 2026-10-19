"""Uso:
  python -m hcyd resolve     # acha o tmdb_id dos filmes do CSV que não têm id (precisa de chave TMDB)
  python -m hcyd fetch       # baixa TMDB + OMDb + Wikidata para todos os filmes (cache em pipeline/cache)
  python -m hcyd build       # gera data/films.json e data/people.json a partir do cache + curadoria
  python -m hcyd discover [N] # acrescenta a films.csv os N filmes mais votados de cada ano (1975–2025) que ainda não estão na lista
  python -m hcyd slim        # escreve game/src/data/films.json enxuto a partir de data/films.json
  python -m hcyd status      # mostra o que já está no cache e o que falta
"""
import csv
import json
import sys
from pathlib import Path

from . import build as build_mod
from . import curation, omdb, tmdb, wikidata
from .config import CACHE_DIR, CURATION_DIR, DATA_DIR, OMDB_API_KEY, REPO_DIR, TMDB_API_KEY, TMDB_READ_TOKEN
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
    _log(f"escrito {out}. Revise as linhas 'check' e 'NOT FOUND'.")
    # adota automaticamente os ids de confiança alta em films.csv, para o fetch do mesmo run já incluí-los
    resolved = {r["title"]: r for r in csv.DictReader(open(out, encoding="utf-8"))}
    src = CURATION_DIR / "films.csv"
    raw = list(csv.DictReader(open(src, newline="", encoding="utf-8")))
    adopted = 0
    for r in raw:
        if not (r.get("tmdb_id") or "").strip():
            x = resolved.get(r["title"])
            if x and x["confidence"] == "high" and x["tmdb_id"]:
                r["tmdb_id"] = x["tmdb_id"]; adopted += 1
    with open(src, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["tmdb_id", "title", "year", "why"]); w.writeheader(); w.writerows(raw)
    _log(f"{adopted} ids adotados em films.csv")


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
        d = tmdb.director(m)
        if d:
            try:
                tmdb.person_credits(d["tmdb_id"])
                tmdb.person_credits(d["tmdb_id"], "pt-BR")
            except HttpError as e:
                _log(f"créditos do diretor falharam para {r['title']}: {e}")
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


_MOVIE_CACHE: dict[int, dict] | None = None


def _cached_movie(tmdb_id: int) -> dict | None:
    # Reaproveita o cache sem exigir chave: indexa os arquivos de movie do cache uma vez.
    global _MOVIE_CACHE
    if _MOVIE_CACHE is None:
        _MOVIE_CACHE = {}
        d = CACHE_DIR / "tmdb_movie"
        if d.exists():
            for p in d.glob("*.json"):
                data = json.loads(p.read_text(encoding="utf-8"))
                if "id" in data:
                    _MOVIE_CACHE[data["id"]] = data
    return _MOVIE_CACHE.get(tmdb_id)


def _cached_person_credits(person_id: int, ns: str = "tmdb_person_credits") -> dict | None:
    d = CACHE_DIR / ns
    if not d.exists():
        return None
    for p in d.glob("*.json"):
        data = json.loads(p.read_text(encoding="utf-8"))
        if data.get("id") == person_id:
            return data
    return None


def cmd_build():
    rows = curation.films_list()
    films, people = [], {}
    # passagem 1: coleta dados brutos e prêmios
    raw = []
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
        raw.append((r, m, awards, ratings))
    # quem já ganhou Oscar de atuação (dentro do dataset), para as descrições às cegas
    oscar_wins: dict[str, int] = {}
    for _, _, awards, _ in raw:
        for a in awards:
            if a["kind"] == "person_win" and a["family"] == "oscar" and a["acting"] and a["person"]:
                oscar_wins[a["person"]] = oscar_wins.get(a["person"], 0) + 1
    # passagem 2: monta os registros
    for r, m, awards, ratings in raw:
        d = tmdb.director(m)
        credits = _cached_person_credits(d["tmdb_id"]) if d else None
        credits_pt = _cached_person_credits(d["tmdb_id"], "tmdb_person_credits_pt_BR") if d else None
        rec = build_mod.build_film(m, ratings, awards, curation.blind_for(r["tmdb_id"]), credits, oscar_wins, credits_pt)
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
    auto = sum(1 for f in films if f.get("blind_auto"))
    _log(f"descrições às cegas: {len(films) - auto} escritas à mão, {auto} geradas automaticamente")


def cmd_discover(per_year: int = 10):
    rows = curation.films_list()
    have_ids = {r["tmdb_id"] for r in rows if r["tmdb_id"]}
    have_titles = {(r["title"].lower(), r["year"]) for r in rows}
    added = []
    for year in range(1975, 2026):
        picked = 0
        for page in (1, 2):
            if picked >= per_year:
                break
            try:
                results = tmdb.discover(year, page)
            except HttpError as e:
                _log(f"discover {year} p{page}: {e}")
                break
            for m in results:
                if picked >= per_year:
                    break
                if m["id"] in have_ids or (m["title"].lower(), year) in have_titles:
                    continue
                added.append({"tmdb_id": m["id"], "title": m["title"], "year": year, "why": "discover"})
                have_ids.add(m["id"]); picked += 1
    src = CURATION_DIR / "films.csv"
    with open(src, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["tmdb_id", "title", "year", "why"])
        for a in added:
            w.writerow(a)
    _log(f"discover: {len(added)} filmes acrescentados a films.csv ({per_year} por ano)")


SLIM_DROP = {"producers", "imdb", "tmdb_vote", "why", "shoot_days", "imdb_id"}


def cmd_slim():
    src = DATA_DIR / "films.json"
    films = json.loads(src.read_text(encoding="utf-8"))
    slim = [{k: v for k, v in f.items() if k not in SLIM_DROP and v not in (None, [], {})} for f in films]
    out = REPO_DIR / "game" / "src" / "data" / "films.json"
    out.write_text(json.dumps(slim, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    _log(f"slim: {len(slim)} filmes → {out} ({out.stat().st_size // 1024} KB)")


def cmd_status():
    rows = curation.films_list()
    with_id = [r for r in rows if r["tmdb_id"]]
    cached = sum(1 for r in with_id if _cached_movie(r["tmdb_id"]))
    blind = sum(1 for r in with_id if curation.blind_for(r["tmdb_id"]))
    print(f"filmes no CSV: {len(rows)} | com tmdb_id: {len(with_id)} | no cache TMDB: {cached} | com descrição às cegas: {blind}")
    print(f"TMDB key: {'sim' if (TMDB_API_KEY or TMDB_READ_TOKEN) else 'NÃO'} | OMDb key: {'sim' if OMDB_API_KEY else 'NÃO'} | Wikidata: sem chave")


def main(argv=None):
    argv = argv or sys.argv[1:]
    cmds = {"resolve": cmd_resolve, "fetch": cmd_fetch, "build": cmd_build, "status": cmd_status, "discover": cmd_discover, "slim": cmd_slim}
    if not argv or argv[0] not in cmds:
        print(__doc__)
        return 2
    if argv[0] == "discover":
        cmd_discover(int(argv[1]) if len(argv) > 1 else 10)
    else:
        cmds[argv[0]]()
    return 0
