# Log de Decisões

Apenas decisões aprovadas são registradas aqui. Questões em aberto ficam em
`docs/checkpoint-0-analise.md`, na seção de decisões pendentes, e são promovidas
para este arquivo quando aprovadas.

---

# Decisão: 001 — Localização do repositório fora do OneDrive

## Contexto

A pasta do projeto `C:\Users\pedro\OneDrive\Desktop\OPTCG PROJECT` estava dentro
de um repositório Git acidental cuja raiz era o diretório home do usuário
(`C:\Users\pedro\.git`, 384 MB, zero commits, sem remote, sem `.gitignore`, com
`.ssh/`, `.gitconfig` e `.claude.json` não rastreados). Qualquer `git add`
disparado de qualquer ponto do home arriscava versionar chaves privadas e
credenciais.

A pasta também estava dentro do OneDrive, que sincroniza todo arquivo que
enxerga. `node_modules` contém dezenas de milhares de arquivos pequenos e é causa
conhecida de sincronização excessiva, travamento de arquivo durante build e
instalação corrompida.

## Opções

1. Mover o projeto para `C:\dev\optcg`, fora do OneDrive, e fazer `git init` lá.
2. Fazer `git init` na pasta existente do OneDrive.
3. Opção 1 mais a remoção de `C:\Users\pedro\.git`.

## Decisão

Opção 1. O projeto vive em `C:\dev\optcg` com repositório próprio. Os PDFs de
especificação foram **copiados**, não movidos; os originais permanecem na pasta do
OneDrive. `C:\Users\pedro\.git` não foi tocado.

## Motivo

Remove o risco de exposição de credenciais e os problemas de build do OneDrive de
uma só vez, sem nenhuma ação destrutiva. Apagar o repositório acidental continua
disponível como passo separado e explicitamente autorizado.

## Data

2026-09-06

---

# Decisão: 002 — Stack

## Contexto

O projeto não tinha código. Era preciso escolher uma stack para uma aplicação web
mobile-first que exige garantias transacionais fortes, regras de negócio no
servidor e boa performance em conexão móvel.

## Opções

1. Next.js (App Router) + TypeScript + Prisma + PostgreSQL, repositório único.
2. API NestJS + frontend React (Vite), com deploys separados.
3. Backend ASP.NET Core + EF Core e frontend React.

## Decisão

Opção 1: Next.js + TypeScript + Prisma + PostgreSQL.

A separação de camadas exigida pela especificação (domínio, persistência, regras
de negócio, API, frontend) é imposta por fronteiras de módulo dentro de
`src/server`, que o frontend nunca importa diretamente.

## Motivo

Uma linguagem, um runner de testes, um deploy. `next/image` e React Server
Components entregam a melhor performance mobile sem infraestrutura adicional.
Separar processos não é necessário para separar camadas, e evitar isso mantém o
sistema simples, o que a especificação prefere explicitamente.

## Data

2026-09-06

---

# Decisão: 003 — PostgreSQL como motor de banco

## Contexto

A especificação exige garantias que o motor precisa fornecer diretamente: índices
únicos parciais, restrições `CHECK`, travamento de linha para atualização
concorrente de quantidade, busca textual indexada em código de carta e migrations
reversíveis.

## Opções

PostgreSQL, MySQL/MariaDB, SQLite.

## Decisão

PostgreSQL 17.

## Motivo

O único dos três que suporta índices únicos parciais, `SELECT ... FOR UPDATE` com
a semântica necessária, índices trigram para busca por código e DDL transacional.
Decisão técnica, sem impacto de produto.

## Nota posterior

A máquina de desenvolvimento acabou com o **PostgreSQL 18.6** instalado. O 18
atende a tudo que o schema exige e é oficialmente suportado pelo Prisma (9.6 a
18), então não há motivo técnico para retroceder ao 17. Ver `development.md`
seção 2.

## Data

2026-09-06

---

# Decisão: 004 — Runtime local do banco

## Contexto

Nem PostgreSQL nem Docker estavam instalados na máquina de desenvolvimento.

## Opções

1. Instalação nativa do PostgreSQL no Windows.
2. Docker Desktop com serviço em `docker-compose`.
3. Serviço gerenciado (Neon ou Supabase).

## Decisão

Opção 1: instalação nativa no Windows.

## Motivo

Escolhida pelo dono do produto. Sem camada extra de runtime e sem depender de
conexão com a internet durante o desenvolvimento.

## Data

2026-09-06

---

# Decisão: 005 — Remote no GitHub

## Contexto

Não existia remote configurado e o `gh` não estava instalado.

## Opções

1. Trabalhar sem remote por enquanto.
2. Configurar a URL de um repositório existente.
3. Preparar o repositório localmente e entregar ao dono do produto os comandos
   exatos para criar o remote e fazer o push.

## Decisão

Opção 3, com o desfecho registrado aqui por exatidão.

O repositório foi inicializado localmente na branch `main`. O dono do produto
criou `https://github.com/PedroDusek/OP-Project` manualmente e optou por deixá-lo
**público**. O primeiro push usou a chave SSH já existente na máquina
(`~/.ssh/id_ed25519`), já registrada no GitHub.

O GitHub CLI foi instalado no caminho (`winget install GitHub.cli`), mas não foi
necessário para o push. Permanece disponível e autenticado.

## Motivo

Mantém todo o tratamento de credencial com o dono do produto: nenhum token, senha
ou URL de repositório passou pelo assistente.

Como o repositório é público, todo o histórico de commits é legível por qualquer
pessoa. Duas consequências operacionais decorrem disso: `docs/modelagem/` publica
os PDFs do modelo conceitual e lógico, e nenhum segredo real pode entrar num
commit. O `.gitignore` bloqueia `.env`, `.env.*`, `*.pem`, `*.key` e `*.p12`, e o
histórico é varrido em busca de segredos antes de todo push.

## Data

2026-09-06

---

# Decisão: 006 — Progresso de set com reprints

## Contexto

Uma variante pode ser impressa em vários sets, e a especificação exige que o
progresso por set seja calculado a partir de `variant_printings`, nunca do
prefixo do código. Ela pede explicitamente que se pergunte como contar uma
variante reimpressa.

## Opções

1. A variante conta em todo set em que foi impressa.
2. A variante conta apenas no set original.
3. Igual à 1, mais uma flag `is_primary` em `variant_printings` para exibição.

## Decisão

Opção 1. Uma variante impressa em N sets conta no numerador **e** no denominador
de cada um desses N sets.

## Motivo

É a leitura direta de "variantes únicas daquele set", e mantém todo set alcançável
a 100%. O progresso global da coleção conta variantes distintas, então nada é
contado em duplicidade ali. A opção 2 exigiria armazenar qual é o set original,
atribuição que a fonte externa pode não fornecer com confiabilidade.

## Data

2026-09-06

---

# Decisão: 007 — Reduzir quantidade abaixo do que já está alocado

## Contexto

Cópias podem estar alocadas em locais de armazenamento, e a soma dessas alocações
nunca pode exceder `collection_items.quantity`. Quando o usuário reduz a
quantidade possuída abaixo do total já alocado, a especificação exige uma regra
explícita em vez de uma suposição.

Exemplo: o usuário possui 4 cópias (binder 3, box 1) e reduz a quantidade para 2.

## Opções

1. Rejeitar com erro e exigir que o usuário desaloque antes.
2. Desalocar automaticamente até caber na nova quantidade.
3. Devolver o conflito e deixar o usuário escolher de quais locais retirar.

## Decisão

Opção 3. A escrita é rejeitada atomicamente e a API responde com um conflito que
carrega as alocações atuais, para que o cliente apresente uma tela de resolução
onde o usuário escolhe de onde as cópias saem. A resolução é então enviada como
uma única operação transacional junto com a nova quantidade.

## Motivo

Escolhida pelo dono do produto. Nenhuma alocação é removida sem o usuário ver, e
nenhuma ordem de remoção precisa ser inventada. Custo: uma tela adicional e um
formato estruturado de conflito no contrato de erro, entregues no Checkpoint 9.

## Data

2026-09-06

---

# Decisão: 008 — Token público do Trade Binder

## Contexto

A especificação exige uma página pública do Trade Binder em `/trade/<token>`, com
token aleatório, não sequencial, que não exponha ids internos e que seja revogável
e regerável. Nem o modelo conceitual nem o lógico oferecem onde guardá-lo.

## Opções

1. Colunas em `storage_locations`.
2. Tabela dedicada `storage_share_tokens`, com histórico de tokens revogados.

## Decisão

Opção 1. `storage_locations` ganha `public_token` e `public_token_created_at`,
com índice único sobre `public_token`. Revogar define o token como `NULL`;
regerar grava um novo valor aleatório.

## Motivo

Cobre o requisito inteiro sem uma 25ª tabela. Histórico de compartilhamento não é
exigido pela especificação, e criá-lo agora seria especulativo.

Esta é uma alteração estrutural do modelo aprovado, autorizada pelo dono do
produto.

## Data

2026-09-06

---

# Decisão: 009 — Plano Premium e trial

## Contexto

A especificação define um plano Premium com trial de 7 dias, tendo o Trade Binder
público como recurso Premium. Preço, gateway de pagamento e política comercial
são explicitamente indefinidos. Nenhum dos modelos possui campo de plano ou
trial.

## Opções

1. Colunas em `users`.
2. Tabela dedicada `subscriptions`.

## Decisão

Opção 1. `users` ganha `plan`, `trial_started_at` e `premium_until`.

## Motivo

Cobre exatamente o que está definido hoje sem antecipar decisões de cobrança que
ainda não foram tomadas. Uma tabela `subscriptions` pode ser introduzida depois,
quando existirem gateway e política comercial, sem invalidar este formato.

Esta é uma alteração estrutural do modelo aprovado, autorizada pelo dono do
produto. Nenhum preço, gateway ou política comercial está implícito nela.

## Data

2026-09-06

---

# Decisão: 010 — Nome da coluna de data do preço

## Contexto

As três fontes divergem sobre o nome do campo de data em `card_prices`: o modelo
conceitual diz `data`, o modelo lógico diz `captured_at` e o texto da
especificação diz `date`.

## Opções

`date` ou `captured_at`.

## Decisão

`captured_at TIMESTAMPTZ`, seguindo o modelo lógico.

## Motivo

`date` é palavra reservada em SQL e nome de tipo no PostgreSQL, o que obrigaria a
usar aspas em todo lugar. `captured_at` também preserva a hora, o que importa
para resolver o preço vigente em `trades.completed_at`.

## Data

2026-09-06

---

# Decisão: 011 — "Comprometida em troca" é derivado, não armazenado

## Contexto

A especificação distingue quatro estados: possuída, disponível para troca,
comprometida em troca e efetivamente trocada, e exige que o usuário não consiga
comprometer as mesmas cópias em vários trades ao mesmo tempo.

## Opções

1. Derivar o estado de comprometimento dos trades ativos.
2. Armazenar uma quantidade comprometida na coleção.

## Decisão

Opção 1. Uma cópia está comprometida quando o usuário tem um `trade_item` em um
trade com status `PROPOSED`, `NEGOTIATING` ou `CONFIRMED`. Nenhuma coluna nova é
criada.

## Motivo

Um contador armazenado seria uma segunda fonte de verdade, sujeita a divergir das
linhas de trade. Como o usuário pode ter no máximo um trade ativo por vez, a
consulta derivada permanece barata. Comprometimentos simultâneos são impedidos
por essa mesma regra de trade único, aplicada transacionalmente.

## Data

2026-09-06

---

# Decisão: 012 — Divergências do modelo conceitual resolvem a favor do lógico

## Contexto

O modelo conceitual e o lógico discordam em dois pontos estruturais.

1. Localização física: o conceitual liga `Card_Variant` diretamente a
   `Storage_Location`; o lógico liga `collection_item` a `storage_location`.
2. Itens de trade: o conceitual liga `Trade` diretamente a `Card_Variant`; o
   lógico liga `trade_participant` a `card_variant`.

## Opções

Seguir o modelo conceitual ou seguir o lógico.

## Decisão

O modelo lógico prevalece nos dois casos. As divergências ficam documentadas em
`docs/database.md`. Os PDFs permanecem inalterados.

## Motivo

A versão conceitual de (1) perde o vínculo com a coleção e com o dono, tornando
impossível validar que as alocações nunca excedem a quantidade possuída, ou que o
armazenamento pertence ao dono da coleção. A versão conceitual de (2) perde a
informação de qual participante oferece cada carta, da qual o fluxo de trade
depende. O texto da especificação concorda com o modelo lógico nos dois pontos.

## Data

2026-09-06

---

# Decisão: 013 — Cardinalidades mínimas relaxadas para opcional

## Contexto

O modelo conceitual marca como obrigatórias várias participações que não se
sustentam na prática: toda carta ter ao menos um atributo e ao menos um trait, e
todo usuário pertencer a ao menos um armazenamento e a ao menos um trade.

## Opções

Impor os mínimos do conceitual ou relaxá-los para opcional.

## Decisão

Relaxados para opcional no banco, acompanhando o modelo lógico.

## Motivo

Cartas de Event e Stage não possuem atributo no OPTCG, então uma participação
obrigatória em `Card -> Attribute` rejeitaria dados válidos do catálogo durante a
importação. Um usuário recém-cadastrado não possui armazenamento e não participa
de nenhum trade, então esses mínimos tornariam o cadastro impossível.

## Data

2026-09-06

---

# Decisão: 014 — Restrições de unicidade adicionais

## Contexto

A especificação lista as restrições de unicidade das tabelas principais, mas não
menciona duas das quais o comportamento exigido depende.

## Opções

Depender do código da aplicação ou acrescentar as restrições ao schema.

## Decisão

Duas restrições são acrescentadas:

- `UNIQUE (collection_item_id, storage_location_id)` em
  `collection_item_locations`
- `UNIQUE (name)` em `colors`, `traits`, `attributes`, `mechanics` e `effects`

## Motivo

Sem a primeira, a mesma carta poderia ter duas linhas de alocação separadas para
um mesmo local, o que quebra a soma das alocações e permite contar as mesmas
cópias duas vezes. Sem a segunda, reexecutar a importação do catálogo inseriria
linhas duplicadas de vocabulário, violando o requisito de idempotência. Ambas são
aditivas e não alteram nenhum comportamento definido pela especificação.

## Nota posterior: uma terceira restrição

A revisão de normalização feita antes da migração para o Supabase encontrou uma
lacuna da mesma natureza: `card_prices` aceitava duas capturas da mesma variante
no mesmo instante. Reexecutar a importação de preços duplicaria o histórico, e o
valor histórico de um trade passaria a depender de qual linha a consulta pegasse
— justamente a garantia que a decisão 052 da especificação exige.

Acrescentado `UNIQUE (card_variant_id, captured_at)`, aprovado pelo dono do
produto. Ele substitui o índice de consulta anterior sobre as mesmas colunas em
ordem decrescente, porque um btree ascendente varrido para trás já atende a
consulta de preço mais recente. Confirmado por `EXPLAIN`: o plano usa
`Index Scan Backward` sobre este índice.

## Data

2026-09-06

---

# Decisão: 015 — Exclusão de conta por anonimização

## Contexto

Um trade tem dois participantes, e o registro de um trade concluído pertence aos
dois. Excluir um usuário levanta a questão do que acontece com
`trade_participants`, e nenhuma política de exclusão pode ser escolhida para essa
chave estrangeira sem responder isso.

## Opções

1. Anonimizar a conta e preservar a linha.
2. `RESTRICT`: proibir exclusão de qualquer conta com histórico de trade.
3. `CASCADE`: apagar participações e itens de trade junto com o usuário.
4. Adiar completamente a exclusão de conta.

## Decisão

Opção 1. Contas são anonimizadas e nunca excluídas fisicamente.

`users` ganha um `deleted_at` opcional. Anonimizar preenche esse campo, substitui
`name` por um placeholder, substitui `email` por `deleted+<id>@deleted.invalid`,
limpa `auth_user_id`, desfazendo o vínculo com a conta do provedor, e limpa os
campos de plano. A
coleção, os locais de armazenamento e os wants são removidos pelos cascades já
existentes. As linhas de `trade_participants` e `trade_items` são preservadas.

