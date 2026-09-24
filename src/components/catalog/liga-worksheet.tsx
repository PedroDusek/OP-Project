'use client'

import { useActionState, useMemo, useState } from 'react'
import { recordLigaCardAction } from '@/app/dev/liga/actions'
import { LIGA_CARD_IDLE } from '@/app/dev/liga/state'
import { CardArt } from '@/components/catalog/card-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { cn } from '@/lib/cn'
import type { LigaWorksheet, LigaWorksheetRow } from '@/server/application/catalog'
import { ligaSearchLink } from '@/server/domain/catalog/liga'
import { isDonCode } from '@/server/domain/catalog/don'

/**
 * A planilha de conferência da Liga, uma coleção por vez (decisão 071).
 *
 * Cada linha é uma arte da Bandai com o que a tabela de correspondência pede:
 * código, coleção, número, tipo, e — depois de conferida — o código interno da
 * Liga, o sufixo e o endereço. Ao lado, "Procurar na Liga" abre a busca de onde
 * a pessoa copia o endereço da arte certa.
 *
 * ## O DON!! procura pelo nome
 *
 * A busca vai pelo **código**, que é o que a Liga entende — menos no DON!!, cujo
 * código é nosso (`DON-482237`, do `productId` do TCGplayer) e não existe lá.
 * Procurar por ele não acha nada. Vai pelo nome: `DON!! Card (Red)` acha.
 * Pedido do dono do produto em 23/09, com a tela na mão.
 *
 * O nome vai **inteiro**, sem encurtar. Alguns do TCGplayer são compridos ou
 * trazem `//` (`DON!! Card // Green Compass`, 2 dos 239) e a Liga pode não
 * achá-los — mas encurtar seria adivinhar como ela cadastrou, que é
 * exatamente o que a decisão 071 tirou do sistema e pôs nas mãos de quem abre
 * o site. Quem procurar ajusta o termo na busca da própria Liga.
 *
 * ## Os três grupos
 *
 * - **Paralelas** — o que precisa de conferência: nenhuma vai direto sem ela.
 * - **Normais** — vão direto sem conferência, por escolha do dono do produto; a
 *   amostra no topo diz, por raridade, se alguma conferida divergiu da regra.
 * - **Outros produtos** — artes com o código da coleção que só saíram em promo,
 *   PRB, starter deck. É onde o link da `OP01-004_p1` errava.
 */

type Grupo = 'paralelas' | 'normais' | 'outros'

