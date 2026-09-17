# Handoff — estado em 17/09/2026

Retomada de contexto. O que existe, o que foi decidido e por quê, e onde parou.

## Para retomar

1. `npm run dev` — **sempre reinicie**. O servidor guarda o cliente Prisma que
   carregou ao subir (armadilha 40), e só lê o `.env` ao subir — `RESEND_API_KEY`
   e `EMAIL_FROM` entraram nele em 17/09.
2. `npm run supabase status` — mostra o que produção tem e o que falta. Em
   17/09 ela ficou **em dia: 18 de 18 migrations**.
3. **O site está publicado em `https://colexa.fly.dev`** desde 17/09 (decisões
   089 e 090), para teste do dono do produto — ainda **não é o lançamento**.
   Publicar de novo é à mão: `development.md` 6.6.
4. Leia "Produção, em 17/09/2026", "A Social" e "Próximo passo", abaixo.

O acordo de trabalho e as camadas estão em `CLAUDE.md`, na raiz.

## Onde as coisas estão

| | |
|---|---|
| Repositório | `C:\dev\optcg` — **fora do OneDrive**, de propósito (decisão 001) |
| Remote | `github.com/PedroDusek/OP-Project`, **público**, por SSH |
| Branch | `main`, 116 PRs mergeados, CI verde em todos |
| Produto | **ColeXa**, domínio `colexa.com.br` |
| Snapshot do catálogo | `C:\dev\optcg-snapshot` — 60 páginas HTML, **fora do repositório** |
| PDFs de modelagem | `docs/modelagem/` |
| Especificação de marca e UI | `docs/marca/COLEXA_Especificacao_Oficial_UI_Design_Marca_v1.2.docx` |
| Dossiê para a advogada | Artifact `claude.ai/code/artifact/7cd1938f-1bf1-455b-bab2-81fb9c48d8d1` — compartilhado por link com **versão fixada**: republicar não chega a quem tem o link até o pin ser movido |

## Ambiente

| | |
|---|---|
| Node | 20.20.2 — o `@supabase/supabase-js` já avisa que 20 está depreciado |
| PostgreSQL local | 18.6, bancos `optcg` e `optcg_test` |
| Produção | Supabase em São Paulo (banco, autenticação, Storage) e o site na Fly.io em São Paulo, `colexa.fly.dev` |
| `.env` | ignorado pelo Git; desde 17/09 com `RESEND_API_KEY`, `EMAIL_FROM` (decisão 086) e `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (decisão 088) |

**Produção nunca é alvo padrão.** `DATABASE_URL` é sempre o banco local; o
Supabase só é alcançado por `npm run supabase <migrate|import|prices|status|storage>`, que
imprime o destino antes de agir e recusa se a URL apontar para `localhost`. Não
existe comando de reset para produção, de propósito.

## O que está pronto

**Checkpoints 0 a 13 concluídos, e a Social.** 1.474 testes de unidade, integração e
componente, mais 31 ponta a ponta. Lint, typecheck e build passando.

| # | Entregue |
|---|---|
| 0 | Análise dos dois modelos, 24 tabelas, divergências mapeadas |
| 1 | Arquitetura, camadas impostas por lint, delete policy relação a relação |
| 2 | Banco: 24 tabelas, 10 `CHECK`, 3 triggers, 18 índices únicos, 26 FKs |
| 3 | Catálogo: parser, importação idempotente, busca com filtros |
| 4 | Backend base: taxonomia de erro, validação Zod, fronteira de sessão |
| 5 | Autenticação Supabase, propriedade de recurso, limite de taxa |
| 6 | Frontend base: marca vetorizada, design system, shell responsivo, 20+ componentes |
| 7 | Entrada e autenticação na interface: landing, entrar, criar conta, recuperar senha, sair |
| 8 | Catálogo na interface: busca, filtros, sets, detalhe do set e da variante |
| 9 | Coleção na interface: grade, filtros, playsets, quantidade, progresso real |
| 10 | Binders: locais, alocação, upload de imagem, resolução da decisão 007 |
| — | Binders ganhou a direção inversa: organizar as cópias sem lugar (decisão 045) |
| 11 | Edição em massa: adicionar uma leva a um local, e transferir entre locais |
| 12 | Want list (29 e 30), Trade Binder (31), a negociação e a conclusão da troca |
| — | Preço de mercado das artes comuns, 96,7% do catálogo, pelo tcgcsv (decisão 050) |
| — | Preço em real pelo PTAX, e o aviso de quando foi conferido (decisão 051) |
| — | Reimpressão virou impressão, não variante (decisão 052) |
| — | Vínculo arte ↔ produto, e preço nas paralelas vinculadas (decisão 053) |
| — | Want list: adição em massa, revisão e a folha em imagem ou papel (057, 058) |
| — | Convite, cruzamento e negociação: servidor (055, 056) e interface (059) |
| — | Nome de usuário e as regras da rede escritas (decisão 060) |
| — | Navegação em gaveta: sete destinos e a conta, sem teto de cinco (decisão 061) |
| — | Concluir a troca: os dois marcam, e de onde as cartas saem (decisão 062) |
| — | A folha da want list se compartilha num toque (decisão 063) |
| — | Trade Binder público: um conjunto, e o link é da pessoa (decisão 064) |
| 13 | Troca ao vivo: consulta a cada 2s e a espera de 5s antes de confirmar (decisão 065) |
| — | Filtro de counter — 0, +1000, +2000 — em toda tela que filtra carta (decisão 066) |
| — | Folha em JPEG com a arte do catálogo quando falta vínculo com a fonte (decisão 067) |
| — | Vínculo por raridade e o arquivo de vínculos manuais: 478 → 623 paralelas com preço (decisão 068) |
| — | Tela `/dev/paralelas`, fora de produção, para mapear à mão as 287 cartas ambíguas (decisão 068) |
| — | Ordem de código dentro de cada filtro, com a carta reimpressa no lugar do código (decisão 069) |
| — | Link da Liga por tabela conferida coleção a coleção, e a tela `/dev/liga` (decisão 071) |
| — | Vínculo com o TCGplayer pelo tratamento conferido na Liga: 623 → 1.327 paralelas, US$ 39 mil → 182 mil (decisão 072) |
| — | "Veja no TCGplayer" na página da carta, a partir do vínculo: 2.697 normais e 1.327 paralelas |
| — | A edição da Liga desempata e a regra antiga não contradiz a Liga: 1.327 → 1.438 paralelas vinculadas (decisão 073) |
| — | Tela `/dev/liga/repetidas`: as 86 artes (42 cartas) que a Liga deixa iguais e travam o vínculo (decisão 073) |
| — | Sinônimos entre a Liga e o TCGplayer — SPR, Pandaman, Extended Art, Reprint PRB-01 (decisão 074) |
| — | Tela `/dev/liga/conflitos`: os 15 vínculos que discordam da Liga, para decidir caso a caso (decisão 074) |
| — | `-E-PAR`, edição e colchetes da Liga separam artes; pré-lançamento e reimpressão de outra edição (decisão 075) |
| — | A normal tem o preço do grupo da coleção do código, e não de uma reimpressão: 133 normais corrigidas (decisão 076) |
| — | `/dev/paralelas` mostra a carta inteira e pergunta o que a Liga contradiz; "Sem cartas vendidas" na página da carta (decisão 077) |
| — | Revisão do dono do produto: 777 respostas manuais, 1.642 de 1.646 paralelas com vínculo |
| — | Com dois acabamentos (Normal e Foil), vale o preço Normal (decisão 078) |
| — | A rede: listagem, busca por carta, binder de alguém, bloquear e denunciar (decisão 079) |
| — | O sino com os avisos do estado atual: cartas sem armazenamento (decisão 080) |
| — | Conversas entre pessoas da rede, e mensagem não lida no sino (decisão 081) |
| — | Convite direto para troca, e busca por nome na rede (decisão 082) |
| — | Todas as cartas na troca, em dois grupos; convite de troca no sino (decisão 083) |
| — | Social em páginas de sete; balão da conversa certo no Brave; convite aceito leva à troca (decisão 084) |
| — | A API de dados do Supabase sem permissão nenhuma nas nossas tabelas (decisão 085) |
| — | A denúncia chega por e-mail a suporte@colexa.com.br, assunto DENUNCIA, pelo Resend (decisão 086) |
| — | A página `/admin/denuncias` e `ADMIN_EMAILS` saíram: a denúncia é lida só pelo e-mail (decisão 087) |
| — | CAPTCHA (Cloudflare Turnstile) em entrar, criar conta e recuperar senha (decisão 088) — **ligado no Supabase em 17/09** |
| — | Login com Google ligado pelo dono do produto; o primeiro login de conta nova não dá mais erro (#109) |
| — | Hospedagem na Fly.io, uma máquina em São Paulo, publicação à mão (decisão 089) |
| — | Imagens das cartas na Fly: esperar 30 s, e o cache num volume (decisão 090) |
| — | Excluir a conta, com 30 dias para desistir e a tarefa diária que anonimiza (decisão 091) |
| — | Cabeçalhos de segurança, páginas de erro em português e indexação só no domínio oficial (decisão 092) |

### Produção, em 17/09/2026

**O site publicado na Fly.io** (decisões 089 e 090), em `https://colexa.fly.dev`,
para teste. O domínio `colexa.com.br` **não** aponta para ele ainda.