`trade_participants.user_id` usa `RESTRICT` como rede de segurança, que nunca
deveria disparar porque nenhum caminho de código apaga fisicamente um usuário.

## Motivo

A opção 3 destruiria o histórico do participante que permanece, que nunca
consentiu com isso. A opção 2 impede o usuário de sair do produto. A anonimização
remove o dado pessoal e a capacidade de autenticar, que é para o que exclusão de
conta serve, mantendo todo trade completo para o outro lado.

Esta é uma alteração estrutural do modelo aprovado, autorizada pelo dono do
produto.

## Data

2026-09-06

---

# Decisão: 016 — Fluxo de branch e pull request

## Contexto

O repositório não tinha estratégia de branch estabelecida, e a especificação
exige que o fluxo seja acordado, não presumido.

## Opções

1. Uma branch e um pull request por checkpoint, mergeado pelo dono do produto.
2. Uma branch por checkpoint, mergeada pelo assistente após aprovação no chat.
3. Commits diretamente na `main`.

## Decisão

Opção 2, revisada em 2026-09-06 a pedido do dono do produto.

Cada checkpoint tem uma branch chamada `checkpoint-N/<tema>` e um pull request.
Trabalhos menores usam branches `fix/`, `docs/` e `chore/`.

**O assistente abre a branch, abre o pull request e faz o merge** quando o
checkpoint estiver completo e sem decisão pendente. O dono do produto não
precisa apertar o botão de merge.

Merge commits em vez de squash, para que os commits semânticos internos ao
checkpoint sobrevivam no histórico. Nada é mergeado enquanto houver decisão
pendente naquele checkpoint.

Esta mudança **não** afeta a parada obrigatória entre checkpoints: o assistente
continua apresentando o relatório do checkpoint e aguardando autorização antes de
iniciar o próximo. Mergear é fechar o trabalho já feito, não autorização para
começar o seguinte.

## Motivo

A versão original exigia que o dono do produto mergeasse cada PR manualmente, o
que virou um ponto de espera sem valor: o PR já é revisável a qualquer momento e
o histórico continua registrado no GitHub. O ponto de controle real é a
autorização entre checkpoints, que permanece intacta.

## Data

2026-09-06

---

# Decisão: 017 — Integração contínua

## Contexto

Não existia CI. A especificação pede que a CI seja preservada se já existir e
proposta se for útil.

## Opções

1. GitHub Actions a partir do Checkpoint 2.
2. GitHub Actions mais tarde, quando a suíte de testes amadurecer.
3. Sem CI.

## Decisão

Opção 1. Um workflow do GitHub Actions entra no Checkpoint 2, junto com o
primeiro código: instalação, lint, verificação de tipos, testes unitários, testes
de integração contra um container de serviço PostgreSQL, checagem de migration e
build, em pull requests e na `main`.

## Motivo

Escolhida pelo dono do produto. O fluxo de pull request da decisão 016 só tem
valor real se algo verificar a branch antes do merge. Os minutos do Actions são
gratuitos em repositório público.

Nenhuma infraestrutura de produção, alvo de deploy ou ambiente é configurado por
esta decisão.

## Data

2026-09-06

---

# Decisão: 018 — Idioma da documentação

## Contexto

A documentação foi inicialmente escrita em inglês. O dono do produto é brasileiro
e o projeto é conduzido em português.

## Opções

Manter em inglês ou traduzir para português.

## Decisão

Toda a documentação em `docs/` e o `README.md` ficam em **português**.

Os **nomes dos arquivos permanecem em inglês** (`business-rules.md`,
`database.md`, `architecture.md`, `decisions.md`, `integrations.md`,
`development.md`), porque a especificação os nomeia explicitamente.

Mensagens de commit continuam em inglês, seguindo a convenção Conventional
Commits, e o histórico já existente não é reescrito.

## Motivo

Escolhida pelo dono do produto. A documentação é lida por quem toma as decisões
de produto, então precisa estar no idioma em que essas decisões são discutidas.

## Data

2026-09-06

---

# Decisão: 019 — Identificador externo para variantes

## Contexto

`card_variants` não tem chave natural. O código identifica a carta, não a
variante, e uma mesma carta possui várias alternate arts distintas com o mesmo
`variant_type`, então `(card_id, variant_type)` não pode ser único. Criar um
número de variante artificial é proibido pela especificação.

Sem um identificador vindo da fonte, uma segunda execução da importação não tem
como decidir se uma variante recebida já foi gravada, e a idempotência exigida
fica impossível justamente nas alternate arts.

A investigação registrada em `integrations.md` seção 2.0 verificou que a Bandai
atribui identificador estável por arte, no formato `OP01-016_p3`.

## Opções

1. Colunas `source` e `source_id` em `card_variants`, com índice único no par.
2. Adiar a decisão até a fonte estar escolhida.
3. Nenhuma coluna nova, casando variantes por heurística de imagem e raridade.

## Decisão

Opção 1. `card_variants` ganha `source` e `source_id`, com
`UNIQUE (source, source_id)`.

O identificador externo:

- não substitui a chave primária interna, que continua sendo `id`;
- nunca é exposto como identificador público em URL ou API;
- existe exclusivamente para tornar a sincronização determinística.

A coluna `source` acompanha `source_id` para que a origem fique explícita e uma
eventual troca de fonte não colida com identificadores antigos.

A migration só é escrita depois que a fonte for aprovada, porque é ela que
define o formato de `source_id`.

## Motivo

Autorizada pelo dono do produto. É o caso que a especificação antecipa ao
permitir identificadores externos no modelo físico. A opção 3 falharia
exatamente no caso que motivou a decisão: URLs de imagem mudam, e raridade mais
tipo colide entre as várias alternate arts da mesma carta.

Esta é uma alteração estrutural do modelo aprovado.

## Data

2026-09-06

---

# Decisão: 020 — Fonte do catálogo e mitigações

## Contexto

A avaliação registrada em `integrations.md` seção 2.0 concluiu que o único
identificador estável por arte vem da numeração da Bandai, e que todas as fontes
disponíveis derivam dela. Os termos do site oficial dizem que imagens, texto e
dados não podem ser reproduzidos sem permissão. Acesso automatizado não é
mencionado e não existe `robots.txt`, mas importar o catálogo é reprodução.

Nenhuma fonte intermediária resolve isso, porque nenhuma tem direito de
sublicenciar os dados da Bandai.

## Opções

1. Pipeline próprio a partir da fonte oficial, com mitigações.
2. Pedir permissão à Bandai antes de qualquer implementação.
3. Catálogo fornecido pelo dono do produto.
4. Adiar o Checkpoint 3 e seguir por outros checkpoints.

## Decisão

Opção 1, com o risco assumido explicitamente pelo dono do produto, a quem a
especificação reserva essa escolha.

As mitigações fazem parte da decisão e são obrigatórias na implementação:

- **Rate limiting respeitoso.** A importação serializa as requisições e mantém
  intervalo entre elas. Nunca dispara em paralelo contra a origem.
- **Somente dados factuais.** São armazenados código, nome, tipo, custo, poder,
  vida, counter, trigger, cores, traits, atributos, mecânicas, efeitos, raridade
  e a que sets pertence. Nada além do necessário para o produto funcionar.
- **Imagens referenciadas na origem.** `card_variants.image_url` guarda a URL da
  Bandai. As imagens não são copiadas, nem armazenadas, nem reservidas.
- **Atribuição visível.** A interface credita © Eiichiro Oda / Shueisha, Toei
  Animation e Bandai Namco Entertainment.
- **Sem reexposição.** O catálogo nunca é publicado como API pública. Ele serve
  apenas às telas autenticadas do produto e à página pública de Trade Binder,
  que mostra somente as cartas daquele binder.
- **Importação sob demanda.** Executada manualmente ou em agenda esparsa, nunca
  a cada requisição de usuário.

## Motivo

Escolhida pelo dono do produto depois de a limitação ter sido apresentada com
clareza. As mitigações reduzem a exposição sem fingir que a eliminam: os dados
factuais continuam sendo copiados.

Esta decisão pode ser revista se a Bandai se manifestar ou se surgir uma fonte
licenciada. A abstração `CatalogProvider` existe exatamente para que trocar a
origem não alcance o resto do sistema.

## Data

2026-09-06

---

# Decisão: 021 — Efeitos permanecem sem preenchimento

## Contexto

A especificação lista nove efeitos que o catálogo deve conhecer: `Draw Card`,
`Search`, `Reduce Cost`, `Increase Power`, `Reduce Power`, `KO`, `Rest`,
`Return to Hand` e `Trash`.

A implementação do Checkpoint 3 mostrou que nenhum deles aparece literalmente na
fonte. São categorias semânticas que só existiriam se fossem inferidas do texto
livre da carta. Mecânicas, ao contrário, aparecem entre colchetes e podem ser
lidas.

## Opções

1. Conjunto determinístico de regras de palavra-chave sobre o texto.
2. Manter a tabela vazia até existir dado confiável.
3. Armazenar o texto do efeito numa coluna e buscar dentro dele.

## Decisão

Opção 2. `effects` e `card_effects` permanecem vazias. O filtro por efeito
existe no código de busca e funciona; ele apenas não retorna nada enquanto não
houver dado.

## Motivo

Escolhida pelo dono do produto. A opção 1 é inferência, e a especificação proíbe
inventar classificações; erraria em cartas de texto complexo, que são
justamente as que o usuário mais quereria filtrar. A opção 3 alteraria o modelo
aprovado e contraria a instrução de não substituir a estrutura de efeitos por
texto bruto.

A estrutura fica pronta. Preenchê-la depende de uma fonte que classifique
efeitos, ou de uma decisão futura de aceitar inferência.

## Data

2026-09-06

---

# Decisão: 023 — Tipo de variante fica Normal e Parallel

## Contexto

A especificação cita Normal, Alternate Art e Manga como exemplos de variantes
distintas. A fonte não faz essa distinção: ela marca a arte base sem sufixo e
cada arte paralela com `_pN`, sem dizer se é manga art, alternate art ou
qualquer outra categoria da comunidade.

## Opções

1. Usar apenas `Normal` e `Parallel`, que é o que a fonte permite afirmar.
2. Derivar `Alternate Art` e `Manga` a partir de raridade e outros sinais.

## Decisão

Opção 1.

## Motivo

Escolhida pelo dono do produto. O sufixo `_p` é a própria notação da fonte para
arte paralela, então `Normal` e `Parallel` são leitura, não interpretação. A
opção 2 seria inferência: nada na fonte separa manga art de alternate art.

O custo é baixo porque `source_id` preserva o sufixo exato. Se uma taxonomia mais
rica for aprovada depois, ela pode ser derivada sem reimportar nada.

## Nota posterior: e o sufixo `_r`?

A fonte usa dois sufixos, não um: 1.647 variantes com `_p` e 412 com `_r`, que é
a notação de reimpressão. Chegou-se a considerar um terceiro valor `Reprint`.

Não é necessário, e seria pior. A informação de reimpressão já está no modelo,
no nível da **carta**: a Bandai cunha um id de arte novo a cada impressão, então
nenhuma variante isolada aparece em dois sets, mas a carta aparece.

Medido sobre o catálogo completo:

| | |
|---|---|
| Cartas associadas a mais de um set | 642 |
| Cartas com alguma variante `_r` | 377 |
| Dessas, quantas estão em mais de um set | 377 de 377 |
| Cartas em vários sets **sem** nenhum `_r` | 265 |

As 265 são o argumento decisivo: `OP01-016` está em 7 sets sem ter uma única
variante `_r`. Um `variant_type = Reprint` marcaria 377 cartas e deixaria essas
265 de fora, sendo menos informativo que a relação que já existe.

Regra derivada: uma carta foi reimpressa quando suas variantes somam mais de um
set distinto em `variant_printings`.

## Data

2026-09-06

---

# Decisão: 022 — Vocabulário de mecânicas

## Contexto

A especificação nomeia seis mecânicas. O texto das cartas usa colchetes para
muito mais que isso, e o Checkpoint 3 mostrou que aceitar todo colchete criaria
classificações inventadas.

O levantamento sobre o catálogo completo — 60 séries, 4.844 artes, 2.785 códigos
de carta — encontrou 217 termos distintos entre colchetes. Cruzando cada termo
contra os 1.170 nomes de carta do próprio catálogo:

| Grupo | Termos |
|---|---|
| Já aceitos pela especificação | 6 |
| Marcadores de custo (`DON!! xN`) | 3 |
| **Coincidem com nome de carta** | **195** |
| Candidatos a mecânica | 13 |

Os 195 são nomes de personagem e lugar: `[Sanji]`, `[Nami]`, `[Upper Yard]`.
Sem a allowlist, o catálogo teria 195 mecânicas inexistentes.

## Opções

Sobre os 13 candidatos, apresentados em quatro grupos: palavras-chave de
habilidade (`Double Attack`, `Banish`, `Unblockable`), gatilhos de efeito
(`On K.O.`, `On Block`, `On Your Opponent's Attack`, `End of Your Turn`),
condições de fase e turno (`Main`, `Counter`, `Your Turn`, `Opponent's Turn`) e
`Trigger`.

## Decisão

Entram apenas os **gatilhos de efeito**. O vocabulário fica com dez termos:

```
Rush   Blocker   On Play   When Attacking   Activate: Main   Once Per Turn
On K.O.   On Block   On Your Opponent's Attack   End of Your Turn
```

`Rush: Character` é normalizado para `Rush`, e não vira termo próprio.

Ficam de fora, por ora: as palavras-chave de habilidade, as condições de fase e
turno, e `Trigger`.

## Motivo

Escolhida pelo dono do produto. Os gatilhos são da mesma natureza de `On Play` e
`When Attacking`, que a especificação já aceita, então entram sem mudar o
critério.

As condições de fase são as mais frequentes e as menos discriminantes: filtrar
por `Main` devolveria cerca de 10% do catálogo. `Trigger` duplicaria
`cards.has_trigger`, que já existe no modelo.

`Rush: Character` é `Rush` com alvo restrito. Normalizar mantém as 11 cartas que
o concedem visíveis para quem filtra por `Rush`, que é a intenção de quem busca.

Ampliar o vocabulário de novo exige aprovação, porque define o que passa a ser
filtrável no catálogo.

## Data

2026-09-06

---

# Decisão: 024 — Set único para produtos promocionais

## Contexto

A fonte identifica 59 sets com código entre colchetes (`[OP-17]`, `[EB-03]`) e
cita outros **131 produtos sem código nenhum**: `Tournament Pack Vol.4`,
`Premium Card Collection -Best Selection Vol.4-`, `Pre-Release OP02`,
`Anime Expo 2023`, entre outros.

Como `sets.code` é obrigatório e único, esses produtos não podiam virar set, e
**538 variantes (11% do catálogo) ficavam sem set**, fora do progresso por set e
do filtro por produto.

A composição dessas 538 justifica tratá-las como um grupo: 173 são cartas promo
numeradas (`P-xxx`) e as outras 365 são artes distribuídas em eventos. Todas
chegaram ao jogador por distribuição promocional.

## Opções

1. Um set agregado para todas, como a LigaOnePiece faz com
   "One Piece Promotion Cards".
2. Um set por produto, com código derivado do nome.
3. Alargar `sets.code` e usar um slug do nome.
4. Deixar as 538 sem set.

## Decisão

Opção 1. Todo produto citado sem código entra no set
`PROMO` — `One Piece Promotion Cards`.

O nome original de cada produto **não é armazenado**: `variant_printings` é
apenas o par variante e set, e guardar de qual evento a carta veio exigiria uma
coluna nova. Os 131 nomes aparecem no relatório de importação, para que o que
foi colapsado fique registrado.

## Motivo

Escolhida pelo dono do produto, seguindo a classificação que a LigaOnePiece já
usa no mercado brasileiro. Resolve as 538 variantes de uma vez, sem inventar 131
identidades e sem alterar o modelo aprovado.

A opção 2 poluiria a lista de sets com 131 entradas de 1 a 13 cartas, quase todas
impossíveis de completar. A opção 4 deixaria 11% do catálogo permanentemente
fora do progresso por set.

Revisível: se a granularidade por evento passar a importar, basta uma coluna em
`variant_printings` e uma reimportação, sem perda, porque `source_id` preserva a
identidade de cada arte.

