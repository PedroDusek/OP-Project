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
substitui `password_hash` por um valor inutilizável e limpa os campos de plano. A
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

## Data

2026-09-06
