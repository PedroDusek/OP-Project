'use client'

import { useActionState, useState } from 'react'
import { Check, Handshake, Package, TriangleAlert } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { Button } from '@/components/ui/button'
import { QuantitySelector } from '@/components/ui/quantity-selector'
import { Panel } from '@/components/ui/surface'
import { markExchangeAction, withdrawExchangeAction } from '@/app/(app)/trocas/actions'
import { EXCHANGE_IDLE, TRADE_ACTION_IDLE } from '@/app/(app)/trocas/state'
import type { OriginQuestion, TradeView } from '@/server/application/trades'

/**
 * O último gesto de uma troca: dizer que as cartas mudaram de dono.
 *
 * ## Confirmar não é ter trocado
 *
 * Só aparece depois que os dois confirmaram, porque é a essa altura que a troca
 * sai da tela e vai para o mundo. Confirmar é concordar com o combinado; marcar
 * é dizer que o encontro aconteceu — e entre um e outro pode passar uma semana.
 *
 * **Os dois marcam** (decisão 062). Isto não é cerimônia: concluir mexe na
 * coleção das duas pessoas, e ninguém deveria ter as próprias cartas movidas
 * pelo gesto do outro.
 *
 * ## A pergunta que só existe às vezes
 *
 * Quando as cópias de uma carta estão em mais de um binder de troca e a troca
 * leva só parte delas, a regra 4.6 manda perguntar de onde elas saem. O servidor
 * é quem sabe disso, e ele responde com a pergunta pronta — carta, quantidade e
 * locais — em vez de a tela ter de descobrir sozinha se precisa perguntar.
 *
 * Na maioria das vezes a pergunta não aparece: cópias num binder só, ou saindo
 * todas, se deduzem (decisão 049).
 */
export function ExchangeControls({ trade }: { trade: TradeView }) {
  const [state, marcar, marcando] = useActionState(markExchangeAction, EXCHANGE_IDLE)
  const [, retirar, retirando] = useActionState(withdrawExchangeAction, TRADE_ACTION_IDLE)

  const outro = trade.other?.name ?? 'a outra pessoa'

  if (trade.me.exchanged) {
    return (
      <div className="flex flex-col gap-2">
        <Panel className="flex items-start gap-3 p-4">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
          >
            <Check className="size-5" />
          </span>
          <p className="text-sm text-text">
            <strong>Você marcou que trocaram.</strong> Falta {outro} marcar para as cartas mudarem
            de lugar nas duas coleções.
          </p>
        </Panel>

        <form action={retirar}>
          <input type="hidden" name="tradeId" value={trade.tradeId} />
          <Button type="submit" variant="secondary" block loading={retirando}>
            Retirar minha marcação
          </Button>
        </form>
      </div>
    )
  }

  return (
    <form action={marcar} className="flex flex-col gap-3">
      <input type="hidden" name="tradeId" value={trade.tradeId} />

      {/*
        Quem ja marcou, e quem falta, esta no painel de status la em cima. Repetir
        aqui poria duas frases quase iguais empilhadas na mesma tela — e a segunda
        so ensinaria a pessoa a parar de ler as duas.
      */}
      {state.status === 'origin' ? <OriginPicker state={state} /> : null}

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" block loading={marcando}>
        <Handshake className="size-4" aria-hidden />
        Já trocamos as cartas
      </Button>

      <p className="text-xs text-text-muted">
        Marque só depois de as cartas terem mudado de mão de verdade. Quando os dois marcarem, as
        cópias saem dos seus binders de troca e entram na coleção de quem recebeu.
      </p>
    </form>
  )
}

/**
 * De onde saem as cópias de cada carta, quando há mais de uma resposta.
 *
 * Vive dentro do mesmo formulário do botão de marcar, e não num formulário
 * próprio: a escolha e a marcação viajam juntas, na mesma escrita. Separadas,
 * existiria um instante com a marcação dada e a origem indefinida — e é
 * exatamente nesse instante que o outro poderia marcar e concluir.
 */
function OriginPicker({
  state,
}: {
  state: { status: 'origin'; message: string; cards: OriginQuestion[] }
}) {
  /*
   * A escolha e zerada quando o servidor manda uma pergunta nova. Comparar com o
   * resultado anterior durante a renderizacao e o padrao ja usado na folha de
   * quantidade: num efeito, `setState` dispararia renderizacao em cascata e o
   * lint do React recusa.
   */
  const [chosen, setChosen] = useState<Record<string, Record<string, number>>>({})
  const [last, setLast] = useState(state)
  if (state !== last) {
    setLast(state)
    setChosen({})
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-control border border-warning/30 bg-warning-soft p-3"
    >
      <p className="flex items-start gap-2 text-sm text-text">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        {state.message}
      </p>

      {state.cards.map((card) => {
        const here = chosen[card.variantId] ?? {}
        const escolhidas = Object.values(here).reduce((total, value) => total + value, 0)
        const faltam = card.offered - escolhidas

        return (
          <div key={card.variantId} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CardArt
                src={card.imageUrl}
                alt=""
                fallback={card.cardCode}
                sizes="36px"
                className="w-9 shrink-0 rounded-md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text tabular-nums">
                  {card.cardCode}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {card.cardName} · saem {card.offered}
                </p>
              </div>
            </div>

            <ul className="flex flex-col gap-2">
              {card.locations.map((location) => {
                const value = here[location.storageLocationId] ?? 0

                return (
                  <li key={location.storageLocationId} className="flex flex-col gap-1.5">
                    <span className="flex items-center justify-between gap-2 text-sm text-text">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Package className="size-3.5 shrink-0 text-text-muted" aria-hidden />
                        <span className="truncate">{location.storageName}</span>
                      </span>
                      <span className="shrink-0 text-text-muted tabular-nums">
                        {location.quantity} guardadas
                      </span>
                    </span>

                    <QuantitySelector
                      label={`Tirar ${card.cardCode} de ${location.storageName}`}
                      value={value}
                      max={Math.min(location.quantity, card.offered)}
                      onValueChange={(next) =>
                        setChosen((current) => ({
                          ...current,
                          [card.variantId]: {
                            ...(current[card.variantId] ?? {}),
                            [location.storageLocationId]: next,
                          },
                        }))
                      }
                    />

                    {value > 0 ? (
                      <input
                        type="hidden"
                        name="origem"
                        value={`${card.variantId}:${location.storageLocationId}:${value}`}
                      />
                    ) : null}
                  </li>
                )
              })}
            </ul>

            <p className="text-xs text-text-muted tabular-nums">
              {faltam > 0
                ? `Escolha de onde saem mais ${faltam}.`
                : faltam < 0
                  ? `São ${-faltam} a mais do que estão sendo trocadas.`
                  : 'Pronto: esta carta está resolvida.'}
            </p>
          </div>
        )
      })}
    </div>
  )
}
