# Design System

Como a especificação oficial de marca vira código.

A fonte é
`docs/marca/COLEXA_Especificacao_Oficial_UI_Design_Marca_v1.2.docx`, aprovado
como baseline em 06/09/2026. Este documento não decide nada por conta própria:
ele registra o que veio de lá, o que foi derivado, e por qual regra.

As telas em `docs/referencia-telas/` são **referência de layout e navegação**.
A seção 21 do documento oficial diz que elas são material de trabalho e não
fazem parte do sistema de marca; onde discordarem do documento, o documento
vence. Já discordaram uma vez: os mockups usam um índigo `#4645FC` em botões e
chips, que não é cor da marca.

---

## 1. Cores

### 1.1 As seis oficiais

Três tokens, dois temas. Não alterar sem revisão da identidade.

| Token | Claro | Escuro |
|---|---|---|
| Fundo | `#F2F2F3` | `#131219` |
| Roxo (ênfase) | `#38287B` | `#504797` |
| Texto | `#000000` | `#FFFFFF` |

**O roxo muda entre os temas.** `#504797` não é `#38287B` clareado por filtro: é
mais claro e menos saturado, para manter contraste sobre o fundo escuro. São dois
valores independentes, e nenhuma regra de CSS deriva um do outro.

O roxo é "ênfase, ações e identidade" — é o mesmo roxo no logotipo, no botão
primário, no chip selecionado e no item ativo da navegação.

### 1.2 Os derivados

A interface precisa de mais que três cores: card branco sobre fundo cinza,
borda, texto secundário, verde de playset completo, vermelho de exclusão. Nada
disso está no documento oficial, então cada um tem uma regra escrita:

| Token | Regra | Claro | Escuro |
|---|---|---|---|
| `surface` | superfície de card, um passo acima do fundo | `#FFFFFF` | `#1C1B24` |
| `surface-muted` | preenchimento discreto | `#EBEBED` | `#26242F` |
| `border` | texto a 10% no claro, 12% no escuro | `rgb(0 0 0 / .10)` | `rgb(255 255 255 / .12)` |
| `border-strong` | borda de controle desligado | `rgb(0 0 0 / .22)` | `rgb(255 255 255 / .26)` |
| `text-muted` | apoio | `rgb(0 0 0 / .62)` | `rgb(255 255 255 / .66)` |
| `text-subtle` | legenda e metadado | `rgb(0 0 0 / .55)` | `rgb(255 255 255 / .48)` |
| `accent-ink` | a ênfase quando é **tinta** — ver 1.3 | `#38287B` | `#9990E0` |
| `accent-hover` | ênfase um passo mais escura no claro, mais clara no escuro | `#2C1F63` | `#635AAD` |
| `accent-soft` | ênfase como fundo de estado selecionado | ênfase a 9% | ênfase a 28% |
| `accent-contrast` | texto sobre a ênfase preenchida | `#FFFFFF` | `#FFFFFF` |
| `success` | playset completo, troca concluída | `#146C43` | `#59D09A` |
| `danger` | remover, excluir, sair | `#A5271F` | `#F08C85` |
| `warning` | atenção, confirmação pendente | `#7A5300` | `#E5B25C` |

As três cores semânticas — sucesso, perigo e atenção — **não vêm do documento
oficial**. Foram escolhidas neutras e discretas, de acordo com o posicionamento
"premium, minimalista, não gamer" da seção 1, e medidas contra a superfície de
cada tema. Se o dono do produto quiser outros valores, é uma linha por tema em
`globals.css`, e nenhum componente muda.

Nenhuma delas comunica sozinha (seção 18): todo estado que usa cor também
carrega texto ou ícone.

### 1.3 A ênfase preenchida e a ênfase como tinta

O roxo oficial tem dois papéis, e no tema escuro eles **não** podem ser a mesma
cor:

| Papel | Claro | Escuro |
|---|---|---|
| Preenchimento — botão primário, avatar, switch ligado | `#38287B`, texto branco a 11.9:1 | `#504797`, texto branco a 7.8:1 |
| Tinta — navegação ativa, chip selecionado, badge, ícone | `#38287B` sobre superfície: 11.9:1 | `#504797` sobre superfície: **2.18:1** |

O `#504797` foi feito para **receber** texto branco por cima, não para ser o
texto. Sobre `accent-soft` ele cai para 1.82:1, que é praticamente invisível.

Daí o token `accent-ink`: no claro é o próprio roxo oficial; no escuro é um
clareamento da mesma matiz, `#9990E0`, medido em todas as superfícies onde
aparece — 6.0:1 sobre `surface`, 5.0:1 sobre `accent-soft`, 6.6:1 sobre o fundo.

O logotipo continua usando `accent` exato nos dois temas. Marca não se corrige
por contraste, e a WCAG isenta logotipos.

### 1.4 Contraste é medido, não estimado

