import { describe, expect, it } from 'vitest'
import {
  artNumber,
  compareCatalogOrder,
  placementSet,
  type CatalogOrderKey,
} from '@/server/domain/catalog/order'

/**
 * A ordem de toda listagem (decisões 040 e 069).
 *
 * Pedido do dono do produto: dentro de qualquer filtro, as cartas em ordem de
 * código — quem confere uma coleção não pode precisar voltar atrás procurando
 * a que ficou para trás.
 */

describe('em que set a arte fica', () => {
  /* O caso que denunciou o defeito: a normal impressa tambem no ST-17. */
  it('no set do proprio codigo, quando foi impressa nele', () => {
    expect(placementSet('OP01-073', ['ST-17', 'OP01'])).toBe('OP01')
  })

  it('no set filtrado, quando a tela filtra por um em que ela foi impressa', () => {
    expect(placementSet('OP01-073', ['OP01', 'ST-17'], 'ST-17')).toBe('ST-17')
    // Filtro que ela nao tem nao inventa um set.
    expect(placementSet('OP01-073', ['OP01', 'ST-17'], 'OP05')).toBe('OP01')
  })

  it('compara o codigo do filtro sem pontuacao', () => {
    expect(placementSet('OP07-001', ['OP-07', 'PRB-01'], 'OP07')).toBe('OP-07')
  })

  /*
   * "A mais antiga" nao serve: coleção vem antes de starter deck na ordem do
   * catalogo, e a carta do ST-01 reimpressa na PRB-01 sairia de casa.
   */
  it('nao troca o starter deck pela reimpressao numa colecao', () => {
    expect(placementSet('ST01-014', ['PRB-01', 'ST-01'])).toBe('ST-01')
  })

  it('reconhece o codigo sem hifen e o set composto', () => {
    expect(placementSet('OP07-051', ['PRB-02', 'OP-07'])).toBe('OP-07')
    expect(placementSet('EB04-012', ['PRB-02', 'OP14-EB04'])).toBe('OP14-EB04')
  })

  it('no primeiro set do catalogo, quando a arte so existe em outro produto', () => {
    expect(placementSet('OP01-016', ['OP05'])).toBe('OP05')
    expect(placementSet('OP01-016', ['PROMO', 'GC-01'])).toBe('GC-01')
    expect(placementSet('P-001', ['PROMO'])).toBe('PROMO')
  })

  it('devolve nulo sem impressao', () => {
    expect(placementSet('OP01-001', [])).toBeNull()
  })
})

describe('a ordem', () => {
  const k = (sourceId: string, setCode: string | null = 'OP01'): CatalogOrderKey => ({
    cardCode: sourceId.replace(/_p\d+$/, ''),
    sourceId,
    setCode,
  })

  it('le o numero da arte, e a normal e zero', () => {
    expect(artNumber('OP01-016')).toBe(0)
    expect(artNumber('OP01-016_p3')).toBe(3)
    expect(artNumber(null)).toBe(0)
  })

  /* `_p10` depois de `_p2`: texto puro poria antes. */
  it('poe as artes da mesma carta em ordem numerica, a normal primeiro', () => {
    const artes = [k('OP01-016_p10'), k('OP01-016_p2'), k('OP01-016'), k('OP01-016_p1')]
    expect(artes.sort(compareCatalogOrder).map((a) => a.sourceId)).toEqual([
      'OP01-016',
      'OP01-016_p1',
      'OP01-016_p2',
      'OP01-016_p10',
    ])
  })

  it('ordena por set, depois pelo codigo da carta', () => {
    const lista = [k('OP02-001'), k('OP01-073'), k('OP01-072'), k('OP01-120_p1'), k('OP01-001', 'PROMO')]
    lista[0].setCode = 'OP02'
    expect(lista.sort(compareCatalogOrder).map((a) => a.sourceId)).toEqual([
      'OP01-072',
      'OP01-073',
      'OP01-120_p1',
      'OP02-001',
      'OP01-001',
    ])
  })

  it('empata so quando set, carta e arte empatam — o id desempata fora', () => {
    expect(compareCatalogOrder(k('OP01-001_p1'), k('OP01-001_p1'))).toBe(0)
  })
})
