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
| `npm run supabase -- aquecer --rodizio --limite=800` | prepara a fatia da noite (decisão 103) |
| `npx tsx scripts/medir-banco.ts` | quantas consultas cada tela faz, no banco local |
| `npx tsx scripts/medir-indices.ts` | os índices que existem e o plano das consultas pesadas |
| `npm run supabase migrate` | aplica as migrations pendentes |
| `npm run supabase import` | importa o catálogo, baixando da fonte |
| `npm run supabase import 569117` | importa apenas as séries informadas |
| `npm run supabase -- import --from=DIR` | importa de um snapshot local |
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
| Redirect URLs | *Authentication → URL Configuration* | precisa listar `<APP_URL>/**` de cada ambiente — com curinga, porque a volta leva `?next=` |
| Google e Apple | *Authentication → Providers* | desligados hoje; ver 6.2 |
| SMTP próprio | *Authentication → Emails → SMTP Settings* | configurado em 17/09, pelo Resend (decisão 086) |

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

### 6.4 Ligar o CAPTCHA (decisão 088)

Nesta ordem — ao contrário, ninguém entra, inclusive no desenvolvimento local,
que usa o mesmo projeto Supabase:

1. **Cloudflare → Turnstile → Add widget.** Nome `ColeXa`, hostnames `localhost`
   e `colexa.com.br`, modo *Managed*. Ela mostra a *Site Key* (pública) e a
   *Secret Key*.
2. **A Site Key em `NEXT_PUBLIC_TURNSTILE_SITE_KEY`**, no `.env` e no ambiente de
   produção. Reinicie o `npm run dev`; em produção, é preciso um build novo,
   porque a variável entra no pacote do navegador.
3. **Confira** que entrar, criar conta e recuperar senha mostram o desafio. Com
   o painel ainda desligado, tudo continua funcionando.
4. **Supabase → Authentication → Attack Protection → Enable Captcha
   protection**, provedor *Turnstile*, com a *Secret Key*.
5. **Confira de novo** os três formulários.

Para desligar, na ordem inversa: o painel primeiro, a chave depois.

### 6.6 Publicar na Fly.io (decisão 089)

O site roda numa máquina da Fly.io em São Paulo. A imagem sai do `Dockerfile`, a
configuração de `fly.toml`, e a publicação é **à mão**, pelo workflow
**Publicar** do GitHub Actions.

#### Uma vez só, pelo dono do produto

Nenhum destes passos passa segredo pela conversa.

1. **Conta na Fly.io**, com cartão cadastrado (a Fly exige).
2. **O `flyctl`** no Windows, no PowerShell:
   `iwr https://fly.io/install.ps1 -useb | iex`. Depois `fly auth login`, que
   abre o navegador.
3. **Criar a aplicação:** `fly apps create colexa`. Se o nome estiver tomado,
   escolha outro e troque `app` e `APP_URL` em `fly.toml` num PR.
4. **Os segredos**, no painel da Fly (*Apps → colexa → Secrets*), e não na linha
   de comando, que fica no histórico do terminal:
   - `DATABASE_URL` — a string do **Session pooler** do Supabase (*Connect →
     Session pooler*), que tem IPv4. A conexão direta é só IPv6 (armadilha do
     workflow de preços).
   - `SUPABASE_SECRET_KEY` — para o envio de fotos.
   - `RESEND_API_KEY` — para o e-mail de denúncia.
5. **O token de publicação:** `fly tokens create deploy --app colexa`. O valor vai
   em GitHub → *Settings → Secrets and variables → Actions → Secrets* com o nome
   `FLY_API_TOKEN`.
6. **Os três valores públicos**, no mesmo lugar, mas na aba **Variables**:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — os mesmos do `.env`. Entram no build, e
   mudar qualquer um exige publicar de novo.
7. **Liberar o endereço de teste** `colexa.fly.dev` nos painéis:
   - Cloudflare Turnstile: `colexa.fly.dev` nos hostnames do widget;
   - Supabase, *URL Configuration*: `https://colexa.fly.dev/**` nas
     *Redirect URLs*;
   - Google Auth Platform, no cliente: `https://colexa.fly.dev` nas origens.

8. **O volume do cache de imagens** (decisão 090), uma vez, antes da primeira
   publicação que tiver `[[mounts]]` em `fly.toml`:
   `fly volumes create colexa_cache --region gru --size 1 --app colexa`.
   Sem ele, a publicação falha dizendo que o volume não existe.

9. **O segredo `SUPABASE_SECRET_KEY` no GitHub** (decisão 091), em *Settings →
   Secrets and variables → Actions → Secrets*, com o mesmo valor do segredo da
   Fly. É o que deixa o workflow **Contas** excluir a conta no Supabase Auth e
   as fotos no Storage; sem ele, a tarefa diária pula.