`tests/components/contrast.test.ts` lê os tokens do próprio `globals.css`,
compõe as cores com alfa sobre a superfície real e verifica 4.5:1 para texto e
3:1 para gráfico e anel de foco. Ele lê o CSS em vez de repetir os valores num
objeto: uma cópia em TypeScript passaria a divergir no dia em que alguém
ajustasse um tom, e o teste continuaria verde medindo a paleta antiga.

Ele já pegou dois problemas neste checkpoint:

- `text-subtle` claro estava a 45% de preto — 3.35:1, abaixo do mínimo. Subiu
  para 55%, que dá 4.76:1 sobre a superfície e 4.63:1 sobre o fundo da página.
- `accent` como tinta no tema escuro, o caso de 1.3.

O mesmo arquivo trava as seis cores oficiais: mudar qualquer uma quebra a suíte,
porque a restrição de marca é "não alterar sem revisão da identidade".

### 1.5 Por que não existe `dark:` neste projeto

Os tokens são **semânticos** e já carregam os dois valores, com `light-dark()`.
Um componente escreve `bg-accent` e está certo nos dois temas; nenhum precisa
saber que existe tema escuro.

A alternativa seria repetir a lista inteira de tokens em
`@media (prefers-color-scheme: dark)` e de novo em `[data-theme="dark"]` — três
cópias da mesma lista, e nada impedindo que uma mude sem as outras. Ver a
decisão 027.

---

## 2. Tema

Três estados, não dois:

| Estado | `<html data-theme>` | Efeito |
|---|---|---|
| Sistema (padrão) | ausente | `color-scheme: light dark` segue o sistema operacional |
| Claro | `light` | `color-scheme: light` |
| Escuro | `dark` | `color-scheme: dark` |

"Sistema" é um estado de verdade, não "claro por enquanto". Um interruptor de
duas posições tira a pessoa de "sistema" no primeiro toque e nunca a deixa
voltar.

A escolha vive no `localStorage`, sob a chave `colexa:theme`, porque é
preferência **de dispositivo**: a mesma pessoa pode querer escuro no celular e
claro no desktop. Guardar no banco exigiria uma coluna que não está aprovada, e
daria a resposta errada para esse caso.

Um script síncrono no `<head>` aplica a escolha antes da primeira pintura. Sem
ele, quem escolheu escuro num sistema claro veria a página branca até o React
hidratar. `useEffect` não resolve: por definição roda depois da pintura.

Com o app aberto em duas abas, trocar o tema numa atualiza a outra: o provedor
assina o evento `storage` via `useSyncExternalStore`.

---

## 3. Forma e espaço

Direto da seção 3.4:

| Elemento | Valor | Token |
|---|---|---|
| Grid | múltiplos de 4 px; escala 4/8/12/16/24/32 | escala padrão do Tailwind |
| Controles | raio 10 px (faixa 8–12) | `rounded-control` |
| Cards | raio 14 px (faixa 12–16) | `rounded-card` |
| Sheets | raio 20 px (faixa 16–24) | `rounded-sheet` |
| Alvo de toque | mínimo 44 × 44 px | `h-11` / `size-11` |
| Sombra | sutil | `shadow-card`, `shadow-raised`, `shadow-sheet` |
| Borda | 1 px discreta | `border-border` |

O tamanho `sm` de botão tem 36 px e **não serve para ação principal no
celular**. Existe para botão dentro de linha de lista no desktop, onde o
ponteiro tem precisão. A regra de 44 px vale para o dedo.

---

## 4. Tipografia

Seção 3.3: sans-serif moderna, geométrica ou neo-grotesca, com fallback seguro.

Escolhida a **Geist**, neo-grotesca, carregada por `next/font`, com fallback
para a pilha do sistema. Uma família só; peso e tamanho fazem a hierarquia.

| Uso | Classe |
|---|---|
| Título de página | `text-2xl font-bold` |
| Título de seção | `text-lg font-semibold` |
| Corpo | `text-base` |
| Apoio | `text-sm text-text-muted` |
| Legenda | `text-xs text-text-subtle` |

Todo número que se compara ou se atualiza usa `tabular-nums`, para os dígitos
não dançarem entre 999 e 1.000.

---

## 5. Componentes

`src/components/`, divididos por o que sabem:

| Pasta | O que vive lá |
|---|---|
| `ui/` | primitivos sem domínio: botão, campo, chip, sheet, toast |
| `layout/` | shell, barra superior, navegação inferior e lateral |
| `brand/` | símbolo e logotipo |
| `theme/` | provedor e controle de tema |
| `catalog/`, `collection/`, `storage/`, `trade/` | componentes que conhecem o vocabulário do domínio |

Os treze componentes da seção 15 do documento oficial e onde estão:

| Documento | Arquivo |
|---|---|
| Card de carta / Variant Card | `catalog/card-tile.tsx` |
| Quantity Selector | `ui/quantity-selector.tsx` |
| Filter Chip | `ui/chip.tsx` |
| Filter Sheet | `ui/filter-sheet.tsx` |
| Search Bar | `ui/search-bar.tsx` |
| Progress Bar | `ui/progress-bar.tsx` |
| Storage Card | `storage/storage-card.tsx` |
| Trade Item | `trade/trade-item.tsx` |
| Status Badge | `ui/badge.tsx` |
| Bottom Navigation | `layout/bottom-nav.tsx` |
| Modal / Bottom Sheet | `ui/sheet.tsx`, `ui/confirm-dialog.tsx` |
| Toast | `ui/toast.tsx` |

