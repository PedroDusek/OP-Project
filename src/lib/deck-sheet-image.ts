import {
  ACCENT,
  CARD_RATIO,
  INK,
  LINE,
  MUTED,
  PAPER,
  PLACEHOLDER,
  SHEET_WIDTH,
  drawFooter,
  drawLogotype,
  drawWatermark,
  ellipsis,
  loadImage,
  roundedPath,
  toBlob,
} from './sheet-canvas'

/**
 * A decklist como uma imagem, para mandar no grupo (pedido do dono do produto
 * em 23/11).
 *
 * Irmã da folha da want list, e a mecânica é a mesma — `sheet-canvas.ts`. O que
 * muda é a forma, e cada diferença responde a uma pergunta diferente.
 *
 * ## Uma imagem só, e aqui isso cabe
 *
 * A want list recusa a imagem única de propósito: cem cartas dariam mais de
 * sete mil pixels de altura, e o WhatsApp recomprime com força justamente o
 * número no canto, que é o dado que a folha carrega.
 *
 * **A decklist não tem esse problema**, e não é por descuido: são cinquenta
 * cartas em **cerca de quinze a vinte linhas distintas**, porque uma decklist
 * repete a mesma carta até quatro vezes e aqui ela é uma linha com `4x`. Uma
 * lista de dezessete linhas dá seis fileiras de quatro e **2.966 px** medidos,
 * contra os mais de sete mil que a want list recusa. E a
 * lista partida ao meio seria pior que a want list partida: metade de uma
 * decklist não é uma decklist.
 *
 * ## O líder em cima, e o resto numa fila só
 *
 * A ordem continua sendo a que quem joga lê — personagens, eventos, stages, e
 * dentro de cada grupo por custo —, mas **sem dizer isso em voz alta**.
 *
 * A primeira versão escrevia "Personagens · 37", "Eventos · 11", "Stages · 2".
 * O dono do produto tirou em 23/11: cada título custa uma linha, e cada grupo
 * que termina no meio de uma fileira deixa o resto dela vazio. Numa lista de
 * quinze linhas isso era duas fileiras inteiras gastas para nomear o que a
 * própria carta já diz — o tipo está escrito nela.
 *
 * O líder continua separado, e esse vale a linha: ele é a identidade do deck,
 * e misturá-lo na fila o esconderia entre cinquenta iguais.
 *
 * ## O DON!! não entra
 *
 * A referência tem um quadro de DON!! no fim. A nossa decklist é líder mais
 * cinquenta, e o DON!! não faz parte dela — desenhá-lo seria um enfeite fixo,
 * que não sai de dado nenhum, numa imagem que existe para alguém copiar.
 * Decisão do dono do produto em 23/11.
 *
 * ## Um selo só, e embaixo
 *
 * As cópias, no canto de baixo à direita. Nada mais.
 *
 * A primeira versão seguia a referência ao pé da letra: custo num selo preto
 * em cima à esquerda, cópias em cima à direita. **Os dois cobriam o que a
 * carta já diz** — o canto de cima é onde a arte traz custo e poder, e isso já
 * nos custou um ajuste no Deck Builder. O preto era pior: tampava o custo
 * impresso para escrever o mesmo número de novo.
 *
 * O dono do produto olhou a folha e perguntou o que eram aqueles números —
 * que é a resposta sobre eles. O preto saiu em 23/11 e o roxo desceu. No
 * OPLAY os dois selos se pagam porque o quadro é pequeno e a carta aparece
 * cortada; aqui a carta inteira está à mostra, legível.
 *
 * **Embaixo à direita é onde a folha da want list já põe o número dela**, e
 * pelo mesmo motivo: ali o selo não come a ilustração que faz a carta ser
 * reconhecida de relance. O custo não se perde — continua ordenando a seção,
 * que é o que ele faz de útil numa lista.
 *
 * E **não** há nada sobre o que a pessoa tem ou deixa de ter. Isto é a lista,
 * não a coleção: quem recebe a imagem não precisa saber o que falta a quem
 * mandou (decisão do dono do produto em 23/11).
 */

export interface DeckSheetCard {
  cardCode: string
  cardName: string
  /** O tipo como a fonte escreve: `Leader`, `Character`, `Event`, `Stage`. */
  type: string
  cost: number | null
  copies: number
  /**
   * Uma imagem que o `canvas` pode exportar — a nossa arte guardada, de mesma
   * origem. Nula quando não há: a carta sai com o código no lugar da arte.
   */
  sheetImageUrl: string | null
}

