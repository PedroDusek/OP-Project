# Integrações

Dado externo entra no sistema por duas interfaces, e nunca pelo caminho da
requisição. Concluída uma importação, o banco interno é a fonte operacional de
verdade. Nenhuma API externa é chamada durante a renderização de uma página.

---

## 1. Situação

**Catálogo: fonte aprovada** na decisão 020, com mitigações obrigatórias.
Implementado no Checkpoint 3.

**Preços: em aberto.** Nenhuma fonte de preço foi avaliada ou aprovada.

Nada neste documento presume que alguma API específica exista, que algum endpoint
tenha determinado formato, ou que raspagem de qualquer site seja permitida. Antes
de qualquer fonte ser implementada, é preciso verificar e registrar aqui:

- a documentação e o formato real da resposta;
- disponibilidade e estabilidade;
- termos de uso e licença;
- se o acesso automatizado é permitido;
- limites de taxa e a frequência aceitável de atualização;
- exigências de atribuição.

Se uma fonte preferencial se mostrar inviável, alternativas são apresentadas para
decisão, jamais substituídas silenciosamente.

---

## 2. Catálogo

### 2.0 Avaliação das fontes — 2026-09-06

Investigação concluída. Nada foi implementado.

#### O que foi verificado diretamente

A Bandai atribui **identificador estável por arte**. O código base ganha sufixo
`_pN` para cada arte paralela, e cada uma é uma imagem distinta:

```
OP01-016.png      200   185.385 bytes
OP01-016_p1.png   200   240.816 bytes
OP01-016_p2.png   200   285.621 bytes
OP01-016_p3.png   200   217.525 bytes
...
OP01-016_p9.png   200   237.361 bytes
OP01-016_p15.png  404
```

Controle negativo aplicado: `OP01-999`, `ZZ99-001` e um nome inventado retornam
404, então os 200 acima não são falso positivo do servidor.

Duas conclusões:

1. Existe a chave que faltava. `OP01-016_p3` identifica uma arte específica de
   forma estável, que é exatamente o que a importação idempotente precisa.
2. A ausência de `UNIQUE (card_id, variant_type)` estava certa. Uma única carta
   comum tem cerca de dez artes distintas; várias compartilham o mesmo tipo de
   variante.

#### Comparativo

| Fonte | Identidade por arte | Termos | Custo |
|---|---|---|---|
| Bandai, site oficial | ✅ `_pN`, verificado | reprodução proibida sem permissão | grátis |
| `Coko7/vegapull` (raspador) | herda da Bandai | GPL-3.0 no código; dados © Bandai | grátis |
| `arjunkai/optcg-api` | ✅ `base_id` + `variant_type` | acesso restrito a domínios aprovados; MIT cobre só o código, não os dados | mediante pedido |
| `optcgapi.com` | ❓ não documentado | "livre para usar", sem termos formais | grátis |
| Scrydex | ❌ variantes são array aninhado, sem id próprio | não publicados | US$ 29 a 399/mês, sem plano gratuito |

#### Por que o Scrydex não serve

O modelo de dados é incompatível. No Scrydex a carta é uma entidade e as
variantes são um array aninhado com `name`, `printings`, `images` e `prices`,
sem identificador próprio. Nosso modelo trata `card_variant` como entidade com
identidade, porque posse, want, alocação e trade apontam para a variante. Sem id
por variante, a importação não consegue casar uma alternate art com a linha que
já existe, que é justamente o problema a resolver.

#### O impedimento real

Os termos do site oficial dizem: *"All images, text and data on this website may
not be reproduced without permission."*

O acesso automatizado não é citado, e não existe `robots.txt` no domínio. Mas
importar o catálogo **é** reproduzir os dados, e isso está coberto pela cláusula.

Isso não se resolve trocando de fonte. Todas as alternativas derivam da Bandai e
nenhuma tem direito de sublicenciar esses dados — o `arjunkai/optcg-api` afirma
exatamente isso no próprio README, e por isso restringe o acesso e recomenda que
terceiros rodem o próprio pipeline.