## Data

2026-09-06

---

# Decisão: 025 — Banco e autenticação hospedados no Supabase

## Contexto

Duas necessidades apareceram juntas: terceirizar a autenticação, para que a
responsabilidade por guardar e verificar senha não fique conosco, e hospedar o
banco, para o serviço não depender de um computador ligado.

A escolha da base de autenticação estava travada entre o Auth.js v5, que segue
em beta após anos e cuja sessão JWT não pode ser revogada, e o better-auth, que
é estável mas mantém a responsabilidade pela senha em casa e traz três tabelas.

## Opções

1. Supabase: banco PostgreSQL e autenticação no mesmo fornecedor.
2. Neon para o banco e Clerk para a autenticação.
3. Supabase apenas para o banco, autenticação em casa com better-auth.
4. Adiar a hospedagem para o Checkpoint 18.

## Decisão

Opção 1. Em produção, banco e autenticação no Supabase, região
**São Paulo (`sa-east-1`)**.

Desenvolvimento e CI continuam com **PostgreSQL local**, o que mantém os testes
rápidos, offline e independentes de rede. Isso não revoga as decisões 003 e 004:
o motor continua sendo PostgreSQL e o ambiente local continua nativo.

Consequência no modelo, aprovada junto: `users.password_hash` **sai**, porque a
senha passa a viver no provedor, e entra `users.auth_user_id` com índice único,
que amarra a conta do provedor à linha que `collections`, `storage_locations` e
`trade_participants` referenciam.

## Motivo

Escolhida pelo dono do produto. O critério decisivo não foi preço, e sim ser um
fornecedor só para as duas coisas terceirizadas: um contrato, uma fatura, uma
região, um lugar para investigar quando algo quebrar.

A região de São Paulo resolve latência para usuários brasileiros e mantém o dado
pessoal no país, o que simplifica a postura de LGPD.

Encaixe técnico verificado: é PostgreSQL de verdade, então as migrations, os três
triggers, os dez `CHECK` e a extensão `pg_trgm` funcionam sem alteração.

Dimensionamento medido, não estimado: o catálogo completo ocupa **17 MB** com
zero usuários. O que decide se o limite de 500 MB do plano gratuito é atingido é
a frequência de captura de preço — semanal custa cerca de 25 MB por ano, diária
cerca de 177 MB. Quando o limite for atingido, o plano seguinte custa US$ 25 por
mês, valor irrelevante para um produto com base de usuários que justifique isso.

## Riscos aceitos

- Indisponibilidade do provedor impede autenticação e acesso ao banco.
- Nome e e-mail dos usuários passam a ser tratados por um terceiro, o que exige
  política de privacidade explícita.
- No plano gratuito o projeto pausa após uma semana sem acesso.

## Data

2026-09-06

---

# Decisão: 026 — Imagem de carta sem o otimizador do `next/image`

## Contexto

A decisão 020 assumiu o risco de usar o site oficial da Bandai como fonte do
catálogo, com mitigações **obrigatórias**. Uma delas é que as imagens são
*referenciadas na origem*, nunca copiadas nem rearmazenadas.

`architecture.md` seção 4.2 pedia `next/image` com tamanhos responsivos e
carregamento tardio. Ao construir a grade de cartas, ficou claro que as duas
coisas se contradizem: o otimizador do `next/image` **baixa** o arquivo remoto,
converte, guarda em cache no nosso disco e serve de `/_next/image`. Isso é
rehospedar a imagem da Bandai a partir do nosso domínio.

A mitigação é jurídica, não de performance.

## Opções

1. `next/image` com `remotePatterns` para o host da fonte, com otimização.
2. `next/image` com `unoptimized`, que na prática vira um `<img>` com mais
   configuração e uma dependência a mais.
3. `<img>` com `loading="lazy"` e `decoding="async"`, e a proporção reservada
   por CSS.

## Decisão

Opção 3. As imagens de carta usam `<img>` nativo. O espaço é reservado por
`aspect-[5/7]`, a proporção da carta física, e o carregamento é tardio por
atributo.

A regra do ESLint `@next/next/no-img-element` é desativada linha a linha, com o
motivo escrito ao lado, nos dois lugares que exibem carta: `CardTile` e
`TradeItem`.

`architecture.md` seção 4.2 foi corrigida.

## Motivo

A opção 1 viola uma mitigação obrigatória da decisão 020. A opção 2 tem o mesmo
resultado visual da 3 com mais configuração — `remotePatterns` continua sendo
necessário — e sem ganho nenhum.

O que se perdeu com a opção 3 é a conversão para WebP e o redimensionamento no
servidor. O que motivava usar `next/image` além disso era evitar salto de
layout, e isso a proporção fixa resolve sozinha.

Consequência: se um dia o catálogo passar a ter imagens próprias, ou uma fonte
que autorize rehospedagem, esta decisão precisa ser revisitada — e aí
`next/image` volta a ser a escolha certa.

## Data

2026-09-07

---

# Decisão: 027 — Tokens semânticos com `light-dark()`, sem variante `dark:`

## Contexto

A paleta oficial tem seis cores: fundo, roxo de ênfase e texto, em tema claro e
escuro. O roxo **muda** entre os temas — `#38287B` e `#504797` — e não é o mesmo
tom clareado por filtro.

Era preciso decidir como isso chega ao CSS sem que cada componente novo precise
lembrar da regra.

## Opções

1. Cada componente escreve `bg-accent dark:bg-accent-dark`, com a variante
   `dark:` do Tailwind.
2. Tokens semânticos redefinidos em `@media (prefers-color-scheme: dark)` e de
   novo em `[data-theme="dark"]`.
3. Tokens semânticos declarados uma vez com `light-dark()`, com `color-scheme`
   decidindo qual valor vale.

## Decisão

Opção 3. Os tokens são semânticos — `--colexa-accent`, `--colexa-surface` — e
cada um é declarado uma vez, com os dois valores lado a lado. Um componente
escreve `bg-accent` e está certo nos dois temas.

Escolher tema é escrever `color-scheme`, o que acontece por `data-theme` no
`<html>`. Três estados: ausente segue o sistema, `light` e `dark` são escolha
explícita.

## Motivo

A opção 1 transforma "o roxo muda entre os temas" numa regra que depende de
disciplina em cada arquivo novo, e o primeiro componente que esquecer fica
errado num tema só — o tema que quem escreveu provavelmente não estava usando.

A opção 2 exige três cópias da mesma lista de tokens, e nada impede que uma mude
sem as outras. É o tipo de divergência que ninguém nota até a tela ficar errada.

A opção 3 torna a divergência impossível: os dois valores estão na mesma linha.
Custo: `light-dark()` exige navegador de 2024 em diante, o que é compatível com
o alvo do projeto. `light-dark()` resolve cor e não a sombra inteira, então as
sombras compõem a partir de uma variável de cor.

Decisão técnica, sem impacto de produto: a paleta exibida é exatamente a
aprovada, e isso é verificado por teste.

## Data

2026-09-07

---

# Decisão: 028 — Preferência de tema por dispositivo, e não por conta

## Contexto

A tela 36 prevê Preferências com tema. Não existe coluna de preferência em
`users`, e criar uma seria alteração do modelo de dados aprovado.

## Opções

1. Guardar no `localStorage` do navegador.
2. Criar `users.theme_preference` e guardar no banco.

## Decisão

Opção 1. A escolha vive no `localStorage`, sob a chave `colexa:theme`.

## Motivo

Tema é preferência **de dispositivo**, não de conta: a mesma pessoa pode querer
escuro no celular, à noite, e claro no desktop, de dia. Sincronizar pela conta
daria a resposta errada nesse caso, que é o caso comum de um app mobile-first
que também abre no navegador.

Some-se a isso que a alternativa exige alteração do modelo de dados, que precisa
de aprovação, para resolver um problema que ninguém tem.

Consequência: a escolha não acompanha a pessoa entre aparelhos, e é perdida ao
limpar os dados do site. As duas coisas são aceitáveis para uma preferência
visual, e nenhuma delas perde dado de coleção.

## Data

2026-09-07

---

# Decisão: 029 — As telas de entrada ficam em um checkpoint próprio

## Contexto

O Checkpoint 6 é "frontend base: layout, navegação, responsividade, componentes
e design system". O documento oficial de marca inventaria 36 telas, das quais o
Grupo 1 — splash, landing, criar conta e entrar — é a porta de entrada do
produto.

Era preciso decidir se essas quatro telas entram no Checkpoint 6.

## Opções

1. Só a base; o Grupo 1 em um checkpoint de autenticação na interface.
2. Base mais splash e landing, que são apresentacionais.
3. Base mais o Grupo 1 inteiro, com os formulários ligados ao Supabase.

## Decisão

Opção 1, escolhida pelo assistente a pedido do dono do produto.

O Checkpoint 6 entrega o sistema: tokens, marca, shell, navegação, biblioteca de
componentes e os cinco destinos navegáveis. As telas 01 a 04 vão para um
checkpoint próprio de autenticação na interface.

## Motivo

É a divisão normal: o checkpoint base entrega o sistema com que as telas são
construídas, e cada tela entrega na sua área. Misturar os dois faz o checkpoint
base carregar a primeira tela de produto e ficar sem critério de pronto claro.

Além disso, o Grupo 1 tem dois bloqueios que não são de código e que parariam o
checkpoint no meio:

- **Google e Apple como provedores** precisam ser configurados no painel do
  Supabase, o que o assistente não faz.
- **Termos de Uso e Política de Privacidade** são texto do dono do produto, e a
  tela 03 exige o aceite dos dois.

A opção 2 evitaria os bloqueios, mas entregaria uma landing cujos dois botões
apontam para rotas que ainda não existem.

## Data

2026-09-07

---

# Decisão: 030 — Termos de Uso e Política de Privacidade são bloqueio de lançamento

## Contexto

A tela 03 exige aceitar os Termos de Uso e a Política de Privacidade para criar
conta, com link para os dois documentos. Os textos não existem.

Escrever cláusula que diz o que o produto pode fazer com o dado de outra pessoa
não é decisão de desenvolvimento — é decisão do dono do produto, e no Brasil tem
consequência sob a LGPD.

## Opções

1. Parar o checkpoint até os textos existirem.
2. Gerar um texto genérico e marcar como provisório.
3. Publicar as duas rotas com uma página honesta de "em preparação", registrar
   como bloqueio de lançamento e seguir.

## Decisão

Opção 3. `/termos` e `/privacidade` existem e dizem que o texto está em
preparação. O aceite continua obrigatório no cadastro, validado no servidor.

**Isto é bloqueio de lançamento.** O produto não pode receber cadastro de
pessoa real enquanto essas páginas estiverem assim.

## Motivo

A opção 1 pararia o checkpoint inteiro por um texto que não é código e que pode
chegar a qualquer momento. A opção 2 é a pior das três: um texto jurídico
plausível é indistinguível de um real para quem aceita, e o produto passaria a
afirmar coisas sobre tratamento de dado pessoal que ninguém decidiu.

A opção 3 mantém o fluxo completo e testável, e deixa a falta visível para
quem abrir a página em vez de escondida num item de lista de pendências.

## Data

2026-09-07

---

# Decisão: 031 — Autenticação por Server Action, sem SDK no navegador

## Contexto

Entrar e cadastrar precisavam de um caminho. O Supabase oferece um cliente de
navegador que faz login direto do JavaScript da página e escreve o cookie de
sessão do lado do cliente.

## Opções

1. Cliente Supabase no navegador, chamando `signInWithPassword` do componente.
2. Server Actions chamando o provedor no servidor.
3. Route handlers próprios, com o formulário enviando por `fetch`.

## Decisão

Opção 2. Os formulários usam `<form action={serverAction}>`. Não existe cliente
Supabase no pacote enviado ao navegador.

## Motivo

Toda regra deste projeto vive no servidor, e autenticação não deveria ser a
exceção. Com a opção 1, a validação de entrada, o limite de tentativas e o
mapeamento de erro precisariam existir de novo no cliente — ou não existiriam.

Consequências concretas da escolha:

- O limite de tentativas por endereço é aplicado antes de a senha chegar ao
  provedor, e não pode ser contornado pulando a interface.
- A checagem do `next` contra redirecionamento aberto acontece no caso de uso.
- O formulário funciona sem JavaScript, porque é um `<form>` de verdade.

Custo: o cookie de sessão passa a ser escrito em dois lugares — no middleware,
que renova, e na ação, que cria e destrói. Não é a duplicidade que a decisão
025 evita: renovar concorre consigo mesmo, criar e destruir não.

## Nota

`architecture.md` 3.4 dizia que o provedor "só lê cookie". Continua valendo para
o provedor de **sessão**; o de **credencial** escreve, e a distinção está
documentada em `src/server/http/auth-provider.ts`.

## Data

2026-09-07

---

# Decisão: 032 — Provedores sociais vêm do provedor, não de configuração nossa

## Contexto

As telas 03 e 04 mostram "Continuar com o Google" e "Continuar com a Apple".
Nenhum dos dois está habilitado no projeto do Supabase, e habilitá-los é trabalho
de painel, não de código.

## Opções

1. Botões sempre visíveis; quem clicar recebe o erro do Supabase.
2. Botões atrás de uma variável de ambiente.
3. Perguntar ao Supabase quais provedores estão habilitados e desenhar só esses.

## Decisão

Opção 3. `GET /auth/v1/settings` do próprio projeto diz quais provedores estão
ligados. A resposta fica em cache por cinco minutos, e uma falha de rede resulta
em nenhum botão social — nunca num botão quebrado.

## Motivo

A opção 1 oferece um caminho que termina em erro. A opção 2 cria uma segunda
fonte de verdade que passa a divergir do painel na primeira vez que alguém mudar
um sem mudar o outro.

Com a opção 3 os botões aparecem sozinhos quando o dono do produto habilitar
Google ou Apple no painel, sem mudança de código nem novo deploy.

Antes de habilitar a Apple, vale conferir as exigências de marca e de fluxo do
"Sign in with Apple", que são mais estritas que as do Google.

## Data

2026-09-07

---

# Decisão: 033 — Filtro e paginação do catálogo vivem na URL

## Contexto

O catálogo tem 4.843 variantes e onze filtros combináveis. Era preciso decidir
onde esse estado mora: em estado de componente, com rolagem infinita, ou na
query string, com páginas.

As telas de referência mostram uma grade que rola. A instrução do dono do
produto é usá-las como referência de estética e layout, não de função.

## Opções

1. Estado no cliente, rolagem infinita com TanStack Query.
2. Filtros e página na URL, renderizados no servidor.

## Decisão

Opção 2. Busca, filtros e página são parâmetros da URL, em português, e a
página é um React Server Component já filtrado. A tradução entre a query string
e o caso de uso acontece em `src/lib/catalog-params.ts`.

Mexer em qualquer filtro volta para a página 1.

## Motivo

Três coisas decorrem de o estado estar no endereço, e nenhuma se recupera
depois:

- a busca filtrada é compartilhável e volta igual pelo histórico;
- voltar do detalhe de uma carta devolve a lista onde ela estava;
- a página chega renderizada, sem um segundo passo no cliente.

Numa ferramenta de coleção, "a página 7 de OP01" é um lugar ao qual se volta.
Rolagem infinita não tem endereço.

O custo é a ausência de rolagem contínua. Se ela se mostrar necessária, entra
por cima disto sem desfazer nada: os parâmetros continuam na URL.

Voltar à primeira página ao mudar filtro parece detalhe e não é: refinar a busca
na página 7 levaria a uma página 7 que pode não existir mais, e a tela ficaria
vazia sem explicação.

## Data

2026-09-07

---

# Decisão: 034 — Sem "sets mais recentes", porque não sabemos quais são

## Contexto

A tela 09 mostra uma seção "Sets mais recentes". O modelo de dados aprovado não
guarda data de lançamento de set: `sets` tem `code` e `name`, e nada mais.

Ordenar códigos não é ordenar por data. `OP-17` vem depois de `OP13` no
alfabeto, mas os prefixos convivem — `EB`, `GC`, `OP`, `PRB`, `PROMO`, `ST` — e
nada no dado diz qual coletânea saiu antes.

## Opções

