'use client'

import { useActionState, useMemo, useState } from 'react'
import { recordCardMappingAction } from '@/app/dev/paralelas/actions'
import { ART_FIELD_PREFIX, MAPPING_IDLE, NO_PRODUCT } from '@/app/dev/paralelas/state'
import { CardArt } from '@/components/catalog/card-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { cn } from '@/lib/cn'
import type { ParallelCandidate } from '@/server/domain/prices/parallel-candidates'
import { sourceImageUrl } from '@/server/domain/prices/source-image'

/**
 * O pareamento das paralelas que só o olho resolve (decisão 068).
 *
 * Uma carta por painel. Cada arte nossa é uma linha, com a arte da Bandai à
 * esquerda e os produtos da fonte à direita — miniatura, tratamento e preço —,
 * mais "não tem na fonte" e "deixar para depois".
 *
 * ## Por que as miniaturas se repetem em cada linha
 *
 * O julgamento é visual: "esta arte é aquela imagem". Com os produtos uma vez só,
 * no topo, a pessoa escolheria por um rótulo numa lista e voltaria os olhos para
 * cima a cada linha. Repetidas, a escolha é clicar na imagem igual. O navegador
 * busca cada miniatura uma vez só.
 *
 * ## Um produto, uma arte
 *
 * O produto que outra linha da mesma carta já escolheu fica desabilitado. Não é a
 * barreira — o caso de uso confere, e o arquivo recusa produto repetido —, é o
 * que evita a pessoa descobrir o conflito só ao gravar.
 *
 * ## A miniatura da fonte é `<img>` puro
 *
 * O CDN do TCGplayer não está em `images.remotePatterns`, e colocá-lo lá só para
 * uma tela de desenvolvimento abriria o otimizador de produção a um host novo. A
 * arte da Bandai continua passando por `CardArt` (armadilha 18).
 */

type Filtro = 'faltam' | 'todas'

export interface ParallelMapperProps {
  cartas: readonly ParallelCandidate[]
  /** As respostas já gravadas no arquivo manual, por `source_id`. */
  answers: Readonly<Record<string, string | null>>
}

function respondida(carta: ParallelCandidate, answers: ParallelMapperProps['answers']): boolean {
  return carta.ours.every((art) => art.sourceId in answers)
}

