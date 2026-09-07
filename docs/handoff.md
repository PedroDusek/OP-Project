# Handoff — estado em 07/09/2026

Retomada de contexto. O que existe, o que foi decidido e por quê, e onde parou.

## Onde as coisas estão

| | |
|---|---|
| Repositório | `C:\dev\optcg` — **fora do OneDrive**, de propósito (decisão 001) |
| Remote | `github.com/PedroDusek/OP-Project`, **público**, por SSH |
| Branch | `main`, 13 PRs mergeados, CI verde em todos |
| Produto | **ColeXa**, domínio `colexa.com.br` |
| Snapshot do catálogo | `C:\dev\optcg-snapshot` — 60 páginas HTML, **fora do repositório** |
| PDFs de modelagem | `docs/modelagem/` |
| Especificação de marca e UI | `docs/marca/COLEXA_Especificacao_Oficial_UI_Design_Marca_v1.2.docx` |

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

**Checkpoints 0 a 6 concluídos.** 217 testes de unidade, integração e
componente, mais 12 de responsividade no Playwright. Lint, typecheck e build
passando.

| # | Entregue |
|---|---|
| 0 | Análise dos dois modelos, 24 tabelas, divergências mapeadas |
| 1 | Arquitetura, camadas impostas por lint, delete policy relação a relação |
| 2 | Banco: 24 tabelas, 10 `CHECK`, 3 triggers, 18 índices únicos, 26 FKs |
| 3 | Catálogo: parser, importação idempotente, busca com filtros |
| 4 | Backend base: taxonomia de erro, validação Zod, fronteira de sessão |
| 5 | Autenticação Supabase, propriedade de recurso, limite de taxa |
| 6 | Frontend base: marca vetorizada, design system, shell responsivo, 20+ componentes |

**Banco de produção populado e conferido:** 2.785 cartas, 4.843 variantes, 60
sets, 4.842 impressões — números idênticos ao local, estrutura conferida objeto
a objeto.

## As decisões que mais restringem o que vem depois

As 29 estão em `decisions.md`. Estas mudam o que se pode fazer:

- **019 + 020** — o catálogo vem do site oficial da Bandai, cujos termos proíbem
  reprodução sem permissão. O risco foi assumido explicitamente pelo dono do
  produto, com mitigações **obrigatórias**: requisições serializadas com
  intervalo, apenas dados factuais, imagens referenciadas na origem e nunca
  copiadas, atribuição visível, e o catálogo nunca reexposto como API pública.
- **026** — consequência direta da 020 no frontend: a imagem de carta **não**
  passa pelo otimizador do `next/image`, que baixaria o arquivo e o serviria do
  nosso domínio. É `<img>` com proporção reservada por CSS.
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
- **Seção 19 da especificação de marca** — a interface **não usa** personagem,
  cena, página de mangá, logo de franquia ou ilustração de terceiro como
  decoração. Arte de franquia só dentro da imagem da carta catalogada. Isso
  restringe toda tela daqui para frente: capa de set, avatar e ilustração de
  estado vazio usam formas próprias.

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
8. **O roxo escuro da paleta não serve como cor de texto.** `#504797` sobre a
   superfície escura dá 2.18:1, e sobre `accent-soft` cai para 1.82:1. Ele foi
   feito para **receber** texto branco por cima (7.8:1). Para ênfase como tinta
   existe o token `accent-ink`. Ver `design-system.md` 1.3.
9. **`Slot` do Radix exige um filho único.** `Button asChild` com o indicador de
   progresso passava dois nós e quebrava em tempo de build, não de tipo.
10. **jsdom não avalia media query.** Nenhum teste de componente prova
    responsividade; para isso existe `npm run test:e2e`.

## Pendências

**Nada bloqueia o próximo checkpoint.**

### Decisões que o dono do produto ainda pode querer revisitar

- As três cores semânticas — sucesso `#146C43`, perigo `#A5271F`, atenção
  `#7A5300`, com seus pares no tema escuro — **não vêm da especificação**. Foram
  derivadas e medidas por contraste. Trocar é uma linha por tema em
  `globals.css`, e nenhum componente muda.
- `/design-system` é o guia de estilo, fora da navegação e fora dos buscadores.
  Antes de publicar o produto, decidir se continua acessível precisa ser uma
  escolha consciente.
- **Múltiplos TCGs.** As telas 08 e 36 preveem Pokémon, Magic, Yu-Gi-Oh!,
  Lorcana e Digimon como "em breve", mas o modelo de dados aprovado não tem
  nenhum conceito de TCG — as 24 tabelas são de One Piece. Introduzir isso é
  alteração do modelo e precisa de aprovação.

### Pendências que não bloqueiam

- `users.plan` pode ser derivável de `premium_until` — depende da política
  comercial, que a especificação reserva ao dono do produto.
- Limite de taxa não escala horizontalmente: contador em memória de processo.
- Node 20 depreciado pelo SDK do Supabase.
- O `middleware.ts` está deprecado no Next 16, que agora prefere `proxy.ts`. O
  build avisa a cada execução. Migração mecânica, não feita neste checkpoint por
  ser mudança na fronteira de sessão do Checkpoint 5.
- Pagamento (Checkpoint 15): Supabase não processa. Para assinatura recorrente
  no Brasil, conta Stripe brasileira **não** tem Pix Automático; PSPs nacionais
  como Asaas e Mercado Pago têm.

## Próximo passo

**Telas de entrada e autenticação na interface** (telas 01 a 04): splash,
landing, criar conta e entrar. Ficaram fora do Checkpoint 6 pela decisão 029.

Dois bloqueios que **não são de código** e precisam do dono do produto antes:

1. **Google e Apple como provedores** precisam ser habilitados no painel do
   Supabase. O assistente não faz isso.
2. **Termos de Uso e Política de Privacidade** — o texto é decisão do dono do
   produto, e a tela 03 exige o aceite dos dois.

Depois disso, a ordem natural é catálogo (telas 09 a 12), carta e variantes
(13 a 16), coleção (17 a 20), armazenamento (21 a 24), edição em massa (25 a 28)
e trocas (29 a 35).

O protocolo continua: uma branch e um PR por checkpoint, o assistente merge
quando estiver completo e sem pendência, e para antes de iniciar o próximo
(decisão 016).
