import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TradeNegotiation } from '@/components/trades/trade-negotiation'
import type { TradeView } from '@/server/application/trades'

/*
 * As acoes de servidor arrastam o Prisma no grafo de modulos. No Next elas
 * ficam no servidor; aqui o arquivo e importado inteiro, e sem o dublê o teste
 * tentaria abrir conexao com o banco para renderizar um botao.
 */
vi.mock('@/app/(app)/trocas/actions', () => ({
  setOfferAction: vi.fn(),
  confirmTradeAction: vi.fn(),
  withdrawConfirmationAction: vi.fn(),
  cancelTradeAction: vi.fn(),
  markExchangeAction: vi.fn(),
  withdrawExchangeAction: vi.fn(),
}))

/**
 * A negociacao na tela.
 *
 * O que se protege aqui e o que a tela **diz** e o que ela **deixa tocar**. A
 * regra 4.6.2 — cada um mexe so na propria oferta — e garantida no servidor;
 * esta tela e a aparencia dela, e uma aparencia que contradiga a regra ensina a
 * pessoa a esperar o que nao vai acontecer.
 */

const oferta = (over: Partial<TradeView['me']['offer'][number]> = {}) => ({
  variantId: '1',
  cardCode: 'OP01-001',
  cardName: 'Roronoa Zoro',
  imageUrl: null,
  rarity: 'SR',
  variantType: 'Normal',
  quantity: 2,
  ...over,
})

const troca = (over: Partial<TradeView> = {}): TradeView => ({
  tradeId: '7',
  status: 'NEGOTIATING',
  inviteToken: null,
  me: {
    userId: '1',
    name: 'Ana',
    confirmed: false,
    reviewRequested: false,
    exchanged: false,
    offer: [],
  },
  other: {
    userId: '2',
    name: 'Bruno',
    confirmed: false,
    reviewRequested: false,
    exchanged: false,
    offer: [],
  },
  iCanOffer: [],
  theyCanOffer: [],
  validated: false,
  completedAt: null,
  ...over,
})

/** Uma troca confirmada pelos dois: o estado de onde a conclusao parte. */
const combinada = (over: Partial<TradeView> = {}): TradeView =>
  troca({
    status: 'CONFIRMED',
    validated: true,
    me: { ...troca().me, confirmed: true },
    other: { ...troca().other!, confirmed: true },
    ...over,
  })

