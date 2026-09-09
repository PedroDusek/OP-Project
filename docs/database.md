# Banco de Dados

Motor: **PostgreSQL 17 ou superior**. Ver a observação sobre a versão instalada
em `development.md`.

O schema implementa as 24 tabelas do modelo lógico, mais as adições estruturais
aprovadas em `decisions.md` (008 token público do Trade Binder, 009 Premium e
trial, 015 exclusão de conta, 051 cotação e registro de importação). Nada além
disso é acrescentado.

As duas tabelas da decisão 051 são `exchange_rates`, que guarda a cotação do
dólar de cada dia para o preço em real não depender do câmbio de hoje, e
`price_imports`, que registra cada execução da importação — sem ela não há como
a tela dizer "atualizado hoje às 04:00", porque `card_prices` só ganha linha
quando o valor muda.

Extensões necessárias: apenas `pg_trgm`, para busca indexada por nome. Tokens são
gerados na aplicação com `crypto.randomBytes`, então `pgcrypto` é dispensável.

---

## 1. Convenções

| Aspecto | Convenção |
|---|---|
| Nomenclatura | `snake_case`, tabelas no plural, exatamente como o modelo lógico |
| Chaves primárias | `BIGSERIAL` (`bigint` + sequência) |
| Timestamps | `TIMESTAMPTZ`, nunca `timestamp` sem fuso |
| Dinheiro | `DECIMAL(12,2)`, como especifica o modelo lógico |
| Enumerações | `VARCHAR(n) + CHECK`, preservando os tipos do modelo lógico |
| Chaves estrangeiras | sempre indexadas |

Enumerações usam `VARCHAR + CHECK` em vez de enum nativo do PostgreSQL. Isso
mantém os tipos de coluna que o modelo lógico especifica e evita o custo de
alterar um tipo enum depois.

As chaves primárias são `BIGSERIAL`, e não `GENERATED ALWAYS AS IDENTITY` como
esta seção previa antes da implementação. O tipo da coluna é `bigint` nos dois
casos, como o modelo lógico exige; a diferença está em como o valor padrão é
gerado. O Prisma emite e gerencia `BIGSERIAL`, e usar identity criaria
divergência permanente entre `schema.prisma` e o banco, que toda migration
futura tentaria desfazer. A garantia extra do identity, impedir inserção
explícita de id, não compensa esse custo.

Como o modelo lógico especifica `bigint` em todos os ids, eles chegam ao
TypeScript como `BigInt`. A consequência prática é que `JSON.stringify` não
serializa `BigInt`: toda resposta de API precisa converter id para string. Isso
é tratado uma única vez na camada `http`, e não caso a caso.

---

## 2. Tabelas

### 2.1 Identidade

**users**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `name` | varchar(100) | not null |
| `email` | varchar(255) | not null, **único** |
| `auth_user_id` | varchar(64) | nulo permitido, **único** |
| `plan` | varchar(20) | not null, default `FREE`, check em (`FREE`, `PREMIUM`) |
| `trial_started_at` | timestamptz | nulo permitido |
| `premium_until` | timestamptz | nulo permitido |
| `deleted_at` | timestamptz | nulo permitido |
| `created_at` / `updated_at` | timestamptz | not null |

`plan`, `trial_started_at` e `premium_until` são a adição aprovada na decisão
009. `deleted_at` é a adição aprovada na decisão 015.

Não existe coluna de senha. A credencial vive no provedor de autenticação
(decisão 025) e nunca chega ao nosso banco; `auth_user_id` apenas amarra a conta
de lá a esta linha, que `collections`, `storage_locations` e
`trade_participants` referenciam.

O e-mail tem índice único simples. A insensibilidade a maiúsculas é obtida
normalizando o endereço para minúsculas na aplicação antes de gravar e antes de
consultar, e não por um índice funcional sobre `lower(email)`. O motivo é o
mesmo das chaves primárias: o Prisma gerencia índices e não expressa índices
funcionais, então um índice criado à mão em SQL viraria `DROP INDEX` na próxima
migration gerada.

Uma linha com `deleted_at` preenchido é uma conta anonimizada: não consegue mais
autenticar e não guarda dado pessoal, mas continua existindo para que os trades
de que participou permaneçam completos para o outro participante.

**collections**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `user_id` | bigint | not null, FK users, **único** |
| `name` | varchar(100) | not null |
| `created_at` / `updated_at` | timestamptz | not null |

A restrição de unicidade em `user_id` é o que torna o relacionamento 1:1.

### 2.2 Catálogo