| | |
|---|---|
| Aplicação | `colexa`, uma máquina `shared-cpu-1x` de 1 GB em `gru`, sempre ligada |
| Volume | `colexa_cache`, 1 GB, montado em `.next/cache` (imagens otimizadas das cartas) |
| Segredos na Fly | `DATABASE_URL` (Session pooler, usuário `postgres.<ref>`, host `aws-0-sa-east-1.pooler.supabase.com`), `SUPABASE_SECRET_KEY`, `RESEND_API_KEY` |
| Valores em `fly.toml` | `APP_URL=https://colexa.fly.dev`, `EMAIL_FROM`, `SUPABASE_STORAGE_BUCKET` |
| GitHub | segredo `FLY_API_TOKEN` (token de deploy `publicar-github`, criado 16:01:34 de 17/09 — **o único ativo**; os cinco das tentativas foram revogados pelo dono do produto, conferido com `fly tokens list --app colexa`; vale até 2046, então vazou é revogar e gerar outro pelo Git Bash, armadilha 59); *variables* com os três `NEXT_PUBLIC_*` |
| Painéis | Turnstile com `colexa.fly.dev`; Supabase com `https://colexa.fly.dev/**` nas *Redirect URLs* (Site URL continua `http://localhost:3000`); Google com a origem `https://colexa.fly.dev` |

Conferido pelo assistente em 17/09: a checagem de saúde passa, o servidor roda
como `node`, o banco conecta, o CAPTCHA desenha, e a mesma imagem de carta leva
3,8 s na primeira vez e 0,1 s na segunda. O dono do produto entrou com Google,
navegou com as imagens carregando e viu as coleções vazias — o esperado.

**Produção tem 3 contas de teste** (criadas em 17/09 pelo `colexa.fly.dev`) e
nenhuma carta em coleção. As contas locais (`pedrodussel`, `testedusekin`) e as
cartas delas existem só no **banco local**: o `npm run dev` nunca escreve no
Supabase, só autentica nele. **Decisão do dono do produto: nada é copiado do
local**, e todas as contas serão excluídas antes do lançamento oficial, para
começar com banco limpo. A limpeza tem duas metades que andam juntas — as
contas em *Authentication → Users* e as linhas das pessoas no banco (catálogo e
preços ficam); uma sem a outra deixa login sem conta ou conta que renasce.

**Backup:** conferir o plano do Supabase antes de receber gente real. No
gratuito não há backup automático; o Pro (US$ 25/mês) tem diário. Recomendado ao
dono do produto em 17/09.

**Login com Google ligado** em 17/09 pelo dono do produto (Google Auth Platform,
cliente *Web application*, redirect do Supabase; `development.md` 6.3). Ele
entrou com a conta Google pelo `localhost`: a conta nasceu no **banco local**
(id 6), porque `DATABASE_URL` é sempre local. Quando o site for publicado, a
origem `https://colexa.com.br` entra no cliente do Google, e
`https://colexa.com.br/auth/callback` nas *Redirect URLs* do Supabase. A tela do
Google mostra o endereço do Supabase, e não colexa.com.br — mudar exige domínio
personalizado, que é pago.

**CAPTCHA ligado** no painel do Supabase em 17/09, pelo dono do produto, que
testou entrar, criar conta e recuperar senha. Conferido de fora: entrar pela API
sem token responde `400 captcha_failed` ("no captcha_token found"). Como o `.env`
local usa o mesmo projeto, **o desenvolvimento local também exige a chave
pública** — e abrir pelo IP da rede local pode fazer o widget recusar (decisão
088). Para desligar: o painel primeiro, a chave depois.

**Em dia: 18 de 18 migrations.** Em 17/09 entraram `rede_bloqueio_denuncia` e
`conversas` — as duas só criam tabelas — e depois `api_de_dados_sem_permissao`,
todas a pedido do dono do produto.

A segurança da API de dados foi conferida depois, só leitura: `anon` e
`authenticated` sem permissão em tabela nem sequência, RLS em 34 de 34 tabelas,
e a chave pública recebendo 401 em `sets`, `users` e `messages`. Em 16/09
tinham entrado as seis que faltavam desde 10/09 — `convite_de_troca`,
`revisao_apos_alteracao`, `nome_de_usuario`, `concluir_a_troca`,
`trade_binder_publico` e `troca_ao_vivo` — entraram em 16/09 com
`npm run supabase migrate`, a pedido do dono do produto. A única destrutiva
(`trade_binder_publico` apaga `storage_locations.public_token`) foi conferida
antes: produção tinha **zero usuários e zero locais**.

Preços, depois da `npm run supabase prices` das 15:33 UTC de 16/09, com os
arquivos de dados do `main`:

| | |
|---|---:|
| Normais com preço | **2.785 de 2.785** |
| Paralelas com vínculo | **1.642 de 1.646** (as 4 restantes respondidas "não tem na fonte") |
| Paralelas com preço | 1.548 — as outras 94 têm produto sem venda, e a página diz "Sem cartas vendidas" |
| Vínculos manuais aplicados | 773, mais 4 "não tem na fonte" |

Catálogo igual ao local: 2.785 cartas, 4.431 variantes, 60 sets, 4.834
impressões. Cotação PTAX de 15/09 (USD/BRL 5,149).

`npm run supabase status` compara as migrations com o repositório, diz quais
faltam e mostra o estado dos preços. **É o comando a rodar antes de publicar** —
produção já ficou duas migrations atrás sem ninguém notar, e o custo é a tela
inteira, não só a parte nova.

### O agendamento de preços está vivo

O workflow disparou **sozinho** em 09/09 e concluiu com sucesso, gravando zero —
o que é o esperado: só grava o que muda.

Ele rodou às **11:59 UTC**, e não às 07:00 do `cron`. O agendador do GitHub
atrasa sob carga, e horas de atraso são normais. Isso não quebra a tela porque
ela mostra o horário **real** da importação, lido de `price_imports`, e não o
horário configurado — mas significa que "atualizado hoje às 04:00" pode dizer
outra hora, e isso é verdade, não defeito.

## As decisões que mais restringem o que vem depois

As 74 estão em `decisions.md`. Estas mudam o que se pode fazer:

- **019 + 020** — o catálogo vem do site oficial da Bandai, cujos termos proíbem
  reprodução sem permissão. O risco foi assumido explicitamente pelo dono do
  produto, com mitigações **obrigatórias**: requisições serializadas com
  intervalo, apenas dados factuais, imagens referenciadas na origem e nunca
  copiadas, atribuição visível, e o catálogo nunca reexposto como API pública.
- **038** — revoga a 026 e altera uma mitigação da 020. O servidor da Bandai
  manda `cross-origin-resource-policy: same-site`, então o navegador **recusa**
  desenhar a imagem vinda direto da origem. Ela passa pelo otimizador do
  `next/image` e é servida do nosso domínio; o banco guarda só a URL.
- **030** — Termos de Uso e Política de Privacidade **não existem**, e isso é
  bloqueio de lançamento. Ver abaixo.
- **021** — `effects` fica vazia. Os nove efeitos da especificação não aparecem
  literalmente na fonte; preenchê-los seria inferir classificação.
- **022** — mecânicas só entram por allowlist de 10 termos. Dos 217 termos entre
  colchetes no catálogo, **195 são nomes de carta**: sem a allowlist o produto
  teria uma mecânica chamada "Sanji".
- **024** — 131 produtos promocionais sem código viram um set único `PROMO`.
- **025 + 031** — autenticação terceirizada, e o login acontece por Server
  Action. Não existe senha no nosso banco nem SDK de autenticação no navegador.
- **033 + 039** — busca e filtros moram na URL; a listagem rola sem paginação, e
  as levas seguintes passam pela API, que é onde a cota de leitura é cobrada.
- **040** — a listagem de cartas sai na ordem de lançamento, com promocionais no
  fim. A ordenação acontece em memória, e o limite dessa escolha está escrito na
  decisão: com um catálogo dez vezes maior, ela precisa migrar para o banco.
- **036** — substitui a 034. A ordem de lançamento **foi informada** pelo dono
  do produto e vive em `src/server/domain/catalog/sets.ts`; sets são separados
  em coleção, deck e promocional; e a contagem é exibida como "cartas".
- **037** — as imagens de carta **podem ser exibidas** (o dono do produto
  verificou), e o banco continua guardando só a URL.
- **007** — reduzir quantidade abaixo do alocado devolve **conflito com as
  alocações atuais** para o usuário resolver, não erro seco nem desalocação
  automática. Isso obriga a API a ter formato de conflito estruturado.
