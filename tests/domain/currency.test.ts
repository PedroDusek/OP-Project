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

  /*
   * **A regra mudou em 21/09**: a janela era de três dias, e o teste dizia
   * "recusa a partir do quarto". Passou a ser de **sete**, por escolha do dono
   * do produto.
   *
   * O motivo não era feriado, era estrutural: a tarefa roda às 04:00 de
   * Brasília e a PTAX do dia só sai à tarde, então na segunda ela ainda
   * encontra a de sexta. A conta chegava a quatro dias às 21:00 de Brasília, e
   * o real sumia da tela toda segunda à noite.
   */
  it('aceita a semana inteira, que é o atraso estrutural da tarefa', () => {
    expect(MAX_RATE_AGE_IN_DAYS).toBe(7)

    const seteDiasAntes = new Date('2026-08-31T00:00:00Z')
    expect(isRateStale(seteDiasAntes, seg)).toBe(false)
  })

  /* O caso real de 21/09: segunda à noite, com a cotação de sexta. */
  it('aceita a de sexta na noite de segunda, em UTC', () => {
    const sexta = new Date('2026-09-18T00:00:00Z')
    const segundaANoite = new Date('2026-09-22T01:07:00Z')

    expect(isRateStale(sexta, segundaANoite)).toBe(false)
  })

  /* Passando de sete, é a importação que parou — e aí o real some mesmo. */
  it('recusa a partir do oitavo dia', () => {
    expect(isRateStale(new Date('2026-08-30T00:00:00Z'), seg)).toBe(true)
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
