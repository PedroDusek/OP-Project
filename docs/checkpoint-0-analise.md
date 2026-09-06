# Checkpoint 0 — Análise inicial

Data: 2026-09-06

Este documento registra a análise que precedeu qualquer implementação: leitura
integral dos dois PDFs de modelagem, inspeção do repositório, da stack, do
ambiente, e comparação entre modelo conceitual, modelo lógico e especificação.

## 1. Estado encontrado

- A pasta do projeto continha apenas os dois PDFs. Sem código, migrations, testes
  ou CI.
- Repositório Git com raiz em `C:\Users\pedro` (384 MB, 0 commits, 0 refs, índice
  vazio, sem remote e sem `.gitignore`), com `.ssh/` e `.claude.json` não
  rastreados.
- Pasta irmã `Desktop\OPTCG\` contém apenas o OPTCGSim (build Unity de
  terceiros). Sem relação com este projeto.
- Ambiente: Node 20.20.2, npm 10.8.2, Python 3.14.5, .NET 10.0.302, Git 2.54.0.
  Sem PostgreSQL, sem Docker, sem `gh`.

Resolução: ver `decisions.md` 001 a 005.

## 2. Modelo conceitual

13 entidades: User, Collection, Card, Card_Variant, Set, Card_Price, Color,
Trait, Attribute, Mechanic, Effect, Storage_Location, Trade.

Notação look-across, confirmada pelo par `Card_Variant (1,n) — Has — (1,1) Card`.

| Relacionamento | Cardinalidade | Atributo |
|---|---|---|
| User — Has — Collection | (1,1):(1,1) | — |
| User — Has — Storage_Location | (1,1):(1,n) | — |
| Collection — Contains — Card_Variant | (0,n):(0,n) | quantity |
| Card_Variant — Stored at — Storage_Location | (0,n):(0,n) | quantity |
| User — Want — Card_Variant | (0,n):(0,n) | quantity |
| User — Joins — Trade | (1,n):(1,n) | role |
| Trade — Contains — Card_Variant | (0,n):(0,n) | quantity |
| Card_Variant — Appears in — Set | (1,n):(1,n) | — |
| Card_Variant — Has — Card_Price | (1,1):(0,n) | — |
| Card — Has — Color / Trait / Attribute | (1,n):(1,n) | — |
| Card — Has — Mechanic / Effect | (1,n):(0,n) | — |

## 3. Modelo lógico

24 tabelas, exatamente as listadas na especificação. Tipos extraídos por
coordenadas do PDF; as duas páginas do arquivo são idênticas.

`variant_printings` e as cinco tabelas `card_*` de vocabulário não possuem `id`
próprio: usam chave primária composta.

## 4. Divergências entre modelo conceitual e modelo lógico

### Estruturais — o modelo lógico prevalece

1. **Localização física.** O conceitual liga `Card_Variant` diretamente a
   `Storage_Location`. O lógico liga `collection_item` a `storage_location`. O
   lógico está correto: a versão conceitual perde o vínculo com a coleção e com o
   dono, tornando impossível validar `SUM(locations) <= quantity` e
   `storage.user == collection.owner`.

2. **Itens de trade.** O conceitual liga `Trade` diretamente a `Card_Variant`. O
   lógico liga `trade_participant` a `card_variant`. O lógico está correto: a
   versão conceitual perde a informação de quem oferece cada carta.

### Menores — o modelo lógico prevalece

| Conceitual | Lógico |
|---|---|
| `User.password` | `password_hash` |
| `Collection.crated_at` (erro de digitação) | `created_at` |
| `Storage_Location` sem timestamps | `created_at` / `updated_at` |
| `Joins` apenas com `role` | `trade_participants.confirmed_at` |

### Nome do campo de data em card_prices

Conceitual: `data`. Lógico: `captured_at`. Especificação: `date`. Resolvido na
decisão 010.

### Cardinalidades mínimas do conceitual que colidem com a realidade

| Relação | Conceitual exige | Problema |
|---|---|---|
| Card — Attribute | >= 1 | Event e Stage não possuem Attribute no OPTCG |
| Card — Trait | >= 1 | Não garantido para toda carta |
| User — Storage_Location | >= 1 | Usuário recém-criado não tem armazenamento |
| User — Trade | >= 1 | Usuário recém-criado não tem trade |

O modelo lógico já trata todos esses casos como opcionais. Resolvido na decisão
013.

## 5. Ausências — exigido pela especificação, ausente nos dois modelos

| Recurso | Onde é exigido | Resolução |
|---|---|---|
| Token público do Trade Binder | rota `/trade/<token>`, revogável | decisão 008 |
| Premium e trial de 7 dias | plano e período de teste por usuário | decisão 009 |
| Identificador externo para import idempotente | importação que não duplica | pendente, Checkpoint 3 |
| Origem do preço em `card_prices` | abstração de price provider | suficiente com um provedor |

## 6. Achado crítico — identidade de card_variant

`card_variants` não pode ter `UNIQUE(card_id, variant_type)`: uma mesma carta
possui várias alternate arts distintas, todas com o mesmo `variant_type`.
Combinado com a proibição de criar `variant_number` artificial, não existe hoje
chave natural capaz de identificar uma variante de forma idempotente.

Consequência: a importação idempotente exige um identificador vindo da fonte
externa. Decisão estrutural pendente até o Checkpoint 3.

## 7. Regras derivadas confirmadas contra os testes obrigatórios

| Métrica | Definição |
|---|---|
| Total | soma de `collection_items.quantity` |
| Únicas | contagem de `card_variant_id` distintos possuídos |
| Playset | agregar variantes por `cards.id`; `soma >= 4` vale 1 playset, sempre binário, nunca `floor(soma/4)`. Leader não conta. DON!! fora do catálogo. |
| Progresso da coleção | variantes únicas possuídas / variantes únicas do catálogo |
| Progresso do set | via `variant_printings`, nunca por prefixo do código |
| Disponível para troca | soma das localizações em armazenamento com `purpose = TRADE` |
| Match | `MIN(disponível, desejado)`, sugestão, não persistida |
| Valor histórico de trade | preço vigente em `trades.completed_at`, sem snapshot |

Os dez testes obrigatórios da especificação foram conferidos contra essas
definições e todos batem.

## 8. Riscos registrados

| Risco | Severidade | Situação |
|---|---|---|
| Identidade de `card_variant` sem chave natural | Alta | aberto, Checkpoint 3 |
| Fonte de preço para o Brasil não verificada (termos e licença) | Média | aberto, Checkpoint 11 |
| `SUM(locations) <= quantity` não é expressável por `CHECK` | Média | resolvido em `database.md` seção 3.1 |
| `storage.user == collection.owner` exige FK composta ou trigger | Média | resolvido em `database.md` seção 3.2 |
| "1 trade ativo por usuário" não é expressável por `UNIQUE` direto | Média | resolvido em `database.md` seção 3.3 |
