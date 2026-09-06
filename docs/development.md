# Development

## 1. Requirements

| Tool | Version | Status on the current machine |
|---|---|---|
| Node.js | 20+ | installed, 20.20.2 |
| npm | 10+ | installed, 10.8.2 |
| PostgreSQL | 17+ | **not installed yet** |
| Git | 2.40+ | installed, 2.54.0 |

## 2. PostgreSQL

Install PostgreSQL 17 from the official Windows installer at
`postgresql.org/download/windows`. During installation:

- keep the default port `5432`;
- record the password chosen for the `postgres` superuser;
- include the command line tools, so `psql` is available on the `PATH`.

Then create the role and the two databases. The second one is used by the
integration test suite, which resets it with migrations, so it must never point
at development data.

```sql
CREATE ROLE optcg WITH LOGIN PASSWORD 'choose-a-password';
CREATE DATABASE optcg       OWNER optcg;
CREATE DATABASE optcg_test  OWNER optcg;
```

The `pg_trgm` extension is enabled by the first migration, not by hand.

## 3. Environment

Copy the template and fill in real values. `.env` is ignored by Git and must
never be committed.

```
cp .env.example .env
```

| Variable | Meaning |
|---|---|
| `NODE_ENV` | `development`, `test` or `production` |
| `APP_URL` | base URL of the application |
| `DATABASE_URL` | development database connection string |
| `TEST_DATABASE_URL` | test database connection string, reset by the test suite |
| `AUTH_SECRET` | session signing secret |

Generate the session secret with:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 4. Scripts

Available from Checkpoint 2, once the application is scaffolded.

| Script | Purpose |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | unit and integration tests |
| `npm run test:e2e` | Playwright |
| `npm run db:migrate` | apply migrations |
| `npm run db:reset` | drop, recreate and re-apply migrations |
| `npm run db:seed` | structural seed data |

Migrations, structural seed data and the real catalog import are kept separate.
Large catalog data never lives inside a migration.

## 5. Git

Current state: repository at `C:\dev\optcg`, remote `origin` at
`github.com/PedroDusek/OP-Project` over SSH, default branch `main`.

The branch and pull request strategy is proposed in `architecture.md` section 7
and is pending approval.

Before every push the full history is scanned for secrets. `.gitignore` blocks
`.env`, `.env.*`, `*.pem`, `*.key` and `*.p12`. The repository is public, so
nothing sensitive may ever enter a commit.

## 6. Definition of done

A feature is done when the code is implemented, the database is consistent, the
backend and frontend are both implemented, validation works, tests pass, errors
are handled, responsive behaviour is verified, documentation is updated and the
Git history is organised.
