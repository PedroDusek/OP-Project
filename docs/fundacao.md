# A fundação

O que o ColeXa é hoje, por que ele é assim, e o que precisa mudar para ele
deixar de ser um produto de One Piece e virar um produto de **jogos de cartas**.

Escrito em 20/09/2026, a pedido do dono do produto, para servir de referência
quando Pokémon e Magic entrarem. Os outros documentos respondem "como faço X
hoje"; este responde **"por que está assim, e o que quebra se o jogo mudar"**.

| Documento | Para quê |
|---|---|
| `handoff.md` | o estado de agora, e as armadilhas já pagas |
| `decisions.md` | as 103 decisões numeradas, com o porquê de cada uma |
| `business-rules.md` | as regras de negócio, que vencem a especificação visual |
| `architecture.md`, `database.md`, `integrations.md`, `development.md` | o detalhe de cada camada |
| **este** | a base conceitual, e o mapa do que é genérico e do que é One Piece |

---

## 1. O produto

O ColeXa é um aplicativo de **coleção** de card game, feito para o celular e
usado no navegador. Ele responde quatro perguntas que todo colecionador faz:

1. **O que eu tenho?** — a coleção, com busca e filtros.
2. **Onde está?** — binders, caixas e decks, com quantas cópias em cada.
3. **O que falta?** — playsets, progresso por coleção e a want list.
4. **Com quem eu troco?** — o Trade Binder público, a rede e a troca ao vivo.

Em cima disso há a camada paga: valor da coleção, análise, Deck Builder e a
iniciativa nas trocas.

**Estado em 20/09/2026**: no ar em `colexa.fly.dev`, 147 PRs, 1.657 testes de
unidade/integração/componente e 36 de navegador, 20 migrations, 36 tabelas.
Catálogo com 2.785 cartas, 4.431 variantes e 60 sets. Falta o texto legal para
abrir a gente de fora.

### 1.1 O que o produto **não** é

Registrar isto importa tanto quanto o resto, porque metade das decisões existe
para não virar isso:

- **Não é loja.** Não há carrinho, frete, nem intermediação de pagamento entre
  pessoas. Troca é combinada entre duas pessoas; o produto registra e organiza.
- **Não é simulador de jogo.** O Deck Builder confere legalidade e diz o que
  falta; não há partida, mão, nem regra de turno.
- **Não é base de dados pública.** O catálogo nunca é reexposto como API aberta
  (decisão 020), e isso condiciona rotas, cotas e até a rolagem infinita.

---

## 2. O acordo de trabalho, e por que ele moldou o código

Três hábitos explicam a forma do repositório mais do que qualquer escolha
técnica:

1. **Decisão numerada, com o porquê.** Cada escolha que não é puramente técnica
   virou um bloco em `decisions.md`. Mudar é permitido; mudar em silêncio, não.
   São 103 até aqui, e elas são citadas nos comentários do código — é assim que
   quem mexe descobre que aquela linha estranha responde a algo.
2. **Comentário explica por quê, não o quê.** Muitos registram o que foi
   tentado e não serviu. O código tem a densidade de comentário de um projeto
   que espera ser lido por alguém sem contexto — inclusive por você daqui a seis
   meses.
3. **Armadilha vira documento.** O `handoff.md` tem 78 armadilhas numeradas,
   cada uma com o sintoma, a causa e o que fazer. Elas são o ativo mais barato
   do projeto: cada uma custou horas na primeira vez e custa minutos na segunda.

---

## 3. Arquitetura

### 3.1 As camadas, impostas por lint

```
domain          puro: regra e aritmética. Sem I/O, sem Prisma, sem framework.
application     casos de uso. A única camada que fala com infrastructure.
infrastructure  Prisma, Supabase, Stripe, Resend, provedores de catálogo e preço.
http            portas (contratos) e fronteira de sessão.
app/components  telas. Nunca importam infrastructure nem @prisma/client.
```

A fronteira **não é convenção, é regra de lint**: `eslint.config.mjs` recusa o
import errado. Isso é o que fez o projeto sobreviver a três provedores externos
sem espalhá-los pelas telas.

