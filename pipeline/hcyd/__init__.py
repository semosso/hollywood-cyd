"""Pipeline de dados do Agradeço à Academia.

Baixa dados de filmes (TMDB), crítica (OMDb) e prêmios (Wikidata), junta com a
curadoria editorial (descrições às cegas) e gera os JSONs estáticos que o jogo
carrega. Tudo é cacheado em disco; nenhuma chamada acontece em runtime do jogo.
"""
__version__ = "0.1.0"
