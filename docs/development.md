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

Depois de qualquer uma das duas, rode `npx prisma generate` **e reinicie o
`next dev`**. O servidor guarda o cliente Prisma que carregou ao subir: sem
reiniciar, a tabela nova existe no banco e no schema, e mesmo assim o app falha
com `Cannot read properties of undefined (reading 'findFirst')`. Testes e
`build` não denunciam, porque cada um gera o cliente antes de rodar.

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
| `APP_URL` | URL base. `http://localhost:3000` em dev, `https://colexa.com.br` em produção |
| `DATABASE_URL` | string de conexão do banco de desenvolvimento |
| `TEST_DATABASE_URL` | string de conexão do banco de teste, recriado pela suíte |
| `AUTH_SECRET` | segredo de assinatura da sessão |

`APP_URL` deixou de ser cosmética no Checkpoint 7: é dela que saem os links de
confirmação de e-mail e de redefinição de senha. Em produção ela é obrigatória,
e a aplicação recusa subir sem ela em vez de mandar e-mail com link para
`localhost`.

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
| `npm test` | a suíte inteira: domínio, integração e componentes |
| `npm run test:watch` | os mesmos testes em modo observador |
| `npm run test:ui` | só os componentes, em jsdom. **Não precisa de PostgreSQL** |
| `npm run test:e2e` | responsividade no Playwright, contra o build de produção |
| `npm run db:migrate` | `prisma migrate dev`, exige `CREATEDB` |
| `npm run db:deploy` | aplica migrations pendentes, usado na CI |
| `npm run db:reset` | derruba, recria e reaplica migrations |
| `npm run db:seed` | seed estrutural |
| `npm run db:studio` | navegador de dados do Prisma |
| `npm run prisma:generate` | regenera o Prisma Client |
| `npm run catalog:import` | importa o catálogo da fonte aprovada |

Fora da tabela, porque não roda no dia a dia:

```
node scripts/marca/gen.mjs
```

Regenera os arquivos de marca a partir de `docs/marca/originais/COLEXA LOGO.ai`.
Só é necessário se a identidade mudar. Ver `docs/marca/README.md`.

A importação aceita identificadores de série para limitar o alcance:

```
npm run catalog:import              # todas as séries
npm run catalog:import -- 569117    # apenas a série indicada
```

É executada sob demanda, nunca por requisição de usuário. As requisições à
origem são serializadas com intervalo mínimo entre elas, e as imagens são apenas
referenciadas, nunca baixadas — mitigações obrigatórias da decisão 020. Rodar
duas vezes não duplica nada e não altera os ids internos.

`npm run typecheck` chama `next typegen` antes do `tsc` porque o Next 16 gera
tipos de rota (como `LayoutProps`) em `.next/types`. Sem essa etapa, uma
verificação de tipos num diretório recém-clonado falha por tipos ausentes.

Migrations, seed estrutural e a importação real do catálogo são coisas separadas.
Dados grandes de catálogo nunca ficam dentro de uma migration. O seed estrutural
está intencionalmente vazio nesta fase: o vocabulário vem da importação do
catálogo, e pré-preenchê-lo arriscaria divergência de grafia com a fonte.

## 5. Testes

São **dois projetos do Vitest**, com ambientes diferentes:

| Projeto | Ambiente | Onde | Precisa de banco |
|---|---|---|---|
| `server` | Node | `tests/domain`, `tests/integration`, `tests/unit` | sim |
| `components` | jsdom | `tests/components` | não |

`npm test` roda os dois. `npm run test:ui` roda só os componentes, o que torna o
ciclo de escrever interface independente de ter PostgreSQL de pé.

O projeto `server` roda contra `TEST_DATABASE_URL` e **trunca todas as tabelas
entre os testes**. Por isso o `global-setup` se recusa a rodar quando
`TEST_DATABASE_URL` é igual a `DATABASE_URL`: seria apagar o banco de
desenvolvimento.

Ele usa `prisma migrate deploy`, o mesmo comando da CI e do deploy, e não
`migrate dev`. Assim o que os testes validam é o que vai para produção, e a
suíte não precisa de `CREATEDB`.

### 5.1 Responsividade

