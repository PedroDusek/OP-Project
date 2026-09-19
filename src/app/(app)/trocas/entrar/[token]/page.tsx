import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { JoinTrade } from '@/components/trades/join-trade'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Entrar numa troca' }

/**
 * Entrar numa troca pelo convite.
 *
 * A entrada **não** acontece por abrir a página: é aqui que o consentimento
 * fecha (regra 4.6.1), e a partir dela o seu Trade Binder e a sua want list
 * passam a ser cruzados com os da outra pessoa. Um clique num link recebido não
 * é consentimento — a pessoa precisa saber no que está entrando e dizer que
 * sim.
 */
export default async function EntrarNaTrocaPage({
  params,
}: PageProps<'/trocas/entrar/[token]'>) {
  const { token } = await params
  await requireViewer(`/trocas/entrar/${token}`)

  return (
    <>
      <PageHeader
        back={{ href: '/trocas', label: 'Trocas' }}
        title="Você foi convidado"
        description="Ao entrar, vocês dois passam a ver o que um tem do interesse do outro."
      />

      <JoinTrade token={token} />
    </>
  )
}
