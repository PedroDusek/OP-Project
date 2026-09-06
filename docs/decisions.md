# Decision Log

Only approved decisions are recorded here. Open questions live in
`docs/checkpoint-0-analise.md` under "Decisoes pendentes" and are promoted to
this file once the product owner approves them.

---

# Decision: 001 - Repository location outside OneDrive

## Context

The project folder `C:\Users\pedro\OneDrive\Desktop\OPTCG PROJECT` sat inside an
accidental Git repository whose root was the user's home directory
(`C:\Users\pedro\.git`, 384 MB, zero commits, no remote, no `.gitignore`, with
`.ssh/`, `.gitconfig` and `.claude.json` untracked). Any `git add` from anywhere
under the home directory risked committing private keys and credentials.

The folder is also inside OneDrive, which synchronises every file it sees.
`node_modules` holds tens of thousands of small files and is a known cause of
sync churn, file locks during builds and corrupted installs.

## Options

1. Move the project to `C:\dev\optcg`, outside OneDrive, and `git init` there.
2. `git init` inside the existing OneDrive folder.
3. Option 1 plus deleting `C:\Users\pedro\.git`.

## Decision

Option 1. The project lives at `C:\dev\optcg` with its own repository.
The specification PDFs were **copied** (not moved); the originals remain in the
OneDrive folder. `C:\Users\pedro\.git` was left untouched.

## Reason

Removes the credential-exposure risk and the OneDrive build problems in one step,
without any destructive action. Deleting the stray repository stays available as
a separate, explicitly authorised step.

## Date

2026-09-06

---

# Decision: 002 - Stack

## Context

The project had no code. A stack had to be chosen for a mobile-first web app
that needs strong transactional guarantees, server-side business rules and good
performance on mobile connections.

## Options

1. Next.js (App Router) + TypeScript + Prisma + PostgreSQL, single repository.
2. NestJS API + React (Vite) frontend, deployed separately.
3. ASP.NET Core + EF Core backend + React frontend.

## Decision

Option 1: Next.js + TypeScript + Prisma + PostgreSQL.

The layering required by the specification (domain / persistence / business
rules / API / frontend) is enforced by module boundaries inside `src/server`,
which the frontend may never import directly.

## Reason

One language, one test runner, one deployment. `next/image` and React Server
Components give the best mobile performance without extra infrastructure.
Process separation is not required to achieve layer separation, and avoiding it
keeps the system simple, which the specification explicitly favours.

## Date

2026-09-06

---

# Decision: 003 - PostgreSQL as the database engine

## Context

The specification requires guarantees that a database engine has to provide
directly: partial unique indexes, `CHECK` constraints, row-level locking for
concurrent quantity updates, indexed text search on card codes, and reversible
migrations.

## Options

PostgreSQL, MySQL/MariaDB, SQLite.

## Decision

PostgreSQL 17.

## Reason

The only one of the three that supports partial unique indexes, `SELECT ... FOR
UPDATE` with the needed semantics, trigram indexes for code search and
transactional DDL. This is a technical decision with no product impact.

## Date

2026-09-06

---

# Decision: 004 - Local database runtime

## Context

Neither PostgreSQL nor Docker was installed on the development machine.

## Options

1. Native PostgreSQL installation on Windows.
2. Docker Desktop with a `docker-compose` service.
3. Managed service (Neon or Supabase).

## Decision

Option 1: native PostgreSQL installation on Windows.

## Reason

Chosen by the product owner. No extra runtime layer and no dependency on an
internet connection during development.

## Date

2026-09-06

---

# Decision: 005 - GitHub remote

## Context

No Git remote existed and the `gh` CLI was not installed.

## Options

1. Work without a remote for now.
2. Configure an existing repository URL.
3. Prepare the repository locally and hand the product owner the exact commands
   to create the remote and push.

## Decision

Option 3. The repository is initialised locally on branch `main` with
`.gitignore`, `README.md` and `.env.example`. The product owner creates the
GitHub repository and performs the first push.

## Reason

Keeps credential handling entirely with the product owner. No repository URL is
invented, and development is not blocked in the meantime.

## Date

2026-09-06

---

# Decision: 006 - Set progress with reprints

## Context

A card variant can be printed in several sets, and the specification requires
set progress to be computed from `variant_printings`, never from the card code
prefix. It explicitly asks how a reprinted variant should be counted.

## Options

1. The variant counts in every set it was printed in.
2. The variant counts only in its original set.
3. Same as 1, plus an `is_primary` flag on `variant_printings` for display.

## Decision

Option 1. A variant printed in N sets counts in the numerator **and** in the
denominator of each of those N sets.

## Reason

It is the direct reading of "unique card variants of that set", and it keeps
every set reachable at 100%. Global collection progress counts distinct variants,
so nothing is double counted there. Option 2 would require storing which set is
the original, an attribution the external source may not provide reliably.

## Date

2026-09-06

---

# Decision: 007 - Reducing a quantity below what is already allocated

## Context

Copies of a card can be allocated to storage locations, and the sum of those
allocations may never exceed `collection_items.quantity`. When a user lowers the
owned quantity below the total already allocated, the specification requires an
explicit rule instead of an assumption.

Example: the user owns 4 copies (Binder 3, Box 1) and lowers the quantity to 2.

## Options

1. Reject with an error and require the user to deallocate first.
2. Deallocate automatically until the new quantity fits.
3. Return the conflict and let the user choose which locations to take from.

## Decision

