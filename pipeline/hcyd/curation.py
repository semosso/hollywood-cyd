"""Lê a curadoria editorial: a lista de filmes e as descrições às cegas."""
import csv
from pathlib import Path

import yaml

from .config import CURATION_DIR


def films_list(path: Path | None = None) -> list[dict]:
    path = path or CURATION_DIR / "films.csv"
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if not (r.get("title") or "").strip():
                continue
            rows.append({
                "tmdb_id": int(r["tmdb_id"]) if (r.get("tmdb_id") or "").strip() else None,
                "title": r["title"].strip(),
                "year": int(r["year"]) if (r.get("year") or "").strip() else None,
                "why": (r.get("why") or "").strip(),
            })
    return rows


def blind_for(tmdb_id: int, directory: Path | None = None) -> dict | None:
    directory = directory or CURATION_DIR / "blind"
    p = directory / f"{tmdb_id}.yaml"
    if not p.exists():
        return None
    with open(p, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}
