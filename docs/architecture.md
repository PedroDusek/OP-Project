# Arquitetura

## 1. Stack

| Camada | Escolha |
|---|---|
| Runtime | Node.js 20 |
| Framework | Next.js 16, App Router |
| Linguagem | TypeScript, `strict` |
| ORM | Prisma 7, com driver adapter `@prisma/adapter-pg` |
| Banco de dados | PostgreSQL 17 ou superior |
| Validação | Zod |
| Autenticação | Supabase Auth, terceirizada (decisão 025) |
| Hospedagem em produção | Supabase, região São Paulo |
| Estilos | Tailwind CSS |
| Primitivos de UI | Radix UI via shadcn/ui |
| Estado de servidor no cliente | TanStack Query |
| Virtualização de listas | TanStack Virtual |
| Testes unitários e de integração | Vitest |
| Testes ponta a ponta | Playwright |
| Lint e formatação | ESLint, Prettier |

A justificativa da stack está em `decisions.md` 002 e 003.

Nada aqui é escrito à mão onde existe biblioteca madura: ORM, validação,
primitivos de UI e ferramentas de teste são bibliotecas, e a autenticação é
terceirizada por inteiro. Nenhuma dependência entra sem necessidade concreta.

---

## 2. Camadas

A separação exigida é por módulo, imposta por regras de lint, e não por dividir o
sistema em processos separados.

```
src/
  app/                    Rotas do Next.js: páginas e route handlers. Finas.
  components/             Componentes de UI. Sem regra de negócio.
    ui/                   primitivos sem domínio: botão, campo, chip, sheet
    layout/               shell, navegação inferior e lateral
    brand/                símbolo e logotipo
    theme/                provedor e controle de tema
    catalog/ collection/ storage/ trade/   componentes com vocabulário do domínio
  server/
    domain/               Funções e tipos puros. Sem I/O, sem Prisma, sem HTTP.
    application/          Casos de uso. Dono das transações e dos locks.
    infrastructure/       Cliente Prisma, repositórios, provedores externos.
    http/                 Schemas Zod, mapeamento de erro, guardas de autorização.
  lib/                    Utilidades compartilhadas entre cliente e servidor.
prisma/                   schema.prisma e migrations
tests/
  domain/                 testes unitários puros, sem banco
  integration/            PostgreSQL real, transações reais
  components/             Testing Library em jsdom, sem banco
  e2e/                    Playwright contra o build de produção
```

### 2.1 Regras de dependência

- `domain` não importa nada das outras camadas. É puro, síncrono e totalmente
  testável sem banco.
- `application` pode importar `domain` e `infrastructure`.
- `app` e `components` podem importar `application` e `http`, nunca
  `infrastructure` diretamente.
- `components` nunca contém regra de negócio. Todo número exibido na tela é
  calculado no servidor.

Essas regras são impostas pela regra `no-restricted-imports` do ESLint, de modo
que uma violação quebra o build em vez de depender de disciplina.

### 2.2 O que fica onde

| Assunto | Camada |
|---|---|
| Aritmética de playset, progresso, disponibilidade e matching | `domain` |
| Fronteiras de transação, locks de linha, advisory locks | `application` |
| Verificação de propriedade | `application`, em todo caso de uso |
| Consultas Prisma, SQL bruto para travamento | `infrastructure` |
| Parsing da requisição, formato da resposta, status HTTP | `http` |

---

## 3. Backend

### 3.1 API

Route handlers em `app/api`. Leituras que apenas alimentam uma página são
servidas por React Server Components chamando os mesmos casos de uso
diretamente, o que evita um salto HTTP desnecessário mantendo uma única
implementação de cada regra.

Todo endpoint:

1. resolve a sessão no servidor;
2. valida a entrada com um schema Zod;
3. chama exatamente um caso de uso;
4. mapeia o resultado para a resposta.

Um `user_id` nunca é lido do corpo da requisição nem da query string. Vem sempre
da sessão.

### 3.2 Transações e concorrência

Toda operação que altera quantidades, alocações ou estado de trade roda numa
única transação. Quando a correção da escrita depende de linhas que acabaram de
ser lidas, a transação adquire um lock explícito antes:

| Operação | Lock |
|---|---|
| Alterar quantidade possuída ou alocações | `SELECT ... FOR UPDATE` na linha de `collection_items` |
| Bulk edit dentro de um armazenamento | o mesmo lock, um por item tocado, em ordem crescente de id |
| Ativar um trade | `pg_advisory_xact_lock` por participante |
| Concluir um trade | advisory locks nos dois participantes, depois locks de linha nos itens afetados |

