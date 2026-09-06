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

A extensão `pg_trgm` é habilitada pela primeira migration, não manualmente. O
papel `optcg` consegue criá-la sozinho porque `pg_trgm` é uma extensão *trusted*
no PostgreSQL 13+ e `optcg` é dono do banco. Nenhum comando de migration precisa
de superusuário.

### 2.2 Criar novas migrations exige CREATEDB

`prisma migrate deploy` e a suíte de testes funcionam com o papel comum. Já
`prisma migrate dev`, que **gera** uma migration nova, cria um shadow database
para comparar estados, e isso exige o atributo `CREATEDB`:

```sql
ALTER ROLE optcg CREATEDB;
```

Sem esse grant, gere a migration sem shadow database e aplique com `deploy`:

```
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma \
  --script -o prisma/migrations/<timestamp>_<nome>/migration.sql
npx prisma migrate deploy
```

### 2.3 Rollback

O Prisma não gera migrations de descida, então "rollback" aqui significa duas
coisas concretas, ambas cobertas por teste:

1. Uma migration que falha no meio não deixa estado parcial. O PostgreSQL aplica
   DDL dentro da transação, então o passo inteiro desaparece no rollback.
2. O banco produzido pelas migrations corresponde exatamente ao `schema.prisma`.
   A CI falha se divergir.

Reverter uma migration já aplicada em produção significa restaurar backup e
reaplicar até o ponto desejado. Não existe comando de desfazer.

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

| Script | Finalidade |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run start` | serve o build |
| `npm run lint` | ESLint, incluindo as fronteiras entre camadas |
| `npm run typecheck` | gera os tipos de rota do Next e roda `tsc --noEmit` |
| `npm test` | testes de integração contra `TEST_DATABASE_URL` |
| `npm run test:watch` | os mesmos testes em modo observador |
| `npm run db:migrate` | `prisma migrate dev`, exige `CREATEDB` |
| `npm run db:deploy` | aplica migrations pendentes, usado na CI |
| `npm run db:reset` | derruba, recria e reaplica migrations |
| `npm run db:seed` | seed estrutural |
| `npm run db:studio` | navegador de dados do Prisma |
| `npm run prisma:generate` | regenera o Prisma Client |

`npm run typecheck` chama `next typegen` antes do `tsc` porque o Next 16 gera
tipos de rota (como `LayoutProps`) em `.next/types`. Sem essa etapa, uma
verificação de tipos num diretório recém-clonado falha por tipos ausentes.

Migrations, seed estrutural e a importação real do catálogo são coisas separadas.
Dados grandes de catálogo nunca ficam dentro de uma migration. O seed estrutural
está intencionalmente vazio nesta fase: o vocabulário vem da importação do
catálogo, e pré-preenchê-lo arriscaria divergência de grafia com a fonte.

## 5. Testes

A suíte roda contra `TEST_DATABASE_URL` e **trunca todas as tabelas entre os
testes**. Por isso o `global-setup` se recusa a rodar quando `TEST_DATABASE_URL`
é igual a `DATABASE_URL`: seria apagar o banco de desenvolvimento.

Ela usa `prisma migrate deploy`, o mesmo comando da CI e do deploy, e não
`migrate dev`. Assim o que os testes validam é o que vai para produção, e a
suíte não precisa de `CREATEDB`.

## 6. Git

Estado atual: repositório em `C:\dev\optcg`, remote `origin` em
`github.com/PedroDusek/OP-Project` por SSH, branch padrão `main`.

A estratégia de branch e pull request está na decisão 016 e em `architecture.md`
seção 7.

Antes de todo push o histórico completo é varrido em busca de segredos. O
`.gitignore` bloqueia `.env`, `.env.*`, `*.pem`, `*.key` e `*.p12`. O repositório
é público, então nada sensível pode entrar em um commit.

## 7. Definição de pronto

Uma funcionalidade só está pronta quando o código está implementado, o banco está
consistente, backend e frontend estão implementados, as validações funcionam, os
testes passam, os erros são tratados, a responsividade foi validada, a
documentação está atualizada e o histórico do Git está organizado.