**O padrão que se repete**: uma porta em `http/` (`CatalogProvider`,
`PriceProvider`, `PaymentProvider`, `Mailer`, `ImageStorage`, `AuthProvider`,
`AuthAdmin`), um adaptador em `infrastructure/`, e um caso de uso que só conhece
a porta. Trocar Stripe por outro provedor, ou Bandai por Scryfall, é escrever um
adaptador — não é reescrever o produto.

**Server Actions são finas**: leem a sessão, chamam **um** caso de uso, traduzem
o resultado. O `user_id` vem sempre da sessão, nunca do formulário.

### 3.2 O que decide acesso

Uma regra que vale a pena ter na cabeça inteira: **o acesso Premium sai de
`users.plan` e `users.premium_until`, e de nada mais**. A assinatura na Stripe
explica *por que* aquela data está lá. Nenhuma trava de Premium conhece a
Stripe. Foi isso que permitiu construir a cobrança sem tocar em nenhuma tela de
recurso pago.

---

## 4. O modelo de dados

36 tabelas, cinco núcleos.

### 4.1 Catálogo

```
sets ─┬─ variant_printings ─┬─ card_variants ─── cards
      │                     │                      ├─ card_colors ─ colors
      └─────────────────────┘                      ├─ card_traits ─ traits
                                                   ├─ card_attributes
                                                   ├─ card_mechanics
                                                   └─ card_effects
```

Três ideias que valem para qualquer jogo:

1. **Carta e variante são coisas diferentes.** `cards` é a carta (código, nome,
   custo, poder); `card_variants` é **a arte impressa** (Normal, Alternate Art,
   Manga). Quem coleciona possui variantes; quem monta deck pensa em cartas.
   Quase toda regra de contagem existe por causa dessa distinção.
2. **A impressão é uma tabela à parte.** Uma variante pode sair em vários sets
   (`variant_printings`), e é daí que sai o progresso por coleção — nunca do
   prefixo do código. Sem isso, `OP14-EB04` já teria quebrado a conta.
3. **Vocabulário é dado, não enum.** Cores, traits, atributos e mecânicas são
   tabelas, e a interface monta os filtros a partir delas. É o que permite a
   fonte inventar uma cor nova sem migration.

### 4.2 Coleção e armazenamento

```
users ─ collections ─ collection_items ─ collection_item_locations ─ storage_locations
```

- `collection_items.quantity` é **a única verdade sobre posse**.
- Alocar em local não muda posse. A soma das alocações é `<=` a posse, e o banco
  garante isso com trigger — cópia sem lugar é normal e esperado.
- `storage_locations` tem `type` (binder, caixa, deck) e `purpose` (coleção,
  troca). É `purpose = TRADE` que alimenta o Trade Binder e as trocas.

### 4.3 Trocas, social e cobrança

```
trades ─ trade_participants ─ trade_items ─ trade_item_origins
users ─ user_blocks | user_reports | conversations ─ messages
users ─ subscriptions | payment_events
```

**Invariantes moram no banco, não só no código**: `CHECK` de quantidade
positiva, únicos que impedem duas linhas para a mesma coisa, trigger que recusa
reduzir posse abaixo do alocado, e `ON DELETE` escolhido tabela a tabela
(cascata para o que é só da pessoa, `RESTRICT` para o que é de duas). Há um
teste que compara **todas** as regras de exclusão com a lista documentada: mudar
uma sem querer falha a CI.

---

## 5. O catálogo: a decisão que condiciona o resto

A decisão 020 é a mais estruturante do projeto. Resumo:

- O único identificador estável por arte vem da numeração da Bandai, e toda
  fonte alternativa deriva dela.
- Os termos do site oficial proíbem reprodução sem permissão. Importar o
  catálogo **é** reprodução.
- O dono do produto assumiu o risco, com mitigações **obrigatórias**: requisições
  serializadas e espaçadas, só dados factuais, imagens referenciadas na origem
  (nunca copiadas), atribuição visível, **nunca reexpor como API pública**, e
  importação sob demanda.