Locks são sempre adquiridos em ordem crescente de identificador, para que
operações concorrentes não entrem em deadlock por pegarem os mesmos locks em
ordens opostas.

O bulk edit segue o fluxo especificado: o usuário edita localmente, revisa,
confirma, e o backend aplica o conjunto inteiro numa transação que ou commita ou
sofre rollback. Nenhuma tabela dedicada participa disso.

### 3.3 Tratamento de erro

Uma única taxonomia de erro, mapeada uma vez na fronteira HTTP:

| Erro de domínio | Status | Corpo |
|---|---|---|
| `ValidationError` | 400 | mensagens por campo |
| `AuthenticationError` | 401 | mensagem genérica |
| `AuthorizationError` | 403 | mensagem genérica |
| `NotFoundError` | 404 | mensagem genérica |
| `ConflictError` | 409 | `code` legível por máquina e os dados necessários para resolver |
| `RateLimitError` | 429 | indicação de nova tentativa |
| inesperado | 500 | mensagem genérica e um id de correlação |

O caso 409 carrega estrutura, porque reduzir a quantidade abaixo do que está
alocado devolve as alocações atuais para que o cliente apresente a tela de
resolução. Detalhes internos, texto de SQL e stack traces nunca são enviados ao
cliente; ficam no log, associados ao id de correlação.

### 3.4 Autenticação

**Terceirizada** (decisão 025). O Supabase guarda e verifica a credencial; a
senha nunca chega ao nosso servidor e não existe hash no nosso banco. Sessão em
banco do provedor, portanto revogável.

O sistema não fala com o provedor: fala com a interface `SessionProvider`, em
`src/server/http/session-provider.ts`. Trocar de provedor mexe numa
implementação, não nas rotas nem nos casos de uso — e é isso que permite os
testes rodarem sem rede, com um provedor falso.

`users.auth_user_id` amarra a conta do provedor à nossa linha. Traduzir uma
identidade externa em usuário é caso de uso, não detalhe de transporte, então
vive em `application/auth/resolve-user.ts`: é ali que a conta e a coleção nascem
na primeira visita, porque "todo usuário tem exatamente uma coleção e ela nasce
vazia" é regra de negócio.

Uma conta anonimizada não autentica, mesmo com sessão válida no provedor.

**Validação local do token.** A sessão é resolvida por `getClaims()`, que
confere a assinatura do JWT contra as chaves públicas do projeto sem sair da
máquina. As alternativas são piores em pontos diferentes: `getSession()` não
revalida o token e por isso não serve para decidir acesso, e `getUser()` custa
uma ida à rede por requisição — e já medimos o que uma ida até São Paulo custa.

**Renovação fica no middleware.** O token expira em cerca de uma hora, e quem
consegue devolver `Set-Cookie` antes do handler é o middleware. O provedor usado
pelas rotas só lê cookie, de propósito: escrever em dois lugares daria duas
fontes de verdade para o mesmo cookie.

**Criar e destruir sessão é outra coisa.** `AuthProvider`, em
`src/server/http/auth-provider.ts`, recebe um `CookieStore` capaz de escrever, e
é usado por entrar, cadastrar, sair e redefinir senha. Não conflita com o
parágrafo acima: ler acontece em toda requisição e concorre com a renovação;
criar e destruir acontece uma vez, numa ação explícita, e não concorre com nada.

**Entrar acontece no servidor** (decisão 031). Os formulários são
`<form action={serverAction}>`, e não existe cliente Supabase no pacote enviado
ao navegador. É o que mantém a validação, o limite de tentativas e o mapeamento
de erro num lugar só — e o que faz o formulário funcionar sem JavaScript.

**Quais provedores sociais existem vem do provedor** (decisão 032), não de
variável de ambiente, para que a tela nunca ofereça um botão que termina em erro.

`APP_URL` é obrigatória em produção: os links de confirmação de e-mail e de
redefinição de senha precisam voltar para o ambiente certo, e derivar isso do
cabeçalho `Host` deixaria quem chama escolher o destino de um link que cria
sessão.

### 3.5 Autorização

A propriedade do recurso é verificada dentro do caso de uso, contra o usuário da
sessão, em toda leitura e toda escrita.

**Escopar a consulta, e não verificar depois.** Existem duas formas de proteger
um recurso alheio:

| | Recurso alheio | Recurso inexistente |
|---|---|---|
| Buscar por id e comparar o dono | 403 | 404 |
| Buscar por id **e** dono | 404 | 404 |