Portanto a escolha da fonte não é técnica, é uma decisão de risco do dono do
produto, e está pendente. Nada é implementado até ela existir.

### 2.1 Fontes candidatas

1. `optcg-data` e outros dados derivados da fonte oficial Bandai
2. Scrydex
3. qualquer outra, somente após avaliação

### 2.2 Interface

```ts
interface CatalogProvider {
  readonly name: string
  fetchSets(): Promise<SetDTO[]>
  fetchCards(): Promise<CardDTO[]>
  fetchVariants(): Promise<VariantDTO[]>
}
```

Os DTOs são o formato interno normalizado, não o formato de nenhum provedor. Cada
implementação é responsável por traduzir o próprio payload para eles, de modo que
uma troca de fonte não alcance o resto do sistema.

### 2.3 Pipeline

```
buscar -> normalizar -> validar -> upsert (transacional) -> relatar
```

A normalização mapeia o vocabulário do provedor para as tabelas de vocabulário
internas. Classificações nunca são inventadas: um valor que não corresponda a uma
cor, trait, atributo, mecânica ou efeito conhecido é rejeitado e reportado, não
adivinhado.

A validação rejeita o registro em vez de importar algo malformado. Registros
rejeitados são contados e registrados em log com o motivo.

### 2.4 Idempotência

Rodar a importação duas vezes não pode duplicar cards, variants, sets, cores,
traits, atributos, mecânicas, efeitos ou printings.

| Entidade | Chave de correspondência | Situação |
|---|---|---|
| `cards` | `code` | única e confiável |
| `sets` | `code` | única e confiável |
| tabelas de vocabulário | `name` | única desde a decisão 014 |
| `variant_printings` | `(card_variant_id, set_id)` | chave primária composta |
| `card_variants` | `(source, source_id)` | decisão 019; `source_id` é o id por arte da Bandai, como `OP01-016_p3` |

### 2.5 O problema da identidade da variante

`card_variants` não tem chave natural. O código identifica a carta, não a
variante, e uma mesma carta pode ter várias alternate arts distintas com o mesmo
`variant_type`, então `(card_id, variant_type)` não é único. Criar um número de
variante artificial é proibido pela especificação.

Como consequência, uma segunda execução da importação não tem como decidir com
segurança se uma variante recebida é alguma que já foi gravada. Casar pela URL da
imagem é frágil, porque URLs mudam; casar por raridade mais tipo colide
exatamente no caso de alternate art que importa.

Este é o cenário que a especificação antecipa ao permitir identificadores
externos no modelo físico. Qualquer identificador desse tipo:

- não substitui a chave primária interna;
- não é usado como identificador público;
- existe apenas para tornar a sincronização determinística.

**Resolvido pela decisão 019.** `card_variants` ganha `source` e `source_id`,
com índice único no par. Para dados originados da Bandai, `source_id` é o id por
arte verificado na seção 2.0, como `OP01-016_p3`.

A coluna só é criada quando a fonte for aprovada, porque é ela que define o
formato de `source_id`. A migration é a primeira tarefa do Checkpoint 3.

### 2.6 Imagens

As imagens são **referenciadas na origem**, nunca copiadas nem rearmazenadas, o
que é uma das mitigações obrigatórias da decisão 020. `card_variants.image_url`
guarda a URL canônica da fonte, sem a query de cache, que não faz parte da
identidade do arquivo.

### 2.7 Implementação

| Peça | Onde | Camada |
|---|---|---|
| Tipos e vocabulário | `src/server/domain/catalog/types.ts` | domain |
| Parser HTML → DTO | `src/server/domain/catalog/parse-card-list.ts` | domain, puro |
| Provedor HTTP | `src/server/infrastructure/catalog/bandai-catalog-provider.ts` | infrastructure |
| Importação idempotente | `src/server/application/catalog/import-catalog.ts` | application |
| Busca com filtros | `src/server/application/catalog/search-cards.ts` | application |
| Execução manual | `scripts/import-catalog.ts` (`npm run catalog:import`) | — |

