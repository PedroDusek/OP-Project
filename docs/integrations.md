# Integrations

External data enters the system through two interfaces and never through the
request path. After an import completes, the internal database is the
operational source of truth. No external API is called while rendering a page.

---

## 1. Status

**No external source is approved yet.** Both the catalog source and the price
source are open decisions.

Nothing in this document assumes that any particular API exists, that any
endpoint has a given shape, or that scraping any site is permitted. Before any
source is implemented, the following must be verified and recorded here:

- the documentation and the actual response shape;
- availability and stability;
- terms of service and licence;
- whether automated access is permitted at all;
- rate limits and the acceptable refresh frequency;
- attribution requirements.

If a preferred source turns out to be unusable, alternatives are presented for a
decision rather than substituted silently.

---

## 2. Catalog

Candidate sources named in the specification, in priority order, all pending
evaluation:

1. `optcg-data` and other data derived from the official Bandai source
2. Scrydex
3. anything else, only after evaluation

### 2.1 Interface

```ts
interface CatalogProvider {
  readonly name: string
  fetchSets(): Promise<SetDTO[]>
  fetchCards(): Promise<CardDTO[]>
  fetchVariants(): Promise<VariantDTO[]>
}
```

The DTOs are the normalised internal shape, not the shape of any provider. A
provider implementation is responsible for translating its own payload into
them, so a change of source does not reach the rest of the system.

### 2.2 Pipeline

```
fetch -> normalise -> validate -> upsert (transactional) -> report
```

Normalisation maps provider vocabulary onto the internal vocabulary tables.
Classifications are never invented: a value that does not map to a known
colour, trait, attribute, mechanic or effect is rejected and reported, not
guessed.

Validation rejects a record rather than importing something malformed. Rejected
records are counted and logged with the reason.

### 2.3 Idempotency

Running an import twice must not duplicate cards, variants, sets, colours,
traits, attributes, mechanics, effects or printings.

| Entity | Match key | Status |
|---|---|---|
| `cards` | `code` | unique, reliable |
| `sets` | `code` | unique, reliable |
| vocabulary tables | `name` | unique as of decision 014 |
| `variant_printings` | `(card_variant_id, set_id)` | composite primary key |
| `card_variants` | **unresolved** | see below |

### 2.4 The variant identity problem

`card_variants` has no natural key. The card code identifies the card, not the
variant, and a single card can have several distinct alternate arts that share
the same `variant_type`, so `(card_id, variant_type)` is not unique. Creating an
artificial variant number is excluded by the specification.

Consequently a second import run has no reliable way to decide whether an
incoming variant is one it already stored. Matching on image URL is fragile,
since URLs change; matching on rarity plus type collides for exactly the
alternate art case that matters.

This is the case the specification anticipates when it allows external
identifiers in the physical model. Any such identifier would:

- not replace the internal primary key;
- not be used as a public identifier;
- exist only to make synchronisation deterministic.

A concrete proposal comes at Checkpoint 3, once a real source has been evaluated
and its identifiers are known. Until then the import cannot be made idempotent
for variants, and Checkpoint 3 does not start.

### 2.5 Images

Card images are referenced by URL in `card_variants.image_url`. Whether images
may be hot linked or must be cached locally depends on the terms of the approved
source, and is decided together with it.

---

## 3. Prices

The goal is a market price for Brazil. LigaOnePiece is the preferred source when
a real integration exists, is technically available and is permitted.

None of that is established yet. No API is assumed to exist and no scraping is
assumed to be allowed. This is verified before Checkpoint 11, and alternatives
are presented if the preferred source cannot be used.

### 3.1 Interface

```ts
interface PriceProvider {
  readonly name: string
  readonly currency: string
  fetchPrices(refs: VariantRef[]): Promise<PriceDTO[]>
}
```

The abstraction exists so the source can change without touching the valuation
logic. Prices are written to `card_prices` as new rows with a `captured_at`;
existing rows are never updated, because historical trade values are resolved
from that history.

### 3.2 One provider at a time

`card_prices` has no column identifying the provider. That is sufficient while
exactly one provider is active. Supporting more than one simultaneously would
require a column, which is a change to the approved model and would be raised
before implementation.

---

## 4. Observability

Every import run logs, as structured events:

- start, with the provider name and the run identifier;
- counts of records processed, inserted, updated, rejected and failed;
- each rejection with its reason and the identifying fields of the record;
- finish, with the duration and the final counts.

Logs never contain credentials, tokens or personal data.
