import { describe, expect, it } from 'vitest'
import { unallocatedNotice } from '@/server/domain/notifications/notices'

/** Os avisos do sino (decisão 080): estado atual, que some quando o assunto se resolve. */

describe('o aviso das cartas sem armazenamento', () => {
  it('aparece com cópia sem lugar e algum local criado', () => {
    expect(unallocatedNotice({ copies: 12, cards: 5 }, true)).toEqual({ kind: 'unallocated-cards', copies: 12, cards: 5 })
  })

  it('some quando tudo está guardado', () => {
    expect(unallocatedNotice({ copies: 0, cards: 0 }, true)).toBeNull()
  })

  /* Sem local nenhum, tudo estaria sem lugar: o convite seria um beco. */
  it('não avisa quem ainda não criou nenhum local', () => {
    expect(unallocatedNotice({ copies: 30, cards: 10 }, false)).toBeNull()
  })
})
