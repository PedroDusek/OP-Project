import { describe, expect, it } from 'vitest'
import {
  artNumber,
  CATALOG_SORT_LABELS,
  CATALOG_SORTS,
  compareCatalogOrder,
  compareCatalogSort,
  parseCatalogSort,
  placementSet,
  type CatalogOrderKey,
  type CatalogSortKey,
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

/**
 * As ordens que a pessoa escolhe (decisão 110).
 *
 * `compareCatalogSort` devolve `0` no empate de propósito: quem chama desempata
 * com `compareCatalogOrder` e depois o id. Por isso os testes aqui verificam o
 * **primeiro** critério, e a cadeia inteira é verificada na integração.
 */
describe('a ordem escolhida pela pessoa', () => {
  const carta = (cardName: string, cost: number | null, power: number | null): CatalogSortKey => ({
    cardName,
    cost,
    power,
  })

  it('o que nao e uma ordem conhecida vira a padrao', () => {
    expect(parseCatalogSort('custo-desc')).toBe('custo-desc')
    expect(parseCatalogSort('CUSTO')).toBe('custo')
    // URL editada a mao nao deve reordenar a lista de um jeito que ninguem pediu.
    expect(parseCatalogSort('preco')).toBe('codigo')
    expect(parseCatalogSort(undefined)).toBe('codigo')
    expect(parseCatalogSort('')).toBe('codigo')
  })

  it('a ordem padrao nao opina: tudo empata e o desempate manda', () => {
    const a = carta('Zoro', 9, 9000)
    const b = carta('Ace', 1, 1000)
    expect(compareCatalogSort(a, b, 'codigo')).toBe(0)
  })

  it('ordena por custo nas duas direcoes', () => {
    const barato = carta('Ace', 1, 1000)
    const caro = carta('Zoro', 9, 9000)
    expect(compareCatalogSort(barato, caro, 'custo')).toBeLessThan(0)
    expect(compareCatalogSort(barato, caro, 'custo-desc')).toBeGreaterThan(0)
  })

  it('ordena por poder nas duas direcoes', () => {
    const fraco = carta('Ace', 1, 1000)
    const forte = carta('Zoro', 9, 9000)
    expect(compareCatalogSort(fraco, forte, 'poder')).toBeLessThan(0)
    expect(compareCatalogSort(fraco, forte, 'poder-desc')).toBeGreaterThan(0)
  })

  /*
   * O caso que motivou a armadilha 87: zero e um valor, e nao ausencia. Numa
   * lista por poder crescente, a Otama de poder 0 e a primeira — se ela cair no
   * fim junto dos nulos, o zero voltou a ser tratado como "nao tem".
   */
  it('zero e um valor e ordena normalmente', () => {
    const zero = carta('Otama', 1, 0)
    const mil = carta('Zoro', 1, 1000)
    expect(compareCatalogSort(zero, mil, 'poder')).toBeLessThan(0)
    expect(compareCatalogSort(zero, mil, 'poder-desc')).toBeGreaterThan(0)
  })

  /*
   * Nulo e "este tipo nao tem este campo": Leader nao tem custo, Event nao tem
   * poder. Um nao-valor nao compete por posicao, e por isso fica no fim das
   * duas vezes — e nao no topo do decrescente, que e onde um `null` tratado
   * como zero ou como infinito acabaria.
   */
  it('o nulo fica no fim nas duas direcoes', () => {
    const semPoder = carta('Gum-Gum Rain', 0, null)
    const comPoder = carta('Zoro', 1, 5000)

    expect(compareCatalogSort(semPoder, comPoder, 'poder')).toBeGreaterThan(0)
    expect(compareCatalogSort(semPoder, comPoder, 'poder-desc')).toBeGreaterThan(0)
    expect(compareCatalogSort(comPoder, semPoder, 'poder')).toBeLessThan(0)
    expect(compareCatalogSort(comPoder, semPoder, 'poder-desc')).toBeLessThan(0)
  })

  it('dois nulos empatam, e o desempate resolve', () => {
    const a = carta('Gum-Gum Rain', 0, null)
    const b = carta('Six King Pistol', 0, null)
    expect(compareCatalogSort(a, b, 'poder')).toBe(0)
    expect(compareCatalogSort(a, b, 'poder-desc')).toBe(0)
  })

  it('ordena por nome nas duas direcoes', () => {
    const ace = carta('Ace', 1, 1000)
    const zoro = carta('Zoro', 9, 9000)
    expect(compareCatalogSort(ace, zoro, 'nome')).toBeLessThan(0)
    expect(compareCatalogSort(ace, zoro, 'nome-desc')).toBeGreaterThan(0)
  })

  /*
   * `localeCompare`, e nao `<`: por ordem de byte toda maiuscula vem antes de
   * toda minuscula, e "Zoro" apareceria antes de "absolute".
   */
  it('o nome ignora caixa e acento', () => {
    expect(compareCatalogSort(carta('absolute', 1, 1), carta('Zoro', 1, 1), 'nome')).toBeLessThan(0)
    expect(compareCatalogSort(carta('Ácido', 1, 1), carta('Bala', 1, 1), 'nome')).toBeLessThan(0)
  })

  it('todas as ordens tem rotulo', () => {
    for (const sort of CATALOG_SORTS) {
      expect(CATALOG_SORT_LABELS[sort]).toBeTruthy()
    }
  })
})
