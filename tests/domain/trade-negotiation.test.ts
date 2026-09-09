import { describe, expect, it } from 'vitest'
import {
  acceptsChanges,
  isActiveTrade,
  isValidated,
  needsReconfirmation,
  participantsToNotify,
  revokeConfirmations,
  statusAfterChange,
  type Participant,
} from '@/server/domain/trades/negotiation'

/**
 * A negociacao de uma troca (`business-rules.md` 4.6.3).
 *
 * Uma confirmacao significa "concordo com a troca que esta na tela agora". E a
 * unica leitura que serve: se ela sobrevivesse a uma alteracao, ninguem saberia
 * se o outro concordou com o que ve ou com uma versao anterior.
 */

const ONTEM = new Date('2026-09-08T12:00:00Z')

const p = (userId: bigint, confirmedAt: Date | null = null): Participant => ({
  userId,
  confirmedAt,
})

describe('a troca validada', () => {
  it('exige os dois confirmados', () => {
    expect(isValidated([p(1n, ONTEM), p(2n, ONTEM)])).toBe(true)
  })

  it('nao vale com um so confirmado', () => {
    expect(isValidated([p(1n, ONTEM), p(2n)])).toBe(false)
  })

  /**
   * Foi o consentimento do segundo que autorizou o cruzamento dos dados, e e o
   * dele que fecha a troca. Um participante so significa que ainda falta
   * alguem entrar.
   */
  it('nao vale com um participante so, mesmo confirmado', () => {
    expect(isValidated([p(1n, ONTEM)])).toBe(false)
  })

  it('nao vale vazia', () => {
    expect(isValidated([])).toBe(false)
  })

  /** Dois e o numero exato (regra 4.5), e nao o minimo. */
  it('nao vale com tres, mesmo todos confirmados', () => {
    expect(isValidated([p(1n, ONTEM), p(2n, ONTEM), p(3n, ONTEM)])).toBe(false)
  })
})

describe('alterar revoga', () => {
  it('derruba a confirmacao de quem nao alterou', () => {
    const depois = revokeConfirmations([p(1n, ONTEM), p(2n)])

    expect(depois.map((x) => x.confirmedAt)).toEqual([null, null])
  })

  /**
   * A regra escrita cobre "um confirma e o outro altera". Este e o mesmo
   * principio levado a serio: quem confirmou e mudou a propria oferta nao
   * confirmou esta. Preservar a confirmacao de quem alterou pareceria gentileza
   * e deixaria a pessoa confirmada numa troca diferente da que aceitou.
   */
  it('derruba tambem a confirmacao de quem alterou', () => {
    const depois = revokeConfirmations([p(1n, ONTEM), p(2n, ONTEM)])

    expect(depois.every((x) => x.confirmedAt === null)).toBe(true)
  })

  it('nao mexe em quem os participantes sao', () => {
    expect(revokeConfirmations([p(1n, ONTEM), p(2n)]).map((x) => x.userId)).toEqual([1n, 2n])
  })

  it('nao altera a lista recebida', () => {
    const antes = [p(1n, ONTEM)]
    revokeConfirmations(antes)

    expect(antes[0].confirmedAt).toBe(ONTEM)
  })
})

describe('quando avisar', () => {
  /** Numa troca que ninguem confirmou, alterar e o curso normal da conversa. */
  it('nao ha o que avisar sem confirmacao nenhuma', () => {
    expect(needsReconfirmation([p(1n), p(2n)])).toBe(false)
  })

  it('ha o que avisar quando alguem ja tinha confirmado', () => {
    expect(needsReconfirmation([p(1n, ONTEM), p(2n)])).toBe(true)
  })

  it('avisa quem tinha confirmado, e nao quem alterou', () => {
    expect(participantsToNotify([p(1n, ONTEM), p(2n, ONTEM)], 2n)).toEqual([1n])
  })

  /** Quem nao tinha confirmado nao perdeu nada, e ve a alteracao na tela. */
  it('nao avisa quem ainda nao tinha confirmado', () => {
    expect(participantsToNotify([p(1n), p(2n, ONTEM)], 2n)).toEqual([])
  })

  it('nao avisa ninguem quando quem alterou era o unico confirmado', () => {
    expect(participantsToNotify([p(1n), p(2n, ONTEM)], 2n)).toEqual([])
  })
})

describe('o status depois da alteracao', () => {
  it('volta de confirmada para em negociacao', () => {
    expect(statusAfterChange('CONFIRMED')).toBe('NEGOTIATING')
  })

  it('nao mexe nos estados que ainda nem chegaram la', () => {
    expect(statusAfterChange('DRAFT')).toBe('DRAFT')
    expect(statusAfterChange('PROPOSED')).toBe('PROPOSED')
    expect(statusAfterChange('NEGOTIATING')).toBe('NEGOTIATING')
  })
})

describe('quando a troca aceita alteracao', () => {
  /**
   * O valor historico de um trade sai do preco vigente em `completed_at`
   * (regra 5.1). Mexer nos itens depois disso reescreveria o passado.
   */
  it('recusa alteracao em troca concluida', () => {
    expect(acceptsChanges('COMPLETED')).toBe(false)
  })

  it('recusa alteracao em troca cancelada', () => {
    expect(acceptsChanges('CANCELLED')).toBe(false)
  })

  it('aceita durante a negociacao, inclusive confirmada', () => {
    for (const status of ['DRAFT', 'PROPOSED', 'NEGOTIATING', 'CONFIRMED'] as const) {
      expect(acceptsChanges(status), status).toBe(true)
    }
  })
})

describe('os estados ativos', () => {
  /** Sao os que prendem copias e impedem outra troca (regra 4.5). */
  it('sao proposta, negociacao e confirmada', () => {
    expect(isActiveTrade('PROPOSED')).toBe(true)
    expect(isActiveTrade('NEGOTIATING')).toBe(true)
    expect(isActiveTrade('CONFIRMED')).toBe(true)
  })

  it('rascunho nao prende nada', () => {
    expect(isActiveTrade('DRAFT')).toBe(false)
  })

  it('concluida e cancelada sao historico', () => {
    expect(isActiveTrade('COMPLETED')).toBe(false)
    expect(isActiveTrade('CANCELLED')).toBe(false)
  })
})
