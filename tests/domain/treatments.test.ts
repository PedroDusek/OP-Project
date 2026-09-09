import { describe, expect, it } from 'vitest'
import { artProducts, isArtTreatment, treatmentOf } from '@/server/domain/prices/treatments'
import type { SourceProduct } from '@/server/domain/prices/matching'

/**
 * Separar arte de embalagem nos produtos da fonte.
 *
 * Todos os nomes aqui sao reais, copiados do catalogo do tcgcsv. A fonte lista
 * um produto por **caixa**, nao por arte: a mesma ilustracao aparece como
 * `(Reprint)`, `(Dash Pack)`, `(Nami Deck)` e como uma duzia de pacotes de
 * torneio. Contar isso como arte fazia a contagem divergir da nossa em 40% das
 * cartas.
 *
 * O que se protege e a falha fechada: o que nao esta no vocabulario **nao** e
 * arte, e vincular a arte errada a um preco e o erro que este modulo existe
 * para nao cometer.
 */

const produto = (productId: number, name: string, number: string): SourceProduct => ({
  productId,
  name,
  number,
})

describe('extrair o tratamento', () => {
  it('devolve o que sobra entre parenteses', () => {
    expect(treatmentOf(produto(1, 'Shanks (020) (Alternate Art)', 'OP17-020'))).toBe(
      'Alternate Art',
    )
  })

  it('devolve vazio quando nao ha tratamento', () => {
    expect(treatmentOf(produto(1, 'Shanks (022)', 'OP17-022'))).toBe('')
  })

  it('junta os tratamentos combinados', () => {
    expect(treatmentOf(produto(1, 'Zoro (051) (SP) (Gold)', 'OP07-051'))).toBe('SP + Gold')
  })

  /**
   * Sem tirar o nome antes, `Mr.3(Galdino) (Alternate Art)` renderia
   * `Galdino + Alternate Art` — e um rotulo com uma parte desconhecida nao
   * conta como arte, entao a carta ficaria de fora sem motivo.
   */
  it('tira o nome da carta quando ele tem parenteses de verdade', () => {
    const p = produto(1, 'Mr.3(Galdino) (Alternate Art)', 'OP09-056')

    expect(treatmentOf(p, 'Mr.3(Galdino)')).toBe('Alternate Art')
    expect(isArtTreatment(treatmentOf(p, 'Mr.3(Galdino)'))).toBe(true)
  })

  it('nao confunde o numero com tratamento', () => {
    expect(treatmentOf(produto(1, 'Buggy (P-084) (SP)', 'P-084'))).toBe('SP')
  })
})

describe('arte ou embalagem', () => {
  it('aceita o vocabulario de arte da fonte', () => {
    for (const label of ['Alternate Art', 'Manga', 'SP', 'Full Art', 'Box Topper', 'TR']) {
      expect(isArtTreatment(label), label).toBe(true)
    }
  })

  /** A mesma ilustracao noutra caixa. Contar como arte era o defeito. */
  it('recusa nome de produto', () => {
    const embalagens = [
      'Reprint',
      'Dash Pack',
      'Nami Deck',
      'Premium Card Collection -Best Selection Vol. 6-',
      'Winner Pack 2025 Vol. 1',
      'OP10 Release Event Winner',
    ]

    for (const label of embalagens) {
      expect(isArtTreatment(label), label).toBe(false)
    }
  })

  it('aceita combinacao so quando todas as partes sao arte', () => {
    expect(isArtTreatment('SP + Gold')).toBe(true)
    expect(isArtTreatment('Alternate Art + Manga')).toBe(true)
    expect(isArtTreatment('Alternate Art + Reprint')).toBe(false)
  })

  /** Produto sem marca nenhuma nao e outra arte: e a propria carta. */
  it('recusa rotulo vazio', () => {
    expect(isArtTreatment('')).toBe(false)
  })

  /**
   * O vocabulario e revisado pelo dono do produto e cresce quando a fonte
   * inventa um tratamento novo. Ate crescer, o desconhecido fica de fora — e
   * ficar de fora significa a carta sem preco, nao com o preco errado.
   */
  it('recusa tratamento que ainda nao esta no vocabulario', () => {
    expect(isArtTreatment('Holographic Rainbow Foil')).toBe(false)
  })
})

describe('as outras artes de uma carta', () => {
  const comum = produto(1, 'Shanks (022)', 'OP17-022')
  const lista = [
    comum,
    produto(2, 'Shanks (022) (Alternate Art)', 'OP17-022'),
    produto(3, 'Shanks (022) (Manga)', 'OP17-022'),
    produto(4, 'Shanks (Nami Deck)', 'OP17-022'),
    produto(5, 'Shanks (Reprint)', 'OP17-022'),
  ]

  it('devolve so as artes, sem a comum e sem embalagem', () => {
    expect(artProducts(lista, comum).map((p) => p.productId)).toEqual([2, 3])
  })

  it('sem arte comum conhecida, ainda separa arte de embalagem', () => {
    expect(artProducts(lista, null).map((p) => p.productId)).toEqual([2, 3])
  })

  it('devolve vazio quando a carta so tem a comum', () => {
    expect(artProducts([comum], comum)).toEqual([])
  })
})
