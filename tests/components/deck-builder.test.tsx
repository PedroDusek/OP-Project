import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeckBuilder } from '@/components/decks/deck-builder'
import { ToastProvider } from '@/components/ui/toast'
import type { CatalogVocabulary } from '@/server/application/catalog/vocabulary'
import type { SavedDeck } from '@/server/application/decks'

/**
 * A decklist leva ao catálogo pela arte (pedido do dono do produto em 11/11).
 *
 * O que se testa aqui é o endereço e o nome acessível do link, nos dois lugares
 * em que a arte aparece antes de conferir: o líder e a lista em edição. A
 * terceira — a conferência — usa o **mesmo** componente, e cobri-la exigiria
 * encenar a Server Action inteira para provar o que já está provado.
 *
 * As ações são dublê porque a tela as importa; nada aqui as chama.
 */
vi.mock('@/app/(app)/deck/actions', () => ({
  conferirDeckAction: vi.fn(),
  salvarDeckAction: vi.fn(),
  adicionarFaltantesAction: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/deck/3',
  useSearchParams: () => new URLSearchParams(),
}))

const vocabulary: CatalogVocabulary = {
  sets: [],
  types: [],
  rarities: [],
  variantTypes: [],
  colors: ['Vermelho'],
  attributes: [],
  mechanics: [],
  traits: [],
  costRange: null,
  powerRange: null,
}

const deck: SavedDeck = {
  id: '3',
  name: 'Sabo Vermelho',
  leader: {
    variantId: '70',
    cardCode: 'OP13-004',
    cardName: 'Sabo',
    variantType: 'Normal',
    imageUrl: null,
    colors: ['Vermelho'],
  },
  lines: [
    {
      variantId: '81',
      cardCode: 'OP17-080',
      cardName: 'Usopp',
      variantType: 'Normal',
      imageUrl: null,
      copies: 4,
    },
  ],
}

/* O painel de transferir usa o toast, e ele monta junto com a tela. */
const montar = () =>
  render(
    <ToastProvider>
      <DeckBuilder vocabulary={vocabulary} initialLeaders={[]} savedDeck={deck} />
    </ToastProvider>,
  )

describe('DeckBuilder: a arte leva ao catálogo', () => {
  it('a arte do líder abre a carta dele', () => {
    montar()

    expect(screen.getByRole('link', { name: 'Ver OP13-004 no catálogo' })).toHaveAttribute(
      'href',
      '/catalogo/carta/70',
    )
  })

  it('a arte de cada linha abre a carta daquela linha', () => {
    montar()

    expect(screen.getByRole('link', { name: 'Ver OP17-080 no catálogo' })).toHaveAttribute(
      'href',
      '/catalogo/carta/81',
    )
  })

  /*
   * O código e o nome já aparecem escritos ao lado da arte. Com `alt` neles
   * também, o leitor de tela anunciaria a mesma carta duas vezes por linha —
   * numa lista de 51, cento e duas leituras onde bastam cinquenta e uma.
   */
  it('o nome da carta não é lido duas vezes: quem nomeia é o link', () => {
    montar()

    expect(screen.getByRole('link', { name: 'Ver OP17-080 no catálogo' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Usopp' })).not.toBeInTheDocument()
  })
})
