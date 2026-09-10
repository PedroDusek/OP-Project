'use client'

import { useActionState, useState } from 'react'
import { Copy, Check, Handshake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/surface'
import { startTradeAction } from '@/app/(app)/trocas/actions'
import { START_TRADE_IDLE } from '@/app/(app)/trocas/state'

/**
 * Começar uma troca e mandar o convite.
 *
 * ## Por que um link, e não uma busca por pessoa
 *
 * O produto não tem lista de amigos nem nome de usuário público, e buscar por
 * e-mail revelaria quem é cadastrado a quem tentasse — vazamento no exato lugar
 * que o protocolo de troca protege (decisão 056). Quem abre a troca manda o
 * link por onde já conversa.
 *
 * ## Copiar, e não ditar
 *
 * O token é longo de propósito: quem entra passa a ver o cruzamento do seu
 * Trade Binder com a want list dele, e um código curto seria adivinhável. Por
 * isso a tela oferece copiar, e não mostra um código para alguém ler em voz
 * alta.
 */
export function TradeStarter({ appUrl }: { appUrl: string }) {
  const [state, submit, criando] = useActionState(startTradeAction, START_TRADE_IDLE)
  const [copiado, setCopiado] = useState(false)

  if (state.status === 'started') {
    const link = `${appUrl}/trocas/entrar/${state.inviteToken}`

    return (
      <Panel className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Convite criado</h2>
          <p className="mt-1 text-sm text-text-muted">
            Mande este link para quem vai trocar com você. Quando a pessoa entrar, vocês veem o que
            um tem do interesse do outro.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            aria-label="Link do convite"
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-control border border-border bg-surface-muted px-3 py-2 text-sm text-text"
          />
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => setCopiado(true))
            }}
          >
            {copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>

        <Button asChild variant="soft" block>
          <a href={`/trocas/${state.tradeId}`}>Abrir a troca</a>
        </Button>
      </Panel>
    )
  }

  return (
    <form action={submit} className="flex flex-col gap-2">
      <Button type="submit" block loading={criando}>
        <Handshake className="size-4" aria-hidden />
        Começar uma troca
      </Button>
      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
