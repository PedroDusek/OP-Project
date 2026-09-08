import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocationForm } from '@/components/storage/location-form'
import { LocationList } from '@/components/storage/location-list'
import { StoredCards } from '@/components/storage/stored-cards'
import { VariantAllocationsPanel } from '@/components/storage/variant-allocations'
import { PlaceCards } from '@/components/storage/place-cards'
import { UnallocatedNotice } from '@/components/storage/unallocated-notice'
import { ToastProvider } from '@/components/ui/toast'
import { formError } from '@/server/http/form-state'
import type {
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

vi.mock('@/app/(app)/binders/actions', () => ({
  setAllocationAction,
  placeCopiesAction,
  deleteLocationAction: vi.fn(),
  createLocationAction: vi.fn(),
  updateLocationAction: vi.fn(),
}))

afterEach(() => {
  setAllocationAction.mockClear()
  placeCopiesAction.mockClear()
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
  it('o vazio leva a guardar as copias soltas', () => {
    render_([])

    expect(screen.getByText('Nada guardado aqui')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver cartas sem lugar' })).toHaveAttribute(
      'href',
      '/binders/sem-lugar',
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
              subtitle: 'Binder • Coleção',
              quantity: 3,
            },
            {
              storageLocationId: '10',
              name: 'Deck Sabo',
              type: 'DECK',
              purpose: null,
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