**cards**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `code` | varchar(20) | not null, **único**, imutável |
| `name` | varchar(150) | not null |
| `type` | varchar(20) | not null, check em (`Leader`, `Character`, `Event`, `Stage`) |
| `cost` | int | nulo permitido |
| `power` | int | nulo permitido |
| `life` | int | nulo permitido |
| `counter` | int | nulo permitido |
| `has_trigger` | boolean | not null, default false |
| `block_icon` | varchar(20) | nulo permitido |
| `created_at` / `updated_at` | timestamptz | not null |

O tipo da carta é um atributo. Não existe tabela `card_types`. `DON!!` não faz
parte do catálogo.

`cost`, `power`, `life` e `counter` aceitam nulo porque não se aplicam a todos os
tipos de carta.

**card_variants**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `card_id` | bigint | not null, FK cards |
| `variant_type` | varchar(50) | not null |
| `rarity` | varchar(50) | nulo permitido |
| `image_url` | varchar(500) | nulo permitido |
| `created_at` / `updated_at` | timestamptz | not null |

Deliberadamente **não** existe `UNIQUE (card_id, variant_type)`: uma mesma carta
pode ter várias alternate arts distintas com o mesmo tipo de variante. Ver a
seção 6.

Raridade é atributo da variante. Não existe tabela `rarities` nem regra que
determine raridade; o valor vem da fonte.

**sets**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `code` | varchar(20) | not null, **único** |
| `name` | varchar(150) | not null |

**variant_printings**

| Coluna | Tipo | Restrições |
|---|---|---|
| `card_variant_id` | bigint | not null, FK card_variants |
| `set_id` | bigint | not null, FK sets |

A chave primária é o par `(card_variant_id, set_id)`. Sem id substituto, como no
modelo lógico. Esta tabela é a única origem da relação carta-set; o prefixo do
código nunca é usado para derivar o set.

**Tabelas de vocabulário** — `colors`, `traits`, `attributes`, `mechanics`,
`effects`

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `name` | varchar(n) | not null, **único** |

O `UNIQUE (name)` é a decisão 014 e é o que torna a importação idempotente. As
larguras seguem o modelo lógico: 50 para colors e attributes, 100 para as demais.

**Tabelas de junção** — `card_colors`, `card_traits`, `card_attributes`,
`card_mechanics`, `card_effects`

Cada uma tem `card_id` e o `<vocabulário>_id` correspondente, ambos not null,
com o par como chave primária composta. Sem id substituto.

Efeitos e mecânicas são modelados como vocabulário relacionado, não como texto
bruto do efeito.

### 2.3 Posse

**collection_items**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `collection_id` | bigint | not null, FK collections |
| `card_variant_id` | bigint | not null, FK card_variants |
| `quantity` | int | not null, check `> 0` |

`UNIQUE (collection_id, card_variant_id)`.

Quantidade zero é representada pela ausência da linha, o que mantém "cartas
únicas possuídas" como uma simples contagem de linhas.

**storage_locations**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `user_id` | bigint | not null, FK users |
| `name` | varchar(100) | not null |
| `description` | varchar(500) | nulo permitido |
| `image` | varchar(500) | nulo permitido |
| `type` | varchar(20) | not null, check em (`BINDER`, `BOX`, `DECK`) |
| `purpose` | varchar(20) | nulo permitido, check em (`COLLECTION`, `TRADE`) |
| `public_token` | varchar(64) | nulo permitido, **único** |
| `public_token_created_at` | timestamptz | nulo permitido |
| `created_at` / `updated_at` | timestamptz | not null |

`description` é a adição aprovada no Checkpoint 10: as telas 22 e 24 mostram o
campo desde a especificação e a coluna não existia. Anulável de propósito —
local sem descrição é o caso comum, e uma string vazia obrigatória daria dois
jeitos de dizer "não tem".

`image` guarda **URL**, e não bytes. O arquivo vive no Supabase Storage, num
bucket público para leitura, sob um prefixo por usuário (decisão 042).

`public_token` e `public_token_created_at` são a adição aprovada na decisão 008.
Revogar define o token como `NULL`; regerar grava outro valor aleatório.

O índice único é simples, não parcial: no PostgreSQL um índice único trata cada
`NULL` como distinto, então qualquer número de armazenamentos sem token convive
sem conflito. Um índice parcial só economizaria espaço, ao custo de sair do
controle do Prisma.

A combinação de tipo e propósito é imposta por um check de tabela:

```sql
CHECK (
  (type = 'DECK'  AND purpose IS NULL)
  OR
  (type IN ('BINDER', 'BOX') AND COALESCE(purpose, '') IN ('COLLECTION', 'TRADE'))
)
```

