'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Handshake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/surface'
import { joinTradeAction } from '@/app/(app)/trocas/actions'
import { TRADE_ACTION_IDLE } from '@/app/(app)/trocas/state'

/**
 * O aceite do convite.
 *
 * ## Abrir o link não é entrar
 *
 * Entrar é o que fecha o consentimento das duas partes (regra 4.6.1), e a
 * partir dele a want list e o Trade Binder de quem entra passam a ser cruzados
 * com os do outro. Um clique num link recebido no WhatsApp não é
 * consentimento — a pessoa precisa saber no que está entrando e dizer que sim.
 *
 * Por isso a página explica antes, e a entrada é um botão.
 *
 * ## Depois de entrar, a tela é outra
 *
 * A ação não sabe para onde ir, porque ela é a mesma para qualquer convite. Ela
 * devolve "deu certo" e quem navega é o cliente — e vai para `/trocas`, que
 * sabe qual é a troca aberta e leva para ela.
 */
export function JoinTrade({ token }: { token: string }) {
  const [state, submit, entrando] = useActionState(joinTradeAction, TRADE_ACTION_IDLE)
  const router = useRouter()

  /*
   * A navegação vai num efeito, e não durante a renderização.
   *
   * Navegar é falar com um sistema externo — que é para o que efeito serve. Na
   * renderização, `replace` seria disparado a cada passagem enquanto o estado
   * continuasse `done`, e o componente pediria a mesma navegação em laço até
   * desmontar.
   */
  useEffect(() => {
    if (state.status === 'done') router.replace('/trocas')
  }, [state.status, router])

  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-2 p-4">
        <h2 className="text-sm font-semibold text-text">O que acontece ao entrar</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-muted">
          <li>Vocês dois veem o que um tem do interesse do outro.</li>
          <li>Cada um monta a própria oferta, e ninguém mexe na do outro.</li>
          <li>A troca só vale quando os dois confirmarem.</li>
          <li>Você pode cancelar a qualquer momento.</li>
        </ul>
      </Panel>

      <form action={submit} className="flex flex-col gap-2">
        <input type="hidden" name="convite" value={token} />
        <Button type="submit" block loading={entrando}>
          <Handshake className="size-4" aria-hidden />
          Entrar nesta troca
        </Button>
        {state.status === 'error' ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
      </form>
    </div>
  )
}
