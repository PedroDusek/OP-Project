# Regras de Negócio

Declaração oficial das regras de domínio. Toda regra descrita aqui é coberta por
teste automatizado; os cenários da seção 7 correspondem a `tests/domain`.

Todas elas são aplicadas no servidor. O frontend nunca é fonte de verdade para
nenhuma delas.

---

## 1. Modelo de posse

### 1.1 Coleção

Cada usuário possui exatamente uma coleção (`collections.user_id` é único). A
coleção nasce vazia e representa tudo o que o usuário possui.

Catálogo e coleção são conceitos diferentes: uma variante pode existir no
catálogo e não pertencer a coleção nenhuma.

### 1.2 O que significa possuir

`collection_items.quantity` é o número de cópias físicas de uma variante que o
usuário possui. É a única fonte de verdade sobre posse.

Uma cópia que está num deck, numa caixa de troca ou em lugar nenhum continua
sendo possuída. Alocar em armazenamento nunca altera o que a coleção contém.

---

## 2. Contagem

| Métrica | Definição |
|---|---|
| **Total de cartas** | `SUM(collection_items.quantity)` na coleção |
| **Cartas únicas** | quantidade de `card_variant_id` distintos com `quantity > 0` |
| **Playsets fechados** | ver 2.1 |

Normal, Alternate Art e Manga são variantes distintas e contam separadamente
para as únicas.

### 2.1 Playset

Playset é definido por **código de carta**, não por variante.

1. Agrupe todas as variantes possuídas por `cards.id`.
2. Some as quantidades de todas as variantes daquela carta.
3. Se a soma for `>= 4`, aquela carta vale **exatamente um** playset fechado.

O resultado é binário por carta. Oito cópias continuam sendo um playset; a
contagem nunca é `floor(soma / 4)`.

Cartas do tipo `Leader` nunca contam playset. `DON!!` está fora do catálogo.
`Character`, `Event` e `Stage` contam.

### 2.2 Progresso

```
progresso da coleção = variantes distintas possuídas / variantes distintas do catálogo

progresso do set = variantes distintas possuídas impressas no set
                   / variantes distintas impressas no set
```

Ambos usam variantes distintas, nunca contagem de cópias.

> O progresso é **recurso Premium** desde a decisão 093, junto com o resto da
> análise da coleção. O total de cartas continua visível para todos.

A participação num set vem sempre de `variant_printings`. Nunca é derivada do
prefixo do código da carta.

Isso não é teórico: o catálogo importado tem `OP14-EB04` e `OP15-EB04`, cujos
códigos não seguem o prefixo de um set só, e a contagem por set só fecha porque
vem das impressões.

Uma variante impressa em vários sets conta no numerador **e** no denominador de
cada set em que aparece, de modo que todo set continua alcançando 100%. O
progresso da coleção conta variantes distintas, então nada é contado em
duplicidade ali.

---

## 3. Armazenamento físico

### 3.1 Locais de armazenamento

Um local de armazenamento tem `type` e `purpose`:

| type | purpose permitido |
|---|---|
| `BINDER` | `COLLECTION` ou `TRADE` |
| `BOX` | `COLLECTION` ou `TRADE` |
| `DECK` | `NULL` |

Uma box pode ser de troca. Isso é explicitamente permitido.

Deck é um local de armazenamento do tipo `DECK`. Não existe tabela separada de
deck, nem deck builder, validação de leader, formato ou banlist nesta versão.

### 3.2 Alocação

`collection_item_locations.quantity` registra quantas cópias de um item da
coleção estão em um local de armazenamento.

A invariante é:

```
SUM(collection_item_locations.quantity) <= collection_items.quantity
```

A soma pode ser **menor** que a quantidade possuída. Cópias sem localização
registrada são normais e esperadas. Não existe local "Unallocated".

O local de armazenamento precisa pertencer ao mesmo usuário dono da coleção.

### 3.3 Reduzir a quantidade abaixo do que está alocado

Alocações nunca são removidas silenciosamente, e **nenhuma ordem de remoção é
presumida**. O que a regra protege é a escolha: ninguém decide por quem tem a
carta de qual local as cópias saem.

Presumir só faz sentido quando há mais de uma resposta possível. Em dois casos
não há, e neles a retirada é deduzida e aplicada sem perguntar:

