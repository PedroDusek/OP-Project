import { describe, expect, it } from 'vitest'
import {
  CONFIRMATION_COOLDOWN_MS,
  canConfirmNow,
  millisUntilConfirm,
  secondsUntilConfirm,
} from '@/server/domain/trades/cooldown'

/**
 * A espera entre a ultima alteracao e poder confirmar (decisao 065).
 *
 * E a trava classica das trocas de jogo: sem ela, o outro lado pode mudar a
 * oferta no instante exato em que voce toca em confirmar, e voce confirma uma
 * troca diferente da que leu.
 */

const MUDOU = new Date('2026-09-10T12:00:00.000Z')
const depois = (ms: number) => new Date(MUDOU.getTime() + ms)

describe('quando da para confirmar', () => {
  it('nao da no instante da alteracao', () => {
    expect(canConfirmNow(MUDOU, MUDOU)).toBe(false)
    expect(millisUntilConfirm(MUDOU, MUDOU)).toBe(CONFIRMATION_COOLDOWN_MS)
  })

  it('nao da enquanto faltar qualquer coisa', () => {
    expect(canConfirmNow(MUDOU, depois(4_999))).toBe(false)
    expect(millisUntilConfirm(MUDOU, depois(4_999))).toBe(1)
  })

  it('da quando a espera fecha', () => {
    expect(canConfirmNow(MUDOU, depois(CONFIRMATION_COOLDOWN_MS))).toBe(true)
    expect(canConfirmNow(MUDOU, depois(60_000))).toBe(true)
  })

  /* Troca em que ninguem mexeu na oferta nao tem o que esperar. */
  it('da quando a oferta nunca mudou', () => {
    expect(canConfirmNow(null, MUDOU)).toBe(true)
    expect(millisUntilConfirm(null, MUDOU)).toBe(0)
  })
})

describe('a contagem que a tela mostra', () => {
  it('arredonda para cima, para nao mostrar zero antes da hora', () => {
    expect(secondsUntilConfirm(MUDOU, MUDOU)).toBe(5)
    expect(secondsUntilConfirm(MUDOU, depois(1))).toBe(5)
    expect(secondsUntilConfirm(MUDOU, depois(4_001))).toBe(1)
    expect(secondsUntilConfirm(MUDOU, depois(5_000))).toBe(0)
  })

  /* Um "-3" na cara de quem espera seria pior que nao contar nada. */
  it('nunca fica negativa', () => {
    expect(millisUntilConfirm(MUDOU, depois(60_000))).toBe(0)
    expect(secondsUntilConfirm(MUDOU, depois(60_000))).toBe(0)
  })

  /*
   * Relogios destoando entre maquinas colocam a alteracao no futuro. O piso e a
   * propria espera: trava enquanto ela dura, e nao para sempre.
   */
  it('trata alteracao no futuro como espera cheia', () => {
    expect(millisUntilConfirm(MUDOU, depois(-30_000))).toBe(CONFIRMATION_COOLDOWN_MS)
    expect(canConfirmNow(MUDOU, depois(-30_000))).toBe(false)
  })
})
