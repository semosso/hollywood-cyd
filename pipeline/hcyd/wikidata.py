"""Wikidata: prêmios do filme e das pessoas (por obra), sem chave.

Usa a propriedade P345 (IMDb id) para achar o item do filme, e lê P1411 (indicado a)
e P166 (prêmio recebido) tanto no item do filme quanto em pessoas cujo statement
tem o qualificador P1686 (pela obra) apontando para o filme.
"""
from .config import WIKIDATA_SPARQL
from .http_cache import get_json

QUERY = """
SELECT ?film ?person ?personLabel ?award ?awardLabel ?kind ?year WHERE {
  ?film wdt:P345 "%s" .
  {
    ?film p:P1411 ?st . ?st ps:P1411 ?award . BIND("film_nomination" AS ?kind)
    OPTIONAL { ?st pq:P585 ?date . }
  } UNION {
    ?film p:P166 ?st . ?st ps:P166 ?award . BIND("film_win" AS ?kind)
    OPTIONAL { ?st pq:P585 ?date . }
  } UNION {
    ?person p:P1411 ?st . ?st ps:P1411 ?award . ?st pq:P1686 ?film . BIND("person_nomination" AS ?kind)
    OPTIONAL { ?st pq:P585 ?date . }
  } UNION {
    ?person p:P166 ?st . ?st ps:P166 ?award . ?st pq:P1686 ?film . BIND("person_win" AS ?kind)
    OPTIONAL { ?st pq:P585 ?date . }
  }
  BIND(YEAR(?date) AS ?year)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
"""

# Famílias de prêmio que o jogo usa. O resto é descartado no build.
FAMILIES = {
    "oscar": "Academy Award",
    "globe": "Golden Globe Award",
    "bafta": "BAFTA Award",
    "razzie": "Golden Raspberry Award",
    "cannes": "Palme d'Or",
    "cannes_actor": "Cannes Film Festival Award for Best Act",
    "sag": "Screen Actors Guild Award",
}
ACTING_WORDS = ("Best Actor", "Best Actress", "Supporting Actor", "Supporting Actress",
                "Best Act", "Worst Actor", "Worst Actress", "Worst Supporting")


def fetch(imdb_id: str) -> list[dict]:
    data = get_json(WIKIDATA_SPARQL, {"query": QUERY % imdb_id, "format": "json"},
                    namespace="wikidata", ttl_days=60)
    return parse(data)


def parse(data: dict) -> list[dict]:
    rows = []
    for b in data.get("results", {}).get("bindings", []):
        label = b.get("awardLabel", {}).get("value", "")
        fam = family(label)
        if not fam:
            continue
        rows.append({
            "kind": b["kind"]["value"],                      # film_nomination | film_win | person_nomination | person_win
            "person": b.get("personLabel", {}).get("value") or None,
            "person_qid": (b.get("person", {}).get("value") or "").rsplit("/", 1)[-1] or None,
            "award": label,
            "family": fam,
            "acting": any(w in label for w in ACTING_WORDS),
            "year": int(b["year"]["value"]) if b.get("year") else None,
        })
    # dedupe
    seen, out = set(), []
    for r in rows:
        k = (r["kind"], r["person"], r["award"])
        if k not in seen:
            seen.add(k)
            out.append(r)
    return out


def family(label: str) -> str | None:
    for fam, prefix in FAMILIES.items():
        if label.startswith(prefix):
            return fam
    return None