| Caso | Por que não há escolha |
|---|---|
| A nova quantidade é **zero** | Não sobra cópia nenhuma: todas as alocações vão junto. |
| Todas as cópias guardadas estão em **um local só** | É de lá que elas saem. |

Fora esses dois, a escrita é rejeitada atomicamente e a API devolve um conflito
contendo as alocações atuais. O cliente apresenta uma tela de resolução onde o
usuário escolhe de quais locais as cópias saem, e envia essa resolução junto com
a nova quantidade como uma única operação transacional.

A dedução foi acrescentada pelo dono do produto depois do primeiro uso real:
pedir para remover a carta da coleção e receber uma pergunta sobre de onde
tirá-la, sendo que sai tudo, é atrito sem informação (decisão 049).

---

## 4. Trocas

### 4.1 Os quatro estados

São quatro coisas diferentes e nunca são tratadas como iguais:

| Estado | Significado | Origem |
|---|---|---|
| **Possuída** | o usuário possui | `collection_items.quantity` |
| **Disponível para troca** | está em local com purpose `TRADE` | soma das alocações em armazenamento `TRADE` |
| **Comprometida em troca** | está listada em um trade ativo do usuário | derivado dos `trade_items` de trades em `PROPOSED`, `NEGOTIATING` ou `CONFIRMED` |
| **Efetivamente trocada** | o trade chegou a `COMPLETED` | `trades.completed_at` |

A disponibilidade conta apenas armazenamento com purpose `TRADE`. Cópias em
armazenamento `COLLECTION` e em decks são excluídas, embora continuem
integralmente na coleção.

### 4.2 Trade Binder não é reserva

Estar no Trade Binder significa disponível para troca. Não significa
comprometida com ninguém.

### 4.3 Matching

O matching compara a disponibilidade de troca de um usuário com a want list de
outro:

```
quantidade do match = MIN(disponível_para_troca, quantidade_desejada)
```

Um match é sugestão. Não cria obrigação e não é persistido.

### 4.4 Want list

Wants são por variante. As versões Normal e Manga da mesma carta são dois wants
independentes. Não existe prioridade nem campo de observação nesta versão.

A tela 30 da especificação visual mostra um campo "Minhas anotações". Ele **não
existe**: a regra acima vence, e o dono do produto confirmou (decisão 048). O
campo volta quando houver um uso concreto, provavelmente junto de prioridade.

Um want tem três estados, derivados do que a pessoa possui da mesma variante:
não possuo, tenho algumas, já consegui. Um want satisfeito continua na lista até
ser tirado — quem quis quatro e tem quatro pode querer uma quinta para trocar.

Na interface a want list é uma aba da Coleção, e não de Trocas: ela é a coleção
pelo avesso, e quem a abre está pensando na própria coleção.

### 4.5 Ciclo de vida do trade

```
DRAFT -> PROPOSED -> NEGOTIATING -> CONFIRMED -> COMPLETED
                                              -> CANCELLED
```

Não existem outros estados.

- Um `DRAFT` pode estar incompleto.
- Um trade efetivo tem exatamente dois participantes.
- Cada `trade_item` pertence a um participante, e é isso que identifica quem
  oferece qual carta.
- Um usuário pode ter **no máximo um trade ativo por vez**, sendo ativo os
  estados `PROPOSED`, `NEGOTIATING` e `CONFIRMED`. É isso que impede que as
  mesmas cópias sejam comprometidas em vários trades ao mesmo tempo.
- Um usuário pode ter qualquer quantidade de trades históricos.

### 4.6 De onde saem as cartas de um trade

Ao concluir um trade, as cópias saem por padrão dos locais com purpose `TRADE`,
que é onde elas estavam disponíveis para troca (4.1). É a mesma regra da seção
3.3 aplicada aqui: deduzir quando a resposta é única, perguntar quando há
escolha real.

Há escolha real quando as cópias oferecidas estão espalhadas por mais de um
local de troca e o trade leva só parte delas — por exemplo, trocar 2 tendo 4
divididas em dois Trade Binders. Nesse caso, e só nele, o usuário confirma de
onde elas saem.

### 4.6.1 Como uma troca começa, e por que não existe vitrine

O usuário 1 abre a troca e recebe um **link de convite**, que ele manda por onde
já conversa. Quem abre o link entra. Não existe diretório de pessoas para vazar,
porque não existe diretório: buscar por e-mail ou por nome revelaria quem é
cadastrado a quem tentasse (decisão 056).