Isso expressa exatamente as regras de armazenamento, inclusive que uma box pode
ser de troca.

O `COALESCE` não é enfeite, e a primeira versão desta constraint estava errada
sem ele. `purpose` aceita nulo, e no SQL `NULL IN (...)` resulta em `NULL`, não
em `FALSE`. Um `CHECK` só reprova quando a expressão dá `FALSE`: diante de
`NULL` ele aprova. Sem o `COALESCE`, um `BINDER` sem propósito passava. Foram os
testes de integridade que expuseram isso.

A lição vale para toda constraint futura sobre coluna que aceita nulo: escrever
o teste que espera a rejeição é o que revela o buraco, porque a constraint
aparenta estar correta na leitura.

**collection_item_locations**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `collection_item_id` | bigint | not null, FK collection_items |
| `storage_location_id` | bigint | not null, FK storage_locations |
| `quantity` | int | not null, check `> 0` |

`UNIQUE (collection_item_id, storage_location_id)` — decisão 014.

**want_items**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `user_id` | bigint | not null, FK users |
| `card_variant_id` | bigint | not null, FK card_variants |
| `quantity` | int | not null, check `> 0` |

`UNIQUE (user_id, card_variant_id)`.

### 2.4 Preços

**card_prices**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `card_variant_id` | bigint | not null, FK card_variants |
| `value` | decimal(12,2) | not null, check `>= 0` |
| `captured_at` | timestamptz | not null |

Nome `captured_at` conforme a decisão 010. O histórico é somente-inserção; linhas
nunca são sobrescritas.

`UNIQUE (card_variant_id, captured_at)` — decisão 014. Sem ela, reexecutar a
importação de preços duplicaria o histórico, e o valor histórico de um trade
passaria a depender de qual linha a consulta escolhesse.

Esse índice único substitui o índice de consulta que existia antes sobre as
mesmas colunas em ordem decrescente: o PostgreSQL varre um btree ascendente para
trás, então ele já atende "preço mais recente desta variante". Verificado por
`EXPLAIN`, que mostra `Index Scan Backward` usando exatamente este índice.

### 2.5 Trocas

**trades**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `status` | varchar(30) | not null, check nos seis estados |
| `created_at` / `updated_at` | timestamptz | not null |
| `completed_at` | timestamptz | nulo permitido |

```sql
CHECK (status IN ('DRAFT','PROPOSED','NEGOTIATING','CONFIRMED','COMPLETED','CANCELLED'))
CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
```

O segundo check impede que `completed_at` e o status divirjam, o que importa
porque o valor histórico do trade é resolvido a partir de `completed_at`.

**trade_participants**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `trade_id` | bigint | not null, FK trades |
| `user_id` | bigint | not null, FK users |
| `role` | varchar(30) | not null |
| `confirmed_at` | timestamptz | nulo permitido |

`UNIQUE (trade_id, user_id)`.

**trade_items**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | bigint | PK |
| `trade_participant_id` | bigint | not null, FK trade_participants |
| `card_variant_id` | bigint | not null, FK card_variants |
| `quantity` | int | not null, check `> 0` |

`UNIQUE (trade_participant_id, card_variant_id)`.

A ligação pelo participante, em vez de pelo trade, é o que registra quem oferece
cada carta.

---

## 2.6 O que vive em SQL bruto e o que vive no schema

As migrations têm duas metades, e a divisão não é estética.

O Prisma **gerencia** tabelas, colunas, chaves e **índices**. Tudo isso é
declarado em `schema.prisma`, inclusive o índice GIN de trigrama e a extensão
`pg_trgm`, que o Prisma sabe expressar. Criar um índice à mão em SQL faria o
Prisma considerá-lo estranho ao modelo e emitir `DROP INDEX` na próxima
migration gerada — isso aconteceu de fato durante a implementação e foi
revertido.

O Prisma **não modela** restrições `CHECK`, funções e triggers, e por isso não
tenta removê-los. Só esses objetos ficam em SQL bruto, na migration
`constraints_and_triggers`.

A regra prática: se o Prisma sabe expressar, declare no schema; se não sabe,
escreva em SQL. Nunca as duas coisas. A CI executa uma checagem de drift que
falha caso essa fronteira seja violada.

## 3. Regras que o banco não consegue expressar

Três regras obrigatórias não são expressáveis como restrição declarativa. Cada
uma é imposta dentro de uma transação, com trigger como defesa em profundidade, e
está documentada aqui conforme exigido.

### 3.1 Alocações nunca excedem a quantidade possuída

`SUM(collection_item_locations.quantity) <= collection_items.quantity` é um
agregado entre linhas, que um `CHECK` não consegue avaliar.