- **Seção 19 da especificação de marca** — a interface **não usa** personagem,
  cena, página de mangá, logo de franquia ou ilustração de terceiro como
  decoração. Arte de franquia só dentro da imagem da carta catalogada. Isso
  restringe toda tela daqui para frente: capa de set, avatar e ilustração de
  estado vazio usam formas próprias.

**Escopo:** múltiplos TCGs saíram do escopo por decisão do dono do produto em
07/09/2026. O produto é One Piece Card Game até o fim do projeto; escalar para
outros TCGs é projeto futuro. As telas 08 e 36 mostram outros TCGs como "em
breve" — é referência estética, não funcional, e não deve ser implementada.

**As telas de referência** em `docs/referencia-telas/` valem para **estética,
layout e aplicação de cor**, não para função. A função vem de
`business-rules.md`, do modelo de dados e da especificação oficial. Onde a
imagem e o documento discordarem, o documento vence — já discordaram na cor de
ênfase, e a paleta oficial prevaleceu.

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
11. **Um arquivo `'use server'` só pode exportar função assíncrona.** Exportar
    uma constante de lá **passa no build** e quebra no primeiro envio do
    formulário. Por isso `src/app/(auth)/state.ts` existe separado de
    `actions.ts`.
12. **O React reseta o `<form action={...}>` quando a ação termina**, inclusive
    em erro. Campo não controlado perde o que foi digitado a cada falha.
13. **O Next mantém um `role="alert"` fora do `main`** (`__next-route-announcer__`).
    Toda busca por alerta em teste ponta a ponta precisa ser escopada ao `main`,
    ou encontra dois elementos.
14. **Os códigos de set da fonte não são uniformes.** Convivem `OP01` e `OP-07`,
    `ST13` e `ST-01`, além de `OP14-EB04`. Ordenar por texto puro coloca `OP-07`
    antes de `OP01`. A ordenação natural está em
    `src/server/domain/catalog/sets.ts`.
15. **Vários nomes de set vêm cercados de hifens** — `-ROMANCE DAWN-`. A remoção
    é simétrica de propósito: só quando começa **e** termina com hifen, senão
    `BOOSTER PACK -X-` viraria um nome pela metade.
16. **Seletor frouxo em teste ponta a ponta quebra sozinho.** `nav:visible`
    funcionou até a paginação existir, que também é um `<nav>`. Localize pelo
    nome acessível.
17. **Texto branco sobre arte que não controlamos precisa de piso medido.** No
    cabeçalho do set, os 25% de opacidade da arte são o que mantém o contraste
    em 6.05:1 no pior caso. Aumentar a opacidade derruba esse piso.
18. **A imagem da Bandai não pode ser referenciada direto.** O servidor manda
    `cross-origin-resource-policy: same-site` e o navegador recusa, com
    `net::ERR_BLOCKED_BY_RESPONSE.NotSameSite` no console. O HTML fica correto,
    o CSS fica correto, e a imagem simplesmente não desenha — foi assim que
    passou despercebido por dois checkpoints. Toda imagem de carta passa por
    `CardArt`.
19. **O código da carta aparece duas vezes no DOM** — no texto e no lugar da
    arte que não carregou, dentro de `CardArt`. `getByText('OP01-001')` encontra
    dois elementos e o teste falha por ambiguidade. Localize a linha por algo
    que exista uma vez só: a barra de progresso, o botão, o `alt`.
20. **O jsdom aplica a validação nativa de formulário.** Um campo `required`
    vazio bloqueia o envio, e o teste que esperava o erro **do servidor** espera
    para sempre. Preencha o campo antes de submeter.
21. **`prisma migrate dev` exige `CREATEDB`** para o shadow database, que o papel
    `optcg` não tem. Escreva o SQL da migration à mão (ou com `migrate diff`) e
    aplique com `migrate deploy` — o mesmo comando da CI. Ver `development.md`
    2.2.
22. **`createClient` do `@supabase/supabase-js` não nasce no Node 20.** Ele monta
    um cliente de Realtime junto, que exige `WebSocket` global; o construtor
    lança antes de qualquer chamada. `@supabase/ssr` (autenticação) não passa por
    isso; o Storage passava. Por isso o provedor de imagens fala REST com
    `fetch`. Um dublê nos testes de caso de uso não pega isto — é preciso um
    teste que **instancie** o provedor de verdade.
23. **`Object.fromEntries(searchParams)` perde parâmetro repetido.** Fica com o
    último valor, sem erro: `?cor=Black&cor=Blue` filtrava só por azul. Use
    `getAll` quando o filtro puder ter mais de um valor — e desconfie de
    qualquer lugar que converta query string em objeto simples.
24. **Um elemento fixo com espaçamento engole toque mesmo vazio.** O
    `Toast.Viewport` era `fixed inset-x-0 bottom-0` com ~112 px de padding: uma
    faixa invisível sobre a barra de navegação, o "Carregar mais" e os
    controles de tema. No celular, nada ali embaixo respondia. Todo overlay
    fixo precisa de `pointer-events-none`, com `pointer-events-auto` só no
    conteúdo visível.
25. **A barra inferior não tem altura fixa.** São 56 px mais
    `env(safe-area-inset-bottom)`, que num aparelho com barra de gestos passa de
    30 px. Reservar 80 px fixos no `main` dava conta no navegador de mesa, onde
    a área segura é zero, e deixava o último elemento da página debaixo da barra
    no celular de verdade. Toda reserva de espaço para a barra soma a mesma
    `env()` que ela usa.
26. **O `next dev` recusa com 403 os arquivos de `/_next/` pedidos de uma
    origem que ele não conhece.** A página responde 200, o HTML aparece, todo
    link funciona — e **nenhum JavaScript carrega**. Sem erro no console,
    porque não há erro: o navegador pede o script, recebe 403 e segue. Foi
    assim que abrir pelo IP da rede deixou o app inteiro sem botão funcionando
    no celular. `allowedDevOrigins` no `next.config.ts` resolve, e lá a lista
    sai das interfaces da máquina — endereço fixo quebraria na próxima troca
    de IP.
27. **Script dentro de componente React não é reconciliado no cliente.** Ele
    causa divergência de hidratação, e o React descarta o HTML do servidor para
    refazer a árvore. Script pertence ao `<head>`; para escrever na tela sem o
    React desfazer, pendure o elemento fora da raiz dele.
28. **Diagnóstico que depende do React não diagnostica React.** A primeira
    versão da página `/diagnostico` mostrava "nenhum erro" exatamente quando
    nada funcionava, porque quem renderizava a linha era o componente que não
    tinha hidratado. A página e o gravador de erros eram andaime e já saíram —
    a lição fica.
29. **Server Action tem corpo de 1 MB por padrão.** Foto de celular tem de 3 a
    5 MB, então salvar com foto morria com "Body exceeded 1 MB limit" — erro do
    framework, longe da tela. `serverActions.bodySizeLimit` no `next.config.ts`,
    amarrado à mesma constante que o domínio usa para recusar.
30. **O iPhone pode entregar HEIC**, que o servidor recusa pelos bytes. Toda
    foto escolhida passa por `lib/prepare-image.ts`, que encolhe e converte
    para JPEG no próprio aparelho — resolve o formato, o tamanho e o corpo da
    ação de uma vez.
31. **O `Select` do Radix recusa item com valor vazio.** Ele reserva a string
    vazia para "nada escolhido", então uma opção "Todos" com `value=""` quebra o
    painel ao ser aberto. Use um valor de sentinela e traduza para `undefined`
    na borda.
32. **O `IntersectionObserver` é um stub vazio em `setup-dom.ts`.** Necessário
    para o jsdom não quebrar, mas deixa a rolagem infinita sem cobertura: um
    `ref` que não chegasse ao botão passaria batido. Quem mexer nela usa o
    observador controlável de `catalog-ui.test.tsx`.
33. **Arquivo de teste de componente que renderiza tela com Server Action
    precisa mocká-la.** Sem isso o Prisma entra no grafo e o arquivo só passa
    quando outro projeto do Vitest já carregou o `.env` no mesmo processo —
    verde na suíte inteira, vermelho sozinho.
34. ~~**A barra inferior tem cinco lugares.**~~ — **resolvido pela decisão
    061.** O teto era da barra, e não do produto: numa gaveta cada linha tem a
    altura de uma lista. A barra inferior deixou de existir, e nenhum destino
    fica escondido.
35. **`subTypeName` na fonte de preço é acabamento, não arte.** `Normal` e
    `Foil` são o mesmo produto impresso de dois jeitos. Filtrar por `Normal`,
    por analogia com o nosso `variantType`, descartava a cotação de 870 cartas
    cuja impressão base é foil — líder, SR, SEC. A cobertura ficou em 64% até
    isso ser medido.