O convite é queimado quando alguém entra — um link que continua valendo é um
link que ainda pode vazar, e um trade efetivo tem exatamente dois participantes.

> **Acrescentado pela decisão 082** (16/09/2026), a pedido do dono do produto:
> também se convida **direto** alguém da rede, pelo Trade Binder dela na Social.
> O convite aparece em Trocas de quem recebe, que **aceita ou recusa**. O
> consentimento continua fechando no gesto de quem recebe: antes do aceite,
> nenhum dos dois vê o cruzamento, e quem recebeu não mexe na troca. Um convite
> aberto por vez, como o link.


**Dado privado só é cruzado com consentimento das duas partes.** Não existe tela
que mostre o Trade Binder ou a want list de estranhos: isso violaria a regra 6.2,
e a 6.1 já reserva a publicação do Trade Binder ao Premium, com token explícito.

O ciclo é:

1. O usuário 1 inicia a troca com o usuário 2.
2. O usuário 2 entra na troca. **É aqui que o consentimento fecha** — antes
   disso, nenhum dado privado de nenhum dos dois é cruzado nem exibido.
3. O sistema cruza want list e Trade Binder **nas duas direções**, e mostra o
   que 1 tem de interesse para 2 e o que 2 tem de interesse para 1.
4. Cada um ajusta **a própria oferta**.

O cruzamento é a regra 4.3 aplicada duas vezes, uma para cada direção.

### 4.6.2 Cada um mexe só na própria oferta

Um participante nunca altera o que o outro oferece. A oferta de cada um são os
`trade_items` do `trade_participant` dele, e é o servidor que garante isso — um
`trade_participant_id` vindo do cliente nunca é confiável (regra 6.2).

### 4.6.3 Confirmação, e o que a revoga

A troca é validada quando **os dois** participantes confirmam.

**Qualquer alteração na troca revoga as confirmações já dadas**, e a pessoa
afetada é avisada: *"o usuário X alterou a troca, revise e confirme
novamente"*. Confirmar de novo é obrigatório.

A revogação vale para as duas confirmações, e não só para a do outro: quem
confirmou uma proposta e em seguida mudou a própria oferta não confirmou esta.
A regra escrita pelo dono do produto cobre o primeiro caso; o segundo é a mesma
regra levada a sério, porque uma confirmação que sobrevive à própria alteração
diz respeito a uma troca que não existe mais.

Sem isso, o valor da confirmação seria ambíguo: ninguém saberia se o outro
concordou com o que está na tela ou com uma versão anterior dela.

**Confirmar só é possível cinco segundos depois da última alteração da oferta**
(decisão 065). A espera conta a partir da alteração de **qualquer um dos dois**,
e trava o botão dos dois.

Ela existe contra um golpe específico: mudar a oferta no instante exato em que o
outro toca em confirmar. Cinco segundos não impedem a tentativa — impedem que
ela funcione sem que a pessoa veja. Quem aplica a espera é o servidor; o botão
desabilitado é aparência.

Confirmar e retirar a confirmação **não** reiniciam a espera: nenhum dos dois
altera a oferta.

### 4.6.4 A negociação acontece ao vivo

Os dois lados veem a oferta do outro mudando sem recarregar a página. A tela
pergunta ao servidor a cada dois segundos e se redesenha quando algo muda
(decisão 065), e pausa enquanto a aba não está visível.

### 4.7 Conclusão

**Os dois participantes marcam que as cartas trocaram de mão**, e a troca conclui
quando o segundo marca (decisão 062).

Marcar não é confirmar. Confirmar é concordar com a oferta que está na tela;
marcar é dizer que o encontro aconteceu. Entre um e outro pode passar uma semana,
e é por isso que `CONFIRMED` é estado de descanso e não passagem. Só se marca uma
troca confirmada.

Cada um marca por si, e ninguém tem a coleção alterada pelo gesto do outro. É
também o que dá a quem oferece a chance de responder, pelas próprias cópias, a
pergunta da regra 4.6.

**Qualquer alteração na troca revoga as marcações**, como revoga as
confirmações (4.6.3), e pelo mesmo motivo: uma marcação fala da troca que estava
na tela. Retirar a própria marcação é permitido e não desfaz a confirmação.

Concluir um trade valida, numa única transação:

