# Agradeço à Academia — Regras e sistema (especificação do motor)

> Este documento é o contrato do motor do jogo. Tudo que está aqui é implementável e testável sem
> interface. O `docs/BRAINSTORM.md` explica o porquê; este explica o como. Quando os dois divergirem,
> vale este. Números são ponto de partida para balanceamento, centralizados em `game/src/engine/constants.ts`.

## 1. Vocabulário

| Termo | Definição |
|---|---|
| **Run** | Uma carreira completa, da criação ao card final. Determinística dada a **seed** e as escolhas. |
| **Seed** | String. Toda aleatoriedade sai de um PRNG semeado por ela (mulberry32 sobre hash FNV-1a da seed). Mesma seed + mesmas escolhas = mesma run. |
| **Card** | Uma tela de decisão. Tipos: `projeto`, `vida`, `pessoa`, `midia`, `premiacao`, `contexto`, `destino`. |
| **Ato** | Fase da carreira (I a V), definida pela **idade**, não pelo número de cards. |
| **Resolução** | Tela que mostra o resultado de uma escolha anterior (estreia de filme, consequência de evento), antes do próximo card. |
| **Revelação** | Parte da resolução de um `projeto`: nome do filme, diretor, "no papel de", o que aconteceu com o filme, o que aconteceu com você, e o que você recusou. |
| **Medidor** | Variável oculta do estado (Fama, Prestígio, etc.). |
| **Atributo** | Variável visível, escolhida na criação (Beleza, Talento, Contatos, Carisma, Juízo). |
| **Flag** | Marcador booleano no estado (ex.: `contrato_franquia`, `culto_1`, `sobrio`). |

## 2. Criação

### 2.1 Entradas
- `nome` (string, gerado ou digitado), `genero` ∈ {`f`, `m`}, `anoEstreia` ∈ {1975, 1980, …, 2020} (dropdown de 5 em 5 anos; 2020 é o máximo para a carreira alcançar 2025), `origem`, `atributos`, `opcoes`.
- `opcoes`: `hollywoodRealista` (default **false**), `longa` (default **false**; ver 3.1), `idioma` ∈ {`pt`, `en`}. Não existe "modo realista": a morte é sempre possível.

### 2.2 Atributos
- Cinco atributos, cada um inteiro em [1, 5]. **12 pontos no total** (mínimo 1 em cada, 7 livres). Distribuição padrão da tela: 3, 3, 2, 2, 2.
- Bônus de origem são somados depois, com teto **6**, e aparecem na tela de criação ("3 +2 de origem = 5"), no HUD e no card final.
- O HUD mostra os atributos **efetivos** durante toda a run (base + bônus de origem + guinadas; Beleza já com o decaimento por idade).
- **Sorte** ∈ {1, 2, 3}, sorteada pela seed, oculta até o card final.

### 2.3 Origens
| id | bônus | estado inicial | idade |
|---|---|---|---|
| `nepo` | contatos +2 | prestigio −10, flag `sobrenome` | 20 |
| `teatro_ny` | talento +1 | prestigio +10, dinheiro −20k | 28 |
| `ex_crianca` | — | fama 25, dinheiro +2M, vicio 1, flag `pais_gastaram` | 19 |
| `modelo` | beleza +1 | flag `nao_levada_a_serio` (prestigio ganha 50% por 10 anos) | 21 |
| `influencer` (só anoEstreia ≥ 2012) | — | fama 40, heat 5, prestigio −15, flag `tweets_antigos` | 22 |
| `garcom` | +1 ponto livre no point buy | — | 22 |
| `atleta` | — | beleza efetiva +1 até 35, talento máx 1 na criação | 23 |
| `imigrante` | talento +1 | flag `sotaque` (só papéis order ≥ 2 até Fama ≥ 40) | 25 |

