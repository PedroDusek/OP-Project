import { describe, expect, it } from 'vitest'
import {
  pendingParallels,
  type CandidateSourceArt,
  type CardWithParallels,
} from '@/server/domain/prices/parallel-candidates'

/**
 * O que ainda falta mapear à mão (decisão 068).
 *
 * Pendente é quando sobra algo sem par **dos dois lados**. Um lado só não é
 * pergunta: oferecer à pessoa uma carta sem opção nenhuma seria fazê-la olhar à
 * toa.
 */

const carta = (code: string, ...sourceIds: string[]): CardWithParallels => ({
  code,
  name: `Carta ${code}`,
  setCode: 'OP01',
  parallels: sourceIds.map((sourceId) => ({ sourceId, rarity: 'SR', imageUrl: null })),
})

const arte = (productId: string, label = 'Alternate Art'): CandidateSourceArt => ({
  productId,
  label,
  value: null,
})

const vazio = new Set<string>()

describe('o que fica pendente', () => {
  it('lista a carta com arte sem par dos dois lados', () => {
    const r = pendingParallels({
      cards: [carta('OP01-016', 'OP01-016_p1', 'OP01-016_p2')],
      linkedSourceIds: vazio,
      claimedProductIds: vazio,
      answeredSourceIds: vazio,
      artsByCode: new Map([['OP01-016', [arte('1'), arte('2', 'Manga')]]]),
    })
    expect(r).toHaveLength(1)
    expect(r[0].ours.map((a) => a.sourceId)).toEqual(['OP01-016_p1', 'OP01-016_p2'])
    expect(r[0].theirs.map((a) => a.productId)).toEqual(['1', '2'])
  })

  it('tira o que ja tem vinculo, dos dois lados', () => {
    const r = pendingParallels({
      cards: [carta('OP01-016', 'OP01-016_p1', 'OP01-016_p2', 'OP01-016_p3')],
      linkedSourceIds: new Set(['OP01-016_p1']),
      claimedProductIds: new Set(['1']),
      answeredSourceIds: vazio,
      artsByCode: new Map([['OP01-016', [arte('1'), arte('2'), arte('3')]]]),
    })
    expect(r[0].ours.map((a) => a.sourceId)).toEqual(['OP01-016_p2', 'OP01-016_p3'])
    expect(r[0].theirs.map((a) => a.productId)).toEqual(['2', '3'])
  })

  /* `produto: null` e uma resposta: a arte nao volta para a fila. */
  it('conta a resposta "sem produto" como respondida', () => {
    const r = pendingParallels({
      cards: [carta('OP01-016', 'OP01-016_p1')],
      linkedSourceIds: vazio,
      claimedProductIds: vazio,
      answeredSourceIds: new Set(['OP01-016_p1']),
      artsByCode: new Map([['OP01-016', [arte('1')]]]),
    })
    expect(r).toEqual([])
  })

  it('nao lista a carta cuja arte a fonte nao oferece', () => {
    const r = pendingParallels({
      cards: [carta('ST11-001', 'ST11-001_p1')],
      linkedSourceIds: vazio,
      claimedProductIds: vazio,
      answeredSourceIds: vazio,
      artsByCode: new Map(),
    })
    expect(r).toEqual([])
  })

  it('nao lista a carta em que so sobrou produto da fonte', () => {
    const r = pendingParallels({
      cards: [carta('OP01-016', 'OP01-016_p1')],
      linkedSourceIds: new Set(['OP01-016_p1']),
      claimedProductIds: new Set(['1']),
      answeredSourceIds: vazio,
      artsByCode: new Map([['OP01-016', [arte('1'), arte('2')]]]),
    })
    expect(r).toEqual([])
  })

  it('ordena pela ordem do catalogo', () => {
    const r = pendingParallels({
      cards: [
        { ...carta('OP02-001', 'OP02-001_p1'), setCode: 'OP02' },
        { ...carta('OP01-002', 'OP01-002_p1'), setCode: 'OP01' },
      ],
      linkedSourceIds: vazio,
      claimedProductIds: vazio,
      answeredSourceIds: vazio,
      artsByCode: new Map([
        ['OP02-001', [arte('9')]],
        ['OP01-002', [arte('8')]],
      ]),
    })
    expect(r.map((c) => c.cardCode)).toEqual(['OP01-002', 'OP02-001'])
  })
})
