import { describe, expect, it } from 'vitest'
import { ligaSuggestion, type SuggestionArt } from '@/server/domain/prices/liga-suggestion'
import {
  candidateAnswered,
  MANTIDO_CONTRA_A_LIGA,
  mappingCandidates,
  type CandidateInputArt,
  type CandidateInputCard,
  type CandidateSourceArt,
} from '@/server/domain/prices/parallel-candidates'

/**
 * O que a tela `/dev/paralelas` pergunta (decisões 068 e 077).
 *
 * Os endereços da Liga são do jeito que ela os produz; os casos são os medidos na
 * auditoria de 16/09.
 */

const liga = (card: string, num: string, ed: string) =>
  `https://www.ligaonepiece.com.br/?view=cards/card&card=${encodeURIComponent(card)}&ed=${ed}&num=${num}`

const arte = (sourceId: string, extra: Partial<CandidateInputArt> = {}): CandidateInputArt => ({
  sourceId,
  variantType: sourceId.includes('_p') ? 'Parallel' : 'Normal',
  rarity: 'UC',
  imageUrl: null,
  sets: sourceId.includes('_p') ? ['PRB-01'] : ['OP01'],
  atual: null,
  ligaUrl: undefined,
  ...extra,
})

const produto = (productId: string, label: string, groupCode: string, dono: string | null = null): CandidateSourceArt => ({
  productId,
  label,
  value: 1,
  groupCode,
  dono,
})

/* A OP01-052 como estava: a p1 (Event Pack) no Jolly Roger Foil, e a p3 (Jolly Roger Foil) sem nada. */
const raizo: CandidateInputCard = {
  code: 'OP01-052',
  name: 'Raizo',
  setCode: 'OP01',
  arts: [
    arte('OP01-052', { atual: { productId: 'normal', origin: 'automatic' } }),
    arte('OP01-052_p1', {
      sets: ['PROMO'],
      atual: { productId: 'jr', origin: 'manual' },
      ligaUrl: liga('Raizo (Event Pack Vol. 2) (OP01-052-EP)', 'OP01-052-EP', 'PC-01'),
    }),
    arte('OP01-052_p3', { ligaUrl: liga('Raizo (Jolly Roger Foil) (OP01-052-JR)', 'OP01-052-JR', 'PRB') }),
  ],
}

const produtosDoRaizo = [
  produto('normal', '', 'OP01', 'OP01-052'),
  produto('jr', 'Jolly Roger Foil', 'PRB-01', 'OP01-052_p1'),
  produto('ep', 'Event Pack Vol. 2', 'OP-PR'),
]

const entrada = (overrides: Partial<Parameters<typeof mappingCandidates>[0]> = {}) => ({
  cards: [raizo],
  manual: new Map<string, { produto: string | null; nota?: string }>(),
  productsByCode: new Map([['OP01-052', produtosDoRaizo]]),
  pricedNormals: new Set(['OP01-052']),
  ...overrides,
})

describe('o que a tela pergunta', () => {
  it('a carta inteira, com o motivo de cada arte e a sugestão da Liga', () => {
    const [carta] = mappingCandidates(entrada())

    expect(carta.ours.map((a) => [a.sourceId, a.motivo, a.sugestao])).toEqual([
      ['OP01-052_p1', 'liga-sugere-outro', 'ep'],
      ['OP01-052_p3', 'sem-vinculo', 'jr'],
    ])
    expect(carta.ours[0].liga?.tratamento).toBe('event pack vol 2')
    expect(carta.theirs.map((p) => p.productId)).toEqual(['normal', 'jr', 'ep'])
  })

  it('manter contra a Liga, com a nota, tira a pergunta', () => {
    const cartas = mappingCandidates(
      entrada({
        cards: [{ ...raizo, arts: raizo.arts.filter((a) => a.sourceId !== 'OP01-052_p3') }],
        manual: new Map([['OP01-052_p1', { produto: 'jr', nota: MANTIDO_CONTRA_A_LIGA }]]),
      }),
    )
    expect(cartas).toEqual([])
  })

  it('a normal sem preço entra, e a cotada não', () => {
    const [carta] = mappingCandidates(entrada({ pricedNormals: new Set() }))
    expect(carta.ours[0]).toMatchObject({ sourceId: 'OP01-052', variantType: 'Normal', motivo: 'normal-sem-preco' })

    expect(mappingCandidates(entrada()).at(0)?.ours.some((a) => a.variantType === 'Normal')).toBe(false)
  })

  it('carta sem produto nenhum na fonte não é pergunta', () => {
    expect(mappingCandidates(entrada({ productsByCode: new Map() }))).toEqual([])
  })
})