`npm run test:e2e` sobe o **build de produção** na porta 3100 e mede as três
larguras num Chromium de verdade. É o único nível que consegue verificar isso:
jsdom não avalia media query, então para ele `md:hidden` é apenas uma string, e
um teste de componente passaria com as duas navegações visíveis ao mesmo tempo.

Na primeira execução, instale o navegador:

```
npx playwright install chromium
```

O `webServer` do Playwright roda `npm run start`, então é preciso ter feito
`npm run build` antes — ou deixar que ele reaproveite um servidor já de pé.

## 6. Produção no Supabase

O banco de produção fica no Supabase, região São Paulo (decisão 025). O banco
local continua sendo desenvolvimento e teste.

**Produção nunca é o alvo padrão.** `DATABASE_URL` aponta sempre para o banco
local; o Supabase vive em `SUPABASE_DATABASE_URL` e só é alcançado por comandos
explícitos:

| Comando | O que faz |
|---|---|
| `npm run supabase status` | conta o que existe lá hoje |
| `npm run supabase migrate` | aplica as migrations pendentes |
| `npm run supabase import` | importa o catálogo, baixando da fonte |
| `npm run supabase import 569117` | importa apenas as séries informadas |
| `npm run supabase import --from=DIR` | importa de um snapshot local |
| `npm run supabase storage` | cria (ou confere) o bucket das imagens do usuário |

**Prefira `--from` quando o snapshot já existir.** Rebaixar o catálogo inteiro a
cada importação é carga evitável sobre a origem, e a decisão 020 nos obriga a
evitá-la. O `BandaiCatalogProvider` serve para criar ou atualizar o snapshot; o
`FileCatalogProvider` serve para toda importação subsequente.

O snapshot fica **fora do repositório** — são megabytes de HTML da Bandai, e
versioná-los seria redistribuir o conteúdo deles, justamente o que a decisão 020
evita. Na máquina de desenvolvimento atual ele está em `C:\dev\optcg-snapshot`.

Antes de agir, o script imprime host e banco de destino, e recusa rodar se a URL
estiver ausente, apontar para `localhost` ou ser igual a `DATABASE_URL`.

**Não existe `reset` para produção.** Derrubar o banco de produção não deve ser
um comando a um passo de distância; se for mesmo necessário, faça pelo painel do
Supabase, conscientemente.

### 6.1 Imagens enviadas pelo usuário

A foto de um local de armazenamento vai para o Supabase Storage (decisão 042).
Um comando prepara o bucket:

```
npm run supabase storage
```

Ele cria `colexa-imagens` público para leitura, com limite de 5 MB e apenas
`image/png` e `image/jpeg`. Rodar de novo é seguro: se já existir, os limites são
apenas conferidos. Os valores saem da **mesma constante** que o servidor usa para
recusar (`src/server/domain/storage/image.ts`), então não há como divergirem.

Depende de `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SECRET_KEY` no `.env`. Sem a
chave secreta, o campo de foto simplesmente não aparece na tela e o resto do
armazenamento continua funcionando — ausente é diferente de quebrado.

O bucket **não** é o banco: este comando não usa `SUPABASE_DATABASE_URL` e não
falha por causa dela.

### 6.2 Autenticação: o que depende do painel

Três coisas do fluxo de conta **não** se resolvem em código:

| O quê | Onde | Situação |
|---|---|---|
| Redirect URLs | *Authentication → URL Configuration* | precisa listar `<APP_URL>/auth/callback` de cada ambiente |
| Google e Apple | *Authentication → Providers* | desligados hoje; ver 6.2 |
| SMTP próprio | *Project Settings → Auth → SMTP* | não configurado |

O serviço de e-mail embutido do Supabase serve para desenvolvimento e tem cota
baixa por hora. Sem SMTP próprio, confirmação de conta e redefinição de senha
param de chegar assim que a cota estoura — e isso vale para todo mundo ao mesmo
tempo, porque a cota é do projeto.

Estado atual do projeto, conferido em 07/09/2026 pelo endpoint público
`/auth/v1/settings`: e-mail e senha habilitados, cadastro aberto, confirmação de
e-mail **obrigatória**, nenhum provedor social ligado.

