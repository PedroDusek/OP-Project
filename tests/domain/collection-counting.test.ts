import { describe, expect, it } from 'vitest'
import {
  countCollection,
  countsTowardPlayset,
  isPlaysetClosed,
  PLAYSET_SIZE,
  progress,
  type OwnedVariant,
} from '@/server/domain/collection/counting'

/**
 * Os cenarios obrigatorios 1, 2 e 3 de `business-rules.md` secao 7.
 *
 * A especificacao os escreve com "Normal x2, AA x1, Manga x1". No catalogo
 * importado o vocabulario de variante e apenas Normal e Parallel (decisao 023),
 * entao os nomes mudam e **os numeros nao**: o que se verifica e que variantes
 * distintas da mesma carta contam separadamente para as unicas e somam para o
 * playset.
 */

const variant = (
  cardId: string,
  variantId: string,
  quantity: number,
  cardType = 'Character',
): OwnedVariant => ({ cardId, cardType, variantId, quantity })

/*
 * As expectativas abaixo comparam o objeto **inteiro**, de proposito: e isso que
 * faz um campo novo aparecer aqui em vez de passar batido. Ganharam
 * `donVariants` na decisao 112, que acrescentou a contagem de DON!! ao retorno.
 * O valor e 0 em todos eles porque nenhum tem DON!! — as cenas de DON!! estao no
 * bloco proprio, no fim do arquivo.
 */
describe('cenarios obrigatorios de contagem', () => {
  it('1: tres variantes da mesma carta, 2+1+1 copias', () => {
    const totals = countCollection([
      variant('carta-1', 'normal', 2),
      variant('carta-1', 'parallel', 1),
      variant('carta-1', 'parallel-2', 1),
    ])

    expect(totals).toEqual({ totalCards: 4, uniqueVariants: 3, closedPlaysets: 1, donVariants: 0 })
  })

  /** Oito copias continuam sendo **um** playset. `floor(8 / 4)` daria dois. */
  it('2: duas variantes com 4 copias cada', () => {
    const totals = countCollection([
      variant('carta-1', 'normal', 4),
      variant('carta-1', 'parallel', 4),
    ])

    expect(totals).toEqual({ totalCards: 8, uniqueVariants: 2, closedPlaysets: 1, donVariants: 0 })
  })

  it('3: dez copias de um Leader nao fecham playset', () => {
    const totals = countCollection([variant('lider-1', 'normal', 10, 'Leader')])

    expect(totals).toEqual({ totalCards: 10, uniqueVariants: 1, closedPlaysets: 0, donVariants: 0 })
  })
})

describe('countCollection', () => {
  it('soma playsets de cartas diferentes', () => {
    const totals = countCollection([
      variant('carta-1', 'v1', 4),
      variant('carta-2', 'v2', 4),
      variant('carta-3', 'v3', 3),
    ])

    expect(totals.closedPlaysets).toBe(2)
    expect(totals.totalCards).toBe(11)
    expect(totals.uniqueVariants).toBe(3)
  })

  /** Quantidade zero nao existe no banco, mas nao pode contar se aparecer. */
  it('ignora quantidade zero ou negativa', () => {
    const totals = countCollection([
      variant('carta-1', 'v1', 0),
      variant('carta-1', 'v2', -3),
      variant('carta-2', 'v3', 2),
    ])

    expect(totals).toEqual({ totalCards: 2, uniqueVariants: 1, closedPlaysets: 0, donVariants: 0 })
  })

  it('colecao vazia da tudo zero', () => {
    expect(countCollection([])).toEqual({
      totalCards: 0,
      uniqueVariants: 0,
      closedPlaysets: 0,
      donVariants: 0,
    })
  })

  /**
   * O playset e por **carta**, nao por variante: quatro artes diferentes com uma
   * copia cada fecham um playset, embora nenhuma variante tenha quatro.
   */
  it('quatro variantes com uma copia cada fecham um playset', () => {
    const totals = countCollection([
      variant('carta-1', 'v1', 1),
      variant('carta-1', 'v2', 1),
      variant('carta-1', 'v3', 1),
      variant('carta-1', 'v4', 1),
    ])

    expect(totals.closedPlaysets).toBe(1)
    expect(totals.uniqueVariants).toBe(4)
  })

  it('Event e Stage contam playset', () => {
    const totals = countCollection([
      variant('evento', 'v1', 4, 'Event'),
      variant('palco', 'v2', 4, 'Stage'),
    ])

    expect(totals.closedPlaysets).toBe(2)
  })
})