1. Chamar de "mais recentes" a ordem decrescente de código.
2. Acrescentar `released_at` a `sets` e preencher na importação.
3. Não oferecer a seção; ordenar por código, dizendo que é por código.

## Decisão

Opção 3. A lista de sets é ordenada pela sequência natural do código, e a tela
não afirma recência em lugar nenhum.

A ordenação natural existe porque a fonte não é uniforme: `OP01` e `OP-07`
convivem, e ordenar por texto puro colocaria `OP-07` antes de `OP01`. A regra
está em `src/server/domain/catalog/sets.ts`, com teste.

## Motivo

A opção 1 é afirmar o que não sabemos, com uma cara de certeza — o mesmo erro
que a decisão 022 evitou ao recusar inferir mecânicas de padrões.

A opção 2 é possível e talvez desejável, mas é alteração do modelo de dados
aprovado, precisa de aprovação, e depende de a fonte publicar a data de forma
confiável, o que não foi verificado. Fica registrada como pergunta em aberto no
handoff.

## Data

2026-09-07

---

# Decisão: 035 — Parâmetro desconhecido na API de catálogo é erro

## Contexto

O schema de query do catálogo aceitava chaves desconhecidas e as descartava, que
é o comportamento padrão do Zod. Ao renomear `cost` para `costMin`/`costMax`,
um teste passou a receber 200 onde esperava 400 — e foi assim que isso apareceu.

## Decisão

O schema passa a ser `strict()`. Parâmetro que não existe devolve 400.

## Motivo

É o mesmo modo de falha que já custou caro neste projeto. A armadilha 5 do
handoff registra 538 variantes perdidas porque o parser ignorava em silêncio o
que não reconhecia.

Aqui a forma seria mais discreta e não menos ruim: `?custo=3`, em português ou
com um typo, devolveria o catálogo inteiro, e quem chamou acharia que filtrou.
Rejeitar avisa; descartar, não.

Decisão técnica, sem impacto de produto: a interface não chama esta rota — as
páginas falam com o caso de uso diretamente.

## Data

2026-09-07

---

# Decisão: 036 — Ordem de lançamento informada, e sets separados de decks

**Substitui a decisão 034**, que registrava a ausência de ordem de lançamento
como limitação. A ordem passou a existir porque o dono do produto a informou.

## Contexto

A decisão 034 recusou oferecer "sets mais recentes" porque o modelo não guarda
data de lançamento e ordenar códigos não é ordenar por data. Isso continua
verdade sobre o **dado**; o que mudou é que o dono do produto forneceu a ordem
diretamente, e pediu duas coisas mais: separar coleções de decks, e exibir a
contagem como "cartas" em vez de "variantes".

## Decisão

**Ordem.** As coleções aparecem na ordem informada, que intercala os extra
boosters entre os boosters — `OP-06`, `EB-01`, `OP-07` — e que nenhuma
ordenação de código produz. A lista vive em `src/server/domain/catalog/sets.ts`.

Ela é escrita com os códigos do **catálogo importado**, não os da lista
original: o que lá é `OP-14` chegou como `OP14-EB04`, porque o lançamento
internacional juntou o EB-04 aos boosters 14 e 15. Por isso `EB-04` não aparece
— não existe como set separado no nosso catálogo.

Set fora da lista cai na ordenação natural do código, depois dos conhecidos.
Uma coletânea nova aparece no dia em que for importada, em vez de sumir por não
ter sido prevista.

**Separação.** Sets são classificados em coleção, deck e promocional pelo
prefixo do código. Isto **não** é inferência de padrão no estilo que a decisão
022 recusou: a fonte rotula cada série no seletor da página de listagem, e a
correspondência foi conferida uma a uma no snapshot — todo `ST` é
`STARTER DECK`, `STARTER DECK EX` ou `ULTRA DECK`, e nenhum booster é `ST`.

**Palavra na tela.** A contagem de um set é exibida como "154 cartas" e não
"154 variantes". É mudança de texto: a distinção entre carta e variante continua
valendo em contagem, playset e progresso (`business-rules.md` 2).

## Motivo

A ordem de lançamento é a ordem em que as pessoas viveram o jogo, e a única em
que os extra boosters caem no lugar certo. Ela não podia ser derivada; podia ser
informada, e foi.

A separação existe porque coleção e deck são coisas diferentes de procurar: 36
decks iniciantes no meio das coletâneas atrapalham quem quer saber o que falta
de um booster.

## O que fica em aberto

Guardar o rótulo da série em `sets` removeria a suposição do prefixo e corrigiria
de quebra os nomes inconsistentes — `OP-17` foi importado como
`BOOSTER PACK -...-` e `OP-01` como `-...-`, embora ambos sejam booster pack.
Hoje isso é resolvido na exibição. Seria alteração do modelo e reimportação, e
está registrado como pendência.

## Data

2026-09-07

---

# Decisão: 037 — Imagem de carta é exibida; o banco guarda só a URL

## Contexto

A decisão 020 lista, entre as mitigações obrigatórias, que as imagens sejam
referenciadas na origem e nunca copiadas. Restava a dúvida sobre **exibi-las**.

O dono do produto confirmou que verificou as questões legais e que as imagens do
catálogo — as que trazem a marca d'água `SAMPLE` — podem ser exibidas, desde que
o banco guarde apenas a URL.

## Decisão

As imagens aparecem na grade, no detalhe da carta, na lista de sets e como
ambientação do cabeçalho do set. `card_variants.image_url` continua guardando a
URL canônica da fonte e nada mais.

Nada muda no que já estava construído: a decisão 026 já impedia o otimizador do
`next/image`, justamente porque ele baixaria o arquivo e o serviria do nosso
domínio. Esta decisão registra a confirmação e estende o uso ao cabeçalho do set.

## Motivo

Registrado porque a autorização é do dono do produto e a restrição é jurídica,
não técnica: quem vier depois precisa saber que exibir é permitido e
rearmazenar não, e que as duas coisas são diferentes.

## Data

2026-09-07

---

# Decisão: 038 — A imagem de carta é servida pelo nosso domínio

**Revoga a decisão 026** e altera uma das mitigações da decisão 020.

## Contexto

O dono do produto relatou que as imagens não apareciam. O diagnóstico:

```
$ curl -I https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png
cross-origin-resource-policy: same-site
```

Esse cabeçalho é uma instrução ao **navegador**: recuse desenhar este recurso em
qualquer origem que não seja mesmo-site. Não há cabeçalho nosso que contorne, e
vale igual para `localhost` e para `colexa.com.br`. O console mostrava
`net::ERR_BLOCKED_BY_RESPONSE.NotSameSite`.

As quatro origens da Bandai foram testadas — `en.`, `asia-en.`, `www.` e o
domínio nu — todas com o mesmo cabeçalho.

Ou seja: a decisão 026 mandava fazer a única coisa que **não funciona**. Ela foi
tomada de boa-fé, protegendo a mitigação da decisão 020, mas sob a premissa
falsa de que referenciar a origem exibiria a imagem.

## Como outros resolvem

A pedido do dono do produto, foi verificado como a LigaOnePiece exibe cartas:
as imagens vêm de `repositorio.sbrauble.com/arquivos/up/...`, repositório
próprio, atrás de Cloudflare, com `cache-control: max-age=31536000` e **sem**
`cross-origin-resource-policy`. Eles hospedam; não referenciam a Bandai. Não
teriam como, pelo mesmo motivo.

## Opções

1. Não exibir imagem.
2. Repassar sem guardar: nosso servidor busca e devolve a cada requisição.
3. Servir pelo nosso domínio com cache, via otimizador do `next/image`.

## Decisão

Opção 3. `next.config.ts` autoriza `en.onepiece-cardgame.com/images/cardlist/**`
como origem remota, com cache mínimo de 30 dias. `card_variants.image_url`
continua guardando apenas a URL canônica da fonte — nenhuma imagem entra no
banco, como o dono do produto pediu.

## Motivo

A opção 1 tira a arte de uma ferramenta de coleção visual.

A opção 2 cumpriria a letra de "nunca rearmazenar" e seria **pior para a
fonte**: sem cache, cada visitante geraria uma requisição à Bandai por carta
vista. A mitigação da decisão 020 existe para ser leve com a origem, e nesse
ponto ela se voltaria contra o próprio objetivo.

A opção 3 é a mais leve das três para a Bandai — uma requisição por imagem, no
total — e a mais leve para quem usa: o otimizador entrega WebP no tamanho da
tela, cerca de 20 KB por carta contra os 150 KB do PNG original. Numa grade de
24 cartas no celular, 0,5 MB em vez de 3,6 MB.

O que permanece da decisão 020: o catálogo nunca é reexposto como API pública, a
cota por usuário continua valendo, a atribuição continua visível, e o banco não
guarda imagem. O que muda é só o caminho pelo qual o byte chega ao navegador —
porque não existe outro.

A autorização legal para exibir é do dono do produto, registrada em 07/09/2026.

## Data

2026-09-07

---

# Decisão: 039 — Rolagem infinita no catálogo, pela API

**Revoga a decisão 033** na parte da paginação. O restante dela continua
valendo: busca e filtros seguem na URL.

## Contexto

A decisão 033 escolheu paginação por link, argumentando que "a página 7 de OP01"
é um lugar ao qual se volta. O dono do produto pediu rolagem infinita.

## Decisão

A primeira leva é renderizada no servidor; as seguintes chegam por rolagem,
pedidas a `/api/catalog`. O indicador "mostrando 1–24" saiu junto com as
páginas; o total continua.

O sentinela **é um botão** de "Carregar mais": o observador de intersecção
dispara a mesma carga que o clique.

## Motivo

O botão-sentinela resolve de uma vez os três casos em que rolagem infinita pura
deixa a pessoa presa: quem navega por teclado e nunca "rola até o fim", quem usa
leitor de tela, e o momento em que uma carga falha e é preciso repetir. Também
torna o comportamento testável sem simular rolagem.

As páginas seguintes passam pela **API**, e não por uma Server Action, porque é
a API que cobra a cota de leitura do catálogo. Essa cota é o que sustenta na
prática o compromisso da decisão 020 de nunca reexpor o catálogo; uma Server
Action escaparia dela, e a rolagem infinita viraria a forma mais cômoda de
extrair o catálogo inteiro.

O que se perde é o endereço da página — que era o argumento da decisão 033. Busca
e filtros continuam na URL, então a lista filtrada segue compartilhável; o que
não volta é a posição exata na rolagem.

## Data

2026-09-07

---

# Decisão: 040 — Ordem padrão da listagem de cartas

## Contexto

Sem filtro, a listagem vinha por código de carta em ordem alfabética: `EB01-…`
antes de `OP01-…`, e as promos espalhadas no meio, porque uma promo mantém o
código da carta original.

O dono do produto pediu a ordem de lançamento das coleções e dos starter decks,
com promocionais no fim.

## O que o dado permite

Cada variante do catálogo pertence a **exatamente um** set — conferido: 4.842 de
4.843 têm uma impressão, nenhuma tem duas, e nenhuma está no `PROMO` e em outro
set ao mesmo tempo. Isso torna a ordenação por set bem definida, embora o modelo
permita mais de um (decisão 006) e o código trate esse caso.

## Decisão

Três grupos, nesta ordem: coleções na ordem de lançamento informada (decisão
036), starter decks por número, promocionais. Depois, código da carta e id.

O desempate por id não é zelo: sem ele, duas artes da mesma carta poderiam
trocar de lugar entre uma leva e a seguinte da rolagem infinita, e a mesma carta
apareceria duas vezes ou nenhuma.

## Onde a ordenação acontece, e por quê

Em memória, na camada de aplicação, e não no banco.

A ordem de lançamento não se deriva de nenhuma coluna — ela intercala extra
boosters entre boosters e vive numa lista no domínio. O Prisma também não
ordena por campo de relação muitos-para-muitos, e `variant_printings` é uma.

As alternativas eram reescrever a busca inteira em SQL bruto, com dezessete
filtros e cinco tabelas de junção, ou materializar a posição numa coluna, que
passaria a envelhecer no dia em que a ordem mudasse.

A primeira consulta traz `id` e set de **todos** os resultados do filtro, ordena
e recorta a página; a segunda hidrata só essa página. **Não é uma consulta a
mais**: o `count` que existia antes desapareceu, porque o total virou o tamanho
da lista.

Medido no catálogo completo: 46–69 ms sem filtro, 12 ms com filtro.

**O limite disto está escrito**: se o catálogo crescer uma ordem de grandeza, o
pior caso passa a trazer dezenas de milhares de pares por requisição, e a
ordenação precisa migrar para o banco — provavelmente com a posição
materializada em `sets`.

## O que esta ordem não faz

Não intercala starter decks com coleções por data. Saber que o ST-05 saiu entre
o OP-02 e o OP-03 exigiria a data de cada um, que o modelo não guarda e que não
foi informada.

Não distingue "versão de campeonato" de outras promocionais: o catálogo importado
não tem esse dado. Na prática o pedido é atendido, porque a fonte cataloga todas
essas versões como *Promotion card*, e é o conjunto inteiro que vai para o fim.

## Data

2026-09-07

---

# Decisão: 041 — A coleção: onde a contagem mora e como a escrita se protege

## Contexto

Checkpoint 9, telas 17 a 20. É a primeira vez que o produto grava algo de quem
usa: até aqui tudo era leitura de um catálogo importado.

Três coisas precisavam de posição definida: onde a aritmética da coleção é
calculada, como duas edições simultâneas da mesma carta se comportam, e o que a
tela faz com o conflito da decisão 007 enquanto o armazenamento não existe.

## Decisão 1 — A contagem é do domínio, em memória

`countCollection` recebe a lista de variantes possuídas e devolve os três
números (`src/server/domain/collection/counting.ts`). Nada de SQL agregado.

O motivo é a regra do playset: ela é **binária por carta** e exclui `Leader`
(`business-rules.md` 2.1). Oito cópias continuam sendo um playset, e
`floor(soma / 4)` — o erro óbvio — daria dois. Escrever isso em SQL é possível;
escrever certo, e manter certo enquanto a lista de tipos sem playset cresce, é
outra coisa. Em TypeScript puro os dez cenários obrigatórios da seção 7 rodam
sem banco, em milissegundos.

O custo é carregar as linhas: uma coleção grande são alguns milhares de linhas
de três campos. **O limite fica escrito**: se um usuário passar da casa das
dezenas de milhares de itens, a soma por carta precisa virar agregação no banco,
e aí a regra do playset vai junto — provavelmente como coluna materializada, e
não como expressão repetida em cada consulta.

## Decisão 2 — Escrita serializada por lock de linha

`setCollectionQuantity` roda inteira dentro de `prisma.$transaction`, e a linha
de `collection_items` é travada com `SELECT ... FOR UPDATE` antes de qualquer
decisão sobre ela.

Sem isso, duas edições simultâneas leem o mesmo estado e a segunda escreve por
cima da primeira. Pior: a validação contra o alocado leria um total obsoleto, e
a soma das alocações poderia passar da quantidade possuída sem que nenhuma das
duas escritas estivesse errada isoladamente.

Não há linha para travar quando ela ainda não existe, então a inserção vem
antes, como `INSERT ... ON CONFLICT DO NOTHING`. Quem ganha a corrida termina
ali; quem perde encontra a linha do outro e espera pelo lock dela. Dois testes
de concorrência em `tests/integration/collection.test.ts` disparam as duas
escritas juntas e conferem o resultado.

A coleção é buscada **pelo dono** (`where: { userId }`), e não pelo id que veio
de fora — é o escopo da consulta que impede escrever na coleção alheia, não uma
verificação posterior (`architecture.md` 3.5).

## Decisão 3 — O conflito da 007 é mostrado, não resolvido

Reduzir abaixo do que está guardado em armazenamento não desaloca sozinho e não
devolve erro seco: a escrita é recusada inteira e o conflito volta carregando as
alocações atuais.

A tela onde a pessoa escolhe de qual local as cópias saem depende das telas de
armazenamento, que são o Checkpoint 10. **Adiar a tela não é adiar a regra**: o
servidor já recusa, e o painel de quantidade lista os locais e as somas, que é o
suficiente para a pessoa saber o que fazer. O que não existe é o atalho para
fazer dali.