Essas mitigações aparecem no código em lugares que parecem desconexos: a cota
por usuário em `/api/catalog`, a rolagem infinita passar por API em vez de
Server Action, o rodapé de toda tela, o pré-aquecimento com três pedidos por
vez, e o cache de imagem com prazo em vez de cópia.

**Para outro jogo, esta decisão precisa ser refeita do zero.** A fonte muda, a
licença muda, e as mitigações mudam junto.

### 5.1 Imagens

A Bandai responde `cross-origin-resource-policy: same-site`, o que impede o
navegador de exibir a imagem a partir do nosso domínio. A saída foi servir pelo
otimizador do Next, que busca no servidor e devolve uma versão encolhida —
guardada em disco por 30 dias, num volume da Fly. Daí nasceram duas coisas:

- o **pré-aquecimento** depois de publicar (200 cartas) e o **rodízio noturno**
  (800 por noite, catálogo inteiro em seis noites);
- o custo real: ~56 KB por carta nas duas larguras, ~250 MB para o catálogo.

---

## 6. Preços

Fonte: espelho do TCGplayer (`tcgcsv.com`), categoria **68** = One Piece.
Cotação: PTAX do Banco Central, só dia útil. Tarefa diária às 4:00 de Brasília.

O problema difícil aqui **não** é buscar preço: é **casar** a nossa arte com o
produto da fonte. A arte comum casa por número; as paralelas não têm número
próprio na fonte, e foi preciso um vínculo explícito (`variant_source_products`),
alimentado por trabalho manual conferido e pela tabela da LigaOnePiece.

O que a tela mostra tem duas datas, e a confusão entre elas já gerou pergunta:
**quando conferimos** (nossa importação) e **de quando é o dado** (o espelho
publica ~17:00). Um preço "de ontem" costuma estar certo.

---

## 7. As regras que definem o produto

Vale destacar as que não são óbvias, porque elas provavelmente **mudam** por
jogo:

| Regra | Hoje (One Piece) | Onde mora |
|---|---|---|
| Playset | 4 cópias da **carta**, somando todas as artes; Leader não conta | `domain/collection/counting.ts` |
| Progresso | variantes distintas possuídas ÷ variantes do catálogo (ou do set) | `business-rules.md` 2.2 |
| Deck | 1 líder + 50 cartas, no máximo 4 por código, **uma cor em comum com o líder** | `domain/decks/deck.ts` |
| Troca | um trade ativo por vez; dois participantes; origem das cópias escolhida por quem dá | `domain/trades/` |
| Disponível para troca | o que está em local com `purpose = TRADE` — e isso **não** é reserva | regra 4.2 |

---

## 8. Infra e operação

| Peça | Onde | Observação |
|---|---|---|
| Site | Fly.io, São Paulo, 1 máquina `shared-cpu-1x` de 1 GB | sempre ligada; as cotas moram na memória do processo |
| Banco, autenticação, Storage | Supabase, São Paulo | plano gratuito: 15 conexões no pooler, 5 GB de egress, sem backup |
| Cache de imagem | volume de 1 GB na Fly | sobrevive à publicação |
| Tarefas | GitHub Actions | preços (diária), contas a excluir (diária), aquecer (noturna), publicar (à mão) |
| E-mail | Resend | denúncia, exclusão de conta, feedback, e o SMTP do Supabase |
| CAPTCHA | Cloudflare Turnstile | nas três telas de conta |
| Cobrança | Stripe | construída, **desligada** até as chaves existirem |

**Produção nunca é alvo padrão.** `DATABASE_URL` é sempre o banco local; o
Supabase só é alcançado por `npm run supabase <comando>`, que imprime o destino
antes de agir. Não existe comando de reset para produção, de propósito.

**Capacidade medida**: ~75 ms por página com banco, ~37 páginas/s, 157 MB de
memória. Dá 30 a 50 pessoas negociando ao mesmo tempo, ou 200 a 300 navegando. O
primeiro limite a estourar não é o servidor: é o egress do Supabase.

---

