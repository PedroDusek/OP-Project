# Database

Target engine: **PostgreSQL 17**.

The schema implements the 24 tables of the logical model, plus the structural
additions approved in `decisions.md` (008 public trade binder token, 009 Premium
and trial). Nothing else is added.

Extensions required: `pg_trgm` only, for indexed name search. Tokens are
generated in the application with `crypto.randomBytes`, so `pgcrypto` is not
needed.

---

## 1. Conventions

| Aspect | Convention |
|---|---|
| Naming | `snake_case`, plural table names, exactly as the logical model |
| Primary keys | `BIGINT GENERATED ALWAYS AS IDENTITY` |
| Timestamps | `TIMESTAMPTZ`, never naive `timestamp` |
| Money | `DECIMAL(12,2)` as specified in the logical model |
| Enumerations | `VARCHAR(n) + CHECK`, preserving the logical model types |
| Foreign keys | always indexed |

Enumerations are modelled as `VARCHAR + CHECK` rather than native PostgreSQL
enums. This keeps the column types the logical model specifies and avoids the
migration cost of altering an enum type later.

---

## 2. Tables

### 2.1 Identity

**users**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `name` | varchar(100) | not null |
| `email` | varchar(255) | not null, **unique** |
| `password_hash` | varchar(255) | not null |
| `plan` | varchar(20) | not null, default `FREE`, check in (`FREE`, `PREMIUM`) |
| `trial_started_at` | timestamptz | nullable |
| `premium_until` | timestamptz | nullable |
| `deleted_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | not null |

`plan`, `trial_started_at` and `premium_until` are the approved addition for
decision 009. `deleted_at` is the approved addition for decision 015. Password is
never stored in plain text.

A row with `deleted_at` set is an anonymised account: it can no longer sign in
and holds no personal data, but it still exists so that the trades it took part
in remain complete for the other participant.

Email uniqueness is enforced case-insensitively by a unique index on
`lower(email)`, since addresses that differ only in case are the same account.

**collections**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `user_id` | bigint | not null, FK users, **unique** |
| `name` | varchar(100) | not null |
| `created_at` / `updated_at` | timestamptz | not null |

The unique constraint on `user_id` is what makes the relationship 1:1.

### 2.2 Catalog

**cards**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `code` | varchar(20) | not null, **unique**, immutable |
| `name` | varchar(150) | not null |
| `type` | varchar(20) | not null, check in (`Leader`, `Character`, `Event`, `Stage`) |
| `cost` | int | nullable |
| `power` | int | nullable |
| `life` | int | nullable |
| `counter` | int | nullable |
| `has_trigger` | boolean | not null, default false |
| `block_icon` | varchar(20) | nullable |
| `created_at` / `updated_at` | timestamptz | not null |

Card type is an attribute. There is no `card_types` table. `DON!!` is not part of
the catalog.

`cost`, `power`, `life` and `counter` are nullable because they do not apply to
every card type.

**card_variants**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `card_id` | bigint | not null, FK cards |
| `variant_type` | varchar(50) | not null |
| `rarity` | varchar(50) | nullable |
| `image_url` | varchar(500) | nullable |
| `created_at` / `updated_at` | timestamptz | not null |

There is deliberately **no** `UNIQUE (card_id, variant_type)`: one card can have
several distinct alternate arts that share the same variant type. See section 6.

Rarity is an attribute of the variant. There is no `rarities` table and no rule
that derives rarity; the value comes from the source.

**sets**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `code` | varchar(20) | not null, **unique** |
| `name` | varchar(150) | not null |

**variant_printings**

| Column | Type | Constraints |
|---|---|---|
| `card_variant_id` | bigint | not null, FK card_variants |
| `set_id` | bigint | not null, FK sets |

Primary key is the composite `(card_variant_id, set_id)`. No surrogate id, as in
the logical model. This table is the only source of set membership; the card code
prefix is never used to derive a set.

**Vocabulary tables** - `colors`, `traits`, `attributes`, `mechanics`, `effects`

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `name` | varchar(n) | not null, **unique** |

The `UNIQUE (name)` is decision 014 and is what makes the import idempotent.
Widths follow the logical model: 50 for colors and attributes, 100 for the rest.

**Join tables** - `card_colors`, `card_traits`, `card_attributes`,
`card_mechanics`, `card_effects`

Each has `card_id` and the matching `<vocabulary>_id`, both not null, with the
pair as the composite primary key. No surrogate id.

Effects and mechanics are modelled as related vocabulary, not as raw effect text.

### 2.3 Possession

**collection_items**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `collection_id` | bigint | not null, FK collections |
| `card_variant_id` | bigint | not null, FK card_variants |
| `quantity` | int | not null, check `> 0` |

`UNIQUE (collection_id, card_variant_id)`.

A quantity of zero is represented by the absence of the row, which keeps
"unique cards owned" a simple row count.

**storage_locations**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `user_id` | bigint | not null, FK users |
| `name` | varchar(100) | not null |
| `image` | varchar(500) | nullable |
| `type` | varchar(20) | not null, check in (`BINDER`, `BOX`, `DECK`) |
| `purpose` | varchar(20) | nullable, check in (`COLLECTION`, `TRADE`) |
| `public_token` | varchar(64) | nullable, **unique** |
| `public_token_created_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | not null |