1. exatamente dois participantes;
2. o trade possui itens;
3. toda variante oferecida pertence ao participante que a oferece;
4. toda quantidade oferecida está de fato disponível para troca;
5. as duas coleções são atualizadas;
6. as localizações são atualizadas quando aplicável;
7. `completed_at` é definido.

As verificações 3 e 4 acontecem **na conclusão**, e não só na marcação: entre uma
marcação e outra as cópias podem ter saído do local de troca.

Se qualquer etapa falhar, a transação inteira sofre rollback. Um trade nunca é
concluído parcialmente.

As cópias recebidas entram na coleção **sem localização registrada**. Cópia sem
lugar é normal e esperada (3.2), e escolher um destino por quem recebeu seria
decidir no lugar dela.

---

## 5. Preços e valoração

`card_prices` guarda **o preço de agora**: uma linha por variante, sobrescrita
(decisão 107, 22/09). **Não há histórico de preço.**

Até 22/09 a tabela era histórica, para sustentar a 5.1 abaixo. A regra nunca foi
implementada, o dono do produto decidiu que **o produto não guarda valor de carta
em troca nenhuma**, e nenhuma consulta do sistema lê preço de data passada —
dashboard, análise de deck e página da carta leem o valor corrente.

A escrita **só acontece quando o valor muda** (decisão 050, mantida): é o que dá
sentido a `captured_at`, que significa **desde quando a carta está neste preço**.
Quando cada importação rodou fica em `price_imports`, e não em `card_prices` —
são duas afirmações diferentes, e confundi-las faz a tela dizer "atualizado hoje"
sobre uma mudança de três semanas atrás.

### 5.0 Moeda

Os preços são cotados em **dólar**, e é assim que ficam gravados. O valor em
real é **derivado na leitura**, multiplicando pela cotação de `exchange_rates`
do dia — nunca guardado (decisão 051).

Guardar o convertido criaria duas verdades para o mesmo fato: o Banco Central
corrige cotação publicada, e o número gravado continuaria contando a história
antiga. Derivar custa uma multiplicação e não pode divergir.

Sem cotação utilizável, o valor em real não é exibido. Converter por taxa velha
seria apresentar um palpite com cara de dado.

| Valor | Definição |
|---|---|
| Valor da coleção | `SUM(quantidade * preço de mercado atual)` |
| Valor do set | idem, restrito às variantes impressas no set |
| Valor do Trade Binder | idem, restrito às alocações em armazenamento `TRADE` |
| Valor do trade | idem, por lado do trade |

### 5.1 Valor histórico do trade — **abandonada em 22/09**

A regra dizia: *"o valor de um trade concluído reflete o preço vigente em
`trades.completed_at`, resolvido a partir de `card_prices`"*.

**Ela nunca foi implementada, e não será.** O dono do produto decidiu em 22/09
que o ColeXa **não guarda valor de carta em troca nenhuma** — nem snapshot em
`trade_items`, nem resolução por data. Um trade concluído é o registro de quais
cartas trocaram de mãos, e nada mais.

Com isso caiu a única justificativa do histórico de preço, e ele foi removido
(decisão 107). O efeito prático: o valor que a tela mostra durante a negociação
(5.2) continua sendo **indicativo e de hoje**, e nada é registrado ao concluir.

### 5.2 Durante a negociação

A interface mostra os dois lados, as cartas, as quantidades, os preços
unitários, o total de cada lado e a diferença. O valor é indicativo.

---

## 6. Compartilhamento e acesso

### 6.1 Trade Binder público

Um usuário pode publicar o seu Trade Binder em `/trade/<token>`. O token é
aleatório, não sequencial, nunca derivado de um id interno, e pode ser revogado
e regerado. Regerar derruba o link anterior.

**O que se publica é o conjunto** (decisão 064): todas as cópias em locais de
finalidade `TRADE` aparecem somadas, como uma coleção só. A divisão entre binder
e caixa é organização de quem guarda, e não diz nada a quem abre o link
procurando uma carta. Por isso o token é da pessoa, e não do local — isto
**altera a decisão 008**.

Publicar exige **nome de usuário**, porque é ele que a página mostra (6.1.1).

A página pública expõe **somente** o nome de usuário e aquele Trade Binder.
Nunca expõe a coleção, outros armazenamentos, decks, wants, nome real, e-mail,
nem quantas cópias a pessoa possui ao todo. Token inexistente e token revogado
dão a mesma resposta.