36. **O tcgcsv responde `401` a quem chega sem `User-Agent`**, e o `fetch` do
    Node não manda nenhum.
37. **Heredoc do Bash no Windows come barra invertida dupla.** Um script com
    regex escrito por `cat <<'EOF'` chegou ao disco com as barras duplas
    reduzidas a uma e não compilou. Para arquivo com escape, use a ferramenta
    de escrita em vez do heredoc.
38. **Tag `<script>` na árvore do React reclama a cada navegação de cliente.**
    O layout raiz volta a renderizar no cliente numa navegação por `<Link>`, e
    o React acusa *"scripts inside React components are never executed when
    rendering on the client"* — dois erros por navegação no painel do Next. Não
    reproduz em carga limpa, só em navegação de cliente. A saída é `ThemeInit`,
    que emite a tag só na renderização do servidor.
39. **`next/script` com `beforeInteractive` NÃO inlina o código.** Ele empilha o
    conteúdo em `self.__next_s`, processado depois de o pacote carregar. Serve
    para script de terceiro que precede a hidratação, e **não** para mexer no
    DOM antes da primeira pintura — usar aqui traz o flash de tema de volta.
40. **Migration nova exige reiniciar o `next dev`.** O servidor guarda o cliente
    Prisma que carregou ao subir; `prisma generate` grava no disco e o processo
    em pé não vê. O sintoma é `Cannot read properties of undefined (reading
    'findFirst')` numa tabela que existe no banco e no schema — e os testes e o
    `build` passam, porque cada um gera o cliente antes de rodar. Reiniciar
    resolve; procurar o defeito no código não.
41. **O host direto do Supabase é IPv6 puro, e o runner do GitHub não tem
    IPv6.** `db.<ref>.supabase.co` tem só registro AAAA. Na máquina de quem
    desenvolve funciona; no GitHub Actions morre com
    `connect ENETUNREACH <endereço v6>:5432`, que não parece problema de rede.
    O agendamento precisa da string do **Session pooler**
    (`aws-N-<região>.pooler.supabase.com`), que tem IPv4.
42. **Cabeçalho CORS só aparece quando a requisição manda `Origin`.** Conferir
    com `curl -I` sem ele diz "não tem CORS" sobre servidores que têm — e essa
    conclusão errada quase enterrou a folha em JPEG (decisão 058).
43. **Vários downloads programáticos num toque só não sobrevivem ao Safari do
    iPhone.** Um download ali é uma navegação para o `blob:`, e a navegação
    seguinte cancela a anterior que ainda não terminou — sobra a última, e as
    notificações das outras aparecem mesmo assim, o que faz parecer que
    funcionou. Aumentar o intervalo entre os cliques é chutar um número que
    depende do tamanho do arquivo. A saída é um toque por arquivo, ou
    `navigator.share` com vários `files` (decisão 063).
44. **A tabela nova precisa entrar em três listas, não numa.** `schema.prisma` é
    só a primeira: `tests/integration/schema.test.ts` guarda a lista de tabelas
    aprovadas **e** a política de exclusão, e `tests/helpers.ts` guarda a ordem
    de truncação. Esquecer a terceira deixa lixo entre testes; esquecer a
    segunda quebra a CI, que é o desfecho bom — o guarda existe para que tabela
    nova não entre sem uma decisão que diga por que ela existe.
45. **A ativação do toque não sobrevive a trabalho assíncrono.** `navigator.share`
    exige ativação, e ela é gasta enquanto o código carrega imagens da rede — o
    compartilhamento é recusado com `NotAllowedError` depois de um `await` longo.
    Quem precisa compartilhar arquivo prepara o arquivo **antes** do toque, e
    deixa o toque só chamar `share`. Foi a parte não óbvia da decisão 063, e
    corrigir sem ela teria trocado um defeito por outro mais difícil de achar.
46. **`break-inside: avoid` em item de grade não segura a impressão.** O
    navegador fatia a **linha** da grade na borda da página, e não o item — a
    arte sai cortada ao meio. Aparece só da terceira página em diante, quando o
    acúmulo faz uma linha cair em cima da borda, e por isso passa numa lista
    curta. Conteúdo que precisa caber por página vira um bloco por página, com
    `break-after: page`. E a margem tem de ser nossa: com a margem padrão de cada
    navegador, o mesmo bloco cabe num e transborda no outro.
47. **Imagem preguiçosa não existe na hora de imprimir.** `next/image` só busca
    o que passou pela tela, e `window.print()` dispara na hora, sem esperar
    nada. O PDF sai com a primeira página completa e as seguintes **em branco** —
    e o defeito parece corte ou quebra de página, que é onde se perde tempo
    procurando. São duas metades: `eager` na arte, e esperar o `decode()` de cada
    uma antes de chamar a impressão.
48. **`navigator.share` não existe fora de contexto seguro.** Ele é gated em
    HTTPS, e o app aberto no celular pelo **IP da rede local em `http://`** — que
    é como se testa aqui — não é contexto seguro. O mesmo aparelho, no mesmo
    navegador, compartilha sem problema em `https://`. Isso custou **três
    rodadas**: a tela caía em silêncio nos botões de baixar, cada rodada parecia
    um defeito novo no compartilhamento, e a causa nunca esteve no código dele.
    Para testar de verdade existe `npm run dev:https`, e a tela agora diz o
    motivo em vez de calar.
49. **O iOS recusa `files` junto de `text` no compartilhamento.** `canShare`
    devolve `false` para o pacote inteiro, e o botão some num aparelho que
    compartilha imagem sem dificuldade nenhuma. Pergunte pelo pacote completo e,
    se ele não passar, pelos arquivos sozinhos — e mande **exatamente** o que foi
    aprovado: conferir um pacote e enviar outro é a forma mais direta de o iOS
    recusar sem dizer por quê.
50. **Certificado sem `extendedKeyUsage=serverAuth` o iOS recusa por política.**
    Desde o iOS 13 é exigência da Apple, e quando falta o Safari **não oferece o
    "visitar mesmo assim"** — a página simplesmente não abre, sem dizer por quê,
    e parece problema de rede ou de firewall. A mesma lista pede SHA-256, RSA de
    2048 ou mais, validade até 825 dias e nome alternativo preenchido. E conferir
    o arquivo em disco não basta: o que vale é o certificado servido na conexão,
    que é onde se vê o que o aparelho realmente recebe.
51. **O Brave do iPhone reescreve a folha de estilo.** Os balões da conversa
    saíam de ponta a ponta e todos à esquerda, com as classes certas no CSS
    servido — e o mesmo código aparecia certo no Safari do mesmo aparelho. O que
    depende de layout crítico vai também como estilo no elemento. Para separar
    "o motor do iPhone" de "o Brave", o teste é abrir no Safari. O "1 Issue" do
    Next no Brave é o script da carteira dele (`window.ethereum`), e não do app.
52. **O Windows pode não liberar o Node do nvm no firewall.** O servidor subia em
    `C:\nvm4w\nodejs\node.exe`, um caminho sem regra — mas a conexão do celular
    que não abria era do próprio aparelho (VPN, rede, "acesso à rede local"). O
    diagnóstico que separa os dois: o computador faz ping no celular e responde
    200 pelo próprio IP; aí o bloqueio está no telefone. E confira o IP do
    computador (`ipconfig`): o roteador troca, e o `.9` que se tentou era o
    próprio celular.
53. **A regra padrão do `supabase_admin` não se revoga.** Depois da migration da
    decisão 085, `pg_default_acl` ainda mostra `anon` e `authenticated` com tudo
    — mas na regra do dono `supabase_admin`, que o `postgres` não pode alterar.
    Ela só vale para objeto criado por esse papel; as nossas tabelas são do
    `postgres`, e a regra dele está limpa. Confira o dono antes de concluir que a
    migration não funcionou.
54. **A chave do Resend "só envio" não lê a conta.** `GET /domains` responde 401
    "restricted to only send emails". É a chave certa para o site; para saber se
    o domínio está verificado, o lugar é o painel do Resend.
55. **`onReady` do `next/script` vem uma vez por montagem.** Com o script já
    carregado, ele chama `onReady` no efeito e marca que chamou; o React de
    desenvolvimento monta, desmonta e monta de novo, e a segunda montagem não
    recebe outro. O CAPTCHA sumia ao sair e voltar para a tela, e aparecia ao
    recarregar. Quem desenha algo de script externo desenha também no próprio
    efeito, quando o script já existe. O teste que pega isso roda em
    `StrictMode`, com um `next/script` falso que chama `onReady` uma vez só.
56. **O Turnstile num navegador automatizado pede o clique.** No navegador do
    assistente o desafio mostra "Confirme que é humano"; numa pessoa, no modo
    *Managed*, ele passa sozinho. O assistente não resolve CAPTCHA: o envio com
    o desafio de verdade é conferido pelo dono do produto.
