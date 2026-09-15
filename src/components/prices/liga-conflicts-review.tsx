'use client'

import { useActionState, useMemo, useState } from 'react'
import { recordConflictAnswerAction } from '@/app/dev/liga/conflitos/actions'
import { CONFLICT_ANSWER_IDLE, NENHUM_PRODUTO } from '@/app/dev/liga/conflitos/state'
import { CardArt } from '@/components/catalog/card-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { cn } from '@/lib/cn'
import type { LigaConflict, LigaConflictProduct } from '@/server/application/prices/liga-conflicts'
import { sourceImageUrl } from '@/server/domain/prices/source-image'
import { tcgplayerProductUrl } from '@/server/domain/prices/tcgplayer-link'

/**
 * A revisão dos vínculos que discordam da Liga (decisão 074).
 *
 * Cada caso mostra os dois lados — a página da Liga e o produto do TCGplayer
 * vinculado hoje — e os produtos da carta para escolher o certo. A arte da Bandai
 * fica ao lado, porque é ela que decide quem erra.
 *
 * Nada muda sozinho: a escolha vai para o arquivo de vínculos manuais, e a
 * importação de preço a aplica. Se quem erra é a Liga, o caminho é corrigir a
 * página em `/dev/liga` — e o vínculo atual pode ser mantido aqui, escolhendo-o.
 */

type Filtro = 'faltam' | 'todas'

const usd = (valor: number | null) =>
  valor === null ? 'sem preço' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(valor)

export function LigaConflictsReview({
  conflitos,
  respostas,
}: {
  conflitos: readonly LigaConflict[]
  respostas: Readonly<Record<string, string | null>>
}) {
  const [filtro, setFiltro] = useState<Filtro>('faltam')
  const faltam = useMemo(() => conflitos.filter((c) => !(c.sourceId in respostas)), [conflitos, respostas])
  const visiveis = filtro === 'faltam' ? faltam : conflitos

  return (
    <div className="space-y-4">
      <Segmented<Filtro>
        label="Quais conflitos mostrar"
        value={filtro}
        onValueChange={setFiltro}
        options={[
          { value: 'faltam', label: 'Faltam', count: faltam.length },
          { value: 'todas', label: 'Todos', count: conflitos.length },
        ]}
      />
      {visiveis.length === 0 ? (
        <EmptyState title="Nenhum conflito falta" description="Todos têm resposta no arquivo manual." />
      ) : (
        <ul className="space-y-4">
          {visiveis.map((conflito) => (
            <li key={conflito.sourceId}>
              <ConflictForm conflito={conflito} resposta={respostas[conflito.sourceId]} respondida={conflito.sourceId in respostas} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ConflictForm({
  conflito,
  resposta,
  respondida,
}: {
  conflito: LigaConflict
  resposta: string | null | undefined
  respondida: boolean
}) {
  const [state, action, pending] = useActionState(recordConflictAnswerAction, CONFLICT_ANSWER_IDLE)
  const [escolha, setEscolha] = useState<string>(
    respondida ? (resposta ?? NENHUM_PRODUTO) : '',
  )
  const colecao = conflito.cardCode.split('-')[0]

  return (
    <Panel className="p-4">
      <form action={action} aria-label={`Conflito ${conflito.sourceId}`} className="space-y-3">
        <input type="hidden" name="arte" value={conflito.sourceId} />

        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold text-text">{conflito.sourceId}</h2>
          <span className="text-sm text-text-muted">{conflito.cardName}</span>
          <span className="text-xs text-text-subtle">
            {[conflito.rarity, conflito.sets.join(', ')].filter(Boolean).join(' · ')}
          </span>
          {respondida ? <Badge tone="success">Respondido</Badge> : null}
        </header>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="w-28 shrink-0">
            <CardArt src={conflito.imageUrl} alt={`Arte ${conflito.sourceId}`} fallback={conflito.sourceId} sizes="112px" />
          </div>

          <dl className="grid flex-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-text-subtle">A Liga diz</dt>
              <dd className="font-semibold text-text">{conflito.liga.tratamento}</dd>
              <dd className="text-xs text-text-muted">
                <a href={conflito.liga.url} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline">
                  {conflito.liga.nome}
                </a>{' '}
                · {conflito.liga.ed}
              </dd>
              <dd className="text-xs">
                <a href={`/dev/liga?set=${colecao}`} className="text-accent-ink underline">
                  Corrigir a página na Liga
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-subtle">O vínculo de hoje</dt>
              <dd className="font-semibold text-danger">{conflito.vinculado.label || 'sem tratamento'}</dd>
              <dd className="text-xs text-text-muted">
                <a
                  href={tcgplayerProductUrl(conflito.vinculado.productId) ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-ink underline"
                >
                  produto {conflito.vinculado.productId}
                </a>{' '}
                · {conflito.vinculado.groupCode} · {usd(conflito.vinculado.value)}
              </dd>
            </div>
          </dl>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs text-text-subtle">Qual produto do TCGplayer é esta arte?</legend>
          <div className="flex flex-wrap gap-2">
            {conflito.produtos.map((produto) => (
              <Opcao
                key={produto.productId}
                produto={produto}
                atual={produto.productId === conflito.vinculado.productId}
                checked={escolha === produto.productId}
                onSelect={setEscolha}
              />
            ))}
            <label
              className={cn(
                'flex w-28 cursor-pointer items-center justify-center rounded-control border p-2 text-center text-xs',
                escolha === NENHUM_PRODUTO ? 'border-accent bg-accent-soft' : 'border-border',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
              )}
            >
              <input
                type="radio"
                name="produto"
                value={NENHUM_PRODUTO}
                checked={escolha === NENHUM_PRODUTO}
                onChange={() => setEscolha(NENHUM_PRODUTO)}
                className="sr-only"
              />
              Nenhum destes (fica sem preço)
            </label>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" loading={pending} disabled={escolha === ''}>
            Gravar no arquivo manual
          </Button>
          <p aria-live="polite" className="text-sm">
            {state.status === 'saved' ? (
              <span className="text-success">Gravado. A próxima importação de preço aplica.</span>
            ) : state.status === 'error' ? (
              <span role="alert" className="text-danger">
                {state.message}
              </span>
            ) : null}
          </p>
        </div>
      </form>
    </Panel>
  )
}

function Opcao({
  produto,
  atual,
  checked,
  onSelect,
}: {
  produto: LigaConflictProduct
  atual: boolean
  checked: boolean
  onSelect: (productId: string) => void
}) {
  return (
    <label
      className={cn(
        'block w-28 cursor-pointer rounded-control border p-1.5',
        checked ? 'border-accent bg-accent-soft' : 'border-border',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
      )}
    >
      <input
        type="radio"
        name="produto"
        value={produto.productId}
        checked={checked}
        onChange={() => onSelect(produto.productId)}
        className="sr-only"
      />
      {/*
        O CDN do TCGplayer nao esta em `images.remotePatterns`: miniatura em
        `<img>` puro, como na tela de paralelas.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sourceImageUrl(produto.productId, 'thumb')}
        alt=""
        loading="lazy"
        className="aspect-[5/7] w-full rounded-control border border-border object-cover"
      />
      <span className="mt-1 block text-xs text-text">{produto.label || 'sem tratamento'}</span>
      <span className="block text-xs text-text-subtle">
        {produto.groupCode} · {usd(produto.value)}
      </span>
      {atual ? <span className="block text-xs font-medium text-danger">vínculo de hoje</span> : null}
    </label>
  )
}
