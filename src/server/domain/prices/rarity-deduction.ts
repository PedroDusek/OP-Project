/**
 * Casar as nossas paralelas com os produtos da fonte, quando dá para deduzir.
 *
 * Camada: domain. Puro.
 *
 * ## O caso sem escolha, e um sinal a mais
 *
 * A decisão 053 vincula só quando não há escolha: uma paralela nossa e uma arte
 * na fonte. Com duas de cada lado, saber qual é a *Alternate Art* e qual é a
 * *Manga* é olho humano, e chutar poria o preço de uma arte na outra.
 *
 * Mas em parte desses casos o dado já responde (decisão 068, aprovada pelo dono
 * do produto). Nós temos a **raridade** de cada paralela; a fonte tem o
 * **tratamento** de cada produto. Duas correspondências não deixam dúvida:
 *
 * | nossa raridade | tratamento na fonte |
 * |---|---|
 * | `SP CARD` | `SP` |
 * | `TR` | `TR` |
 *
 * Quando só uma paralela nossa é `SP CARD` e só um produto é `SP`, os dois são a
 * mesma arte — não por semelhança, mas porque não existe outro candidato. Casados
 * esses, se sobrar exatamente uma de cada lado, ela também casa: é o mesmo caso
 * sem escolha da 053, alcançado depois da eliminação.
 *
 * Em `EB03-003`: nós `SR | SP CARD`, a fonte `Alternate Art | SP`. A `SP CARD` é
 * o `SP`, e a `SR` que sobra é a `Alternate Art`.
 *
 * ## O que fica de fora, de propósito
 *
 * `SP + Gold` e `SP + Silver` não casam com `SP CARD`: são duas artes SP da mesma
 * carta, e aí a raridade não distingue uma da outra. Igualdade exata do rótulo,
 * e não "começa com SP" — no campo de dinheiro, casar pelo parecido é o erro que
 * este módulo existe para não cometer.
 *
 * Medido em 10/09/2026, sobre as 350 cartas ambíguas: resolve 52 inteiras e 42 em
 * parte, 146 variantes. O resto continua precisando de olho humano, pelo
 * mapeamento manual.
 */

/** Uma paralela nossa ainda sem vínculo. */
export interface OurArt {
  variantId: string
  rarity: string | null
}

/** Um produto da fonte que é outra arte da carta, ainda sem dono. */
export interface SourceArt {
  productId: string
  /** O tratamento, como a fonte escreve: `Alternate Art`, `SP`, `SP + Gold`. */
  label: string
}

export interface ArtPair {
  variantId: string
  productId: string
}

export interface ArtDeduction {
  pairs: ArtPair[]
  /** Quantos dos pares vieram da raridade, e não do caso uma-de-cada-lado. */
  viaRarity: number
  /** O que sobrou sem par, dos dois lados. É o que vai para o olho humano. */
  leftoverOurs: OurArt[]
  leftoverTheirs: SourceArt[]
}

/** Raridade nossa e o tratamento da fonte que só ela pode ser. */
const CORRESPONDENCIAS: readonly (readonly [rarity: string, label: string])[] = [
  ['SP CARD', 'SP'],
  ['TR', 'TR'],
]

const norm = (value: string | null): string => (value ?? '').trim().toUpperCase()

export function deduceArtPairs(
  ours: readonly OurArt[],
  theirs: readonly SourceArt[],
): ArtDeduction {
  let restoNosso = [...ours]
  let restoDaFonte = [...theirs]
  const pairs: ArtPair[] = []
  let viaRarity = 0

  /*
   * Repete ate nada mudar. Casar o `SP` pode ser o que deixa o `TR` sozinho dos
   * dois lados, e uma passada so perderia esse segundo par.
   */
  let mudou = true
  while (mudou) {
    mudou = false
    for (const [rarity, label] of CORRESPONDENCIAS) {
      const nossas = restoNosso.filter((art) => norm(art.rarity) === rarity)
      const daFonte = restoDaFonte.filter((art) => norm(art.label) === label)
      if (nossas.length !== 1 || daFonte.length !== 1) continue

      pairs.push({ variantId: nossas[0].variantId, productId: daFonte[0].productId })
      restoNosso = restoNosso.filter((art) => art !== nossas[0])
      restoDaFonte = restoDaFonte.filter((art) => art !== daFonte[0])
      viaRarity++
      mudou = true
    }
  }

  // O caso sem escolha da decisao 053, agora tambem depois da eliminacao.
  if (restoNosso.length === 1 && restoDaFonte.length === 1) {
    pairs.push({ variantId: restoNosso[0].variantId, productId: restoDaFonte[0].productId })
    restoNosso = []
    restoDaFonte = []
  }

  return { pairs, viaRarity, leftoverOurs: restoNosso, leftoverTheirs: restoDaFonte }
}
