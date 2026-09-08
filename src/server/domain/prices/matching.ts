/**
 * Casar um produto da fonte de preço com uma carta do nosso catálogo.
 *
 * Camada: domain. Puro: recebe nomes e números, devolve decisão.
 *
 * ## O problema
 *
 * A fonte identifica produtos por id dela, não por código Bandai. O código está
 * lá, num campo `Number` — mas **uma carta tem vários produtos**: a arte comum,
 * a paralela, a alternativa, o box topper, a versão de evento. Casar pelo número
 * sozinho daria o preço de qualquer uma delas.
 *
 * ## A regra, e por que ela falha fechado
 *
 * O que distingue os produtos é o nome, e o nome não é uniforme: sets antigos
 * escrevem `Trafalgar Law (069)`, novos escrevem só `Franky`, e alguns usam o
 * código inteiro — `Loki (OP17-119)`. O tratamento, quando existe, vem sempre
 * entre parênteses: `(Alternate Art)`, `(Parallel)`, `(Box Topper)`, `(SP)`.
 *
 * Então: tira-se o número do nome, nas duas formas que a fonte usa, e **a arte
 * comum é o produto que não sobra com nenhum parêntese**.
 *
 * ## O desempate pelo nosso próprio nome
 *
 * A regra acima erra num caso previsível: cartas cujo nome de verdade tem
 * parênteses — `Mr.1(Daz.Bonez)`, `Miss Doublefinger(Zala)`, `Zephyr(Navy)`.
 * Nenhum candidato sobra, e a carta ficaria sem preço. Eram 44 cartas, quase
 * todas agentes da Baroque Works.
 *
 * O desempate não é palpite: **o nosso catálogo sabe o nome da carta**. Quando
 * a regra dos parênteses não decide, vale o produto cujo nome, tirado o número,
 * é o nosso nome — comparado sem espaços e sem caixa, porque a fonte escreve
 * `Mr.2.Bon.Kurei (Bentham)` e `Mr.2.Bon.Kurei(Bentham)` na mesma categoria.
 *
 * Igualdade contra dado nosso, e não semelhança: `Mr.3(Galdino) (Full Art)` não
 * é igual a `Mr.3(Galdino)`, então tratamento continua de fora.
 *
 * ## O que sobra sem preço
 *
 * Medido sobre as 2.785 cartas do nosso catálogo: 2.697 com arte comum
 * identificada (96,8%). As 88 restantes são quase todas promos `P-xxx` cujos
 * únicos produtos na fonte são tratamentos — o `P-084 Buggy` só existe lá como
 * `(SP)`, `(Promo Reprint)` e as duas versões de evento. Não há arte comum à
 * venda para casar, e campo vazio é melhor que número inventado num campo de
 * dinheiro.
 *
 * Para reabrir a conta: `npx tsx scripts/cobertura-precos.ts`.
 */

export interface SourceProduct {
  productId: number
  name: string
  /** O código da carta, como a fonte informa: `OP01-002`. */
  number: string
}

/**
 * O nome sem o token do número.
 *
 * As duas formas aparecem na fonte, e às vezes na mesma coleção: `(069)` com os
 * zeros à esquerda variando, e `(OP17-119)` com o código inteiro.
 */
export function withoutNumberToken(name: string, number: string): string {
  const digits = (number.split('-')[1] ?? '').replace(/^0+/, '')

  let result = name
  if (digits) {
    result = result.replace(new RegExp(`\\(0*${digits}\\)`, 'g'), '')
  }
  return result.replace(new RegExp(`\\(${escapeForRegex(number)}\\)`, 'gi'), '').trim()
}

/** Um produto é arte comum quando, tirado o número, não sobra parêntese. */
export function isCommonArt(product: SourceProduct): boolean {
  return !/\([^)]*\)/.test(withoutNumberToken(product.name, product.number))
}

/**
 * Compara nomes ignorando caixa e espaço.
 *
 * Só isso: nem acento, nem pontuação. A fonte varia o espaço antes do
 * parêntese e a caixa entre reimpressões; o resto do nome é o mesmo texto da
 * carta, e apagar pontuação começaria a aproximar cartas diferentes.
 */
export function sameCardName(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b)
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

/**
 * A arte comum entre os produtos de um mesmo número, ou `null`.
 *
 * `null` em dois casos, e os dois significam "não sei": nenhum candidato, ou
 * mais de um. Nunca um palpite entre dois.
 *
 * `knownName` é o nome que o nosso catálogo dá à carta, quando conhecido. Ele
 * só entra quando a regra dos parênteses não decidiu — é desempate, não atalho.
 */
export function pickCommonArt(
  products: readonly SourceProduct[],
  knownName?: string | null,
): SourceProduct | null {
  const candidates = products.filter(isCommonArt)
  if (candidates.length === 1) return candidates[0]

  if (knownName) {
    const byName = products.filter((product) =>
      sameCardName(withoutNumberToken(product.name, product.number), knownName),
    )
    if (byName.length === 1) return byName[0]
  }

  return null
}

/**
 * Agrupa por número e escolhe a arte comum de cada um.
 *
 * Devolve só o que foi decidido: quem não tem resposta fica de fora, e quem
 * chama não precisa distinguir "não achei" de "achei duas".
 *
 * `knownNames` mapeia código em maiúsculas para o nome no nosso catálogo.
 */
export function commonArtByNumber(
  products: readonly SourceProduct[],
  knownNames?: ReadonlyMap<string, string>,
): Map<string, SourceProduct> {
  const byNumber = new Map<string, SourceProduct[]>()

  for (const product of products) {
    const number = product.number.trim().toUpperCase()
    if (!number) continue
    const list = byNumber.get(number)
    if (list) list.push(product)
    else byNumber.set(number, [product])
  }

  const chosen = new Map<string, SourceProduct>()
  for (const [number, list] of byNumber) {
    const common = pickCommonArt(list, knownNames?.get(number))
    if (common) chosen.set(number, common)
  }

  return chosen
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
