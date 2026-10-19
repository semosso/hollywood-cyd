import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from hcyd import build, omdb, wikidata, tmdb  # noqa: E402

FIX = HERE / "fixtures"


def load(name):
    return json.loads((FIX / name).read_text(encoding="utf-8"))


def test_omdb_parse():
    r = omdb.parse(load("omdb_tt1285016.json"))
    assert r["rt"] == 96
    assert r["metacritic"] == 95
    assert r["imdb"] == 7.8
    assert r["box_office_usd"] == 96962694
    assert omdb.parse({"Response": "False"})["rt"] is None


def test_wikidata_parse_keeps_oscars_and_people():
    rows = wikidata.parse(load("wikidata_tt1285016.json"))
    fams = {r["family"] for r in rows}
    assert "oscar" in fams
    eis = [r for r in rows if r["person"] == "Jesse Eisenberg" and r["family"] == "oscar"]
    assert eis and eis[0]["kind"] == "person_nomination" and eis[0]["acting"]
    # prêmios de crítica regional são descartados
    assert not any("Dallas" in r["award"] for r in rows)


def test_tmdb_helpers():
    m = load("tmdb_37799.json")
    assert tmdb.pt_br_title(m) == "A Rede Social"
    assert tmdb.director(m)["name"] == "David Fincher"
    cast = tmdb.top_cast(m, 4)
    assert [c["name"] for c in cast][:2] == ["Jesse Eisenberg", "Andrew Garfield"]
    assert cast[0]["gender"] == "m"


def test_build_film_record():
    m = load("tmdb_37799.json")
    awards = wikidata.parse(load("wikidata_tt1285016.json"))
    ratings = omdb.parse(load("omdb_tt1285016.json"))
    cur = {"blind": {"hard": "x", "medium": "y", "easy": "z"}, "flags": ["f"], "trivia": ["t"]}
    rec = build.build_film(m, ratings, awards, cur)
    assert rec["tmdb_id"] == 37799 and rec["imdb_id"] == "tt1285016" and rec["year"] == 2010
    assert rec["title"]["pt"] == "A Rede Social"
    assert rec["film_awards"]["oscar_nominations"] == 8
    assert rec["film_awards"]["oscar_wins"] == 3
    assert rec["film_awards"]["best_picture"] == "nominated"
    lead = rec["roles"][0]
    assert lead["actor"] == "Jesse Eisenberg" and lead["oscar"] == "nominated" and lead["demand"] >= 4
    assert rec["roles"][1]["oscar"] == "none"
    d = rec["derived"]
    assert d["ratio"] == 5.62
    assert d["p_prize"] >= 0.6 and d["p_box"] == 0.9
    assert d["outcome"] == "hit"
    assert rec["blind"]["hard"] == "x" and rec["poster"].endswith(".jpg")


def test_build_without_optional_sources():
    m = load("tmdb_37799.json")
    rec = build.build_film(m, None, [], None)
    assert rec["rt"] is None and rec["film_awards"]["oscar_nominations"] == 0
    assert rec["roles"][0]["oscar"] == "none" and rec["roles"][0]["demand"] == 4  # Drama
    assert rec["derived"]["outcome"] == "popcorn"  # ratio alto, sem crítica conhecida


def test_blind_auto_masks_title_and_describes_director():
    m = load("tmdb_37799.json")
    awards = wikidata.parse(load("wikidata_tt1285016.json"))
    credits = load("tmdb_credits_7467.json")
    rec = build.build_film(m, None, awards, None, credits, {"Andrew Garfield": 1})
    assert rec["blind_auto"] is True
    for lvl in ("hard", "medium", "easy"):
        assert rec["blind"][lvl] and rec["blind_en"][lvl]
        assert "Social Network" not in rec["blind"][lvl]
    assert "diretor" in rec["blind"]["hard"].lower()
    assert "2 filmes" in rec["blind"]["hard"]          # Se7en e Benjamin Button antes de 2010; Gone Girl não
    assert "1995" in rec["blind"]["medium"]            # descreve o filme anterior mais votado
    assert "Se7en" not in rec["blind"]["medium"]
    assert "David Fincher" in rec["blind"]["easy"] and "David Fincher" not in rec["blind"]["medium"]
    assert "ganhou o Oscar" in rec["blind"]["medium"]   # colega de elenco premiado (mapa do dataset)
    assert "Orçamento" in rec["blind"]["hard"] and "[" not in rec["blind"]["hard"]
    # curadoria manual continua tendo prioridade
    cur = build.build_film(m, None, awards, {"blind": {"hard": "x"}}, credits, {})
    assert cur["blind_auto"] is False and cur["blind"]["hard"] == "x"
