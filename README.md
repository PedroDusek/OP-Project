# OPTCG Collection Manager

Web app (mobile-first) for managing a One Piece Card Game collection:
catalog, collection, physical storage (binders / boxes / decks), want list,
trade binder, trade matching and pricing.

## Status

Under construction, developed in approved checkpoints.
See [`docs/decisions.md`](docs/decisions.md) for the decision log and
[`docs/checkpoint-0-analise.md`](docs/checkpoint-0-analise.md) for the initial analysis.

## Specification of record

The data model is specified by two documents kept in
[`docs/modelagem/`](docs/modelagem/):

- `Modelo Conceitual Banco de Dados OP Project.pdf`
- `Modelo Logico OP Project.pdf`

The logical model defines 24 tables and is the authoritative source whenever it
diverges from the conceptual model. Divergences are recorded in `docs/database.md`.

## Requirements

- Node.js 20+
- PostgreSQL 17+

## Getting started

Not yet available. The application is scaffolded at Checkpoint 2.