### 6.3 Habilitar Google e Apple

O código já está pronto: os botões aparecem sozinhos para os provedores que o
Supabase reportar como habilitados (decisão 032). O que falta é configuração de
painel, que exige credenciais e não pode ser feita por aqui.

**A URL de retorno é sempre a do Supabase**, não a da aplicação:

```
https://zcyavtxrnpxinkvfnftf.supabase.co/auth/v1/callback
```

Quem redireciona para `/auth/callback` do ColeXa é o Supabase, depois.

#### Google

Sem custo. No [Google Cloud Console](https://console.cloud.google.com):

1. Crie ou escolha um projeto.
2. **APIs e serviços → Tela de permissão OAuth**: tipo *Externo*, nome do app
   `ColeXa`, e-mail de suporte e de contato. Os escopos padrão bastam —
   `openid`, `email` e `profile`.
3. **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo
   *Aplicativo da Web*.
4. Em *URIs de redirecionamento autorizados*, cole a URL do Supabase acima.
5. Copie o **Client ID** e o **Client Secret**.
6. No Supabase, **Authentication → Providers → Google**: habilite e cole os dois.

Enquanto a tela de permissão estiver em modo *Teste*, só as contas listadas em
*Usuários de teste* conseguem entrar. Publicar a tela remove esse limite;
para escopos básicos não há verificação demorada.

#### Apple

**Exige o Apple Developer Program, US$ 99 por ano.** Não há caminho gratuito.
Em [developer.apple.com](https://developer.apple.com/account/resources):

1. **Identifiers → App ID**, com *Sign In with Apple* marcado.
2. **Identifiers → Services ID** — este é o *client ID*. Configure o domínio
   `zcyavtxrnpxinkvfnftf.supabase.co` e a URL de retorno acima.
3. **Keys → nova chave** com *Sign In with Apple*. Baixe o `.p8`; ele só pode
   ser baixado **uma vez**. Anote o *Key ID* e o *Team ID*.
4. No Supabase, **Authentication → Providers → Apple**: habilite, informe o
   Services ID, o Team ID, o Key ID e o conteúdo do `.p8`. O Supabase monta o
   segredo, que a Apple exige que seja renovado a cada seis meses.

Duas particularidades da Apple que afetam o que aparece no produto:

- A pessoa pode **esconder o e-mail**, e aí o endereço é um
  `@privaterelay.appleid.com`. É um endereço válido e entregável, mas não é o
  e-mail real dela.
- O **nome só vem na primeira autorização**, e nunca mais. Se ele não vier, a
  conta nasce com o nome derivado do e-mail. Editar o nome depois depende da
  tela de perfil, que ainda não existe.

#### Depois de habilitar

```
node -e "require('dotenv').config();fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}}).then(r=>r.json()).then(s=>console.log(s.external))"
```

O que este comando reportar é exatamente o que a tela vai desenhar. O resultado
fica em cache por cinco minutos no servidor da aplicação.

### 6.4 Se a conexão direta falhar

O Supabase serve a conexão direta por IPv6. Em rede sem IPv6, a conexão expira
sem erro claro. Nesse caso use a string do **Session pooler**, que é compatível
com IPv4 e serve migrations igualmente — está em *Settings → Database →
Connection string*, na aba do pooler em modo *session*.

O *Transaction pooler* não serve para migrations: ele não mantém estado de
sessão, e o Prisma precisa disso para aplicar DDL.

## 7. Git

Estado atual: repositório em `C:\dev\optcg`, remote `origin` em
`github.com/PedroDusek/OP-Project` por SSH, branch padrão `main`.

A estratégia de branch e pull request está na decisão 016 e em `architecture.md`
seção 7.

Antes de todo push o histórico completo é varrido em busca de segredos. O
`.gitignore` bloqueia `.env`, `.env.*`, `*.pem`, `*.key` e `*.p12`. O repositório
é público, então nada sensível pode entrar em um commit.

## 8. Definição de pronto

Uma funcionalidade só está pronta quando o código está implementado, o banco está
consistente, backend e frontend estão implementados, as validações funcionam, os
testes passam, os erros são tratados, a responsividade foi validada, a
documentação está atualizada e o histórico do Git está organizado.
