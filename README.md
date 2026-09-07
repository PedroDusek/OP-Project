# ColeXa

Aplicação web mobile-first para gerenciar coleção do One Piece Card Game:
catálogo, coleção, armazenamento físico (binders, boxes e decks), want list,
Trade Binder, matching de trocas e preços.

Domínio: **colexa.com.br**. Marca em [`docs/marca/`](docs/marca/).

## Situação

Em construção, desenvolvido em checkpoints aprovados.

- [`docs/handoff.md`](docs/handoff.md) — **estado atual e retomada de contexto**
- [`docs/decisions.md`](docs/decisions.md) — log de decisões
- [`docs/checkpoint-0-analise.md`](docs/checkpoint-0-analise.md) — análise inicial
- [`docs/business-rules.md`](docs/business-rules.md) — regras de negócio
- [`docs/database.md`](docs/database.md) — modelo físico e restrições
- [`docs/architecture.md`](docs/architecture.md) — arquitetura, testes e Git
- [`docs/design-system.md`](docs/design-system.md) — tokens, tema, componentes e acessibilidade
- [`docs/integrations.md`](docs/integrations.md) — fontes externas
- [`docs/development.md`](docs/development.md) — como rodar localmente
- [`docs/marca/`](docs/marca/) — identidade visual

## Especificação de referência

O modelo de dados é especificado por dois documentos mantidos em
[`docs/modelagem/`](docs/modelagem/):

- `Modelo Conceitual Banco de Dados OP Project.pdf`
- `Modelo Logico OP Project.pdf`

O modelo lógico define 24 tabelas e prevalece sempre que divergir do modelo
conceitual. As divergências estão registradas em
[`docs/database.md`](docs/database.md).

## Requisitos

- Node.js 20+
- PostgreSQL 17+

## Como começar

```
cp .env.example .env    # e preencha
npm install
npm run db:deploy
npm run dev
```

Os detalhes — PostgreSQL, migrations, importação do catálogo e as duas suítes de
teste — estão em [`docs/development.md`](docs/development.md).

## Atribuição

Os dados de cartas vêm do site oficial do One Piece Card Game, da Bandai. O
ColeXa não tem vínculo, parceria ou endosso da Bandai nem de qualquer detentor
de franquia. As imagens de carta são referenciadas na origem e nunca
rearmazenadas.