A regra reserva o recurso ao **Premium**, e a trava está em `publishTradeBinder`
desde a decisão 093. Enquanto não existe pagamento, o Premium é dado por comando
(`npm run supabase premium`), que é como os testadores recebem o acesso.

### 6.1.1 Nome de usuário

Cada pessoa escolhe um **nome de usuário**, único em toda a rede. É a única
identidade que outros usuários veem: nome real e e-mail permanecem invisíveis.

Pode ser alterado **uma vez por semana**. O limite existe porque o nome é como
as pessoas se reconhecem entre trocas; trocar à vontade permitiria assumir a
aparência de outra pessoa logo depois de ela mudar, e apagaria o rastro de quem
se comportou mal.

### 6.1.2 A rede: o que é visível, e para quem

Um usuário autenticado vê, de qualquer outro:

- o **nome de usuário**;
- o **Trade Binder**.

E nada mais. A **want list é pessoal e nunca aparece** — ela diz o que a pessoa
não tem, que é informação sobre ela, e não sobre o que ela oferece.

**O Trade Binder é visível obrigatoriamente**, sem opção de desligar. Estar nele
já significa disponível para troca (regra 4.2); esconder de quem poderia trocar
seria disponibilizar para ninguém. Quem não quer aparecer tira as cartas do
local de troca — o mesmo gesto que já governa o que está disponível.

### 6.1.3 Ordem em que as pessoas aparecem

1. **Assinantes Premium primeiro.** É a vantagem do plano: mais visibilidade
   para negociar.
2. **Desempate: quantas cartas do binder interessam a quem está olhando** — a
   interseção com a want list de quem consulta.

Buscar por uma carta devolve **as pessoas que a têm no Trade Binder**, na mesma
apresentação. Sem ninguém, a tela diz que ninguém na rede tem aquela carta
disponível — e não devolve uma lista vazia sem explicação.

### 6.1.4 Bloquear e denunciar

Qualquer usuário pode **bloquear** outro. Quem está bloqueado não aparece na
rede para quem bloqueou, e não consegue iniciar conversa com ele. A lista de
bloqueados fica nas configurações da conta, com desbloquear ao lado de cada
nome.

Qualquer usuário pode **denunciar** outro. As denúncias chegam a um endereço
próprio do domínio; o que se faz com elas é processo, e não produto.

### 6.2 Autorização

Toda requisição é autorizada no servidor contra o usuário autenticado. Um
`user_id` enviado pelo cliente nunca é confiável. Um usuário nunca consegue ler
ou modificar recursos privados de outro usuário.

---

## 7. Deck Builder

Definido pelo dono do produto em 17/09 (decisão 095).

Um deck tem **1 líder e 50 cartas**, e **toda carta precisa ter alguma cor do
líder** — líder de duas cores aceita as duas. O trait não importa: a cor em
comum é a única exigência de combinação. No máximo **4 cópias da mesma
carta**, somando as artes: duas artes da mesma carta são a mesma carta.

**As listas são guardadas** (decisão 108, 22/09). Até então não eram — a 095
dizia que o ColeXa conferia decks e que guardá-los era outro produto. Usuários
pediram o contrário: montar aos poucos, dar nome e acompanhar quanto falta.

A pessoa monta a lista na tela e o produto responde três coisas:

1. **quantas cópias ela já tem**, das **51 cartas** — o líder é conferido
   junto;
2. **onde estão** — em qual binder ou caixa, com aviso quando estão em local de
   troca (regra 4.2) ou quando não têm local definido; as duas contam;
3. **quanto custa o que falta**, pelo preço da **arte escolhida**.

O que falta pode ir para a want list em um gesto, na mesma arte.

**Auto completar** é a chave que decide o que conta: ligado, as cópias de
qualquer arte da mesma carta cobrem a linha; desligado, só a arte escolhida. Uma
cópia nunca cobre duas linhas.

O que não pode ser jogado é **recusado**, e não avisado: passar de 4 cópias, pôr
carta fora da cor ou um segundo líder. O total de 50 é contagem, porque um deck
em construção passa a maior parte do tempo incompleto.

### 7.1 As decklists salvas (decisão 108)

