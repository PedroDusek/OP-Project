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