O build acontece nos builders geridos (`--depot=true`). Não use `--remote-only`:
ele cria um app `fly-builder-...` com um volume de 50 GB, que é cobrado todo mês
(decisão 089, armadilha 64).

#### Premium de cortesia (decisão 093)

Enquanto não existe pagamento, o Premium é dado por comando, contra produção:

```
npm run supabase -- premium pessoa@exemplo.com --ate=2026-12-31
npm run supabase -- premium pessoa@exemplo.com --remover
```

O prazo é obrigatório de propósito: cortesia sem data não cai sozinha quando o
teste termina. A data vale até o fim do dia, no horário de Brasília.

#### As imagens depois de publicar (decisão 094)

O workflow **Publicar** termina pedindo as imagens das 200 cartas mais prováveis
(`npm run supabase aquecer`), porque o disco da máquina é novo a cada publicação.
À mão, com outros números:

```
npm run supabase aquecer -- --limite=400 --paralelas=3 --url=https://colexa.fly.dev
```

Poucas em paralelo de propósito: a fonte é de terceiro (decisão 020).

#### A cada publicação

1. `npm run supabase status`. Se faltar migration, `npm run supabase migrate`
   **antes** — código novo contra banco velho derruba a tela inteira.
2. GitHub → *Actions → Publicar → Run workflow*, na `main`.
3. Abrir `https://colexa.fly.dev/api/saude` e depois o site.

Com uma máquina só, a publicação deixa o site fora do ar por alguns segundos.

#### Ligar o domínio

1. `fly certs add colexa.com.br` (e `www.colexa.com.br`, se for usar). Ele mostra
   os registros de DNS a criar no registro do domínio.
2. Com o certificado emitido (`fly certs show colexa.com.br`), trocar `APP_URL`
   em `fly.toml` para `https://colexa.com.br`, num PR, e publicar.
3. Nos painéis, o mesmo do passo 7 com `colexa.com.br`: o Turnstile já tem.

### 6.7 Se a conexão direta falhar

O Supabase serve a conexão direta por IPv6. Em rede sem IPv6, a conexão expira
sem erro claro. Nesse caso use a string do **Session pooler**, que é compatível
com IPv4 e serve migrations igualmente — está em *Settings → Database →
Connection string*, na aba do pooler em modo *session*.

O *Transaction pooler* não serve para migrations: ele não mantém estado de
sessão, e o Prisma precisa disso para aplicar DDL.

### 6.8 Ligar a cobrança na Stripe (decisão 102)

O código está pronto e **desligado enquanto faltar chave**: sem elas,
`StripePaymentProvider.available` é `false`, a tela de Premium diz que a
assinatura não está aberta e o webhook responde 503. Ligar é configurar, não
programar.

No painel da Stripe, com a conta já verificada:

1. **Dois preços recorrentes**, em *Product catalog*, num produto "ColeXa
   Premium": **R$ 14,90/mês** e **R$ 149,00/ano**. Anote os dois `price_...`.
   O Pix **não** usa preço cadastrado — o valor vai inline, vindo de
   `src/server/domain/billing/plans.ts`, e um teste compara os dois números.
2. **Pix: nada a fazer.** Ele ficou **fora do lançamento** (decisão 102,
   mudança de 21/09) — a Stripe o libera por convite para empresas brasileiras,
   e esperar atrasaria a abertura. O código dorme atrás de `STRIPE_PIX`. Se um
   dia entrar: pedir o convite, ligar o Pix em *Settings → Payment methods* e
   pôr `STRIPE_PIX=1` no ambiente. Sem as duas coisas, a sessão de Pix é
   recusada na criação.