Imposição: toda escrita que toca qualquer um dos lados abre uma transação, faz
`SELECT ... FOR UPDATE` na linha de `collection_items` primeiro e só então
recalcula a soma antes de gravar. Travar a linha pai serializa todas as alterações
concorrentes de alocação daquele item, de modo que duas escritas simultâneas não
podem enxergar uma soma desatualizada. Um constraint trigger em
`collection_item_locations` repete a verificação.

### 3.2 O local de armazenamento pertence ao dono da coleção

A relação atravessa três tabelas, então uma chave estrangeira simples não a
expressa.

Imposição: um trigger em `collection_item_locations` verifica que
`storage_locations.user_id` é igual ao `user_id` da coleção dona do item. A
aplicação verifica o mesmo antes de gravar, então o trigger é rede de segurança,
não o caminho principal.

Uma chave estrangeira composta expressaria isso declarativamente, mas apenas
denormalizando `user_id` em `collection_items`, o que alteraria o modelo
aprovado. O trigger evita isso.

### 3.3 No máximo um trade ativo por usuário

Ativo significa status em `PROPOSED`, `NEGOTIATING` ou `CONFIRMED`, e o status
está em `trades` enquanto o usuário está em `trade_participants`. Um índice único
parcial não atravessa duas tabelas.

Imposição: ao mover um trade para um status ativo, a transação adquire
`pg_advisory_xact_lock` para cada participante e então verifica que não existe
outro trade ativo daqueles usuários. O advisory lock é liberado com a transação e
serializa tentativas concorrentes do mesmo usuário.

A alternativa, uma flag `is_active` denormalizada em `trade_participants` com
índice único parcial, seria mais robusta mas acrescenta coluna ao modelo
aprovado.

---

## 4. Política de exclusão

Analisada relação a relação, e não aplicada uniformemente.

| Chave estrangeira | On delete | Por quê |
|---|---|---|
| `collections.user_id` | CASCADE | a coleção é dado próprio, sem sentido sem o usuário |
| `storage_locations.user_id` | CASCADE | idem |
| `want_items.user_id` | CASCADE | idem |
| `collection_items.collection_id` | CASCADE | os itens pertencem à coleção |
| `collection_item_locations.collection_item_id` | CASCADE | uma alocação não sobrevive ao item |
| `collection_item_locations.storage_location_id` | CASCADE | apagar um binder libera as alocações; as cópias permanecem na coleção |
| `card_variants.card_id` | RESTRICT | integridade do catálogo; remoção passa pelas ferramentas de importação |
| `variant_printings.card_variant_id` | CASCADE | uma impressão não tem sentido sem a variante |
| `variant_printings.set_id` | RESTRICT | um set com impressões nunca é removido silenciosamente |
| `card_<vocabulário>.card_id` | CASCADE | reconstruído a cada importação |
| `card_<vocabulário>.<vocabulário>_id` | RESTRICT | um termo em uso nunca é removido silenciosamente |
| `collection_items.card_variant_id` | RESTRICT | nunca apagar variante do catálogo que alguém possui |
| `want_items.card_variant_id` | RESTRICT | idem |
| `card_prices.card_variant_id` | RESTRICT | histórico de preço é dado de negócio |
| `trade_items.card_variant_id` | RESTRICT | idem, para o histórico de trades |
| `trade_participants.trade_id` | CASCADE | participantes pertencem ao trade |
| `trade_items.trade_participant_id` | CASCADE | itens pertencem ao participante |
| `trade_participants.user_id` | RESTRICT | protege o histórico; nunca dispara, porque contas são anonimizadas e não excluídas |

### 4.1 Exclusão de conta

Um trade sempre tem dois lados. Cascatear a exclusão de um usuário em
`trade_participants` apagaria metade de um trade concluído, destruindo histórico
que pertence tanto ao **outro** usuário quanto a quem está saindo.

Por isso contas são **anonimizadas, nunca excluídas fisicamente** (decisão 015):

1. `deleted_at` é preenchido, o que bloqueia a autenticação.
2. `name` é substituído por um placeholder e `email` por um valor não reversível
   e sem colisão, no formato `deleted+<id>@deleted.invalid`, que satisfaz o
   índice único sem reter um endereço real.
3. `auth_user_id` é limpo, o que desfaz o vínculo com a conta do provedor.
4. `plan`, `trial_started_at` e `premium_until` são limpos.
5. Coleção, locais de armazenamento e wants são removidos pelos cascades já
   existentes, já que esse dado pertence exclusivamente a quem está saindo.
6. As linhas de `trade_participants` e `trade_items` são preservadas, então o
   outro lado de cada trade permanece íntegro.