## Decisão 4 — Tocar numa carta da coleção edita, em vez de navegar

Na grade da coleção o toque abre o painel de quantidade; no catálogo, leva ao
detalhe. São perguntas diferentes: numa lista do que se tem, a seguinte é quase
sempre "quantas". Passar pelo detalhe transformaria um ajuste de um toque em
três.

O mesmo painel serve para acrescentar e para corrigir — é a mesma escrita, e
duas telas fariam a segunda parecer outra coisa. "Remover da coleção" é definir
para zero, e não uma segunda ação capaz de divergir da primeira: o banco exige
`quantity > 0`, então possuir zero é não ter a linha.

A quantidade viaja no `name`/`value` do **botão que submete**, e não num campo
escondido sincronizado por estado. Zerar no `onClick` e submeter em seguida é
uma corrida: `setState` é assíncrono, e o formulário sairia com o valor anterior.

## O que não foi coberto por teste ponta a ponta

Nada da coleção, porque tudo nela exige sessão, e autenticar de verdade pediria
uma conta real no Supabase com credenciais na CI — a mesma razão já registrada
para a autenticação. O que o ponta a ponta cobre é que `/colecao` e
`/colecao/playsets` pedem sessão. O comportamento está em teste de integração
com banco e em teste de componente.

## Data

2026-09-07

---

# Decisão: 042 — Imagens enviadas pelo usuário no Supabase Storage

## Contexto

As telas 21, 22 e 24 mostram uma foto por local de armazenamento, com o campo
"Adicionar foto — PNG, JPG até 5MB". A coluna `storage_locations.image` existe
desde o Checkpoint 2 e guarda URL; o projeto não tinha nenhuma infraestrutura de
upload, e a foto de perfil estava parada pelo mesmo motivo.

O dono do produto escolheu, entre não ter foto, aceitar uma URL colada e
construir o envio de verdade, a terceira.

## Decisão

Supabase Storage, num bucket público para leitura, com o arquivo endereçado por
`<id do usuário>/<uuid>.<ext>`.

O bucket é criado por `npm run supabase storage`, e não pelo painel: os limites
— 5 MB, PNG e JPEG — saem da **mesma constante do domínio** que o servidor usa
para recusar, então não há como divergirem. Repetir a regra do lado do Supabase
é a segunda tranca, para o caso de alguém escrever por outro caminho.

## Por que `fetch`, e não o `@supabase/supabase-js`

Descoberto ao rodar o comando pela primeira vez, contra o projeto real:
`createClient` monta um cliente de Realtime junto, e o Realtime exige um
`WebSocket` global — que o Node 20 não tem. O construtor lança
`"Node.js detected but native WebSocket not found"` **antes** de qualquer chamada
de storage. O mesmo erro derrubaria o upload dentro da aplicação, não só o
script.

Dava para injetar uma implementação de WebSocket só para calar o construtor.
Seria carregar uma dependência de tempo real para gravar um arquivo. A API de
Storage é REST comum — três endpoints e dois cabeçalhos —, então é isso que o
provedor usa.

Nada disso apareceu em teste porque não havia teste que **instanciasse** o
provedor: os testes de caso de uso usavam um dublê. Agora existe
`tests/integration/supabase-image-storage.test.ts`, com `fetch` de mentira, que
falha se o provedor voltar a precisar de rede ou de plataforma para nascer.

## Por que a chave secreta, e não a sessão da pessoa

O upload acontece numa Server Action, depois de a fronteira de sessão já ter
dito quem é. Usar a sessão dela no Storage significaria repetir a autorização em
políticas de RLS escritas em SQL — um segundo lugar capaz de divergir do
primeiro.

O caminho do arquivo é montado no servidor a partir do id da sessão, nunca de
nada que a tela mande, e o escopo é filtrado para dígitos. É isso que impede
gravar na pasta de outra pessoa, e não uma política.

## Por que público para leitura

A foto vai num `<img>`. URL assinada expiraria no meio de uma página aberta, e
renová-la a cada render trocaria uma foto de binder por um problema de cache.

O que fica público é uma foto de binder sob um nome sorteado, não um documento:
não há listagem, e a URL não se adivinha a partir do id do usuário.

## O que é conferido antes de subir um byte

Os **bytes**, e não o `Content-Type`. O tipo declarado num upload é escolhido por
quem envia, e a imagem volta servida para outros navegadores: aceitar a palavra
do cliente é aceitar servir qualquer coisa com rótulo de imagem. PNG e JPEG têm
assinatura fixa nos primeiros bytes, e é ela que decide.

SVG fica de fora **de propósito**: é XML, pode carregar script, e não tem
assinatura que o distinga de um XML qualquer.

## A ordem entre o arquivo e a linha

A imagem sobe antes da escrita no banco e é apagada se a escrita falhar. O
contrário — gravar e depois subir — deixaria um local sem a foto que a pessoa
acabou de escolher, e sem nada que diga isso a ela.

Apagar a foto antiga acontece depois de a linha já apontar para a nova, e o erro
ali é engolido: um arquivo órfão custa kilobytes, derrubar uma edição
bem-sucedida custa o trabalho de quem a fez.

## Ausente é diferente de quebrado

Sem `SUPABASE_SECRET_KEY`, o provedor se declara indisponível e o campo de foto
some da tela — o mesmo arranjo dos provedores sociais (decisão 032), pelo mesmo
motivo: desenvolvimento local não precisa de bucket para o resto funcionar.

## O que isto destrava

A foto de perfil, hoje pendente por não haver upload nem coluna. A coluna
continua faltando; o upload, não.

## Data

2026-09-07

---

# Decisão: 043 — As telas de armazenamento

## Contexto

Checkpoint 10, telas 21 a 24. Duas coisas nas telas de referência não existiam
no modelo e uma terceira não existe no dado.

## Decisão 1 — `storage_locations.description` foi acrescentada

Aprovada pelo dono do produto. Coluna anulável, `VARCHAR(500)`, o mesmo teto de
`image`. Ver `database.md` 2.4.

## Decisão 2 — "12 playsets" no detalhe do local é playset **daquele local**

A tela 22 mostra uma contagem de playsets dentro de um binder. Playset, na
`business-rules.md` 2.1, é por carta e sobre **toda** a coleção — a definição da
seção 2 não responde à pergunta que a tela faz.

A leitura adotada é a física: quantas cartas estão inteiras neste local. Três
cópias no binder e uma na caixa fecham playset na coleção e **não** fecham no
binder. `Leader` continua fora, como em toda parte.

Isto não altera a contagem da seção 2, que segue valendo na coleção e na Home. É
uma métrica de exibição, com rótulo próprio na tela — "playsets aqui" — para as
duas não se confundirem. Fica registrada como leitura, e não como regra nova:
o dono do produto pode trocá-la sem que nada mais mude.

## Decisão 3 — O valor estimado não entra

A tela 22 mostra "R$ 3.420 valor estimado". `card_prices` existe desde o
Checkpoint 2 e está **vazia**: não há fonte de preço definida nem importação
escrita.

Um número inventado num campo de dinheiro é pior que campo nenhum, e "R$ 0,00"
seria mentira com aparência de verdade. O espaço volta quando o preço tiver
origem — que é decisão comercial, não técnica.

## Decisão 4 — Alocar se serializa com a quantidade possuída

`setAllocation` trava a **mesma** linha de `collection_items` que
`setCollectionQuantity`. Sendo a mesma, guardar a terceira cópia e reduzir a
quantidade para 2 não podem acontecer ao mesmo tempo — que é o caso realmente
traiçoeiro, porque cada uma está certa sozinha.

Os três triggers do Checkpoint 2 continuam sendo a rede de segurança para quem
escrever por outro caminho; a mensagem legível de quem usa a tela é montada na
aplicação, com a conta exata do que ainda cabe.

## Decisão 5 — Excluir um local não mexe na coleção

As alocações vão junto por `ON DELETE CASCADE`: elas dizem "estas cópias estão
neste binder", e o binder deixou de existir. As cartas continuam sendo da
pessoa, agora sem lugar registrado — estado normal da seção 3.2.

A confirmação diz isso em voz alta. Sem essa frase, "excluir o binder" parece
que apaga as cartas, e ninguém toca no botão para descobrir.

## A resolução da decisão 007, enfim

O Checkpoint 9 deixou o conflito visível e a resolução para cá. Agora a pessoa
escolhe quantas cópias saem de cada local, e a escolha volta **junto com** a
nova quantidade, numa transação só (`business-rules.md` 3.3): desalocar e
reduzir em duas idas deixaria uma janela com alocação órfã, e um erro no meio
pararia exatamente ali.

Nenhuma retirada vem preenchida. Escolher a ordem — tirar do maior, tirar do
primeiro — seria presumir de onde as cartas saíram, que é o que a regra proíbe.
Retirar **a mais** é permitido: desalocar por vontade própria enquanto resolve é
escolha legítima, e a invariante continua de pé.

## Data

2026-09-07

---

# Decisão: 044 — Filtros que somam, e Binders como seção

## Contexto

Três correções pedidas pelo dono do produto depois de usar as telas prontas.
Todas de navegação e de interação; nenhuma muda regra de negócio nem modelo.

## Decisão 1 — Cada seção de filtro aceita vários valores

Dentro de uma seção os valores se somam por **ou**: marcar Preto e Azul pede
"preta ou azul". Entre seções vale o **e**: Azul com raridade SR pede as duas
coisas.

Antes, cada seção aceitava um valor só — escolher a segunda cor apagava a
primeira, e não havia como pedir "as pretas e as azuis" de uma vez.

O "ou" dentro da seção é a leitura que nunca esvazia o resultado sozinha:
acrescentar uma cor só pode aumentar o que aparece. O "e" — cartas que sejam
pretas **e** azuis ao mesmo tempo — é outra pergunta, legítima e mais rara, e
entraria como opção da seção se alguém pedir. Está escrito na tela para não
depender de adivinhação: *"Dentro de uma seção, vale qualquer um dos escolhidos.
Entre seções, valem todos."*

Custo e poder ficam de fora: são faixas, e duas faixas ao mesmo tempo seriam
duas perguntas na mesma pergunta.

O parâmetro repetido é a forma na URL (`?cor=Black&cor=Blue`) porque é o que o
navegador manda naturalmente e o que mantém a busca compartilhável. `IN` no
banco, com teto de vinte valores por filtro: cada valor é um item do `IN`, e uma
URL com mil cores seria uma consulta cara feita de graça.

**`queryToObject` mudou junto**, e essa era uma falha silenciosa: parâmetro
repetido ficava com o último valor, então `?color=Black&color=Blue` filtrava só
por azul, sem erro. Descarte silencioso é pior que rejeição — e aqui não havia
nem rejeição.

## Decisão 2 — O detalhe da carta volta para a lista de onde veio

O link de uma carta carrega o caminho da lista, com os filtros, num parâmetro
`de`. Voltar devolve a lista igual.

Sem isso, quem filtrava por azul para registrar cinco cartas azuis refazia o
filtro cinco vezes — uma por carta. Os filtros já viviam na URL justamente para
sobreviver ao histórico; o que faltava era a rota do detalhe saber de onde a
pessoa veio.

Só caminho relativo é aceito, e `//outro.site` é recusado junto com o absoluto:
é o mesmo cuidado do `next` da tela de entrar, porque é o mesmo risco de virar
desvio para fora do site.

## Decisão 3 — Binders é seção, e Trocas espera dentro de "Mais"

Binder, caixa e deck se criam e se editam **numa seção própria**, na barra de
navegação. Estava dentro de "Mais", que é gaveta de configuração — e criar coisa
não é configurar. Uma seção em que se cria conteúdo o dia inteiro pertence à
barra.

A rota virou `/binders` e o rótulo, "Binders". A palavra cobre também caixa e
deck: é sinédoque, e é o termo que quem joga usa. As três continuam com nome
próprio dentro da seção, nos tipos e nas abas.

**A barra continua com cinco.** Seis alvos a 360 px dariam 60 px cada, abaixo do
confortável para o polegar. Escolha do dono do produto entre as três saídas:
Trocas fica dentro de "Mais" até o checkpoint que a constrói, e volta para a
barra quando existir de verdade. Ela continua sendo uma seção reconhecida por
`activeDestination` — sem isso, quem abre `/trocas` não veria nada marcado em
lugar nenhum.

De onde se **usa** um binder não mudou: da coleção e do detalhe de uma carta
continua dando para dizer em qual local a carta está, e uma carta nasce com zero
locais. O que passou a ter um lugar só é criar e editar o local.

O painel de quantidade ganhou um link para a carta. Da coleção, tocar numa carta
abria só aquele painel, e ver em qual binder ela está exigia procurá-la de novo
pelo catálogo.

## Data

2026-09-07

---

# Decisão: 045 — A direção que faltava em Binders

## Contexto

O dono do produto perguntou por que a edição de local de uma carta estava no
catálogo, e se não deveria estar em Binders.

A rota `/catalogo/carta/[id]` não é uma tela de catálogo, apesar do endereço:
é o detalhe da carta, e desde o Checkpoint 9 é onde moram todas as ações
pessoais sobre ela — quantas se tem e, desde o 10, onde ela está.

Mas o diagnóstico por trás da pergunta estava certo. **Binders só tinha uma
direção.** Dentro de um local dava para ver o que já estava lá e ajustar
quantidades; não dava para *pôr* uma carta ali. O estado vazio da tela mandava
a pessoa embora: *"Abra uma carta da sua coleção e diga em qual local ela
está."*

Ou seja: a única forma de guardar uma carta era entrando por uma tela cujo
endereço diz "catálogo".

## Decisão — as duas direções existem, cada uma onde a pergunta é feita

Não é uma escolha entre elas: são tarefas diferentes.

| Pergunta | Onde | Forma |
|---|---|---|
| "Onde está esta carta?" | detalhe da carta | uma carta, vários locais |
| "O que ainda não guardei?" | Binders | várias cartas, um local por vez |

A segunda passou a existir em `/binders/sem-lugar`. Ela lista as cópias sem
lugar registrado e guarda cada uma em um toque.

O painel do detalhe da carta **fica onde está**. Remover seria piorar o fluxo
mais comum do produto: quem abre um pacote registra a carta e diz onde ela foi
parar na mesma tela. Obrigar a ir a Binders e procurar a carta de novo trocaria
um toque por seis.

## O lembrete

Uma linha calma no topo de Binders, na cor da marca, que leva à tela de
organizar e some sozinha quando a conta fecha.

**Não é um alerta, e isso é deliberado.** Cópia sem lugar registrado é estado
normal (`business-rules.md` 3.2) — ninguém é obrigado a mapear a coleção
inteira. `role="alert"` e vermelho diriam que há algo quebrado, e uma tela que
grita quando nada está errado ensina a ser ignorada.

Some também quando não há nenhum local criado: aí **tudo** está sem lugar, o
número seria o tamanho da coleção e o convite não teria para onde levar. Nesse
caso quem fala é o estado vazio da lista, que manda criar o primeiro.

Mostra dois números porque respondem a coisas diferentes: as cópias dizem o
tamanho do trabalho, as cartas dizem quantas vezes se toca na tela.

## `addAllocation`: manda quantas acrescentar, não o total

A tela de organizar diz "guardar 3 aqui". Quem organiza não sabe — nem deveria
precisar saber — quantas já estavam no local.

Calcular o total no cliente seria calculá-lo a partir de um número lido **antes**
da transação, que é exatamente a leitura que o lock existe para invalidar: duas
telas guardando a mesma carta ao mesmo tempo gravariam uma por cima da outra em
vez de somar. O total é resolvido dentro do lock, sobre a linha travada, e um
teste de concorrência cobre as duas adições simultâneas.

`setAllocation` e `addAllocation` compartilham o mesmo corpo, que recebe o que
já está no local e devolve o total desejado — uma verificação só, não duas
cópias dela.

## O nome do local não volta do servidor

A resposta traz o id, e a tela resolve o nome na lista que já tem. Devolver o
nome obrigaria o formulário a mandá-lo: um campo de texto escolhido pelo cliente
e conferido por ninguém. O id é o que é conferido contra o dono.

## Data

2026-09-07

---

# Decisão: 046 — Transferir entre locais, e a leva do Checkpoint 11