A extração inteira vive no parser puro, testado contra um recorte real da fonte
sem tocar a rede. O provedor só faz I/O, e é onde o rate limiting mora.

#### O que o parser precisou aprender do dado real

Três coisas que o desenho no papel não previa e que só apareceram ao olhar o
HTML:

1. **Leader reusa a `div` de custo com o rótulo `Life`.** Ler pela classe
   colocaria a vida no campo de custo em toda carta de Leader.
2. **Event e Stage trazem a `div` de atributo vazia**, com um traço. A ausência
   de atributo é real, o que confirma a decisão 013 na prática: 17 Events e 1
   Stage importados ficaram sem atributo, e 108 Characters e 6 Leaders com.
3. **Nem tudo entre colchetes é mecânica.** O texto usa colchetes também para
   nomes de personagem (`[Shanks]`, `[Edward.Newgate]`) e marcadores de custo
   (`[DON!! x2]`). Extrair todo colchete criaria uma mecânica chamada "Fossa".

#### Vocabulário de mecânicas

Por causa do item 3, mecânicas só são reconhecidas contra uma **allowlist
explícita**. O levantamento sobre o catálogo completo mediu o tamanho do risco:

| Grupo | Termos |
|---|---|
| Já aceitos pela especificação | 6 |
| Marcadores de custo (`DON!! xN`) | 3 |
| **Coincidem com nome de carta** | **195** |
| Candidatos a mecânica | 13 |

A classificação não foi por julgamento: cada termo foi cruzado contra os 1.170
nomes de carta do próprio catálogo. Sem a allowlist, o produto teria 195
mecânicas chamadas `Sanji`, `Nami` e `Upper Yard`.

A decisão 022 fixou o vocabulário em dez termos: as seis da especificação mais
os quatro gatilhos de efeito `On K.O.`, `On Block`,
`On Your Opponent's Attack` e `End of Your Turn`. `Rush: Character` é
normalizado para `Rush`.

Ficam de fora as palavras-chave de habilidade (`Double Attack`, `Banish`,
`Unblockable`), as condições de fase e turno (`Main`, `Counter`, `Your Turn`,
`Opponent's Turn`) e `Trigger`, que duplicaria `cards.has_trigger`.

#### Produtos sem código de set

A fonte cita 59 sets com código entre colchetes (`[OP-17]`, `[EB-03]`) e **131
produtos sem código nenhum**: `Tournament Pack Vol.4`,
`Premium Card Collection -Best Selection Vol.4-`, `Pre-Release OP02`,
`Anime Expo 2023`.

Esses 131 não têm código próprio, e `sets.code` é obrigatório e único. Deixá-los
de fora custava **538 variantes, 11% do catálogo, sem set nenhum** e fora do
progresso por set.

Pela decisão 024, todos entram num set agregado: `PROMO` —
`One Piece Promotion Cards`, a mesma classificação que a LigaOnePiece usa. A
composição justifica o agrupamento: 173 são cartas promo numeradas (`P-xxx`) e
as outras 365 são artes distribuídas em eventos.

O nome do produto individual não é armazenado, porque `variant_printings` é
apenas o par variante e set. Os 131 nomes ficam no relatório de importação, para
que o que foi colapsado não suma sem registro.

Na primeira versão esses produtos eram descartados **em silêncio**, o que era
pior que o problema em si.

Sobra exatamente uma variante sem set: `ST14-010_r1`, para a qual a fonte omite o
campo por completo. É lacuna da origem, não de parsing, e agora aparece no
relatório.

#### Efeitos: não implementado, e por quê