`public_token` and `public_token_created_at` are the approved addition for
decision 008. Revoking sets the token to `NULL`; regenerating writes a new random
value. The unique index is partial (`WHERE public_token IS NOT NULL`).

The type and purpose combination is enforced by a table level check:

```sql
CHECK (
  (type = 'DECK'  AND purpose IS NULL)
  OR
  (type IN ('BINDER', 'BOX') AND purpose IN ('COLLECTION', 'TRADE'))
)
```

This expresses the storage rules exactly, including that a box may be a trade
box.

**collection_item_locations**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `collection_item_id` | bigint | not null, FK collection_items |
| `storage_location_id` | bigint | not null, FK storage_locations |
| `quantity` | int | not null, check `> 0` |

`UNIQUE (collection_item_id, storage_location_id)` - decision 014.

**want_items**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `user_id` | bigint | not null, FK users |
| `card_variant_id` | bigint | not null, FK card_variants |
| `quantity` | int | not null, check `> 0` |

`UNIQUE (user_id, card_variant_id)`.

### 2.4 Pricing

**card_prices**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `card_variant_id` | bigint | not null, FK card_variants |
| `value` | decimal(12,2) | not null, check `>= 0` |
| `captured_at` | timestamptz | not null |

Named `captured_at` per decision 010. History is append only; rows are never
overwritten.

### 2.5 Trading

**trades**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `status` | varchar(30) | not null, check in the six states |
| `created_at` / `updated_at` | timestamptz | not null |
| `completed_at` | timestamptz | nullable |

```sql
CHECK (status IN ('DRAFT','PROPOSED','NEGOTIATING','CONFIRMED','COMPLETED','CANCELLED'))
CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
```

The second check keeps `completed_at` and the status from drifting apart, which
matters because historical trade value is resolved from `completed_at`.

**trade_participants**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `trade_id` | bigint | not null, FK trades |
| `user_id` | bigint | not null, FK users |
| `role` | varchar(30) | not null |
| `confirmed_at` | timestamptz | nullable |

`UNIQUE (trade_id, user_id)`.

**trade_items**

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK |
| `trade_participant_id` | bigint | not null, FK trade_participants |
| `card_variant_id` | bigint | not null, FK card_variants |
| `quantity` | int | not null, check `> 0` |

`UNIQUE (trade_participant_id, card_variant_id)`.

The link through the participant, rather than through the trade, is what records
who offers each card.

---

## 3. Rules the database cannot express

Three required rules are not expressible as a declarative constraint. Each is
enforced inside a transaction, with a trigger as defence in depth, and is
documented here as required.

### 3.1 Allocations never exceed the owned quantity