### 2.4 Estado inicial dos medidores
`fama 5`, `prestigio 0`, `dinheiro 5_000`, `heat 0`, `estabilidade 6`, `vicio 0`, `reputacao 0`,
`bagagem {}`, `rede []`, `pipeline []`, `idade = origem.idade`, `ano = anoEstreia`, `cardsJogados 0`,
`ultimaEstreiaEm = -99`.

## 3. Linha do tempo

### 3.1 Ritmo e número de decisões
- Ritmo normal: cada decisão avança **2 anos**. Toggle **Carreira longa** (`opcoes.longa`): **1 ano** por decisão. Isso não é dito ao jogador em anos; é só a conta interna de tempo.
- `totalCards = max(10, floor((2025 − anoEstreia) / anosPorDecisão))`. Exemplos: 1995 normal → 15; 1995 longa → 30; 1975 normal → 25; 2010 ou 2020 → 10 (o mínimo), e a carreira passa de 2025 com ofertas de fallback (o futuro não tem filmes reais).
- **Atos** são uma escala de três terços da carreira (início, meio, fim), usada pelos eventos (`atos: [1..3]`) e pelo HUD ("ato II").
- O HUD mostra "7/15".

### 3.2 Fim da run
A run termina quando acontecer o primeiro:
1. `cardsJogados == totalCards` → card final.
2. Morte → card final imediato.
3. Saída voluntária (evento `largar_tudo` aceito) → card final imediato.
4. (removido) A carreira pode passar de 2025 para cumprir o mínimo de dez decisões; a partir daí só há ofertas de fallback e o final "Carreira em andamento" fica elegível.

