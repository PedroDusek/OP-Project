import { describe, expect, it } from 'vitest'
import {
  annualSavingsInCents,
  cycleEnd,
  extendPremium,
  formatBrl,
  PLANS,
  statusFromStripe,
} from '@/server/domain/billing/plans'

/**
 * Os preços e a aritmética do acesso (decisão 102).
 */

describe('preços', () => {
  it('cobra o que o dono do produto decidiu', () => {
    expect(PLANS.MONTHLY.amountInCents).toBe(1490)
    expect(PLANS.ANNUAL.amountInCents).toBe(14900)
    expect(formatBrl(PLANS.MONTHLY.amountInCents)).toBe('R$ 14,90')
  })

  /* O anual é dez meses pelo preço de doze: é o que a tela promete. */
  it('o anual economiza dois meses', () => {
    expect(annualSavingsInCents()).toBe(1490 * 2)
    expect(PLANS.ANNUAL.amountInCents).toBe(PLANS.MONTHLY.amountInCents * 10)
  })
})

describe('cycleEnd', () => {
  it('soma mês de calendário, e não trinta dias', () => {
    expect(cycleEnd(new Date('2026-01-15T12:00:00Z'), 'MONTHLY')).toEqual(
      new Date('2026-02-15T12:00:00Z'),
    )
    expect(cycleEnd(new Date('2026-03-10T00:00:00Z'), 'ANNUAL')).toEqual(
      new Date('2027-03-10T00:00:00Z'),
    )
  })

  /*
   * O caso que quebra a soma ingênua: 31 de janeiro mais um mês não é 3 de
   * março. Quem pagou dia 31 ganha o último dia do mês seguinte.
   */
  it('prende ao último dia quando o mês seguinte é mais curto', () => {
    expect(cycleEnd(new Date('2026-01-31T09:00:00Z'), 'MONTHLY')).toEqual(
      new Date('2026-02-28T09:00:00Z'),
    )
    // 2028 é bissexto.
    expect(cycleEnd(new Date('2028-01-31T09:00:00Z'), 'MONTHLY')).toEqual(
      new Date('2028-02-29T09:00:00Z'),
    )
  })
})

describe('extendPremium', () => {
  /* Pagar antes de vencer não pode custar os dias já comprados. */
  it('emenda no que já existe quando ainda vale', () => {
    const atual = new Date('2026-10-20T00:00:00Z')
    expect(extendPremium(atual, new Date('2026-10-15T00:00:00Z'), 'MONTHLY')).toEqual(
      new Date('2026-11-20T00:00:00Z'),
    )
  })

  /* Período parado não é devido: quem volta depois de vencer recomeça hoje. */
  it('recomeça de hoje quando já venceu', () => {
    const vencido = new Date('2026-09-01T00:00:00Z')
    expect(extendPremium(vencido, new Date('2026-10-15T00:00:00Z'), 'MONTHLY')).toEqual(
      new Date('2026-11-15T00:00:00Z'),
    )
  })

  it('quem nunca teve começa de hoje', () => {
    expect(extendPremium(null, new Date('2026-10-15T00:00:00Z'), 'ANNUAL')).toEqual(
      new Date('2027-10-15T00:00:00Z'),
    )
  })
})

describe('statusFromStripe', () => {
  it('traduz o que a Stripe diz', () => {
    expect(statusFromStripe('active')).toBe('ACTIVE')
    expect(statusFromStripe('trialing')).toBe('ACTIVE')
    expect(statusFromStripe('past_due')).toBe('PAST_DUE')
    expect(statusFromStripe('canceled')).toBe('CANCELED')
  })

  /* Diante do desconhecido, o lado que não dá acesso de graça. */
  it('status desconhecido não vira ativo', () => {
    expect(statusFromStripe('coisa_nova_da_stripe')).toBe('PAST_DUE')
  })
})
