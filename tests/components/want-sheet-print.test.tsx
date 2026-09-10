import { afterEach, describe, expect, it, vi } from 'vitest'
import { render as renderRaw, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WantSheetPrint } from '@/components/wants/want-sheet-print'
import { ToastProvider } from '@/components/ui/toast'
import type { WantView } from '@/server/application/wants'

/** A folha avisa por toast quando o desenho falha, e o aviso precisa de um lar. */
const render = (ui: React.ReactElement) => renderRaw(<ToastProvider>{ui}</ToastProvider>)

/**
 * A want list em folha.
 *
 * O PDF sai pela impressao do navegador porque a decisao 026 nao deixa copiar
 * as imagens da fonte, e desenha-las num `canvas` exigiria servi-las pelo nosso
 * dominio. O que se protege aqui e o conteudo da folha: o que entra, o que fica
 * de fora, e a quantidade — que e o dado que a folha existe para carregar.
 */

const want = (over: Partial<WantView> = {}): WantView => ({
  variantId: '1',
  cardCode: 'OP01-001',
  cardName: 'Roronoa Zoro',
  rarity: 'SR',
  variantType: 'Normal',
  imageUrl: null,
  sheetImageUrl: 'https://cdn/arte.jpg',
  wanted: 4,
  owned: 0,
  remaining: 4,
  status: 'missing',
  ...over,
})

describe('o que entra na folha', () => {
  it('mostra a carta que falta, com quantas faltam', () => {
    render(<WantSheetPrint wants={[want({ remaining: 3 })]} />)

    expect(screen.getByText('3x')).toBeInTheDocument()
    expect(screen.getByText('Roronoa Zoro')).toBeInTheDocument()
  })

  /**
   * Uma folha com o que a pessoa ja conseguiu faria alguem oferecer carta que
   * ela nao quer mais — o oposto do motivo de levar a lista.
   */
  it('deixa de fora o que a pessoa ja conseguiu', () => {
    render(
      <WantSheetPrint
        wants={[
          want({ variantId: '1', cardCode: 'OP01-001' }),
          want({ variantId: '2', cardCode: 'OP01-016', status: 'satisfied', remaining: 0 }),
        ]}
      />,
    )

    expect(screen.getByText('Roronoa Zoro')).toBeInTheDocument()
    expect(screen.queryByText('OP01-016')).not.toBeInTheDocument()
  })

  it('conta cartas e copias no cabecalho', () => {
    render(
      <WantSheetPrint
        wants={[
          want({ variantId: '1', remaining: 2 }),
          want({ variantId: '2', cardCode: 'OP01-016', remaining: 1 }),
        ]}
      />,
    )

    expect(screen.getByText(/2 cartas · 3 cópias/)).toBeInTheDocument()
  })

  /** Divulgacao: a folha vai para grupos de gente que nao conhece o produto. */
  it('leva a marca', () => {
    render(<WantSheetPrint wants={[want()]} />)

    expect(screen.getByRole('img', { name: 'ColeXa' })).toBeInTheDocument()
    expect(screen.getByText(/colexa\.com\.br/)).toBeInTheDocument()
  })
})

describe('o vazio', () => {
  it('explica quando nao ha nada faltando', () => {
    render(<WantSheetPrint wants={[want({ status: 'satisfied', remaining: 0 })]} />)

    expect(screen.getByText(/nada faltando/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /adicionar cartas/i })).toHaveAttribute(
      'href',
      '/quero/adicionar',
    )
  })
})

describe('gerar o arquivo', () => {
  it('chama a impressao do navegador', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)

    render(<WantSheetPrint wants={[want()]} />)
    await userEvent.click(screen.getByRole('button', { name: /imprimir/i }))

    expect(print).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  /** Sem a instrucao, o dialogo de impressao parece o botao errado. */
  it('diz onde escolher salvar como PDF', () => {
    render(<WantSheetPrint wants={[want()]} />)

    expect(screen.getByText(/salvar como pdf/i)).toBeInTheDocument()
  })

  /*
   * A regra mudou: as folhas passaram a ser preparadas quando a tela abre, e nao
   * ao toque. Enquanto isso, o botao principal diz que esta esperando — um botao
   * que aceita o toque e nao faz nada e pior que um que diz que ainda nao pode.
   *
   * O motivo esta no componente: `navigator.share` exige a ativacao do toque, e
   * ela nao sobrevive ao desenho, que carrega uma imagem por carta da rede.
   */
  it('comeca preparando, com imprimir ja disponivel', () => {
    render(<WantSheetPrint wants={[want()]} />)

    expect(screen.getByRole('button', { name: /preparando/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /imprimir/i })).toBeInTheDocument()
  })

  /*
   * O jsdom nao tem canvas, entao o desenho falha aqui como falharia num
   * aparelho que nao consegue. O que se protege e que a falha **nao** tira a
   * tela do ar: imprimir continua, e imprimindo todas as cartas saem com arte.
   */
  it('nao derruba a tela quando o desenho falha', async () => {
    render(<WantSheetPrint wants={[want()]} />)

    expect(
      await screen.findByText(/não foi possível preparar as imagens neste aparelho/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /imprimir/i })).toBeInTheDocument()
  })
})

