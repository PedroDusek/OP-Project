# Handoff — estado em 10/09/2026

Retomada de contexto. O que existe, o que foi decidido e por quê, e onde parou.

## Para retomar

1. `npm run dev` — **sempre reinicie**. O servidor guarda o cliente Prisma que
   carregou ao subir, e a migration `concluir_a_troca` entrou nesta sessão
   (armadilha 40).
2. `npm run supabase status` — mostra o que produção tem e o que falta. Hoje
   ela está **quatro migrations atrás**.
3. Leia "Produção, em 10/09/2026" e "Próximo passo", abaixo.

O acordo de trabalho e as camadas estão em `CLAUDE.md`, na raiz.

## Onde as coisas estão

| | |
|---|---|
| Repositório | `C:\dev\optcg` — **fora do OneDrive**, de propósito (decisão 001) |
| Remote | `github.com/PedroDusek/OP-Project`, **público**, por SSH |
| Branch | `main`, 64 PRs mergeados, CI verde em todos |
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
Supabase só é alcançado por `npm run supabase <migrate|import|prices|status|storage>`, que
imprime o destino antes de agir e recusa se a URL apontar para `localhost`. Não
existe comando de reset para produção, de propósito.

## O que está pronto

**Checkpoints 0 a 12 concluídos.** 1.030 testes de unidade, integração e
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

### Produção, em 10/09/2026

> **Produção está QUATRO migrations atrás: 9 de 13.** Faltam
> `convite_de_troca`, `revisao_apos_alteracao`, `nome_de_usuario` e
> `concluir_a_troca`. **Publicar o `main` atual sem rodar
> `npm run supabase migrate` derruba a tela de Trocas e a de conta**, com
> `Cannot read properties of undefined`. É a primeira coisa a resolver antes de
> qualquer publicação. Produção tem **zero usuários**, então o atraso ainda não
> quebrou a tela de ninguém.

Catálogo e preços estão certos e iguais ao local: 2.785 cartas, 4.431 variantes,
60 sets, 4.834 impressões, **3.170 variantes com preço** — 2.692 artes comuns
por regra e 478 paralelas por vínculo. Cotação PTAX de 08/09 (USD/BRL 5,0856).

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

As 62 estão em `decisions.md`. Estas mudam o que se pode fazer:

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
    `navigator.share` com vários `files`.
44. **A tabela nova precisa entrar em três listas, não numa.** `schema.prisma` é
    só a primeira: `tests/integration/schema.test.ts` guarda a lista de tabelas
    aprovadas **e** a política de exclusão, e `tests/helpers.ts` guarda a ordem
    de truncação. Esquecer a terceira deixa lixo entre testes; esquecer a
    segunda quebra a CI, que é o desfecho bom — o guarda existe para que tabela
    nova não entre sem uma decisão que diga por que ela existe.

## Pendências

### Bloqueios de lançamento

1. **Termos de Uso e Política de Privacidade** (decisão 030). As rotas existem e
   dizem que o texto está em preparação. O produto **não pode receber cadastro
   de pessoa real** assim. O texto é decisão do dono do produto.
2. **SMTP próprio no Supabase.** O serviço de e-mail embutido tem cota baixa por
   hora e é do projeto inteiro: estourada, ninguém consegue confirmar conta nem
   redefinir senha. Ver `development.md` 6.2.
3. **Redirect URLs no painel do Supabase** precisam listar
   `<APP_URL>/auth/callback` de cada ambiente.

### Decisões que o dono do produto ainda pode querer revisitar

- As três cores semânticas — sucesso, perigo, atenção — **não vêm da
  especificação**. Foram derivadas e medidas por contraste. Trocar é uma linha
  por tema em `globals.css`, e nenhum componente muda.
- `/design-system` é o guia de estilo, fora da navegação e fora dos buscadores.
  Antes de publicar, decidir se continua acessível precisa ser escolha
  consciente. Hoje ele também é a única rota pública que desenha o shell, e é
  onde os testes de responsividade medem.
- **Google e Apple** estão desligados. Ligar no painel faz os botões aparecerem
  sozinhos, sem mudança de código (decisão 032). A Apple tem exigências de marca
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
  não verificado. **Aguarda decisão**, e o Google ainda não está habilitado.

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

