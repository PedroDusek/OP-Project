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
import {
  candidateAnswered,
  type CandidateOurArt,
  type CandidateReason,
  type CandidateSourceArt,
  type ParallelCandidate,
} from '@/server/domain/prices/parallel-candidates'
import { sourceImageUrl } from '@/server/domain/prices/source-image'
import { tcgplayerProductUrl } from '@/server/domain/prices/tcgplayer-link'

/**
 * O pareamento das artes que só o olho resolve (decisões 068 e 077).
 *
 * Uma carta por painel. Cada arte nossa é uma linha, com a arte da Bandai à
 * esquerda e **todos** os produtos da carta à direita — miniatura, tratamento,
 * grupo, preço e link do TCGplayer —, mais "não tem na fonte" e "deixar para
 * depois".
 *
 * ## O que a linha diz
 *
 * Por que a arte está aqui, o vínculo de hoje, a página da Liga com o tratamento
 * lido dela, e o produto que a Liga aponta. Nos produtos, a marca de quem os
 * segura hoje: escolher o produto de outra arte tira dela, e a pessoa precisa ver
 * isso antes de gravar.
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

const TODOS_OS_SETS = 'todos'

type Manual = Readonly<Record<string, { produto: string | null; nota?: string }>>

export interface ParallelMapperProps {
  cartas: readonly ParallelCandidate[]
  /** As respostas já gravadas no arquivo manual, por `source_id`. */
  manual: Manual
}

function respondida(carta: ParallelCandidate, manual: Manual): boolean {
  return carta.ours.every((art) => candidateAnswered(art, manual))
}

const MOTIVO: Record<CandidateReason, string> = {
  'sem-vinculo': 'Sem vínculo',
  'liga-sugere-outro': 'A Liga aponta outro produto',
  'normal-sem-preco': 'Normal sem preço',
}

