import { describe, expect, it } from 'vitest'
import {
  COUNTER_LABELS,
  COUNTER_TOKENS,
  COUNTER_VALUES,
  parseCounterValue,
} from '@/server/domain/catalog/counter'

/**
 * Os valores do filtro de counter.
 *
 * O que se protege aqui e que a tela, a URL e a API falem dos **mesmos tres
 * valores**. Sao duas listas por necessidade tecnica — o schema da API precisa
 * de strings literais —, e duas listas que devem dizer a mesma coisa sao duas
 * listas que um dia divergem.
 */

describe('os valores do counter', () => {
  it('as duas listas dizem a mesma coisa', () => {
    expect(COUNTER_TOKENS).toEqual(COUNTER_VALUES.map(String))
  })

  it('todo valor tem rotulo', () => {
    for (const token of COUNTER_TOKENS) expect(COUNTER_LABELS[token]).toBeTruthy()
  })

  it('o zero e mostrado como zero, e os outros com sinal', () => {
    expect(COUNTER_LABELS['0']).toBe('0')
    expect(COUNTER_LABELS['1000']).toBe('+1000')
    expect(COUNTER_LABELS['2000']).toBe('+2000')
  })
})

describe('ler um valor de fora', () => {
  it('le os tres valores do jogo', () => {
    expect(parseCounterValue('0')).toBe(0)
    expect(parseCounterValue('1000')).toBe(1000)
    expect(parseCounterValue(' 2000 ')).toBe(2000)
  })

  /*
   * Valor desconhecido vira ausencia, e nao zero: `contador=500` numa URL
   * editada a mao nao deve devolver personagens sem counter, que ninguem pediu.
   */
  it('recusa o que nao e um dos tres, sem virar zero', () => {
    for (const raw of ['500', '-1000', '', ' ', '+1000', '1000.0', 'abc']) {
      expect(parseCounterValue(raw)).toBeUndefined()
    }
  })
})