## Próximo passo

**O defeito do JPEG da want list no Safari do iPhone.** Relatado pelo dono do
produto em 10/09 e **diagnosticado, não corrigido** — ver a seção abaixo. É a
próxima branch.

Depois dele, a passada de **Claude Design nos componentes compartilhados**,
combinada para acontecer **antes da Social**: botão, painel, linha de lista e
estado vazio são o vocabulário de toda tela, e a Social é o maior pedaço que
falta. Mexer neles depois dela seria refazer todas as telas dela. A revisão
visual e textual tela a tela, e os links das cartas, ficam para o fim.

Depois disso, a **aba Social**, que tem as regras escritas (decisão 060) e a
identidade construída, e falta tudo o mais: listagem ordenada, busca por carta,
bloquear, denunciar e o chat.

## O defeito do JPEG no Safari do iPhone — diagnosticado, a corrigir

**Sintoma:** baixando a want list em imagem no celular, só a **última** imagem é
baixada de verdade. As notificações de todas aparecem, e tocar nas outras não
entrega arquivo.

**Causa**, em `src/components/wants/want-sheet-print.tsx`, no laço de `baixar()`:
são N cliques programáticos em `<a download>` separados por 300 ms. No Safari do
iPhone um download programático é na prática uma **navegação** para o `blob:`, e
uma navegação nova **cancela a anterior que ainda não terminou**. Os 300 ms são
curtíssimos perto do tempo de materializar um JPEG de folha inteira. Cada clique
mata o anterior e sobra o último.

Dois agravantes no mesmo trecho: o `<a>` nunca é anexado ao documento, e o
`await` antes dos cliques seguintes já gastou a ativação do toque.

Passou batido porque o teste da folha cobre o **desenho**, não a entrega — o
jsdom não baixa arquivo. É irmão da armadilha 10.

**A correção acertada não é aumentar o intervalo**, que continuaria dependendo do
tamanho do arquivo e da velocidade do aparelho. É tirar os N downloads de um
toque só:

- **Compartilhar quando o aparelho tem** (`navigator.share` com `files`): um
  toque, a folha do iOS, e as imagens vão direto ao grupo. É o propósito escrito
  na decisão 058, e some com o laço.
- **Um botão por folha** no resto: um toque por arquivo, cada um com a própria
  ativação.

Não foi possível reproduzir num iPhone de verdade — a confirmação final é do
dono do produto depois da correção.

## Onde a troca está hoje

Dá para testar entre duas contas. `/trocas` → **Começar uma troca** → copiar o
link → abrir na outra conta → **Entrar nesta troca** → os dois veem o
cruzamento, cada um monta a própria oferta, os dois confirmam, e os dois marcam
**"Já trocamos as cartas"** — aí as cópias mudam de dono de verdade.

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

- **Mapear as 351 paralelas ambíguas.** O automático cobriu as que tinham uma
  arte de cada lado; sobram as com duas ou mais, onde é preciso dizer qual é a
  *Alternate Art* e qual é a *Manga*. Entram com `origin = 'manual'`, que
  nenhuma rederivação sobrescreve. `npx tsx scripts/levantar-paralelas.ts` gera
  a lista por set — os sets recentes fecham quase perfeito.
- **168 cartas com paralela que a fonte não oferece.** Não há produto para
  vincular; ficam sem preço e sem arte na folha em JPEG até a fonte listá-las.

## O que espera resposta do dono do produto

- **Idade mínima.** Expor perfil de menor de idade a estranhos é assunto sério
  sob a LGPD, e a rede depende disso. Foi perguntado e não respondido.
- **Termos de Uso e Política de Privacidade.** Já eram bloqueio de lançamento; a
  rede os torna mais urgentes, porque ela expõe o Trade Binder de todo mundo.
  Ele informou que está contratando advogada e que pedirá uma revisão técnica
  das implementações perto do fim.
- **A ordem de construção da Social**, e se o chat entra no primeiro corte — é
  o maior pedaço, e traz moderação junto.

O protocolo continua: uma branch e um PR por checkpoint, o assistente merge
quando estiver completo e sem pendência, e para antes de iniciar o próximo
(decisão 016).
