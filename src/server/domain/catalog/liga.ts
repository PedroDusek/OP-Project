import { isOwnSet } from './order'

/**
 * O endereço de uma carta na LigaOnePiece.
 *
 * Camada: domain. Puro: monta texto, não acessa nada.
 *
 * ## Por que só um link
 *
 * A Liga está atrás de proteção anti-bot — requisição programática recebe 403,
 * e o navegador recebe uma verificação de segurança. Ler preço de lá exigiria
 * contornar isso, que é exatamente o que a proteção existe para impedir. O
 * preço virá de outra fonte; daqui sai apenas um link, que é tráfego chegando
 * e não dado saindo.
 *
 * ## O formato
 *
 *     ?view=cards/card&card=<Nome> (<num>)&ed=<EE-NN>&num=<num>
 *
 * `num` é o código da carta, com sufixo por arte: nada para a normal, `-PAR`
 * para a paralela. `ed` sai do **código da carta**, e não do código do set —
 * `OP14-EB04` reúne cartas `OP14-…` e `EB04-…`, e o código de cada uma diz a
 * qual edição ela pertence lá.
 *
 * ## Quando não dá para ter certeza, vai para a busca
 *
 * Duas situações quebram a derivação, e as duas são comuns:
 *
 *   - **501 cartas têm mais de uma arte paralela** — até dez. `-PAR` sozinho
 *     não diz qual, e chutar levaria à arte errada.
 *   - **106 promos têm código `P-NNN`**, sem número de edição.
 *
 * Nesses casos o link vai para a busca da Liga pelo código. Cai numa lista em
 * vez da carta, mas nunca numa carta errada nem numa página que não existe.
 *
 * ## A paralela do próprio set é a `-PAR` (decisão 070)
 *
 * Conferido pelo dono do produto, carta a carta, contra a Liga: quando a carta
 * tem várias paralelas mas **uma só impressa no set do próprio código**, é essa
 * que a Liga chama de `-PAR`. As outras são de promo, PRB, starter deck.
 *
 * Vale **só nas coleções conferidas**, e não por dedução: a leitura bateu nas
 * 13 cartas da OP01, e fora dela é projeção. Nas outras coleções a carta com
 * várias paralelas continua indo para a busca até alguém conferir. Conferir uma
 * coleção nova é acrescentar a edição em `PAR_CONFERIDA`.
 */

const BASE = 'https://www.ligaonepiece.com.br/'

/**
 * As edições, no formato da Liga, em que a regra da paralela do próprio set foi
 * conferida contra o site.
 *
 * - `OP-01` — 13/09/2026, 13 cartas, todas batendo.
 */
export const PAR_CONFERIDA: ReadonlySet<string> = new Set(['OP-01'])

export interface LigaLink {
  href: string
  /** `true` leva direto à carta; `false` leva à busca pelo código. */
  exact: boolean
}

export interface LigaCardInput {
  cardCode: string
  cardName: string
  variantType: string
  /** Quantas artes paralelas esta carta tem ao todo. */
  parallelCount: number
  /** Os sets em que **esta** arte foi impressa. */
  setCodes?: readonly string[]
  /** Quantas paralelas desta carta foram impressas no set do próprio código. */
  ownSetParallelCount?: number
}

/**
 * A edição no formato da Liga, a partir do código da carta.
 *
 * `OP01-001` → `OP-01`; `EB04-012` → `EB-04`. Dois dígitos sempre, porque é
 * assim que a Liga escreve. Código sem número de edição — `P-069` — devolve
 * `null`.
 */
export function ligaEdition(cardCode: string): string | null {
  const match = /^([A-Za-z]+)(\d+)-/.exec(cardCode.trim())
  if (!match) return null

  const [, letters, digits] = match
  return `${letters.toUpperCase()}-${digits.padStart(2, '0')}`
}

/**
 * O sufixo da arte, ou `null` quando não dá para saber qual é.
 *
 * A paralela é identificável em dois casos. Quando a carta tem **uma** só. E,
 * nas edições conferidas, quando esta é a **única impressa no próprio set**
 * (decisão 070). Fora disso o catálogo importado não guarda o que distingue uma
 * paralela da outra (decisão 023), e o sufixo seria um chute.
 */
function artSuffix(input: LigaCardInput, edition: string | null): string | null {
  const { cardCode, variantType, parallelCount, setCodes = [], ownSetParallelCount = 0 } = input
  if (variantType === 'Normal') return ''
  if (variantType !== 'Parallel') return null
  if (parallelCount === 1) return '-PAR'

  const doProprioSet = setCodes.some((code) => isOwnSet(cardCode, code))
  if (edition !== null && PAR_CONFERIDA.has(edition) && doProprioSet && ownSetParallelCount === 1) {
    return '-PAR'
  }
  return null
}

export function ligaCardLink(input: LigaCardInput): LigaLink {
  const { cardCode, cardName } = input
  const code = cardCode.trim()
  const edition = ligaEdition(code)
  const suffix = artSuffix(input, edition)

  if (edition === null || suffix === null) return { href: ligaSearchLink(code), exact: false }

  const num = `${code}${suffix}`
  const query = [
    'view=cards/card',
    `card=${encode(`${cardName} (${num})`)}`,
    `ed=${encode(edition)}`,
    `num=${encode(num)}`,
  ].join('&')

  return { href: `${BASE}?${query}`, exact: true }
}

/** A busca da Liga pelo código, que serve de rede quando o direto não dá. */
export function ligaSearchLink(cardCode: string): string {
  return `${BASE}?view=cards/search&card=${encode(cardCode.trim())}`
}

/**
 * `encodeURIComponent`, e não `URLSearchParams`.
 *
 * O `URLSearchParams` escreve espaço como `+` e escaparia a barra de
 * `cards/card`. O endereço da Liga usa `%20` e barra literal, então o texto é
 * montado à mão para sair idêntico ao que o site produz.
 */
function encode(value: string): string {
  return encodeURIComponent(value)
}
