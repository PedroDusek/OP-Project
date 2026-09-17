import { describe, expect, it } from 'vitest'
import { ValidationError } from '@/server/domain/errors'
import {
  conversationPairKey,
  MESSAGE_MAX,
  messageSnippet,
  normalizeMessageBody,
  sendBlockedReason,
} from '@/server/domain/social/conversations'
import { unreadMessagesNotice } from '@/server/domain/notifications/notices'

/** As conversas (decisão 081). */

describe('o par da conversa', () => {
  it('é o mesmo, não importa quem abre', () => {
    expect(conversationPairKey(7n, 3n)).toBe('3:7')
    expect(conversationPairKey(3n, 7n)).toBe('3:7')
  })
})

describe('a mensagem', () => {
  it('é obrigatória, tem teto, e perde o espaço das pontas', () => {
    expect(() => normalizeMessageBody('  ')).toThrow(ValidationError)
    expect(() => normalizeMessageBody('x'.repeat(MESSAGE_MAX + 1))).toThrow(ValidationError)
    expect(normalizeMessageBody('  oi\ntudo bem?  ')).toBe('oi\ntudo bem?')
  })

  it('o trecho da lista é uma linha, com reticências quando longo', () => {
    expect(messageSnippet('oi\n\ntudo  bem?')).toBe('oi tudo bem?')
    expect(messageSnippet('x'.repeat(200))).toHaveLength(80)
  })
})

describe('o bloqueio na conversa', () => {
  it('impede escrever nos dois sentidos, e diz o caminho a quem bloqueou', () => {
    expect(sendBlockedReason({ viewerBlockedOther: false, otherBlockedViewer: false })).toBeNull()
    expect(sendBlockedReason({ viewerBlockedOther: true, otherBlockedViewer: false })).toMatch(/Desbloqueie/)
    // A quem foi bloqueado, a tela nao conta que foi bloqueio.
    expect(sendBlockedReason({ viewerBlockedOther: false, otherBlockedViewer: true })).not.toMatch(/bloque/i)
  })
})

describe('o aviso do sino', () => {
  it('aparece com conversa não lida, e some sem nenhuma', () => {
    expect(unreadMessagesNotice(2)).toEqual({ kind: 'unread-messages', conversations: 2 })
    expect(unreadMessagesNotice(0)).toBeNull()
  })
})