## Contexto

Dois pedidos do dono do produto: mover uma carta de um binder para outro, e a
edição em massa — "a janela tradicional de catálogo se torna uma mais prática,
com filtros mas abaixo de cada carta fica um `- 0 +`", terminando numa
confirmação "deseja mesmo adicionar X cartas ao local Y?".

## Decisão 1 — Mover é uma operação, não duas

Retirar de um local e guardar em outro acontecem na **mesma** transação. Em duas
chamadas existiria um instante em que as cópias não estão em lugar nenhum, e um
erro no meio pararia exatamente ali — a carta sumida do binder de origem e
ausente do destino.

**A ordem dentro da transação importa e não é intuitiva: tira primeiro, põe
depois.** O trigger `collection_item_locations_within_owned_quantity` roda por
linha, depois de gravar; acrescentar antes de retirar faria a soma passar do
possuído por um instante, e o banco recusaria uma movimentação que no fim não
muda soma nenhuma.

O painel troca de vista em vez de mostrar os dois controles juntos: "cópias
neste local" e "quantas mover" são números diferentes que parecem o mesmo, e
lado a lado se confundiriam. Cada vista tem um número só.

## Decisão 2 — Adicionar em massa mexe na coleção **e** no local

A tela 28 da especificação decide isto: mostra "Local de armazenamento: Binder
Principal" junto do aviso "esta operação será aplicada na sua coleção".

Faz sentido porque é o gesto que ela atende — abrir pacotes e pôr as cartas no
binder. Só alocar não funcionaria: alocar exige possuir, e quem acabou de abrir
o pacote ainda não registrou nada.

Guardar cópias que a pessoa **já tem** continua sendo outra tela,
`/binders/sem-lugar` (decisão 045), que não mexe na quantidade. São dois gestos
diferentes e cada um tem a sua porta.

A confirmação diz as três coisas: quantas cópias, em qual local, e que a coleção
muda junto.

## Decisão 3 — Tudo ou nada

A confirmação promete "adicionar 12 cópias". Aplicar oito e falhar em quatro
seria pior que falhar inteiro: a pessoa não saberia quais entraram sem conferir
uma a uma. Uma transação cobre a leva.

O teto é de 200 cartas diferentes por leva — acima disso a transação fica longa
demais para uma tela esperar.

A soma acontece no próprio `UPDATE` (`quantity + N`), e não a partir de um total
lido antes: é o que faz duas levas simultâneas somarem em vez de uma gravar por
cima da outra. Testado com as duas disparadas juntas.

## Decisão 4 — O contador começa em zero, e só acrescenta

A tela 27 da especificação mostra "Atual: 3 → 4", com incremento e decremento
sobre a quantidade existente. A tela pedida é outra: um `- 0 +` por carta, onde
o número é **quantas entram**.

Reduzir em massa ficou de fora de propósito. Reduzir a quantidade possuída pode
disparar o conflito da decisão 007 — "de qual local as cópias saem?" —, e essa
pergunta não cabe numa leva de cinquenta cartas: seriam cinquenta resoluções na
mesma tela. Continua carta a carta, onde há espaço para respondê-la.

## Decisão 5 — Nesta tela os filtros não vão para a URL

No catálogo eles vão, porque lá a lista filtrada é um endereço compartilhável.
Aqui são passo de uma tarefa: navegar a cada filtro remontaria a grade e
**apagaria as cartas já escolhidas**.

Então `CatalogFilters` ganhou um modo que devolve a escolha a quem chamou em vez
de navegar. É o mesmo painel — dois painéis divergiriam no dia em que um filtro
novo entrasse em um só.

A busca vai pela API, que é quem cobra a cota de leitura do catálogo
(decisão 020). Uma requisição em voo é cancelada logicamente quando outra
começa: trocar de filtro duas vezes depressa deixaria a mais lenta chegar por
último e pintar a grade com o filtro anterior.

## Data

2026-09-07

---

# Decisão: 047 — Preço vem do TCGplayer; da Liga vem só o link

## Contexto

O mercado brasileiro é volátil, e a cadência semanal cogitada não serve. A
pergunta virou: de onde tirar preço, e com que frequência.

A LigaOnePiece é onde quem joga no Brasil consulta preço. O dono do produto
apurou que o app que ele tinha em mente usa valores do **TCGplayer**, e decidiu
seguir o mesmo caminho — mantendo um botão que abre a carta na Liga.

## O que foi apurado sobre a Liga

Ela **não é acessível por programa**. Duas requisições programáticas voltaram
`403`, e um navegador de verdade recebe uma página de verificação:
*"Este site utiliza um serviço de segurança para proteção contra bots
maliciosos."*

Não existe API pública, e ler preço de lá exigiria contornar essa proteção — que
é exatamente o que ela existe para impedir. Além do risco de bloqueio, o risco
jurídico é maior que o da decisão 020: lá o dado era a lista factual de cartas
da Bandai; preço de marketplace é o produto comercial da casa.

**Fica registrado como caminho fechado**, para não ser reaberto por engano.

## Decisão 1 — O link existe, e é só link

Trafego chegando não é dado saindo: linkar para a Liga não passa por proteção
nenhuma e não copia nada. O endereço é montado do que já temos:

    ?view=cards/card&card=<Nome> (<num>)&ed=<EE-NN>&num=<num>

`num` é o código da carta com sufixo por arte — nada para a normal, `-PAR` para
a paralela. `ed` sai do **código da carta**, e não do código do set: `OP14-EB04`
reúne cartas `OP14-…` e `EB04-…`, e o código de cada uma diz a qual edição ela
pertence lá.

Dois endereços reais, conferidos pelo dono do produto, viraram teste. Se a
montagem mudar de forma, eles quebram antes de alguém descobrir pelo link torto.

## Decisão 2 — Quando não dá para ter certeza, o link vai para a busca

Duas situações quebram a derivação, e as duas são comuns no catálogo:

- **501 cartas têm mais de uma arte paralela**, até dez. `-PAR` sozinho não diz
  qual delas, e o catálogo importado não guarda o que as distingue (decisão 023:
  a fonte só separa Normal de Parallel). Chutar levaria à arte errada.
- **106 promos têm código `P-NNN`**, sem número de edição.

Nesses casos o link vai para a busca da Liga pelo código, e o rótulo muda para
"Buscar na Liga". Cai numa lista em vez da carta — mas nunca numa carta errada
nem numa página que não existe, e a pessoa sabe disso antes de tocar.

## Decisão 3 — O preço virá do TCGplayer

Escolha do dono do produto. O que isso implica, e que ainda não está resolvido:

- O TCGplayer não tem acesso aberto: a API é de **programa de parceiros**, com
  aprovação e credenciais. Sem elas não há o que construir do lado da coleta.
- Os valores são em **dólar**. Para um produto brasileiro, ou se converte — e aí
  a tela precisa dizer que é referência internacional convertida, senão o número
  mente — ou se mostra em dólar mesmo.

A cadência deixa de ser o problema: com gravação apenas quando o valor muda, a
captura diária custa ~23 MB/ano, contra os 16,7 MB que o banco inteiro tem hoje.
O que falta é a credencial.

## Data

2026-09-08

---

# Decisão: 048 — A want list mora na Coleção, e é só variante e quantidade

## Contexto

Começo do Checkpoint 12. O dono do produto pediu a want list e disse que ela
fica **separada do trade**.

As telas de referência a agrupam com Trade — "GRUPO 8 — WANTS + TRADE", telas 29
a 32 — e a `business-rules.md` a coloca na seção 4, dentro de Trocas. A
separação é uma mudança consciente de estrutura.

## Decisão 1 — Ela é uma aba da Coleção, e não uma seção nova

"Tenho" e "Quero" são as duas faces da mesma coisa: a want list é a coleção pelo
avesso — o que falta. Quem a abre está pensando na própria coleção, não em
negociar.

Isso também não custa vaga na barra de navegação, que já está cheia com cinco e
já deixou Trocas em "Mais" (decisão 044). Uma seção nova exigiria tirar outra.

São **links**, e não abas de estado: cada face é uma rota própria,
compartilhável, e que funciona antes de o JavaScript subir — o que, depois do
episódio do `allowedDevOrigins`, deixou de ser hipótese.

## Decisão 2 — Sem anotação e sem prioridade

A tela 30 mostra um campo "Minhas anotações", com o exemplo "Prioridade alta,
achar em eventos". A `business-rules.md` 4.4 diz o contrário, em voz alta: *"Não
existe prioridade nem campo de observação nesta versão."*

A regra venceu, com o dono do produto de acordo. Um want é **variante e
quantidade**, e nenhuma migration foi feita.

O campo volta quando houver um uso concreto — e aí provavelmente junto de
prioridade, que é a mesma conversa e a mesma tela.

## Decisão 3 — Wants não travam linha

A quantidade possuída precisa de `SELECT ... FOR UPDATE` porque é a ponta de uma
invariante entre linhas: a soma das alocações não pode passar dela. **Um want
não sustenta invariante nenhuma** — ninguém aloca contra ele, e o match não é
persistido (`business-rules.md` 4.3).

Então a escrita é um `upsert` sobre a chave única (usuário, variante), e o banco
resolve a corrida: duas telas gravando ao mesmo tempo terminam com o último
valor, que é o comportamento esperado de uma preferência.

## Decisão 4 — Três estados, e não dois

`missing`, `partial`, `satisfied`. "Tenho" e "não tenho" perderiam o caso mais
comum de quem monta playset: querer quatro e ter duas. É o `partial` que faz a
lista dizer o **tamanho** do que falta, e é o que falta que faz alguém sair de
casa atrás da carta.

Um want satisfeito continua na lista até ser tirado — quem quis quatro e tem
quatro pode querer uma quinta para trocar. O recorte "ainda faltam" esconde sem
apagar.

## Por que esta parte veio antes do resto de Trocas

Ela é a que **não** está bloqueada. A valoração de trade depende de
`card_prices`, que está vazia esperando a credencial do TCGplayer (decisão 047);
want e matching não usam preço — `MIN(disponível, desejado)`, e só.

`matchQuantity` já está no domínio, testada, esperando a tela de matches.

## Data

2026-09-08

---

# Decisão: 049 — Perguntar só quando há escolha

## Contexto

Primeiro uso real da remoção com alocação. O relato: pedir para remover a carta
da coleção, escolher o local de onde tirá-la, e a carta **não sair da coleção**.

## O defeito

Dois, na verdade, e o segundo estava escondido atrás do primeiro.

**O painel resolvia a quantidade errada.** "Remover da coleção" envia zero pelo
`value` do próprio botão, sem mexer no seletor — arranjo deliberado, para não
depender de um `setState` assíncrono antes do envio. Só que a resolução seguinte
era enviada com o número do seletor, que continuava sendo o antigo. A pessoa
pedia zero, resolvia o conflito, e a carta era "reduzida" para a quantidade que
já tinha. Nada mudava.

Agora o conflito traz a quantidade pedida — `requestedQuantity` já vinha na
resposta — e o seletor passa a mostrá-la. A resolução vale para o que foi
pedido.

**E a pergunta não deveria existir.** Remover da coleção inteira não tem
ambiguidade: se não sobra cópia, todas as alocações vão junto.

## Decisão

A regra 3.3 protege a **escolha**, não a alocação. Presumir só faz sentido
quando há mais de uma resposta possível, e em dois casos não há:

- a nova quantidade é **zero** — sai tudo;
- as cópias guardadas estão em **um local só** — é de lá que saem.

Nesses dois a retirada é deduzida e aplicada na mesma transação, sem pergunta.
Fora deles, o conflito continua exatamente como estava: com dois locais e uma
redução parcial, tirar duas do binder ou uma de cada são resultados diferentes,
e a escolha é de quem tem a carta.

Escolha do dono do produto, e ela melhora a regra em vez de afrouxá-la: o atrito
que sobrou é só onde existe informação a dar.

## O mesmo princípio nas trocas

Registrado em `business-rules.md` 4.6 para quando as trocas forem construídas:
as cópias saem por padrão dos locais com purpose `TRADE`, e a confirmação só
aparece quando há escolha real — trocar 2 tendo 4 divididas em dois Trade
Binders, por exemplo.

## Um teste antigo mudou de lado

`nenhuma alocacao e removida em silencio` fixava que zerar a quantidade deixava
as alocações intactas. Era o comportamento que acabou de ser trocado, então o
teste passou a exercer o caso que a regra realmente protege — redução parcial
com dois locais — e o caminho novo ganhou os seus.

## Data

2026-09-08

---

# Decisão: 050 — Preço de arte comum pelo espelho do tcgcsv

## Contexto

A decisão 047 escolheu o TCGplayer como fonte e parou onde ela travava: a API
deles é de programa de parceiros, foi depreciada em 2023, e não emitem
credencial nova. Sem credencial não havia o que coletar.

O caminho que restou é o **tcgcsv.com**, que publica o catálogo e os preços do
TCGplayer em arquivo, uma vez por dia, sem chave. O dono do produto aceitou a
dependência e mandou começar pelas artes comuns, com as paralelas a serem
mapeadas à mão depois, coleção a coleção.

## Decisão 1 — A fonte é o espelho, e ele é lido em lote

87 arquivos por passada, um por grupo, com o mesmo intervalo de cortesia da
importação do catálogo (decisão 020). A alternativa — uma requisição por carta —
seriam 4.843 requisições, mais de duas horas por dia contra servidor de terceiro.

Duas coisas que custaram tempo e ficam registradas:

- **O `User-Agent` não é enfeite.** O `fetch` do Node não manda nenhum, e o host
  responde `401` a quem chega sem se identificar.
- **A SDK do Supabase não entra aqui** — nem em nada que rode em script. Ela
  constrói um cliente de Realtime na criação e quebra no Node 20 com
  *"native WebSocket not found"*.

## Decisão 2 — Qual produto é a carta: a regra falha fechado

A fonte identifica produto por id dela; o código Bandai está num campo `Number`.
Só que **uma carta tem vários produtos**: a arte comum, a paralela, a
alternativa, o box topper, a versão de evento. Casar pelo número daria o preço
de qualquer uma delas.

O que distingue é o nome, e o nome não é uniforme: `Trafalgar Law (069)`,
`Franky`, `Loki (OP17-119)`. O tratamento, quando existe, vem sempre entre
parênteses. Então: **tira-se o número do nome, e a arte comum é o produto que
não sobra com nenhum parêntese.**

Sobre 5.231 números da fonte: 4.096 identificados, 1.135 sem candidato e **zero
ambíguos**. É essa a propriedade que importa — a regra nunca escolhe entre dois.

Uma hipótese anterior ("a arte comum termina com `(NNN)`") casava 489 de 5.231.
Foi descartada por medição, não por opinião.

## Decisão 3 — O desempate vem do nosso próprio catálogo

A regra dos parênteses errava num caso previsível: cartas cujo nome de verdade
tem parênteses — `Mr.1(Daz.Bonez)`, `Miss Doublefinger(Zala)`, `Zephyr(Navy)`.
Nenhum candidato sobrava, e 44 cartas ficavam sem preço.

O desempate não é palpite: **o nosso catálogo sabe o nome da carta**. Quando a
regra dos parênteses não decide, vale o produto cujo nome, tirado o número, é o
nosso nome — comparado sem espaço e sem caixa, porque a fonte escreve
`Mr.2.Bon.Kurei (Bentham)` e `Mr.2.Bon.Kurei(Bentham)` na mesma categoria.

Igualdade contra dado nosso, e não semelhança: `Mr.3(Galdino) (Full Art)` não é
igual a `Mr.3(Galdino)`, então tratamento continua de fora.

Isso mudou a forma do contrato: a fonte recebe o catálogo de nomes de quem a
chama. Ela compara; o dono do catálogo é a aplicação.

## Decisão 4 — `Normal`/`Foil` é acabamento, não arte

O erro mais caro da primeira versão. O campo `subTypeName` da fonte separa o
**acabamento** do mesmo produto, e não artes diferentes. Filtrar por `Normal` —
por analogia com o nosso `variantType` — descartava a cotação de 870 cartas cuja
impressão base é foil: líder, SR, SEC.

Corrigido, a cobertura foi de **64% para 96,7%**.

