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
| Autenticação | Auth.js v5, provider de credenciais |
| Hash de senha | Argon2id |
| Estilos | Tailwind CSS |
| Primitivos de UI | Radix UI via shadcn/ui |
| Estado de servidor no cliente | TanStack Query |
| Virtualização de listas | TanStack Virtual |
| Testes unitários e de integração | Vitest |
| Testes ponta a ponta | Playwright |
| Lint e formatação | ESLint, Prettier |

A justificativa da stack está em `decisions.md` 002 e 003.

Nada aqui é escrito à mão onde existe biblioteca madura: hash, ORM, validação,
sessão, primitivos de UI e ferramentas de teste são todos bibliotecas. Nenhuma
dependência entra sem necessidade concreta.

---

## 2. Camadas

A separação exigida é por módulo, imposta por regras de lint, e não por dividir o
sistema em processos separados.

```
src/
  app/                    Rotas do Next.js: páginas e route handlers. Finas.
  components/             Componentes de UI. Sem regra de negócio.
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
  e2e/                    Playwright
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

Auth.js v5 com o provider de credenciais e hash Argon2id.

As sessões são baseadas em JWT, num cookie `httpOnly`, `secure`,
`sameSite=lax`. Isso é consequência deliberada do provider de credenciais, que
não suporta sessão em banco, e significa que o schema não ganha nenhuma tabela de
sessão, preservando o modelo aprovado.

O custo é que uma sessão não pode ser revogada no servidor antes de expirar. Por
isso o tempo de vida da sessão é mantido curto. Se revogação virar requisito,
será necessária uma tabela `sessions`, que é alteração do modelo aprovado e seria
levantada antes.

### 3.5 Autorização

A propriedade do recurso é verificada dentro do caso de uso, contra o usuário da
sessão, em toda leitura e toda escrita. Não existe caminho em que um recurso seja
buscado por id e devolvido sem essa verificação.

A rota pública do Trade Binder é o único caminho de leitura não autenticado. Ela
resolve um local de armazenamento pelo token, confirma que o propósito é `TRADE`
e que o dono é Premium, e devolve apenas aquele binder.

### 3.6 Segurança

- Argon2id para senhas, nunca texto puro, nunca hash rápido.
- Rate limiting em autenticação, cadastro e na rota pública de trade.
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
| `md` | tablet, duas colunas, filtros em painel lateral |
| `lg` | desktop, grid mais largo, navegação persistente |

Padrões: barra de navegação inferior, bottom sheets para filtros e edição de
quantidade, drawers para navegação secundária, alvos de toque de no mínimo 44px,
steppers de quantidade alcançáveis com um polegar.

Tabelas grandes que forçam rolagem horizontal no celular são evitadas. As
listagens de coleção e catálogo são grids orientados a imagem; a quantidade
aparece como badge discreto sobre a imagem.

### 4.2 Performance

- Paginação e filtro no servidor em toda listagem. O catálogo nunca é buscado
  inteiro.
- `next/image` com tamanhos responsivos e carregamento tardio para as imagens.
- Grids virtualizados em listas longas.
- Busca com debounce; a busca exata por código vai direto ao índice único.
- TanStack Query para cache e listas infinitas nas telas interativas; React
  Server Components na primeira renderização.

### 4.3 Apresentação da carta

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
| Componente | Vitest com Testing Library | componentes interativos |
| Ponta a ponta | Playwright | cadastro e login, adicionar à coleção, alocar em armazenamento, want list, compartilhar Trade Binder, um trade completo |

Os testes de integração rodam contra `TEST_DATABASE_URL`, que é recriado pelas
migrations antes da suíte. Eles nunca tocam o banco de desenvolvimento.

Concorrência é testada explicitamente, não presumida: duas alocações simultâneas
no mesmo item da coleção não podem ultrapassar a quantidade possuída, e duas
tentativas simultâneas de ativar um trade do mesmo usuário precisam deixar
exatamente um ativo.

O comportamento responsivo é verificado no Playwright em viewports de celular,
tablet e desktop.

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