`effects` fica vazia. A especificação lista nove efeitos (`Draw Card`, `Search`,
`Reduce Cost`, `Increase Power`, `Reduce Power`, `KO`, `Rest`,
`Return to Hand`, `Trash`), mas nenhum deles aparece literalmente no dado: são
categorias semânticas que teriam de ser inferidas do texto livre da carta.

Inferir é justamente o que a especificação proíbe ao dizer para não inventar
classificações. O filtro por efeito existe no código de busca e funciona; ele
apenas não retorna nada enquanto a tabela estiver vazia. Decisão pendente.

---

## 3. Preços

Apurado e resolvido. A fonte é o **tcgcsv.com**, espelho diário do catálogo e
dos preços do TCGplayer, lido sem chave (decisões 047 e 050).

**A LigaOnePiece está fechada como fonte de dados.** Duas requisições
programáticas voltaram `403` e um navegador de verdade recebe página de
verificação anti-bot. Não há API pública, e ler preço de lá exigiria contornar
essa proteção. Dela vem só o link de saída, que é tráfego chegando e não dado
saindo.

**A API do TCGplayer também está fechada**: programa de parceiros, depreciado em
2023, sem emissão de credencial nova.

### 3.1 Interface

```ts
interface PriceProvider {
  readonly name: string
  fetchCommonArtPrices(knownNames: KnownCardNames): Promise<SourcePrice[]>
}
```

Em lote, e não por carta: são 4.431 variantes, e uma requisição por carta daria
mais de duas horas por dia contra servidor de terceiro. A fonte lê 87 arquivos.

`knownNames` é o nome que o **nosso** catálogo dá a cada código. A fonte precisa
dele para desempatar cartas cujo nome tem parênteses de verdade —
`Mr.1(Daz.Bonez)` — e a comparação é igualdade, não semelhança. Quem chama é
dono do catálogo; a fonte só compara.

A moeda não é parâmetro: `SourcePrice.currency` é `'USD'` porque é o que a fonte
cota, e a tela diz isso em voz alta.

A abstração existe para que a fonte possa mudar sem tocar na lógica de valoração.
Preços são gravados em `card_prices` como novas linhas com `captured_at`; linhas
existentes nunca são atualizadas, porque o valor histórico dos trades é resolvido
a partir desse histórico.

### 3.1.1 Arte comum por regra, paralela por vínculo

O código identifica a carta, não a arte, e o nosso catálogo só separa Normal de
Parallel (decisão 023). A arte comum é identificada por regra, sem ambiguidade
(decisão 050): **2.692 das 2.785 cartas (96,7%)**. Para reabrir a conta:
`npx tsx scripts/cobertura-precos.ts`.

A paralela depende de `variant_source_products`, que diz qual produto da fonte
é cada arte nossa (decisão 053). 478 vínculos saem por dedução — uma arte de
cada lado, sem escolha a fazer; as 351 ambíguas esperam mapeamento manual, e o
que entra à mão nunca é sobrescrito por rederivação.

O vínculo roda antes do preço, na mesma passada pela fonte.

### 3.1.2 Grava só o que mudou

Toda captura diária de todas as variantes daria 1,77 milhão de linhas por ano.
Gravar só quando o valor muda derruba isso para uma fração — e custa precisão:
a data de uma linha é a da última **mudança**, não da última verificação. Por
isso a tela escreve "desde", e nunca "atualizado em".

### 3.1.3 Execução

`npm run supabase prices` importa a cotação e os preços, nesta ordem. Roda
diariamente às **07:00 UTC — 04:00 em Brasília** pelo workflow
`.github/workflows/precos.yml`, e também à mão.

O workflow só age depois que o segredo `SUPABASE_DATABASE_URL` existir no
repositório; sem ele, termina sem erro dizendo que pulou. **O valor tem de ser a
string do Session pooler** — o host direto `db.<ref>.supabase.co` só tem
registro AAAA, e o runner do GitHub não tem rota IPv6. Falhar todo dia por
segredo ausente seria ruído, e ruído diário é o jeito mais rápido de ninguém
mais olhar para um alerta.