export function LigaWorksheetView({ worksheet }: { worksheet: LigaWorksheet }) {
  const [grupo, setGrupo] = useState<Grupo>('paralelas')

  const grupos = useMemo(
    () => ({
      paralelas: worksheet.rows.filter((row) => row.inSet && row.variantType !== 'Normal'),
      normais: worksheet.rows.filter((row) => row.inSet && row.variantType === 'Normal'),
      outros: worksheet.rows.filter((row) => !row.inSet),
    }),
    [worksheet.rows],
  )
  const faltam = (rows: LigaWorksheetRow[]) => rows.filter((row) => row.verified === undefined).length
  const visiveis = grupos[grupo]

  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm text-text-muted">
          Coleção
          <select
            name="set"
            defaultValue={worksheet.setCode}
            className="h-11 rounded-control border border-border bg-surface px-3 text-text"
          >
            {worksheet.sets.map((set) => (
              <option key={set.code} value={set.code}>
                {set.code} — {set.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary">
          Abrir
        </Button>
      </form>

      <NormalSampleTable worksheet={worksheet} />

      <Segmented<Grupo>
        label="Quais artes mostrar"
        value={grupo}
        onValueChange={setGrupo}
        options={[
          { value: 'paralelas', label: `Paralelas · faltam ${faltam(grupos.paralelas)}`, count: grupos.paralelas.length },
          { value: 'normais', label: 'Normais', count: grupos.normais.length },
          { value: 'outros', label: `Outros produtos · faltam ${faltam(grupos.outros)}`, count: grupos.outros.length },
        ]}
      />

      {visiveis.length === 0 ? (
        <EmptyState title="Nenhuma arte neste grupo" />
      ) : (
        <ul className="space-y-3">
          {visiveis.map((row) => (
            <li key={row.sourceId}>
              <LigaCardForm row={row} setCode={worksheet.setCode} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NormalSampleTable({ worksheet }: { worksheet: LigaWorksheet }) {
  if (worksheet.sample.length === 0) return null

  return (
    <Panel className="overflow-x-auto p-4">
      <h2 className="mb-2 text-sm font-semibold text-text">Amostra das normais de {worksheet.setCode}</h2>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Normais conferidas por raridade</caption>
        <thead className="text-xs text-text-subtle">
          <tr>
            <th className="py-1 pr-4 font-normal">Raridade</th>
            <th className="py-1 pr-4 font-normal">Normais</th>
            <th className="py-1 pr-4 font-normal">Conferidas</th>
            <th className="py-1 font-normal">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {worksheet.sample.map((amostra) => (
            <tr key={amostra.rarity} className="border-t border-border">
              <td className="py-1 pr-4 text-text">{amostra.rarity}</td>
              <td className="py-1 pr-4 text-text-muted">{amostra.total}</td>
              <td className="py-1 pr-4 text-text-muted">{amostra.conferidas}</td>
              <td className="py-1">
                {amostra.divergentes.length > 0 ? (
                  <Badge tone="danger">Diverge: {amostra.divergentes.join(', ')}</Badge>
                ) : amostra.conferidas > 0 ? (
                  <Badge tone="success">Sem sufixo, como a regra</Badge>
                ) : (
                  <Badge tone="warning">Falta conferir uma</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

function statusDe(row: LigaWorksheetRow) {
  if (row.verified === undefined) return <Badge tone="warning">Não conferida</Badge>
  if (row.verified === null) return <Badge tone="neutral">Sem página na Liga</Badge>
  return <Badge tone="success">Conferida</Badge>
}

/**
 * O contexto de uma arte numa das revisões — reimpressões (`/dev/liga/revisar`) e
 * repetidas (`/dev/liga/repetidas`): por que ela está ali, o botão que confirma
 * que está certa, e o produto do TCGplayer que dá o preço hoje.
 */
export interface ReviewContext {
  motivo: string
  confirmar: { intencao: 'confirmar-reprint' | 'confirmar-mesma-identidade'; rotulo: string }
  tcgProductId: string | null
}

export function LigaCardForm({
  row,
  setCode,
  review,
}: {
  row: LigaWorksheetRow
  setCode: string
  review?: ReviewContext
}) {
  const [state, action, pending] = useActionState(recordLigaCardAction, LIGA_CARD_IDLE)
  // Controlado: o React limpa o formulario quando a acao termina, inclusive em
  // erro, e o endereco colado sumiria a cada recusa (armadilha 12).
  const [url, setUrl] = useState(row.verified ?? '')
  const numero = /-(\d+)$/.exec(row.cardCode)?.[1] ?? '—'
  /*
   * O DON!! procura pelo **nome**: o codigo dele e nosso e nao existe na Liga,
   * entao procurar por ele nao acha nada. Ver o bloco no topo do arquivo.
   */
  const termoDaBusca = isDonCode(row.cardCode) ? row.cardName : row.cardCode

  return (
    <Panel className="p-3">
      <form action={action} aria-label={`Conferir ${row.sourceId}`} className="flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="arte" value={row.sourceId} />

        <div className="w-20 shrink-0">
          <CardArt src={row.imageUrl} alt={`Arte ${row.sourceId}`} fallback={row.sourceId} sizes="80px" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-semibold text-text">{row.sourceId}</h2>
            <span className="text-sm text-text-muted">{row.cardName}</span>
            {statusDe(row)}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <Campo nome="Coleção" valor={setCode} />
            <Campo nome="Número" valor={numero} />
            <Campo nome="Tipo" valor={[row.variantType, row.rarity].filter(Boolean).join(' · ')} />
            <Campo nome="Impressa em" valor={row.setCodes.join(', ')} />
            <Campo nome="Código na Liga" valor={row.liga?.num ?? '—'} />
            <Campo nome="Edição na Liga" valor={row.liga?.ed ?? '—'} />
            <Campo
              nome="Sufixo"
              valor={row.liga ? (row.liga.suffix === null ? 'outro código' : row.liga.suffix || 'nenhum') : '—'}
              alerta={row.liga?.suffix === null}
            />
            <Campo nome="Link hoje" valor={row.link.exact ? 'direto' : 'busca'} />
          </dl>

          {row.liga?.suffix === null ? (
            <p className="text-xs text-warning">
              O código na Liga não começa por {row.cardCode}. Confira se o endereço é desta arte.
            </p>
          ) : null}
          {row.nota ? <p className="text-xs text-text-subtle">Nota: {row.nota}</p> : null}

          {review ? <p className="text-xs text-warning">{review.motivo}</p> : null}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <a
              href={ligaSearchLink(termoDaBusca)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-ink underline"
            >
              Procurar {termoDaBusca} na Liga
            </a>
            {row.link.exact ? (
              <a href={row.link.href} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline">
                Abrir o link atual
              </a>
            ) : null}
            {review?.tcgProductId ? (
              <a
                href={`https://www.tcgplayer.com/product/${review.tcgProductId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-ink underline"
              >
                Ver o produto que dá o preço hoje (TCGplayer)
              </a>
            ) : null}
          </div>

          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Endereço da carta na Liga
            <input
              name="url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.ligaonepiece.com.br/?view=cards/card&…"
              className={cn(
                'h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-text',
                state.status === 'error' && 'border-danger',
              )}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" name="intencao" value="gravar" size="sm" loading={pending}>
              Gravar
            </Button>
            <Button type="submit" name="intencao" value="sem-pagina" size="sm" variant="secondary" disabled={pending}>
              Não existe na Liga
            </Button>
            {review ? (
              <Button
                type="submit"
                name="intencao"
                value={review.confirmar.intencao}
                size="sm"
                variant="secondary"
                disabled={pending}
              >
                {review.confirmar.rotulo}
              </Button>
            ) : null}
            {row.verified !== undefined ? (
              <Button type="submit" name="intencao" value="limpar" size="sm" variant="ghost" disabled={pending}>
                Desfazer
              </Button>
            ) : null}
            <p aria-live="polite" className="text-xs">
              {state.status === 'saved' ? (
                <span className="text-success">{state.url ? 'Gravado.' : 'Gravado: sem página na Liga.'}</span>
              ) : state.status === 'confirmed' ? (
                <span className="text-success">Confirmada: a arte sai da revisão.</span>
              ) : state.status === 'cleared' ? (
                <span className="text-success">Desfeito: a arte voltou a não conferida.</span>
              ) : state.status === 'error' ? (
                <span role="alert" className="text-danger">
                  {state.message}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </form>
    </Panel>
  )
}

function Campo({ nome, valor, alerta = false }: { nome: string; valor: string; alerta?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-text-subtle">{nome}</dt>
      <dd className={cn('break-all text-text', alerta && 'text-warning')}>{valor}</dd>
    </div>
  )
}