## 9. Qualidade

| Nível | Onde | O que protege |
|---|---|---|
| Domínio | `tests/domain` | a aritmética e as regras, sem banco |
| Integração | `tests/integration` | o que só o banco mostra: unicidade, trigger, transação, permissão |
| Componente | `tests/components` | o que a tela diz e o que ela faz com o toque |
| Navegador | `tests/e2e` | responsividade e fluxo real, no build de produção |

Dois hábitos que pagaram:

- **Teste que fica obsoleto por mudança de regra é atualizado com honestidade**,
  dizendo no comentário que a regra mudou. Nunca afrouxado para passar.
- **Guardas automáticas** para o que a revisão humana esquece: toda tela tem
  voltar, toda tabela está na lista de exclusão, todo arquivo de imagem de set
  está na lista do componente.

---

## 10. Os dez desafios que mais ensinaram

1. **Identificar arte sem identificador.** A fonte de preço não numera
   paralelas. Solução: vínculo explícito, alimentado por trabalho humano
   conferido, e nunca por adivinhação de padrão.
2. **`OP14-EB04`.** Um set cujo código não segue o prefixo das cartas quebrou a
   premissa de derivar set do código. Solução: `variant_printings` como verdade.
3. **Imagem que o navegador recusa.** Cabeçalho da origem impedia exibir. Solução:
   servir pelo otimizador, com cache em volume e pré-aquecimento.
4. **Transação longa demais.** Três consultas por carta numa leva de 131 cartas
   estourou o prazo e desfez tudo. Solução: uma instrução em lote para a leva
   inteira. **Conte idas ao banco antes de contar itens.**
5. **Quinze conexões.** O build do Next copia o módulo do Prisma em quatro
   pedaços; cada cópia abria o próprio pool. Solução: instância única por
   processo e teto explícito abaixo do limite do provedor.
6. **Estado que só existia na memória da aba.** Recarregar apagava a escolha de
   131 cartas. Solução: rascunho no navegador de quem escolhe, com retomada
   oferecida, nunca automática.
7. **Tela com teto mudo.** A coleção mostrava 100 cartas e parava sem avisar.
   Solução: paginação de verdade — e a regra: ou pagina, ou diz o teto em voz
   alta.
8. **Concorrência de verdade.** Duas levas simultâneas, dois lados marcando a
   troca. Solução: somar no banco (`quantity + EXCLUDED.quantity`), travar linha
   ao concluir, e deixar o único do banco resolver corrida.
9. **Segredos e ambientes.** Produção alcançada por engano é o erro caro. Solução:
   alvo explícito, recusa de URL local, e nenhum segredo passando pela conversa.
10. **Processo.** Branch criada a partir da branch errada levou um checkpoint
    inteiro para a `main` sem revisão. Solução virou armadilha 75: branch sai da
    `main`, e `git log main..HEAD` antes de abrir o PR.

---

## 11. O que é genérico, e o que é One Piece

Esta é a seção que interessa para Pokémon e Magic. A coluna "muda?" responde
"isto precisa de trabalho quando entrar outro jogo?".

### 11.1 Genérico, aproveita inteiro

| Peça | Muda? | Por quê |
|---|---|---|
| Conta, sessão, CAPTCHA, exclusão de conta | não | nada disso sabe de carta |
| Coleção, posse, alocação em locais | não | "possuo N cópias desta arte" vale para qualquer jogo |
| Binders, caixas, decks como locais | não | é mobília, não regra de jogo |
| Want list | não | idem |
| Trocas: ciclo, um ativo por vez, origem das cópias | não | a mecânica é do produto, não do jogo |
| Social: identidade, bloqueio, denúncia, conversas | não | idem |
| Planos, cobrança, cortesia | não | idem |
| Infra, tarefas, publicação, cache de imagem | quase nada | o rodízio vira "por jogo" |
| Vocabulário como tabela (cores, traits, mecânicas) | não | já é dado, não código |

### 11.2 Amarrado ao One Piece