describe('a imagem', () => {
  /**
   * O canvas nao existe no jsdom, entao o desenho e trocado por um dublê. O que
   * este teste protege e a ligacao: o gerador e chamado com o que falta, e so
   * com o que falta.
   *
   * A regra mudou: ele passou a ser chamado **ao abrir a tela**, e nao ao toque.
   * Ver o comentario no componente — a ativacao do toque nao sobrevive ao
   * desenho, e `navigator.share` recusaria depois dele.
   */
  it('gera a partir das cartas que faltam, e nao das satisfeitas', async () => {
    const render_ = vi.fn().mockResolvedValue([new Blob(['x'], { type: 'image/jpeg' })])
    vi.doMock('@/lib/want-sheet-image', () => ({
      CARDS_PER_SHEET: 12,
      renderWantSheets: render_,
    }))
    vi.resetModules()

    const { WantSheetPrint: Componente } = await import('@/components/wants/want-sheet-print')
    // `resetModules` cria um grafo novo: o provider tem de vir dele, senao o
    // componente le um contexto que ninguem forneceu.
    const { ToastProvider: Provider } = await import('@/components/ui/toast')
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })

    renderRaw(
      <Provider>
        <Componente
          wants={[
            want({ variantId: '1', remaining: 2, sheetImageUrl: 'https://cdn/1.jpg' }),
            want({ variantId: '2', status: 'satisfied', remaining: 0 }),
          ]}
        />
      </Provider>,
    )
    await screen.findByRole('button', { name: /baixar imagem/i })

    expect(render_).toHaveBeenCalledWith([
      {
        cardCode: 'OP01-001',
        cardName: 'Roronoa Zoro',
        sheetImageUrl: 'https://cdn/1.jpg',
        remaining: 2,
      },
    ])

    vi.unstubAllGlobals()
    vi.doUnmock('@/lib/want-sheet-image')
  })

  /** Sem vinculo a carta nao some: sai com o codigo no lugar da arte. */
  it('avisa quantas cartas saem sem arte', () => {
    render(<WantSheetPrint wants={[want({ sheetImageUrl: null })]} />)

    expect(screen.getByText(/1 carta sai com o código no lugar da arte/i)).toBeInTheDocument()
  })
})

describe('a paginacao', () => {
  /**
   * O mesmo corte da impressao. Uma lista longa numa imagem so vira uma tira
   * que o WhatsApp recomprime ate o numero da carta borrar — e o numero e o
   * dado que a folha existe para carregar.
   */
  it('avisa quantas imagens saem quando passa de doze', () => {
    const muitas = Array.from({ length: 25 }, (_, i) =>
      want({ variantId: String(i), cardCode: `OP01-${i}` }),
    )
    render(<WantSheetPrint wants={muitas} />)

    // A frase mudou de tempo: enquanto prepara, ela diz o que esta sendo feito.
    expect(screen.getByText(/Preparando 3 imagens, de até 12 cartas cada/)).toBeInTheDocument()
  })

  it('nao fala em varias imagens quando cabe numa folha', () => {
    render(<WantSheetPrint wants={[want()]} />)

    expect(screen.queryByText(/\d+ imagens/)).not.toBeInTheDocument()
    expect(screen.getByText(/Preparando uma imagem/)).toBeInTheDocument()
  })
})

/**
 * O compartilhamento, e o defeito que ele corrige.
 *
 * O laco de downloads programaticos nao sobrevivia ao Safari do iPhone: um
 * download ali e uma navegacao para o `blob:`, e a navegacao seguinte cancela a
 * anterior que ainda nao terminou. So a ultima imagem chegava, e as notificacoes
 * de todas apareciam — o que fazia parecer que tinha funcionado.
 *
 * Estes testes existem porque a cobertura antiga olhava o **desenho** e nunca a
 * **entrega**, que e onde o defeito estava.
 */
