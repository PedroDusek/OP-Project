'use client'

import { useActionState } from 'react'
import { ArrowRight, Check, Minus, Plus, TriangleAlert, X } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { Button } from '@/components/ui/button'
import { Panel, PanelList, ListRow } from '@/components/ui/surface'
import {
  cancelTradeAction,
  confirmTradeAction,
  setOfferAction,
  withdrawConfirmationAction,
} from '@/app/(app)/trocas/actions'
import { TRADE_ACTION_IDLE } from '@/app/(app)/trocas/state'
import type { TradeCardOffer, TradeView } from '@/server/application/trades'

/**
 * A negociação de uma troca.
 *
 * ## Sempre "eu" e "a outra pessoa"
 *
 * Nunca "participante 1" e "participante 2". Quem olha precisa saber o que
 * **está oferecendo** e o que **vai receber**, e essa orientação depende de quem
 * está olhando — por isso ela é resolvida no servidor, e não aqui.
 *
 * ## A oferta do outro é só leitura, e não por educação
 *
 * Cada um mexe apenas na própria (`business-rules.md` 4.6.2). Isto aqui é a
 * aparência dessa regra; quem a **garante** é o servidor, que descobre sozinho
 * qual participante é quem chamou. Nenhum formulário desta tela manda um id de
 * participante.
 *
 * ## O aviso de revisão vem antes de tudo
 *
 * Quando a outra pessoa altera depois de eu ter confirmado, a confirmação cai e
 * a tela precisa dizer por quê. Sem isso ela pediria "confirme" como se fosse a
 * primeira vez, e a pessoa reconfirmaria sem saber que o combinado mudou.
 *
 * ## Sugestão não é oferta
 *
 * O cruzamento mostra o que interessa ao outro; colocar na oferta é um gesto
 * separado, e deliberado. Um match não compromete cópia nenhuma (regra 4.3), e
 * uma tela que já viesse com tudo oferecido decidiria pela pessoa.
 */
export function TradeNegotiation({ trade }: { trade: TradeView }) {
  const encerrada = trade.status === 'COMPLETED' || trade.status === 'CANCELLED'

  return (
    <div className="flex flex-col gap-5">
      {trade.me.reviewRequested ? (
        <Panel className="flex items-start gap-3 border-warning/40 bg-warning-soft p-4">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm text-text">
            <strong>{trade.other?.name ?? 'A outra pessoa'} alterou a troca.</strong> Revise o que
            está combinado e confirme de novo.
          </p>
        </Panel>
      ) : null}

      <TradeStatusPanel trade={trade} />

      <OfferSection
        title="Você oferece"
        offer={trade.me.offer}
        confirmed={trade.me.confirmed}
        tradeId={trade.tradeId}
        editable={!encerrada}
      />

      {trade.iCanOffer.length > 0 && !encerrada ? (
        <Suggestions
          title={`O que ${trade.other?.name ?? 'a outra pessoa'} procura e você tem`}
          description="Toque para pôr na sua oferta. Enquanto não puser, nada está oferecido."
          cards={trade.iCanOffer}
          offer={trade.me.offer}
          tradeId={trade.tradeId}
        />
      ) : null}

      <OfferSection
        title={`${trade.other?.name ?? 'A outra pessoa'} oferece`}
        offer={trade.other?.offer ?? []}
        confirmed={trade.other?.confirmed ?? false}
        tradeId={trade.tradeId}
        editable={false}
      />

      {!encerrada ? <TradeControls trade={trade} /> : null}
    </div>
  )
}

/** Onde a troca está: quem confirmou, e o que falta para valer. */
function TradeStatusPanel({ trade }: { trade: TradeView }) {
  const outro = trade.other?.name ?? 'a outra pessoa'

  const texto = trade.validated
    ? 'Os dois confirmaram. A troca está combinada.'
    : trade.me.confirmed
      ? `Você confirmou. Falta ${outro} confirmar.`
      : trade.other?.confirmed
        ? `${outro} confirmou. Falta você.`
        : 'Ninguém confirmou ainda. Ajuste as ofertas à vontade.'

  return (
    <Panel className="flex items-center gap-3 p-4">
      <span
        aria-hidden
        className={
          trade.validated
            ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success'
            : 'flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-muted'
        }
      >
        {trade.validated ? <Check className="size-5" /> : <ArrowRight className="size-5" />}
      </span>
      <p className="text-sm text-text">{texto}</p>
    </Panel>
  )
}

function OfferSection({
  title,
  offer,
  confirmed,
  tradeId,
  editable,
}: {
  title: string
  offer: TradeCardOffer[]
  confirmed: boolean
  tradeId: string
  editable: boolean
}) {
  const copias = offer.reduce((total, item) => total + item.quantity, 0)

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {confirmed ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <Check className="size-3.5" aria-hidden />
            confirmou
          </span>
        ) : null}
      </div>

      {offer.length === 0 ? (
        <Panel className="px-4 py-3">
          <p className="text-sm text-text-muted">Nada oferecido ainda.</p>
        </Panel>
      ) : (
        <>
          <PanelList>
            {offer.map((item) => (
              <ListRow
                key={item.variantId}
                leading={
                  <CardArt
                    src={item.imageUrl}
                    alt=""
                    fallback={item.cardCode}
                    sizes="44px"
                    className="w-11 rounded-md"
                  />
                }
                title={item.cardCode}
                description={item.cardName}
                trailing={
                  editable ? (
                    <OfferStepper tradeId={tradeId} item={item} />
                  ) : (
                    <span className="text-sm font-semibold text-text tabular-nums">
                      {item.quantity}x
                    </span>
                  )
                }
                hideChevron
              />
            ))}
          </PanelList>
          <p className="text-xs text-text-muted tabular-nums">
            {copias} {copias === 1 ? 'cópia' : 'cópias'} · {offer.length}{' '}
            {offer.length === 1 ? 'carta' : 'cartas'}
          </p>
        </>
      )}
    </section>
  )
}