O `RESTRICT` em `trade_participants.user_id` é rede de segurança: como nenhum
caminho de código apaga fisicamente um usuário, ele nunca deveria disparar. Se
disparar, significa que existe um caminho de exclusão não intencional, e falhar
alto é o comportamento correto.

### 4.2 Exclusão de trades

Um trade `COMPLETED` nunca é excluído; é histórico. Apenas um `DRAFT` pode ser
removido. Isso é regra de aplicação, não restrição de banco.

---

## 5. Plano de índices

Guiado pelos filtros exigidos e pelo requisito de que a busca exata por código
seja rápida.

| Índice | Finalidade |
|---|---|
| `cards (code)` único | busca exata por código, a mais comum |
| `cards_name_idx` GIN `(name gin_trgm_ops)` | busca por trecho e aproximada no nome |
| `cards (type)` | filtro por tipo |
| `card_variants (card_id)` | listagem de variantes e agregação de playset |
| `card_variants (rarity)`, `card_variants (variant_type)` | filtros do catálogo |
| `variant_printings (set_id)` | navegação por set e denominador do progresso |
| `variant_printings (card_variant_id)` | busca reversa na página da carta |
| `card_<vocabulário> (<vocabulário>_id)` | filtro por cor, trait, atributo, mecânica, efeito |
| `collection_items (collection_id, card_variant_id)` único | consulta de posse e regra de unicidade |
| `collection_items (card_variant_id)` | busca reversa |
| `collection_item_locations (collection_item_id, storage_location_id)` único | consulta de alocação e regra de unicidade |
| `collection_item_locations (storage_location_id)` | listar o conteúdo de um armazenamento |
| `storage_locations (user_id)` | listar armazenamentos do usuário |
| `storage_locations (public_token)` único | busca do Trade Binder público |
| `want_items (user_id, card_variant_id)` único | consulta de want |
| `want_items (card_variant_id)` | matching, pelo lado da disponibilidade |
| `card_prices (card_variant_id, captured_at)` único | uma captura por instante; serve o preço atual varrido para trás |
| `trade_participants (trade_id, user_id)` único | consulta de participação |
| `trade_participants (user_id)` | histórico de trades e checagem de trade ativo |
| `trade_items (trade_participant_id, card_variant_id)` único | consulta de item |
| `users (lower(email))` único | autenticação |

Toda listagem de catálogo e de coleção é paginada e filtrada no servidor. O
catálogo completo nunca é carregado numa requisição.

---

## 6. Lacunas conhecidas do modelo

### 6.1 Identidade da variante

`card_variants` não tem chave natural. O código identifica a carta, não a
variante, e uma mesma carta pode ter várias alternate arts com o mesmo
`variant_type`. Criar um número de variante artificial é explicitamente proibido.

A consequência é que uma importação idempotente não consegue casar uma variante
recebida com uma linha existente usando apenas as colunas do modelo aprovado.
Isso exige um identificador fornecido pela fonte. A proposta concreta vem no
Checkpoint 3, depois que uma fonte tiver sido avaliada, e até lá é decisão
pendente.

### 6.2 Origem do preço

`card_prices` não tem coluna identificando qual provedor produziu o valor. Isso
basta enquanto exatamente um provedor estiver em uso. Se mais de um vier a ser
aprovado, distingui-los exige uma coluna, o que é alteração do modelo aprovado e
seria levantado antes de qualquer implementação.

---

## 7. Registro de divergências

Onde o modelo conceitual e o modelo lógico discordam, prevalece o lógico (decisão
012). Os PDFs em `docs/modelagem/` permanecem inalterados; esta seção é o
registro das correções.

| Tema | Modelo conceitual | Implementado |
|---|---|---|
| Localização física | `Card_Variant` ligada direto a `Storage_Location` | `collection_item_locations` liga `collection_items` a `storage_locations` |
| Itens de trade | `Trade` ligada direto a `Card_Variant` | `trade_items` liga `trade_participants` a `card_variants` |
| Senha | `password` | `password_hash` |
| Timestamp da coleção | `crated_at` (erro de digitação) | `created_at` |
| Timestamps de armazenamento | ausentes | `created_at`, `updated_at` |
| Participação em trade | apenas `role` | `role`, `confirmed_at` |
| Timestamp de preço | `data` | `captured_at` |

Cardinalidades mínimas que o modelo conceitual marca como obrigatórias são
opcionais no schema (decisão 013): uma carta pode não ter atributo, o que cartas
de Event e Stage exigem; um usuário pode não ter armazenamento nem participar de
trade algum, o que usuários recém-cadastrados exigem.
