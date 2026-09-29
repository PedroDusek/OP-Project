'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, ArrowRightLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Sheet } from '@/components/ui/sheet'
import { Panel } from '@/components/ui/surface'
import { useToast } from '@/components/ui/toast'
import type { TransferLine, TransferTake } from '@/server/application/decks/transfer-deck'
import {
  planarTransferenciaAction,
  transferirDeckAction,
  type PlanState,
} from '@/app/(app)/deck/actions'

/**
 * Transferir as cartas da lista para uma deckbox (decisão 109).
 *
 * ## Duas etapas, e a segunda é uma afirmação
 *
 * Primeiro o ColeXa mostra **o que aconteceria**; só depois a pessoa confirma. A
 * confirmação não é "pode fazer": é **"eu já movi as cartas de verdade"**. Por
 * isso o aviso é o texto mais destacado da tela, e não uma nota de rodapé.
 *
 * Trocar o local de uma carta **apaga de onde ela estava**, e essa informação
 * não existe em nenhum outro lugar — quem confirmar sem ter mexido nas cartas
 * fica sem saber onde elas estão.
 *
 * ## O que a tela pergunta, e por quê
 *
 * A regra 3.3 diz que ninguém decide por quem tem a carta de qual local as
 * cópias saem. Então: onde há **uma** pilha fora de troca, o sistema resolve;
 * onde há mais de uma, **a pessoa escolhe aqui**.
 */

export interface DeckBox {
  id: string
  name: string
}

export function TransferDeckSheet({ deckId, boxes }: { deckId: string; boxes: DeckBox[] }) {
  const [aberto, setAberto] = useState(false)
  const [destino, setDestino] = useState(boxes[0]?.id ?? '')
  const [plano, setPlano] = useState<PlanState>({ status: 'idle' })
  /**
   * A escolha de origem por carta. `DEIXAR` é uma escolha como outra qualquer:
   * "não quero mover esta".
   */
  const [escolhas, setEscolhas] = useState<Record<string, string>>({})
  const [planejando, planejar] = useTransition()
  const [transferindo, transferir] = useTransition()
  const { toast } = useToast()

  const p = plano.status === 'ok' ? plano.plan : null

  const verPlano = () =>
    planejar(async () => {
      const resultado = await planarTransferenciaAction(deckId, destino)
      /*
       * Carta que só existe em local de troca começa em "deixar onde está".
       *
       * É a regra do dono do produto escrita na tela: local de troca **não entra
       * por padrão**. Sem isto, a pessoa ficaria presa — ou tirava a carta do
       * Trade Binder, ou não transferia nada.
       */
      setEscolhas(
        resultado.status === 'ok'
          ? Object.fromEntries(
              resultado.plan.lines
                .filter((linha) => linha.status === 'trade-needed')
                .map((linha) => [linha.cardCode, DEIXAR]),
            )
          : {},
      )
      setPlano(resultado)
    })

  /*
   * As escolhas viram `take`s aqui, e são conferidas de novo no servidor: a tela
   * é conveniência, e um envio à mão poderia pedir cópias que não existem.
   */
  const takes: TransferTake[] = p
    ? p.lines.flatMap((linha) => {
        if (linha.status === 'auto') return linha.take
        const escolhida = escolhas[linha.cardCode]
        if (!escolhida || escolhida === DEIXAR) return []
        const opcao = linha.options.find((o) => chaveDa(o) === escolhida)
        if (!opcao) return []
        return [
          {
            variantId: opcao.variantId,
            locationId: opcao.locationId,
            copies: Math.min(linha.needed, opcao.available),
          },
        ]
      })
    : []

  const pendentes = p
    ? p.lines.filter((l) => (l.status === 'ambiguous' || l.status === 'trade-needed') && !escolhas[l.cardCode])
    : []

  const totalCopias = takes.reduce((soma, take) => soma + take.copies, 0)
  /* Cartas que não vão: as que a pessoa não tem, e as que ela deixou de fora. */
  const foraDaTransferencia = p
    ? p.lines.filter(
        (l) =>
          l.status === 'missing' ||
          ((l.status === 'ambiguous' || l.status === 'trade-needed') &&
            escolhas[l.cardCode] === DEIXAR),
      ).length
    : 0

  const confirmar = () =>
    transferir(async () => {
      const resultado = await transferirDeckAction({ deckId, destinationId: destino, takes })
      if (resultado.status === 'error') {
        toast({ title: 'Não deu para transferir', description: resultado.message, tone: 'error' })
        return
      }
      if (resultado.status === 'ok') {
        toast({ title: 'Transferido', description: resultado.message, tone: 'success' })
        setAberto(false)
        setPlano({ status: 'idle' })
      }
    })

  if (boxes.length === 0) {
    return (
      <Panel className="p-4">
        <p className="text-sm text-text-muted">
          Para transferir esta lista, crie antes um local do tipo <strong>Deck</strong> em Binders.
        </p>
      </Panel>
    )
  }

  return (
    <>
      <Button variant="secondary" block onClick={() => setAberto(true)}>
        <ArrowRightLeft className="size-4" aria-hidden />
        Transferir para uma deckbox
      </Button>

      <Sheet
        open={aberto}
        onOpenChange={setAberto}
        title="Transferir para uma deckbox"
        description="O ColeXa passa a registrar estas cartas na deckbox escolhida."
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Deckbox de destino"
            value={destino}
            onValueChange={(valor) => {
              setDestino(valor)
              // O plano é sobre um destino: trocar de caixa invalida o que está
              // na tela, e mostrar o antigo seria mentir sobre o que vai sair.
              setPlano({ status: 'idle' })
            }}
            options={boxes.map((box) => ({ value: box.id, label: box.name }))}
          />

          {!p ? (
            <Button block loading={planejando} onClick={verPlano} disabled={!destino}>
              Ver o que vai acontecer
            </Button>
          ) : null}

          {plano.status === 'error' ? (
            <p role="alert" className="text-sm text-danger">
              {plano.message}
            </p>
          ) : null}

          {p ? (
            <>
              <ul className="flex flex-col gap-2">
                {p.lines.map((linha) => (
                  <li key={linha.cardCode}>
                    <LinhaDoPlano
                      linha={linha}
                      escolhida={escolhas[linha.cardCode]}
                      onEscolher={(chave) =>
                        setEscolhas((atual) => ({ ...atual, [linha.cardCode]: chave }))
                      }
                    />
                  </li>
                ))}
              </ul>

              {/*
                O aviso pedido pelo dono do produto, e o texto mais importante
                desta tela: confirmar é afirmar que as cartas já foram movidas.
              */}
              <Panel className="flex items-start gap-3 border-warning/40 p-4">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-text">
                    Só confirme depois de ter movido as cartas de verdade
                  </p>
                  <p className="text-sm text-text-muted">
                    Ao confirmar, o ColeXa passa a dizer que estas cartas estão na deckbox — e
                    <strong> apaga de onde elas estavam</strong>. Não há como recuperar os locais
                    antigos depois.
                  </p>
                </div>
              </Panel>

              {pendentes.length > 0 ? (
                <p className="text-sm text-text-muted">
                  Escolha de onde sairão as cópias de {pendentes.length}{' '}
                  {pendentes.length === 1 ? 'carta' : 'cartas'} antes de confirmar — ou marque
                  para deixá-las onde estão.
                </p>
              ) : (
                /*
                 * O resumo do que vai acontecer, em uma linha. A ação não tem
                 * volta: a pessoa precisa saber quantas cópias saem do lugar e
                 * quantas cartas ficam de fora **antes** de afirmar que já
                 * moveu tudo.
                 */
                <p className="text-sm text-text-muted tabular-nums">
                  {totalCopias} {totalCopias === 1 ? 'cópia vai' : 'cópias vão'} para a deckbox.
                  {foraDaTransferencia > 0
                    ? ` ${foraDaTransferencia} ${foraDaTransferencia === 1 ? 'carta fica' : 'cartas ficam'} de fora.`
                    : ''}
                </p>
              )}

              <Button
                block
                size="lg"
                variant="danger"
                loading={transferindo}
                disabled={takes.length === 0 || pendentes.length > 0}
                onClick={confirmar}
              >
                Já movi as cartas — confirmar
              </Button>
            </>
          ) : null}
        </div>
      </Sheet>
    </>
  )
}