/**
 * O "- N +" de um item da própria oferta.
 *
 * Três formulários, e não um com estado no cliente: cada toque é uma escrita
 * completa, e a quantidade vai no `value` do botão que foi apertado. É o mesmo
 * arranjo do resto do produto, e existe para não depender de um `setState`
 * assíncrono acontecer antes do envio.
 */
function OfferStepper({ tradeId, item }: { tradeId: string; item: TradeCardOffer }) {
  const [state, submit, saving] = useActionState(setOfferAction, TRADE_ACTION_IDLE)

  return (
    <form action={submit} className="flex items-center gap-1">
      <input type="hidden" name="tradeId" value={tradeId} />
      <input type="hidden" name="variantId" value={item.variantId} />

      <button
        type="submit"
        name="quantidade"
        value={item.quantity - 1}
        disabled={saving}
        aria-label={`Tirar uma cópia de ${item.cardCode} da sua oferta`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-border bg-surface text-text transition-colors hover:bg-surface-muted disabled:opacity-40"
      >
        <Minus className="size-4" aria-hidden />
      </button>

      <span className="w-6 text-center text-sm font-semibold text-text tabular-nums">
        {item.quantity}
      </span>

      <button
        type="submit"
        name="quantidade"
        value={item.quantity + 1}
        disabled={saving}
        aria-label={`Acrescentar uma cópia de ${item.cardCode} à sua oferta`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-accent-ink/30 bg-accent-soft text-accent-ink transition-colors hover:brightness-95 disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden />
      </button>

      {state.status === 'error' ? (
        <span role="alert" className="sr-only">
          {state.message}
        </span>
      ) : null}
    </form>
  )
}

/** O cruzamento: o que interessa ao outro e você tem disponível. */
function Suggestions({
  title,
  description,
  cards,
  offer,
  tradeId,
}: {
  title: string
  description: string
  cards: TradeView['iCanOffer']
  offer: TradeCardOffer[]
  tradeId: string
}) {
  const jaOferecido = new Set(offer.map((item) => item.variantId))
  const restantes = cards.filter((card) => !jaOferecido.has(card.variantId))
  if (restantes.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <p className="text-xs text-text-muted">{description}</p>
      <PanelList>
        {restantes.map((card) => (
          <SuggestionRow key={card.variantId} card={card} tradeId={tradeId} />
        ))}
      </PanelList>
    </section>
  )
}

function SuggestionRow({
  card,
  tradeId,
}: {
  card: TradeView['iCanOffer'][number]
  tradeId: string
}) {
  const [, submit, saving] = useActionState(setOfferAction, TRADE_ACTION_IDLE)

  return (
    <form action={submit}>
      <input type="hidden" name="tradeId" value={tradeId} />
      <input type="hidden" name="variantId" value={card.variantId} />
      <input type="hidden" name="quantidade" value={card.quantity} />
      <ListRow
        leading={
          <CardArt
            src={card.imageUrl}
            alt=""
            fallback={card.cardCode}
            sizes="44px"
            className="w-11 rounded-md"
          />
        }
        title={card.cardCode}
        description={`${card.cardName} · ${card.available} disponíveis, procura ${card.stillWanted}`}
        trailing={
          <Button type="submit" variant="secondary" loading={saving}>
            Oferecer {card.quantity}
          </Button>
        }
        hideChevron
      />
    </form>
  )
}

/** Confirmar, retirar a confirmação, cancelar. */
function TradeControls({ trade }: { trade: TradeView }) {
  const [, confirmar, confirmando] = useActionState(confirmTradeAction, TRADE_ACTION_IDLE)
  const [, retirar, retirando] = useActionState(withdrawConfirmationAction, TRADE_ACTION_IDLE)
  const [, cancelar, cancelando] = useActionState(cancelTradeAction, TRADE_ACTION_IDLE)

  const semOutro = trade.other === null

  return (
    <div className="flex flex-col gap-2">
      {trade.me.confirmed ? (
        <form action={retirar}>
          <input type="hidden" name="tradeId" value={trade.tradeId} />
          <Button type="submit" variant="secondary" block loading={retirando}>
            Retirar minha confirmação
          </Button>
        </form>
      ) : (
        <form action={confirmar}>
          <input type="hidden" name="tradeId" value={trade.tradeId} />
          <Button type="submit" block loading={confirmando} disabled={semOutro}>
            <Check className="size-4" aria-hidden />
            Confirmar esta troca
          </Button>
        </form>
      )}

      {semOutro ? (
        <p className="text-xs text-text-muted">
          A troca só pode ser confirmada depois que alguém entrar pelo convite.
        </p>
      ) : null}

      <form action={cancelar}>
        <input type="hidden" name="tradeId" value={trade.tradeId} />
        <Button type="submit" variant="ghost" block loading={cancelando}>
          <X className="size-4" aria-hidden />
          Cancelar a troca
        </Button>
      </form>
    </div>
  )
}