### 3.3 Deck: que card vem agora
Padrão por ato, repetido: `projeto, vida, projeto, X, projeto`, onde `X` é escolhido pelo estado, nesta ordem de prioridade:
1. `contexto` se existe evento histórico para o `ano` atual ainda não mostrado (greve 1988/2007/2023, #MeToo 2017, pandemia 2020, IA 2023). Anos anteriores à estreia já nascem marcados como vistos.
2. `premiacao` se há filme no `pipeline` resolvido no último ano com `derived.p_prize ≥ 0.25` ou resultado pessoal `indicado`/`ganhou`.
3. `destino` com probabilidade 0,08 por ato se ainda não houve um na run.
4. `pessoa` ou `midia`, alternando.

Em qualquer posição, antes do card, roda a **resolução** pendente (seção 6).

## 4. Card de projeto

### 4.1 Pool
Filmes de `data/films.json` com:
- `year ∈ [ano+1, ano+anosPorCard]`;
- pelo menos um `role` com `gender == genero` e `order ≤ 5`. Papéis de ator não-binário (`nb`) ficam abertos a qualquer jogador; papéis cujo gênero o TMDB desconhece ficam fora.
- não usado nesta run (nem aceito nem recusado);
- se flag `sotaque`: `order ≥ 2`; se flag `pigeonhole_comedia` e Prestígio < 30: só gêneros Comedy/Family/Romance.
- **Hollywood realista** (`hollywoodRealista` ligado, `genero == f`, `idade ≥ 45`): só filmes em que o papel tem `oscar != none` **ou** `derived.p_prize ≥ 0.4`, **ou** Fama ≥ 70. Se o pool esvaziar, entram ofertas de fallback (4.5). O jogo mostra uma linha explicando: *"Hollywood realista: a partir dos 45, só o excepcional chega até você."*

Papel escolhido no filme: o `role` elegível de menor `order`.

### 4.2 Faixa (tier) por Fama
| tier | Fama | orçamento do filme |
|---|---|---|
| 0 | < 20 | < 15M ou desconhecido |
| 1 | 20–44 | < 50M |
| 2 | 45–69 | < 120M |
| 3 | ≥ 70 | qualquer |

### 4.2b Status e cobiça (o que faz as ofertas dependerem de você)
- `status = clamp(0.5·Fama/100 + 0.5·max(0, Prestígio)/100 + 0.03·Reputação + 0.04·(Contatos − 3), 0, 1)`.
- `cobiça(filme) = min(1, 0.6·p_prize + 0.4·p_box + 0.15 se algum papel ganhou o Oscar)`.
- Peso da oferta × `desireWeight = exp(−3.5 · max(0, cobiça − status))`, com piso 0.04: um iniciante quase nunca recebe o filme de Oscar, mas a sorte existe.
- Se `cobiça − status > 0.25`, o jogador só entra no filme como **coadjuvante** (`order ≥ 2`); se o filme só tem protagonista para o seu gênero, ele não é oferecido.
- Reach: peso × `(0.5 + 0.15·Beleza_ef) × (1 + 0.15·(Contatos − 3))`.

### 4.3 Montagem das ofertas (determinística pela seed)
1. Oferta **A**: filme do tier do jogador.
2. Oferta **B**: filme do tier+1 (reach) se existir; senão do mesmo tier com `derived.outcome` diferente de A.
3. **Armadilha garantida**: em **40%** dos cards normais (`TRAP_RATE`), uma das duas ofertas é um filme que deu
   errado (`flop`/`bomb`, ou `popcorn` com crítica < 50 e sem chance de prêmio), quando houver um no pool. A
   posição (A ou B) é sorteada. Os ícones com ruído disfarçam; Juízo ≥ 3 vê a 🚩 só em bombas e sets problemáticos.
   Fora isso, preferências como pesos: gêneros diferentes, diretores diferentes, classificações diferentes.
4. Se o jogador tem `rede` com o diretor de um candidato, ele ganha peso ×3 (o diretor "te quer de novo").
   Candidatos de tier acima do jogador (reach) têm peso × `(0.5 + 0.15 × beleza_efetiva)`: Beleza abre portas acima do seu tamanho.
5. Se flag `contrato_franquia` e existe sequência (`flags` do filme contém `franquia` e mesmo `franchise_id`), ela entra como A obrigatória.

### 4.4 O que o jogador vê antes de escolher
| Sempre | gênero(s), faixa de orçamento (`$`, `$$`, `$$$`, `$$$$`), ano de estreia relativo ("estreia em 1 ano"), ícones de potencial **com ruído** |
|---|---|
| Contatos 1–2 | `blind.hard` |
| Contatos 3–4 | `blind.medium` |
| Contatos 5 | `blind.medium` + **nome do diretor** |
| Talento ≥ 3 | faixa de roteiro: `rt ≥ 75` "o texto é bom" · `40–74` "o texto é ok" · `< 40` "o texto é um pretexto" · sem dado: "ninguém leu o roteiro" |
| Juízo ≥ 3 | 🚩 se o filme tem flag `set_problematico` ou `derived.outcome == bomb` |
| Carisma ≥ 3 | até 2 linhas de `rumors[]` da curadoria, com a tag 🗞️ RUMOR; 20% das linhas marcadas `false: true` são mentira (revelado na resolução). Dica de elenco: "com alguém que ganha o Oscar por este filme" |
| Carisma ≥ 4 | **nomes** dos colegas de elenco (até 3) |

As descrições às cegas automáticas são curtas: diretor descrito só por gênero e ano do filme anterior, primeira frase da sinopse com título e **nomes de personagens** mascarados. Nomes reais (diretor, elenco) só aparecem pelos atributos acima.

**Ruído**: para cada ícone, `mostrado = clamp(p + u, 0.02, 0.95)`, com `u ~ U(−0.15, +0.15)` sorteado por `(seed, tmdb_id, ícone)`. O ruído é fixo por run (reabrir o card não re-rola).

### 4.5 Fallback (pool insuficiente)
Ofertas fictícias com dados fixos, por era: `filme_de_tv`, `filme_de_natal` (≥ 2000), `comercial_no_japao` (≤ 2012, exige Beleza efetiva ≥ 3), `serie_de_streaming` (≥ 2013), `dublagem_animacao`, `campanha_de_perfume` (exige Beleza efetiva ≥ 4; cachê alto). Cada uma tem `derived` fixo e nenhum revela nada (não há o que reconhecer). O card final lista como "projetos menores".

### 4.6 Opções
- ◀ Aceitar A · ▶ Aceitar B (uma só; a outra vira "recusada").
- ▲ **Terceira opção** (puxar para cima), exibida apenas se o requisito é atendido, senão mostra o requisito em cinza:
  - `Contatos ≥ 4`: **Fazer os dois** (ambos entram no pipeline; Estabilidade −2; cada um resolve com `talento_efetivo − 1`).
  - `Juízo ≥ 4` (só quando há 🚩): **Recusar os dois** (nada entra no pipeline; Fama −3; Prestígio +1; "você esperou").

Aceitar grava no `pipeline`: `{ tmdb_id, role, assinadoNoCard, estreiaNoCard: cardsJogados + 1, recusado: tmdb_id | null, ruido }`.

## 5. Cards de evento (`vida`, `pessoa`, `midia`, `premiacao`, `contexto`, `destino`)

Definidos em dados (`game/src/data/events/*.json`), nunca em código. Esquema:

```jsonc
{
  "id": "balada_nas_colinas",
  "tipo": "vida",
  "atos": [1, 2, 3],
  "peso": 8,
  "requer": { "heat": ">=2", "flags_ausentes": ["sobrio"] },     // condições opcionais
  "texto": { "pt": "...", "en": "..." },
  "baseado_em": [{ "quem": "John Belushi", "ano": 1982, "o_que": "...", "link": "..." }],
  "opcoes": [
    { "id": "ir", "rotulo": {"pt": "Ir"}, "resultados": [
        { "p": 0.25, "efeitos": { "contatos_evento": 1 }, "texto": {"pt": "..."} },
        { "p": 0.20, "efeitos": { "vicio": 2 }, "texto": {"pt": "..."} },
        { "p": 0.10, "efeitos": { "morte": "od" }, "texto": {"pt": "..."} }
    ]},
    { "id": "nao", "rotulo": {"pt": "Não ir"}, "efeitos": { "estabilidade": 1 } },
    { "id": "sair_cedo", "rotulo": {"pt": "Ir e sair cedo"}, "requer": { "juizo": 3 }, "efeitos": { "contatos_evento": 1 } }
  ]
}
```

Regras:
- Os `p` de um conjunto de `resultados` somam 1 (o motor renormaliza).
- **Probabilidades visíveis** só se `Juízo ≥ 3` (decisão do questionário). Abaixo disso, o card mostra só os rótulos.
- Terceira opção (`requer` de atributo) segue a mesma UI do card de projeto (puxar para cima).
- `baseado_em` aparece **na resolução**, nunca antes.
- Efeitos permitidos: qualquer medidor (`fama`, `prestigio`, `dinheiro`, `heat`, `estabilidade`, `vicio`, `reputacao`), `flag_add`, `flag_remove`, `contatos_evento` (soma a `rede` um contato fictício), `atributo` (`{"talento": 1}` permanente, teto 6), `multiplicador` (`{"p_prize": 2, "cards": 3}`), `morte` (`od`, `acidente`, `voo`), `fim` (`largar_tudo`), `demissao` (tira do `pipeline` o filme assinado mais recente: Fama −3, Heat +2, Reputação −1; a revelação não acontece).
- Sorteio de evento: entre os elegíveis para o `tipo` e o `ato`, ponderado por `peso`, excluindo os já mostrados na run (eventos com `unico: false` sempre podem repetir). Se não sobrar nenhum, repete os vistos há 5 cards ou mais (nunca `contexto` nem `destino`).
- Ofertas de fallback (4.5) não entram em `usados`: só não repetem nos 2 cards seguintes.

## 6. Resolução

### 6.1 Estreia de filme (`pipeline` com `estreiaNoCard == cardsJogados`)
Entradas: filme `f`, papel `r`, atributos efetivos, medidores, sorte, PRNG.

```
t  = talento_efetivo (talento + bônus permanentes − 1 se "fazer os dois")
d  = r.demand (1–5)
roll = U(0,1)
score = (t − d) + 0.3*sorte + 0.1*(estabilidade − 5) + (2*roll − 1) + penalidade_do_filme
penalidade_do_filme: bomb −1.0 · flop −0.6 · popcorn −0.2 · demais 0   (num filme ruim, a crítica procura culpados)

oscarScore = score + min(0.6, max(0, Prestígio)/100) + 0.3 se flag campanha_oscar − 1.0 se ganhou nos últimos 3 cards

resultado_pessoal:
  se r.oscar == "won"        e oscarScore ≥ 0.5  → "ganhou"
  se r.oscar ∈ {won,nominated} e oscarScore ≥ −0.3 → "indicado"
  se r.oscar == "none" e f.derived.outcome ∈ {hit, oscar_bait, cult} e score ≥ 1.2 → "roubou_a_cena"
  se score ≥ −1.5                             → "fez_o_trabalho"
  se (r.razzie != "none" e score < −0.5) ou (r.oscar == "none" e score < −2.5) → "razzie"
  senão                                       → "miscast"
caos: com p = 0.10, troca por outro resultado sorteado uniformemente (exceto "ganhou" se r.oscar == none).
```

Deltas (constantes em `constants.ts`):

| | hit | popcorn | oscar_bait | cult | morno | flop | bomb |
|---|---|---|---|---|---|---|---|
| Fama (× fator de billing) | +10 | +8 | +6 | +2 | +2 | −4 | −7 |
| Prestígio | +3 | −1 | +7 | +6 | 0 | −2 | −5 |
| Heat | +3 | +3 | +2 | +1 | +1 | +1 | +2 |

`morno` (recuperou o orçamento sem empolgar, crítica entre 40 e 84): move de lado; em 30% das vezes rende um contato fictício na `rede`. Não é armadilha nem conta como filme ruim.

Fator de billing por `order`: 0 → 1.0 · 1 → 0.8 · 2 → 0.6 · 3 → 0.5 · 4–5 → 0.4. Papéis elegíveis: `order ≤ 5`.

**Beleza** (efetiva, com decaimento por idade) multiplica o ganho de Fama do filme quando positivo: `0.8 + 0.1 × beleza_efetiva` (0.8× com 0, 1.0× com 2, 1.3× com 5). Não altera perdas nem Prestígio.

| resultado pessoal | Fama | Prestígio | Estabilidade | flags |
|---|---|---|---|---|
| ganhou | +10 | +15 | +1 | `oscar_won` |
| indicado | +5 | +8 | 0 | `oscar_nom` |
| roubou_a_cena | +5 | +5 | 0 | |
| fez_o_trabalho | 0 | 0 | 0 | |
| miscast | −2 | −4 | −1 | |
| razzie | +2 | −8 | −2 | `razzie` |

Cachê: `base[tier] × billing × fatorOrcamento`, com `base = [30k, 300k, 2M, 8M]` (dólares de 2020) e `fatorOrcamento = clamp(budget / 50M, 0.3, 2)`; convertido para dólares do `ano` via `data/cpi.json`. Dinheiro += cachê.

Flags do filme → estado: `franquia` → `contrato_franquia`; `tirano_genial` → Estabilidade −2 e `talento +1 permanente` (uma vez por diretor); `terror`/`acao` → com p 0.15, flag `lesao` (abre eventos de opioides).

`rede` += diretor (com `humor`: positivo se resultado ≥ fez_o_trabalho, negativo se razzie/miscast).

`ultimaEstreiaEm = cardsJogados`.

### 6.2 Revelação (conteúdo renderizado)
1. Título (`title.pt` ou `title.en`), ano, diretor, "**no papel de** {r.actor}" (e "contracenando com" os outros 3 do elenco).
2. "O que aconteceu com o filme": bilheteria e orçamento (dólares da época e de hoje), crítica (RT/Metacritic), prêmios do filme, `derived.outcome` em palavras.
3. "O que aconteceu com você": `resultado_pessoal` em uma frase com humor, deltas visíveis como ↑↓.
4. "Você recusou": o outro filme, mesma estrutura em 2 linhas, mais a frase de arrependimento ou alívio calculada pela diferença de `p_prize + p_box` (e se o papel recusado tinha `oscar == won`: *"Alguém ganhou o Oscar no seu lugar."*).
5. Se houver `refused_by[]`: "Quem recusou este papel na vida real: …".
6. Se Carisma ≥ 3 e havia rumor falso: "O rumor sobre X era mentira."
7. `trivia[]` (até 2) como rodapé.

### 6.3 Revisão histórica
Filmes com `revision` geram um card `midia` especial quando `ano ≥ revision.year` (ou no card final, se a run acabar antes), aplicando `prestige_delta` e mostrando `revision.text`.

### 6.4 Decaimento (a cada card, antes de montar o próximo)
- `heat = max(0, heat − 1)`
- se `cardsJogados − ultimaEstreiaEm ≥ 2`: `fama −= 3`
- se `vicio ≥ 5` e `estabilidade ≤ 3`: `vicio += 1`
- `beleza_efetiva = beleza − [idade ≥ 35] − [idade ≥ 45] − [idade ≥ 55] + [flag cirurgia e idade < 50] − [flag cirurgia e idade ≥ 50]`
- clamp de todos os medidores aos limites.

### 6.5 Morte
- Eventos com `morte` no resultado.
- Automático: ao final de cada card, se `vicio ≥ 7`: `p_od = 0.05 × (vicio − 6)`; se rolar, fim com causa `od`.

### 6.6 Guinadas (o randomizer)
Com baixa probabilidade, um evento **pessoal** (`vida`, `pessoa`, `midia`, `destino`) joga a carreira muito
para cima ou muito para baixo por alguns cards. É o que gera "fui numa festa e saí com um filme do
diretor X" e "briguei com a pessoa errada e passei dois anos fazendo filme de TV".

- **Gatilho**: depois de resolver o evento, `p = 0.05 + 0.02 × (sorte − 2)` (3%, 5% ou 7%).
- **Direção**: `P(positiva) = clamp(0.5 + 0.04 × (estabilidade − 5) − 0.04 × vicio, 0.25, 0.75)`.
- **Boost** (dura 2 cards): +2 em Contatos, Carisma ou Talento (sorteado), e o **próximo card de projeto é
  dourado**: ofertas só de filmes de diretor foda (`flags` `autor`/`tirano_genial`, `p_prize ≥ 0.4` ou
  ≥ 4 indicações), ignorando o tier do jogador, com o nome do diretor revelado ("ele pediu você
  pessoalmente") mesmo sem Contatos 5.
- **Queda** (dura 2 cards): −3 Contatos, −2 Juízo ou −2 Carisma (sorteado), e os cards de projeto do
  período só trazem **ofertas ruins** (`flop`/`bomb`/`popcorn` com `p_prize < 0.3`, ou fallbacks). O card
  diz "é o que sobrou".
- Modificadores somam aos atributos base para tudo: informação revelada, terceira opção, requisitos de
  opção de evento, probabilidades visíveis (Juízo) e talento na resolução. Teto 6, piso 0.
- A guinada aparece como uma resolução própria (texto + delta + duração) e como selo no HUD enquanto dura.
- Eventos podem, no futuro, declarar guinada explícita nos efeitos (ex.: o veterano generoso).

## 7. Finais

Definidos em `game/src/data/endings.json`. Esquema:

```jsonc
{
  "id": "egot",
  "categoria": "gloria",
  "raridade": 0.02,                       // peso de desempate e texto "x% terminam assim"
  "requer": { "flags": ["oscar_won"], "prestigio": ">=70" },
  "alvo": { "fama": 80, "prestigio": 90, "estabilidade": 6, "vicio": 0 },   // vetor para distância
  "titulo": { "pt": "EGOT" }, "manchete": { "pt": "..." }, "texto": { "pt": "..." }
}
```

Seleção:
1. Finais de **morte** e **saída voluntária** têm prioridade absoluta quando a causa existe.
2. Entre os demais, filtrar por `requer`.
3. Distância euclidiana normalizada entre o estado (medidores em escala 0–1) e `alvo` (só nas dimensões presentes em `alvo`).
4. Menor distância vence; empate (< 0,05) → sorteio ponderado por `1 / raridade` (raros ganham mais quando elegíveis).
5. Sempre existe um final elegível: `esquecido` não tem `requer`.

MVP: 20 finais (lista no BRAINSTORM, seção 9). Finais secretos têm `requer` restritivo e `raridade ≤ 0.01`.

## 8. Card final

Campos: nome, gênero, origem, atributos iniciais + **Sorte revelada**, anos (estreia → fim), idade, final (título + manchete + texto), **filmografia** (ano · título · "no papel de" · resultado pessoal), **3 "recusei X para fazer Y"** com maior `|Δ(p_prize + p_box)|`, prêmios, patrimônio final (dólares de hoje), causa do fim (se morte), conquistas (v2), raridade do final, **seed**, e rodapé de atribuição ao TMDB + "fan-made, sátira, não afiliado". Pôsteres do TMDB entram no card (decisão do questionário), com o logo do TMDB no rodapé.

Link de compartilhamento: `?seed=<seed>&c=<escolhas codificadas em base64url>` reproduz a run inteira; `?seed=<seed>` sozinho abre uma run nova com as mesmas ofertas ("jogue a mesma vida").

## 9. Interface (contrato com o React)

- O motor é uma função pura: `step(state, action) → { state, efeitos, proximaTela }`. Nenhum `Math.random` fora de `rng.ts`.
- Telas: `criacao` → (`resolucao`)? → `card` → … → `final`. Em qualquer momento da run, tocar no nome no HUD abre **Status e histórico**: atributos efetivos (com base, bônus e guinadas), medidores com barras, filmes em produção, filmografia até aqui, rede de diretores e o histórico de todas as decisões com seus efeitos (`state.historico`).
- Gestos no card: arrastar para a esquerda/direita aceita A/B. A direção é decidida nos primeiros 12 px: horizontal vira swipe, vertical vira rolagem nativa (`touch-action: pan-y`), porque o card é mais alto que a tela do celular e precisa rolar antes da decisão. A terceira opção é um botão (▲); o gesto "puxar para cima" foi removido por conflitar com a rolagem. **Preview durante o arrasto**: o lado de destino ganha destaque e um rótulo ("Aceitar: ◀") antes de soltar. Soltar antes de 40% da largura cancela.
- Tutorial: no primeiro card da primeira run do dispositivo, overlay com as três setas e os rótulos; some no primeiro gesto.
- Idioma: seletor na criação e no rodapé; persistido em `localStorage`.
- Tela de criação explica cada atributo em uma frase com exemplo concreto (decisão do questionário) e o toggle Hollywood realista com o texto da seção 4.1.

## 10. Testes mínimos do motor

1. Mesma seed + mesmas ações → mesmo estado final (determinismo).
2. Point buy rejeita soma ≠ 12 e valores fora de [1, 5].
3. Pool de ofertas respeita janela de anos, gênero do papel e filmes já usados.
4. Ruído fica em [−0.15, +0.15] e é estável por (seed, filme, ícone).
5. Resolução: papel com `oscar: won` e Talento 5 nunca dá `razzie` sem caos; Talento 1 em `demand 5` nunca dá `ganhou` sem caos.
6. Decaimento nunca viola limites dos medidores.
7. Hollywood realista: mulher aos 45 com Fama 30 só recebe papéis excepcionais ou fallback.
8. Sempre há um final elegível.
9. Link de compartilhamento reproduz a filmografia.
10. Guinada: com boost dourado ativo, as ofertas do próximo card de projeto são de diretores "foda"; com queda ativa, só ofertas ruins; a frequência de guinadas por evento pessoal fica entre 1% e 12%.