Quando o mesmo produto tem cotação nos dois acabamentos, não há preço: são dois
valores reais de duas impressões reais, e o nosso modelo guarda uma variante só.
O `ST01-001 Monkey.D.Luffy` cota 18,52 e 9,93 — a diferença não é
arredondamento. São 5 cartas.

## O que fica sem preço, e por quê

Medido sobre as 2.785 cartas do catálogo:

| | cartas | |
|---|---:|---|
| com preço | 2.692 | 96,7% |
| arte comum com dois acabamentos | 5 | 0,2% |
| sem arte comum na fonte | 88 | 3,2% |
| fora da fonte | 0 | 0% |

As 88 são quase todas promos `P-xxx` cujos únicos produtos na fonte são
tratamentos: o `P-084 Buggy` só existe lá como `(SP)`, `(Promo Reprint)` e as
duas versões de evento. Não há arte comum à venda para casar.

Para reabrir a conta a qualquer momento: `npx tsx scripts/cobertura-precos.ts`.

## Decisão 5 — Paralela não recebe o preço da comum

O código identifica a carta, não a arte. O nosso catálogo só separa Normal de
Parallel (decisão 023), então não há como dizer qual paralela é qual. A tela diz
isso em voz alta, em vez de sumir com a seção: ausência sem explicação vira
dúvida sobre o produto.

O mapeamento manual das paralelas, coleção a coleção, é trabalho combinado com o
dono do produto. O vocabulário de tratamentos da fonte — `Alternate Art`,
`Parallel`, `Box Topper`, `SP`, `Manga`, `Full Art` — parece alinhar com os
sufixos da Liga (`-PAR`, `-BT`), o que dá um ponto de partida.

## Decisão 6 — Em dólar, dito em voz alta

A cotação é de mercado americano. Converter para real exigiria uma taxa de
câmbio — outra fonte, outra data — e o número resultante pareceria o preço
brasileiro sem ser: o mercado daqui tem imposto, frete e escassez próprios.

Mostra-se o valor como ele é, com a frase *"Referência internacional, em dólar,
do TCGplayer. Não é o preço no Brasil"*, e o link da Liga logo abaixo continua
sendo o caminho para o preço em real.

Formatado em `en-US`: `US$ 12,34` com vírgula decimal mistura duas convenções e
faz o valor parecer convertido.

## Decisão 7 — "Desde", e não "atualizado em"

A série histórica só ganha linha quando o valor muda (`business-rules.md` 5).
Isso derruba o custo de 1,77 milhão de linhas/ano para uma fração — mas tem um
preço em precisão: **não dá para distinguir "não mudou" de "não foi
verificado"**.

A data que existe é a da última mudança. Escrever "atualizado em 12/08" numa
carta conferida hoje de manhã seria falso; "desde 12/08" é o que a linha diz.

Medido na segunda passada do mesmo dia: 2.692 casadas, **0 gravadas**, 1.755 sem
mudança. A comparação é feita em centavos porque a coluna é `numeric(12,2)` e o
valor volta como ponto flutuante — comparar direto faria 12,34 diferir de si
mesmo e regravaria tudo a cada importação.

## O que ficou de fora, e espera decisão

A execução **diária** ainda é manual: `npm run supabase prices`. Automatizá-la
significa agendar algo que escreve em produção com a credencial dela, e produção
nunca é alvo por padrão neste projeto. Fica para o dono do produto decidir.

## Data

2026-09-08

---

# Decisão: 051 — Preço em real, e uma frase que não mente sobre a data

## Contexto

Pedido do dono do produto, em três partes: mostrar também o valor em real pela
cotação do dia, exibir o dólar usado, e trocar o aviso por
*"Fonte: TCGplayer. Atualizado hoje 04:00"*.

A terceira parte batia de frente com a decisão 050, que escolheu escrever
"desde" justamente porque a série de preços só ganha linha quando o valor muda —
não havia como saber quando a última conferência aconteceu. A saída não foi
recuar de nenhum dos dois lados, e sim dar à afirmação sobre a conferência um
lugar próprio.

## Decisão 1 — A cotação vem do PTAX do Banco Central

Escolha do dono do produto entre as opções apuradas. É a referência oficial
brasileira, aberta, sem chave e sem cadastro — qualquer pessoa confere no site
do BC o número que a tela mostra, o que não é pouco num campo de dinheiro.

A alternativa era uma API comercial gratuita de cotação ao vivo, que cobre fim
de semana. Foi recusada por ser serviço de terceiro sem compromisso de
disponibilidade: no dia em que sumisse, o valor em real sumiria da tela.

**Dia útil, e o que isso obriga.** O PTAX não existe em sábado, domingo nem
feriado bancário, e a consulta de uma data sem cotação devolve **lista vazia**,
não erro. O provedor anda para trás até cinco dias — que cobre um fim de semana
com feriado emendado dos dois lados — e a tela mostra de que dia é o número.

Usa-se `cotacaoVenda` e não `cotacaoCompra`: quem olha o preço de uma carta
americana está pensando em comprar dólar. A diferença é pequena — 5,12470 contra
5,12530 em 04/09 — mas escolher sem dizer qual seria escolher no escuro.

## Decisão 2 — O real é derivado, nunca guardado

Fica no banco o preço em dólar e a cotação do dia, separados. O real é calculado
na leitura.

Guardar o convertido criaria duas verdades para o mesmo fato: quando o Banco
Central corrigisse a cotação de um dia — e ele corrige —, o valor gravado
continuaria contando a história antiga, e ninguém saberia qual dos dois números
estava certo.

É também o que a regra 5.1 exige. O valor histórico de um trade sai do preço
vigente em `completed_at`; em real, isso é o preço daquele dia vezes a cotação
daquele dia — duas linhas com data, e não um número congelado.

**Sem cotação utilizável, o real não aparece.** Três dias é o limite: cobre o
fim de semana com feriado emendado, que é o buraco mais longo que o calendário
brasileiro produz sem que algo esteja errado. Passando disso, a importação
parou, e converter por taxa velha seria apresentar um palpite com cara de dado.

## Decisão 3 — Duas tabelas novas, aprovadas pelo dono do produto

`exchange_rates` — uma linha por par por dia. O valor é **sobrescrito** quando
muda, ao contrário de `card_prices`: duas verdades para o mesmo dia é o que a
chave única existe para impedir.

`price_imports` — uma linha por execução, com o horário, o carimbo da fonte, os
contadores e a mensagem de erro quando falha. É daqui que sai o "atualizado hoje
às 04:00", e é ela que permite manter a série de preços esparsa sem que a tela
precise mentir. De quebra, preenche a observabilidade que `integrations.md`
seção 4 pedia desde o começo e nunca teve onde morar.

**Importação que falhou não conta como conferência.** Contá-la faria a tela
dizer "atualizado hoje" justamente no dia em que a importação quebrou — que é
quando o aviso mais precisa ser verdade.

## Decisão 4 — Três datas, e a tela usa a certa para cada coisa

Este foi o nó, e vale escrito:

| | de onde vem | o que afirma |
|---|---|---|
| `since` | `card_prices` | quando **este valor** passou a valer |
| `checkedAt` | `price_imports` | quando **conferimos** pela última vez |
| `sourceUpdatedAt` | `last-updated.txt` da fonte | de quando é o **dado do mercado** |

A tela mostra a segunda como "Atualizado hoje às 04:00". A primeira não aparece:
num common estável ela é de semanas atrás e faria o produto parecer abandonado.

A terceira aparece **quando é de outro dia**, e é o caso normal — o espelho
publica às 20:00 UTC, 17:00 aqui, e a importação roda de madrugada. Então o
texto fica *"Atualizado hoje às 04:00, com dados do mercado de 08/09"*. Dizer só
a nossa daria a entender que o mercado foi lido às 04:00.

E "hoje" só é escrito quando é hoje: no dia em que a importação não rodar, a
linha passa a mostrar a data — que é justamente o dia em que isso importa.

## Decisão 5 — A importação diária roda às 04:00, por workflow agendado

07:00 UTC. O Brasil não tem mais horário de verão, então a conta não muda no
meio do ano.

O workflow **só age depois** que o segredo `SUPABASE_DATABASE_URL` existir no
repositório; sem ele termina sem erro dizendo que pulou. Falhar todo dia por
segredo ausente seria ruído, e ruído diário é o jeito mais rápido de ninguém
mais olhar para um alerta.

Produção continua sendo alvo explícito: quem decide o destino é o script, pela
variável, e não o agendamento.

## Um defeito que o teste pegou antes da tela

`quote_date` é coluna `DATE` — um dia, não um instante — e chega ao código como
meia-noite UTC. Formatá-la no fuso de São Paulo a jogava para as 21h do dia
anterior: a cotação de 08/09 aparecia como 07/09.

Data de calendário é formatada em UTC; instante, no fuso de São Paulo. São
coisas diferentes e agora têm funções diferentes.

## Data

2026-09-09

---

# Decisão: 052 — Reimpressão não é variante

## Contexto

Ao preparar o mapeamento manual das artes paralelas, o levantamento mostrou que
o nosso catálogo tinha **mais paralelas do que o TCGplayer oferece** — 1.086
cartas com paralela contra uma contagem que fechava em menos da metade.

A explicação estava no identificador da própria Bandai. Ela usa dois sufixos:

- `_pN` — **arte paralela**: outra ilustração da mesma carta.
- `_rN` — **reimpressão**: a mesma arte, publicada de novo noutro produto.

O nosso parser tratava tudo que não fosse o código puro como `Parallel`.

## As três evidências

Antes de apagar 412 linhas, três medições independentes:

1. **Raridade.** As 412 reimpressões têm a mesma raridade da arte comum da
   carta, em 100% dos casos. Nenhuma exceção.
2. **O catálogo do TCGplayer.** Dos 255 produtos marcados `(Reprint)`, **zero**
   trazem junto um tratamento de arte. Não existe "reimpressão da alternate
   art" — toda reimpressão é da arte comum.
3. **Os sets batem.** `EB01-012_r1` está no PRB-02, e é exatamente lá que o
   TCGplayer lista `Cavendish (Reprint)`. `OP09-056_r1` está no ST-25, onde a
   fonte lista `Mr.3(Galdino) (Reprint)`.

## Decisão — vira impressão, não variante

Escolha do dono do produto: *"é a mesma carta, o único dado interessante aí é
saber que esta mesma carta existe em mais de um set, onde exibimos os sets de
cada carta"*.

E para isso a tabela já existia. `variant_printings` é literalmente "esta
variante foi impressa neste set". A reimpressão passa a ser uma linha lá, na
arte que ela reimprime.

A `EB01-012` deixou de ter três paralelas e passou a mostrar `EB-01, PRB-02`.

## O que isso conserta, medido

| | antes | depois |
|---|---:|---:|
| variantes | 4.843 | 4.431 |
| cartas com paralela | 1.086 | 997 |
| cartas caindo na busca da Liga | 501 | 406 |

**95 cartas ganharam link exato na Liga.** O link só é exato quando existe uma
paralela só — com duas ou mais, não dá para saber qual é qual e ele cai na
busca. Em 95 cartas a "outra paralela" era uma reimpressão.

Some também uma explicação errada na tela: a reimpressão dizia *"artes paralelas
ainda não têm preço"*, sendo que não é paralela.

**Playset não muda.** A regra 2.1 conta por código de carta somando todas as
variantes; o resultado é o mesmo dos dois jeitos. Conferido antes de anunciar.

## A aplicação fica para o fim do import

`EB01-012_r1` chega na página do PRB-02, e a arte que ela reimprime está na do
EB-01. Gravar na hora funcionaria ou não conforme a ordem em que a fonte lista
as séries — o tipo de acerto que quebra sozinho um dia.

Então o parser só separa os dois sufixos, e o importador aplica todas as
reimpressões numa passada final, com o catálogo inteiro já no banco. Reimpressão
cujo original não apareceu fica no relatório em `reprintsWithoutBase`: descarte
silencioso já custou 538 variantes uma vez (armadilha 5).

## A migration falha alto em vez de apagar coleção

Hoje nenhuma reimpressão tem coleção, want, trade ou preço associado —
conferido no banco local e em produção, que ainda não tem usuários. As chaves
estrangeiras são `RESTRICT` e já barrariam o `DELETE`, mas com uma mensagem
sobre constraint em vez de sobre o problema.

A migration checa antes e levanta com o motivo escrito. Se um dia disparar, a
resposta certa não é forçar: é **somar as quantidades** na variante Normal, com
cuidado sobre o único `(collection_id, card_variant_id)` — e essa lógica não
está escrita, porque escrever para zero linhas seria inventar requisito.

## O que se perde

A imagem da reimpressão. Ela mostra a carta com o símbolo do set novo, e some
junto com a linha. É o preço aceito pela decisão do dono do produto: o dado que
interessa é o set, e esse fica.

## Uma pendência antiga fechou junto

O handoff registrava *"uma variante sem set: `ST14-010_r1`"*, com o palpite de
que o sufixo `_r1` não era reconhecido como os `_pN`. O palpite estava certo, e
era a ponta deste fio. Reimpressão sem campo de set não acrescenta nada — o set
é o único dado que ela traz.

## Data

2026-09-09

---

# Decisão: 053 — O vínculo entre a nossa arte e o produto da fonte

## Contexto

O preço da arte comum funciona por regra (decisão 050). A paralela não tem
como: o código identifica a carta, não a arte, e o nosso catálogo só separa
Normal de Parallel (decisão 023). Uma carta com três paralelas tem três linhas
indistinguíveis, e a fonte tem três produtos com nome e preço próprios.

Decisão do dono do produto: tabela nova, **priorizando manutenibilidade a longo
prazo nas futuras atualizações e importações**.

## Decisão 1 — `variant_source_products`, e só para o que a regra não deriva

Uma linha por arte nossa que precise de vínculo. A **arte comum não entra**: a
regra da decisão 050 identifica ela sozinha, sem ambiguidade, e uma linha
gravada aqui envelheceria mal quando a fonte mudasse. Materializar o que é
derivável cria uma segunda verdade que pode divergir da primeira.

Dois índices únicos, e o segundo é o que importa: `(source, source_product_id)`
impede dois vínculos apontando para o mesmo produto — erro fácil de cometer
mapeando centenas de cartas à mão.

`ON DELETE CASCADE`, como `variant_printings` e ao contrário de `card_prices`:
vínculo é dado derivado do catálogo, sem valor histórico próprio.

## Decisão 2 — `origin` é o que sustenta isto a longo prazo

Foi o pedido explícito, e a resposta a ele é esta coluna.

- `automatic` — sai de uma regra. Pode ser refeito quantas vezes for preciso; se
  a fonte trocar o produto, a próxima passada corrige sozinha.
- `manual` — sai do julgamento do dono do produto. **Nunca é sobrescrito por
  regra nenhuma.**

Sem essa distinção, a primeira rederivação apagaria horas de trabalho manual, e
mapear à mão deixaria de fazer sentido. É a única coluna aqui que não descreve
o dado, e sim como confiar nele.

## Decisão 3 — o automático cobre só o caso sem escolha

Vincula quando a carta tem **uma** paralela do nosso lado e a fonte oferece
**uma** arte além da comum. Aí não há o que escolher: casar é dedução.

Com duas de cada lado, a resposta depende de saber qual é a *Alternate Art* e
qual é a *Manga*. Isso é olho humano, e chutar poria o preço de uma arte na
outra — no campo de dinheiro, o pior lugar para um palpite.

Resultado da primeira passada, sobre as 997 cartas com paralela:

| | cartas |
|---|---:|
| vinculadas automaticamente | **478** |
| ambíguas — esperam mapeamento manual | 351 |
| a fonte não oferece a arte | 168 |

As 478 ganharam preço na mesma execução.

## Decisão 4 — separar arte de embalagem virou domínio

A fonte lista um produto por **caixa**, não por arte: a mesma ilustração aparece
como `(Reprint)`, `(Dash Pack)`, `(Nami Deck)`, `(Premium Card Collection)` e
como uma dúzia de pacotes de torneio.

O vocabulário de tratamento de arte — `Alternate Art`, `Manga`, `SP`, `Full
Art`, `Box Topper`, `Jolly Roger Foil`, `Pirate Foil`, `Wanted Poster`,
`Pandaman Art`, `TR`, `Gem`, `Gold`, `Silver`, `Parallel` e as variações de
*Super Alternate Art* — saiu do script de levantamento e virou
`domain/prices/treatments.ts`, onde pode ser testado.

