'use server'

import { revalidatePath } from 'next/cache'
import {
  cancelTrade,
  confirmTrade,
  joinTrade,
  setOfferItem,
  startTrade,
  withdrawConfirmation,
} from '@/server/application/trades'
import { isAppError } from '@/server/domain/errors'
import { currentViewer } from '@/server/http/viewer'
import type { StartTradeState, TradeActionState } from './state'

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
