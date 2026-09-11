import { NextResponse } from 'next/server'
import { getTrade } from '@/server/application/trades'
import { isAppError } from '@/server/domain/errors'
import { currentViewer } from '@/server/http/viewer'

/**
 * O estado de uma troca, para a tela saber se algo mudou.
 *
 * Camada: `app`. Lê a sessão, chama **um** caso de uso e devolve o mínimo.
 *
 * ## Por que existe um endereço só para isto
 *
 * A negociação é a duas mãos, e quem monta uma oferta precisa ver a do outro
 * mudando. A tela pergunta aqui a cada dois segundos e, quando alguma destas
 * marcas muda, pede ao Next para redesenhar a página.
 *
 * É de propósito que a resposta **não** traga as cartas. Redesenhar a página é
 * o que já sabe montar a troca inteira; montá-la aqui também daria dois lugares
 * capazes de discordar sobre a mesma troca, e o segundo estaria sempre um passo
 * atrás do primeiro.
 *
 * O que volta são datas e dois booleanos. Uma comparação, não uma tela.
 *
 * ## Quem pergunta precisa participar
 *
 * A autorização é a do `getTrade`, que recusa quem não é participante — a mesma
 * da página. Um endereço de leitura rápida é justamente onde é tentador afrouxar
 * isso, e onde afrouxar sairia mais caro: ele responde muitas vezes por minuto.
 */

export async function GET(_request: Request, { params }: RouteContext<'/api/trocas/[id]/estado'>) {
  const { id } = await params

  const viewer = await currentViewer()
  if (!viewer) return NextResponse.json({ erro: 'sem sessão' }, { status: 401 })

  if (!/^\d+$/.test(id)) return NextResponse.json({ erro: 'troca inválida' }, { status: 400 })

  try {
    const trade = await getTrade(viewer, BigInt(id))

    return NextResponse.json(
      {
        status: trade.status,
        offerChangedAt: trade.offerChangedAt?.toISOString() ?? null,
        completedAt: trade.completedAt?.toISOString() ?? null,
        // Quem confirmou e quem marcou: as duas coisas que mudam sem a oferta
        // mudar, e que a tela precisa refletir na mesma velocidade.
        meConfirmed: trade.me.confirmed,
        meExchanged: trade.me.exchanged,
        otherConfirmed: trade.other?.confirmed ?? false,
        otherExchanged: trade.other?.exchanged ?? false,
        otherPresent: trade.other !== null,
        /*
         * Quantas cartas cada lado oferece. A oferta pode mudar sem a marca de
         * alteracao servir de aviso — trocar a quantidade de uma carta mexe na
         * marca, mas somar os itens e uma segunda rede barata.
         */
        meItems: trade.me.offer.length,
        otherItems: trade.other?.offer.length ?? 0,
      },
      {
        // Consulta de estado nao se guarda: a resposta de dois segundos atras e
        // exatamente o que esta tela nao pode mostrar.
        headers: { 'cache-control': 'no-store' },
      },
    )
  } catch (error) {
    // Quem nao participa recebe o mesmo que quem pediu uma troca inexistente.
    if (isAppError(error)) return NextResponse.json({ erro: 'não encontrada' }, { status: 404 })
    throw error
  }
}
