import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocationForm } from '@/components/storage/location-form'
import { LocationList } from '@/components/storage/location-list'
import { StoredCards } from '@/components/storage/stored-cards'
import { VariantAllocationsPanel } from '@/components/storage/variant-allocations'
import { PlaceCards } from '@/components/storage/place-cards'
import { UnallocatedNotice } from '@/components/storage/unallocated-notice'
import { LocationHeader } from '@/components/storage/location-header'
import { BulkAdd } from '@/components/storage/bulk-add'
import type { CatalogVocabulary } from '@/server/application/catalog/vocabulary'
import { ToastProvider } from '@/components/ui/toast'
import { formError } from '@/server/http/form-state'
import type {
  StorageLocationDetail,
  StorageLocationSummary,
  StoredCardView,
  UnallocatedCard,
} from '@/server/application/storage'

/*
 * As acoes de servidor arrastam o Prisma no grafo de modulos. No Next elas
 * viram referencia e nao chegam ao navegador; no jsdom, sao importadas de
 * verdade.
 */
const setAllocationAction = vi.hoisted(() =>
  vi.fn(async (_previous: unknown, data: FormData) => ({
    status: 'saved' as const,
    quantity: Number(data.get('quantity')),
    storageLocationId: String(data.get('storageLocationId')),
  })),
)

const placeCopiesAction = vi.hoisted(() =>
  vi.fn(async (_previous: unknown, data: FormData) => ({
    status: 'saved' as const,
    quantity: Number(data.get('copies')),
    storageLocationId: String(data.get('storageLocationId')),
  })),
)

const moveCopiesAction = vi.hoisted(() =>
  vi.fn(async (_previous: unknown, data: FormData) => ({
    status: 'moved' as const,
    copies: Number(data.get('copies')),
    toStorageLocationId: String(data.get('toStorageLocationId')),
  })),
)

const bulkAddAction = vi.hoisted(() =>
  vi.fn(async (_previous: unknown, data: FormData) => ({
    status: 'added' as const,
    cards: data.getAll('carta').length,
    copies: data
      .getAll('carta')
      .reduce((sum, entry) => sum + Number(String(entry).split(':')[1]), 0),
  })),
)