/** Uma pilha é identificada pela arte **e** pelo local: as duas escolhas juntas. */
const chaveDa = (o: { variantId: string; locationId: string }) => `${o.variantId}:${o.locationId}`

/**
 * "Não quero mover esta carta agora."
 *
 * Existe porque sem ela a pessoa ficava presa: uma carta com duas pilhas
 * possíveis travava a transferência inteira até alguém escolher, e no caso das
 * que só existem em local de troca a única saída seria tirá-las do Trade Binder.
 * Deixar de fora precisa ser uma escolha possível, e não a ausência de uma.
 */
const DEIXAR = 'deixar'

function LinhaDoPlano({
  linha,
  escolhida,
  onEscolher,
}: {
  linha: TransferLine
  escolhida: string | undefined
  onEscolher: (chave: string) => void
}) {
  return (
    <Panel className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-text tabular-nums">
          {linha.cardCode} <span className="font-normal text-text-muted">{linha.cardName}</span>
        </span>
        <Marca linha={linha} />
      </div>

      {linha.status === 'auto' && linha.takeOtherArt ? (
        <p className="text-xs text-warning">
          As cópias que vão para a caixa são de <strong>outra arte</strong> da mesma carta.
        </p>
      ) : null}

      {linha.status === 'ambiguous' || linha.status === 'trade-needed' ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs text-text-muted">
            {linha.status === 'trade-needed'
              ? 'Só há cópias em local de troca. Escolher tira a carta do seu Trade Binder.'
              : 'De onde sair as cópias?'}
          </legend>
          {linha.options.map((opcao) => {
            const chave = chaveDa(opcao)
            return (
              <label key={chave} className="flex items-center gap-2 text-sm text-text">
                <input
                  type="radio"
                  name={`origem-${linha.cardCode}`}
                  checked={escolhida === chave}
                  onChange={() => onEscolher(chave)}
                  className="size-4"
                />
                <span className="truncate">
                  {opcao.locationName}
                  <span className="text-text-muted tabular-nums"> · {opcao.available}</span>
                  {opcao.otherArt ? <span className="text-warning"> · outra arte</span> : null}
                  {opcao.trade ? <span className="text-warning"> · troca</span> : null}
                </span>
              </label>
            )
          })}

          {/* Deixar de fora é uma escolha, e não a ausência de uma. */}
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input
              type="radio"
              name={`origem-${linha.cardCode}`}
              checked={escolhida === DEIXAR}
              onChange={() => onEscolher(DEIXAR)}
              className="size-4"
            />
            Deixar esta carta onde está
          </label>
        </fieldset>
      ) : null}
    </Panel>
  )
}

function Marca({ linha }: { linha: TransferLine }) {
  if (linha.status === 'done') return <Badge tone="success">Já está lá</Badge>
  if (linha.status === 'missing') return <Badge tone="neutral">Você não tem</Badge>
  if (linha.status === 'trade-needed') return <Badge tone="warning">Em troca</Badge>
  if (linha.status === 'ambiguous') return <Badge tone="warning">Escolha</Badge>
  return <Badge tone="accent">{linha.needed}</Badge>
}
