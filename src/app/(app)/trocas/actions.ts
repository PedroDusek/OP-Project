'use server'

import { revalidatePath } from 'next/cache'
import {
  cancelTrade,
  confirmTrade,
  joinTrade,
  publishTradeBinder,
  revokeTradeBinder,
  markExchange,
  ORIGIN_CHOICE_REQUIRED,
  setOfferItem,
  startTrade,
  withdrawConfirmation,
  withdrawExchange,
} from '@/server/application/trades'
import type { OriginChoice, OriginQuestion } from '@/server/application/trades'
import { ConflictError, isAppError } from '@/server/domain/errors'
import { currentViewer } from '@/server/http/viewer'
import type { ExchangeState, ShareState, StartTradeState, TradeActionState } from './state'

/**
 * As acoes da negociacao.
 *
 * Camada: `app`. Finas de proposito — leem a sessao, chamam **um** caso de uso
 * e traduzem o resultado. A regra, a transacao e a autorizacao estao no caso de
 * uso, e e la que ficam testadas.
 *
 * Nenhuma recebe `trade_participant_id`: quem descobre qual participante e quem
 * chamou e o servidor, a partir da sessao (regra 4.6.2). Um id vindo do
 * formulario seria a porta para editar a oferta do outro.
 */

const SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo.'

export async function startTradeAction(
  _previous: StartTradeState,
  _data: FormData,
): Promise<StartTradeState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }

  try {
    const { tradeId, inviteToken } = await startTrade(viewer)
    revalidatePath('/trocas')
    return { status: 'started', tradeId: String(tradeId), inviteToken }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}

export async function joinTradeAction(
  _previous: TradeActionState,
  data: FormData,
): Promise<TradeActionState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }

  const token = String(data.get('convite') ?? '').trim()
  if (token === '') return { status: 'error', message: 'Convite inválido.' }

  try {
    const tradeId = await joinTrade(viewer, token)
    revalidatePath('/trocas')
    revalidatePath(`/trocas/${tradeId}`)
    return { status: 'done' }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}

/**
 * Poe, muda ou tira uma carta da **propria** oferta.
 *
 * Quantidade zero remove. Qualquer alteracao revoga as confirmacoes, e isso
 * acontece dentro do caso de uso, na mesma transacao (regra 4.6.3).
 */
export async function setOfferAction(
  _previous: TradeActionState,
  data: FormData,
): Promise<TradeActionState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }

  const tradeId = String(data.get('tradeId') ?? '')
  const variantId = String(data.get('variantId') ?? '')
  const quantidade = Number(data.get('quantidade'))

  if (!/^\d+$/.test(tradeId) || !/^\d+$/.test(variantId) || !Number.isInteger(quantidade)) {
    return { status: 'error', message: 'Escolha inválida.' }
  }

  try {
    await setOfferItem(viewer, BigInt(tradeId), {
      cardVariantId: BigInt(variantId),
      quantity: quantidade,
    })
    revalidatePath(`/trocas/${tradeId}`)
    return { status: 'done' }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}

export async function confirmTradeAction(
  _previous: TradeActionState,
  data: FormData,
): Promise<TradeActionState> {
  return comATroca(data, async (viewer, tradeId) => {
    await confirmTrade(viewer, tradeId)
  })
}

export async function withdrawConfirmationAction(
  _previous: TradeActionState,
  data: FormData,
): Promise<TradeActionState> {
  return comATroca(data, async (viewer, tradeId) => {
    await withdrawConfirmation(viewer, tradeId)
  })
}

export async function cancelTradeAction(
  _previous: TradeActionState,
  data: FormData,
): Promise<TradeActionState> {
  return comATroca(data, async (viewer, tradeId) => {
    await cancelTrade(viewer, tradeId)
  })
}

/**
 * Marca que as cartas trocaram de mao.
 *
 * Os dois marcam (decisao 062), e quem marca por ultimo conclui — mas quem chama
 * nao decide isso: o caso de uso ve as duas marcacoes e responde qual dos dois
 * aconteceu.
 *
 * A escolha de origem, quando a regra 4.6 exige uma, chega em campos `origem` e
 * vai junto na **mesma** chamada. Duas idas — escolher, depois marcar —
 * deixariam uma janela com a marcacao dada e a origem indefinida.
 */