/*
 * `CatalogFilters` — reusado pela adicao em massa — fala com o roteador. Aqui
 * ele nao navega (recebe `onApply`), mas os ganchos precisam existir.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/binders/9/adicionar',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/app/(app)/binders/actions', () => ({
  setAllocationAction,
  placeCopiesAction,
  moveCopiesAction,
  bulkAddAction,
  deleteLocationAction: vi.fn(),
  createLocationAction: vi.fn(),
  updateLocationAction: vi.fn(),
}))

afterEach(() => {
  setAllocationAction.mockClear()
  placeCopiesAction.mockClear()
  moveCopiesAction.mockClear()
  bulkAddAction.mockClear()
})

const withToast = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>)

describe('LocationForm', () => {
  const noop = async () => ({ status: 'idle' as const })

  it('começa como binder de coleção', () => {
    render(<LocationForm action={noop} submitLabel="Criar local" imageUploadAvailable={false} />)

    expect(screen.getByRole('radio', { name: 'Binder' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Coleção' })).toBeChecked()
  })

  /**
   * Deck não tem finalidade (`business-rules.md` 3.1). O campo fica
   * desabilitado em vez de sumir: sumir faria a tela pular de altura.
   */
  it('desabilita a finalidade ao escolher deck, e explica', async () => {
    render(<LocationForm action={noop} submitLabel="Criar local" imageUploadAvailable={false} />)

    await userEvent.click(screen.getByRole('radio', { name: 'Deck' }))

    expect(screen.getByRole('radio', { name: 'Coleção' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Troca' })).toBeDisabled()
    expect(screen.getByText('A finalidade não se aplica a Decks.')).toBeInTheDocument()
  })

  it('volta a oferecer a finalidade ao sair de deck', async () => {
    render(<LocationForm action={noop} submitLabel="Criar local" imageUploadAvailable={false} />)

    await userEvent.click(screen.getByRole('radio', { name: 'Deck' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Caixa' }))

    expect(screen.getByRole('radio', { name: 'Troca' })).toBeEnabled()
  })

  /**
   * O campo vazio nem chega ao servidor: `required` no HTML barra o envio no
   * proprio navegador. O erro que interessa testar e o que so o servidor sabe.
   */
  it('mostra o erro do servidor no campo certo', async () => {
    const recusa = async () => formError('', { name: ['O nome pode ter até 100 caracteres.'] })
    render(<LocationForm action={recusa} submitLabel="Criar local" imageUploadAvailable={false} />)

    await userEvent.type(screen.getByRole('textbox', { name: /Nome/ }), 'Binder')
    await userEvent.click(screen.getByRole('button', { name: 'Criar local' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O nome pode ter até 100 caracteres.',
    )
    expect(screen.getByRole('textbox', { name: /Nome/ })).toHaveAttribute('aria-invalid', 'true')
  })

  /**
   * O React reinicia o `<form action>` quando a ação termina, inclusive em
   * erro. Sem campos controlados, o que a pessoa digitou some junto com a
   * mensagem que explica o problema.
   */
  it('mantém o que foi digitado depois de uma recusa', async () => {
    const recusa = async () => formError('', { name: ['Nome longo demais.'] })
    render(<LocationForm action={recusa} submitLabel="Criar local" imageUploadAvailable={false} />)

    const nome = screen.getByRole('textbox', { name: /Nome/ })
    await userEvent.type(nome, 'Binder Principal')
    await userEvent.click(screen.getByRole('button', { name: 'Criar local' }))

    await screen.findByRole('alert')
    expect(nome).toHaveValue('Binder Principal')
  })

  /** Sem provedor configurado, oferecer o campo seria oferecer uma falha. */
  it('esconde a foto quando o envio não está configurado', () => {
    render(<LocationForm action={noop} submitLabel="Criar local" imageUploadAvailable={false} />)

    expect(screen.queryByText('Adicionar foto')).not.toBeInTheDocument()
  })

  it('oferece a foto quando o envio está configurado', () => {
    render(<LocationForm action={noop} submitLabel="Criar local" imageUploadAvailable />)

    expect(screen.getByText('Adicionar foto')).toBeInTheDocument()
  })

  it('na edição, parte dos valores atuais', () => {
    render(
      <LocationForm
        action={noop}
        submitLabel="Salvar"
        imageUploadAvailable={false}
        initial={{
          id: '7',
          name: 'Caixa Troca',
          description: 'Cartas repetidas',
          type: 'BOX',
          purpose: 'TRADE',
          image: null,
        }}
      />,
    )

    expect(screen.getByRole('textbox', { name: /Nome/ })).toHaveValue('Caixa Troca')
    expect(screen.getByRole('radio', { name: 'Caixa' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Troca' })).toBeChecked()
  })
})

describe('LocationList', () => {
  const location = (overrides: Partial<StorageLocationSummary> = {}): StorageLocationSummary => ({
    id: '1',
    name: 'Binder Principal',
    type: 'BINDER',
    purpose: 'COLLECTION',
    image: null,
    subtitle: 'Binder • Coleção',
    cardCount: 48,
    ...overrides,
  })

  const listados = () => screen.queryAllByRole('link').map((row) => row.textContent)

  it('mostra tipo, finalidade e contagem em cada linha', () => {
    render(<LocationList locations={[location()]} />)

    const linha = screen.getByRole('link')
    expect(linha).toHaveTextContent('Binder Principal')
    expect(linha).toHaveTextContent('Binder • Coleção')
    expect(linha).toHaveTextContent('48 cartas')
  })

  it('filtra por tipo', async () => {
    render(
      <LocationList
        locations={[
          location({ id: '1', name: 'Binder Principal' }),
          location({ id: '2', name: 'Deck Sabo', type: 'DECK', purpose: null, subtitle: 'Deck' }),
        ]}
      />,
    )

    await userEvent.click(screen.getByRole('tab', { name: /^Decks/ }))

    expect(listados()).toHaveLength(1)
    expect(screen.getByRole('link')).toHaveTextContent('Deck Sabo')
  })

  /** Uma aba ausente parece um recurso que não existe; "(0)" é uma gaveta vazia. */
  it('mostra a contagem mesmo quando é zero', () => {
    render(<LocationList locations={[location()]} />)

    expect(screen.getByRole('tab', { name: /^Caixas/ })).toHaveTextContent('(0)')
  })
})

describe('StoredCards', () => {
  const card = (overrides: Partial<StoredCardView> = {}): StoredCardView => ({
    variantId: '1',
    cardCode: 'OP01-001',
    cardName: 'Roronoa Zoro',
    rarity: 'SR',
    variantType: 'Normal',
    imageUrl: null,
    quantity: 2,
    ownedQuantity: 4,
    playsetHere: false,
    ...overrides,
  })

  const render_ = (cards: StoredCardView[]) =>
    withToast(<StoredCards cards={cards} storageLocationId="9" locationName="Binder Principal" />)

  it('mostra quantas cópias estão aqui', () => {
    render_([card({ quantity: 3 })])

    expect(screen.getByText('x3')).toBeInTheDocument()
  })

  it('busca por código e por nome', async () => {
    render_([
      card({ variantId: '1', cardCode: 'OP01-001', cardName: 'Zoro' }),
      card({ variantId: '2', cardCode: 'OP01-002', cardName: 'Nami' }),
    ])

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar neste local' }), 'nami')

    const botoes = screen.getAllByRole('button').filter((b) => b.textContent?.includes('OP01-'))
    expect(botoes).toHaveLength(1)
    expect(botoes[0]).toHaveTextContent('OP01-002')
  })

  /** A lista lê códigos em sequência, que é o que se faz ao conferir um binder. */
  it('a lista mostra quantas estão aqui sobre quantas se tem', async () => {
    render_([card({ quantity: 2, ownedQuantity: 4 })])

    await userEvent.click(screen.getByRole('tab', { name: 'Lista' }))

    expect(screen.getByText('/4')).toBeInTheDocument()
  })

  it('tocar numa carta ajusta quantas estão aqui, não quantas se tem', async () => {
    render_([card({ quantity: 2 })])

    await userEvent.click(screen.getByRole('button', { name: /OP01-001/ }))

    const painel = await screen.findByRole('dialog', { name: 'Quantas estão aqui' })
    expect(within(painel).getByRole('textbox', { name: 'Cópias neste local' })).toHaveValue('2')
  })

  it('envia a quantidade para o local certo', async () => {
    render_([card({ quantity: 2 })])

    await userEvent.click(screen.getByRole('button', { name: /OP01-001/ }))
    const painel = await screen.findByRole('dialog')
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))

    const enviado = setAllocationAction.mock.calls[0][1]
    expect(enviado.get('storageLocationId')).toBe('9')
    expect(enviado.get('variantId')).toBe('1')
    expect(enviado.get('quantity')).toBe('2')
  })

  /**
   * O vazio nao manda mais a pessoa embora: antes dizia "abra uma carta da sua
   * colecao", que era a unica forma de guardar algo — e ficava fora de Binders.
   */
  it('o vazio leva a adicionar cartas neste local', () => {
    render_([])

    expect(screen.getByText('Nada guardado aqui')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Adicionar cartas' })).toHaveAttribute(
      'href',
      '/binders/9/adicionar',
    )
  })
})

describe('VariantAllocationsPanel', () => {
  const painel = (overrides: Partial<Parameters<typeof VariantAllocationsPanel>[0]> = {}) =>
    withToast(
      <VariantAllocationsPanel
        variantId="1"
        code="OP01-001"
        name="Roronoa Zoro"
        imageUrl={null}
        allocations={{
          ownedQuantity: 4,
          allocated: 3,
          unallocated: 1,
          locations: [
            {
              storageLocationId: '9',
              name: 'Binder Principal',
              type: 'BINDER',
              purpose: 'COLLECTION',
              image: null,
              subtitle: 'Binder • Coleção',
              quantity: 3,
            },
            {
              storageLocationId: '10',
              name: 'Deck Sabo',
              type: 'DECK',
              purpose: null,
              image: null,
              subtitle: 'Deck',
              quantity: 0,
            },
          ],
        }}
        {...overrides}
      />,
    )

  /** Uma lista só com o que já foi guardado não deixaria guardar em lugar novo. */
  it('lista também os locais vazios', () => {
    painel()

    expect(screen.getByText('Deck Sabo')).toBeInTheDocument()
  })

  it('diz quantas cópias estão sem lugar', () => {
    painel()

    expect(screen.getByText('1 de 4 sem lugar registrado.')).toBeInTheDocument()
  })

  /**
   * O teto oferecido desconta o que está nos outros locais: possui 4, tem 3 no
   * binder e 0 no deck, então cabem 1 no deck.
   */
  it('oferece só o que cabe naquele local', async () => {
    painel()

    await userEvent.click(screen.getByRole('button', { name: /Deck Sabo/ }))

    const sheet = await screen.findByRole('dialog')
    expect(
      within(sheet).getByText('Cabem até 1 aqui, contando o que está em outros locais.'),
    ).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Aumentar Cópias neste local' }))
    expect(within(sheet).getByRole('button', { name: 'Aumentar Cópias neste local' })).toBeDisabled()
  })

  it('não aparece para quem não tem a carta', () => {
    painel({
      allocations: { ownedQuantity: 0, allocated: 0, unallocated: 0, locations: [] },
    })

    expect(screen.queryByText('Onde está guardada')).not.toBeInTheDocument()
  })
})

describe('UnallocatedNotice', () => {
  /**
   * Cópia sem lugar é estado normal, não defeito. Um alerta vermelho diria que
   * há algo quebrado, e uma tela que grita quando nada está errado ensina a
   * ignorá-la.
   */
  it('convida sem alarmar', () => {
    render(<UnallocatedNotice summary={{ copies: 12, cards: 5 }} />)

    const convite = screen.getByRole('link', { name: /sem lugar/ })
    expect(convite).toHaveAttribute('href', '/binders/sem-lugar')
    expect(convite).toHaveTextContent('12 cópias sem lugar')
    expect(convite).toHaveTextContent('5 cartas')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('some quando a conta fecha', () => {
    const { container } = render(<UnallocatedNotice summary={{ copies: 0, cards: 0 }} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('concorda no singular', () => {
    render(<UnallocatedNotice summary={{ copies: 1, cards: 1 }} />)

    expect(screen.getByRole('link')).toHaveTextContent('1 cópia sem lugar')
    expect(screen.getByRole('link')).toHaveTextContent('1 carta')
  })
})

describe('PlaceCards', () => {
  const solta = (overrides: Partial<UnallocatedCard> = {}): UnallocatedCard => ({
    variantId: '1',
    cardCode: 'OP01-001',
    cardName: 'Roronoa Zoro',
    rarity: 'SR',
    variantType: 'Normal',
    imageUrl: null,
    owned: 4,
    allocated: 1,
    loose: 3,
    ...overrides,
  })

  const locais: StorageLocationSummary[] = [
    {
      id: '9',
      name: 'Binder Principal',
      type: 'BINDER',
      purpose: 'COLLECTION',
      image: null,
      subtitle: 'Binder • Coleção',
      cardCount: 48,
    },
    {
      id: '10',
      name: 'Deck Sabo',
      type: 'DECK',
      purpose: null,
      image: null,
      subtitle: 'Deck',
      cardCount: 50,
    },
  ]

  const abrir = async (cards = [solta()]) => {
    withToast(<PlaceCards cards={cards} locations={locais} />)
    await userEvent.click(screen.getByRole('button', { name: /OP01-001/ }))
    return screen.findByRole('dialog')
  }

  it('mostra quantas estão soltas sobre quantas se tem', () => {
    withToast(<PlaceCards cards={[solta()]} locations={locais} />)

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('/4')).toBeInTheDocument()
  })

  /** Guardar tudo junto é o caso comum: quem abriu um pacote põe as quatro no mesmo binder. */
  it('já vem com todas as soltas escolhidas', async () => {
    const painel = await abrir()

    expect(within(painel).getByRole('textbox', { name: 'Quantas cópias' })).toHaveValue('3')
  })

  it('não deixa guardar mais do que está solto', async () => {
    const painel = await abrir()

    await userEvent.click(within(painel).getByRole('button', { name: 'Aumentar Quantas cópias' }))

    expect(within(painel).getByRole('textbox', { name: 'Quantas cópias' })).toHaveValue('3')
  })

  /** Escolher o local já é confirmar: um toque por carta. */
  it('tocar num local guarda ali', async () => {
    const painel = await abrir()

    const linha = within(painel).getByText('Deck Sabo').closest('div')!
    await userEvent.click(within(linha).getByRole('button', { name: 'Guardar' }))

    const enviado = placeCopiesAction.mock.calls[0][1]
    expect(enviado.get('variantId')).toBe('1')
    expect(enviado.get('storageLocationId')).toBe('10')
    expect(enviado.get('copies')).toBe('3')
  })

  it('manda só as cópias escolhidas', async () => {
    const painel = await abrir()

    await userEvent.click(within(painel).getByRole('button', { name: 'Diminuir Quantas cópias' }))
    const linha = within(painel).getByText('Binder Principal').closest('div')!
    await userEvent.click(within(linha).getByRole('button', { name: 'Guardar' }))

    expect(placeCopiesAction.mock.calls[0][1].get('copies')).toBe('2')
  })

  it('busca por código e por nome', async () => {
    withToast(
      <PlaceCards
        cards={[
          solta({ variantId: '1', cardCode: 'OP01-001', cardName: 'Zoro' }),
          solta({ variantId: '2', cardCode: 'OP01-002', cardName: 'Nami' }),
        ]}
        locations={locais}
      />,
    )

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Buscar entre as cartas sem lugar' }),
      'nami',
    )

    const linhas = screen.getAllByRole('button').filter((b) => b.textContent?.includes('OP01-'))
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toHaveTextContent('OP01-002')
  })

  it('celebra quando não sobra nada', () => {
    withToast(<PlaceCards cards={[]} locations={locais} />)

    expect(screen.getByText('Tudo tem lugar')).toBeInTheDocument()
  })
})

describe('transferir entre locais', () => {
  const card: StoredCardView = {
    variantId: '1',
    cardCode: 'OP01-001',
    cardName: 'Roronoa Zoro',
    rarity: 'SR',
    variantType: 'Normal',
    imageUrl: null,
    quantity: 3,
    ownedQuantity: 4,
    playsetHere: false,
  }

  const locais: StorageLocationSummary[] = [
    {
      id: '9',
      name: 'Binder Principal',
      type: 'BINDER',
      purpose: 'COLLECTION',
      image: null,
      subtitle: 'Binder • Coleção',
      cardCount: 48,
    },
    {
      id: '10',
      name: 'Caixa Troca',
      type: 'BOX',
      purpose: 'TRADE',
      image: null,
      subtitle: 'Caixa • Troca',
      cardCount: 12,
    },
  ]

  async function abrirTransferencia(locations = locais) {
    withToast(
      <StoredCards
        cards={[card]}
        storageLocationId="9"
        locationName="Binder Principal"
        locations={locations}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /OP01-001/ }))
    const painel = await screen.findByRole('dialog')
    await userEvent.click(within(painel).getByRole('button', { name: 'Mover para outro local' }))
    return painel
  }

  /**
   * "Cópias neste local" e "quantas mover" são números diferentes que parecem o
   * mesmo. Lado a lado se confundiriam, então o painel troca de vista.
   */
  it('troca de vista em vez de somar mais um seletor', async () => {
    const painel = await abrirTransferencia()

    expect(within(painel).getByRole('textbox', { name: 'Quantas mover' })).toBeInTheDocument()
    expect(
      within(painel).queryByRole('textbox', { name: 'Cópias neste local' }),
    ).not.toBeInTheDocument()
  })

  it('não oferece o próprio local como destino', async () => {
    const painel = await abrirTransferencia()

    expect(within(painel).getByText('Caixa Troca')).toBeInTheDocument()
    expect(within(painel).queryByText('Binder Principal')).not.toBeInTheDocument()
  })

  it('já vem com todas as cópias daqui escolhidas', async () => {
    const painel = await abrirTransferencia()

    expect(within(painel).getByRole('textbox', { name: 'Quantas mover' })).toHaveValue('3')
  })

  /**
   * Quem baixa o contador para 2 e toca em "mover" quis mover 2.
   *
   * Antes, a segunda vista recomecava do total e transferia as tres — foi o
   * que aconteceu no primeiro uso real. As duas vistas continuam com numeros
   * de significado diferente; o que atravessa e a intencao.
   */
  it('leva para a transferência o número que estava na tela', async () => {
    withToast(
      <StoredCards
        cards={[card]}
        storageLocationId="9"
        locationName="Binder Principal"
        locations={locais}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /OP01-001/ }))
    const painel = await screen.findByRole('dialog')

    await userEvent.click(within(painel).getByRole('button', { name: 'Diminuir Cópias neste local' }))
    await userEvent.click(within(painel).getByRole('button', { name: 'Mover para outro local' }))

    expect(within(painel).getByRole('textbox', { name: 'Quantas mover' })).toHaveValue('2')
  })

  /** O botão diz o número, para a ação se explicar antes de ser tocada. */
  it('o botão do destino repete quantas vão', async () => {
    const painel = await abrirTransferencia()

    await userEvent.click(within(painel).getByRole('button', { name: 'Diminuir Quantas mover' }))

    expect(within(painel).getByRole('button', { name: 'Mover 2' })).toBeInTheDocument()
  })

  /** Zerar em "cópias neste local" é remover, não mover: a transferência parte de 1. */
  it('nunca leva zero para a transferência', async () => {
    withToast(
      <StoredCards
        cards={[card]}
        storageLocationId="9"
        locationName="Binder Principal"
        locations={locais}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /OP01-001/ }))
    const painel = await screen.findByRole('dialog')

    const menos = within(painel).getByRole('button', { name: 'Diminuir Cópias neste local' })
    await userEvent.click(menos)
    await userEvent.click(menos)
    await userEvent.click(menos)
    await userEvent.click(within(painel).getByRole('button', { name: 'Mover para outro local' }))

    expect(within(painel).getByRole('textbox', { name: 'Quantas mover' })).toHaveValue('1')
  })

  it('não deixa mover mais do que há aqui', async () => {
    const painel = await abrirTransferencia()

    await userEvent.click(within(painel).getByRole('button', { name: 'Aumentar Quantas mover' }))

    expect(within(painel).getByRole('textbox', { name: 'Quantas mover' })).toHaveValue('3')
  })

  /** Escolher o destino já é confirmar: um toque. */
  it('tocar no destino manda origem, destino e quantidade', async () => {
    const painel = await abrirTransferencia()

    await userEvent.click(within(painel).getByRole('button', { name: 'Diminuir Quantas mover' }))
    const linha = within(painel).getByText('Caixa Troca').closest('div')!
    await userEvent.click(within(linha).getByRole('button', { name: /^Mover/ }))

    const enviado = moveCopiesAction.mock.calls[0][1]
    expect(enviado.get('variantId')).toBe('1')
    expect(enviado.get('fromStorageLocationId')).toBe('9')
    expect(enviado.get('toStorageLocationId')).toBe('10')
    expect(enviado.get('copies')).toBe('2')
  })

  it('dá para voltar ao ajuste sem fechar o painel', async () => {
    const painel = await abrirTransferencia()

    await userEvent.click(within(painel).getByRole('button', { name: 'Voltar' }))

    expect(within(painel).getByRole('textbox', { name: 'Cópias neste local' })).toBeInTheDocument()
  })

  /** Sem outro local, transferir não é oferecido. */
  it('não oferece transferência com um local só', async () => {
    withToast(
      <StoredCards
        cards={[card]}
        storageLocationId="9"
        locationName="Binder Principal"
        locations={[locais[0]]}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /OP01-001/ }))
    const painel = await screen.findByRole('dialog')

    expect(
      within(painel).queryByRole('button', { name: 'Mover para outro local' }),
    ).not.toBeInTheDocument()
  })
})

describe('BulkAdd', () => {
  const VOCABULARY: CatalogVocabulary = {
    sets: [
      { code: 'OP01', displayCode: 'OP01', displayName: 'ROMANCE DAWN', kind: 'collection' as const },
      { code: 'ST-01', displayCode: 'ST01', displayName: 'Straw Hat Crew', kind: 'deck' as const },
    ],
    types: ['Leader', 'Character'],
    rarities: ['C', 'SR'],
    variantTypes: ['Normal', 'Parallel'],
    colors: ['Red', 'Blue'],
    attributes: ['Slash'],
    mechanics: ['Rush'],
    traits: ['Straw Hat Crew'],
    costRange: { min: 0, max: 10 },
    powerRange: { min: 0, max: 12000 },
  }

  const CARDS = [
    {
      variantId: '1',
      cardCode: 'OP01-001',
      cardName: 'Roronoa Zoro',
      rarity: 'SR',
      variantType: 'Normal',
      imageUrl: null,
    },
    {
      variantId: '2',
      cardCode: 'OP01-002',
      cardName: 'Nami',
      rarity: 'C',
      variantType: 'Normal',
      imageUrl: null,
    },
  ]

  let buscas: ReturnType<typeof vi.fn>

  beforeEach(() => {
    buscas = vi.fn(
      async () => new Response(JSON.stringify({ items: CARDS, total: 2, pageSize: 24 })),
    )
    vi.stubGlobal('fetch', buscas)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const montar = async () => {
    withToast(
      <BulkAdd
        storageLocationId="9"
        locationName="Binder Principal"
        vocabulary={VOCABULARY}
        initialCards={CARDS}
        initialTotal={CARDS.length}
      />,
    )
    // O codigo aparece duas vezes no DOM — texto e lugar da arte —, entao a
    // espera e por algo que existe uma vez so.
    await screen.findByRole('button', { name: 'Acrescentar uma cópia de OP01-001' })
  }

  /**
   * A tela abria vazia e buscava ao montar: sem JavaScript ela girava para
   * sempre, sem nada na tela e sem dizer por que.
   */
  it('pinta a primeira leva sem buscar nada', async () => {
    await montar()

    expect(buscas).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('2 cartas')
  })

  it('lista o catálogo com um contador por carta', async () => {
    await montar()

    expect(
      screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-001' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('0 cópias de OP01-001')).toBeInTheDocument()
  })

  /** Nada escolhido, nada a revisar: a barra não ocupa espaço à toa. */
  it('a barra de resumo só aparece com alguma escolha', async () => {
    await montar()
    expect(screen.queryByRole('button', { name: 'Revisar' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-001' }))

    expect(screen.getByRole('button', { name: 'Revisar' })).toBeInTheDocument()
  })

  it('soma as cópias e conta as cartas', async () => {
    await montar()

    const zoro = screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-001' })
    await userEvent.click(zoro)
    await userEvent.click(zoro)
    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-002' }))

    expect(screen.getByText('3 cópias')).toBeInTheDocument()
    expect(screen.getByText(/2 cartas · Binder Principal/)).toBeInTheDocument()
  })

  it('o contador não passa de zero para baixo', async () => {
    await montar()

    expect(screen.getByRole('button', { name: 'Tirar uma cópia de OP01-001' })).toBeDisabled()
  })

  /** A confirmação diz quantas, onde, e que a coleção também muda. */
  it('confirma dizendo o número e o local', async () => {
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-001' }))
    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-001' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('Adicionar 2 cópias a Binder Principal?')
    expect(dialogo).toHaveTextContent('entram na sua coleção')
  })

  it('envia as escolhas e o local ao confirmar', async () => {
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-001' }))
    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-002' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirmar' }),
    )

    const enviado = bulkAddAction.mock.calls[0][1]
    expect(enviado.get('storageLocationId')).toBe('9')
    expect(enviado.getAll('carta')).toEqual(['1:1', '2:1'])
  })

  it('limpa as escolhas depois de adicionar', async () => {
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-001' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirmar' }),
    )

    expect(await screen.findByLabelText('0 cópias de OP01-001')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revisar' })).not.toBeInTheDocument()
  })
})

describe('LocationHeader', () => {
  const detalhe = (overrides: Partial<StorageLocationDetail> = {}): StorageLocationDetail => ({
    id: '9',
    name: 'Binder Principal',
    type: 'BINDER',
    purpose: 'COLLECTION',
    image: null,
    subtitle: 'Binder • Coleção',
    cardCount: 48,
    description: null,
    createdAt: new Date('2026-01-01T12:00:00Z'),
    updatedAt: new Date('2026-01-02T12:00:00Z'),
    uniqueVariants: 20,
    closedPlaysetsHere: 3,
    ...overrides,
  })

  it('mostra nome, tipo e contagem', () => {
    render(<LocationHeader location={detalhe()} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Binder Principal')
    expect(screen.getByText(/Binder • Coleção · 48 cartas/)).toBeInTheDocument()
  })

  /**
   * A foto ja foi fundo: cortada na largura toda, desfocada e a 25%. Garantia
   * contraste e destruia a imagem — uma foto 4:3 numa faixa larga e baixa vira
   * um borrao que nao se reconhece. Agora ela e um quadro contido.
   */
  it('mostra a foto contida, e nao esticada no fundo', () => {
    render(<LocationHeader location={detalhe({ image: 'https://exemplo.test/binder.jpg' })} />)

    const foto = document.querySelector('img')
    expect(foto).not.toBeNull()

    const quadro = foto!.closest('span')!
    expect(quadro.className).toContain('size-16')
    expect(quadro.className).not.toContain('inset-0')
    expect(foto!.className).not.toContain('blur')
  })

  it('sem foto, nao inventa imagem nenhuma', () => {
    render(<LocationHeader location={detalhe()} />)

    expect(document.querySelector('img')).toBeNull()
  })

  it('volta para a lista de binders', () => {
    render(<LocationHeader location={detalhe()} />)

    expect(screen.getByRole('link', { name: 'Voltar para Binders' })).toHaveAttribute(
      'href',
      '/binders',
    )
  })
})
