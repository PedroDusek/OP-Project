/**
 * O endereço de uma carta na LigaOnePiece.
 *
 * Camada: domain. Puro: monta e lê texto, não acessa nada.
 *
 * ## Por que só um link
 *
 * A Liga está atrás de proteção anti-bot — requisição programática recebe 403,
 * e o navegador recebe uma verificação de segurança. Ler preço de lá exigiria
 * contornar isso, que é exatamente o que a proteção existe para impedir. O
 * preço virá de outra fonte; daqui sai apenas um link, que é tráfego chegando
 * e não dado saindo (decisão 047).
 *
 * Pelo mesmo motivo **o sistema não descobre** como a Liga cadastrou uma carta:
 * quem descobre é gente, abrindo o site. O que ela confere vira a tabela de
 * `data/liga-cartas.json`.
 *
 * ## De onde sai o link (decisão 071)
 *
 *   1. **A arte está na tabela** — vale o endereço conferido, exatamente como a
 *      Liga o produziu. `null` na tabela é "conferido: não existe página", e vai
 *      para a busca.
 *   2. **Arte normal** fora da tabela — o endereço é montado sem sufixo. É a
 *      escolha do dono do produto, conferida por amostra de raridade coleção a
 *      coleção; a exceção que aparecer entra na tabela e vence a montagem.
 *   3. **Qualquer outra arte** — vai para a busca.
 *
 * A paralela **nunca** tem o sufixo deduzido. A 047 dava `-PAR` a toda carta com
 * uma paralela só, e isso errava de dois jeitos: a `OP01-004_p1` só existe na
 * PROMO e ganhava `OP01-004-PAR`, que é outra arte; e a Liga não usa o mesmo
 * sufixo em toda coleção — na OP02 aparece `-E`. Medido: 158 paralelas apontavam
 * para arte de outro produto.
 *
 * ## O formato montado
 *
 *     ?view=cards/card&card=<Nome> (<num>)&ed=<EE-NN>&num=<num>
 *
 * `ed` sai do **código da carta**, e não do código do set — `OP14-EB04` reúne
 * cartas `OP14-…` e `EB04-…`, e o código de cada uma diz a qual edição ela
 * pertence lá.
 */

import { isDonCode } from './don'

const BASE = 'https://www.ligaonepiece.com.br/'
const HOST = 'www.ligaonepiece.com.br'

export interface LigaLink {
  href: string
  /** `true` leva direto à carta; `false` leva à busca pelo código. */
  exact: boolean
}

export interface LigaCardInput {
  cardCode: string
  cardName: string
  variantType: string
  /**
   * O que a tabela conferida diz desta arte: o endereço, `null` para "não existe
   * página na Liga", ou `undefined` quando ainda não foi conferida.
   */
  verified?: string | null
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

export function ligaCardLink({ cardCode, cardName, variantType, verified }: LigaCardInput): LigaLink {
  const code = cardCode.trim()

  /*
   * DON!!: toda busca vai pelo **nome**, e nunca pelo codigo (decisao 112).
   *
   * O codigo dele e inventado por nos — `DON-482236`, do productId do
   * TCGplayer — e nao existe na Liga. Uma busca por ele nao acha nada, e um
   * "Ver na Liga" que cai no vazio e pior que nenhum link.
   *
   * O termo e escolhido **antes** de olhar a tabela, e nao depois: `verified`
   * nulo quer dizer "conferido: nao existe pagina", e tambem cai na busca. Com
   * a escolha feita depois, esse caminho procurava pelo codigo inventado — o
   * proprio teste que eu escrevi para ele passou sem notar, porque so conferia
   * que a busca era uma busca.
   */
  const termoDaBusca = isDonCode(code) ? cardName : code

  if (verified !== undefined) {
    return verified === null
      ? { href: ligaSearchLink(termoDaBusca), exact: false }
      : { href: verified, exact: true }
  }

  if (isDonCode(code)) return { href: ligaSearchLink(termoDaBusca), exact: false }

  const edition = ligaEdition(code)
  if (variantType !== 'Normal' || edition === null) {
    return { href: ligaSearchLink(termoDaBusca), exact: false }
  }

  const query = [
    'view=cards/card',
    `card=${encode(`${cardName} (${code})`)}`,
    `ed=${encode(edition)}`,
    `num=${encode(code)}`,
  ].join('&')

  return { href: `${BASE}?${query}`, exact: true }
}

/** A busca da Liga pelo código, que serve de rede quando o direto não dá. */
export function ligaSearchLink(cardCode: string): string {
  return `${BASE}?view=cards/search&card=${encode(cardCode.trim())}`
}

/** O que se lê de um endereço de carta da Liga. */
export interface ParsedLigaUrl {
  /** O endereço como foi colado, sem espaço em volta: é ele que vira o link. */
  url: string
  /** A edição como a Liga escreve: `OP-01`. */
  ed: string
  /** O código interno da Liga: `OP01-001-PAR`. */
  num: string
}

/**
 * Lê um endereço de carta da Liga, ou devolve o motivo de não ser um.
 *
 * Confere só a forma — host, `view=cards/card`, `ed` e `num` presentes. Se a
 * página existe e é a arte certa, só quem abriu sabe.
 *
 * Recusa o endereço colado duas vezes seguidas. Ele passa por endereço válido —
 * o segundo vai inteiro para dentro do `num` — e entrou assim na conferência de
 * 15/09, na `OP06-093_p5`: o link abria uma página que não existe.
 */
export function parseLigaUrl(text: string): ParsedLigaUrl | { error: string } {
  const url = text.trim()
  if (url.indexOf('://') !== url.lastIndexOf('://')) {
    return { error: 'O endereço parece ter sido colado duas vezes. Cole só um.' }
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { error: 'Não é um endereço.' }
  }

  if (parsed.hostname !== HOST) return { error: `O endereço não é da Liga (${HOST}).` }
  if (parsed.searchParams.get('view') !== 'cards/card') {
    return { error: 'O endereço não é da página de uma carta (view=cards/card).' }
  }

  const ed = parsed.searchParams.get('ed')?.trim()
  const num = parsed.searchParams.get('num')?.trim()
  if (!ed) return { error: 'O endereço não tem a edição (ed).' }
  if (!num) return { error: 'O endereço não tem o código da carta (num).' }

  return { url, ed, num }
}

/**
 * O sufixo que a Liga pôs depois do código: `OP01-001-PAR` → `PAR`,
 * `OP02-004-E` → `E`, `OP01-001` → vazio.
 *
 * `null` quando o `num` não começa pelo código da carta — a Liga cadastrou a
 * arte com outro código, ou o endereço colado é de outra carta. A tela mostra;
 * não recusa, porque cadastrar com outro código pode ser justamente o que a Liga
 * faz com uma promo.
 */
export function ligaSuffix(num: string, cardCode: string): string | null {
  const n = num.trim().toUpperCase()
  const code = cardCode.trim().toUpperCase()
  if (n === code) return ''
  if (n.startsWith(`${code}-`)) return n.slice(code.length + 1)
  return null
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