A segunda é a adotada. A primeira parece mais informativa e é justamente por
isso que vaza: a diferença entre 403 e 404 conta quantos binders o vizinho tem.
`ownedBy(user)` monta o filtro; `assertOwnedBy` existe para o caso em que a linha
já veio de outro lugar, e lança `NotFoundError`, não `AuthorizationError`.

`assertPermitted` é o oposto e responde 403: a pessoa vê o recurso e o que se
recusa é a operação. Esconder algo que ela comprovadamente enxerga seria mentir.

As telas de entrada — landing, entrar, criar conta, recuperar senha — e as
páginas legais são públicas. O layout de `src/app/(app)` exige sessão e
redireciona para `/entrar?next=…`, mas isso é **conveniência de navegação**: a
proteção real continua sendo a verificação de propriedade dentro do caso de uso,
que valeria mesmo sem o redirecionamento.

A rota pública do Trade Binder é o único caminho de leitura não autenticado. Ela
resolve um local de armazenamento pelo token, confirma que o propósito é `TRADE`
e que o dono é Premium, e devolve apenas aquele binder.

### 3.5.1 Limite de taxa

Três cotas, todas por identidade e não por rota:

| Cota | Chave | Valor |
|---|---|---|
| Leitura do catálogo | usuário | 300 / minuto |
| Tentativas de entrar | endereço de e-mail | 10 / 10 minutos |
| Operações que enviam e-mail | endereço de e-mail | 3 / 15 minutos |

A cota de entrar conta **toda** tentativa, e não só as que falham: contar apenas
falhas deixaria a cota infinita para quem acerta, e ela existe contra quem está
chutando até acertar. É por endereço porque o ataque que importa é adivinhar a
senha de uma conta; por IP seria fácil de contornar e bloquearia gente inocente
atrás do mesmo NAT.

Contador por janela fixa, chaveado por **usuário** e não por rota — limitar por
rota deixaria uma pessoa derrubar a cota de todas as outras.

A leitura de catálogo tem cota generosa para uso humano e apertada o bastante
para que extrair o catálogo inteiro pela API não valha a pena. É o que sustenta
na prática o compromisso da decisão 020 de nunca reexpô-lo.

O contador vive na memória do processo. Com mais de uma instância, cada uma conta
sozinha e o limite efetivo multiplica. Isso contém abuso acidental e script
ingênuo, não alguém determinado; quando houver mais de uma instância, o contador
precisa sair para um lugar compartilhado.

### 3.6 Segurança

- Nenhuma senha passa pelo nosso servidor nem é armazenada por nós: credencial e
  hash são responsabilidade do provedor (decisão 025).
- Rate limiting na rota pública de trade e nas rotas de escrita.
- CORS restrito à origem da aplicação.
- Todos os segredos vêm de variáveis de ambiente, nunca do código, nunca
  versionados.
- O Prisma parametriza toda consulta; SQL bruto é usado apenas para travamento e
  é sempre parametrizado.
- Logs nunca contêm senhas, tokens ou cookies de sessão.
- Tokens públicos são 32 bytes aleatórios em base64url, gerados com
  `crypto.randomBytes`, nunca derivados de um id interno.

---

## 4. Frontend

### 4.1 Mobile-first

O design começa em 360px e se expande. Não é um layout de desktop reduzido.

| Breakpoint | Alvo |
|---|---|
| base | celular, coluna única, navegação inferior |
| `md` | tablet, coluna lateral só com ícones, filtros em painel |
| `lg` | desktop, grid mais largo, coluna lateral com rótulos |

O shell está em `src/components/layout/app-shell.tsx`. As duas navegações são a
**mesma** lista de destinos, em `layout/navigation.ts`: com duas listas, um
destino novo entraria numa e sumiria da outra.

O comportamento responsivo é verificado em navegador de verdade
(`tests/e2e/responsive.spec.ts`), porque jsdom não avalia media query.

Padrões: barra de navegação inferior, bottom sheets para filtros e edição de
quantidade, drawers para navegação secundária, alvos de toque de no mínimo 44px,
steppers de quantidade alcançáveis com um polegar.

Tabelas grandes que forçam rolagem horizontal no celular são evitadas. As
listagens de coleção e catálogo são grids orientados a imagem; a quantidade
aparece como badge discreto sobre a imagem.

### 4.2 Performance

- Paginação e filtro no servidor em toda listagem. O catálogo nunca é buscado
  inteiro.
- **Imagem de carta não passa pelo otimizador do `next/image`** (decisão 026): o
  otimizador baixaria e serviria o arquivo do nosso domínio, e a decisão 020 nos
  obriga a apenas referenciar a origem. É `<img>` com `loading="lazy"` e a
  proporção 5/7 reservada por CSS, o que também evita salto de layout.
  `next/image` continua valendo para imagem própria, quando houver.