| Peça | Onde | O que fazer |
|---|---|---|
| `cards.type` = Leader/Character/Event/Stage | `domain/catalog/types.ts` | vocabulário por jogo |
| Campos de jogo: `cost`, `power`, `life`, `counter`, `has_trigger`, `block_icon` | `cards` | ou colunas opcionais por jogo, ou um bloco de atributos por jogo |
| Filtro de counter (0/+1000/+2000) | `domain/catalog/counter.ts` | é filtro de One Piece |
| Playset = 4, Leader não conta | `domain/collection/counting.ts` | Magic tem terreno básico; Pokémon, energia básica |
| Deck: 1 líder + 50, cor em comum | `domain/decks/deck.ts` | Magic: 60 + reserva, ou Commander 100 singleton; Pokémon: 60 |
| Código da carta único (`OP01-001`) | `cards.code UNIQUE` | **ver 11.3**: é a restrição mais perigosa |
| Ordem de lançamento dos sets, classificação por prefixo | `domain/catalog/sets.ts` | por jogo, e idealmente vinda da fonte |
| Provedor do catálogo (HTML da Bandai) | `infrastructure/catalog/` | um adaptador por jogo |
| Fonte de preço: categoria 68 do TCGplayer | `tcgcsv-price-provider.ts` | a mesma fonte cobre Magic e Pokémon: **é configuração, não reescrita** |
| Vínculo de arte e tabela da Liga | `prices/link-art-products.ts` | o problema existe em qualquer jogo com arte alternativa, mas a heurística é específica |
| Imagens da Bandai e o cabeçalho dela | `next.config.ts`, `optimized-image.ts` | fonte e licença por jogo |
| Textos da interface ("cartas", "Leader", "playset") | telas | revisar por jogo |

### 11.3 A restrição que exige mais atenção

`cards.code` é **único no banco inteiro**. Em One Piece isso funciona porque o
código já carrega a coleção (`OP01-001`). Em Magic e Pokémon, o mesmo nome sai
em dezenas de coleções, e o "código" só é único **dentro** do set. Duas saídas:

- **Chave composta** `(jogo, código)` — simples, e resolve o caso de Pokémon e
  Magic se o código incluir o set.
- **Separar carta conceitual de impressão** — a carta é o nome/regra, e cada
  impressão é uma variante ligada a um set. **O modelo atual já é quase isso**:
  `cards` + `card_variants` + `variant_printings`. Para Magic, "Raio" seria uma
  `card`, e cada impressão uma `card_variant` com sua raridade, arte e acabamento.

A segunda é mais fiel e reaproveita playset, progresso e want list sem
reescrever nada. Ela exige acrescentar acabamento (foil/não-foil), idioma e,
talvez, estado de conservação — três dimensões que One Piece não nos obrigou a
ter e que, em Magic, **definem preço**.

---

## 12. Três caminhos para multi-jogo

### A. Uma instância por jogo (colexa.com.br/onepiece, /magic…)

Bancos separados, mesmo código. **Prós**: zero risco de vazar dado de um jogo
para outro; regras por jogo ficam simples. **Contras**: a pessoa tem três contas,
três assinaturas, três redes sociais — e trocar entre jogos vira trocar de
produto. Custo de infra multiplica.

### B. Um produto, jogo como dimensão do dado (recomendado)

Uma coluna `game` nas tabelas de catálogo, e o jogo escolhido vira um filtro
presente em toda consulta. Conta, rede, assinatura e trocas são **uma só coisa**.

**Prós**: é o produto que o dono descreveu — "minha coleção", não "minha coleção
de One Piece". Uma assinatura, uma rede, um Trade Binder que pode ter cartas de
dois jogos. **Contras**: toda consulta precisa do filtro; esquecer um filtro é o
novo modo de falha, e precisa de teste que o proteja.

### C. Híbrido: dados juntos, regras por jogo em módulos

Que é o B com disciplina: as regras que mudam (playset, deck, tipos, filtros)
saem de um **registro por jogo** no domínio, e o resto não sabe que existe mais
de um jogo.