57. **O primeiro acesso de uma conta nova chega em paralelo.** A página e o sino
    resolvem a mesma sessão ao mesmo tempo, e todos tentam criar a conta; o
    segundo batia no índice único de `auth_user_id` e a tela dava erro até
    recarregar. `resolveUser` agora lê a conta criada por quem ganhou a corrida.
    O sintoma no banco é **id pulado a cada conta nova** — a sequência gasta pela
    inserção que falhou. Os ids 3 e 5 do banco local são isso, e não fazem falta.
58. **`fly launch` não.** O painel da Fly empurra para ele, e ele gera `fly.toml`
    e `Dockerfile` próprios por cima dos do repositório. A aplicação vazia sai de
    `fly apps create colexa`. A `fly-builder-...` que aparece na lista é a
    máquina de build da própria Fly: não apagar.
59. **O PowerShell estraga o token ao passar por pipe.** Três tokens de deploy
    gerados e copiados ou canalizados pelo PowerShell deram `token validation
    error` no GitHub Actions. Gerado pelo Git Bash com `tr -d '\r\n'`, testado
    antes com `FLY_CONFIG_DIR` vazio e `FLY_API_TOKEN` só com ele, funcionou de
    primeira. O teste isolado é o que separa "token ruim" de "sessão local".
60. **O `DATABASE_URL` da Fly não é o do `.env`.** O primeiro publicado apontava
    para `optcg@localhost` (o banco local), e toda página com banco dava 500 com
    `Can't reach database server at 127.0.0.1:5432`. O segundo tinha o host certo
    e a senha errada (`AuthenticationFailed`). O que conferir, sem ver segredo:
    `fly ssh console` com um script que imprime só usuário e host, e uma
    impressão digital curta da senha comparada com a do `.env`. E segredo
    trocado no painel fica **Staged** até `fly secrets deploy`.
61. **O Supabase manda para a Site URL quando a volta não está na lista.** O
    login com Google em `colexa.fly.dev` terminou em `localhost:3000` recusado.
    A volta do ColeXa leva `?next=/inicio`, e `.../auth/callback` sem curinga não
    casa; `https://colexa.fly.dev/**` casa. Na etapa de autorização o Supabase
    aceita qualquer `redirect_to` — só no fim do login ele cai para a Site URL.
62. **Turnstile erro 110200 é hostname fora da lista.** O quadro diz "Não foi
    possível conectar ao site", e o código só aparece no console. A mudança de
    hostname levou alguns minutos para valer; o log do console é cumulativo, e
    conferir exige uma aba nova.
63. **O cache de imagens do Next não sobrevive à publicação.** Na Fly o disco da
    máquina é novo a cada deploy, e o original da Bandai (até 2,2 MB, ~3 s de
    Tóquio) estourava os 7 s padrão do otimizador com a grade pedindo dezenas.
    Local não aparecia porque o cache tinha semanas. A chave do cache é a URL da
    imagem, a largura, a qualidade e o formato — não o domínio do site, então
    trocar para `colexa.com.br` aproveita o volume.
64. **`fly deploy --remote-only` cria uma máquina de build sua, com 50 GB.** O
    app `fly-builder-...` aparece sozinho na conta, e o volume dele é cobrado o
    mês inteiro por causa de builds de dois minutos — mais caro que o site. O
    certo é `--depot=true`, que usa os builders geridos. Se o app de build
    reaparecer, confira a flag antes de apagá-lo.

## Pendências

### Bloqueios de lançamento

1. **Termos de Uso e Política de Privacidade** (decisão 030). As rotas existem e
   dizem que o texto está em preparação. O produto **não pode receber cadastro
   de pessoa real** assim. O texto é decisão do dono do produto.
2. ~~**SMTP próprio no Supabase**~~ — **resolvido em 17/09**: configurado pelo
   dono do produto com o Resend, e ele confirmou que o e-mail de cadastro chega
   com o nome ColeXa (decisão 086).
3. **O domínio.** `fly certs add colexa.com.br`, os registros de DNS, `APP_URL`
   para `https://colexa.com.br` em `fly.toml`, e nos painéis: `https://colexa.com.br/**`
   nas *Redirect URLs* e **Site URL** do Supabase, e a origem no Google
   (`development.md` 6.6). A Site URL é o destino quando o endereço de volta não
   está na lista (armadilha 61).
4. ~~**`RESEND_API_KEY` e `EMAIL_FROM` no ambiente de produção**~~ — **resolvido
   em 17/09**: na Fly (segredo e `fly.toml`), assim como a chave do Turnstile no
   build.
5. **Idade mínima da rede** (decisão 060). A rede expõe o Trade Binder e abre
   conversa entre estranhos.
6. ~~**Excluir a conta**~~ — **construída em 17/09** (decisão 091). Falta o
   segredo `SUPABASE_SECRET_KEY` já estar no GitHub (está, desde 17/09) e a
   tarefa diária **Contas** ter rodado pelo menos uma vez para valer.
7. **Limpar as contas de teste** de produção, nas duas metades (ver "Produção").
8. **Premium no lançamento.** Hoje o plano não limita nada e não há como pagar;
   lançar tudo liberado precisa ser escolha consciente do dono do produto.

### Decisões que o dono do produto ainda pode querer revisitar

- As três cores semânticas — sucesso, perigo, atenção — **não vêm da
  especificação**. Foram derivadas e medidas por contraste. Trocar é uma linha
  por tema em `globals.css`, e nenhum componente muda.
- `/design-system` é o guia de estilo, fora da navegação e fora dos buscadores.
  Antes de publicar, decidir se continua acessível precisa ser escolha
  consciente. Hoje ele também é a única rota pública que desenha o shell, e é
  onde os testes de responsividade medem.
- **Google e Apple** estão desligados. Ligar no painel faz os botões aparecerem
  sozinhos, sem mudança de código (decisão 032). **O Google o dono do produto
  vai ligar** — é por ele que vai criar a conta oficial dele. No Google Cloud, o
  redirect autorizado é `https://zcyavtxrnpxinkvfnftf.supabase.co/auth/v1/callback`. A Apple tem exigências de marca
  e de fluxo mais estritas, que valem conferir antes.

### Perguntas em aberto

- **Credencial do TCGplayer.** O preço virá de lá (decisão 047), mas a API é de
  programa de parceiros: sem aprovação e chaves não há coleta a construir. É o
  único bloqueio da valoração — armazenamento e cadência já estão medidos e não
  são problema.
- **Moeda.** TCGplayer é em dólar. Converter exige dizer na tela que é
  referência internacional convertida; não converter mostra dólar a quem negocia
  em real. Decisão do dono do produto.

- **Logo oficial do set.** A Bandai tem um, mas só nas páginas de produto dos
  lançamentos recentes, com URL contendo hash aleatório
  (`/onepiececg/bccard/en/products/2026/03/26/FQ6NL0F7vwkybKBR/logo.webp`) e não
  derivável do código. `op01.html`, `st01.html` e `eb01.html` devolvem 404 — só
  os produtos novos têm página. Cobrir os 60 sets exigiria hospedar as imagens
  por conta própria, como a LigaOnePiece faz. Hoje a capa é o Leader do set.

- ~~**Uma variante sem set.** `ST14-010_r1`~~ — **resolvido pela decisão 052.**
  O palpite anotado aqui estava certo: `_r1` não é o mesmo que `_pN`. É
  reimpressão, e reimpressão sem campo de set não acrescenta nada, porque o set
  é o único dado que ela traz. Ela deixou de existir como variante.
- **Data de lançamento dos starter decks.** A ordem informada cobre as coleções;
  os decks saem por número, que é a ordem deles entre si. Intercalá-los com as
  coleções exigiria as datas.

- **Rótulo da série em `sets`.** Hoje a classificação em coleção/deck/promo sai
  do prefixo do código, que espelha fielmente o rótulo que a fonte publica
  (conferido um a um). Guardar o rótulo removeria a suposição e corrigiria de
  quebra os nomes inconsistentes: `OP-17` foi importado como
  `BOOSTER PACK -...-` e `OP-01` como `-...-`, embora ambos sejam booster pack.
  Hoje isso é resolvido na exibição. Seria alteração do modelo e reimportação.
- **Nomes divergem entre a lista de lançamento e o catálogo.** Três sets têm
  nome diferente do informado, porque o catálogo é o site em inglês:
  `OP-09` é "EMPERORS IN THE NEW WORLD" e não "The New Emperor"; `OP-11` é
  "A FIST OF DIVINE SPEED" e não "The Blackbeard Pirates"; `OP-12` é
  "LEGACY OF THE MASTER" e não "The Revolutionary Army". A tela mostra o nome da
  fonte. Trocar por nomes próprios seria manter uma segunda lista à mão.
- ~~**Trocas fora da barra.**~~ — **resolvido pela decisão 061.** A barra
  inferior e o `SECONDARY_DESTINATIONS` deixaram de existir; Trocas é um dos sete
  destinos da gaveta, como qualquer outro. Conferido no código.