- Grids virtualizados em listas longas.
- Busca com debounce; a busca exata por código vai direto ao índice único.
- TanStack Query para cache e listas infinitas nas telas interativas; React
  Server Components na primeira renderização.

### 4.3 Design system

Tokens, tema claro e escuro, forma, tipografia, os treze componentes da
especificação de marca e os oito estados obrigatórios estão em
`docs/design-system.md`. As decisões 026, 027 e 028 registram o que foi
escolhido e por quê.

### 4.4 Apresentação da carta

A interface é visual. A imagem é o elemento principal. Ao abrir uma carta,
aparecem suas informações, a quantidade possuída, a gestão de quantidade, onde as
cópias estão guardadas, o preço, e suas variantes e sets.

---

## 5. Integrações

Duas interfaces isolam o dado externo. Nenhuma é consultada durante a
renderização de página; depois da importação, o banco interno é a fonte
operacional.

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

As importações são idempotentes: rodar duas vezes não insere nada novo. Os
detalhes, e a questão ainda aberta de como identificar variantes entre execuções,
estão em `integrations.md`.

---

## 6. Estratégia de testes

| Nível | Ferramenta | Escopo |
|---|---|---|
| Unitário de domínio | Vitest | aritmética de playset, progresso, disponibilidade e matching. Sem banco. Os dez cenários obrigatórios vivem aqui. |
| Integração | Vitest contra um PostgreSQL de teste real | constraints, triggers, transações, concorrência, propriedade, idempotência da importação |
| API | Vitest | route handlers, validação, códigos de status, autorização |
| Componente | Vitest com Testing Library, em jsdom | comportamento e acessibilidade dos componentes; contraste dos tokens |
| Ponta a ponta | Playwright | responsividade nas três larguras; depois: cadastro e login, adicionar à coleção, alocar em armazenamento, want list, compartilhar Trade Binder, um trade completo |

São **dois projetos do Vitest**, com ambientes diferentes: `server` em Node, com
o `globalSetup` que aplica as migrations, e `components` em jsdom, sem banco. A
separação existe para que escrever interface não dependa de ter PostgreSQL de pé:
`npm run test:ui` roda só os componentes.

O contraste dos tokens é verificado lendo `globals.css` e calculando as razões
(`tests/components/contrast.test.ts`). Lê o CSS em vez de repetir os valores em
TypeScript, porque uma cópia divergiria no dia em que alguém ajustasse um tom.

Os testes de integração rodam contra `TEST_DATABASE_URL`, que é recriado pelas
migrations antes da suíte. Eles nunca tocam o banco de desenvolvimento.

Concorrência é testada explicitamente, não presumida: duas alocações simultâneas
no mesmo item da coleção não podem ultrapassar a quantidade possuída, e duas
tentativas simultâneas de ativar um trade do mesmo usuário precisam deixar
exatamente um ativo.

O comportamento responsivo é verificado no Playwright em viewports de celular
(360 px), tablet (768 px) e desktop (1280 px). É o único nível que consegue:
jsdom não avalia media query, então um teste de componente passaria com as duas
navegações visíveis ao mesmo tempo.

---

## 7. Estratégia de Git

Aprovada, decisão 016.

- `main` sempre publicável. Sem commits diretos.
- Uma branch por checkpoint, no formato `checkpoint-N/<tema>`; branches `fix/`,
  `docs/` e `chore/` para trabalhos menores.
- Um pull request por checkpoint, descrevendo o que mudou, os testes executados,
  as decisões tomadas e qualquer quebra de compatibilidade.
- O assistente abre a branch, abre o pull request e faz o merge quando o
  checkpoint está completo e sem decisão pendente.
- Merge commit em vez de squash, para que os commits semânticos internos ao
  checkpoint sobrevivam no histórico.
- Conventional Commits nas mensagens.
- Nada é mergeado enquanto houver decisão pendente naquele checkpoint.
- Mergear não é autorização para começar o próximo checkpoint. A parada entre
  checkpoints permanece.

## 8. Integração contínua

Aprovada, decisão 017. Entra no Checkpoint 2, junto com o primeiro código.

Um workflow do GitHub Actions em pull requests e na `main`: instalação, lint,
verificação de tipos, testes unitários, testes de integração contra um container
de serviço PostgreSQL, checagem de migration e build.

Nenhuma infraestrutura de produção, alvo de deploy ou ambiente é configurado sem
aprovação explícita.
