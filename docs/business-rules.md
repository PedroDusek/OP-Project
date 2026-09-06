# Business Rules

The authoritative statement of the domain rules. Every rule here is covered by an
automated test; the scenarios in section 7 map to `tests/domain`.

All of these rules are enforced on the server. The frontend is never the source
of truth for any of them.

---

## 1. Ownership model

### 1.1 Collection

Each user has exactly one collection (`collections.user_id` is unique). The
collection starts empty and represents everything the user owns.

The catalog and the collection are different concepts: a card variant may exist
in the catalog and belong to no collection at all.

### 1.2 What owning means

`collection_items.quantity` is the number of physical copies of one card variant
that the user owns. It is the single source of truth for possession.

A copy assigned to a deck, to a trade box, or to no storage at all is still
owned. Storage assignment never changes what the collection holds.

---

## 2. Counting

| Metric | Definition |
|---|---|
| **Total cards** | `SUM(collection_items.quantity)` over the collection |
| **Unique cards** | number of distinct `card_variant_id` with `quantity > 0` |
| **Closed playsets** | see 2.1 |

Normal, Alternate Art and Manga are distinct variants and count separately
towards Unique.

### 2.1 Playset

A playset is defined per **card code**, not per variant.

1. Group every owned variant by its `cards.id`.
2. Sum the quantities across all variants of that card.
3. If the sum is `>= 4`, that card contributes **exactly one** closed playset.

The result is binary per card. Eight copies of a card are still one playset; the
count is never `floor(sum / 4)`.

Cards of type `Leader` never contribute a playset. `DON!!` is out of the catalog
entirely. `Character`, `Event` and `Stage` contribute.

### 2.2 Progress

```
collection progress = distinct variants owned / distinct variants in the catalog

set progress = distinct variants owned printed in the set
               / distinct variants printed in the set
```

Both use distinct variants, never copy counts.

Set membership always comes from `variant_printings`. It is never derived from
the prefix of the card code.

A variant printed in several sets counts in the numerator **and** the denominator
of every set it appears in, so every set stays reachable at 100%. Collection
progress counts distinct variants, so nothing is double counted there.

---

## 3. Physical storage

### 3.1 Storage locations

A storage location has a `type` and a `purpose`:

| type | allowed purpose |
|---|---|
| `BINDER` | `COLLECTION` or `TRADE` |
| `BOX` | `COLLECTION` or `TRADE` |
| `DECK` | `NULL` |

A box may be a trade box. This is explicitly allowed.

A deck is a storage location of type `DECK`. There is no separate deck table, and
no deck builder, leader validation, format or banlist in this version.

### 3.2 Allocation

`collection_item_locations.quantity` records how many copies of one collection
item sit in one storage location.

The invariant is:

```
SUM(collection_item_locations.quantity) <= collection_items.quantity
```

The sum may be **less** than the owned quantity. Copies with no recorded location
are normal and expected. There is no "Unallocated" storage location.

A storage location must belong to the same user that owns the collection.

### 3.3 Reducing a quantity below what is allocated

When a user lowers `quantity` below the total already allocated, the write is
rejected atomically and the API returns a conflict carrying the current
allocations. The client presents a resolution screen where the user chooses which
locations the copies come from, and submits the resolution together with the new
quantity as a single transactional operation.

Allocations are never silently removed, and no removal order is assumed.

---

## 4. Trading

### 4.1 The four states

These are four different things and are never conflated:

| State | Meaning | Source |
|---|---|---|
| **Possessed** | the user owns it | `collection_items.quantity` |
| **Available for trade** | it sits in a storage location whose purpose is `TRADE` | sum of allocations in `TRADE` storage |
| **Committed to trade** | it is listed in one of the active trades of the user | derived from `trade_items` of trades in `PROPOSED`, `NEGOTIATING` or `CONFIRMED` |
| **Actually traded** | the trade reached `COMPLETED` | `trades.completed_at` |

Availability counts only `TRADE` purpose storage. Copies in `COLLECTION` storage
and in decks are excluded, even though they remain fully part of the collection.

### 4.2 The trade binder is not a reservation

Putting a card in a trade binder means it is available for trade. It does not
mean it is committed to anyone.

### 4.3 Matching

Matching compares the trade availability of one user against the want list of
another:

```
match quantity = MIN(trade_available, want_quantity)
```

A match is a suggestion. It creates no obligation and is not persisted.

### 4.4 Want list

Wants are per card variant. A Normal and a Manga version of the same card are two
independent wants. There is no priority and no note field in this version.

### 4.5 Trade lifecycle

```
DRAFT -> PROPOSED -> NEGOTIATING -> CONFIRMED -> COMPLETED
                                              -> CANCELLED
```

No other states exist.

- A `DRAFT` may be incomplete.
- An effective trade has exactly two participants.
- Each `trade_item` belongs to a participant, which is what identifies who offers
  which card.
- A user may hold **at most one active trade at a time**, where active means
  `PROPOSED`, `NEGOTIATING` or `CONFIRMED`. This is what prevents the same copies
  from being committed to several trades at once.
- A user may have any number of historical trades.

### 4.6 Completion

Completing a trade validates, in a single transaction:

1. exactly two participants;
2. the trade has items;
3. every offered variant is owned by the offering participant;
4. every offered quantity is actually available for trade;
5. both collections are updated;
6. allocations are updated where applicable;
7. `completed_at` is set.

If any step fails the whole transaction rolls back. A trade is never partially
completed.

---

## 5. Pricing and value

`card_prices` keeps history: one row per variant per capture, with
`captured_at`. Prices are never overwritten.

| Value | Definition |
|---|---|
| Collection value | `SUM(quantity * current market price)` |
| Set value | same, restricted to the variants printed in the set |
| Trade binder value | same, restricted to allocations in `TRADE` storage |
| Trade value | same, per side of the trade |

### 5.1 Historical trade value

The value of a completed trade reflects the price in effect at
`trades.completed_at`, resolved from `card_prices`. There is no price snapshot
column on `trade_items`.

A later price change never alters the recorded historical value of a past trade.

### 5.2 During negotiation

The UI shows both sides, the cards, the quantities, the unit prices, each total
and the difference. The value is indicative only.

---

## 6. Sharing and access

### 6.1 Public trade binder

A Premium user may publish a trade binder at `/trade/<token>`. The token is
random, non sequential, never derived from an internal id, and can be revoked and
regenerated.

The public page exposes **only** that trade binder. It never exposes the
collection, other storage locations, decks, wants, or any personal data.

### 6.2 Authorization

Every request is authorized on the server against the authenticated user. A
`user_id` supplied by the client is never trusted. A user can never read or
modify the private resources of another user.

---

## 7. Required domain tests

| # | Scenario | Expected |
|---|---|---|
| 1 | Normal x2, AA x1, Manga x1 | total 4, unique 3, playsets 1 |
| 2 | Normal x4, AA x4 | total 8, unique 2, playsets 1 |
| 3 | Leader x10 | playsets 0 |
| 4 | owns 5: binder 2, collection box 1, trade box 1, deck 1 | total 5, trade available 1 |
| 5 | storage of type `BOX` with purpose `TRADE` | valid |
| 6 | a card assigned to a deck | still counts in the collection |
| 7 | owns 4, allocations binder 3 + box 2 | rejected |
| 8 | want 2, available 5 | match 2 |
| 9 | Normal and Manga wants | independent |
| 10 | price R$100 at completion, R$150 later | historical value stays R$100 |
