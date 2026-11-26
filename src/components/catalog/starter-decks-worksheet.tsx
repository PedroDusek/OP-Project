'use client'

import { useActionState, useMemo, useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { recordStarterDeckAction } from '@/app/dev/starter/actions'
import { STARTER_DECK_IDLE } from '@/app/dev/starter/state'
import { CardArt } from '@/components/catalog/card-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QuantitySelector } from '@/components/ui/quantity-selector'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { parseStarterDeckPaste } from '@/server/domain/catalog/starter-deck-paste'
import { cn } from '@/lib/cn'
import {
  MAX_COPIES_PER_CARD,
  STARTER_DECK_CARDS,
} from '@/server/domain/catalog/starter-decks'
import type { StarterDeckRow, StarterDecksWorksheet } from '@/server/application/catalog'

/**
 * Quantas cópias de cada carta vêm em cada starter deck (decisão 116).
 *
 * O catálogo sabe **quais** cartas saem em cada ST; nenhuma fonte legível diz
 * **quantas de cada** — a Bandai publica o tamanho e as raridades e avisa que
 * "multiples of one card may appear", sem nunca dizer qual repete. Então quem
 * diz é gente, um deck por vez.
 *
 * ## A soma travada é a feature
 *
 * O botão de gravar só acende quando as cópias somam **exatamente 50**. Não é
 * zelo: esta tabela vai alimentar o "Adicionar ST", que escreve na coleção das
 * pessoas. Um deck que soma 48 descreve um produto que não existe, e aqui é o
 * único lugar onde esse erro ainda é barato de achar.
 *
 * ## Um deck por vez
 *
 * São 36, com 13 a 16 cartas cada. Mostrar todos de uma vez daria uma página de
 * quinhentos campos onde a conta de um deck se perde — e a conta é o assunto.
 *
 * ## O líder não aparece para conferir
 *
 * Ele é uma cópia de cada líder impresso no set: 1 nos decks normais e **3** no
 * ST-10 e no ST-13, que é o que a caixa traz. Mostrá-lo com um campo pediria um
 * número que o catálogo já sabe.
 */

type Grupo = 'faltam' | 'todos'

export function StarterDecksWorksheetView({ worksheet }: { worksheet: StarterDecksWorksheet }) {
  const [grupo, setGrupo] = useState<Grupo>('faltam')
  const [aberto, setAberto] = useState<string | null>(null)

  const listados = useMemo(
    () => worksheet.decks.filter((deck) => (grupo === 'faltam' ? !deck.conferido : true)),
    [worksheet.decks, grupo],
  )

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Recorte dos decks"
        value={grupo}
        onValueChange={(valor) => {
          setGrupo(valor)
          setAberto(null)
        }}
        options={[
          { value: 'faltam', label: 'Faltam', count: worksheet.faltam },
          { value: 'todos', label: 'Todos', count: worksheet.total },
        ]}
      />

      {listados.length === 0 ? (
        <EmptyState
          title="Nada neste recorte"
          description={
            worksheet.faltam === 0
              ? 'Os 36 decks estão conferidos.'
              : 'Nenhum deck aqui. Veja a aba "Todos".'
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {listados.map((deck) => (
            <li key={deck.code}>
              <LinhaDoDeck
                deck={deck}
                aberto={aberto === deck.code}
                onToggle={() => setAberto(aberto === deck.code ? null : deck.code)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LinhaDoDeck({
  deck,
  aberto,
  onToggle,
}: {
  deck: StarterDeckRow
  aberto: boolean
  onToggle: () => void
}) {
  return (
    <Panel className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-muted"
      >
        <CardArt
          src={deck.leaders[0]?.imageUrl ?? null}
          alt=""
          fallback={deck.displayCode}
          sizes="44px"
          className="w-11 shrink-0 rounded-md"
        />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-text">{deck.displayName}</span>
          <span className="text-xs text-text-muted tabular-nums">
            {deck.displayCode} · {deck.cards.length} cartas
            {deck.leaders.length > 1 ? ` · ${deck.leaders.length} líderes` : ''}
          </span>
        </span>

        {deck.conferido ? (
          <span className="flex shrink-0 items-center gap-1 text-xs text-success">
            <CircleCheck className="size-3.5" aria-hidden />
            Conferido
          </span>
        ) : (
          <Badge tone="neutral">{rotuloDoQueFalta(deck.faltam)}</Badge>
        )}
      </button>

      {aberto ? <FormularioDoDeck deck={deck} /> : null}
    </Panel>
  )
}

/** "faltam 50", "faltam 2", "passou 3". O zero não chega aqui: vira "Conferido". */
function rotuloDoQueFalta(faltam: number): string {
  if (faltam < 0) return `passou ${-faltam}`
  return faltam === 1 ? 'falta 1' : `faltam ${faltam}`
}

/**
 * O que o colar encontrou, para a pessoa olhar antes de gravar.
 *
 * Preencher em silêncio seria o pior dos dois mundos: os campos mudam sob o
 * dedo e ninguém fica sabendo do que ficou de fora.
 */
interface RelatoDoColar {
  preenchidas: number
  /** Citadas na lista e que não são deste deck. Erro de código, ou deck errado. */
  forasteiras: string[]
  /**
   * Líderes citados.
   *
   * Separados das forasteiras porque **não são erro**: toda lista traz a linha
   * do líder, e chamá-la de "não é deste deck" ensinaria a ignorar o aviso que
   * importa.
   */
  lideres: string[]
  /** Do deck, e que a lista não citou. */
  ausentes: string[]
  /** Linha com código e sem número utilizável. */
  semNumero: string[]
  repetidos: string[]
}

function FormularioDoDeck({ deck }: { deck: StarterDeckRow }) {
  const [estado, enviar, enviando] = useActionState(recordStarterDeckAction, STARTER_DECK_IDLE)

  /*
   * O rascunho e local: cada toque no `+` nao vai ao servidor. A pessoa monta
   * o deck inteiro e grava uma vez, que e a mesma escolha do painel de filtros.
   */
  const [copias, setCopias] = useState<Record<string, number>>(() =>
    Object.fromEntries(deck.cards.map((carta) => [carta.cardCode, carta.copias])),
  )

  const [texto, setTexto] = useState('')
  const [relato, setRelato] = useState<RelatoDoColar | null>(null)

  const total = Object.values(copias).reduce((soma, valor) => soma + valor, 0)
  const faltam = STARTER_DECK_CARDS - total
  const fecha = faltam === 0

  /**
   * Preenche os campos a partir do texto colado.
   *
   * **Só preenche o que é deste deck.** Uma lista do ST-03 colada no ST-02 não
   * escreve nada e é relatada inteira como forasteira — sem isto, colar no
   * deck errado deixaria os dois errados e nenhum aviso.
   *
   * O que o deck tem e a lista não citou **zera**, em vez de ficar com o valor
   * anterior: a lista colada é a resposta inteira, e um resto do rascunho
   * anterior somaria 50 com uma carta que ninguém conferiu.
   */
  const preencher = () => {
    const lido = parseStarterDeckPaste(texto)
    const doDeck = new Set(deck.cards.map((carta) => carta.cardCode))
    const doLider = new Set(deck.leaders.map((carta) => carta.cardCode))

    const proximas: Record<string, number> = Object.fromEntries(
      deck.cards.map((carta) => [carta.cardCode, 0]),
    )
    const forasteiras: string[] = []
    const lideres: string[] = []

    for (const linha of lido.cartas) {
      if (doDeck.has(linha.carta)) proximas[linha.carta] = linha.copias
      else if (doLider.has(linha.carta)) lideres.push(linha.carta)
      else forasteiras.push(linha.carta)
    }

    setCopias(proximas)
    setRelato({
      preenchidas: lido.cartas.length - forasteiras.length - lideres.length,
      forasteiras,
      lideres,
      ausentes: deck.cards
        .map((carta) => carta.cardCode)
        .filter((codigo) => proximas[codigo] === 0),
      semNumero: lido.semNumero,
      repetidos: lido.repetidos,
    })
  }

  return (
    <form action={enviar} className="flex flex-col gap-3 border-t border-line p-3">
      <input type="hidden" name="deck" value={deck.code} />

      {/*
        Colar, porque digitar 16 números 36 vezes é onde o erro mora.

        A lista vem de onde a pessoa conseguir — nenhuma fonte legível publica
        isto, e a única que tem bloqueia leitura automatizada. O que a tela faz
        é mover o trabalho de digitar para olhar; os números continuam sendo
        afirmação de gente, e nada é gravado sem o clique.
      */}
      <details className="rounded-control bg-surface-muted p-3">
        <summary className="cursor-pointer text-sm font-semibold text-text">
          Colar uma lista
        </summary>

        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs text-text-muted" htmlFor={`colar-${deck.code}`}>
            Cole o texto como vier: tabela, <code>4x</code>, markdown. A tela lê o código
            e o número de cada linha.
          </label>
          <textarea
            id={`colar-${deck.code}`}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            rows={5}
            className="w-full rounded-control border border-line bg-surface p-2 font-mono text-xs text-text"
            placeholder={`${deck.displayCode}-002\tNome\tPersonagem\tComum (C)\t4x`}
          />
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={preencher}>
              Preencher os campos
            </Button>
          </div>

          {relato ? <RelatoDoColarView relato={relato} /> : null}
        </div>
      </details>

      {/*
        Os lideres primeiro, sem campo: eles sao uma copia de cada, sempre. O
        ST-10 e o ST13 tem tres, e e isso que a caixa traz.
      */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span className="font-semibold text-text">
          {deck.leaders.length === 1 ? 'Líder' : `Líderes (${deck.leaders.length})`}
        </span>
        {deck.leaders.map((lider) => (
          <Badge key={lider.cardCode} tone="neutral">
            {lider.cardCode} ×1
          </Badge>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {deck.cards.map((carta) => (
          <li key={carta.cardCode} className="flex items-center gap-3">
            <CardArt
              src={carta.imageUrl}
              alt=""
              fallback={carta.cardCode}
              sizes="40px"
              className="w-10 shrink-0 rounded-md"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text tabular-nums">{carta.cardCode}</p>
              <p className="truncate text-xs text-text-muted">
                {carta.cardName}
                {carta.rarity ? ` · ${carta.rarity}` : ''}
              </p>
            </div>

            <input type="hidden" name={`copias:${carta.cardCode}`} value={copias[carta.cardCode] ?? 0} />
            <QuantitySelector
              label={`Cópias de ${carta.cardCode}`}
              value={copias[carta.cardCode] ?? 0}
              onValueChange={(valor) =>
                setCopias((atual) => ({ ...atual, [carta.cardCode]: valor }))
              }
              min={0}
              max={MAX_COPIES_PER_CARD}
              size="md"
              className="shrink-0"
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p
          className={cn(
            'text-sm font-semibold tabular-nums',
            fecha ? 'text-success' : 'text-text-muted',
          )}
          // O contador muda sob o dedo: quem usa leitor de tela precisa ouvir.
          aria-live="polite"
        >
          {total} de {STARTER_DECK_CARDS}
          {fecha ? ' — fecha' : ` · ${rotuloDoQueFalta(faltam)}`}
        </p>

        <Button type="submit" disabled={!fecha || enviando}>
          {enviando ? 'Gravando...' : 'Gravar'}
        </Button>
      </div>

      {estado.status === 'error' ? (
        <p className="text-sm text-danger">{estado.message}</p>
      ) : null}
      {estado.status === 'saved' ? (
        <p className="text-sm text-success">
          {estado.deck} gravado com {estado.total} cartas.
        </p>
      ) : null}
    </form>
  )
}

/**
 * O relato do colar.
 *
 * Em laranja, e não em vermelho: nada quebrou — são coisas para olhar antes de
 * gravar. O vermelho aqui ensinaria a ignorar o vermelho de verdade.
 */
function RelatoDoColarView({ relato }: { relato: RelatoDoColar }) {
  const avisos: string[] = []

  if (relato.forasteiras.length > 0) {
    avisos.push(`não são deste deck: ${relato.forasteiras.join(", ")}`)
  }
  if (relato.ausentes.length > 0) {
    avisos.push(`a lista não citou: ${relato.ausentes.join(", ")}`)
  }
  if (relato.repetidos.length > 0) {
    avisos.push(`citadas duas vezes, valeu a última: ${relato.repetidos.join(", ")}`)
  }
  for (const linha of relato.semNumero.slice(0, 3)) {
    avisos.push(`sem número utilizável: "${linha}"`)
  }

  return (
    <div className="flex flex-col gap-1 text-xs" aria-live="polite">
      <p className="text-text-muted tabular-nums">
        {relato.preenchidas === 1
          ? '1 carta preenchida.'
          : `${relato.preenchidas} cartas preenchidas.`}
        {/* O líder vem em toda lista e não é erro: é uma cópia de cada, sempre. */}
        {relato.lideres.length > 0 ? ' O líder foi ignorado: é sempre uma cópia.' : ''}
      </p>
      {avisos.map((aviso) => (
        <p key={aviso} className="text-warning">
          {aviso}
        </p>
      ))}
    </div>
  )
}