O horário não é arbitrário: o espelho publica às 20:00 UTC, então ler às 04:00
do dia seguinte dá folga para uma publicação atrasada sem ninguém estar usando o
produto no meio. A consequência é que o dado do mercado tem cerca de onze horas
quando chega — e a tela diz isso.

## 3.2 Câmbio

Fonte: **PTAX do Banco Central**, aberto, sem chave e sem cadastro (decisão
051). Uma requisição por dia, junto da importação de preços.

```ts
interface ExchangeRateProvider {
  readonly name: string
  fetchLatestUsdBrl(on: Date): Promise<SourceRate | null>
}
```

A **data da cotação** faz parte do contrato porque o PTAX só existe em dia útil:
numa segunda, a cotação mais recente é a de sexta. O provedor anda para trás até
cinco dias — o que cobre um fim de semana com feriado emendado dos dois lados —
e a tela mostra de que dia é o número.

Usa-se `cotacaoVenda`: quem olha o preço de uma carta americana está pensando em
comprar dólar. A alternativa considerada foi uma API comercial de cotação ao
vivo, que cobre fim de semana mas não tem compromisso de disponibilidade.

Uma linha por par por dia, e o valor é **sobrescrito** quando muda — ao
contrário de `card_prices`. O Banco Central corrige cotação publicada, e duas
verdades para o mesmo dia é o que a chave única existe para impedir.

Câmbio que falha não derruba a importação de preços: o real some da tela, o
dólar fica.

### 3.2 Um provedor por vez

`card_prices` não tem coluna identificando o provedor. Isso basta enquanto
exatamente um provedor estiver ativo. Suportar mais de um simultaneamente exigiria
uma coluna, o que é alteração do modelo aprovado e seria levantado antes de
qualquer implementação.

---

## 3.3 Os serviços externos em produção

Quem faz o quê, o que quebra sem ele, e que dado sai do ColeXa. A última coluna é
o que a Política de Privacidade precisa descrever.

| Serviço | Para quê | Sem ele | Dado que sai daqui |
|---|---|---|---|
| **Supabase** (São Paulo) | banco, autenticação e Storage (decisão 025) | o produto não funciona | tudo: conta, coleção, trocas, conversas, fotos |
| **Fly.io** (São Paulo) | hospedagem do site, uma máquina (decisão 089) | o site sai do ar; os dados ficam | o tráfego do site |
| **Cloudflare Turnstile** | CAPTCHA em entrar, criar conta e recuperar senha (decisão 088) | com o CAPTCHA ligado no painel, ninguém entra | sinais do navegador de quem entra |
| **Resend** | e-mail da denúncia e do pedido de exclusão, e o SMTP do Supabase (decisões 086 e 091) | a denúncia fica só gravada; confirmação de conta para de chegar | e-mail e nome das pessoas envolvidas |
| **Google** | login social (decisão 032) | resta entrar com e-mail e senha | e-mail e nome de quem escolhe entrar assim |
| **Bandai** | imagens das cartas, pelo nosso servidor (decisões 020 e 038) | as cartas ficam sem arte | nada nosso: só pedimos a imagem |
| **TCGplayer, via TCGCSV** | preços (decisão 047) | a tela deixa de mostrar preço | nada nosso |
| **Banco Central (PTAX)** | cotação do dólar (decisão 051) | o preço aparece só em dólar | nada nosso |
| **GitHub Actions** | preços (diário), contas a excluir (diário) e publicar (à mão) | as tarefas param; o site continua | nada além do que já está em produção |
| **Stripe** | cobrança do Premium: cartão recorrente e Pix avulso (decisão 102) | a tela diz que a assinatura não está aberta; o resto funciona | e-mail de quem assina, e o identificador da conta no ColeXa. **Cartão e Pix são digitados na Stripe: nenhum dado de pagamento passa pelo ColeXa** |

## 4. Observabilidade

