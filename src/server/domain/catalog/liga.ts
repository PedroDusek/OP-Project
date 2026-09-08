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
 */

const BASE = 'https://www.ligaonepiece.com.br/'

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
 * A paralela só é identificável quando a carta tem **uma**: com várias, o
 * catálogo importado não guarda o que as distingue (decisão 023 — a fonte só
 * separa Normal de Parallel), e o sufixo seria um chute.
 */
function artSuffix(variantType: string, parallelCount: number): string | null {
  if (variantType === 'Normal') return ''
  if (variantType === 'Parallel' && parallelCount === 1) return '-PAR'
  return null
}

export function ligaCardLink({
  cardCode,
  cardName,
  variantType,
  parallelCount,
}: LigaCardInput): LigaLink {
  const code = cardCode.trim()
  const edition = ligaEdition(code)
  const suffix = artSuffix(variantType, parallelCount)

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