export function ParallelMapper({ cartas, answers }: ParallelMapperProps) {
  const [filtro, setFiltro] = useState<Filtro>('faltam')

  const faltam = useMemo(() => cartas.filter((c) => !respondida(c, answers)), [cartas, answers])
  const visiveis = filtro === 'faltam' ? faltam : cartas

  return (
    <div className="space-y-4">
      <Segmented<Filtro>
        label="Quais cartas mostrar"
        value={filtro}
        onValueChange={setFiltro}
        options={[
          { value: 'faltam', label: 'Faltam', count: faltam.length },
          { value: 'todas', label: 'Todas', count: cartas.length },
        ]}
      />

      {visiveis.length === 0 ? (
        <EmptyState
          title="Nenhuma carta falta"
          description="Todas as artes do levantamento têm resposta no arquivo manual."
        />
      ) : (
        <ul className="space-y-4">
          {visiveis.map((carta) => (
            <li key={carta.cardCode}>
              <CardMappingForm carta={carta} answers={answers} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A escolha de uma linha: um produto, `NO_PRODUCT`, ou vazio para "depois". */
type Escolha = string

function escolhaInicial(
  carta: ParallelCandidate,
  answers: ParallelMapperProps['answers'],
): Record<string, Escolha> {
  const produtos = new Set(carta.theirs.map((art) => art.productId))
  return Object.fromEntries(
    carta.ours.map((art) => {
      if (!(art.sourceId in answers)) return [art.sourceId, '']
      const produto = answers[art.sourceId]
      if (produto === null) return [art.sourceId, NO_PRODUCT]
      // Resposta editada à mão para um produto fora do levantamento: a tela não
      // tem como mostrá-la, e fingir que ela é uma das opções gravaria outra coisa.
      return [art.sourceId, produtos.has(produto) ? produto : '']
    }),
  )
}

export function CardMappingForm({
  carta,
  answers,
}: {
  carta: ParallelCandidate
  answers: ParallelMapperProps['answers']
}) {
  const [state, action, pending] = useActionState(recordCardMappingAction, MAPPING_IDLE)
  const [escolhas, setEscolhas] = useState(() => escolhaInicial(carta, answers))

  const escolhidas = Object.values(escolhas).filter((valor) => valor !== '')
  const gravada = respondida(carta, answers)

  return (
    <Panel className="p-4">
      <form action={action} aria-label={`Mapear ${carta.cardCode}`}>
        <input type="hidden" name="carta" value={carta.cardCode} />

        <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold text-text">{carta.cardCode}</h2>
          <span className="text-sm text-text-muted">{carta.cardName}</span>
          {carta.setCode ? <span className="text-xs text-text-subtle">{carta.setCode}</span> : null}
          {gravada ? <Badge tone="success">Respondida</Badge> : null}
        </header>

        <div className="divide-y divide-border">
          {carta.ours.map((art) => {
            const minha = escolhas[art.sourceId] ?? ''
            const tomados = new Set(
              Object.entries(escolhas)
                .filter(([id, valor]) => id !== art.sourceId && valor !== '' && valor !== NO_PRODUCT)
                .map(([, valor]) => valor),
            )
            const escolher = (valor: Escolha) => setEscolhas((atual) => ({ ...atual, [art.sourceId]: valor }))
            const nome = `${ART_FIELD_PREFIX}${art.sourceId}`

            return (
              <fieldset key={art.sourceId} className="flex flex-col gap-3 py-3 sm:flex-row">
                <legend className="sr-only">
                  Qual produto é a arte {art.sourceId}
                </legend>

                <div className="w-24 shrink-0">
                  <CardArt src={art.imageUrl} alt={`Arte ${art.sourceId}`} fallback={art.sourceId} sizes="96px" />
                  <p className="mt-1 text-xs text-text">{art.sourceId}</p>
                  {art.rarity ? <p className="text-xs text-text-subtle">{art.rarity}</p> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {carta.theirs.map((produto) => (
                    <Opcao
                      key={produto.productId}
                      name={nome}
                      value={produto.productId}
                      checked={minha === produto.productId}
                      disabled={tomados.has(produto.productId)}
                      onSelect={escolher}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sourceImageUrl(produto.productId, 'thumb')}
                        alt=""
                        loading="lazy"
                        className="aspect-[5/7] w-full rounded-control border border-border object-cover"
                      />
                      <span className="mt-1 block text-xs text-text">{produto.label}</span>
                      <span className="block text-xs text-text-subtle">
                        {produto.value === null ? 'sem preço' : formatUsd(produto.value)}
                      </span>
                    </Opcao>
                  ))}

                  <Opcao name={nome} value={NO_PRODUCT} checked={minha === NO_PRODUCT} onSelect={escolher}>
                    <span className="block text-xs text-text">Não tem na fonte</span>
                  </Opcao>
                  <Opcao name={nome} value="" checked={minha === ''} onSelect={escolher}>
                    <span className="block text-xs text-text-muted">Deixar para depois</span>
                  </Opcao>
                </div>
              </fieldset>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" loading={pending} disabled={escolhidas.length === 0}>
            Gravar {escolhidas.length === 1 ? '1 resposta' : `${escolhidas.length} respostas`}
          </Button>
          <p aria-live="polite" className="text-sm">
            {state.status === 'saved' ? (
              <span className="text-success">
                Gravado no arquivo manual: {state.recorded}{' '}
                {state.recorded === 1 ? 'resposta' : 'respostas'}.
              </span>
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
  name,
  value,
  checked,
  disabled = false,
  onSelect,
  children,
}: {
  name: string
  value: string
  checked: boolean
  disabled?: boolean
  onSelect: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label
      className={cn(
        'block w-24 cursor-pointer rounded-control border p-1.5',
        // O radio fica escondido; o foco do teclado aparece na opcao inteira.
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
        checked ? 'border-accent bg-accent-soft' : 'border-border',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      {children}
    </label>
  )
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}