A importação de preços registra cada execução em `price_imports`: quando
começou, quando terminou, o carimbo que a fonte publicou, os contadores e a
mensagem de erro quando falhou (decisão 051). `npm run supabase status` lê esse
registro — é como se confere, de fora, se o agendamento diário continua vivo. É a única das importações com
registro persistido, e ela precisa dele por outro motivo além de observabilidade
— a tela lê dali o "atualizado hoje às 04:00".

Toda execução de importação registra, como eventos estruturados:

- início, com o nome do provedor e o identificador da execução;
- contagens de registros processados, inseridos, atualizados, rejeitados e com
  falha;
- cada rejeição com o motivo e os campos que identificam o registro;
- término, com a duração e as contagens finais.

Logs nunca contêm credenciais, tokens ou dados pessoais.

## 5. Fontes por jogo: Pokémon e Magic (passo 7 do plano da decisão 104)

Levantamento feito em 20/09/2026, antes de qualquer código. A pergunta do dono
do produto foi direta: "existe base pública já com cartas, preços e variações,
sem o trabalho de vínculo um a um que o One Piece exigiu?"

**Existe, e para os dois jogos.** É a diferença mais importante entre este
trabalho e o da decisão 020.

### 5.1 Por que o One Piece foi caro, e estes não serão

No One Piece, três coisas se somaram: a fonte publica **HTML**, não dados; ela
não numera as artes paralelas; e o preço vem de **outra** fonte, que precisa ser
casada carta a carta. Daí saíram `variant_source_products`, o trabalho manual
conferido e a tabela da Liga.

Em Pokémon e Magic, **a mesma fonte entrega carta, arte, imagem, idioma e
preço**, já ligados. O vínculo — o pedaço mais caro do nosso pipeline — deixa de
existir.

### 5.2 Pokémon

| Fonte | O que entrega | Situação |
|---|---|---|
| **TCGdex** (`tcgdex.dev`) | cartas, sets, imagens, raridade, ilustrador, **variantes** (normal, reverse, holo, primeira edição), **preços** de TCGplayer (USD) e Cardmarket (EUR), **10+ idiomas** incluindo português e japonês; REST e GraphQL, sem chave | **recomendada** |
| **pokemontcg.io** | foi a referência do ecossistema | **descontinuada**: chaves funcionam até 01/03/2027, e o time migrou para o Scrydex |
| **Scrydex** | sucessora comercial da anterior | paga, a partir de US$ 29/mês |
| **tcgcsv** (categoria 3) | preços do espelho do TCGplayer, diário às 20:00 UTC | **já usamos** para One Piece; serve de segunda fonte de preço |

**Por que TCGdex**: o banco de cartas é **open source, licença MIT**
(`github.com/tcgdex/cards-database`), traz os três idiomas que a decisão 104
escolheu, e os preços vêm junto da carta. Se a API pública sair do ar, dá para
**hospedar por conta própria** a partir do repositório — o que nenhuma outra
opção oferece.

**Confirmado contra a API em 22/09**, e não só pela documentação (decisão 106):

- **220 sets, 23.964 cartas** em inglês — 8,6x o nosso One Piece.
- A carta traz `variants` (`normal`, `reverse`, `holo`, `firstEdition`,
  `wPromo`), `variants_detailed` e **`pricing` anexado**. É isso que faz o
  vínculo manual do One Piece — 773 respostas à mão, decisões 068 a 078 — **não
  se repetir aqui**.
- O tamanho foi medido antes de qualquer importação: ~100 MB de catálogo, uma
  vez, e da ordem de **1 GB por ano** de histórico de preço. O plano gratuito do
  Supabase trava em 500 MB **em modo somente leitura**, e por isso a importação
  exige o Pro. O dono do produto **adiou o Pro em 22/09** (decisão 106,
  mudança), então a fonte está escolhida e **a importação fica parada** até essa
  conta mudar.

