# Desenvolvimento

## 1. Requisitos

| Ferramenta | Versão | Situação na máquina atual |
|---|---|---|
| Node.js | 20+ | instalado, 20.20.2 |
| npm | 10+ | instalado, 10.8.2 |
| PostgreSQL | 17+ | instalado, **18.6** |
| Git | 2.40+ | instalado, 2.54.0 |
| GitHub CLI | 2+ | instalado, 2.100.0, autenticado |

## 2. PostgreSQL

A máquina de desenvolvimento roda **PostgreSQL 18.6**, serviço
`postgresql-x64-18`, na porta padrão 5432, com autenticação `scram-sha-256`.

A decisão 003 nomeou o PostgreSQL 17. O 18 atende a tudo que o schema exige e é
oficialmente suportado pelo Prisma, que declara compatibilidade de 9.6 até 18.
Não há motivo técnico para voltar ao 17.

Os binários ficam em `C:\Program Files\PostgreSQL\18\bin`, que não está no `PATH`
por padrão. Use o caminho completo ou acrescente ao `PATH`.

### 2.1 Role e bancos

O papel da aplicação e os dois bancos são criados uma única vez. O segundo banco
é usado pela suíte de integração, que o recria com migrations, então ele nunca
pode apontar para dados de desenvolvimento.

```sql
CREATE ROLE optcg WITH LOGIN PASSWORD 'escolha-uma-senha';
CREATE DATABASE optcg      OWNER optcg;
CREATE DATABASE optcg_test OWNER optcg;
```

A senha usada precisa ser a mesma que aparece em `DATABASE_URL` e
`TEST_DATABASE_URL` no `.env`.

A extensão `pg_trgm` é habilitada pela primeira migration, não manualmente.

## 3. Ambiente

Copie o template e preencha com valores reais. O `.env` é ignorado pelo Git e
nunca pode ser versionado.

```
cp .env.example .env
```

| Variável | Significado |
|---|---|
| `NODE_ENV` | `development`, `test` ou `production` |
| `APP_URL` | URL base da aplicação |
| `DATABASE_URL` | string de conexão do banco de desenvolvimento |
| `TEST_DATABASE_URL` | string de conexão do banco de teste, recriado pela suíte |
| `AUTH_SECRET` | segredo de assinatura da sessão |

Gere o segredo de sessão com:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 4. Scripts

Disponíveis a partir do Checkpoint 2, quando a aplicação for criada.

| Script | Finalidade |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, sem emissão |
| `npm run test` | testes unitários e de integração |
| `npm run test:e2e` | Playwright |
| `npm run db:migrate` | aplica migrations |
| `npm run db:reset` | derruba, recria e reaplica migrations |
| `npm run db:seed` | dados estruturais de seed |

Migrations, seed estrutural e a importação real do catálogo são coisas separadas.
Dados grandes de catálogo nunca ficam dentro de uma migration.

## 5. Git

Estado atual: repositório em `C:\dev\optcg`, remote `origin` em
`github.com/PedroDusek/OP-Project` por SSH, branch padrão `main`.

A estratégia de branch e pull request está na decisão 016 e em `architecture.md`
seção 7.

Antes de todo push o histórico completo é varrido em busca de segredos. O
`.gitignore` bloqueia `.env`, `.env.*`, `*.pem`, `*.key` e `*.p12`. O repositório
é público, então nada sensível pode entrar em um commit.

## 6. Definição de pronto

Uma funcionalidade só está pronta quando o código está implementado, o banco está
consistente, backend e frontend estão implementados, as validações funcionam, os
testes passam, os erros são tratados, a responsividade foi validada, a
documentação está atualizada e o histórico do Git está organizado.
