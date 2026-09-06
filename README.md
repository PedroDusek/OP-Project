# OPTCG Collection Manager

Aplicação web mobile-first para gerenciar coleção do One Piece Card Game:
catálogo, coleção, armazenamento físico (binders, boxes e decks), want list,
Trade Binder, matching de trocas e preços.

## Situação

Em construção, desenvolvido em checkpoints aprovados.

- [`docs/decisions.md`](docs/decisions.md) — log de decisões
- [`docs/checkpoint-0-analise.md`](docs/checkpoint-0-analise.md) — análise inicial
- [`docs/business-rules.md`](docs/business-rules.md) — regras de negócio
- [`docs/database.md`](docs/database.md) — modelo físico e restrições
- [`docs/architecture.md`](docs/architecture.md) — arquitetura, testes e Git
- [`docs/integrations.md`](docs/integrations.md) — fontes externas
- [`docs/development.md`](docs/development.md) — como rodar localmente

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

Ainda não disponível. A aplicação é criada no Checkpoint 2.
