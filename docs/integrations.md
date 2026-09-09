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

Em lote, e não por carta: são 4.843 variantes, e uma requisição por carta daria
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

### 3.1.1 Só arte comum

O código identifica a carta, não a arte, e o nosso catálogo só separa Normal de
Parallel (decisão 023). Entra preço na variante **Normal**; paralela fica sem, e
a tela explica por quê.

Cobertura medida: **2.692 das 2.785 cartas (96,7%)**. Para reabrir a conta:
`npx tsx scripts/cobertura-precos.ts`.

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
repositório; sem ele, termina sem erro dizendo que pulou. Falhar todo dia por
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

## 4. Observabilidade

A importação de preços registra cada execução em `price_imports`: quando
começou, quando terminou, o carimbo que a fonte publicou, os contadores e a
mensagem de erro quando falhou (decisão 051). É a única das importações com
registro persistido, e ela precisa dele por outro motivo além de observabilidade
— a tela lê dali o "atualizado hoje às 04:00".

Toda execução de importação registra, como eventos estruturados:

- início, com o nome do provedor e o identificador da execução;
- contagens de registros processados, inseridos, atualizados, rejeitados e com
  falha;
- cada rejeição com o motivo e os campos que identificam o registro;
- término, com a duração e as contagens finais.

Logs nunca contêm credenciais, tokens ou dados pessoais.
