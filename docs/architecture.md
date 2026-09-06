# Architecture

## 1. Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 |
| Framework | Next.js 15, App Router |
| Language | TypeScript, `strict` |
| ORM | Prisma |
| Database | PostgreSQL 17 |
| Validation | Zod |
| Authentication | Auth.js v5, credentials provider |
| Password hashing | Argon2id |
| Styling | Tailwind CSS |
| UI primitives | Radix UI via shadcn/ui |
| Client data | TanStack Query |
| List virtualization | TanStack Virtual |
| Unit and integration tests | Vitest |
| End to end tests | Playwright |
| Lint and format | ESLint, Prettier |

Rationale for the stack itself is in `decisions.md` 002 and 003.

Nothing here is hand written where a mature library exists: hashing, ORM,
validation, session handling, UI primitives and test tooling are all libraries.
No dependency is added without a concrete need.

---

## 2. Layers

The separation required is by module, enforced by lint rules, not by splitting
the system into separate processes.

```
src/
  app/                    Next.js routes: pages and route handlers. Thin.
  components/             UI components. No business logic.
  server/
    domain/               Pure functions and types. No I/O, no Prisma, no HTTP.
    application/          Use cases. Owns transaction boundaries and locking.
    infrastructure/       Prisma client, repositories, external providers.
    http/                 Zod schemas, error mapping, authorization guards.
  lib/                    Utilities shared by client and server.
prisma/                   schema.prisma and migrations
tests/
  domain/                 pure unit tests, no database
  integration/            real PostgreSQL, real transactions
  e2e/                    Playwright
```

### 2.1 Dependency rules

- `domain` imports nothing from the other layers. It is pure, synchronous and
  fully testable without a database.
- `application` may import `domain` and `infrastructure`.
- `app` and `components` may import `application` and `http`, never
  `infrastructure` directly.
- `components` never contains business logic. Any number shown on screen is
  computed on the server.

These rules are enforced with the ESLint `no-restricted-imports` rule, so a
violation fails the build rather than relying on discipline.

### 2.2 What lives where

| Concern | Layer |
|---|---|
| Playset, progress, availability, matching arithmetic | `domain` |
| Transaction boundaries, row locks, advisory locks | `application` |
| Ownership checks | `application`, on every use case |
| Prisma queries, raw SQL for locking | `infrastructure` |
| Request parsing, response shape, HTTP status | `http` |

---

## 3. Backend

### 3.1 API

Route handlers under `app/api`. Read paths that only feed a page are served by
React Server Components calling the same use cases directly, which avoids an
unnecessary HTTP hop while keeping one implementation of each rule.

Every endpoint:

1. resolves the session on the server;
2. parses input with a Zod schema;
3. calls exactly one use case;
4. maps the result to a response.

A `user_id` is never read from the request body or the query string. It always
comes from the session.

### 3.2 Transactions and concurrency

Every operation that changes quantities, allocations or trade state runs in a
single transaction. Where the correctness of a write depends on rows it just
read, the transaction takes an explicit lock first:

| Operation | Lock |
|---|---|
| Change owned quantity or allocations | `SELECT ... FOR UPDATE` on the `collection_items` row |
| Bulk edit inside a storage location | the same lock, once per touched item, taken in ascending id order |
| Activate a trade | `pg_advisory_xact_lock` on each participant |
| Complete a trade | advisory locks on both participants, then row locks on the affected collection items |

Locks are always acquired in ascending identifier order so that concurrent
operations cannot deadlock by taking the same locks in opposite orders.

Bulk edit follows the specified flow: the user edits locally, reviews, confirms,
and the backend applies the whole set in one transaction that either commits or
rolls back. No dedicated table is involved.

### 3.3 Error handling

A single error taxonomy, mapped once at the HTTP boundary:

| Domain error | Status | Body |
|---|---|---|
| `ValidationError` | 400 | field level messages |
| `AuthenticationError` | 401 | generic message |
| `AuthorizationError` | 403 | generic message |
| `NotFoundError` | 404 | generic message |
| `ConflictError` | 409 | machine readable `code` plus the data needed to resolve it |
| `RateLimitError` | 429 | retry hint |
| unexpected | 500 | generic message and a correlation id |

The 409 case carries structure, because reducing a quantity below what is
allocated returns the current allocations so the client can present the
resolution screen. Internal details, SQL text and stack traces are never sent to
the client; they are logged with the correlation id.

### 3.4 Authentication

Auth.js v5 with the credentials provider and Argon2id password hashing.

Sessions are JWT based, in a `httpOnly`, `secure`, `sameSite=lax` cookie. This is
a deliberate consequence of the credentials provider, which does not support
database sessions, and it means the schema gains no session tables, keeping the
approved model intact.

