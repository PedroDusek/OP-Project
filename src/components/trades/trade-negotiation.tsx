'use client'

import { useActionState, useEffect, useState } from 'react'
import { ArrowRight, Check, Handshake, Minus, Plus, TriangleAlert, X } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { Button } from '@/components/ui/button'
import { Panel, PanelList, ListRow } from '@/components/ui/surface'
import { ExchangeControls } from '@/components/trades/trade-exchange'
import { useLiveTrade } from '@/components/trades/use-live-trade'
import { secondsUntilConfirm } from '@/server/domain/trades/cooldown'
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
  const concluida = trade.status === 'COMPLETED'
  const encerrada = concluida || trade.status === 'CANCELLED'
  const outro = trade.other?.name ?? 'A outra pessoa'

  /*
   * A negociacao e a duas maos: quem monta uma oferta precisa ver a do outro
   * mudando. Para de perguntar quando a troca termina — nao ha mais o que
   * mudar, e continuar seria cota gasta a toa.
   */
  useLiveTrade(trade.tradeId, !encerrada)

  return (
    <div className="flex flex-col gap-5">
      {trade.me.reviewRequested ? (
        <Panel className="flex items-start gap-3 border-warning/40 bg-warning-soft p-4">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm text-text">
            <strong>{outro} alterou a troca.</strong> Revise o que está combinado e confirme de
            novo.
          </p>
        </Panel>
      ) : null}

      <TradeStatusPanel trade={trade} />

      {/*
        Depois de concluida a tela muda de tempo verbal. "Voce oferece" descreve
        uma proposta em aberto, e ler isso numa troca que ja aconteceu faz duvidar
        se ela aconteceu mesmo.
      */}
      <OfferSection
        title={concluida ? 'Você entregou' : 'Você oferece'}
        offer={trade.me.offer}
        confirmed={!concluida && trade.me.confirmed}
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
        title={concluida ? 'Você recebeu' : `${outro} oferece`}
        offer={trade.other?.offer ?? []}
        confirmed={!concluida && (trade.other?.confirmed ?? false)}
        tradeId={trade.tradeId}
        editable={false}
      />

      {/*
        Marcar so aparece depois de os dois confirmarem. Antes disso a troca ainda
        se negocia, e "ja trocamos" seria um gesto sobre um combinado que ninguem
        fechou (regra 4.5 e decisao 062).
      */}
      {trade.validated && !encerrada ? <ExchangeControls trade={trade} /> : null}

      {!encerrada ? <TradeControls trade={trade} /> : null}
    </div>
  )
}

/** Onde a troca está: quem confirmou, quem marcou, e o que falta. */
function TradeStatusPanel({ trade }: { trade: TradeView }) {
  const outro = trade.other?.name ?? 'a outra pessoa'
  const concluida = trade.status === 'COMPLETED'

  const texto = concluida
    ? 'Troca concluída. As cartas já estão nas coleções de vocês dois.'
    : trade.status === 'CANCELLED'
      ? 'Troca cancelada.'
      : trade.validated
        ? trade.me.exchanged
          ? `Você marcou que trocaram. Falta ${outro}.`
          : trade.other?.exchanged
            ? `${outro} marcou que vocês trocaram. Falta você.`
            : 'Os dois confirmaram. Quando trocarem as cartas, marquem aqui.'
        : trade.me.confirmed
          ? `Você confirmou. Falta ${outro} confirmar.`
          : trade.other?.confirmed
            ? `${outro} confirmou. Falta você.`
            : 'Ninguém confirmou ainda. Ajuste as ofertas à vontade.'

  const feito = concluida || trade.validated

  return (
    <Panel className="flex items-center gap-3 p-4">
      <span
        aria-hidden
        className={
          feito
            ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success'
            : 'flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-muted'
        }
      >
        {concluida ? (
          <Handshake className="size-5" />
        ) : feito ? (
          <Check className="size-5" />
        ) : (
          <ArrowRight className="size-5" />
        )}
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

/**
 * Quantos segundos faltam para poder confirmar.
 *
 * A conta é do domínio; isto aqui só a repete a cada segundo para o número
 * andar na tela. Quem **recusa** confirmar cedo demais é o servidor — um relógio
 * adiantado aqui libera o botão antes, e a ação volta com o motivo.
 */
function useConfirmCountdown(offerChangedAt: Date | null): number {
  const [faltam, setFaltam] = useState(() => secondsUntilConfirm(offerChangedAt))

  /*
   * A contagem reinicia quando a oferta muda, e a comparacao e pelo **instante**
   * e nao pelo objeto: cada redesenho do servidor traz uma `Date` nova, e comparar
   * referencias reiniciaria a cada volta da consulta.
   *
   * Comparar durante a renderizacao, e nao num efeito, e o padrao ja usado na
   * folha de quantidade — num efeito, `setState` dispara renderizacao em cascata
   * e o lint do React recusa.
   */
  const instante = offerChangedAt?.getTime() ?? null
  const [ultimo, setUltimo] = useState(instante)
  if (instante !== ultimo) {
    setUltimo(instante)
    setFaltam(secondsUntilConfirm(offerChangedAt))
  }

  useEffect(() => {
    if (instante === null) return

    const timer = setInterval(() => {
      const restante = secondsUntilConfirm(new Date(instante))
      setFaltam(restante)
      if (restante === 0) clearInterval(timer)
    }, 250)

    return () => clearInterval(timer)
  }, [instante])

  return faltam
}

/** Confirmar, retirar a confirmação, cancelar. */
function TradeControls({ trade }: { trade: TradeView }) {
  const [, confirmar, confirmando] = useActionState(confirmTradeAction, TRADE_ACTION_IDLE)
  const [, retirar, retirando] = useActionState(withdrawConfirmationAction, TRADE_ACTION_IDLE)
  const [, cancelar, cancelando] = useActionState(cancelTradeAction, TRADE_ACTION_IDLE)

  const semOutro = trade.other === null
  const faltam = useConfirmCountdown(trade.offerChangedAt)
  const esperando = faltam > 0

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
          <Button type="submit" block loading={confirmando} disabled={semOutro || esperando}>
            <Check className="size-4" aria-hidden />
            {esperando ? `Confirmar em ${faltam}s` : 'Confirmar esta troca'}
          </Button>
        </form>
      )}

      {semOutro ? (
        <p className="text-xs text-text-muted">
          A troca só pode ser confirmada depois que alguém entrar pelo convite.
        </p>
      ) : esperando ? (
        <p className="text-xs text-text-muted" aria-live="polite">
          A oferta acabou de mudar. Confira o que está combinado antes de confirmar.
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
