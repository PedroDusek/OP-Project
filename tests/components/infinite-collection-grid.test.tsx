import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InfiniteCollectionGrid } from '@/components/collection/infinite-collection-grid'
import type { CollectionCardView } from '@/components/collection/collection-grid'

/*
 * A grade abre a edição de quantidade ao tocar numa carta, e isso puxa a Server
 * Action — que num teste de componente seria o módulo do servidor de verdade,
 * com Prisma junto. O dublê aqui é o mesmo de `collection-ui`.
 */
vi.mock('@/app/(app)/colecao/actions', () => ({
  setQuantityAction: vi.fn(async () => ({ status: 'idle' })),
}))

/**
 * A grade da coleção carregando mais (20/09).
 *
 * Até esta data a tela trazia no máximo 100 cartas e parava ali, calada: um
 * testador com 131 não via 31 delas. A mecânica é a mesma do catálogo, e o que
 * se protege aqui é a ligação: a rota certa, a página seguinte, e o recorte da
 * aba indo junto.
 */

const cartas = (de: number, quantas: number): CollectionCardView[] =>
  Array.from({ length: quantas }, (_, i) => ({
    variantId: String(de + i),
    cardCode: `OP01-${String(de + i).padStart(3, '0')}`,
    cardName: 'Exemplo',
    rarity: 'C',
    variantType: 'Normal',
    imageUrl: null,
    quantity: 2,
    quantityForCard: 2,
    playsetClosed: false,
  }))

const montar = (props: Partial<Parameters<typeof InfiniteCollectionGrid>[0]> = {}) =>
  render(
    <InfiniteCollectionGrid
      initialItems={cartas(1, 3)}
      total={6}
      pageSize={3}
      apiQuery="pageSize=3&scope=all"
      showPlayset
      {...props}
    />,
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('InfiniteCollectionGrid', () => {
  it('oferece o botão enquanto houver mais, e diz quantas são', () => {
    montar()

    expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('6 cartas')
  })

  it('some com o botão quando tudo já veio', () => {
    montar({ total: 3 })

    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
  })

  /* A rota é a da coleção, e o recorte da aba vai junto — senão a leva seguinte
     viria de outro recorte e se misturaria com o que está na tela. */
  it('pede a próxima página à rota da coleção, com o recorte', async () => {
    const chamadas = vi.fn(
      async () => new Response(JSON.stringify({ items: cartas(4, 3) }), { status: 200 }),
    )
    vi.stubGlobal('fetch', chamadas)

    montar({ apiQuery: 'pageSize=3&scope=playsets' })
    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))

    // O código aparece duas vezes por carta — texto e lugar da arte —, então a
    // espera é pelo botão, que some quando a última leva chega.
    await screen.findByRole('status')
    expect(chamadas).toHaveBeenCalledWith('/api/colecao?pageSize=3&scope=playsets&page=2')
    expect(await screen.findAllByText('OP01-004')).not.toHaveLength(0)
    // A leva nova entra **junto** com a que já estava.
    expect(screen.getAllByText('OP01-001').length).toBeGreaterThan(0)
  })

  it('mostra o erro e deixa tentar de novo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))

    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível/i)
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })
})
