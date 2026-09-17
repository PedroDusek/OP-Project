import { NextResponse } from 'next/server'
import { conversationState } from '@/server/application/social'
import { isAppError } from '@/server/domain/errors'
import { currentViewer } from '@/server/http/viewer'

/**
 * O estado de uma conversa aberta: a última mensagem e se dá para escrever.
 *
 * Camada: `app`. A conversa pergunta aqui a cada três segundos e, quando algo
 * muda, pede ao Next para redesenhar a página — como a troca ao vivo (decisão
 * 065). A resposta não traz as mensagens: quem sabe montar a conversa é a
 * página, e é ao se redesenhar que ela marca como lida.
 *
 * A autorização é a do caso de uso: só quem participa recebe resposta.
 */
export async function GET(_request: Request, { params }: RouteContext<'/api/conversas/[id]/estado'>) {
  const { id } = await params

  const viewer = await currentViewer()
  if (!viewer) return NextResponse.json({ erro: 'sem sessão' }, { status: 401 })
  if (!/^\d+$/.test(id)) return NextResponse.json({ erro: 'conversa inválida' }, { status: 400 })

  try {
    const estado = await conversationState(viewer, BigInt(id))
    return NextResponse.json(estado, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    if (isAppError(error) && error.kind === 'NOT_FOUND') {
      return NextResponse.json({ erro: 'conversa não encontrada' }, { status: 404 })
    }
    throw error
  }
}
