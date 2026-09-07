import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetList } from '@/components/catalog/set-list'
import { SetHeader } from '@/components/catalog/set-header'
import { CatalogResults } from '@/components/catalog/catalog-results'
import { InfiniteCardGrid, type CatalogItemView } from '@/components/catalog/infinite-card-grid'
import { VariantDetail } from '@/components/catalog/variant-detail'
import { ToastProvider } from '@/components/ui/toast'
import type { SetSummary } from '@/server/application/catalog/list-sets'
import type { CatalogResult } from '@/server/application/catalog/search-cards'

const SETS: SetSummary[] = [
  {
    code: 'OP01', displayCode: 'OP01',
    name: '-ROMANCE DAWN-',
    displayName: 'ROMANCE DAWN',
    variantCount: 154,
    kind: 'collection',
    coverUrl: 'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png',
  },
  {
    code: 'OP-13', displayCode: 'OP13',
    name: '-CARRYING ON HIS WILL-',
    displayName: 'CARRYING ON HIS WILL',
    variantCount: 175,
    kind: 'collection',
    coverUrl: null,
  },
  {
    code: 'ST-01', displayCode: 'ST01',
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

    await userEvent.click(screen.getByRole('tab', { name: /Starter Decks/ }))

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
    expect(screen.getByRole('tab', { name: /Starter Decks.*1/ })).toBeInTheDocument()
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

  it('deck volta para os starter decks', () => {
    render(<SetHeader set={SETS[2]} />)
    expect(screen.getByRole('link', { name: /Starter Decks/ })).toHaveAttribute(
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
  const query = { pageSize: 24 }

  it('mostra o total e leva ao detalhe de cada variante', () => {
    render(<CatalogResults result={result()} query={query} />)

    expect(screen.getByRole('status')).toHaveTextContent('2 cartas')
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/catalogo/carta/1')
  })

  /**
   * A lista filtrada vive na URL, mas o detalhe e outra rota. Sem carregar a
   * origem, voltar devolvia o catalogo inteiro — e quem filtrou por azul para
   * registrar cinco cartas azuis refazia o filtro cinco vezes.
   */
  it('carrega a lista de origem no link de cada carta', () => {
    render(
      <CatalogResults result={result()} query={query} origin="/catalogo?cor=Blue&cor=Black" />,
    )

    expect(screen.getAllByRole('link')[0]).toHaveAttribute(
      'href',
      `/catalogo/carta/1?de=${encodeURIComponent('/catalogo?cor=Blue&cor=Black')}`,
    )
  })

  it('sem origem, o link continua limpo', () => {
    render(<CatalogResults result={result()} query={query} />)

    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/catalogo/carta/1')
  })

  /** "Normal" em toda carta é ruído: o que se procura na grade é o que não é. */
  it('etiqueta a variante só quando ela não é Normal', () => {
    render(<CatalogResults result={result()} query={query} />)

    expect(screen.getByText('Parallel')).toBeInTheDocument()
    expect(screen.queryByText('Normal')).not.toBeInTheDocument()
  })

  it('não mostra quantidade: isso é informação de coleção', () => {
    render(<CatalogResults result={result()} query={query} />)
    expect(screen.queryByText(/^x\d+$/)).not.toBeInTheDocument()
  })

  it('explica o vazio em vez de mostrar grade vazia', () => {
    render(<CatalogResults result={result({ items: [], total: 0 })} query={query} />)

    expect(screen.getByText('Nenhuma carta encontrada')).toBeInTheDocument()
  })

  /**
   * Saiu com a paginação: com rolagem infinita, "mostrando 1–24" descreveria um
   * recorte que muda sozinho enquanto a pessoa rola.
   */
  it('não anuncia mais a faixa exibida', () => {
    render(
      <CatalogResults
        result={result({ page: 1, pageSize: 24, total: 100, totalPages: 5 })}
        query={query}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('100 cartas')
    expect(screen.queryByText(/mostrando/i)).not.toBeInTheDocument()
  })
})

describe('InfiniteCardGrid', () => {
  const items = (from: number, count: number): CatalogItemView[] =>
    Array.from({ length: count }, (_, i) => ({
      variantId: String(from + i),
      cardCode: `OP01-${String(from + i).padStart(3, '0')}`,
      cardName: 'Exemplo',
      rarity: 'C',
      variantType: 'Normal',
      imageUrl: null,
    }))

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /**
   * O botão **é** o sentinela: o observador dispara a mesma carga que o clique.
   * É o que salva quem navega por teclado e nunca "rola até o fim".
   */
  it('oferece um botão alcançável enquanto houver mais', () => {
    render(<InfiniteCardGrid initialItems={items(1, 3)} total={10} pageSize={3} apiQuery="pageSize=3" />)

    expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeInTheDocument()
  })

  it('some com o botão quando tudo já veio', () => {
    render(<InfiniteCardGrid initialItems={items(1, 3)} total={3} pageSize={3} apiQuery="pageSize=3" />)

    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
  })

  it('acrescenta a leva seguinte à grade', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ items: items(4, 3) }), { status: 200 })),
    )

    render(<InfiniteCardGrid initialItems={items(1, 3)} total={6} pageSize={3} apiQuery="pageSize=3" />)
    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('link', { name: /OP01-004/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /OP01-001/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
  })

  /** A cota da API é o que sustenta o compromisso de não reexpor o catálogo. */
  it('pede a próxima página à API, com a consulta e a página', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ items: items(4, 3) }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <InfiniteCardGrid
        initialItems={items(1, 3)}
        total={9}
        pageSize={3}
        apiQuery="setCode=OP01&pageSize=3"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))

    await screen.findByRole('link', { name: /OP01-004/ })
    expect(fetchMock).toHaveBeenCalledWith('/api/catalog?setCode=OP01&pageSize=3&page=2')
  })

  it('mostra o erro e deixa repetir', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: 'Muitas tentativas.' } }), { status: 429 }),
      ),
    )

    render(<InfiniteCardGrid initialItems={items(1, 3)} total={9} pageSize={3} apiQuery="pageSize=3" />)
    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas.')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  /**
   * Trocar de filtro monta uma grade nova. Sem isso, os resultados novos
   * apareceriam concatenados aos antigos.
   */
  it('recomeça quando a lista inicial muda', () => {
    const { rerender } = render(
      <InfiniteCardGrid initialItems={items(1, 3)} total={9} pageSize={3} apiQuery="pageSize=3" />,
    )
    expect(screen.getByRole('link', { name: /OP01-001/ })).toBeInTheDocument()

    rerender(
      <InfiniteCardGrid initialItems={items(50, 2)} total={2} pageSize={3} apiQuery="pageSize=3" />,
    )

    expect(screen.queryByRole('link', { name: /OP01-001/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /OP01-050/ })).toBeInTheDocument()
  })
})