Option 3. The write is rejected atomically and the API responds with a conflict
that carries the current allocations, so the client can present a resolution
screen where the user chooses where the copies come from. The resolution is then
submitted as a single transactional operation together with the new quantity.

## Reason

Chosen by the product owner. No allocation is ever removed without the user
seeing it, and no removal order has to be invented. Cost: an extra screen and a
structured conflict payload in the error contract, delivered at Checkpoint 9.

## Date

2026-09-06

---

# Decision: 008 - Public Trade Binder token

## Context

The specification requires a public page for a Trade Binder at
`/trade/<random-token>`, with a token that is random, non sequential, does not
expose internal ids, and is both revocable and regenerable. Neither the
conceptual nor the logical model provides a place to store it.

## Options

1. Columns on `storage_locations`.
2. A dedicated `storage_share_tokens` table keeping revoked token history.

## Decision

Option 1. `storage_locations` gains `public_token` and `public_token_created_at`,
with a unique index on `public_token`. Revoking sets the token to NULL;
regenerating writes a new random value.

## Reason

Covers the whole requirement without a 25th table. A share history is not
required by the specification, and adding one now would be speculative.

This is a structural change to the approved model, approved by the product owner.

## Date

2026-09-06

---

# Decision: 009 - Premium plan and trial

## Context

The specification defines a Premium plan with a 7 day trial, with the public
Trade Binder as a Premium feature. Price, payment gateway and commercial policy
are explicitly undefined. Neither model has any field for plan or trial.

## Options

1. Columns on `users`.
2. A dedicated `subscriptions` table.

## Decision

Option 1. `users` gains `plan`, `trial_started_at` and `premium_until`.

## Reason

Covers exactly what is defined today without anticipating billing decisions that
have not been made. A `subscriptions` table can be introduced later, when a
gateway and a commercial policy exist, without invalidating this shape.

This is a structural change to the approved model, approved by the product owner.
No price, gateway or commercial policy is implied by it.

## Date

2026-09-06

---

# Decision: 010 - Column name for the price timestamp

## Context

The three sources disagree on the name of the date field in `card_prices`: the
conceptual model says `data`, the logical model says `captured_at`, and the
specification text says `date`.

## Options

`date`, or `captured_at`.

## Decision

`captured_at TIMESTAMPTZ`, following the logical model.

## Reason

`date` is a reserved word in SQL and a type name in PostgreSQL, which forces
quoting at every use. `captured_at` also preserves the time of day, which matters
for resolving the price in effect at `trades.completed_at`.

## Date

2026-09-06

---

# Decision: 011 - "Committed to trade" is derived, not stored

## Context

The specification distinguishes four states: possessed, available for trade,
committed to trade, and actually traded, and requires that a user cannot commit
the same copies to several trades at once.

## Options

1. Derive the committed state from active trades.
2. Store a committed quantity on the collection.

## Decision

Option 1. A copy is committed when the user has a `trade_item` in a trade whose
status is `PROPOSED`, `NEGOTIATING` or `CONFIRMED`. No new column is added.

## Reason

A stored counter would be a second source of truth that can drift from the trade
rows. Since a user may hold at most one active trade at a time, the derived query
stays cheap. Multiple simultaneous commitments are prevented by that same
one-active-trade rule, enforced transactionally.

## Date

2026-09-06

---

# Decision: 012 - Conceptual model divergences resolve in favour of the logical model

## Context

The conceptual model and the logical model disagree on two structural points.

1. Physical location: the conceptual model links `Card_Variant` directly to
   `Storage_Location`; the logical model links `collection_item` to
   `storage_location`.
2. Trade items: the conceptual model links `Trade` directly to `Card_Variant`;
   the logical model links `trade_participant` to `card_variant`.

## Options

Follow the conceptual model, or follow the logical model.

## Decision

The logical model prevails in both cases. The divergences are documented in
`docs/database.md`. The PDFs are left unmodified.

## Reason

The conceptual version of (1) loses the link to the collection and its owner,
making it impossible to validate that allocations never exceed the owned
quantity, or that the storage belongs to the collection owner. The conceptual
version of (2) loses the information about which participant offers each card,
which the trade flow depends on. The specification text agrees with the logical
model on both points.

## Date

2026-09-06

---

# Decision: 013 - Minimum cardinalities relaxed to optional

## Context

The conceptual model marks several participations as mandatory that cannot hold
in practice: every card having at least one attribute and at least one trait,
and every user belonging to at least one storage location and at least one trade.

## Options

Enforce the conceptual minimums, or relax them to optional.

## Decision

Relaxed to optional in the database, matching the logical model.

## Reason

Event and Stage cards have no attribute in the OPTCG, so a mandatory
`Card -> Attribute` participation would reject valid catalog data during import.
A newly registered user owns no storage location and belongs to no trade, so
those minimums would make registration impossible.

## Date

2026-09-06

---

# Decision: 014 - Additional uniqueness constraints

## Context

The specification lists the unique constraints for the main tables but does not
mention two that the required behaviour depends on.

## Options

Rely on application code, or add the constraints to the schema.

## Decision

Two constraints are added:

- `UNIQUE (collection_item_id, storage_location_id)` on `collection_item_locations`
- `UNIQUE (name)` on `colors`, `traits`, `attributes`, `mechanics` and `effects`

## Reason

Without the first, the same card could have two separate allocation rows for one
storage location, which breaks the allocation sum and lets the same copies be
counted twice. Without the second, re-running the catalog import would insert
duplicate vocabulary rows, violating the idempotency requirement. Both are
additive and change no behaviour that the specification defines.

## Date

2026-09-06