export function ParallelMapper({ cartas, manual }: ParallelMapperProps) {
  const [filtro, setFiltro] = useState<Filtro>('faltam')
  // Abre na primeira colecao, e nao em todas: sao 150 cartas com milhares de
  // miniaturas, e a pagina inteira de uma vez travava o navegador.
  const [set, setSet] = useState<string | null>(null)

  const faltam = useMemo(() => cartas.filter((c) => !respondida(c, manual)), [cartas, manual])
  const doFiltro = filtro === 'faltam' ? faltam : cartas

  const sets = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const carta of doFiltro) {
      const code = carta.setCode ?? '—'
      contagem.set(code, (contagem.get(code) ?? 0) + 1)
    }
    return [...contagem]
  }, [doFiltro])
  const primeiro = sets[0]?.[0] ?? TODOS_OS_SETS
  const escolhido = set ?? primeiro
  const setAtivo = escolhido === TODOS_OS_SETS || sets.some(([code]) => code === escolhido) ? escolhido : primeiro
  const visiveis =
    setAtivo === TODOS_OS_SETS ? doFiltro : doFiltro.filter((carta) => (carta.setCode ?? '—') === setAtivo)

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
      {sets.length > 1 ? (
        <Segmented<string>
          label="Filtrar por coleção"
          value={setAtivo}
          onValueChange={setSet}
          options={[
            { value: TODOS_OS_SETS, label: 'Todas', count: doFiltro.length },
            ...sets.map(([code, count]) => ({ value: code, label: code, count })),
          ]}
        />
      ) : null}

      {visiveis.length === 0 ? (
        <EmptyState
          title="Nenhuma carta falta"
          description="Todas as artes do levantamento têm resposta no arquivo manual."
        />
      ) : (
        <ul className="space-y-4">
          {visiveis.map((carta) => (
            <li key={carta.cardCode}>
              <CardMappingForm carta={carta} manual={manual} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A escolha de uma linha: um produto, `NO_PRODUCT`, ou vazio para "depois". */
type Escolha = string

function escolhaInicial(carta: ParallelCandidate, manual: Manual): Record<string, Escolha> {
  const produtos = new Set(carta.theirs.map((art) => art.productId))
  return Object.fromEntries(
    carta.ours.map((art) => {
      const resposta = manual[art.sourceId]
      if (!resposta) return [art.sourceId, '']
      if (resposta.produto === null) return [art.sourceId, NO_PRODUCT]
      // Resposta editada à mão para um produto fora do levantamento: a tela não
      // tem como mostrá-la, e fingir que ela é uma das opções gravaria outra coisa.
      return [art.sourceId, produtos.has(resposta.produto) ? resposta.produto : '']
    }),
  )
}

function descreverProduto(produto: CandidateSourceArt | undefined): string {
  if (!produto) return 'produto fora da fonte'
  return `${produto.label || 'sem tratamento'}${produto.groupCode ? ` · ${produto.groupCode}` : ''}`
}

export function CardMappingForm({ carta, manual }: { carta: ParallelCandidate; manual: Manual }) {
  const [state, action, pending] = useActionState(recordCardMappingAction, MAPPING_IDLE)
  const [escolhas, setEscolhas] = useState(() => escolhaInicial(carta, manual))

  const escolhidas = Object.values(escolhas).filter((valor) => valor !== '')
  const gravada = respondida(carta, manual)
  const porId = new Map(carta.theirs.map((produto) => [produto.productId, produto]))

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
                <legend className="sr-only">Qual produto é a arte {art.sourceId}</legend>

                <div className="w-28 shrink-0 space-y-1">
                  <CardArt src={art.imageUrl} alt={`Arte ${art.sourceId}`} fallback={art.sourceId} sizes="112px" />
                  <p className="text-xs text-text">{art.sourceId}</p>
                  <p className="text-xs text-text-subtle">
                    {art.variantType === 'Normal' ? 'Normal' : 'Paralela'}
                    {art.rarity ? ` · ${art.rarity}` : ''}
                  </p>
                  {art.motivo && !candidateAnswered(art, manual) ? (
                    <Badge tone="warning">{MOTIVO[art.motivo]}</Badge>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <ContextoDaArte art={art} porId={porId} />

                  <div className="flex flex-wrap gap-2">
                    {carta.theirs.map((produto) => (
                      <Opcao
                        key={produto.productId}
                        name={nome}
                        value={produto.productId}
                        checked={minha === produto.productId}
                        disabled={tomados.has(produto.productId)}
                        onSelect={escolher}
                        rodape={
                          <a
                            href={tcgplayerProductUrl(produto.productId) ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-accent underline"
                            aria-label={`produto ${produto.productId} no TCGplayer`}
                          >
                            TCGplayer
                          </a>
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={sourceImageUrl(produto.productId, 'thumb')}
                          alt=""
                          loading="lazy"
                          className="aspect-[5/7] w-full rounded-control border border-border object-cover"
                        />
                        <span className="mt-1 block text-xs text-text">{produto.label || 'Sem tratamento'}</span>
                        {produto.groupCode ? (
                          <span className="block text-xs text-text-subtle">{produto.groupCode}</span>
                        ) : null}
                        <span className="block text-xs text-text-subtle">
                          {produto.value === null ? 'sem preço' : formatUsd(produto.value)}
                        </span>
                        {art.atual?.productId === produto.productId ? (
                          <span className="block text-xs font-medium text-text">Vínculo de hoje</span>
                        ) : null}
                        {art.sugestao === produto.productId ? (
                          <span className="block text-xs font-medium text-accent">A Liga aponta</span>
                        ) : null}
                        {produto.dono && produto.dono !== art.sourceId ? (
                          <span className="block text-xs text-warning">de {produto.dono}</span>
                        ) : null}
                      </Opcao>
                    ))}

                    <Opcao name={nome} value={NO_PRODUCT} checked={minha === NO_PRODUCT} onSelect={escolher}>
                      <span className="block text-xs text-text">Não tem na fonte</span>
                    </Opcao>
                    <Opcao name={nome} value="" checked={minha === ''} onSelect={escolher}>
                      <span className="block text-xs text-text-muted">Deixar para depois</span>
                    </Opcao>
                  </div>
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

/** O vínculo de hoje, a página da Liga e o que ela aponta. */
function ContextoDaArte({
  art,
  porId,
}: {
  art: CandidateOurArt
  porId: ReadonlyMap<string, CandidateSourceArt>
}) {
  return (
    <dl className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-[auto_1fr]">
      <dt className="text-text-subtle">Hoje</dt>
      <dd className="text-text">
        {art.atual
          ? `${descreverProduto(porId.get(art.atual.productId))} (${art.atual.origin === 'manual' ? 'manual' : 'automático'})`
          : 'sem vínculo'}
      </dd>
      <dt className="text-text-subtle">Liga</dt>
      <dd className="text-text">
        {art.liga ? (
          <>
            <a href={art.liga.url} target="_blank" rel="noreferrer" className="text-accent underline">
              página conferida
            </a>
            {art.liga.tratamento ? ` · ${art.liga.tratamento}` : ' · sem tratamento no nome'}
          </>
        ) : (
          'sem página conferida'
        )}
      </dd>
      {art.sugestao ? (
        <>
          <dt className="text-text-subtle">A Liga aponta</dt>
          <dd className="font-medium text-accent">{descreverProduto(porId.get(art.sugestao))}</dd>
        </>
      ) : null}
    </dl>
  )
}

function Opcao({
  name,
  value,
  checked,
  disabled = false,
  onSelect,
  rodape,
  children,
}: {
  name: string
  value: string
  checked: boolean
  disabled?: boolean
  onSelect: (value: string) => void
  /** Fica fora do rótulo: clicar no link não escolhe a opção. */
  rodape?: React.ReactNode
  children: React.ReactNode
}) {
  const opcao = (
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
  if (!rodape) return opcao
  return (
    <div className="w-24 space-y-1">
      {opcao}
      <div className="px-1.5">{rodape}</div>
    </div>
  )
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}
