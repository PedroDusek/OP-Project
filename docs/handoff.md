# Handoff — estado em 09/09/2026

Retomada de contexto. O que existe, o que foi decidido e por quê, e onde parou.

## Onde as coisas estão

| | |
|---|---|
| Repositório | `C:\dev\optcg` — **fora do OneDrive**, de propósito (decisão 001) |
| Remote | `github.com/PedroDusek/OP-Project`, **público**, por SSH |
| Branch | `main`, 18 PRs mergeados, CI verde em todos |
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

**Checkpoints 0 a 11 concluídos**, e o 12 começou pela want list. 984 testes
de unidade, integração e componente, mais 30 ponta a ponta. Lint, typecheck e
build passando.

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
| 12 | Want list (29 e 30), Trade Binder (31) e a negociação inteira em aplicação. Falta a interface dela |
| — | Preço de mercado das artes comuns, 96,7% do catálogo, pelo tcgcsv (decisão 050) |
| — | Preço em real pelo PTAX, e o aviso de quando foi conferido (decisão 051) |
| — | Reimpressão virou impressão, não variante (decisão 052) |
| — | Vínculo arte ↔ produto: 478 paralelas com preço automático (decisão 053) |

**Banco de produção populado e conferido**, idêntico ao local em 09/09/2026:
2.785 cartas, 4.431 variantes, 60 sets, 4.834 impressões, **3.170 variantes com
preço** — 2.692 artes comuns por regra e 478 paralelas por vínculo.

Confira com `npm run supabase status` — ele compara as migrations com o
repositório e mostra o estado dos preços, que é o único dado que muda sozinho.

**Migrations em produção: 7 de 7**, alinhadas em 09/09/2026. Estiveram duas
atrás sem ninguém notar, e o custo disso seria alto — publicar código que usa
uma tabela ausente derruba a tela inteira, não só a parte nova.

Por isso `npm run supabase status` agora compara com o repositório em vez de só
contar, e diz em voz alta quais faltam. É o comando a rodar antes de publicar.

**Preços em produção: 2.692 variantes**, importados em 09/09/2026, com a cotação
PTAX de 08/09 (USD/BRL 5,0856). O `status` também mostra isso, porque preço é o
único dado que muda sozinho — e o modo de falha é silencioso: a tela não quebra
sem preço novo, só para de envelhecer sem ninguém perceber.

## As decisões que mais restringem o que vem depois

As 61 estão em `decisions.md`. Estas mudam o que se pode fazer:

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
- **Trocas fora da barra.** Sai de `SECONDARY_DESTINATIONS` e volta para
  `DESTINATIONS` quando a seção existir — e aí a barra passa a ter seis, ou algo
  sai. Decisão do dono do produto na hora.
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

**Trade Binder e matches** — telas 31 e 32, o resto do Checkpoint 12. A want
list (29 e 30) já está de pé, como aba da Coleção (decisão 048).

O que já existe e será usado: `holdsTradeStock` no domínio, que diz quais locais
abastecem o Trade Binder; `matchQuantity`, já testado, que é a regra 4.3
inteira; e `trades`, `trade_participants` e `trade_items` no banco desde o
Checkpoint 2.

Nenhum dos dois depende de preço, e a negociação (telas 33 a 35) deixou de
depender: `card_prices` está populada (decisão 050). O valor de um trade sai de
lá, e sai em dólar — a conversão para real é decisão em aberto.

Depois: negociação, Trade Binder público (Premium) e pagamento.

## O que falta em preços

- **O segredo do agendamento.** `.github/workflows/precos.yml` roda todo dia às
  07:00 UTC (04:00 em Brasília), mas fica inerte até `SUPABASE_DATABASE_URL`
  existir nos secrets do repositório. Só o dono da conta pode criá-lo.
- **Produção ainda sem preço.** O banco local está populado; produção espera
  `npm run supabase prices` ou o primeiro disparo do workflow.
- **Mapear as 351 paralelas ambíguas.** O automático já cobriu 478 (decisão
  053); sobram as cartas com duas ou mais artes dos dois lados, onde é preciso
  dizer qual é a *Alternate Art* e qual é a *Manga*. Entram com
  `origin = 'manual'`, que nenhuma rederivação sobrescreve.
  `npx tsx scripts/levantar-paralelas.ts` gera a lista.
- **168 cartas com paralela que a fonte não oferece.** Não há produto para
  vincular; ficam sem preço até a fonte listá-las.

O protocolo continua: uma branch e um PR por checkpoint, o assistente merge
quando estiver completo e sem pendência, e para antes de iniciar o próximo
(decisão 016).