describe('VariantDetail', () => {
  /*
   * O detalhe passou a conter o botao de adicionar a colecao, que confirma o
   * salvamento por toast. O provedor vive no layout raiz da aplicacao; aqui ele
   * entra em volta do componente sob teste.
   */
  const renderDetail = (props: Parameters<typeof VariantDetail>[0]) =>
    render(
      <ToastProvider>
        <VariantDetail {...props} />
      </ToastProvider>,
    )

  const variant = {
    variantId: 1n,
    variantType: 'Normal',
    rarity: 'SR',
    imageUrl: 'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png',
    sets: [{ code: 'OP01', displayCode: 'OP01', name: '-ROMANCE DAWN-' }],
    card: {
      code: 'OP01-001', displayCode: 'OP01-001',
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
    renderDetail({ variant: variant })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Roronoa Zoro')
    expect(screen.getByText('OP01-001')).toBeInTheDocument()
  })

  /**
   * A arte passa pelo otimizador do Next, que serve do nosso dominio: o servidor
   * da Bandai manda `cross-origin-resource-policy: same-site` e o navegador
   * recusaria a imagem vinda direto de la. Ver a decisao 038.
   */
  it('serve a arte pelo otimizador, apontando para a origem', () => {
    renderDetail({ variant: variant })

    const src = screen.getByRole('img', { name: 'OP01-001 — Roronoa Zoro' }).getAttribute('src')
    expect(src).toContain('/_next/image')
    expect(decodeURIComponent(src ?? '')).toContain(
      'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png',
    )
  })

  /**
   * `Leader` não tem custo e tem `life`; `Event` não tem poder. Linha vazia
   * para cada ausência encheria a ficha de traços.
   */
  it('omite a linha do dado que a carta não tem', () => {
    renderDetail({ variant: variant })

    expect(screen.getByText('Poder')).toBeInTheDocument()
    expect(screen.queryByText('Life')).not.toBeInTheDocument()
    expect(screen.queryByText('Bloqueio')).not.toBeInTheDocument()
  })

  it('mostra o set sem os hifens decorativos e leva até ele', () => {
    renderDetail({ variant: variant })

    const link = screen.getByRole('link', { name: /ROMANCE DAWN/ })
    expect(link).toHaveAttribute('href', '/catalogo/sets/OP01')
    expect(link).toHaveTextContent('ROMANCE DAWN')
  })

  it('marca a arte atual entre as demais', () => {
    renderDetail({ variant: variant })

    const atual = screen.getByRole('link', { current: 'page' })
    expect(atual).toHaveAttribute('href', '/catalogo/carta/1')
  })

  /**
   * O detalhe passou a oferecer a acao de colecao. Sem ela o catalogo nao leva a
   * lugar nenhum: da para navegar o jogo inteiro e nao registrar uma carta.
   */
  it('oferece adicionar a colecao para quem nao tem a carta', () => {
    renderDetail({ variant, ownedQuantity: 0 })

    expect(screen.getByRole('button', { name: /Adicionar à coleção/ })).toBeInTheDocument()
  })

  it('oferece editar, e mostra o que ja tem, para quem tem', () => {
    renderDetail({ variant, ownedQuantity: 3 })

    expect(screen.getByRole('button', { name: /Editar quantidade/ })).toBeInTheDocument()
    expect(screen.getByText(/Na sua coleção/)).toHaveTextContent('3')
  })

  /** Preco, want e disponibilidade dependem de checkpoints seguintes. */
  it('nao oferece o que ainda nao existe', () => {
    renderDetail({ variant })

    expect(screen.queryByRole('button', { name: /want/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/preço de mercado/i)).not.toBeInTheDocument()
  })

  it('esconde a seção de outras artes quando só há uma', () => {
    renderDetail({ variant: { ...variant, siblings: [variant.siblings[0]] } })

    expect(screen.queryByText(/Outras artes/)).not.toBeInTheDocument()
  })
})

/*
 * A acao de servidor arrasta o Prisma no grafo de modulos. No Next ela vira uma
 * referencia e nao chega ao navegador — o build confirma —, mas o jsdom importa
 * de verdade e esbarra na falta de DATABASE_URL. Mockar aqui testa o componente,
 * que e o que este arquivo quer.
 */
vi.mock('@/app/(app)/colecao/actions', () => ({
  setQuantityAction: vi.fn(async () => ({ status: 'idle' })),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/catalogo',
  useSearchParams: () => new URLSearchParams(),
}))