Falha fechado: o que não está na lista **não é arte** — não porque se saiba que
é embalagem, mas porque não se sabe que é arte. A lista cresce quando a fonte
inventa um tratamento novo, e crescer é seguro; encolher não.

Combinações são reais (`SP + Gold`, `Alternate Art + Manga`) e valem como arte
só quando **todas** as partes valem. Uma parte desconhecida no meio tira o
produto da conta.

## Uma passada pela fonte por execução

Vincular e importar preço pedem a mesma coisa: os 87 arquivos. Rodando um atrás
do outro, cada um pedia a sua cópia — 348 requisições onde 174 bastam, contra
infraestrutura de terceiro, o que a decisão 020 existe para evitar.

`oncePerRun` embrulha o provedor e guarda a resposta **desta execução e só**.
Não é cache com validade: o objeto vive o tempo do script. Guardar entre
execuções seria servir preço velho sem que nada dissesse isso.

O vínculo roda **antes** do preço, para que um vínculo criado agora já renda
preço na mesma passada em vez de esperar o dia seguinte.

## O que mudou na tela

Paralela sem preço dizia *"artes paralelas ainda não têm preço: a fonte não
distingue qual paralela é qual"*. Virou *"esta arte ainda não foi identificada
na fonte, então fica sem preço"* — porque agora 478 delas têm preço, e a frase
antiga passou a ser falsa.

## Data

2026-09-09

---

# Decisão: 054 — O Trade Binder é uma leitura, não uma lista que se monta

## Contexto

Tela 31. O Trade Binder é a soma do que está guardado em locais com finalidade
`TRADE` (`business-rules.md` 4.1) — não é uma coleção separada.

## Decisão 1 — não se adiciona nada aqui

A tela lê e leva para os binders. Um segundo jeito de dizer "esta carta está
disponível" criaria duas listas que podem discordar, e a pergunta "por que a
carta não aparece no Trade Binder" passaria a ter duas respostas possíveis.

O vazio diz isso em voz alta e leva para `/binders`, senão a pessoa procura um
botão de adicionar que não existe nesta tela.

## Decisão 2 — a tela desdiz o próprio nome

"Trade Binder" sugere um lugar onde as cartas ficam reservadas. A regra 4.2 diz
o contrário: estar ali significa **disponível**, não comprometido com ninguém.

O nome vem da especificação e fica. O resumo no topo é que esclarece, porque o
nome sozinho engana e a consequência de entender errado é achar que uma carta
está guardada para alguém quando não está.

## Decisão 3 — duas contagens, porque são duas perguntas

"3 cartas · 7 cópias". Quem procura uma carta pensa em cartas; quem oferece uma
troca pensa em cópias, e oferecer três Zoro não é oferecer três cartas.

A especificação mostra só um número ("74 cartas disponíveis para troca") e não
diz qual dos dois é. Mostrar os dois evita escolher no escuro, e custa meia
linha.

## Decisão 4 — "em N locais" aparece na carta

Não é enfeite: muda o que acontece ao concluir o trade. Com as cópias num lugar
só, de onde elas saem é dedução; espalhadas, a regra 4.6 manda perguntar. Ver
antes é melhor que ser perguntado depois sem contexto.

## O que foi feito diferente da especificação, e por quê

**"Por Set" e "Por Raridade" viraram busca e modo de exibição.** A tela 31
mostra esses dois agrupamentos. O produto já tem um padrão de busca e filtro —
usado em Coleção, Catálogo e nas cartas de um binder — e uma quarta gramática só
nesta tela custa mais em aprendizado do que rende em conveniência. Fácil de
acrescentar se o dono do produto preferir o desenho original.

**O botão "Compartilhar" não existe.** É a rota pública do Trade Binder, que é
Premium e tem token revogável (decisão 008). Botão que não faz nada é pior que a
ausência dele.

## Os matches não entraram, e não por falta de tempo

A tela 32 depende de duas definições que a especificação não dá:

1. **Quem pode ver o Trade Binder de quem.** A regra 6.2 diz que ninguém lê
   recurso privado de outra pessoa, e a 6.1 põe a publicação atrás do Premium,
   com token explícito. A tela de matches mostra nome, foto e cartas de
   estranhos sem nada disso.
2. **O que é "% de compatibilidade".** A regra 4.3 define a quantidade do match
   — `MIN(disponível, desejado)` — e nada mais. A porcentagem, e o corte de
   "alta compatibilidade", não estão em lugar nenhum.

As duas são decisão do dono do produto, e a primeira é de privacidade. Ficam
perguntadas em vez de inventadas.

## Data

2026-09-09

---

# Decisão: 055 — A troca é consentida dos dois lados, e não há vitrine

## Contexto

A tela 32 da especificação mostra "Encontramos 12 pessoas com cartas que você
quer", com nome, foto e cartas de estranhos. Isso não sobrevive à regra 6.2 —
ninguém lê recurso privado de outra pessoa — nem à 6.1, que reserva a publicação
do Trade Binder ao Premium, com token explícito e revogável.

Perguntado ao dono do produto, ele definiu o protocolo inteiro.

## Decisão 1 — o consentimento é o que abre o dado

> "O recurso privado só vai ser lido por ter consentimento de ambas as partes."

1. O usuário 1 inicia a troca com o 2.
2. O usuário 2 entra na troca. **É aqui que o consentimento fecha.**
3. O sistema cruza want list e Trade Binder **nas duas direções**.
4. Cada um ajusta a própria oferta.

Antes do passo 2, nenhum dado privado de nenhum dos dois é cruzado nem exibido.

**A tela 32 como desenhada deixa de existir.** Não há descoberta de pessoas, não
há porcentagem de compatibilidade, não há lista de estranhos. O que existe é o
cruzamento dentro de uma troca — e ele é a regra 4.3 aplicada duas vezes, uma
por direção.

Isso também encerra a pergunta sobre "% de compatibilidade": ela existia para
ordenar uma lista de estranhos que não vai existir.

## Decisão 2 — cada um mexe só na própria oferta

Nunca na do outro. A oferta de cada um são os `trade_items` do
`trade_participant` dele, e quem garante isso é o servidor: um
`trade_participant_id` vindo do cliente nunca é confiável (regra 6.2).

## Decisão 3 — qualquer alteração revoga as confirmações

A troca é validada quando os dois confirmam. Se alguém altera, as confirmações
caem e a pessoa afetada é avisada: *"o usuário X alterou a troca, revise e
confirme novamente"*.

Uma confirmação significa "concordo com a troca que está na tela agora". É a
única leitura que serve: se ela sobrevivesse a uma alteração, ninguém saberia se
o outro concordou com o que vê ou com uma versão anterior, e o gesto de
confirmar perderia o sentido.

**A revogação vale para as duas confirmações**, e não só para a de quem não
alterou. A regra escrita pelo dono do produto cobre o primeiro caso; o segundo é
a mesma regra levada a sério — quem confirmou e em seguida mudou a própria
oferta não confirmou esta. Preservar a confirmação de quem alterou pareceria
gentileza e deixaria a pessoa confirmada numa troca diferente da que aceitou.

Fica registrado como leitura, e não como palavra do dono do produto: é barato de
corrigir se ele quiser o contrário.

`CONFIRMED` volta para `NEGOTIATING` quando alguém altera — é onde o trade
estava enquanto se conversava. `COMPLETED` e `CANCELLED` não aceitam alteração
nenhuma: o valor histórico sai do preço vigente em `completed_at` (regra 5.1), e
mexer nos itens depois disso reescreveria o passado.

## O que ficou construído, e o que falta

Construído: o domínio inteiro, puro e testado — o cruzamento nas duas direções
(`domain/trades/crossing.ts`) e a negociação com confirmação e revogação
(`domain/trades/negotiation.ts`).

Falta, e depende de uma resposta: **como o usuário 1 alcança o usuário 2**. O
protocolo começa em "o usuário 1 inicia a troca com o 2" e não diz como ele o
encontra. O produto hoje não tem lista de amigos, nem nome de usuário público,
nem busca de pessoas — e buscar por e-mail revelaria quem é cadastrado, que é
vazamento de privacidade no exato lugar que esta decisão protege.

Também está por definir os valores de `trade_participants.role`, que a coluna
aceita mas nada define. O único assimétrico no protocolo é quem iniciou.

## Data

2026-09-09

---

# Decisão: 056 — O convite, e quem é quem numa troca

## Contexto

A decisão 055 registrou o protocolo do dono do produto e parou num ponto: ele
começa em "o usuário 1 inicia a troca com o 2" e não diz **como o 1 encontra o
2**. O produto não tem lista de amigos, nome de usuário público nem busca de
pessoas.

## Decisão 1 — link de convite, escolhido pelo dono do produto

Quem abre a troca ganha um link e manda por onde já conversa — WhatsApp,
Discord, pessoalmente. Quem abre o link entra.

As alternativas e por que caíram:

- **Nome de usuário público.** Mais parecido com o mock, que mostra "LucasM" e
  "MarinaTCG". Exige uma identidade pública que não existe, e permite descobrir
  quem é cadastrado por tentativa.
- **Busca por e-mail.** Revelaria se um e-mail está cadastrado a quem tentasse —
  vazamento no exato lugar que o protocolo protege.
- **Pelo Trade Binder público.** Nada novo a inventar, mas amarraria começar uma
  troca ao Premium de um dos lados.

O link vence porque **não cria diretório nenhum**. Não há o que vazar.

## Decisão 2 — o token é longo, e é link, não código de ditar

Quem entra passa a ver o cruzamento do Trade Binder e da want list de quem
convidou. Um código curto de digitar seria adivinhável, e adivinhar um seria
entrar na negociação de estranhos.

São 24 bytes em base64url — 32 caracteres, ~192 bits — como o token do Trade
Binder público (decisão 008). É para copiar, não para ditar.

**O convite é queimado quando alguém entra**, na mesma transação. Duas razões: um
link que continua valendo é um link que ainda pode vazar, e a regra 4.5 diz que
um trade efetivo tem exatamente dois participantes. A condição vai no `WHERE` do
`UPDATE`, e é o que resolve duas pessoas abrindo o mesmo link ao mesmo tempo —
quem chega depois atualiza zero linhas e desiste.

## Decisão 3 — `DRAFT` enquanto falta alguém, e não `PROPOSED`

Um convite que ninguém aceitou não compromete cópia nenhuma. A regra 4.5 conta
como ativo a partir de `PROPOSED`, e travar a pessoa em "uma troca por vez" por
causa de um convite pendente seria cobrar por algo que não aconteceu.

`PROPOSED` fica sem uso por ora. É honesto dizer isso em voz alta: ele existe no
modelo para um convite **dirigido** a alguém, que é o que faria sentido no dia em
que houver identidade pública. Com link, não há a quem dirigir.

## Decisão 4 — `INITIATOR` e `RECIPIENT`

A coluna `role` existe desde o modelo lógico e nunca teve valor definido — sem
`CHECK`, qualquer texto entrava, e um teste antigo usava `COUNTERPARTY`, escrito
quando não havia vocabulário.

A única assimetria do protocolo é quem convidou. `COUNTERPARTY` descreveria uma
posição que na verdade é simétrica — os dois são contraparte um do outro —,
enquanto `RECIPIENT` nomeia o fato: recebeu o convite.

## Decisão 5 — o aviso precisou de uma coluna

Foi um defeito que o próprio teste expôs. A regra 4.6.3 manda avisar *"o usuário
X alterou a troca, revise e confirme novamente"* — só que a alteração **revoga**
as confirmações, e depois disso nada no estado lembra que houve o que revogar. A
tela diria "confirme" como se fosse a primeira vez, e a pessoa não saberia que o
combinado mudou.

`trade_participants.review_requested_at` guarda isso. Não guarda **quem**
alterou, porque não precisa: são exatamente dois participantes, e a própria
alteração de alguém nunca pede revisão a ele mesmo — quem alterou sabe o que
fez. Se o campo está preenchido, foi o outro.

Um `CHECK` amarra os dois lados do mesmo fato: quem espera revisão não está
confirmado. Se divergissem, a tela mostraria "confirmado" e "revise" ao mesmo
tempo, e nenhuma das duas seria confiável.

## O que ficou construído

Começar, entrar pelo convite, ler a troca já cruzada nas duas direções, ajustar
a própria oferta, confirmar, retirar a confirmação e cancelar. Tudo na camada de
aplicação, com autorização, e 27 testes de integração.

**Falta a interface.** As telas de negociação são o passo seguinte.

## Data

2026-09-09

---

# Decisão: 057 — As ferramentas da want list, e a folha para levar ao grupo

## Contexto

Pedido do dono do produto: uma entrada da want list dentro de "Mais", com adição
em massa e revisão, e um PDF com imagem e quantidade das cartas procuradas —
com a marca, para divulgação.

## Decisão 1 — a lista fica na Coleção; as ferramentas, em "Mais"

A decisão 048 pôs a want list na Coleção, porque quem a abre está pensando na
própria coleção. Isso não muda.

O que entra em "Mais" é o trabalho **sobre** ela: acrescentar em leva, revisar,
levar para o grupo. É o mesmo arranjo que a decisão 044 pediu para binders —
navega-se onde se navega, administra-se onde se administra —, e evita duas telas
mostrando a mesma lista.

## Decisão 2 — a leva acrescenta, nunca substitui

Quem já quer duas e marca mais uma passa a querer três. O gesto que a tela
atende é "achei mais uma que eu quero", e substituir apagaria em silêncio o que
a pessoa anotou carta a carta.

A soma acontece no banco (`increment`), e não num número calculado antes: duas
levas simultâneas somam as duas em vez de uma sobrescrever a outra.

Reduzir continua sendo carta a carta, na revisão. Uma leva que também tirasse
exigiria um controle capaz de dizer "menos que zero" e um jeito de distinguir
"não mexi" de "quero zero".

## Decisão 3 — o seletor de cartas virou um componente só

A leva da want list é o mesmo gesto da leva de armazenamento: percorrer o
catálogo com filtros marcando quantas de cada. Em vez de copiar 400 linhas, o
seletor saiu para `catalog/card-picker` e as duas telas viraram cascas.

O que estava em jogo não era tamanho, e sim duplicar decisões sutis — a corrida
entre buscas quando se troca de filtro depressa, o ajuste de estado durante a
renderização em vez de num efeito, o formulário nativo escondido — que só se
lembraria de consertar num lugar.

Os 53 testes da tela de armazenamento passaram sem alteração. Foi essa a
verificação da refatoração.

## Decisão 4 — o PDF sai pela impressão do navegador

**E não de um gerador nosso**, por causa da decisão 026: as imagens de carta são
referenciadas na origem e **nunca copiadas nem rearmazenadas**. É mitigação
jurídica, não de performance.

Gerar o arquivo por JavaScript exigiria desenhar cada imagem num `canvas`. O
host da Bandai não manda `Access-Control-Allow-Origin` — conferido nos
cabeçalhos —, então o `canvas` ficaria contaminado e o navegador recusaria
exportar. O contorno seria servir as imagens pelo nosso domínio, que é
exatamente o que a decisão proíbe.

Na impressão do navegador nada disso acontece: as imagens são carregadas pelo
aparelho de quem usa, direto da origem. O arquivo sai pelo "Salvar como PDF" do
diálogo, fica no aparelho, e não passa pelo nosso servidor nem pelo nosso banco
— que era o pedido.

**Custa um passo**: em vez de baixar direto, a pessoa escolhe "Salvar como PDF"
no diálogo. A tela diz isso, porque sem a instrução o diálogo de impressão
parece o botão errado.

## Decisão 5 — só o que falta entra na folha

Uma folha com o que a pessoa já conseguiu faria alguém oferecer carta que ela
não quer mais, que é o oposto do motivo de levar a lista.

A marca vai no topo e o X apagado ao fundo, com opacidade maior que na tela —
impresso a jato de tinta, 4% some no papel. É o tipo de ornamento que a seção 19
da especificação permite: forma própria da marca, nunca arte de franquia.

## Data

2026-09-09
