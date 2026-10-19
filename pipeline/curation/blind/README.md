# Descrições às cegas

Um arquivo por filme, nomeado pelo `tmdb_id`: `37799.yaml`. Campos:

```yaml
title_pt: "A Rede Social"        # opcional; o TMDB costuma ter
blind:
  hard:   "Um diretor que não faz menos de 50 takes quer você num filme sobre um site. Duas horas de gente digitando e falando rápido."
  medium: "O diretor de um filme sobre um serial killer que nunca é pego, e de outro em que o protagonista envelhece ao contrário, quer você num filme sobre a criação de um site. A cena de abertura vai ter 99 takes."
  easy:   "O Fincher quer você no filme do Facebook. Roteiro do cara que escreve andando."
blind_en:                          # mesma estrutura em inglês (opcional até a v1)
  hard: "..."
flags: [roteirista_estrela, filme_de_processo]
trivia:
  - "A cena de abertura foi filmada 99 vezes."
refused_by:                        # quem recusou o papel na vida real (fato público)
  - { who: "...", role: "...", source: "https://..." }
revision:                          # só para filmes cuja reputação virou
  year: 2022
  text: "..."
  prestige_delta: 3
shoot_days: 70
```

Regras de escrita (doc, seção 11): duas frases, um fato verificável (Wikipedia, não trivia de IMDb),
uma piada, nunca o título, nunca inventar. `hard` é para Contatos 1, `medium` para Contatos 3,
`easy` para Contatos 5 (que vê o nome do diretor de qualquer jeito; o `easy` existe para o modo "carreira de exemplo").
