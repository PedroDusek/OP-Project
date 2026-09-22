'use server'

import { revalidatePath } from 'next/cache'
import { analyzeDeck, saveDeck, type DeckAnalysis } from '@/server/application/decks'
import { bulkAddWants } from '@/server/application/wants'
import { isAppError } from '@/server/domain/errors'
import { currentViewer } from '@/server/http/viewer'

/**
 * As ações do Deck Builder (decisão 095).
 *
 * Camada: `app`. Finas: leem a sessão, chamam **um** caso de uso e traduzem o
 * resultado. Nenhuma regra do deck mora aqui.
 *
 * A lista vem da tela a cada conferência porque o deck **não é guardado**: o
 * servidor não tem onde buscá-la, e é essa a escolha do dono do produto.
 */

const SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo.'

export type DeckState =
  | { status: 'idle' }
  | { status: 'ok'; analysis: DeckAnalysis }
  | { status: 'error'; message: string }

export type WantsState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string }

export async function conferirDeckAction(input: {
  leaderVariantId: string
  lines: { variantId: string; copies: number }[]
  autoComplete: boolean
}): Promise<DeckState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }

  try {
    return { status: 'ok', analysis: await analyzeDeck(viewer, input) }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}

export type SaveState =
  | { status: 'idle' }
  | { status: 'ok'; id: string; message: string }
  | { status: 'error'; message: string }

/**
 * Salva a lista (decisão 108).
 *
 * Com `id`, regrava a mesma lista; sem, cria outra. Quem abriu uma lista para
 * corrigir não espera terminar com duas.
 *
 * Revalida `/deck` porque a estante mostra nome, capa e progresso — todos
 * mudam ao salvar, e a tela ficaria contando o estado anterior.
 */
export async function salvarDeckAction(input: {
  id?: string | null
  name: string
  leaderVariantId: string
  lines: { variantId: string; copies: number }[]
}): Promise<SaveState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }

  try {
    const { id } = await saveDeck(viewer, { ...input, autoComplete: true })
    revalidatePath('/deck')
    return { status: 'ok', id, message: 'Lista salva.' }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}

/** Manda o que falta para a want list, na arte escolhida no deck. */
export async function adicionarFaltantesAction(
  faltantes: { variantId: string; copies: number }[],
): Promise<WantsState> {
  const viewer = await currentViewer()
  if (!viewer) return { status: 'error', message: SESSAO_EXPIRADA }

  try {
    const { variants, copies } = await bulkAddWants(
      viewer,
      faltantes.map((item) => ({ cardVariantId: BigInt(item.variantId), copies: item.copies })),
    )
    revalidatePath('/quero')
    return {
      status: 'ok',
      message: `${copies} ${copies === 1 ? 'cópia' : 'cópias'} de ${variants} ${variants === 1 ? 'carta' : 'cartas'} na sua want list.`,
    }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    throw error
  }
}
