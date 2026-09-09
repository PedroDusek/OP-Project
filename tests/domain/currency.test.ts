import { describe, expect, it } from 'vitest'
import {
  convertToBrl,
  isRateStale,
  MAX_RATE_AGE_IN_DAYS,
} from '@/server/domain/prices/currency'

/**
 * A conversão para real, e quando ela deixa de valer.
 *
 * O valor em real não é guardado: sai do preço em dólar vezes a cotação do dia,
 * na leitura. O que se protege aqui é que a conta feche na soma e que uma
 * cotação velha não vire número na tela.
 */

describe('converter para real', () => {
  it('multiplica pela cotação', () => {
    expect(convertToBrl(10, 5)).toBe(50)
  })

  /** `12,34 × 5,1253` dá 63,245... e dinheiro tem duas casas. */
  it('arredonda em centavos, meio para cima', () => {
    expect(convertToBrl(12.34, 5.1253)).toBe(63.25)
    expect(convertToBrl(1, 5.125)).toBe(5.13)
  })

  /**
   * A conta é feita inteira e arredondada uma vez. Arredondar em duas etapas
   * faria a soma de uma coleção divergir da soma dos itens dela.
   */
  it('não arredonda a taxa antes da multiplicação', () => {
    expect(convertToBrl(100, 5.129)).toBe(512.9)
  })

  it('leva o zero para zero, e não para perto de zero', () => {
    expect(convertToBrl(0, 5.1253)).toBe(0)
  })

  /** Carta de centavos é a maioria do catálogo. */
  it('preserva o valor de uma carta barata', () => {
    expect(convertToBrl(0.02, 5.1253)).toBe(0.1)
  })
})

describe('cotação velha demais', () => {
  const seg = new Date('2026-09-07T12:00:00Z')

  it('aceita a cotação do próprio dia', () => {
    expect(isRateStale(new Date('2026-09-07T00:00:00Z'), seg)).toBe(false)
  })

  /**
   * O PTAX só existe em dia útil: numa segunda, a cotação mais recente é a de
   * sexta, e isso é normal — não é sinal de importação parada.
   */
  it('aceita a de sexta numa segunda', () => {
    expect(isRateStale(new Date('2026-09-04T00:00:00Z'), seg)).toBe(false)
  })

  it('aceita o fim de semana com feriado emendado', () => {
    const limite = new Date('2026-09-04T00:00:00Z')
    const tresDiasDepois = new Date('2026-09-07T12:00:00Z')

    expect(MAX_RATE_AGE_IN_DAYS).toBe(3)
    expect(isRateStale(limite, tresDiasDepois)).toBe(false)
  })

  it('recusa a partir do quarto dia', () => {
    expect(isRateStale(new Date('2026-09-03T00:00:00Z'), seg)).toBe(true)
  })

  /**
   * A data da cotação vem de uma coluna `DATE`, que chega como meia-noite UTC.
   * A comparação é de calendário: a hora do outro lado não pode mudar a conta.
   */
  it('compara dias, e não instantes', () => {
    const cotacao = new Date('2026-09-04T00:00:00Z')

    expect(isRateStale(cotacao, new Date('2026-09-07T00:00:01Z'))).toBe(false)
    expect(isRateStale(cotacao, new Date('2026-09-07T23:59:59Z'))).toBe(false)
  })
})