3. **Webhook** em *Workbench → Webhooks*, apontando para
   `https://colexa.com.br/api/pagamentos/stripe`, com os **seis** eventos:
   `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
   `customer.subscription.updated`, `customer.subscription.deleted` e
   `charge.refunded`. Anote o `whsec_...`.

   **`charge.refunded` é o que corta o acesso de quem foi estornado** (decisão
   102, mudança de 21/09). Sem ele marcado, o código do estorno nunca roda e
   quem pede o dinheiro de volta fica com o ciclo inteiro de graça — foi assim
   que o defeito apareceu.
4. **Portal do cliente** em *Settings → Billing → Customer portal*: ative
   cancelamento e troca de cartão. É essa tela que o botão "Gerenciar
   pagamento" abre, e ela precisa estar certa para a cobrança ser legítima.

No ambiente, as quatro variáveis de `.env.example` (`STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`). Em
produção, as duas primeiras são segredos (`fly secrets set`), e as duas últimas
também podem ir por lá — nenhuma entra no pacote do navegador, porque a tela
mostra o preço a partir do domínio, e não do que a Stripe devolve.

**`STRIPE_PIX=1` liga o Pix**, e a ausência dela o desliga. É a chave que devolve
o botão no dia em que o convite da Stripe chegar, sem publicar código novo. Não
é segredo: pode ir em `[env]` no `fly.toml`, num PR.

**Para testar sem cobrar ninguém**, use as chaves de teste da própria Stripe
(`sk_test_...`), o cartão `4242 4242 4242 4242` e o `stripe listen` para
encaminhar os avisos ao `localhost`. O Pix em modo de teste tem um botão de
"pagar" simulado na própria tela.

**O que nunca fazer:** liberar Premium a partir da volta da tela
(`/conta/premium?pago=1`). Esse endereço é adivinhável. Quem libera é o aviso
assinado, em `handle-payment-event.ts`.

### 6.9 Virar a cobrança para o modo ao vivo (etapa B)

**Feito em 21/09**, e conferido com uma compra mensal de verdade. O roteiro fica
aqui porque ele vale de novo no dia em que a conta da Stripe mudar — e porque o
que se aprende nele não se aprende duas vezes de graça.

**Nenhuma linha de código muda.** Os quatro valores são de ambiente, e a virada
é trocar segredo. É o troco de a Stripe morar atrás de uma porta (`http`).

O que confunde e custa tempo: **o modo ao vivo é outro mundo dentro da mesma
conta**. Preço, webhook, cliente e assinatura do modo de teste **não existem**
lá. Nada é migrado, e nenhum identificador serve nos dois.

Pela ordem:

1. **Ativar a conta para receber**, no painel: CPF ou CNPJ, dados bancários e o
   que a Stripe pedir. Sem isso o modo ao vivo não aceita pagamento.
2. **Criar os dois preços de novo**, agora no modo ao vivo: R$ 14,90/mês e
   R$ 149,00/ano, no produto "ColeXa Premium". Os `price_...` são **outros**.
3. **Criar o webhook de novo**, no modo ao vivo, para
   `https://colexa.com.br/api/pagamentos/stripe`, com os mesmos **seis**
   eventos. O `whsec_...` é **outro**: o do modo de teste não valida nada lá, e
   a assinatura do aviso vai falhar em silêncio se for reaproveitado.
4. **Conferir o portal do cliente** no modo ao vivo: a configuração dele também
   é por modo.
5. **Limpar as fichas de teste** de quem comprou testando, antes de virar a
   chave:
   `npm run supabase -- limpar-assinaturas <email> --confirmar`. Sem isso, a
   ficha aponta para um cliente que não existe no modo ao vivo, "Gerenciar
   pagamento" falha e a trava de "já tem assinatura ativa" recusa a pessoa de
   assinar de verdade. Os avisos em `payment_events` ficam de propósito: são o
   rastro de cobrança contestada.
6. **Trocar os quatro segredos** na Fly, com os valores do modo ao vivo, numa
   chamada só — assim as máquinas reiniciam uma vez, e não quatro
   (`fly secrets set` no terminal de quem tem as chaves; elas nunca passam por
   uma conversa). As máquinas reiniciam sozinhas: **não precisa publicar**.

   **A chave costuma ser `rk_live_`, e não `sk_live_`.** Criar a chave
   escolhendo permissões — o caminho recomendado — produz uma *restricted key*,
   com o prefixo `rk_`. Ela vai em `STRIPE_SECRET_KEY` do mesmo jeito: o código
   manda a credencial como `Authorization: Bearer` e **não confere prefixo**.
   Escolha *"Acesso total (exceto operações sensíveis)"*: o ColeXa só cria
   sessão de pagamento e sessão do portal, e o que fica de fora é justamente
   mover dinheiro para fora da conta — o que importa se a chave vazar do
   servidor. As permissões **não podem ser editadas depois**; mudar é chave
   nova.
7. **Conferir com uma compra de verdade**, de preferência a mensal, e pedir
   reembolso pelo painel logo depois. É o único teste que prova que a chave, o
   preço e o webhook do modo ao vivo combinam entre si — e o único que prova que
   o `whsec_` é o do webhook certo.
8. **Desligar ou apagar o webhook do modo de teste.** Ele continua apontando
   para o mesmo endereço, e o que ele mandar vai ser **recusado** pela
   conferência de assinatura — que é o certo, mas enche o log de `aviso
   recusado`. Daqui a um mês isso parece defeito, e não é.

**Conferir sem ver segredo:** `fly secrets list --app colexa` mostra nome e um
resumo de cada valor, nunca o valor. Digest que mudou é a prova de que a troca
entrou.

**A cobrança abriu antes dos Termos** (decisão 102, mudança de 21/09). Enquanto
eles não existirem, cancelamento e reembolso se resolvem pelo painel da Stripe,
à mão.

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
