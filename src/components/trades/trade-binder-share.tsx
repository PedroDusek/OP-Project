'use client'

import { useActionState, useState } from 'react'
import { Check, Copy, Link2, Share2, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/surface'
import {
  publishTradeBinderAction,
  revokeTradeBinderAction,
} from '@/app/(app)/trocas/actions'
import { SHARE_IDLE } from '@/app/(app)/trocas/state'
import type { TradeBinderShare } from '@/server/application/trades'

/**
 * Publicar o Trade Binder por link (tela 31).
 *
 * ## O que vai no link é o conjunto
 *
 * Todas as cópias em locais de troca, somadas, como uma coleção só. A divisão
 * entre binder e caixa é organização de quem guarda, e quem abre o link está
 * procurando uma carta (decisão 064).
 *
 * ## A tela diz o que a página mostra, antes de publicar
 *
 * Publicar expõe dado para quem tiver o endereço, e a pessoa precisa saber
 * exatamente o quê **antes** do gesto, não depois. Por isso a lista do que
 * aparece e do que não aparece fica visível junto do botão, e não escondida
 * atrás de um "saiba mais".
 *
 * ## Revogar é um gesto de igual peso
 *
 * Fica ao lado do link, não num menu. Quem mandou para a pessoa errada precisa
 * do caminho curto — e um link que continua valendo é um link que ainda pode
 * circular.
 */
export function TradeBinderShareCard({
  share,
  appUrl,
  cards,
}: {
  share: TradeBinderShare
  appUrl: string
  /** Quantas cartas distintas iriam no link, para a tela não prometer o vazio. */
  cards: number
}) {
  const [publicar, publicarAction, publicando] = useActionState(
    publishTradeBinderAction,
    SHARE_IDLE,
  )
  const [revogar, revogarAction, revogando] = useActionState(
    revokeTradeBinderAction,
    SHARE_IDLE,
  )
  const [copiado, setCopiado] = useState(false)

  /*
   * O token da acao vence o que veio do servidor: logo depois de publicar, a
   * pagina ainda nao foi revalidada, e mostrar o estado antigo faria o botao
   * parecer que nao funcionou.
   */
  const token =
    revogar.status === 'revoked'
      ? null
      : publicar.status === 'published'
        ? publicar.token
        : share.token

  const link = token ? `${appUrl}/trade/${token}` : null
  const erro =
    publicar.status === 'error'
      ? publicar.message
      : revogar.status === 'error'
        ? revogar.message
        : null

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink"
        >
          <Share2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text">Compartilhar meu Trade Binder</h3>
          <p className="mt-0.5 text-sm text-text-muted">
            {link
              ? 'Quem tiver este link vê o que você tem disponível para troca.'
              : 'Um link para mandar a quem quiser ver o que você tem para trocar.'}
          </p>
        </div>
      </div>

      {/*
        O que a página mostra, antes de publicar e não depois. Publicar expõe
        dado, e a pessoa decide melhor sabendo o que sai e o que fica.
      */}
      {!link ? (
        <div className="rounded-control bg-surface-muted px-3 py-2.5 text-sm">
          <p className="text-text">
            A página mostra <strong>seu nome de usuário</strong> e as cartas disponíveis para
            troca, somadas num conjunto só.
          </p>
          <p className="mt-1 text-text-muted">
            Não mostra sua coleção, seus outros locais, seus decks, sua want list, nem seu nome
            real ou e-mail.
          </p>
        </div>
      ) : null}

      {cards === 0 ? (
        <p className="flex items-start gap-2 rounded-control bg-warning-soft px-3 py-2 text-sm text-text">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            Seu Trade Binder está vazio. O link funciona, mas quem abrir não vai ver carta
            nenhuma — ponha cartas num local de troca primeiro.
          </span>
        </p>
      ) : null}

      {link ? (
        <>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              aria-label="Link do Trade Binder"
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-control border border-border bg-surface-muted px-3 py-2 text-sm text-text"
            />
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(link).then(() => setCopiado(true))
              }}
            >
              {copiado ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copiado ? 'Copiado' : 'Copiar'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <form action={publicarAction}>
              <Button type="submit" variant="ghost" loading={publicando}>
                <Link2 className="size-4" aria-hidden />
                Gerar um link novo
              </Button>
            </form>
            <form action={revogarAction}>
              <Button type="submit" variant="ghost" loading={revogando}>
                <X className="size-4" aria-hidden />
                Parar de compartilhar
              </Button>
            </form>
          </div>

          <p className="text-xs text-text-muted">
            Gerar um link novo derruba o anterior. É a saída de quem mandou para a pessoa
            errada.
          </p>
        </>
      ) : (
        <form action={publicarAction}>
          <Button type="submit" block loading={publicando}>
            <Share2 className="size-4" aria-hidden />
            Publicar e gerar o link
          </Button>
        </form>
      )}

      {erro ? (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      ) : null}
    </Panel>
  )
}
