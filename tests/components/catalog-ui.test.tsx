import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetList } from '@/components/catalog/set-list'
import { SetHeader } from '@/components/catalog/set-header'
import { CatalogResults } from '@/components/catalog/catalog-results'
import { VariantDetail } from '@/components/catalog/variant-detail'
import { Pagination } from '@/components/ui/pagination'
import type { SetSummary } from '@/server/application/catalog/list-sets'
import type { CatalogResult } from '@/server/application/catalog/search-cards'

const SETS: SetSummary[] = [
  {
    code: 'OP01',
    name: '-ROMANCE DAWN-',
    displayName: 'ROMANCE DAWN',
    variantCount: 154,
    kind: 'collection',
    coverUrl: 'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png',
  },
  {
    code: 'OP-13',
    name: '-CARRYING ON HIS WILL-',
    displayName: 'CARRYING ON HIS WILL',
    variantCount: 175,
    kind: 'collection',
    coverUrl: null,
  },
  {
    code: 'ST-01',
    name: '-Straw Hat Crew-',
    displayName: 'Straw Hat Crew',
    variantCount: 17,
    kind: 'deck',
    coverUrl: null,
  },
]

function result(overrides: Partial<CatalogResult> = {}): CatalogResult {
  return {
    items: [
      {
        variantId: 1n,
        sourceId: 'OP01-001',
        cardCode: 'OP01-001',
        cardName: 'Roronoa Zoro',
        type: 'Character',
        variantType: 'Normal',
        rarity: 'SR',
        imageUrl: 'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png',
        cost: 3,
        power: 5000,
        counter: 1000,
        hasTrigger: false,
      },
      {
        variantId: 2n,
        sourceId: 'OP01-001_p1',
        cardCode: 'OP01-001',
        cardName: 'Roronoa Zoro',
        type: 'Character',
        variantType: 'Parallel',
        rarity: 'SR',
        imageUrl: null,
        cost: 3,
        power: 5000,
        counter: 1000,
        hasTrigger: false,
      },
    ],
    page: 1,
    pageSize: 24,
    total: 2,
    totalPages: 1,
    ...overrides,
  }
}