```
domain/jogos/one-piece.ts   playset 4 (exceto Leader), deck 1+50, tipos, filtros
domain/jogos/magic.ts       playset 4 (exceto terreno básico), deck 60+15…
domain/jogos/pokemon.ts     playset 4 (exceto energia básica), deck 60…
domain/jogos/index.ts       registro: dado um jogo, devolve as regras
```

**É o caminho que eu recomendo**, e a arquitetura atual já empurra para ele: as
regras estão em `domain`, puras e testadas, e não espalhadas nas telas.

---

## 13. Plano de migração, em passos que entregam valor

Cada passo cabe num checkpoint com PR próprio, e nenhum exige parar o produto.

1. **Nomear o jogo.** Acrescentar `game` em `sets`, `cards` e `card_variants`,
   com `one-piece` como padrão. Migration simples, zero mudança de tela.
2. **Trocar o único.** `cards.code` passa a ser único por `(game, code)`.
3. **Registro de regras por jogo** (`domain/jogos/`), começando por playset e
   tipos. One Piece continua igual, agora por dentro de uma estratégia.
4. **Filtro obrigatório.** Toda consulta de catálogo e coleção recebe o jogo, e
   um teste garante que nenhuma escapa.
5. **Escolha de jogo na interface** — e a decisão do dono do produto sobre onde
   ela vive: perfil, gaveta, ou por tela.
6. **Segundo provedor de catálogo**, com a decisão de fonte e licença refeita
   (um novo "020" para o jogo que entrar).
7. **Preço**: apontar o importador para a categoria do jogo novo e reescrever a
   heurística de vínculo de arte.
8. **Imagens**: adaptador de imagem por jogo, e o rodízio noturno passa a
   percorrer os dois catálogos.
9. **Deck Builder por jogo**, que é onde as regras mais divergem.
10. **Revisão de texto** em toda tela: "cartas", "coleção", "playset" sobrevivem;
    "Leader", "counter" e "DON!!" não.

### 13.1 O que decidir **antes** da primeira linha

- **Uma coleção ou várias?** A pessoa tem "uma coleção" com cartas de três jogos,
  ou uma por jogo? Isso muda contagem, dashboard e progresso.
- **Trade Binder misto?** Pode-se oferecer Magic e One Piece no mesmo link?
- **Assinatura única?** Premium vale para todos os jogos, ou por jogo?
- **Acabamento, idioma e conservação** entram agora? Em Magic eles definem preço;
  ignorá-los faz o valor da coleção ficar errado.
- **Fonte de catálogo e licença** de cada jogo — a pergunta mais lenta, e a que
  precisa começar antes.

---

## 14. Riscos conhecidos para os próximos jogos

| Risco | Por que importa | Como mitigar |
|---|---|---|
| Catálogo muito maior | Magic tem dezenas de milhares de cartas; o dashboard hoje lê o catálogo inteiro a cada abertura | paginar e cachear antes de importar, não depois |
| Preço com muitas dimensões | foil, idioma, conservação multiplicam a chave do preço | decidir a chave antes de importar preço |
| Licença de imagem | cada jogo tem regra própria | refazer a decisão 020 por jogo, com o dono do produto |
| Egress e banco | catálogo maior come o plano gratuito do Supabase | medir antes; o Pro já é recomendado por causa do backup |
| Vocabulário divergente | "raridade" e "tipo" não significam o mesmo nos três jogos | vocabulário por jogo desde o primeiro dia |
| Tela genérica demais | tentar uma interface que sirva a três jogos costuma servir mal aos três | aceitar componentes por jogo onde a regra difere |

---

## 15. Se eu pudesse dar um conselho só

O que sustentou este projeto não foi nenhuma escolha técnica isolada: foi manter
**a regra no domínio, pura e testada**, e tudo que é do mundo atrás de uma porta.
É por isso que trocar de provedor de pagamento é escrever um adaptador, e é por
isso que acrescentar um jogo é acrescentar um módulo de regras — e não reescrever
o produto.

O segundo conselho: **continue registrando as armadilhas**. Elas parecem
folclore até a terceira vez que uma delas economiza uma tarde.
