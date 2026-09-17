import { NextResponse } from 'next/server'
import { readNotices } from '@/server/application/notifications'
import { currentViewer } from '@/server/http/viewer'

/**
 * Os avisos do sino (decisão 080).
 *
 * Camada: `app`. Lê a sessão, chama **um** caso de uso e devolve o resultado.
 *
 * ## Por que o sino pergunta, em vez de o layout calcular
 *
 * O layout das áreas autenticadas não é refeito ao navegar entre páginas: o
 * aviso calculado nele ficaria velho até a pessoa recarregar — guardar as cartas
 * e continuar vendo o pontinho. O sino pergunta aqui ao abrir cada página, ao
 * voltar para a aba e de tempos em tempos.
 */
export async function GET() {
  const viewer = await currentViewer()
  if (!viewer) return NextResponse.json({ erro: 'sem sessão' }, { status: 401 })

  const notices = await readNotices(viewer)
  return NextResponse.json({ notices }, { headers: { 'cache-control': 'no-store' } })
}
