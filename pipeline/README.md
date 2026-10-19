# Pipeline de dados

Gera `data/films.json` e `data/people.json` a partir de:

| Fonte | Para quê | Chave |
|---|---|---|
| **TMDB** | título, elenco (ordem, gênero), diretor, produtores, orçamento, bilheteria, pôster, título em pt-BR, imdb_id | `TMDB_API_KEY` (v3) **ou** `TMDB_READ_TOKEN` (v4) |
| **OMDb** | Rotten Tomatoes, Metacritic, IMDb rating | `OMDB_API_KEY` |
| **Wikidata** | indicações e vitórias (Oscar, Globo, BAFTA, Razzie, Cannes, SAG) do filme e de cada ator **por este filme** | nenhuma |
| `curation/` | lista de filmes, descrições às cegas, trívia, revisão histórica | editorial |

As chaves entram como variáveis de ambiente (segredos do ambiente). Nunca no código, nunca no chat.
Tudo é cacheado em `pipeline/cache/` (ignorado pelo git); as chamadas acontecem uma vez.
O jogo nunca chama API em runtime: só lê `data/*.json`.

## Rodar

```bash
cd pipeline
pip install -r requirements.txt
python -m hcyd status     # o que já tem, o que falta, quais chaves existem
python -m hcyd resolve    # acha tmdb_id para as linhas sem id em curation/films.csv (TMDB)
python -m hcyd fetch      # baixa TMDB + Wikidata (+ OMDb se houver chave)
python -m hcyd build      # escreve ../data/films.json e ../data/people.json
pytest                    # testes offline com fixtures
```

`resolve` escreve `curation/films.resolved.csv` com uma coluna `confidence`; revise as linhas
`check` e `NOT FOUND`, depois copie os ids para `films.csv`.

## Esquema de saída (um filme)

Ver `docs/BRAINSTORM.md`, seção 15.3. Campos principais: `title{original,en,pt}`, `year`, `director`,
`roles[]` (4 primeiros do elenco, com `gender`, `demand` 1–5, `oscar/razzie/globe/cannes` = none|nominated|won),
`budget`, `revenue`, `rt`, `metacritic`, `film_awards{oscar_nominations, oscar_wins, best_picture, palme_dor, razzie_nominations}`,
`poster`, `blind{hard,medium,easy}`, `trivia[]`, `refused_by[]`, `revision`, e `derived{p_prize,p_box,p_cult,p_scandal,ratio,outcome}`.

`derived` são os valores **sem ruído**; o ruído de ±15 pontos entra no jogo, por seed.

## Curadoria

- `curation/films.csv`: a lista (tmdb_id opcional, title, year, why). Janela 1975–2025.
- `curation/blind/<tmdb_id>.yaml`: descrições às cegas em três níveis, trívia, quem recusou, revisão histórica. Formato em `curation/blind/README.md`.