- **Histórico de trocas (tela 35) não existe.** Escolha do dono do produto ao
  fechar a conclusão (decisão 062): a troca concluída vira leitura no próprio
  endereço, e `/trocas` volta a oferecer começar outra. A listagem com filtros
  Todas/Em andamento/Concluídas é tela nova, e faz sentido quando houver mais de
  um punhado de trocas para listar. Hoje uma troca concluída só é alcançável por
  quem guardou o endereço.
- **Reduzir em massa não existe.** A tela 27 da especificação mostra
  "Atual: 3 → 4", com decremento. Ficou de fora porque reduzir pode disparar o
  conflito da decisão 007 — "de qual local as cópias saem?" —, e isso não cabe
  numa leva de cinquenta cartas. Se o dono do produto quiser, o caminho é
  resolver a leva inteira numa tela de resolução própria.
- **A rota do detalhe da carta diz `/catalogo/`** e a tela é usada também a
  partir da coleção e dos binders. Não confunde na prática — o link de voltar
  leva de onde a pessoa veio (decisão 044) —, mas uma rota neutra
  (`/carta/[id]`) descreveria melhor o que ela é. Mudança mecânica, adiada por
  não resolver nenhum problema real hoje.
- **"Playsets aqui" no detalhe do local.** A tela 22 mostra uma contagem de
  playsets dentro de um binder, e a definição da `business-rules.md` 2.1 é sobre
  a coleção inteira. A leitura adotada é a física — cartas inteiras naquele
  local —, registrada na decisão 043 como leitura e não como regra nova. Trocá-la
  é uma função e um rótulo.
- **Progresso por set** aparece nas telas 10 e 11 e não foi construído: é
  métrica de coleção (`business-rules.md` 2.2), e chega com as telas de coleção.
  O componente `ProgressBar` já existe esperando o número.
- **E-mail repetido entre provedores.** Se a mesma pessoa criar conta com senha
  e depois entrar com Google no mesmo endereço, e o Supabase criar um usuário
  separado em vez de vincular, o nosso `resolveUser` bate no índice único de
  e-mail. Recusar com mensagem clara é a saída recomendada; vincular é a
  alternativa, e é caminho de tomada de conta se algum provedor entregar e-mail
  não verificado. **Aguarda decisão** — e ficou mais urgente: o Google foi ligado
  em 17/09.

### Desenhado, e não construído

Duas coisas que os documentos descrevem como se existissem. Conferido no código
em 10/09.

- ~~**Excluir a conta.**~~ — **construída em 17/09** (decisão 091): pedido com
  30 dias para desistir, trocas em andamento canceladas no pedido, e a tarefa
  diária **Contas** anonimizando depois do prazo, inclusive no Supabase Auth e
  no Storage. O `trade_binder_token` é limpo, como este parágrafo pedia.
- **O Premium não limita nada.** O plano é lido e mostrado em Minha conta, mas
  nenhum recurso é bloqueado por ele, e não existe caminho para alguém virar
  Premium — `trial_started_at` nunca é usado, e não há pagamento. A regra 6.1
  reserva o Trade Binder público ao Premium; a trava está pendente por decisão
  do dono do produto (064).

### Pendências que não bloqueiam

- **Foto de perfil.** O envio de imagem existe desde o Checkpoint 10 e serve
  para isso sem mudança. Falta a coluna em `users` para guardar a URL, que é
  alteração do modelo de dados e depende de aprovação.
- `users.plan` pode ser derivável de `premium_until` — depende da política
  comercial, que a especificação reserva ao dono do produto.
- Limite de taxa não escala horizontalmente: contador em memória de processo.
  Vale para as três cotas, inclusive a de tentativas de login.
- Node 20 depreciado pelo SDK do Supabase — e não só depreciado: `createClient`
  não funciona nele (armadilha 22). Subir para o Node 22 removeria a restrição,
  mas o provedor de imagens não depende mais disso.
- O `middleware.ts` está deprecado no Next 16, que agora prefere `proxy.ts`. O
  build avisa a cada execução. Migração mecânica, adiada por ser mudança na
  fronteira de sessão.
- Pagamento (Checkpoint 15): Supabase não processa. Para assinatura recorrente
  no Brasil, conta Stripe brasileira **não** tem Pix Automático; PSPs nacionais
  como Asaas e Mercado Pago têm.

## O Trade Binder público, e a dívida que ele deixou

Construído em 10/09 (decisão 064). `/trade/<token>` mostra o conjunto de tudo o
que está em local de troca, somado, sem pedir sessão — é a **única** página do
produto que mostra dado de alguém sem login.

Três coisas para não desfazer sem querer:

- A página **não chama `requireViewer`**, e essa ausência é a decisão. Está
  escrita no arquivo.
- Ela sai dos buscadores (`robots: noindex`): indexar transformaria um endereço
  compartilhado numa vitrine, que é o que a regra 4.6.1 recusa.
- O que ela expõe é decidido em `readPublicTradeBinder`, e a maior parte dos
  testes de integração verifica **ausências**. Um campo a mais na consulta vaza
  para todo mundo que tiver o endereço, e não há segunda barreira depois dela.

**Dívida explícita: a trava de Premium.** A regra 6.1 reserva o recurso ao
Premium, e ela **não está aplicada** por escolha do dono do produto — não existe
caminho no código para alguém virar Premium (`trial_started_at` nunca é usado, e
não há pagamento), então gatear agora entregaria um recurso inalcançável. Quando
o pagamento existir, a trava entra em `publishTradeBinder`, que é o único ponto
por onde um token nasce.

**Dependência para quando a exclusão de conta existir:** anonimizar precisa
apagar `trade_binder_token`, senão um link publicado sobrevive à saída da pessoa.
Hoje `readPublicTradeBinder` recusa conta com `deleted_at`, que é a rede de
segurança — mas a limpeza pertence à anonimização (decisão 015), que ainda não
foi construída.

## A troca ao vivo, e o que ela impõe a quem mexer nela

Construída em 10/09 (decisão 065). Os dois lados veem a oferta do outro mudando
sem recarregar, e confirmar só libera cinco segundos depois da última alteração.

**Confirmado pelo dono do produto em 10/09, com duas contas**: a carta posta de
um lado aparece na tela do outro, e o botão trava e conta.

Para testar de novo: a oferta só aceita cartas que aparecem no cruzamento. A
conta B precisa ter na **want list** uma carta que a conta A tenha num **local de
troca** — sem isso não há o que oferecer, e parece defeito sem ser.

Três coisas para não desfazer sem querer:

- **A espera é aplicada em `confirmTrade`**, e não no botão. O botão desabilitado
  é aparência; a Server Action pode ser chamada direto.
- **A consulta devolve marcas, não a troca.** Montá-la também ali daria dois
  lugares capazes de discordar sobre a mesma troca.
- **`offer_changed_at` é preenchida na mesma escrita que derruba as
  confirmações.** Fora dela existiria um instante com a oferta mudada e o botão
  liberado — o instante que a espera existe para fechar.

**Todo teste que confirma uma troca precisa cumprir a espera.** Os do Checkpoint
12 quebraram por isso, e a saída foi recuar `offer_changed_at` no relógio do
banco — que é o que acontece quando a pessoa espera de verdade. Dormir cinco
segundos por teste custaria mais de um minuto na suíte sem provar nada a mais.

## A tela de mapeamento das paralelas (decisões 068 e 077)

**`/dev/paralelas`**, só fora de produção. Desde 16/09 (decisão 077) a carta entra
**inteira**: todas as artes, e todos os produtos da fonte com grupo, preço, link
do TCGplayer e quem segura cada um. Por arte: o motivo, o vínculo de hoje
(manual/automático), a página conferida na Liga e o produto que ela aponta.
Gravar escreve `data/vinculos-manuais.json`; **a tela não escreve no banco**,
quem aplica é a importação de preço.

Três motivos de pergunta: paralela **sem vínculo**; **a Liga aponta outro
produto** (`ligaSuggestion`, de qualquer origem — o manual também erra); **normal
sem preço**. Manter contra a Liga grava a nota `revisado: mantido contra a
sugestão da Liga`, e a arte não volta.

Para usar:

1. `npm run paralelas:candidatos` — ~2 min, 174 pedidos ao tcgcsv. Roda o vínculo
   no banco **local** e grava `paralelas-candidatas.json` (derivado, fora do Git).
   **Rode de novo depois de mexer na tabela da Liga ou no arquivo manual**: uma
   resposta libera produto, e a Liga da irmã pode passar a apontar para ele.
2. `npm run dev` e abra `/dev/paralelas`. Abre na primeira coleção — todas de uma
   vez eram 26 mil elementos. "Faltam" esconde o que já tem resposta.
3. PR com `data/vinculos-manuais.json`; `npm run prices:import` aplica no local e
   `npm run supabase prices` leva a produção.

