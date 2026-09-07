# Handoff — estado em 06/09/2026

Retomada de contexto. O que existe, o que foi decidido e por quê, e onde parou.

## Onde as coisas estão

| | |
|---|---|
| Repositório | `C:\dev\optcg` — **fora do OneDrive**, de propósito (decisão 001) |
| Remote | `github.com/PedroDusek/OP-Project`, **público**, por SSH |
| Branch | `main`, 12 PRs mergeados, CI verde em todos |
| Produto | **ColeXa**, domínio `colexa.com.br` |
| Snapshot do catálogo | `C:\dev\optcg-snapshot` — 60 páginas HTML, **fora do repositório** |
| PDFs de modelagem | `docs/modelagem/` |

## Ambiente

| | |
|---|---|
| Node | 20.20.2 — o `@supabase/supabase-js` já avisa que 20 está depreciado |
| PostgreSQL local | 18.6, bancos `optcg` e `optcg_test` |
| Produção | Supabase, região São Paulo, banco e autenticação |
| `.env` | 8 variáveis, todas preenchidas, ignorado pelo Git |

**Produção nunca é alvo padrão.** `DATABASE_URL` é sempre o banco local; o
Supabase só é alcançado por `npm run supabase <migrate|import|status>`, que
imprime o destino antes de agir e recusa se a URL apontar para `localhost`. Não
existe comando de reset para produção, de propósito.

## O que está pronto

**Checkpoints 0 a 5 concluídos.** 160 testes, lint, typecheck e build passando.

| # | Entregue |
|---|---|
| 0 | Análise dos dois modelos, 24 tabelas, divergências mapeadas |
| 1 | Arquitetura, camadas impostas por lint, delete policy relação a relação |
| 2 | Banco: 24 tabelas, 10 `CHECK`, 3 triggers, 18 índices únicos, 26 FKs |
| 3 | Catálogo: parser, importação idempotente, busca com filtros |
| 4 | Backend base: taxonomia de erro, validação Zod, fronteira de sessão |
| 5 | Autenticação Supabase, propriedade de recurso, limite de taxa |

**Banco de produção populado e conferido:** 2.785 cartas, 4.843 variantes, 60
sets, 4.842 impressões — números idênticos ao local, estrutura conferida objeto
a objeto.

## As decisões que mais restringem o que vem depois

As 25 estão em `decisions.md`. Estas mudam o que se pode fazer:

- **019 + 020** — o catálogo vem do site oficial da Bandai, cujos termos proíbem
  reprodução sem permissão. O risco foi assumido explicitamente pelo dono do
  produto, com mitigações **obrigatórias**: requisições serializadas com
  intervalo, apenas dados factuais, imagens referenciadas na origem e nunca
  copiadas, atribuição visível, e o catálogo nunca reexposto como API pública.
- **021** — `effects` fica vazia. Os nove efeitos da especificação não aparecem
  literalmente na fonte; preenchê-los seria inferir classificação.
- **022** — mecânicas só entram por allowlist de 10 termos. Dos 217 termos entre
  colchetes no catálogo, **195 são nomes de carta**: sem a allowlist o produto
  teria uma mecânica chamada "Sanji".
- **024** — 131 produtos promocionais sem código viram um set único `PROMO`.
- **025** — autenticação terceirizada. Não existe senha no nosso banco.
- **007** — reduzir quantidade abaixo do alocado devolve **conflito com as
  alocações atuais** para o usuário resolver, não erro seco nem desalocação
  automática. Isso obriga a API a ter formato de conflito estruturado.

## Armadilhas já pagas — não repetir

1. **Prisma gerencia índices.** Um índice criado em SQL bruto vira `DROP INDEX`
   na próxima migration. Se o Prisma sabe expressar, declare no schema; se não
   sabe (`CHECK`, trigger, função), escreva em SQL. Nunca os dois. A CI tem
   checagem de drift que falha se essa fronteira for violada.
2. **`CHECK` com coluna anulável precisa de `COALESCE`.** `NULL IN (...)` dá
   `NULL`, e `CHECK` só reprova em `FALSE`. Um `BINDER` sem propósito passava.
3. **Nem tudo entre colchetes é mecânica** — ver decisão 022.
4. **Leader reusa a `div` de custo com rótulo `Life`** no HTML da fonte.
5. **Descarte silencioso é pior que rejeição.** 538 variantes ficaram sem set
   porque o parser ignorava linhas fora do formato esperado, sem avisar.
6. **`tsc` guarda cache** em `.tsbuildinfo`; erro de tipo que insiste depois da
   correção costuma ser isso.
7. **Escrever no Supabase é lento.** A importação completa levou 25 minutos
   contra 40 segundos no local. Use `npm run supabase import --from=DIR`.

## Pendências

**Nada bloqueia o Checkpoint 6.** A paleta foi confirmada pelo dono do produto e
as telas de referência existem.

### Paleta oficial

| Token | Claro | Escuro |
|---|---|---|
| Fundo | `#F2F2F3` | `#131219` |
| Roxo (ênfase) | `#38287B` | `#504797` |
| Texto | `#000000` | `#FFFFFF` |

O roxo **muda entre os temas**, e não é o mesmo tom clareado: `#504797` é mais
claro e menos saturado, para manter contraste sobre o fundo escuro. Use dois
tokens, nunca um com filtro.

Confirmação útil: a conversão do CMYK pelo perfil embutido dera `#38277B`, um
dígito do valor real. O perfil estava certo.

### Referência de telas

`docs/referencia-telas/` tem nove PNGs cobrindo Login, Início, Catálogo, Carta e
Variante, Coleção, Armazenamento, Edição em massa, Wants + Trades, e Trocas com
histórico e perfil. **Leia essas imagens antes de desenhar qualquer tela** — elas
são a intenção de produto, e o Checkpoint 6 deve nascer delas.

### Ainda falta produzir

SVG e PNG da marca em RGB com transparência. Os JPGs de 4500 px em CMYK que
estão em `docs/marca/originais/` são exportação de impressão e não servem para
interface.

**Pendências que não bloqueiam:**

- `users.plan` pode ser derivável de `premium_until` — depende da política
  comercial, que a especificação reserva ao dono do produto.
- Limite de taxa não escala horizontalmente: contador em memória de processo.
- Node 20 depreciado pelo SDK do Supabase.
- Pagamento (Checkpoint 15): Supabase não processa. Para assinatura recorrente
  no Brasil, conta Stripe brasileira **não** tem Pix Automático; PSPs nacionais
  como Asaas e Mercado Pago têm.

## Próximo passo

**Checkpoint 6 — Frontend base mobile-first**: layout, navegação,
responsividade, componentes e design system. É onde a cor da marca entra em
tudo, e onde o produto fica visível pela primeira vez.

O protocolo continua: uma branch e um PR por checkpoint, o assistente merge
quando estiver completo e sem pendência, e para antes de iniciar o próximo
(decisão 016).