`SUM(collection_item_locations.quantity) <= collection_items.quantity` is an
aggregate across rows, which a `CHECK` cannot evaluate.

Enforcement: every write that touches either side opens a transaction, takes
`SELECT ... FOR UPDATE` on the `collection_items` row first, then recomputes the
sum before writing. Locking the parent row serialises all concurrent allocation
changes for that item, so two simultaneous writes cannot both observe a stale
sum. A constraint trigger on `collection_item_locations` repeats the check.

### 3.2 The storage location belongs to the collection owner

The relationship spans three tables, so a plain foreign key cannot express it.

Enforcement: a trigger on `collection_item_locations` verifies that
`storage_locations.user_id` equals the `user_id` of the collection that owns the
collection item. The application checks the same thing before writing, so the
trigger is a backstop rather than the primary path.

A composite foreign key could express this declaratively, but only by
denormalising `user_id` onto `collection_items`, which would change the approved
model. The trigger avoids that.

### 3.3 At most one active trade per user

Active means status in `PROPOSED`, `NEGOTIATING` or `CONFIRMED`, and the status
lives on `trades` while the user lives on `trade_participants`. A partial unique
index cannot span the two tables.

Enforcement: transitioning a trade into an active status takes
`pg_advisory_xact_lock` keyed on each participant id, then verifies that no other
active trade exists for those users. The advisory lock is released with the
transaction and serialises concurrent attempts for the same user.

The alternative, a denormalised `is_active` flag on `trade_participants` with a
partial unique index, would be more robust but adds a column to the approved
model.

---

## 4. Delete policy

Analysed relation by relation rather than applied uniformly.

| Foreign key | On delete | Why |
|---|---|---|
| `collections.user_id` | CASCADE | the collection is owned data with no meaning without its user |
| `storage_locations.user_id` | CASCADE | same |
| `want_items.user_id` | CASCADE | same |
| `collection_items.collection_id` | CASCADE | items belong to the collection |
| `collection_item_locations.collection_item_id` | CASCADE | an allocation cannot outlive its item |
| `collection_item_locations.storage_location_id` | CASCADE | deleting a binder frees its allocations; the copies stay in the collection |
| `card_variants.card_id` | RESTRICT | catalog integrity; removal goes through import tooling |
| `variant_printings.card_variant_id` | CASCADE | a printing has no meaning without its variant |
| `variant_printings.set_id` | RESTRICT | a set with printings is never silently removed |
| `card_<vocabulary>.card_id` | CASCADE | rebuilt on every import |
| `card_<vocabulary>.<vocabulary>_id` | RESTRICT | a vocabulary term in use is never silently removed |
| `collection_items.card_variant_id` | RESTRICT | never delete a catalog variant somebody owns |
| `want_items.card_variant_id` | RESTRICT | same |
| `card_prices.card_variant_id` | RESTRICT | price history is business data |
| `trade_items.card_variant_id` | RESTRICT | same, for trade history |
| `trade_participants.trade_id` | CASCADE | participants belong to the trade |
| `trade_items.trade_participant_id` | CASCADE | items belong to the participant |
| `trade_participants.user_id` | RESTRICT | protects trade history; never fires, because accounts are anonymised rather than deleted |

### 4.1 Deleting a user account

A trade always has two sides. Cascading a user deletion into
`trade_participants` would delete half of a completed trade, destroying history
that belongs to the **other** user as much as to the one leaving.

Accounts are therefore **anonymised, never hard deleted** (decision 015):

1. `deleted_at` is set, which blocks sign in.
2. `name` is replaced with a placeholder and `email` with a non reversible,
   collision free value of the form `deleted+<id>@deleted.invalid`, which keeps
   the unique index satisfied without retaining a real address.
3. `password_hash` is replaced with a value no password can produce.
4. `plan`, `trial_started_at` and `premium_until` are cleared.
5. The collection, storage locations and want items are deleted through their
   existing cascades, since that data belongs solely to the departing user.
