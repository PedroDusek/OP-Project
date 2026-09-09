import { withoutNumberToken, type SourceProduct } from './matching'

/**
 * Separar arte de embalagem nos produtos da fonte.
 *
 * Camada: domain. Puro.
 *
 * ## O problema
 *
 * A fonte lista um produto por **caixa**, não por arte. A mesma ilustração
 * aparece como `(Reprint)`, `(Dash Pack)`, `(Nami Deck)`, `(Premium Card
 * Collection -Best Selection Vol. 6-)` e como uma dúzia de pacotes de torneio.
 * Contar esses como arte paralela fazia a contagem da fonte divergir da nossa
 * em 40% das cartas.
 *
 * ## A regra, e por que ela também falha fechado
 *
 * Vale a lista abaixo, e nada além. O que não está nela é embalagem — não
 * porque se saiba que é, mas porque **não se sabe que é arte**, e vincular a
 * arte errada a um preço é o erro que este módulo existe para não cometer.
 *
 * A lista foi levantada dos 87 grupos da fonte e é revisada pelo dono do
 * produto, que é quem conhece o jogo. Crescer é fácil e seguro; encolher não.
 *
 * ## Combinações são reais
 *
 * `(SP) (Gold)` e `(Alternate Art) (Manga)` existem, e são uma arte só. Por
 * isso um rótulo composto vale como arte quando **todas** as partes valem: uma
 * parte desconhecida no meio já tira o produto da conta.
 */

/** O vocabulário de tratamento de arte da fonte, em minúsculas. */
export const ART_TREATMENTS: ReadonlySet<string> = new Set([
  'alternate art',
  'super alternate art',
  'super leader alternate art',
  'red super alternate art',
  'parallel',
  'sp',
  'manga',
  'full art',
  'box topper',
  'jolly roger foil',
  'pirate foil',
  'wanted poster',
  'pandaman art',
  'gem',
  'gold',
  'silver',
  'tr',
])

/**
 * O tratamento de um produto: o que sobra entre parênteses, tirado o número.
 *
 * `commonName`, quando conhecido, é retirado antes — sem isso, uma carta como
 * `Mr.3(Galdino) (Alternate Art)` renderia o rótulo `Galdino + Alternate Art`,
 * porque o parêntese do nome não se distingue do parêntese do tratamento.
 */
export function treatmentOf(product: SourceProduct, commonName?: string | null): string {
  let rest = product.name
  if (commonName && rest.startsWith(commonName)) rest = rest.slice(commonName.length)

  const marks = [...withoutNumberToken(rest, product.number).matchAll(/\(([^)]*)\)/g)].map(
    (match) => match[1].trim(),
  )

  return marks.filter((mark) => !isNumberToken(mark)).join(' + ')
}

/** Um rótulo é arte quando todas as suas partes estão no vocabulário. */
export function isArtTreatment(label: string): boolean {
  const parts = label
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part !== '')

  return parts.length > 0 && parts.every((part) => ART_TREATMENTS.has(part))
}

/**
 * Os produtos que são outra arte da mesma carta.
 *
 * A arte comum fica de fora — ela é identificada por regra própria (decisão
 * 050) e não precisa de vínculo. Embalagem também fica de fora.
 */
export function artProducts(
  products: readonly SourceProduct[],
  common: SourceProduct | null,
): SourceProduct[] {
  return products.filter((product) => {
    if (common && product.productId === common.productId) return false
    return isArtTreatment(treatmentOf(product, common?.name ?? null))
  })
}

/** `(069)` e `(P-029)` são número, não tratamento. */
function isNumberToken(mark: string): boolean {
  return /^\d+$/.test(mark) || /^[A-Z]{1,4}\d{0,2}-\d+$/i.test(mark)
}