describe('se a pergunta já tem resposta', () => {
  const [carta] = mappingCandidates(entrada())
  const [p1, p3] = carta.ours

  /* `produto: null` e "olhei, e a fonte nao tem": conta como resposta. */
  it('sem vínculo: qualquer resposta, inclusive "não tem"', () => {
    expect(candidateAnswered(p3, {})).toBe(false)
    expect(candidateAnswered(p3, { 'OP01-052_p3': { produto: null } })).toBe(true)
  })

  it('contra a Liga: aceitar a sugestão, ou manter com a nota', () => {
    expect(candidateAnswered(p1, { 'OP01-052_p1': { produto: 'jr' } })).toBe(false)
    expect(candidateAnswered(p1, { 'OP01-052_p1': { produto: 'ep' } })).toBe(true)
    expect(candidateAnswered(p1, { 'OP01-052_p1': { produto: 'jr', nota: MANTIDO_CONTRA_A_LIGA } })).toBe(true)
  })
})

describe('a sugestão da Liga', () => {
  const comoLiga = (a: CandidateInputArt, cardCode: string, cardName: string): SuggestionArt => ({
    sourceId: a.sourceId,
    cardCode,
    cardName,
    ligaUrl: a.ligaUrl,
    rarity: a.rarity,
    parallelSets: a.sets,
    normalSets: ['OP03'],
  })

  /* A Manga da OP03-122 na edicao OP-03 nao e a Manga da PRB-01. */
  it('com grupo da edição na carta, só sugere produto dele', () => {
    const sogeking = comoLiga(
      arte('OP03-122_p2', { sets: ['OP03'], ligaUrl: liga('Sogeking (Manga) (OP03-122-MA)', 'OP03-122-MA', 'OP-03') }),
      'OP03-122',
      'Sogeking',
    )
    expect(
      ligaSuggestion(
        sogeking,
        'aa-manga',
        [produto('manga-prb', 'Manga', 'PRB-01'), produto('aa-manga', 'Alternate Art + Manga', 'OP03', 'OP03-122_p2')],
        [sogeking],
      ),
    ).toBeNull()
  })

  it('não sugere tirar o produto da irmã cuja página diz o mesmo', () => {
    const url = liga('Carta (Textured Foil) (OP03-055-TF)', 'OP03-055-TF', 'PRB')
    const p2 = comoLiga(arte('OP03-055_p2', { ligaUrl: url }), 'OP03-055', 'Carta')
    const p3 = comoLiga(arte('OP03-055_p3', { ligaUrl: url }), 'OP03-055', 'Carta')
    expect(ligaSuggestion(p2, 'jr', [produto('tf', 'Textured Foil', 'PRB-01', 'OP03-055_p3')], [p2, p3])).toBeNull()
  })

  /* Manga x Super Alternate Art: nomes diferentes nao geram pergunta. */
  it('sem produto do tratamento que a Liga dá, não sugere nada', () => {
    const luffy = comoLiga(
      arte('OP13-118_p2', { ligaUrl: liga('Monkey.D.Luffy (Manga) (OP13-118-MA)', 'OP13-118-MA', 'OP-13') }),
      'OP13-118',
      'Monkey.D.Luffy',
    )
    expect(ligaSuggestion(luffy, 'saa', [produto('saa', 'Super Alternate Art', 'OP13', 'OP13-118_p2')], [luffy])).toBeNull()
  })
})