6. `trade_participants` and `trade_items` rows are kept, so the other side of
   every trade stays intact.

The `RESTRICT` on `trade_participants.user_id` is a backstop: since no code path
hard deletes a user row, it should never fire. If it ever does, it means an
unintended deletion path exists, and failing loudly is the correct outcome.

### 4.2 Deleting trades

A `COMPLETED` trade is never deleted; it is history. Only a `DRAFT` may be
removed. This is an application rule, not a database constraint.

---

## 5. Index plan

Driven by the required filters and by the requirement that exact code lookup be
fast.

| Index | Purpose |
|---|---|
| `cards (code)` unique | exact code lookup, the most common search |
| `cards USING gin (name gin_trgm_ops)` | substring and fuzzy name search |
| `cards (type)` | type filter |
| `card_variants (card_id)` | variant listing and playset aggregation |
| `card_variants (rarity)`, `card_variants (variant_type)` | catalog filters |
| `variant_printings (set_id)` | set browsing and set progress denominator |
| `variant_printings (card_variant_id)` | reverse lookup on the card page |
| `card_<vocabulary> (<vocabulary>_id)` | filtering by color, trait, attribute, mechanic, effect |
| `collection_items (collection_id, card_variant_id)` unique | possession lookup and the uniqueness rule |
| `collection_items (card_variant_id)` | reverse lookup |
| `collection_item_locations (collection_item_id, storage_location_id)` unique | allocation lookup and the uniqueness rule |
| `collection_item_locations (storage_location_id)` | listing the contents of a storage location |
| `storage_locations (user_id)` | listing user storage |
| `storage_locations (public_token)` unique partial | public trade binder lookup |
| `want_items (user_id, card_variant_id)` unique | want lookup |
| `want_items (card_variant_id)` | matching, from the availability side |
| `card_prices (card_variant_id, captured_at DESC)` | current price and historical resolution |
| `trade_participants (trade_id, user_id)` unique | participation lookup |
| `trade_participants (user_id)` | trade history of a user, active trade check |
| `trade_items (trade_participant_id, card_variant_id)` unique | item lookup |
| `users (lower(email))` unique | login |

Every catalog and collection listing is paginated and filtered on the server. The
full catalog is never loaded in a request.

---

## 6. Known model gaps

### 6.1 Variant identity

`card_variants` has no natural key. The card code identifies the card, not the
variant, and one card can have several alternate arts with the same
`variant_type`. Creating an artificial variant number is explicitly excluded.

The consequence is that an idempotent import cannot match an incoming variant to
an existing row using only the columns in the approved model. This requires an
identifier supplied by the source. The concrete proposal comes at Checkpoint 3,
once a source has been evaluated, and is a pending decision until then.

### 6.2 Price source

`card_prices` has no column identifying which provider produced a value. This is
sufficient while exactly one provider is in use. If more than one provider is
ever approved, distinguishing them requires a column, which is a change to the
approved model and would be raised before implementation.

---

## 7. Divergence record

Where the conceptual model and the logical model disagree, the logical model
prevails (decision 012). The PDFs in `docs/modelagem/` are left unmodified; this
section is the record of the corrections.

| Topic | Conceptual model | Implemented |
|---|---|---|
| Physical location | `Card_Variant` linked directly to `Storage_Location` | `collection_item_locations` links `collection_items` to `storage_locations` |
| Trade items | `Trade` linked directly to `Card_Variant` | `trade_items` links `trade_participants` to `card_variants` |
| Password | `password` | `password_hash` |
| Collection timestamp | `crated_at` (typo) | `created_at` |
| Storage timestamps | absent | `created_at`, `updated_at` |
| Trade participation | `role` only | `role`, `confirmed_at` |
| Price timestamp | `data` | `captured_at` |

Minimum cardinalities that the conceptual model marks as mandatory are optional
in the schema (decision 013): a card may have no attribute, which Event and Stage
cards require; a user may own no storage location and belong to no trade, which
newly registered users require.