export async function markExchangeAction(
  _previous: ExchangeState,
  data: FormData,
): Promise<ExchangeState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }

  const tradeId = String(data.get('tradeId') ?? '')
  if (!/^\d+$/.test(tradeId)) return { status: 'error', message: 'Troca inválida.' }

  const choices = readOrigins(data)
  if (choices === null) return { status: 'error', message: 'Escolha de origem inválida.' }

  try {
    const { completed } = await markExchange(viewer, BigInt(tradeId), choices)

    revalidatePath('/trocas')
    revalidatePath(`/trocas/${tradeId}`)

    /*
     * Concluir mexe na colecao dos dois, e as telas que contam cartas ficariam
     * mostrando o numero de antes. Sao as mesmas rotas que `setQuantityAction`
     * revalida, pelo mesmo motivo.
     */
    if (completed) {
      revalidatePath('/colecao')
      revalidatePath('/colecao/playsets')
      revalidatePath('/inicio')
    }

    return completed ? { status: 'completed' } : { status: 'marked' }
  } catch (error) {
    if (error instanceof ConflictError && error.code === ORIGIN_CHOICE_REQUIRED) {
      const details = error.details as { cards: OriginQuestion[] }
      return { status: 'origin', message: error.message, cards: details.cards }
    }
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}

export async function withdrawExchangeAction(
  _previous: TradeActionState,
  data: FormData,
): Promise<TradeActionState> {
  return comATroca(data, async (viewer, tradeId) => {
    await withdrawExchange(viewer, tradeId)
  })
}

/**
 * As escolhas de origem que vieram do formulario.
 *
 * Cada campo `origem` e `variante:local:quantidade`. Tres numeros num campo so
 * porque a alternativa — tres campos com nomes correlacionados — obrigaria a
 * remontar os trios por indice, e um indice fora de ordem juntaria a quantidade
 * de uma carta com o local de outra sem nenhum erro aparecer.
 *
 * Devolve `null` a qualquer coisa fora do formato. Nada aqui e confiavel: os
 * ids sao conferidos contra o que a pessoa tem, no caso de uso.
 */
function readOrigins(data: FormData): OriginChoice[] | null {
  const byVariant = new Map<string, OriginChoice>()

  for (const raw of data.getAll('origem')) {
    const partes = String(raw).split(':')
    if (partes.length !== 3) return null

    const [variante, local, quantidade] = partes
    if (!/^\d+$/.test(variante) || !/^\d+$/.test(local) || !/^\d+$/.test(quantidade)) return null

    const numero = Number(quantidade)
    if (numero <= 0) return null

    const found = byVariant.get(variante)
    if (found) found.removals.push({ storageLocationId: local, quantity: numero })
    else
      byVariant.set(variante, {
        cardVariantId: BigInt(variante),
        removals: [{ storageLocationId: local, quantity: numero }],
      })
  }

  return [...byVariant.values()]
}

/** O que confirmar, retirar e cancelar tem em comum: sessao, id e revalidacao. */
async function comATroca(
  data: FormData,
  operacao: (
    viewer: NonNullable<Awaited<ReturnType<typeof currentViewer>>>,
    tradeId: bigint,
  ) => Promise<void>,
): Promise<TradeActionState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }

  const tradeId = String(data.get('tradeId') ?? '')
  if (!/^\d+$/.test(tradeId)) return { status: 'error', message: 'Troca inválida.' }

  try {
    await operacao(viewer, BigInt(tradeId))
    revalidatePath('/trocas')
    revalidatePath(`/trocas/${tradeId}`)
    return { status: 'done' }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}

/**
 * Publica o Trade Binder, ou troca o link por um novo.
 *
 * Camada: `app`. Le a sessao, chama **um** caso de uso e traduz o resultado. O
 * token nasce no servidor e nunca vem do formulario — um token escolhido por
 * quem chama seria adivinhavel por quem quisesse.
 */
export async function publishTradeBinderAction(
  _previous: ShareState,
  _data: FormData,
): Promise<ShareState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }

  try {
    const { token } = await publishTradeBinder(viewer)
    revalidatePath('/trocas')
    return { status: 'published', token: token ?? '' }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}

export async function revokeTradeBinderAction(
  _previous: ShareState,
  _data: FormData,
): Promise<ShareState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }

  try {
    await revokeTradeBinder(viewer)
    revalidatePath('/trocas')
    return { status: 'revoked' }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}
