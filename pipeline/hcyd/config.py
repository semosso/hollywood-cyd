import os
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = PIPELINE_DIR.parent
CACHE_DIR = Path(os.environ.get("HCYD_CACHE_DIR", PIPELINE_DIR / "cache"))
CURATION_DIR = PIPELINE_DIR / "curation"
DATA_DIR = REPO_DIR / "data"

# Chaves. Nunca coladas no chat: entram como segredo do ambiente ou variável.
TMDB_API_KEY = os.environ.get("TMDB_API_KEY")          # chave v3
TMDB_READ_TOKEN = os.environ.get("TMDB_READ_TOKEN")    # token v4 (alternativa)
OMDB_API_KEY = os.environ.get("OMDB_API_KEY")

TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMG = "https://image.tmdb.org/t/p"
OMDB_BASE = "https://www.omdbapi.com/"
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
USER_AGENT = "agradeco-a-academia-pipeline/0.1 (fan-made game; github.com/semosso/hollywood-cyd)"

# Janela de dados decidida no questionário: 1975 a 2025.
YEAR_MIN = 1975
YEAR_MAX = 2025