**Em 16/09: nenhuma pergunta sem resposta.** O dono do produto respondeu duas
rodadas (PRs #92 e #93); o levantamento seguinte só lista cartas já respondidas.

Coisas para não desfazer sem querer:

- **A recusa fora de desenvolvimento está no caso de uso** (`mappingAvailable()`),
  e não só na página: a ação pode ser chamada direto.
- **O caso de uso lança erro da taxonomia**, e não `Error` puro: a ação só mostra
  mensagem de `AppError`.
- **A tela lê as respostas do arquivo de agora** (`readMapping().manual`) e decide
  o que falta com `candidateAnswered`: o levantamento é um retrato.
- **A miniatura da fonte é `<img>` puro.** O CDN do TCGplayer não está em
  `images.remotePatterns`.
- **Produto da normal numa paralela.** Em 12 cartas o dono do produto deu à `_p2`
  (a reimpressão da PRB-01, lida como a carta original) o produto da própria
  normal. A normal mantém o preço, mas fica sem o botão "Veja no TCGplayer": o
  índice único de `variant_source_products` dá um dono por produto. Mostrar nas
  duas exigiria mudar o modelo, e o dono escolheu deixar como está.

## A Social (decisões 079 a 087)

Construída de 16 a 17/09, **direto, sem a passada de design antes** — escolha do
dono do produto. Conferida por ele no navegador e no iPhone (Safari e Brave).

- **`/social`** — quem tem cartas em local de troca, **sete por página**, com a
  prévia de até sete cartas rolando na horizontal. Ordem: Premium, depois quantas
  cartas quem olha procura, depois o nome. **Busca** por código ou nome da carta,
  ou pelo nome na rede (`@nome` busca só nome, e o nome igual vem primeiro).
- **`/social/<nome>`** — o Trade Binder de alguém, com o que quem olha procura
  marcado: **Mandar mensagem**, **Convidar para trocar**, Bloquear e Denunciar.
- **`/conversas`** — as conversas, da mais recente, com a marca de não lida; a
  conversa aberta pergunta a cada 3 s se chegou mensagem.
- **Trocas** — convites recebidos no topo, com aceitar e recusar; o convite
  enviado espera e leva à troca quando aceito. Na negociação, as suas cartas em
  dois grupos: o que a outra pessoa procura, depois o resto do Trade Binder.
- **O sino** — avisos do estado atual: mensagens não lidas, convites de troca e
  cartas sem armazenamento. Somem sozinhos quando o assunto se resolve.
- **Denúncias** — cada uma chega por e-mail em suporte@colexa.com.br, assunto
  DENUNCIA (decisões 086 e 087).

Coisas para não desfazer sem querer:

- **A rede e a troca mostram o nome na rede**, e não o nome real (regra 6.1.1).
  O nome real só aparece na troca por link com quem não escolheu nome.
- **O consentimento do convite direto fecha no aceite** (regra 4.6.1): antes, a
  convidada não abre nem mexe na troca, e quem convidou não vê o cruzamento.
- **A mensagem e a leitura usam o relógio da aplicação**, e não o do banco: com
  relógios diferentes, abrir a conversa não apagaria o aviso.
- **Cotas** (em memória de processo): rede 60/min, busca 20/min, denúncia 5/h,
  mensagem 30/min.
- **O layout não é refeito ao navegar**: o sino busca os próprios avisos em
  `/api/me/notificacoes`, ao abrir cada página, ao voltar para a aba e a cada
  minuto.

Para testar entre duas contas no celular: as duas contas locais do dono do
produto (`pedrodussel` e `testedusekin`) têm local de troca e se veem na rede.
Uma conta num navegador, a outra noutro ou numa janela anônima.

## Próximo passo

**Abrir o ColeXa a 15 ou 20 testadores**, escolha do dono do produto em 17/09, em
`colexa.fly.dev`. A revisão da decisão 092 corrigiu o que dependia só de nós; o
que falta para receber gente de fora:

- **Termos de Uso e Política de Privacidade** (decisão 030). Testador é pessoa
  real, e a LGPD vale para os 20 primeiros como para os próximos. A tabela de
  `integrations.md` 3.3 diz quais serviços a Política precisa citar.
- **Idade mínima** (decisão 060), se houver.
- **Site URL do Supabase** ainda é `http://localhost:3000`: qualquer e-mail que
  não carregue `redirect_to` manda o testador para a máquina de quem
  desenvolve. Trocar para `https://colexa.fly.dev` enquanto o domínio não existe.
- **Limites do Supabase Auth** (*Authentication → Rate Limits*): o padrão conta
  por IP, e vários testadores na mesma rede — uma loja, um evento — batem no
  teto juntos. Conferir antes.
- **Backup do banco**: o plano gratuito não tem. Com dado de gente real, é o
  maior risco da operação.
- **Um caminho para o testador relatar**: hoje só existe o e-mail do suporte,
  que nem aparece na tela. Decisão do dono do produto se entra um item
  "Enviar feedback" em Minha conta.
- **A tarefa Contas nunca rodou em produção.** Uma execução à mão pelo GitHub
  Actions confirma os segredos antes de alguém pedir exclusão de verdade.

O que continua combinado para depois:

- **A passada de Claude Design nos componentes compartilhados** — botão, painel,
  linha de lista, estado vazio —, que o dono do produto adiou para depois da
  Social. A revisão visual e textual tela a tela, e os links das cartas, ficam
  para o fim.
- **Os bloqueios de lançamento** (seção "Pendências"): Termos e Política, idade
  mínima, e-mail repetido entre provedores, Premium no lançamento, limpar as
  contas de teste e ligar o domínio.
- **CSP de scripts** (decisão 092 deixou de fora): fechar de onde o navegador
  pode carregar script. Feito errado, derruba o login sem aviso, então pede uma
  passada própria.

A skill `design` está habilitada e funciona; o conector do **Figma** aparece na
sessão mas está **sem autorização**, e sessões não interativas não conseguem
rodar o login. Ligar é por fora, nas configurações de conectores do claude.ai ou
com `/mcp` num terminal interativo.

## A folha da want list agora se compartilha

Corrigido em 10/09 (decisão 063), depois de o dono do produto relatar num iPhone
que **só a última imagem era baixada**.

A saída principal passou a ser **Compartilhar**: um toque, a folha do sistema, e
todas as imagens vão de uma vez para o grupo. Onde não há compartilhamento de
arquivo, cada folha tem o próprio botão de baixar — **nunca um laço**.

No celular é **um botão só**. Baixar folha a folha existe apenas onde não há
compartilhamento de arquivo — computador, quase sempre.

A impressão foi corrigida junto, no mesmo relato: a arte saía **cortada ao meio a
partir da terceira página**, porque a lista inteira era uma grade única e o
navegador fatia a linha da grade, não o item. Agora cada folha é um bloco que
termina em quebra de página, de doze em doze, e o número de páginas sai da
divisão — nunca é presumido.

Três coisas para não desfazer sem querer:

- As folhas são desenhadas **quando a tela abre**, e não ao toque. Não é
  otimização: `navigator.share` exige ativação do toque, e ela não sobrevive ao
  carregamento das imagens (armadilha 45).
- Nenhum caminho dispara mais de um download por toque (armadilha 43).
- A margem de impressão sai do nosso `@page` em `globals.css`, e não do diálogo
  do navegador (armadilha 46).
- A arte da folha carrega com `eager`, e **imprimir espera** o desenho de cada
  uma. Sem as duas, o PDF sai com a primeira página completa e as seguintes em
  branco (armadilha 47).

### Para testar o compartilhamento no celular

**`npm run dev` não serve.** O app aberto pelo IP da rede em `http://` não é
contexto seguro, e ali o `navigator.share` **não existe** — a tela mostra os
botões de baixar e explica o motivo (armadilha 48).

Use **`npm run dev:https`**, e **pare o `npm run dev` antes** — o Next recusa
subir dois servidores, e o script para com essa instrução em vez de mudar de
porta às escondidas.

Ele gera um certificado cobrindo o **nome mDNS** e os **IPs desta máquina**,
lidos das interfaces de rede. Prefira `https://<maquina>.local:3000` — o iOS
resolve `.local` sozinho por Bonjour, e o Safari lida melhor com nome do que com
IP nu. Isso é o que o `next dev --experimental-https` puro não faz: ele emite
para `localhost`, e o celular chega por `192.168.x.y` — um certificado que não
cobre o endereço usado é recusado antes de qualquer pergunta, sem saída.

O Safari vai avisar que não confia no certificado, porque ele é assinado por ele
mesmo. Em "Mostrar detalhes" dá para seguir. Depois disso a página é HTTPS de
verdade, `isSecureContext` é `true`, o botão de compartilhar aparece e a folha do
iOS abre com todas as imagens.

**Confirmado no iPhone em 10/09**: com o servidor em HTTPS, o botão de
compartilhar aparece e a folha de envio do iOS abre com as imagens.

O que ainda vale conferir é a **impressão de uma lista com mais de 24 cartas** —
que a arte saia em todas as páginas, e não só na primeira. Foi o que o PDF de
41 cartas denunciou, e a correção não é reproduzível no jsdom.

## Onde a troca está hoje

Dá para testar entre duas contas. `/trocas` → **Começar uma troca** → copiar o
link → abrir na outra conta → **Entrar nesta troca** → os dois veem o
cruzamento, cada um monta a própria oferta, os dois confirmam, e os dois marcam
**"Já trocamos as cartas"** — aí as cópias mudam de dono de verdade.

**A disposição da negociação mudou em 13/09**, a pedido do dono do produto: o que
a outra pessoa oferece vem primeiro, em grade com a arte grande; as suas cartas —
a sua oferta, com o − N +, e as sugestões do cruzamento — ficam numa faixa que
rola na horizontal. A faixa usa `scroll-px-4`: sem ele o encaixe da rolagem
colava a primeira carta na borda da tela.

O ciclo está **inteiro**: convite, descartar o convite que ninguém aceitou,
entrada, cruzamento nas duas direções, edição da própria oferta, confirmar,
retirar a confirmação, marcar, retirar a marcação, cancelar, o aviso de revisão
quando o outro altera, e a conclusão.

Duas coisas que valem saber ao testar:

- **A pergunta de origem só aparece às vezes.** Cópias num binder de troca só, ou
  saindo todas, se deduzem (decisão 049). Para ver a pergunta, ponha a mesma
  carta em dois locais de troca e ofereça só parte dela.
- **Concluída, a troca vira leitura no próprio endereço** — "Você entregou" e
  "Você recebeu" —, e `/trocas` volta a oferecer começar outra. O histórico com
  filtros (tela 35) **não foi construído**, por escolha do dono do produto.

## O que falta em preços e no vínculo

Em 16/09, depois da auditoria de todas as artes contra a Liga e o TCGplayer:

- **Nada pendente de mapeamento.** Normais 2.785/2.785 com preço; paralelas
  1.642/1.646 com vínculo.
- **4 paralelas sem produto na fonte**, respondidas "não tem na fonte":
  `OP02-041_p2`, `OP05-076_p4`, `OP10-107_p3`, `OP11-041_p2`.
- **94 paralelas com produto e sem venda.** Ganham preço sozinhas quando alguém
  vender; a página diz "Sem cartas vendidas no TCGplayer."
- **A diferença de preço entre o site e o TCGplayer** não é defeito: usamos o
  *preço de mercado* (média das vendas) do espelho de ontem, 20:00 UTC; a página
  do TCGplayer destaca a *oferta mais barata* de agora. A Zoro `OP01-001`
  mostrava 8,30 contra 7,84, e os dois números estavam no mesmo arquivo da fonte:
  `marketPrice` e `lowPrice` do mesmo produto — que era, então, o do `OP-DD`
  (corrigido pela 076).

## O link da Liga — conferência coleção a coleção (decisão 071)

Pedido do dono do produto em 13/09: mapear como a LigaOnePiece identifica cada
carta e cada variante, **sem assumir padrão único** — a OP01 usa `-PAR`, a OP02
usa `-E`. A 070 (deduzir `-PAR`) foi revogada no mesmo dia por isso.

**Como o link sai hoje:**

- arte na tabela `data/liga-cartas.json` → o endereço conferido, como a Liga o
  produziu (`url: null` = "a Liga não tem página", vai para a busca);
- normal fora da tabela → o endereço montado sem sufixo;
- **paralela fora da tabela → busca.** Nenhum sufixo é deduzido.

Isso corrigiu a `OP01-004_p1` (só existe na PROMO e ganhava `OP01-004-PAR`) e
outras 157 paralelas apontando para arte de outro produto. Paralelas com link
direto: 569 → **13**, todas conferidas.

**Para conferir uma coleção:** `npm run dev`, abra `/dev/liga?set=OP02`. São três
grupos — paralelas da coleção, normais (amostra por raridade: uma L, C, UC, R,
SR, SEC) e artes com o código dela impressas em outro produto. "Procurar na Liga"
abre a busca pelo código; cole o endereço da arte certa e grave. Depois, PR com o
`data/liga-cartas.json`.

**Onde a conferência está, em 15/09:** terminada pelo dono do produto. A tabela
tem **3.132 artes**; **todas as paralelas do catálogo** estão nela, e as normais
estão completas nas EB, nas ST, nas promos `P-` e nas OP07, OP14 e OP15 — nas
outras OP há a amostra. Só 2 artes vão para a busca (`OP09-069_p2` e
`OP10-107_p3`, sem página na Liga). Paralelas com link direto: 13 → **1.644**.

O que a conferência ensinou sobre a Liga, para quem for mexer:

- **A edição não segue um formato**: `OP-01` nas OP, `EB01` e `ST17` sem hífen
  (mas `ST-01` a `ST-13` com), `PRB`, `PRB2`, `PC-01` (Gift Collection e
  aniversários), `OP-02-PR`, `LTDS`. As EB04 estão dentro de `OP-14` e `OP-15`.
- **O sufixo depende do produto, não da raridade**: mais de 90 diferentes — `AA`,
  `PA`, `SP`, `FA`, `RE`, `BS`, `JR`, `TP`, `E`, `PAR`…
- **A SP lançada em outra coleção usa o código sem sufixo** (`OP01-016` dentro de
  `OP-05`): sem a edição, o link levaria à normal.
- **Nomes repetidos ganham letra no código**: `OP02-093A`, `OP02-102A`,
  `ST06-004B` (os Smoker).
- **40 normais da EB01 foram geradas** pelo modelo das conferidas, com nota.

A normal `OP01-029`, que apontava para a reimpressão da PRB, foi corrigida pelo
dono do produto em 15/09 para a página própria em `OP-01`.

A tela passou a recusar o endereço colado duas vezes: ele passava por válido e
entrou assim na `OP06-093_p5`.

**Revisão das reimpressões, `/dev/liga/revisar`** (15/09): as paralelas conferidas
como `(Reprint)` cuja normal já saiu no mesmo set — eram 50, quase todas da PRB-02.
A reimpressão igual é a própria normal (decisão 052), então a paralela deve ser a
outra versão, quase sempre a Pirate Foil. Apareceram ao cruzar a tabela da Liga
com os produtos do TCGplayer: as 30 divergências contra vínculos existentes eram
todas este caso. A lista é calculada da tabela; "A reimpressão está certa" grava a
nota que tira a arte dela.

**Revisada pelo dono do produto em 15/09: 49 confirmadas como reimpressão
correta, 1 trocada** (`OP01-006_p3`). A leitura pela decisão 052 estava errada
nesses casos, e isso tem consequência para o TCGplayer: as 30 que tinham vínculo
automático apontam para a **Pirate Foil**, e não para a `(Reprint)` que a Liga
confirma. Resolvido pela instrução do dono do produto: a `(Reprint)` da PRB vale a
Pirate Foil (PRB-02) ou a Jolly Roger Foil (PRB-01) no preço (decisões 072 e 074).

**As páginas compartilhadas por duas artes foram resolvidas** em 15 e 16/09, em
`/dev/liga/repetidas`: o dono do produto corrigiu os endereços, e a regra passou a
separar pelo `-E-PAR`, pela edição e pelos colchetes (`[Winner]`) (decisão 075).
A tela está vazia.

Três coisas para não desfazer sem querer:

- **O endereço é guardado inteiro**, e não remontado: o nome dentro dele nem
  sempre é o nosso (o Kid da OP01 tem `(Parallel)` na Liga).
- **A página da carta lê a tabela por import estático**; a tela `/dev/liga` lê do
  disco. Mudar a primeira para ler do disco quebra em hospedagem que não copia
  `data/`.
- **Tabela inválida é erro**, e o teste `liga-cards-file` lê o arquivo do
  repositório: um PR de conferência com JSON quebrado reprova na CI.

## O que espera resposta do dono do produto

- **Idade mínima.** Expor perfil de menor de idade a estranhos é assunto sério
  sob a LGPD, e a rede depende disso. Foi perguntado e não respondido.
- **Termos de Uso e Política de Privacidade.** Já eram bloqueio de lançamento; a
  rede os torna mais urgentes, porque ela expõe o Trade Binder de todo mundo.
  Ele informou que está contratando advogada e que pedirá uma revisão técnica
  das implementações perto do fim.
- **O que vem depois da Social**: a passada de design nos componentes, ou os
  bloqueios de lançamento.
- **Desligar a exposição do schema `public`** em *Settings → Data API* no
  Supabase (o ColeXa não usa), recomendado em 17/09. *Network Restrictions* **saiu
  da recomendação** (decisão 089): a Fly e o workflow de preços saem por IPs que
  mudam.
- **Plano do Supabase**: backup automático só no Pro.

O protocolo continua: uma branch e um PR por checkpoint, o assistente merge
quando estiver completo e sem pendência, e para antes de iniciar o próximo
(decisão 016).