1. **O líder é obrigatório para salvar**, e continua sendo a primeira escolha. É
   ele que define as cores do resto, e é a **capa** da lista.
2. **A lista pode ser salva incompleta**, e aí ganha a marca **"incompleta"**.
   Montar aos poucos é o caso normal, e foi o que motivou o pedido.
3. **O nome é obrigatório**, e serve só para a pessoa se guiar entre as listas.
4. **A capa é sempre a arte do líder** — não se escolhe imagem.
5. **O progresso é "X de 51"**: quantas cartas a pessoa já tem, contando
   **qualquer arte** da mesma carta, limitado ao que a lista pede. Responde
   "consigo jogar isto?", e para jogar a arte não importa.
6. **Salvar não aceita o que a conferência recusa**: as regras da seção 7 valem
   igual, e são o mesmo código.
7. **Sem limite de listas**, como os binders.
8. **Quem perde o Premium não perde as listas.** Elas continuam guardadas e
   **param de abrir**; a tela diz isso onde a pessoa está. Apagar continua
   possível — quem deixou de assinar segue dono do que criou.

### 7.2 Transferir a lista para uma deckbox (decisão 109)

Montado o deck de papel, a lista pode dizer ao ColeXa que aquelas cartas agora
estão na caixa do deck. O que sai da coleção para a deckbox:

1. **Só o que a lista pede.** Ter oito cópias não manda oito.
2. **O destino é um local do tipo `DECK`**, e só ele.
3. **Uma única pilha fora de troca que cobre tudo**: o sistema tira de lá. Não
   há escolha a fazer, então a regra 3.3 não é ferida.
4. **Mais de uma possibilidade**: o sistema **pergunta**, carta a carta. É a 3.3
   valendo — ninguém decide por quem tem a carta de qual local as cópias saem.
5. **Local de troca não entra por padrão.** O sistema tenta completar sem ele, e
   só usa o que está em troca se a pessoa confirmar: mover de lá **tira a carta
   do Trade Binder público**.
6. **Cópias de outra arte são avisadas**, como na conferência (7, decisão 095).
   Não são impedidas — para jogar a arte não importa.
7. **A confirmação é uma afirmação de fato**: trocar o local apaga de onde a
   carta estava, e não há como recuperar. A tela exige que a pessoa confirme
   **só depois de ter movido as cartas de verdade**.

## 8. Planos: Free e Premium

Definido pelo dono do produto em 17/09 (decisão 093). **Preço e meio de
pagamento, em 19/09** (decisão 102): R$ 14,90 por mês ou R$ 149,00 por ano, na
Stripe, com cartão ou Pix.

**Só no Premium:**

1. **Publicar o Trade Binder** num link público (6.1).
2. **Começar uma troca**, pelo link ou pelo convite direto (4.6.1).
3. **A análise da coleção**, onde aparecer: no Início (o dashboard da decisão
   098 — progresso, valor, custo para completar e distribuição, por coleção,
   raridade e cor) e em Minha Coleção
   (números do cabeçalho, abas Playsets e Faltam, a lista de playsets e a marca
   "Playset" na carta), e a contagem de playsets no detalhe do binder. Inclui o
   progresso (2.2) e, quando existir, o valor estimado.
4. **Compartilhar a want list** — a folha com o que falta, em imagem ou
   impressa. Montá-la e usá-la como quiser é o recurso; **manter a want list**
   continua no Free.
5. **O Deck Builder** (seção 7).
6. **Aparecer primeiro na rede** (6.1.3).

**No Free, sem limite:** cadastrar, **ver, buscar e filtrar** a coleção inteira, binders e caixas, a want list
inteira, catálogo e preços por carta, o total de cartas no
Início, **entrar em trocas** (por convite ou link) e negociar até o fim,
conversar, aparecer na rede com o Trade Binder e bloquear ou denunciar.

**Por que entrar numa troca é de todos:** travar as duas pontas deixaria o
assinante sem ninguém para trocar. Quem paga ganha a iniciativa e a vitrine, não
o direito de negociar.

### 8.1 A assinatura (decisão 102)

1. **O acesso vem de `users.premium_until`**, e de nada mais. A assinatura na
   Stripe é o que explica **por que** aquela data está lá; as travas de Premium
   não sabem que a Stripe existe.
2. **Só o aviso assinado da Stripe libera acesso.** A volta pela tela não
   libera: o endereço de sucesso é adivinhável.