describe('SetList', () => {
  it('mostra o nome sem os hifens decorativos, com código e contagem', () => {
    render(<SetList sets={SETS} />)

    const item = screen.getByRole('link', { name: /ROMANCE DAWN/ })
    expect(within(item).getByText('ROMANCE DAWN')).toBeInTheDocument()
    expect(within(item).getByText(/154 cartas/)).toBeInTheDocument()
  })

  it('leva ao set com o código codificado na URL', () => {
    render(<SetList sets={SETS} />)

    expect(screen.getByRole('link', { name: /CARRYING ON HIS WILL/ })).toHaveAttribute(
      'href',
      '/catalogo/sets/OP-13',
    )
  })

  /** A palavra na tela e "cartas"; a contagem continua sendo de variantes. */
  it('diz cartas, e usa singular para uma só', () => {
    render(<SetList sets={[{ ...SETS[0], variantCount: 1 }]} />)
    expect(screen.getByText(/1 carta$/)).toBeInTheDocument()
  })

  it('filtra por código e por nome', async () => {
    render(<SetList sets={SETS} />)
    const busca = screen.getByRole('searchbox', { name: 'Buscar sets' })

    await userEvent.type(busca, 'romance')
    expect(screen.getAllByRole('link')).toHaveLength(1)

    await userEvent.clear(busca)
    await userEvent.type(busca, 'OP-13')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  /**
   * Coleções e decks são coisas diferentes de procurar: 36 decks iniciantes no
   * meio das coletâneas atrapalham quem quer saber o que falta de um booster.
   */
  it('separa coleções de decks', async () => {
    render(<SetList sets={SETS} />)

    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.queryByText('Straw Hat Crew')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /Decks/ }))

    expect(screen.getByText('Straw Hat Crew')).toBeInTheDocument()
    expect(screen.queryByText('ROMANCE DAWN')).not.toBeInTheDocument()
  })

  it('abre direto na categoria pedida pela rota', () => {
    render(<SetList sets={SETS} initialKind="deck" />)
    expect(screen.getByText('Straw Hat Crew')).toBeInTheDocument()
  })

  it('conta cada categoria na aba', () => {
    render(<SetList sets={SETS} />)

    expect(screen.getByRole('tab', { name: /Coleções.*2/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Decks.*1/ })).toBeInTheDocument()
  })

  /** Buscar pela grafia da fonte, com hifens, ainda encontra. */
  it('casa também com o nome como a fonte publicou', async () => {
    render(<SetList sets={SETS} />)

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar sets' }), '-ROMANCE')

    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('explica o vazio quando nada casa', async () => {
    render(<SetList sets={SETS} />)

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar sets' }), 'zzzz')

    expect(screen.getByText('Nenhum set encontrado')).toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})

describe('SetHeader', () => {
  it('é o h1 da página do set', () => {
    render(<SetHeader set={SETS[0]} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ROMANCE DAWN')
    expect(screen.getByText('OP01')).toBeInTheDocument()
    expect(screen.getByText('154 cartas')).toBeInTheDocument()
  })

  it('volta para a categoria de onde veio', () => {
    render(<SetHeader set={SETS[0]} />)
    expect(screen.getByRole('link', { name: /Coleções/ })).toHaveAttribute(
      'href',
      '/catalogo/sets?tipo=collection',
    )
  })

  it('deck volta para os decks', () => {
    render(<SetHeader set={SETS[2]} />)
    expect(screen.getByRole('link', { name: /Decks/ })).toHaveAttribute(
      'href',
      '/catalogo/sets?tipo=deck',
    )
  })

  /**
   * A arte é a primeira carta do set, decorativa: entra com `alt` vazio, porque
   * o código e o nome já estão escritos ao lado e repeti-los seria ruído.
   */
  it('usa a arte do set como ambientação, sem anunciá-la', () => {
    const { container } = render(<SetHeader set={SETS[0]} />)
    const art = container.querySelector('img')

    expect(art).toHaveAttribute('src', expect.stringContaining('OP01-001.png'))
    expect(art).toHaveAttribute('alt', '')
  })

  it('funciona sem arte', () => {
    render(<SetHeader set={SETS[1]} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('CARRYING ON HIS WILL')
  })
})

describe('CatalogResults', () => {
  it('mostra o total e leva ao detalhe de cada variante', () => {
    render(
      <CatalogResults result={result()} pathname="/catalogo" searchParams={new URLSearchParams()} />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('2 cartas')
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/catalogo/carta/1')
  })

  /**
   * A imagem vem da origem, sem passar pelo otimizador do `next/image`, que
   * baixaria o arquivo e o serviria do nosso domínio (decisões 020 e 026).
   */
  it('referencia a imagem na origem', () => {
    render(
      <CatalogResults result={result()} pathname="/catalogo" searchParams={new URLSearchParams()} />,
    )

    const image = screen.getByRole('img', { name: /OP01-001/ })
    expect(image).toHaveAttribute('src', expect.stringContaining('en.onepiece-cardgame.com'))
    expect(image).toHaveAttribute('loading', 'lazy')
  })

  /** "Normal" em toda carta é ruído: o que se procura na grade é o que não é. */
  it('etiqueta a variante só quando ela não é Normal', () => {
    render(
      <CatalogResults result={result()} pathname="/catalogo" searchParams={new URLSearchParams()} />,
    )

    expect(screen.getByText('Parallel')).toBeInTheDocument()
    expect(screen.queryByText('Normal')).not.toBeInTheDocument()
  })

  it('não mostra quantidade: isso é informação de coleção', () => {
    render(
      <CatalogResults result={result()} pathname="/catalogo" searchParams={new URLSearchParams()} />,
    )
    expect(screen.queryByText(/^x\d+$/)).not.toBeInTheDocument()
  })

  it('explica o vazio em vez de mostrar grade vazia', () => {
    render(
      <CatalogResults
        result={result({ items: [], total: 0 })}
        pathname="/catalogo"
        searchParams={new URLSearchParams()}
      />,
    )

    expect(screen.getByText('Nenhuma carta encontrada')).toBeInTheDocument()
  })

  it('mostra a faixa exibida quando há mais de uma página', () => {
    render(
      <CatalogResults
        result={result({ page: 2, pageSize: 24, total: 100, totalPages: 5 })}
        pathname="/catalogo"
        searchParams={new URLSearchParams()}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('mostrando 25–48')
  })
})

describe('Pagination', () => {
  const hrefFor = (page: number) => `/catalogo?pagina=${page}`

  it('não aparece com uma página só', () => {
    const { container } = render(<Pagination page={1} totalPages={1} hrefFor={hrefFor} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('anuncia a posição e liga as duas pontas', () => {
    render(<Pagination page={3} totalPages={12} hrefFor={hrefFor} />)

    expect(screen.getByText('Página 3 de 12')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Anterior/ })).toHaveAttribute(
      'href',
      '/catalogo?pagina=2',
    )
    expect(screen.getByRole('link', { name: /Próxima/ })).toHaveAttribute(
      'href',
      '/catalogo?pagina=4',
    )
  })

  /** O alvo continua no lugar nas pontas, em vez de sumir e mover os outros. */
  it('desabilita sem remover nas pontas', () => {
    render(<Pagination page={1} totalPages={5} hrefFor={hrefFor} />)

    expect(screen.getByRole('link', { name: /Anterior/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('link', { name: /Próxima/ })).not.toHaveAttribute('aria-disabled', 'true')
  })
})

describe('VariantDetail', () => {
  const variant = {
    variantId: 1n,
    variantType: 'Normal',
    rarity: 'SR',
    imageUrl: 'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png',
    sets: [{ code: 'OP01', name: '-ROMANCE DAWN-' }],
    card: {
      code: 'OP01-001',
      name: 'Roronoa Zoro',
      type: 'Character',
      cost: 3,
      power: 5000,
      life: null,
      counter: 1000,
      hasTrigger: false,
      blockIcon: null,
      colors: ['Green'],
      traits: ['Supernovas', 'Straw Hat Crew'],
      attributes: ['Slash'],
      mechanics: [],
      effects: [],
    },
    siblings: [
      { variantId: 1n, variantType: 'Normal', rarity: 'SR', imageUrl: null, current: true },
      { variantId: 2n, variantType: 'Parallel', rarity: 'SR', imageUrl: null, current: false },
    ],
  }

  it('é o h1, com o código acima', () => {
    render(<VariantDetail variant={variant} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Roronoa Zoro')
    expect(screen.getByText('OP01-001')).toBeInTheDocument()
  })

  it('mostra a arte da variante, referenciada na origem', () => {
    render(<VariantDetail variant={variant} />)

    expect(screen.getByRole('img', { name: 'OP01-001 — Roronoa Zoro' })).toHaveAttribute(
      'src',
      'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png',
    )
  })

  /**
   * `Leader` não tem custo e tem `life`; `Event` não tem poder. Linha vazia
   * para cada ausência encheria a ficha de traços.
   */
  it('omite a linha do dado que a carta não tem', () => {
    render(<VariantDetail variant={variant} />)

    expect(screen.getByText('Poder')).toBeInTheDocument()
    expect(screen.queryByText('Life')).not.toBeInTheDocument()
    expect(screen.queryByText('Bloqueio')).not.toBeInTheDocument()
  })

  it('mostra o set sem os hifens decorativos e leva até ele', () => {
    render(<VariantDetail variant={variant} />)

    const link = screen.getByRole('link', { name: /ROMANCE DAWN/ })
    expect(link).toHaveAttribute('href', '/catalogo/sets/OP01')
    expect(link).toHaveTextContent('ROMANCE DAWN')
  })

  it('marca a arte atual entre as demais', () => {
    render(<VariantDetail variant={variant} />)

    const atual = screen.getByRole('link', { current: 'page' })
    expect(atual).toHaveAttribute('href', '/catalogo/carta/1')
  })

  it('não oferece ação de coleção, que ainda não existe', () => {
    render(<VariantDetail variant={variant} />)

    expect(screen.queryByRole('button', { name: /adicionar/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/quantidade/i)).not.toBeInTheDocument()
  })

  it('esconde a seção de outras artes quando só há uma', () => {
    render(<VariantDetail variant={{ ...variant, siblings: [variant.siblings[0]] }} />)

    expect(screen.queryByText(/Outras artes/)).not.toBeInTheDocument()
  })
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/catalogo',
  useSearchParams: () => new URLSearchParams(),
}))
