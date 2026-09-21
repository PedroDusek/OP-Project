import { describe, expect, it } from 'vitest'
import { TRIAL_DAYS, trialDaysLeft, trialEnd } from '@/server/domain/billing/trial'

/**
 * A aritmética do teste grátis (decisão 102, mudança de 21/09).
 *
 * Pouca coisa, e mesmo assim vale teste: a contagem de dias que falta é o único
 * aviso que a pessoa recebe antes de perder o acesso, e errar para menos a
 * faria perder o que montou sem entender por quê.
 */

describe('trialEnd', () => {
  it('dá sete dias corridos', () => {
    expect(trialEnd(new Date('2026-09-21T15:00:00Z'))).toEqual(new Date('2026-09-28T15:00:00Z'))
  })

  /* Corridos, e não de calendário: atravessar o mês não muda a conta. */
  it('atravessa o fim do mês sem sobressalto', () => {
    expect(trialEnd(new Date('2026-09-28T10:00:00Z'))).toEqual(new Date('2026-10-05T10:00:00Z'))
  })

  it('guarda a hora, e não só o dia', () => {
    const fim = trialEnd(new Date('2026-09-21T23:59:00Z'))
    expect(fim.toISOString()).toBe('2026-09-28T23:59:00.000Z')
  })
})

describe('trialDaysLeft', () => {
  const fim = new Date('2026-09-28T15:00:00Z')

  it('no resgate, faltam os sete', () => {
    expect(trialDaysLeft(fim, new Date('2026-09-21T15:00:00Z'))).toBe(TRIAL_DAYS)
  })

  /*
   * Para cima, porque é assim que se conta o que ainda se tem: com 30 horas
   * pela frente a pessoa tem dois dias, e dizer "1" a faria perder um deles.
   */
  it('arredonda para cima', () => {
    expect(trialDaysLeft(fim, new Date('2026-09-27T09:00:00Z'))).toBe(2)
    expect(trialDaysLeft(fim, new Date('2026-09-27T16:00:00Z'))).toBe(1)
  })

  it('acabado é zero, nunca negativo', () => {
    expect(trialDaysLeft(fim, fim)).toBe(0)
    expect(trialDaysLeft(fim, new Date('2026-10-30T15:00:00Z'))).toBe(0)
  })
})