**Nenhum componente calcula regra de negócio** (`architecture.md` 2.1). O
`ProgressBar` recebe `value` e `total` e não decide o que conta como progresso;
o `StatTile` recebe o número já formatado. Todo número exibido é calculado no
servidor.

### 5.1 Radix

Sheet, dialog de confirmação, switch e select usam Radix (stack aprovada em
`architecture.md` 1). O que se ganha é o comportamento que quase ninguém escreve
inteiro à mão: foco preso dentro do painel, foco devolvido ao elemento que
abriu, `Esc` para fechar, rolagem do fundo travada, resto da página inerte para
o leitor de tela, e o teclado completo do `<select>` nativo.

---

## 6. Os oito estados obrigatórios

Seção 17. Onde cada um mora:

| Estado | Onde |
|---|---|
| Loading | `Skeleton`, `CardGridSkeleton`, `loading` do `Button` |
| Empty | `EmptyState` — explica o vazio **e** aponta a próxima ação |
| Error | `ErrorState` com `role="alert"` e nova tentativa quando possível |
| Success | `Toast` |
| Disabled | `disabled` real, nunca só opacidade |
| Confirmation | `ConfirmDialog`, obrigatório em ação destrutiva |
| Unsaved | pertence às telas de formulário; chega com elas |
| Bulk | prévia → confirmação → transação → resultado; chega com a edição em massa |

---

## 7. Acessibilidade

Seção 18, e o que cada item virou:

- **Contraste** — verificado por teste, não por estimativa. Ver 1.4.
- **Não comunicar só por cor** — chip selecionado tem `aria-pressed` e opção de
  confere; navegação ativa tem `aria-current`, peso de fonte e cor; badge de
  status escreve o estado por extenso.
- **Alvos de 44 px** — botões, itens de navegação, linhas de lista e passos de
  quantidade.
- **Foco visível** — `:focus-visible` global com anel na cor de ênfase, e não
  `:focus`, para o anel não aparecer a cada clique de mouse.
- **Labels acessíveis** — `Field` liga `<label htmlFor>`, `aria-describedby` e
  `aria-invalid`; `IconButton` exige `label`, sem valor padrão.
- **Alt text** — `CardTile` compõe `"OP01-001 — Roronoa Zoro"`; a imagem só é
  decorativa onde o código aparece escrito ao lado.
- **Pular para o conteúdo** — primeiro elemento focável do shell.

---

## 8. Responsividade

Um layout, três tamanhos (`architecture.md` 4.1):

| Faixa | Navegação | Grade de cartas |
|---|---|---|
| base, a partir de 360 px | barra inferior fixa | 3 colunas |
| `md`, 768 px | coluna lateral só com ícones | 4 colunas |
| `lg`, 1024 px | coluna lateral com rótulos | 6 colunas |
| `xl` | idem | 8 colunas |

As duas navegações existem no HTML — é assim que um layout único atende os três
tamanhos — mas só uma chega à árvore de acessibilidade em cada largura, porque a
escondida sai junto com o `display: none`.

Isso é verificado em navegador de verdade, não em jsdom: `tests/e2e/responsive.spec.ts`
mede as três larguras, confirma que existe exatamente uma navegação visível em
cada uma, e que nenhuma página rola na horizontal a 360 px.

---

## 9. Guia de estilo

`/design-system` mostra todos os componentes em uma tela, nos dois temas.

Existe para o que teste automatizado não faz: alguém olhar. Se o roxo ficou
pesado num botão, se o contraste do texto secundário cai no tema escuro, ou se
dois componentes discordam do mesmo raio, quem percebe é o olho — e só se todos
estiverem juntos.

Fica fora da navegação e fora dos buscadores. **Antes de publicar o produto,
decidir se ela continua acessível precisa ser uma escolha consciente.**

Os exemplos usam dados fictícios e nenhuma imagem de carta: a seção 19 proíbe
arte de franquia como decoração, e um guia de estilo é decoração por definição.

---

## 10. Propriedade intelectual

Seção 19, regra obrigatória, que restringe toda tela daqui para frente:

> A interface não usa personagens, cenas, páginas de mangá, logos de franquias
> ou ilustrações de terceiros como decoração. A arte de franquia aparece somente
> dentro da própria imagem da carta catalogada.

Consequências práticas:

- Sem personagem no splash, sem mangá de fundo, sem logo do One Piece como marca.
- Capa de set, avatar e ilustração de estado vazio usam formas próprias.
- A imagem da carta é **referenciada na origem e nunca copiada** — o que também
  significa não passar pelo otimizador do `next/image`. Ver a decisão 026.
