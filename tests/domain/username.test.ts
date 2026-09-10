import { describe, expect, it } from 'vitest'
import {
  canChangeUsername,
  normalizeUsername,
  USERNAME_CHANGE_INTERVAL_MS,
  usernameChangeAllowedAt,
  validateUsername,
} from '@/server/domain/social/username'

/**
 * O nome de usuario (`business-rules.md` 6.1.1).
 *
 * E a **unica** identidade que outros veem: nome real e e-mail nunca aparecem.
 * Entao cada regra aqui fecha um jeito de alguem se passar por outra pessoa, e
 * e por isso que elas sao estreitas.
 */

describe('a forma guardada', () => {
  it('e sempre minuscula e sem espaco em volta', () => {
    expect(normalizeUsername('  Pedro  ')).toBe('pedro')
  })

  /** Quem le nao distingue `Pedro` de `pedro` com confianca. */
  it('faz maiuscula e minuscula serem o mesmo nome', () => {
    expect(normalizeUsername('PEDRO')).toBe(normalizeUsername('pedro'))
  })
})

describe('o que vale como nome', () => {
  it('aceita letras, numeros, ponto e sublinhado', () => {
    for (const nome of ['pedro', 'pedro_dusek', 'ana.tcg', 'zoro99', 'a1b']) {
      expect(validateUsername(nome), nome).toBeNull()
    }
  })

  it('recusa curto demais e longo demais', () => {
    expect(validateUsername('ab')).toBe('curto')
    expect(validateUsername('a'.repeat(21))).toBe('longo')
  })

  /**
   * O ataque mais barato contra identidade escrita: `pedrо` com `о` cirilico e
   * indistinguivel de `pedro` na tela, e seria outra conta.
   */
  it('recusa alfabeto de fora do latino basico', () => {
    expect(validateUsername('pedrо')).toBe('formato')
    expect(validateUsername('joão')).toBe('formato')
    expect(validateUsername('ｐｅｄｒｏ')).toBe('formato')
  })

  it('recusa espaco e simbolo', () => {
    expect(validateUsername('pedro dusek')).toBe('formato')
    expect(validateUsername('pedro-dusek')).toBe('formato')
    expect(validateUsername('pedro@casa')).toBe('formato')
  })

  /** Variacoes que so servem para parecer outra coisa. */
  it('recusa separador na ponta ou repetido', () => {
    expect(validateUsername('.pedro')).toBe('formato')
    expect(validateUsername('pedro.')).toBe('formato')
    expect(validateUsername('_pedro')).toBe('formato')
    expect(validateUsername('pe..dro')).toBe('formato')
    expect(validateUsername('pe._dro')).toBe('formato')
  })

  /**
   * Um usuario chamado `suporte` pode pedir senha a estranhos e ser
   * acreditado.
   */
  it('recusa os nomes que o produto reserva', () => {
    for (const nome of ['colexa', 'suporte', 'admin', 'ColeXa', 'MODERADOR']) {
      expect(validateUsername(nome), nome).toBe('reservado')
    }
  })

  it('valida sobre a forma normalizada, e nao sobre o que foi digitado', () => {
    expect(validateUsername('  Pedro_Dusek  ')).toBeNull()
  })
})

describe('trocar de nome', () => {
  const agora = new Date('2026-09-09T12:00:00Z')

  /** Escolher pela primeira vez nao e troca: seria cobrar espera de quem chegou. */
  it('quem nunca trocou pode trocar', () => {
    expect(usernameChangeAllowedAt(null)).toBeNull()
    expect(canChangeUsername(null, agora)).toBe(true)
  })

  it('recusa antes de uma semana', () => {
    const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000)

    expect(canChangeUsername(ontem, agora)).toBe(false)
  })

  it('libera exatamente uma semana depois', () => {
    const umaSemanaAtras = new Date(agora.getTime() - USERNAME_CHANGE_INTERVAL_MS)

    expect(canChangeUsername(umaSemanaAtras, agora)).toBe(true)
  })

  it('diz quando vai liberar, para a tela poder contar', () => {
    const trocou = new Date('2026-09-08T12:00:00Z')

    expect(usernameChangeAllowedAt(trocou)).toEqual(new Date('2026-09-15T12:00:00Z'))
  })
})
