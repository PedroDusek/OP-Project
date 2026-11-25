import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { MemberBinder } from '@/server/application/social'

/**
 * O caminho do Trade Binder de alguém para a carta (pedido do dono do produto
 * em 11/11).
 *
 * A tela é do servidor, e os dublês existem só para ela renderizar fora do
 * Next: o caso de uso fala com o Prisma, e os botões de conversar, convidar,
 * bloquear e denunciar arrastam as Server Actions no grafo de módulos. O que se
 * prova aqui é o link na arte; **o que pode aparecer** nesta tela (regra 6.1.2)
 * é garantido pelo caso de uso, e está em `tests/integration/social-network.test.ts`.
 */
const { readMemberBinder, requireViewer } = vi.hoisted(() => ({
  readMemberBinder: vi.fn(),
  requireViewer: vi.fn(async () => ({ id: '1', name: 'Ana', email: 'ana@exemplo' })),
}))

vi.mock('@/server/application/social', () => ({ readMemberBinder }))
vi.mock('@/server/http/viewer', () => ({ requireViewer }))
vi.mock('@/server/application/authorization', () => ({ isPremium: () => true }))
vi.mock('@/app/(app)/social/actions', () => ({
  blockMemberAction: vi.fn(),
  unblockMemberAction: vi.fn(),
  reportMemberAction: vi.fn(),
}))
vi.mock('@/app/(app)/conversas/actions', () => ({ startConversationAction: vi.fn() }))
vi.mock('@/app/(app)/trocas/actions', () => ({ inviteMemberAction: vi.fn() }))
vi.mock('next/navigation', () => ({ notFound: vi.fn(), redirect: vi.fn() }))

const { default: MemberBinderPage } = await import('@/app/(app)/social/[username]/page')

const carta = (variantId: string, cardCode: string, quantity: number) => ({
  variantId,
  cardCode,
  cardName: `Carta ${cardCode}`,
  rarity: 'SR',
  variantType: 'Normal',
  imageUrl: null,
  quantity,
  wanted: false,
})

const binder: MemberBinder = {
  username: 'ana',
  premium: false,
  blocked: false,
  cards: [carta('7', 'OP01-001', 3), carta('9', 'OP05-009', 1)],
  copies: 4,
  interest: 0,
}

const abrir = async () => {
  readMemberBinder.mockResolvedValue(binder)
  // `searchParams` nao e usado pela pagina, mas o tipo gerado pelo Next o exige.
  render(
    await MemberBinderPage({
      params: Promise.resolve({ username: 'ana' }),
      searchParams: Promise.resolve({}),
    }),
  )
}

describe('o Trade Binder de alguém', () => {
  it('a arte de cada carta leva à carta no catálogo', async () => {
    await abrir()

    expect(screen.getByRole('link', { name: 'Ver OP01-001 no catálogo' })).toHaveAttribute(
      'href',
      '/catalogo/carta/7',
    )
    expect(screen.getByRole('link', { name: 'Ver OP05-009 no catálogo' })).toHaveAttribute(
      'href',
      '/catalogo/carta/9',
    )
  })

  /* Tocar no selo abre a carta: ele fica sobre a arte, dentro do link. */
  it('o selo de quantidade fica dentro do link', async () => {
    await abrir()

    expect(screen.getByRole('link', { name: 'Ver OP01-001 no catálogo' })).toHaveTextContent('x3')
  })
})