export interface DeckSheet {
  name: string
  leader: DeckSheetCard & { colors: readonly string[] }
  cards: readonly DeckSheetCard[]
}

const WIDTH = SHEET_WIDTH
const COLUMNS = 4
const GAP = 24
const PADDING = 48
const HEADER = 150
const FOOTER = 64
const CAPTION = 46
/** O título de cada seção, e o ar que ele pede acima. */
const SECTION = 58

/** A ordem dos tipos na fila, como quem joga lê uma lista. */
const ORDEM_DOS_TIPOS = ['Character', 'Event', 'Stage']

interface Secao {
  /** `null` na fila do deck: ela não se anuncia. */
  titulo: string | null
  cartas: DeckSheetCard[]
}

/** Por custo, e o código desempata: duas de custo 4 saem na ordem da coleção. */
function porCusto(a: DeckSheetCard, b: DeckSheetCard): number {
  const custoA = a.cost ?? Number.MAX_SAFE_INTEGER
  const custoB = b.cost ?? Number.MAX_SAFE_INTEGER
  return custoA - custoB || a.cardCode.localeCompare(b.cardCode)
}

/**
 * Duas: o líder, e o deck.
 *
 * A fila do deck sai ordenada por tipo e, dentro do tipo, por custo — sem
 * nenhuma quebra entre eles, que é o que economiza espaço.
 *
 * Um tipo que a fonte traga e que não esteja previsto **não some**: vai para o
 * fim da fila, junto dos outros imprevistos, em ordem de tipo. Sumir seria
 * entregar uma decklist incompleta sem ninguém ver — o mesmo princípio da carta
 * sem vínculo na folha da want list.
 */
export function deckSections(deck: DeckSheet): Secao[] {
  const posicao = (tipo: string) => {
    const i = ORDEM_DOS_TIPOS.indexOf(tipo)
    return i === -1 ? ORDEM_DOS_TIPOS.length : i
  }

  const fila = [...deck.cards].sort(
    (a, b) =>
      posicao(a.type) - posicao(b.type) ||
      // Dois tipos imprevistos entre si: pelo nome, para a ordem ser estavel.
      a.type.localeCompare(b.type) ||
      porCusto(a, b),
  )

  return [
    { titulo: 'Líder', cartas: [deck.leader] },
    ...(fila.length > 0 ? [{ titulo: null, cartas: fila }] : []),
  ]
}

/** A altura que a imagem terá, a partir das seções. Exportada para o teste. */
export function sheetHeight(secoes: readonly Secao[], cardHeight: number): number {
  const corpo = secoes.reduce((total, secao, indice) => {
    const linhas = Math.ceil(secao.cartas.length / COLUMNS)
    return (
      total +
      // O ar entre uma secao e a seguinte. Vinha de graca do titulo enquanto
      // havia um por tipo; sem ele, a legenda do lider encostava na primeira
      // fileira do deck — visto no navegador em 23/11.
      (indice === 0 ? 0 : GAP) +
      (secao.titulo === null ? 0 : SECTION) +
      linhas * (cardHeight + CAPTION) +
      Math.max(0, linhas - 1) * GAP
    )
  }, 0)
  return HEADER + corpo + FOOTER + PADDING
}

export function cardWidthFor(): number {
  return Math.floor((WIDTH - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS)
}

export async function renderDeckSheet(deck: DeckSheet): Promise<Blob> {
  const cardWidth = cardWidthFor()
  const cardHeight = Math.round(cardWidth * CARD_RATIO)
  const secoes = deckSections(deck)
  const height = sheetHeight(secoes, cardHeight)

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Este navegador não conseguiu preparar a imagem.')

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, WIDTH, height)

  await drawWatermark(ctx, WIDTH, height)
  await drawHeader(ctx, deck)

  /*
   * Todas as imagens de uma vez, e nenhuma pode derrubar a folha: quem falhar
   * vira o espaço reservado com o código. Uma carta fora do ar não é motivo
   * para a pessoa ficar sem a lista.
   */
  const todas = secoes.flatMap((s) => s.cartas)
  const imagens = await Promise.all(todas.map((c) => loadImage(c.sheetImageUrl)))
  const porCarta = new Map(todas.map((carta, i) => [carta, imagens[i]]))

  let y = HEADER
  for (const [indice, secao] of secoes.entries()) {
    if (indice > 0) y += GAP
    y = drawSectionTitle(ctx, secao, y)

    secao.cartas.forEach((carta, index) => {
      const coluna = index % COLUMNS
      const linha = Math.floor(index / COLUMNS)
      const x = PADDING + coluna * (cardWidth + GAP)
      const topo = y + linha * (cardHeight + CAPTION + GAP)
      drawCard(ctx, carta, porCarta.get(carta) ?? null, x, topo, cardWidth, cardHeight)
    })

    const linhas = Math.ceil(secao.cartas.length / COLUMNS)
    y += linhas * (cardHeight + CAPTION) + Math.max(0, linhas - 1) * GAP
  }

  drawFooter(ctx, WIDTH, height, PADDING)

  return toBlob(canvas)
}

