'use server'

import { revalidatePath } from 'next/cache'
import { recordStarterDeck } from '@/server/application/catalog'
import { isAppError } from '@/server/domain/errors'
import type { StarterDeckState } from './state'

/**
 * Grava quantas cópias de cada carta um starter deck traz.
 *
 * Camada: `app`. Fina de propósito — lê o formulário, chama **um** caso de uso
 * e traduz o resultado. A recusa fora de desenvolvimento, a conferência dos
 * códigos e a exigência de somar 50 estão no caso de uso e no domínio.
 *
 * Sem sessão pelo mesmo motivo da conferência da Liga e da tabela dos DON!!:
 * não há dado de pessoa, e o que ela grava só chega a algum lugar por PR.
 */
export async function recordStarterDeckAction(
  _previous: StarterDeckState,
  data: FormData,
): Promise<StarterDeckState> {
  const deck = String(data.get('deck') ?? '').trim()
  if (deck === '') return { status: 'error', message: 'Deck não informado.' }

  /*
   * Os campos chegam como `copias:ST01-002`. O nome carrega o codigo da carta
   * porque o formulario tem uma linha por carta e o numero delas varia de deck
   * para deck — de 13 a 16, medido em 25/11.
   */
  const cartas: { carta: string; copias: number }[] = []
  for (const [chave, valor] of data.entries()) {
    if (!chave.startsWith('copias:')) continue

    const carta = chave.slice('copias:'.length).trim()
    const copias = Number.parseInt(String(valor), 10)
    if (carta === '' || !Number.isFinite(copias) || copias <= 0) continue

    cartas.push({ carta, copias })
  }

  try {
    await recordStarterDeck(deck, cartas)
    revalidatePath('/dev/starter')
    return {
      status: 'saved',
      deck,
      total: cartas.reduce((soma, linha) => soma + linha.copias, 0),
    }
  } catch (error) {
    if (isAppError(error)) return { status: 'error', message: error.message }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Não foi possível gravar.',
    }
  }
}