describe('cada um mexe so na propria oferta', () => {
  it('da controles na minha oferta', () => {
    render(<TradeNegotiation trade={troca({ me: { ...troca().me, offer: [oferta()] } })} />)

    expect(
      screen.getByRole('button', { name: /acrescentar uma cópia de OP01-001/i }),
    ).toBeInTheDocument()
  })

  /** A aparencia da regra 4.6.2. Quem garante e o servidor. */
  it('nao da controle nenhum na oferta do outro', () => {
    render(
      <TradeNegotiation
        trade={troca({ other: { ...troca().other!, offer: [oferta()] } })}
      />,
    )

    expect(
      screen.queryByRole('button', { name: /acrescentar uma cópia/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('2x')).toBeInTheDocument()
  })
})

describe('o aviso de revisao', () => {
  /**
   * Sem ele a tela pediria "confirme" como se fosse a primeira vez, e a pessoa
   * reconfirmaria sem saber que o combinado mudou.
   */
  it('diz quem alterou quando a confirmacao caiu', () => {
    render(
      <TradeNegotiation
        trade={troca({ me: { ...troca().me, reviewRequested: true } })}
      />,
    )

    expect(screen.getByText(/Bruno alterou a troca/)).toBeInTheDocument()
    expect(screen.getByText(/confirme de novo/i)).toBeInTheDocument()
  })

  it('nao aparece quando nao ha o que revisar', () => {
    render(<TradeNegotiation trade={troca()} />)

    expect(screen.queryByText(/alterou a troca/)).not.toBeInTheDocument()
  })
})

describe('onde a troca esta', () => {
  it('diz que falta o outro quando so eu confirmei', () => {
    render(<TradeNegotiation trade={troca({ me: { ...troca().me, confirmed: true } })} />)

    expect(screen.getByText(/Falta Bruno confirmar/)).toBeInTheDocument()
  })

  it('diz que falta eu quando so o outro confirmou', () => {
    render(
      <TradeNegotiation trade={troca({ other: { ...troca().other!, confirmed: true } })} />,
    )

    expect(screen.getByText(/Falta você/)).toBeInTheDocument()
  })

  it('diz que esta combinada quando os dois confirmaram', () => {
    render(
      <TradeNegotiation
        trade={troca({
          validated: true,
          me: { ...troca().me, confirmed: true },
          other: { ...troca().other!, confirmed: true },
        })}
      />,
    )

    expect(screen.getByText(/os dois confirmaram/i)).toBeInTheDocument()
  })

  /** Confirmar sozinho nao vale: falta o consentimento que abre o dado. */
  it('nao deixa confirmar enquanto ninguem entrou', () => {
    render(<TradeNegotiation trade={troca({ other: null, status: 'DRAFT' })} />)

    expect(screen.getByRole('button', { name: /confirmar esta troca/i })).toBeDisabled()
    expect(screen.getByText(/depois que alguém entrar pelo convite/i)).toBeInTheDocument()
  })

  it('troca confirmar por retirar depois que eu confirmei', () => {
    render(<TradeNegotiation trade={troca({ me: { ...troca().me, confirmed: true } })} />)

    expect(screen.getByRole('button', { name: /retirar minha confirmação/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /confirmar esta troca/i }),
    ).not.toBeInTheDocument()
  })
})

describe('as sugestoes', () => {
  const sugestao = {
    variantId: '9',
    quantity: 2,
    available: 3,
    stillWanted: 4,
    cardCode: 'OP01-016',
    cardName: 'Nami',
    imageUrl: null,
  }

  /** Um match nao compromete copia nenhuma: por na oferta e outro gesto. */
  it('mostra o que o outro procura sem ja oferecer', () => {
    render(<TradeNegotiation trade={troca({ iCanOffer: [sugestao] })} />)

    // O codigo aparece duas vezes sem arte — texto e lugar da imagem —, entao
    // a espera e pelo botao, que existe uma vez so.
    expect(screen.getByRole('button', { name: /oferecer 2/i })).toBeInTheDocument()
    expect(screen.getByText(/Nami · 3 disponíveis, procura 4/)).toBeInTheDocument()
    expect(screen.getByText(/enquanto não puser, nada está oferecido/i)).toBeInTheDocument()
  })

  /** Ja oferecida sai da lista: repetir seria oferecer a mesma carta duas vezes. */
  it('some a sugestao que ja esta na oferta', () => {
    render(
      <TradeNegotiation
        trade={troca({
          iCanOffer: [sugestao],
          me: { ...troca().me, offer: [oferta({ variantId: '9', cardCode: 'OP01-016' })] },
        })}
      />,
    )

    expect(screen.queryByRole('button', { name: /oferecer 2/i })).not.toBeInTheDocument()
  })
})

describe('troca encerrada', () => {
  /** Mexer depois reescreveria o passado: o valor historico sai do preco vigente. */
  it('nao oferece controle nenhum numa troca cancelada', () => {
    render(
      <TradeNegotiation
        trade={troca({ status: 'CANCELLED', me: { ...troca().me, offer: [oferta()] } })}
      />,
    )

    expect(screen.queryByRole('button', { name: /confirmar esta troca/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancelar a troca/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /acrescentar uma cópia/i })).not.toBeInTheDocument()
  })
})

describe('marcar que as cartas trocaram de mao', () => {
  /*
   * Antes de os dois confirmarem, a troca ainda se negocia. "Ja trocamos" ali
   * seria um gesto sobre um combinado que ninguem fechou (regra 4.5).
   */
  it('nao aparece enquanto a troca nao esta confirmada pelos dois', () => {
    render(<TradeNegotiation trade={troca({ me: { ...troca().me, confirmed: true } })} />)

    expect(screen.queryByRole('button', { name: /já trocamos/i })).not.toBeInTheDocument()
  })

  it('aparece depois que os dois confirmaram', () => {
    render(<TradeNegotiation trade={combinada()} />)

    expect(screen.getByRole('button', { name: /já trocamos as cartas/i })).toBeInTheDocument()
    expect(screen.getByText(/quando trocarem as cartas, marquem aqui/i)).toBeInTheDocument()
  })

  /** Concluir mexe na colecao dos dois, e a tela precisa dizer isso antes. */
  it('avisa o que marcar provoca', () => {
    render(<TradeNegotiation trade={combinada()} />)

    expect(screen.getByText(/só depois de as cartas terem mudado de mão/i)).toBeInTheDocument()
    expect(screen.getByText(/entram na coleção de quem recebeu/i)).toBeInTheDocument()
  })

  it('troca marcar por retirar depois que eu marquei', () => {
    render(<TradeNegotiation trade={combinada({ me: { ...combinada().me, exchanged: true } })} />)

    expect(screen.getByRole('button', { name: /retirar minha marcação/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /já trocamos/i })).not.toBeInTheDocument()
    expect(screen.getByText(/falta bruno marcar/i)).toBeInTheDocument()
  })

  it('diz quando foi o outro que marcou', () => {
    render(
      <TradeNegotiation trade={combinada({ other: { ...combinada().other!, exchanged: true } })} />,
    )

    // O painel de status e o unico lugar que diz quem marcou: a mesma frase
    // repetida junto do botao daria dois avisos iguais empilhados.
    expect(screen.getByText(/bruno marcou que vocês trocaram\. falta você/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /já trocamos as cartas/i })).toBeInTheDocument()
  })
})

describe('troca concluida', () => {
  const concluida = combinada({ status: 'COMPLETED', completedAt: new Date('2026-09-10') })

  /*
   * "Voce oferece" descreve uma proposta em aberto. Ler isso numa troca que ja
   * aconteceu faz duvidar se ela aconteceu mesmo.
   */
  it('fala no passado, e do que cada um levou', () => {
    render(
      <TradeNegotiation
        trade={{
          ...concluida,
          me: { ...concluida.me, offer: [oferta()] },
          other: { ...concluida.other!, offer: [oferta({ variantId: '2', cardCode: 'OP01-016' })] },
        }}
      />,
    )

    expect(screen.getByText('Você entregou')).toBeInTheDocument()
    expect(screen.getByText('Você recebeu')).toBeInTheDocument()
    expect(screen.getByText(/já estão nas coleções de vocês dois/i)).toBeInTheDocument()
  })

  it('nao deixa mexer em nada', () => {
    render(<TradeNegotiation trade={{ ...concluida, me: { ...concluida.me, offer: [oferta()] } }} />)

    expect(screen.queryByRole('button', { name: /já trocamos/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancelar a troca/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /acrescentar uma cópia/i })).not.toBeInTheDocument()
  })
})
