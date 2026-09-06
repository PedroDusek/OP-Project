# Checkpoint 0 - Analise inicial

Data: 2026-09-06

Este documento registra a analise que precedeu qualquer implementacao: leitura
integral dos dois PDFs de modelagem, inspecao do repositorio, da stack, do
ambiente e comparacao entre modelo conceitual, modelo logico e especificacao.

## 1. Estado encontrado

- Pasta do projeto continha apenas os dois PDFs. Sem codigo, migrations, testes ou CI.
- Repositorio Git com raiz em `C:\Users\pedro` (384 MB, 0 commits, 0 refs, indice
  vazio, sem remote e sem `.gitignore`), com `.ssh/` e `.claude.json` nao rastreados.
- Pasta irma `Desktop\OPTCG\` contem apenas o OPTCGSim (build Unity de terceiros).
  Sem relacao com este projeto.
- Ambiente: Node 20.20.2, npm 10.8.2, Python 3.14.5, .NET 10.0.302, Git 2.54.0.
  Sem PostgreSQL, sem Docker, sem `gh`.

Resolucao: ver `decisions.md` 001 a 005.

## 2. Modelo conceitual

13 entidades: User, Collection, Card, Card_Variant, Set, Card_Price, Color,
Trait, Attribute, Mechanic, Effect, Storage_Location, Trade.

Notacao look-across (confirmada pelo par `Card_Variant (1,n) - Has - (1,1) Card`).

| Relacionamento | Cardinalidade | Atributo |
|---|---|---|
| User - Has - Collection | (1,1):(1,1) | - |
| User - Has - Storage_Location | (1,1):(1,n) | - |
| Collection - Contains - Card_Variant | (0,n):(0,n) | quantity |
| Card_Variant - Stored at - Storage_Location | (0,n):(0,n) | quantity |
| User - Want - Card_Variant | (0,n):(0,n) | quantity |
| User - Joins - Trade | (1,n):(1,n) | role |
| Trade - Contains - Card_Variant | (0,n):(0,n) | quantity |
| Card_Variant - Appears in - Set | (1,n):(1,n) | - |
| Card_Variant - Has - Card_Price | (1,1):(0,n) | - |
| Card - Has - Color / Trait / Attribute | (1,n):(1,n) | - |
| Card - Has - Mechanic / Effect | (1,n):(0,n) | - |

## 3. Modelo logico

24 tabelas, exatamente as listadas na especificacao. Tipos extraidos por
coordenadas do PDF (as duas paginas do arquivo sao identicas).

`variant_printings` e as cinco tabelas `card_*` de vocabulario nao possuem `id`
proprio: usam chave primaria composta.

## 4. Divergencias entre modelo conceitual e modelo logico

### Estruturais - o modelo logico prevalece

1. **Localizacao fisica.** O conceitual liga `Card_Variant` diretamente a
   `Storage_Location`. O logico liga `collection_item` a `storage_location`.
   O logico esta correto: a versao conceitual perde o vinculo com a colecao e
   com o dono, tornando impossivel validar `SUM(locations) <= quantity` e
   `storage.user == collection.owner`.

2. **Itens de trade.** O conceitual liga `Trade` diretamente a `Card_Variant`.
   O logico liga `trade_participant` a `card_variant`. O logico esta correto:
   a versao conceitual perde a informacao de quem oferece cada carta.

### Menores - o modelo logico prevalece

| Conceitual | Logico |
|---|---|
| `User.password` | `password_hash` |
| `Collection.crated_at` (erro de digitacao) | `created_at` |
| `Storage_Location` sem timestamps | `created_at` / `updated_at` |
| `Joins` apenas com `role` | `trade_participants.confirmed_at` |

### Nome do campo de data em card_prices

Conceitual: `data`. Logico: `captured_at`. Especificacao: `date`. Em aberto.

### Cardinalidades minimas do conceitual que colidem com a realidade

| Relacao | Conceitual exige | Problema |
|---|---|---|
| Card - Attribute | >= 1 | Event e Stage nao possuem Attribute no OPTCG |
| Card - Trait | >= 1 | Nao garantido para toda carta |
| User - Storage_Location | >= 1 | Usuario recem-criado nao tem storage |
| User - Trade | >= 1 | Usuario recem-criado nao tem trade |

O modelo logico ja trata todos esses casos como opcionais.

## 5. Ausencias - exigido pela especificacao, ausente nos dois modelos

| Recurso | Onde e exigido |
|---|---|
| Token publico do Trade Binder | rota `/trade/<random-token>`, revogavel |
| Premium e trial de 7 dias | plano e periodo de teste por usuario |
| Identificador externo para import idempotente | importacao que nao duplica |
| Origem do preco em `card_prices` | abstracao de price provider |

## 6. Achado critico - identidade de card_variant

`card_variants` nao pode ter `UNIQUE(card_id, variant_type)`: uma mesma carta
possui varias alternate arts distintas, todas com o mesmo `variant_type`.
Combinado com a proibicao de criar `variant_number` artificial, nao existe hoje
chave natural capaz de identificar uma variante de forma idempotente.

Consequencia: a importacao idempotente exige um identificador vindo da fonte
externa. Decisao estrutural pendente.

## 7. Regras derivadas confirmadas contra os testes obrigatorios

| Metrica | Definicao |
|---|---|
| Total | soma de `collection_items.quantity` |
| Unique | contagem de `card_variant_id` distintos possuidos |
| Playset | agregar variantes por `cards.id`; `soma >= 4` vale 1 playset, sempre binario, nunca `floor(soma/4)`. Leader nao conta. DON!! fora do catalogo. |
| Collection progress | variantes unicas possuidas / variantes unicas do catalogo |
| Set progress | via `variant_printings`, nunca por prefixo do code |
| Trade available | soma das localizacoes em storage com `purpose = TRADE` |
| Match | `MIN(trade_available, want_quantity)`, sugestao, nao persistida |
| Valor historico de trade | preco vigente em `trades.completed_at`, sem snapshot |

Os dez testes obrigatorios da especificacao foram conferidos contra essas
definicoes e todos batem.

## 8. Riscos registrados

| Risco | Severidade |
|---|---|
| Identidade de `card_variant` sem chave natural | Alta |
| Fonte de preco para o Brasil nao verificada (termos e licenca) | Media |
| `SUM(locations) <= quantity` nao e expressavel por `CHECK` | Media |
| `storage.user == collection.owner` exige FK composta ou trigger | Media |
| "1 trade ativo por usuario" nao e expressavel por `UNIQUE` direto | Media |