describe('compartilhar', () => {
  /** Monta o componente com o desenho dublado e o `navigator` que o teste pedir. */
  async function comFolhas(
    quantas: number,
    navegador: { share?: unknown; canShare?: unknown } = {},
  ) {
    const blobs = Array.from({ length: quantas }, () => new Blob(['x'], { type: 'image/jpeg' }))
    vi.doMock('@/lib/want-sheet-image', () => ({
      CARDS_PER_SHEET: 12,
      renderWantSheets: vi.fn().mockResolvedValue(blobs),
    }))
    vi.resetModules()

    const { WantSheetPrint: Componente } = await import('@/components/wants/want-sheet-print')
    const { ToastProvider: Provider } = await import('@/components/ui/toast')

    for (const [chave, valor] of Object.entries(navegador)) {
      Object.defineProperty(navigator, chave, { value: valor, configurable: true, writable: true })
    }

    renderRaw(
      <Provider>
        <Componente wants={[want()]} />
      </Provider>,
    )

    return { blobs }
  }

  afterEach(() => {
    for (const chave of ['share', 'canShare']) {
      if (chave in navigator) {
        Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, chave)
      }
    }
    vi.doUnmock('@/lib/want-sheet-image')
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('manda todas as imagens numa chamada so', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    await comFolhas(3, { share, canShare: () => true })

    await userEvent.click(
      await screen.findByRole('button', { name: /compartilhar as 3 imagens/i }),
    )

    expect(share).toHaveBeenCalledTimes(1)
    const enviado = share.mock.calls[0][0] as { files: File[] }
    expect(enviado.files).toHaveLength(3)
    expect(enviado.files.every((arquivo) => arquivo.type === 'image/jpeg')).toBe(true)
  })

  /*
   * `canShare` precisa ser consultado com os **arquivos**. Sem argumento ele
   * responde sobre a API, e ha navegador que compartilha texto e nao arquivo —
   * ali o botao apareceria e a chamada falharia.
   */
  it('pergunta ao navegador sobre os arquivos, e nao sobre a API', async () => {
    const canShare = vi.fn().mockReturnValue(true)
    await comFolhas(2, { share: vi.fn().mockResolvedValue(undefined), canShare })

    await screen.findByRole('button', { name: /compartilhar/i })

    expect(canShare).toHaveBeenCalled()
    const perguntado = canShare.mock.calls[0][0] as { files: File[] }
    expect(perguntado.files).toHaveLength(2)
  })

  it('cai para baixar quando o aparelho nao compartilha arquivo', async () => {
    await comFolhas(2, { share: vi.fn(), canShare: () => false })

    expect(await screen.findByRole('button', { name: /baixar folha 1 de 2/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /baixar folha 2 de 2/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /compartilhar/i })).not.toBeInTheDocument()
  })

  /*
   * O defeito, em forma de teste: uma folha, um botao. Nenhuma tela oferece
   * baixar varias de uma vez, porque e isso que o Safari cancela.
   */
  it('nunca oferece baixar varias de uma vez', async () => {
    await comFolhas(3, { share: vi.fn(), canShare: () => false })

    await screen.findByRole('button', { name: /baixar folha 1 de 3/i })

    const baixar = screen.getAllByRole('button', { name: /baixar/i })
    expect(baixar).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /baixar (todas|tudo)/i })).not.toBeInTheDocument()
  })

  /* Fechar a folha do sistema e a pessoa desistindo, e nao um problema dela. */
  it('nao avisa erro quando a pessoa fecha a folha do sistema', async () => {
    const abortado = Object.assign(new Error('cancelado'), { name: 'AbortError' })
    await comFolhas(1, {
      share: vi.fn().mockRejectedValue(abortado),
      canShare: () => true,
    })

    await userEvent.click(await screen.findByRole('button', { name: /compartilhar/i }))

    expect(screen.queryByText(/não foi possível compartilhar/i)).not.toBeInTheDocument()
  })

  it('avisa quando o compartilhamento falha de verdade', async () => {
    await comFolhas(1, {
      share: vi.fn().mockRejectedValue(new Error('deu ruim')),
      canShare: () => true,
    })

    await userEvent.click(await screen.findByRole('button', { name: /compartilhar/i }))

    expect(await screen.findByText(/não foi possível compartilhar/i)).toBeInTheDocument()
  })
})

/**
 * A folha impressa, e o defeito que ela corrige.
 *
 * A versao anterior punha tudo numa **grade unica**. `break-inside: avoid` num
 * item de grade nao e respeitado de forma confiavel, e o navegador fatiava a
 * linha da grade na borda da pagina — a arte saia cortada no meio, e so a partir
 * da terceira folha, quando o acumulo faz a linha cair em cima da borda.
 *
 * Agora cada folha e um bloco proprio que termina em quebra de pagina. O numero
 * de folhas nunca e presumido: sai da divisao por `CARDS_PER_SHEET`.
 *
 * O jsdom nao avalia media query nem pagina nada (armadilha 10), entao o que se
 * verifica aqui e a **estrutura** que torna a quebra possivel. Que o Tailwind
 * emite `break-after: page` dentro de `@media print` foi conferido no CSS
 * compilado.
 */