The trade off is that a session cannot be revoked server side before it expires.
Session lifetime is therefore kept short. If revocation becomes a requirement, it
needs a `sessions` table, which is a change to the approved model and would be
raised first.

### 3.5 Authorization

Ownership is checked inside the use case, against the session user, for every
read and every write. There is no path where a resource is fetched by id and
returned without an ownership check.

The public trade binder route is the single unauthenticated read path. It
resolves a storage location by token, verifies that its purpose is `TRADE` and
that its owner is Premium, and returns only that binder.

### 3.6 Security

- Argon2id for passwords, never plain text, never a fast hash.
- Rate limiting on authentication, registration and the public trade route.
- CORS restricted to the application origin.
- All secrets from environment variables, never in code, never committed.
- Prisma parameterises every query; raw SQL is used only for locking and is
  always parameterised.
- Logs never contain passwords, tokens or session cookies.
- Public tokens are 32 random bytes, base64url encoded, generated with
  `crypto.randomBytes`, never derived from an internal id.

---

## 4. Frontend

### 4.1 Mobile first

The design starts at 360px and expands. It is not a reduced desktop layout.

| Breakpoint | Target |
|---|---|
| base | phone, single column, bottom navigation |
| `md` | tablet, two columns, filters in a side panel |
| `lg` | desktop, wider grid, persistent navigation |

Patterns: bottom navigation bar, bottom sheets for filters and quantity editing,
drawers for secondary navigation, touch targets of at least 44px, quantity
steppers reachable with one thumb.

Large tables that force horizontal scrolling on a phone are avoided. Collection
and catalog listings are image first grids; quantity is shown as a discreet
badge on the card image.

### 4.2 Performance

- Server side pagination and filtering on every list. The catalog is never
  fetched whole.
- `next/image` with responsive sizes and lazy loading for card images.
- Virtualized grids for long lists.
- Debounced search input; exact code lookup hits the unique index directly.
- TanStack Query for caching and infinite lists on interactive screens; React
  Server Components for first render.

### 4.3 Card presentation

The interface is visual. The card image is the primary element. Opening a card
shows its information, the owned quantity, quantity management, where the copies
are stored, the price, and its variants and sets.

---

## 5. Integrations

Two interfaces isolate external data. Neither is consulted during page rendering;
after import the internal database is the operational source.

```ts
interface CatalogProvider {
  fetchSets(): Promise<SetDTO[]>
  fetchCards(): Promise<CardDTO[]>
  fetchVariants(): Promise<VariantDTO[]>
}

interface PriceProvider {
  fetchPrices(refs: VariantRef[]): Promise<PriceDTO[]>
}
```

Imports are idempotent: running one twice inserts nothing new. Details, and the
still open question of how variants are identified across runs, are in
`integrations.md`.

---

## 6. Testing strategy

| Level | Tool | Scope |
|---|---|---|
| Domain unit | Vitest | playset, progress, availability, matching arithmetic. No database. The ten required scenarios live here. |
| Integration | Vitest against a real PostgreSQL test database | constraints, triggers, transactions, concurrency, ownership, import idempotency |
| API | Vitest | route handlers, validation, status codes, authorization |
| Component | Vitest with Testing Library | interactive components |
| End to end | Playwright | registration and login, adding to the collection, storage allocation, want list, trade binder sharing, a full trade |

Integration tests run against `TEST_DATABASE_URL`, which is reset by migrations
before the suite. They never touch the development database.

Concurrency is tested explicitly, not assumed: two simultaneous allocation
writes against the same collection item must not exceed the owned quantity, and
two simultaneous attempts to activate a trade for the same user must leave
exactly one active.

Responsive behaviour is verified in Playwright at phone, tablet and desktop
viewports.

---

## 7. Git strategy

Proposed, pending approval.

- `main` always deployable. No direct commits.
- One branch per checkpoint, named `checkpoint-N/<topic>`; `fix/`, `docs/` and
  `chore/` branches for smaller work.
- One pull request per checkpoint, describing what changed, the tests run, the
  decisions taken and any breaking change.
- Merge commits rather than squash, so the small semantic commits inside a
  checkpoint survive in history.
- Conventional Commits for messages.
- Nothing is merged while a decision on that checkpoint is still open.

## 8. Continuous integration

Proposed, pending approval. No CI exists today.

A GitHub Actions workflow on pull requests and on `main`: install, lint, type
check, unit tests, integration tests against a PostgreSQL service container,
migration check, build.

No production infrastructure, deployment target or environment is configured
without explicit approval.