3. **Cartão renova sozinho. Pix não**: cada pagamento compra um ciclo, contado
   do nosso lado, e a tela diz isso antes de a pessoa escolher.
4. **Atraso e cancelamento não cortam o ciclo já pago.** O dinheiro daquele
   período entrou; o acesso cai sozinho quando a data chega.
4.1. **Estorno corta o acesso na hora** (mudança de 21/09). É a exceção à regra
   5: devolveu o dinheiro, acabou o serviço. Vale só para **estorno total** —
   devolver parte não desfaz a compra. E corta só o que **aquele pagamento**
   deu: quem tem acesso mais longo, vindo de cortesia, não perde nada.
4.2. **Contestação de cobrança corta igual ao estorno** (mudança de 21/09), na
   abertura da disputa — que é quando o dinheiro sai da conta. Mesmos limites
   da 4.1. **Disputa ganha por nós não devolve o acesso sozinha**: é pergunta em
   aberto, e até lá se resolve com `npm run supabase -- premium`.
5. **Pagar nunca encurta um Premium mais longo** — é o caso de quem tem
   cortesia e resolve assinar.
6. **Pagar antes de vencer emenda no que falta**; pagar depois recomeça no dia
   do pagamento.
7. **Quem testou tem 6 meses de cortesia** depois que a cobrança abrir, com
   aviso antes de acabar.
8. **Quem já é Premium não vê os planos** — assinar por cima cobraria sem dar
   um dia a mais, porque o acesso nunca é encurtado. Continuam à vista para
   quem paga no Pix, que renova na mão, para quem cancelou ou está com cobrança
   atrasada, e para quem está no teste grátis (8.2).
9. **Quem já assina no cartão não assina de novo**: a tela recusa antes de
   levar ao provedor, dizendo para gerenciar a assinatura que já existe.
10. **O lançamento é só no cartão.** O Pix está construído e desligado — a
    Stripe o libera por convite, e o dono do produto não quis esperar.

### 8.2 O teste grátis de 7 dias (decisão 102, mudança de 21/09)

1. **Sete dias de Premium, sem cartão e sem cobrança.** Não passa pelo provedor
   de pagamento: é a única porta de Premium que não é pagamento nem comando de
   operação.
2. **Uma vez por conta**, para sempre. A trava é `users.trial_started_at`: nulo
   é "ainda não resgatou", preenchido é "já foi". Acabado o teste, o carimbo
   continua lá e o botão não reaparece.
3. **É resgatado, não automático.** A conta nasce Free; os sete dias começam a
   correr quando a pessoa pede, e não quando ela se cadastra — assim ninguém
   perde o teste sem ter usado.
4. **Vale para qualquer conta que nunca resgatou**, nova ou antiga.
5. **Quem já é Premium não resgata.** Queimaria os sete dias sem ganhar um só,
   porque o acesso nunca é encurtado (8.1, regra 5). Fica guardado para quando
   o acesso atual acabar.
6. **O teste nunca encurta um acesso mais longo** — a mesma regra do pagamento,
   pelo mesmo motivo.
7. **Os planos continuam à vista durante o teste**, com um contador de quantos
   dias faltam. O contador **é** o aviso do fim: não há e-mail.
8. **A trava é por conta, não por pessoa.** Outro e-mail dá outro teste, e não
   há como impedir sem cartão ou documento — que o teste existe para evitar. A
   brecha foi aceita pelo dono do produto em 21/09, por escrito.

## 9. Testes obrigatórios de domínio

| # | Cenário | Esperado |
|---|---|---|
| 1 | Normal x2, AA x1, Manga x1 | total 4, únicas 3, playsets 1 |
| 2 | Normal x4, AA x4 | total 8, únicas 2, playsets 1 |
| 3 | Leader x10 | playsets 0 |
| 4 | possui 5: binder 2, box collection 1, box trade 1, deck 1 | total 5, disponível para troca 1 |
| 5 | armazenamento tipo `BOX` com purpose `TRADE` | válido |
| 6 | carta alocada em deck | continua contando na coleção |
| 7 | possui 4, alocações binder 3 + box 2 | rejeitado |
| 8 | want 2, disponível 5 | match 2 |
| 9 | wants de Normal e Manga | independentes |
| 10 | preço R$100 na conclusão, R$150 depois | valor histórico permanece R$100 |