describe('a folha impressa', () => {
  const lista = (quantas: number) =>
    Array.from({ length: quantas }, (_, i) =>
      want({ variantId: String(i), cardCode: `OP01-${String(i).padStart(3, '0')}` }),
    )

  const folhas = (container: HTMLElement) => [...container.querySelectorAll('article')]

  it('divide de doze em doze, sem presumir quantas paginas', () => {
    for (const [cartas, esperado] of [
      [1, 1],
      [12, 1],
      [13, 2],
      [24, 2],
      [25, 3],
      [100, 9],
    ] as const) {
      const { container, unmount } = render(<WantSheetPrint wants={lista(cartas)} />)

      expect(folhas(container)).toHaveLength(esperado)
      unmount()
    }
  })

  it('poe no maximo doze cartas em cada folha', () => {
    const { container } = render(<WantSheetPrint wants={lista(25)} />)
    const contagens = folhas(container).map((folha) => folha.querySelectorAll('li').length)

    expect(contagens).toEqual([12, 12, 1])
  })

  /* Sem a quebra, o bloco seguinte comeca no meio da pagina e a arte e fatiada. */
  it('quebra a pagina entre as folhas, e nao depois da ultima', () => {
    const { container } = render(<WantSheetPrint wants={lista(25)} />)

    for (const folha of folhas(container)) {
      expect(folha.className).toContain('print:not-last:break-after-page')
      expect(folha.className).toContain('print:break-inside-avoid')
    }
  })

  /*
   * Quem recebe a terceira folha precisa saber que ha uma primeira e uma
   * segunda, senao le uma lista truncada como se fosse a lista inteira.
   */
  it('numera as folhas quando ha mais de uma', () => {
    render(<WantSheetPrint wants={lista(25)} />)

    expect(screen.getByText(/folha 1 de 3/)).toBeInTheDocument()
    expect(screen.getByText(/folha 3 de 3/)).toBeInTheDocument()
  })

  it('nao numera quando cabe numa folha so', () => {
    render(<WantSheetPrint wants={lista(12)} />)

    expect(screen.queryByText(/folha \d+ de/)).not.toBeInTheDocument()
  })
})

/**
 * A arte tem de existir na hora de imprimir.
 *
 * Este e o defeito do PDF relatado em 10/09: quatro folhas, e da segunda em
 * diante **nenhuma arte**. A causa nao era corte nem quebra de pagina — era o
 * carregamento preguicoso do `next/image`. O que nunca passou pela tela nunca
 * foi buscado, e `window.print()` dispara na hora, sem esperar nada.
 *
 * Sao duas metades, e as duas precisam estar de pe: carregar cedo, e nao
 * imprimir antes de terminar.
 */
describe('a arte na folha impressa', () => {
  /* Com arte de verdade: sem `imageUrl` o componente desenha o codigo, e nao uma
     imagem — e nao haveria nada para carregar nem esperar. */
  const lista = (quantas: number) =>
    Array.from({ length: quantas }, (_, i) =>
      want({
        variantId: String(i),
        cardCode: `OP01-${String(i).padStart(3, '0')}`,
        imageUrl: `https://cdn/arte-${i}.png`,
      }),
    )

  it('pede a arte de todas as cartas sem esperar a rolagem', () => {
    const { container } = render(<WantSheetPrint wants={lista(25)} />)
    const imagens = [...container.querySelectorAll('img')]

    expect(imagens).toHaveLength(25)
    expect(imagens.every((img) => img.getAttribute('loading') === 'eager')).toBe(true)
  })

  /*
   * Sem a espera, a impressao sai com o que ja estava desenhado — que na
   * primeira folha e tudo, e da segunda em diante e nada.
   */
  it('espera a arte antes de chamar a impressao', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)

    const { container } = render(<WantSheetPrint wants={lista(13)} />)

    const decodificadas: string[] = []
    for (const img of container.querySelectorAll('img')) {
      const src = img.getAttribute('src') ?? ''
      img.decode = () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            decodificadas.push(src)
            resolve()
          }, 0),
        )
    }

    await userEvent.click(screen.getByRole('button', { name: /imprimir/i }))

    expect(decodificadas).toHaveLength(13)
    expect(print).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })

  /* Uma carta que nao veio sai com o codigo; travar tudo por ela seria pior. */
  it('imprime mesmo quando uma arte falha', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)

    const { container } = render(<WantSheetPrint wants={lista(3)} />)
    for (const img of container.querySelectorAll('img')) {
      img.decode = () => Promise.reject(new Error('nao carregou'))
    }

    await userEvent.click(screen.getByRole('button', { name: /imprimir/i }))

    expect(print).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