**O que ela não documenta**, e precisa ser conferido antes de importar em
escala: **limites de requisição e termos de uso** não estão publicados no site
nem no SDK. Na prática isso significa duas coisas: perguntar no canal deles
antes de rodar a primeira importação, e manter o mesmo hábito de cortesia da
decisão 020 — requisições serializadas, importação sob demanda, nunca a cada
visita de usuário.

**O aviso legal da própria fonte**: "não é produzida, endossada, apoiada ou
afiliada à Nintendo ou à The Pokémon Company". O nosso rodapé precisa dizer o
equivalente para Pokémon, como já diz para a Bandai.

### 5.3 Magic

| Fonte | O que entrega | Situação |
|---|---|---|
| **Scryfall** (`scryfall.com/docs/api`) | texto oficial, imagens, **todos os idiomas**, preço diário por acabamento, e **download em bloco** | **recomendada** |
| **MTGJSON** | os mesmos dados mais **histórico de preço**, em arquivo de ~150 MB | complemento, se um dia quisermos histórico |

**As exigências do Scryfall são explícitas, e viram requisito nosso**:

- **`User-Agent` e `Accept` obrigatórios**, com o nome da nossa aplicação. Não
  deixar a biblioteca HTTP escolher.
- **Menos de 10 requisições por segundo**, sustentadas. Excesso responde 429 e
  pode virar bloqueio.
- **Usar o download em bloco** para importar catálogo, em vez de percorrer a API
  carta a carta.
- **Imagem tem regra própria**: as imagens são da Wizards of the Coast (e, em
  sets antigos, dos artistas). **Não se pode cobrir, cortar ou recortar o aviso
  de copyright nem o nome do artista.** Se um dia usarmos o recorte da arte, o
  nome do artista e o copyright precisam aparecer na mesma tela.

Esta última regra tem consequência de interface: a nossa grade mostra a carta
inteira, o que já atende; qualquer recorte futuro, não.

### 5.4 O que vale para os dois, e o que muda no nosso pipeline

**Continua igual**: o catálogo entra por um adaptador atrás da porta
`CatalogProvider`; preço entra por `PriceProvider`; imagem passa pelo nosso
otimizador, com cache em volume e rodízio noturno.

**Muda**:

1. **Some o vínculo manual de arte.** `variant_source_products` e a tabela da
   Liga são específicos do One Piece.
2. **A imagem vem da fonte de dados**, e não de um terceiro com cabeçalho
   hostil. Ainda assim passa pelo nosso otimizador, porque é ele que sustenta o
   cache e o tamanho.
3. **Preço já vem por variante**, o que combina com a decisão 104: reverse holo
   é variante do catálogo, não atributo da cópia.
4. **Idioma vem da fonte**, o que abre uma possibilidade que a decisão 104 não
   previu: mostrar a carta na língua que a pessoa marcou. Fica registrado como
   possibilidade, não como escopo.

### 5.5 Dois avisos honestos

- **Preço em bloco envelhece.** As duas fontes dizem, com todas as letras, que
  preço em arquivo serve para estimar valor e tendência, **não** para sustentar
  venda. Como o nosso uso é exatamente estimar o valor da coleção, serve — e a
  tela precisa continuar dizendo de quando é o dado, como já faz.
- **Tamanho.** Magic tem mais de 30 mil cartas, e com idiomas o catálogo cresce
  muito além do que o One Piece exigiu. O dashboard hoje lê o catálogo inteiro a
  cada abertura; **isso precisa ser resolvido antes** de importar Magic, não
  depois.

### 5.6 O que falta decidir, por jogo

Cada jogo precisa da sua decisão no lugar da 020, com o dono do produto:

1. Qual fonte, e o que os termos dela permitem.
2. Quais mitigações assumimos (ritmo, o que guardamos, o que nunca reexpomos).
3. Qual atribuição aparece no rodapé quando o Modo for aquele.
4. Se guardamos imagem em cache (hoje sim, com prazo) e se a fonte permite.