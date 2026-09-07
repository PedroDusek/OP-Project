# Handoff — estado em 07/09/2026

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

**Checkpoints 0 a 8 concluídos.** 376 testes de unidade, integração e
componente, mais 27 ponta a ponta. Lint, typecheck e build passando.

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

**Banco de produção populado e conferido:** 2.785 cartas, 4.843 variantes, 60
sets, 4.842 impressões — números idênticos ao local, estrutura conferida objeto
a objeto.

## As decisões que mais restringem o que vem depois

As 37 estão em `decisions.md`. Estas mudam o que se pode fazer:

- **019 + 020** — o catálogo vem do site oficial da Bandai, cujos termos proíbem
  reprodução sem permissão. O risco foi assumido explicitamente pelo dono do
  produto, com mitigações **obrigatórias**: requisições serializadas com
  intervalo, apenas dados factuais, imagens referenciadas na origem e nunca
  copiadas, atribuição visível, e o catálogo nunca reexposto como API pública.
- **026** — consequência direta da 020 no frontend: a imagem de carta **não**
  passa pelo otimizador do `next/image`, que baixaria o arquivo e o serviria do
  nosso domínio. É `<img>` com proporção reservada por CSS.
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
- **033** — o estado da listagem do catálogo mora na URL: busca, filtros e
  página são parâmetros da query string, e a página é renderizada no servidor já
  filtrada. Toda listagem nova segue isso.
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

## Pendências

### Bloqueios de lançamento

1. **Termos de Uso e Política de Privacidade** (decisão 030). As rotas existem e
   dizem que o texto está em preparação. O produto **não pode receber cadastro
   de pessoa real** assim. O texto é decisão do dono do produto.
2. **SMTP próprio no Supabase.** O serviço de e-mail embutido tem cota baixa por
   hora e é do projeto inteiro: estourada, ninguém consegue confirmar conta nem
   redefinir senha. Ver `development.md` 6.1.
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

- `users.plan` pode ser derivável de `premium_until` — depende da política
  comercial, que a especificação reserva ao dono do produto.
- Limite de taxa não escala horizontalmente: contador em memória de processo.
  Vale para as três cotas, inclusive a de tentativas de login.
- Node 20 depreciado pelo SDK do Supabase.
- O `middleware.ts` está deprecado no Next 16, que agora prefere `proxy.ts`. O
  build avisa a cada execução. Migração mecânica, adiada por ser mudança na
  fronteira de sessão.
- Pagamento (Checkpoint 15): Supabase não processa. Para assinatura recorrente
  no Brasil, conta Stripe brasileira **não** tem Pix Automático; PSPs nacionais
  como Asaas e Mercado Pago têm.

## Próximo passo

**Coleção na interface** — telas 17 a 20: minha coleção, filtros, playsets e
edição de quantidade. É onde o produto passa a guardar algo de quem usa, e onde
entram os casos de uso que faltam:

- **Adicionar e alterar quantidade**, com o lock de linha em `collection_items`
  e o conflito estruturado da decisão 007 quando a redução fica abaixo do que já
  está alocado.
- **Contagem e progresso** (`business-rules.md` 2), que destrava as barras nas
  telas de set e a Home, hoje vazias de propósito.
- **Playsets**, com a regra por código e a exclusão de `Leader`.

Depois: armazenamento (21 a 24), edição em massa (25 a 28) e trocas (29 a 35).

O protocolo continua: uma branch e um PR por checkpoint, o assistente merge
quando estiver completo e sem pendência, e para antes de iniciar o próximo
(decisão 016).