/** O título da seção, quando ela tem um. Devolve onde a grade começa. */
function drawSectionTitle(ctx: CanvasRenderingContext2D, secao: Secao, y: number): number {
  if (secao.titulo === null) return y

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = '700 26px system-ui, sans-serif'
  ctx.fillText(secao.titulo, PADDING, y + 28)

  return y + SECTION
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  carta: DeckSheetCard,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const radius = 10

  /*
   * A pilha atrás da carta com mais de uma cópia, como na referência: diz
   * "tem mais de uma" sem ocupar espaço nem depender de ler o número. Uma
   * camada só — duas viram sujeira numa imagem que já é recomprimida.
   */
  if (carta.copies > 1) {
    ctx.save()
    ctx.fillStyle = LINE
    roundedPath(ctx, x + 7, y - 7, width, height, radius)
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  roundedPath(ctx, x, y, width, height, radius)
  ctx.clip()

  if (image) {
    ctx.drawImage(image, x, y, width, height)
  } else {
    ctx.fillStyle = PLACEHOLDER
    ctx.fillRect(x, y, width, height)
    ctx.fillStyle = MUTED
    ctx.font = `600 ${Math.round(width / 9)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(carta.cardCode, x + width / 2, y + height / 2, width - 16)
  }
  ctx.restore()

  if (carta.copies > 1) {
    const selo = Math.round(width / 4.6)
    drawBadge(ctx, `${carta.copies}x`, x + width - 8, y + height - selo - 8, selo, ACCENT)
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = INK
  ctx.font = `600 ${Math.round(width / 13)}px system-ui, sans-serif`
  ctx.fillText(carta.cardCode, x, y + height + 8, width)

  ctx.fillStyle = MUTED
  ctx.font = `400 ${Math.round(width / 14)}px system-ui, sans-serif`
  ctx.fillText(ellipsis(ctx, carta.cardName, width), x, y + height + 26, width)
}

/**
 * Um selo arredondado com texto centrado, ancorado pela borda **direita**.
 *
 * Pela direita porque é lá que ele mora, e porque a largura depende do texto:
 * `4x` e `10x` não ocupam o mesmo, e ancorar pela esquerda deixaria a borda
 * direita dançando de carta para carta.
 */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  texto: string,
  direita: number,
  y: number,
  altura: number,
  fundo: string,
): void {
  const fonte = Math.round(altura * 0.56)
  ctx.font = `700 ${fonte}px system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  const largura = Math.max(altura, ctx.measureText(texto).width + altura * 0.6)
  const esquerda = direita - largura

  ctx.fillStyle = fundo
  roundedPath(ctx, esquerda, y, largura, altura, 8)
  ctx.fill()

  ctx.fillStyle = PAPER
  ctx.fillText(texto, esquerda + (largura - ctx.measureText(texto).width) / 2, y + altura / 2)
}

async function drawHeader(ctx: CanvasRenderingContext2D, deck: DeckSheet): Promise<void> {
  const copias = deck.cards.reduce((total, c) => total + c.copies, 0)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = '700 40px system-ui, sans-serif'
  /* O nome pode ser qualquer coisa que a pessoa digitou: corta, não transborda. */
  ctx.fillText(ellipsis(ctx, deck.name, WIDTH - PADDING * 2 - 220), PADDING, 68)

  ctx.fillStyle = MUTED
  ctx.font = '400 22px system-ui, sans-serif'
  const cores = deck.leader.colors.join(' e ')
  const linha =
    `${deck.leader.cardName} · ${copias} ${copias === 1 ? 'carta' : 'cartas'}` +
    (cores ? ` · ${cores}` : '')
  ctx.fillText(ellipsis(ctx, linha, WIDTH - PADDING * 2 - 220), PADDING, 102)

  await drawLogotype(ctx, WIDTH - PADDING, 44, 34)

  ctx.strokeStyle = LINE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PADDING, HEADER - 32)
  ctx.lineTo(WIDTH - PADDING, HEADER - 32)
  ctx.stroke()
}