describe('isPlaysetClosed', () => {
  it('fecha a partir de quatro copias', () => {
    expect(isPlaysetClosed('Character', PLAYSET_SIZE - 1)).toBe(false)
    expect(isPlaysetClosed('Character', PLAYSET_SIZE)).toBe(true)
    expect(isPlaysetClosed('Character', 99)).toBe(true)
  })

  it('Leader nunca fecha', () => {
    expect(isPlaysetClosed('Leader', 99)).toBe(false)
    expect(countsTowardPlayset('Leader')).toBe(false)
    expect(countsTowardPlayset('Character')).toBe(true)
  })
})

describe('progress', () => {
  /**
   * Devolve fracao, e nao porcentagem arredondada: arredondar cedo apaga a
   * diferenca entre estar a uma carta do fim e a duas.
   */
  it('nao arredonda', () => {
    expect(progress(124, 125)).toBeCloseTo(0.992, 5)
    expect(progress(249, 250)).toBeCloseTo(0.996, 5)
    expect(progress(124, 125)).not.toBe(progress(249, 250))
  })

  it('vai de zero a um', () => {
    expect(progress(0, 125)).toBe(0)
    expect(progress(125, 125)).toBe(1)
  })

  /** Set sem variante nenhuma esta vazio, e nao completo. */
  it('denominador zero e zero, e nao um', () => {
    expect(progress(0, 0)).toBe(0)
    expect(progress(5, 0)).toBe(0)
  })

  it('nao passa de um mesmo com sobra', () => {
    expect(progress(200, 125)).toBe(1)
  })
})

/**
 * O DON!! conta, mas não como progresso (decisão 112).
 *
 * O dono do produto foi explícito: "não haverá progresso, mas haverá 'você
 * possui X DON diferentes'". As três regras abaixo são o que isso significa na
 * aritmética.
 */
describe('DON!!', () => {
  it('nao fecha playset por mais copias que tenha', () => {
    const totals = countCollection([variant('don-1', 'don-1-normal', 10, 'DON')])

    expect(totals.closedPlaysets).toBe(0)
  })

  /*
   * O numerador do progresso exclui DON!!, e o denominador tambem — se so um
   * dos dois excluisse, o progresso passaria de 100%.
   */
  it('fica fora das variantes que contam progresso', () => {
    const totals = countCollection([
      variant('carta-1', 'arte-1', 1),
      variant('don-1', 'don-1-normal', 1, 'DON'),
    ])

    expect(totals.uniqueVariants).toBe(1)
    expect(totals.donVariants).toBe(1)
  })

  /* Mas um DON!! possuido e uma carta possuida: ele conta no total. */
  it('conta no total de cartas', () => {
    const totals = countCollection([
      variant('carta-1', 'arte-1', 2),
      variant('don-1', 'don-1-normal', 3, 'DON'),
    ])

    expect(totals.totalCards).toBe(5)
  })

  it('conta quantos DON diferentes, e nao quantas copias', () => {
    const totals = countCollection([
      variant('don-1', 'don-1-normal', 9, 'DON'),
      variant('don-2', 'don-2-normal', 4, 'DON'),
    ])

    expect(totals.donVariants).toBe(2)
    expect(totals.totalCards).toBe(13)
  })
})
