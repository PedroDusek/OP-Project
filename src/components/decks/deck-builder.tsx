'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { AlertTriangle, ArrowLeftRight, Check, Package, Plus, Sparkles } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { CatalogFilters } from '@/components/catalog/catalog-filters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QuantitySelector } from '@/components/ui/quantity-selector'
import { SearchBar } from '@/components/ui/search-bar'
import { Panel } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'
import { countActiveFilters, type CatalogSearchParams } from '@/lib/catalog-params'
import { deckCatalogQuery } from '@/lib/deck-query'
import type { CatalogVocabulary } from '@/server/application/catalog/vocabulary'
import {
  adicionarFaltantesAction,
  conferirDeckAction,
  type DeckState,
  type WantsState,
} from '@/app/(app)/deck/actions'

/**
 * O Deck Builder (decisão 095).
 *
 * Um líder e cinquenta cartas, e o ColeXa responde: o que você tem, onde está e
 * quanto custa o que falta.
 *
 * ## Por que o deck vive só nesta tela
 *
 * Escolha do dono do produto: isto é uma conferência, e não um guardador de
 * decks. Por isso não existe tabela nem botão de salvar — a lista dura enquanto
 * a tela estiver aberta, e o que sobrevive a ela é o que for para a want list.
 *
 * ## Por que a busca já vem filtrada
 *
 * A regra oficial exige que a carta tenha alguma cor do líder, e o servidor
 * recusa o que não tem (`analyzeDeck`). Filtrar a busca evita oferecer o que
 * seria recusado; a recusa continua no caso de uso, porque a tela é conveniência.
 *
 * ## Por que o líder é buscado duas vezes
 *
 * A busca do catálogo não devolve as cores — nenhuma tela precisava delas numa
 * lista. Ao escolher o líder, o detalhe dele é lido para saber as cores, que são
 * o que filtra o resto do deck.
 */

interface Carta {
  variantId: string
  cardCode: string
  cardName: string
  variantType: string
  imageUrl: string | null
}

interface Lider extends Carta {
  colors: string[]
}

interface Linha extends Carta {
  copies: number
}

const MAXIMO_POR_CARTA = 4
const TAMANHO_DO_DECK = 50

export function DeckBuilder({
  initialLeaders,
  vocabulary,
}: {
  initialLeaders: Carta[]
  vocabulary: CatalogVocabulary
}) {
  const [leader, setLeader] = useState<Lider | null>(null)
  const [sugestoes, setSugestoes] = useState<Carta[]>([])
  const [lendoLider, setLendoLider] = useState(false)
  const [erroLider, setErroLider] = useState<string | null>(null)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [autoComplete, setAutoComplete] = useState(true)
  const [resultado, setResultado] = useState<DeckState>({ status: 'idle' })
  const [wants, setWants] = useState<WantsState>({ status: 'idle' })
  const [conferindo, conferir] = useTransition()
  const [enviando, enviarWants] = useTransition()

  const total = linhas.reduce((soma, linha) => soma + linha.copies, 0)
  const porCodigo = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const linha of linhas) mapa.set(linha.cardCode, (mapa.get(linha.cardCode) ?? 0) + linha.copies)
    return mapa
  }, [linhas])

  /*
   * Escolher líder limpa a lista: as cores mudam, e as cartas da cor antiga
   * seriam recusadas na conferência. Limpar é mais honesto que deixar a pessoa
   * descobrir isso depois de montar cinquenta.
   */
  const escolherLider = async (carta: Carta) => {
    setErroLider(null)
    setLendoLider(true)
    try {
      const resposta = await fetch(`/api/catalog/${carta.variantId}`, { cache: 'no-store' })
      if (!resposta.ok) throw new Error('falhou')
      const detalhe = (await resposta.json()) as { card: { colors: string[] } }
      const cores = detalhe.card.colors
      // Ja traz a primeira leva da cor do lider: a etapa seguinte abre com
      // cartas, e nao com uma grade vazia esperando alguem digitar.
      setSugestoes(await primeiraLeva(['Character', 'Event', 'Stage'], cores))
      setLeader({ ...carta, colors: cores })
      setLinhas([])
      setResultado({ status: 'idle' })
    } catch {
      setErroLider('Não foi possível ler as cores deste líder. Tente de novo.')
    } finally {
      setLendoLider(false)
    }
  }

  const acrescentar = (carta: Carta) => {
    setResultado({ status: 'idle' })
    setLinhas((atual) => {
      const noCodigo = atual.reduce(
        (soma, linha) => (linha.cardCode === carta.cardCode ? soma + linha.copies : soma),
        0,
      )
      const noDeck = atual.reduce((soma, linha) => soma + linha.copies, 0)
      if (noCodigo >= MAXIMO_POR_CARTA || noDeck >= TAMANHO_DO_DECK) return atual

      const existente = atual.find((linha) => linha.variantId === carta.variantId)
      if (existente) {
        return atual.map((linha) =>
          linha.variantId === carta.variantId ? { ...linha, copies: linha.copies + 1 } : linha,
        )
      }
      return [...atual, { ...carta, copies: 1 }]
    })
  }

  const mudarCopias = (variantId: string, copies: number) => {
    setResultado({ status: 'idle' })
    setLinhas((atual) =>
      copies === 0
        ? atual.filter((linha) => linha.variantId !== variantId)
        : atual.map((linha) => (linha.variantId === variantId ? { ...linha, copies } : linha)),
    )
  }

  const analysis = resultado.status === 'ok' ? resultado.analysis : null
  // O lider entra na conta do que falta, como as outras 50 (decisao 095).
  const faltantes = analysis ? [analysis.leader, ...analysis.lines].filter((linha) => linha.missing > 0) : []

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text">1. O líder</h2>

        {leader ? (
          <Panel className="flex items-center gap-3 p-3">
            <span className="w-16 shrink-0">
              <CardArt src={leader.imageUrl} alt={leader.cardName} fallback={leader.cardCode} sizes="64px" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{leader.cardName}</p>
              <p className="text-xs text-text-muted tabular-nums">
                {leader.cardCode} · {leader.colors.join(' e ')}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setLeader(null)
                setLinhas([])
                setResultado({ status: 'idle' })
              }}
            >
              Trocar
            </Button>
          </Panel>
        ) : (
          <>
            <BuscaDeCartas
              tipos={['Leader']}
              vocabulary={vocabulary}
              inicial={initialLeaders}
              onEscolher={escolherLider}
              desabilitado={lendoLider}
            />
            {erroLider ? (
              <p role="alert" className="text-sm text-danger">
                {erroLider}
              </p>
            ) : null}
          </>
        )}
      </section>

      {leader ? (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-text">2. As cartas</h2>
              <span className="text-sm text-text-muted tabular-nums">
                {total} de {TAMANHO_DO_DECK}
              </span>
            </div>

            <BuscaDeCartas
              key={leader.variantId}
              tipos={['Character', 'Event', 'Stage']}
              cores={leader.colors}
              vocabulary={vocabulary}
              inicial={sugestoes}
              onEscolher={acrescentar}
              desabilitado={total >= TAMANHO_DO_DECK}
            />

            {linhas.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {linhas.map((linha) => (
                  <li key={linha.variantId}>
                    <Panel className="flex items-center gap-3 p-2.5">
                      <span className="w-12 shrink-0">
                        <CardArt src={linha.imageUrl} alt={linha.cardName} fallback={linha.cardCode} sizes="48px" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{linha.cardName}</p>
                        <p className="text-xs text-text-muted tabular-nums">
                          {linha.cardCode}
                          {linha.variantType !== 'Normal' ? ` · ${linha.variantType}` : ''}
                        </p>
                      </div>
                      {/*
                        Largura fixa: o campo do meio cresce ate onde puder, e numa
                        linha com a arte e o nome ele empurrava o botao de somar
                        para fora da tela (relatado pelo dono do produto).
                      */}
                      <QuantitySelector
                        className="w-36 shrink-0"
                        value={linha.copies}
                        onValueChange={(valor) => mudarCopias(linha.variantId, valor)}
                        label={`Cópias de ${linha.cardCode}`}
                        min={0}
                        max={linha.copies + Math.max(0, MAXIMO_POR_CARTA - (porCodigo.get(linha.cardCode) ?? 0))}
                      />
                    </Panel>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">
                Toque numa carta para acrescentá-la. Vale qualquer trait — a única regra é ter uma cor em
                comum com o líder —, e no máximo {MAXIMO_POR_CARTA} cópias de cada carta.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-text">3. A conferência</h2>

            <Panel className="p-3">
              <Switch
                checked={autoComplete}
                onCheckedChange={(valor) => {
                  setAutoComplete(valor)
                  setResultado({ status: 'idle' })
                }}
                label="Auto completar"
                description="Ligado, as cópias de qualquer arte da mesma carta contam. Desligado, só a arte que você escolheu."
              />
            </Panel>

            <Button
              block
              size="lg"
              loading={conferindo}
              disabled={linhas.length === 0}
              onClick={() =>
                conferir(async () => {
                  setWants({ status: 'idle' })
                  setResultado(
                    await conferirDeckAction({
                      leaderVariantId: leader.variantId,
                      lines: linhas.map((linha) => ({ variantId: linha.variantId, copies: linha.copies })),
                      autoComplete,
                    }),
                  )
                })
              }
            >
              Conferir o que eu tenho
            </Button>

            {resultado.status === 'error' ? (
              <p role="alert" className="text-sm text-danger">
                {resultado.message}
              </p>
            ) : null}
          </section>

          {analysis ? (
            <section className="flex flex-col gap-3">
              {/*
                Em destaque e primeiro, com o nome que o dono do produto pediu:
                e o numero que decide se vale montar este deck agora.
              */}
              <Panel className="flex flex-col gap-1 border-accent-ink/30 p-4">
                <p className="text-xs font-medium text-text-muted">Valor estimado para completar o deck</p>
                <p className="text-2xl font-bold text-text">
                  <strong className="tabular-nums">
                    {analysis.cost.brl
                      ? `R$ ${analysis.cost.brl.value.toFixed(2).replace('.', ',')}`
                      : `US$ ${analysis.cost.usd.toFixed(2)}`}
                  </strong>
                </p>
                {analysis.missingTotal === 0 ? (
                  <p className="text-xs text-success">Você já tem todas as {analysis.total} cartas.</p>
                ) : (
                  <p className="text-xs text-text-muted">
                    {analysis.missingTotal} {analysis.missingTotal === 1 ? 'carta faltando' : 'cartas faltando'}, pelo preço
                    de hoje da arte escolhida.
                  </p>
                )}
                {analysis.cost.brl ? (
                  <p className="text-xs text-text-muted tabular-nums">
                    US$ {analysis.cost.usd.toFixed(2)} · dólar a R${' '}
                    {analysis.cost.brl.rate.toFixed(4).replace('.', ',')}
                  </p>
                ) : null}
                {analysis.cost.withoutPrice > 0 ? (
                  <p className="text-xs text-text-muted">
                    {analysis.cost.withoutPrice}{' '}
                    {analysis.cost.withoutPrice === 1 ? 'cópia ficou' : 'cópias ficaram'} fora da conta, por não
                    ter preço conhecido.
                  </p>
                ) : null}
              </Panel>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Panel className="p-3">
                  <p className="text-lg font-bold text-text tabular-nums">{analysis.total}</p>
                  <p className="text-xs text-text-muted">no deck</p>
                </Panel>
                <Panel className="p-3">
                  <p className="text-lg font-bold text-success tabular-nums">{analysis.ownedTotal}</p>
                  <p className="text-xs text-text-muted">você tem</p>
                </Panel>
                <Panel className="p-3">
                  <p className="text-lg font-bold text-danger tabular-nums">{analysis.missingTotal}</p>
                  <p className="text-xs text-text-muted">faltam</p>
                </Panel>
              </div>



              <ul className="flex flex-col gap-2">
                {[analysis.leader, ...analysis.lines].map((linha) => (
                  <li key={linha.variantId}>
                    <Panel className="flex flex-col gap-2 p-3">
                      <div className="flex items-center gap-3">
                        <span className="w-12 shrink-0">
                          <CardArt src={linha.imageUrl} alt={linha.cardName} fallback={linha.cardCode} sizes="48px" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text">
                            {linha.cardName}
                            {linha.variantId === analysis.leader.variantId ? (
                              <span className="ml-1.5 text-xs font-semibold text-accent-ink">Líder</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-text-muted tabular-nums">
                            {linha.cardCode} · {linha.owned} de {linha.copies}
                          </p>
                        </div>
                        {linha.missing === 0 ? (
                          <Badge tone="success">
                            <Check className="size-3.5" aria-hidden /> completa
                          </Badge>
                        ) : (
                          <Badge tone="danger">faltam {linha.missing}</Badge>
                        )}
                      </div>

                      {/*
                        Pedido do dono do produto: avisar quando a copia que conta e
                        de outra arte (o auto completar aceita qualquer uma), e
                        pintar de laranja o que esta em local de troca — a carta
                        esta oferecida a outras pessoas, e usar no deck e desfazer
                        essa oferta.
                      */}
                      {linha.fromOtherArt > 0 ? (
                        <p className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink">
                          <Sparkles className="size-3.5" aria-hidden />
                          {linha.fromOtherArt} {linha.fromOtherArt === 1 ? 'cópia é' : 'cópias são'} de outra arte
                          desta carta
                        </p>
                      ) : null}

                      {linha.places.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {linha.places.map((place) => (
                            <li
                              key={`${place.location ?? 'sem-local'}-${place.forTrade}-${place.variantType}`}
                              className={
                                place.forTrade
                                  ? 'inline-flex items-center gap-1 rounded-control bg-warning-soft px-2 py-1 text-xs font-medium text-warning'
                                  : 'inline-flex items-center gap-1 rounded-control bg-surface-muted px-2 py-1 text-xs text-text-muted'
                              }
                            >
                              {place.location === null ? (
                                <>
                                  <AlertTriangle className="size-3.5 text-warning" aria-hidden />
                                  {place.quantity} sem local definido
                                </>
                              ) : (
                                <>
                                  {place.forTrade ? (
                                    <ArrowLeftRight className="size-3.5" aria-hidden />
                                  ) : (
                                    <Package className="size-3.5" aria-hidden />
                                  )}
                                  {place.quantity} em {place.location}
                                  {place.forTrade ? ' · local de troca' : ''}
                                </>
                              )}
                              {place.otherArt ? (
                                <span className="font-semibold text-accent-ink">· {place.variantType}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {linha.missing > 0 && linha.missingUsd !== null ? (
                        <p className="text-xs text-text-muted tabular-nums">
                          Comprar {linha.missing}: US$ {linha.missingUsd.toFixed(2)}
                        </p>
                      ) : null}
                    </Panel>
                  </li>
                ))}
              </ul>

              {faltantes.length > 0 ? (
                <>
                  <Button
                    variant="secondary"
                    block
                    loading={enviando}
                    onClick={() =>
                      enviarWants(async () => {
                        setWants(
                          await adicionarFaltantesAction(
                            faltantes.map((linha) => ({ variantId: linha.variantId, copies: linha.missing })),
                          ),
                        )
                      })
                    }
                  >
                    <Plus className="size-4" aria-hidden />
                    Adicionar o que falta à want list
                  </Button>
                  {wants.status !== 'idle' ? (
                    <p
                      role="status"
                      className={wants.status === 'ok' ? 'text-sm text-success' : 'text-sm text-danger'}
                    >
                      {wants.message}
                    </p>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/** A primeira leva de uma busca, pedida fora de qualquer efeito. */
async function primeiraLeva(tipos: string[], cores: string[]): Promise<Carta[]> {
  const query = deckCatalogQuery({}, '', tipos, cores)
  if (!query) return []

  const resposta = await fetch(`/api/catalog?${query}`, { cache: 'no-store' })
  if (!resposta.ok) return []
  const dados = (await resposta.json()) as { items: Carta[] }
  return dados.items
}

/** A busca que alimenta as duas etapas, com os filtros do catálogo. */
function BuscaDeCartas({
  tipos,
  cores,
  vocabulary,
  inicial,
  onEscolher,
  desabilitado = false,
}: {
  tipos: string[]
  cores?: string[]
  vocabulary: CatalogVocabulary
  /** A primeira leva, que vem pronta: buscar num efeito é o que a regra de lint proíbe. */
  inicial: Carta[]
  onEscolher: (carta: Carta) => void
  desabilitado?: boolean
}) {
  const [termo, setTermo] = useState('')
  const [filtros, setFiltros] = useState<CatalogSearchParams>({})
  const [cartas, setCartas] = useState<Carta[]>(inicial)
  const [pagina, setPagina] = useState(1)
  // Sem saber o total da primeira leva, supoe que ha mais: o botao some na
  // primeira pagina que vier incompleta.
  const [temMais, setTemMais] = useState(inicial.length >= 12)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [foraDaTrava, setForaDaTrava] = useState(false)

  // Buscar e disparado pelos gestos — enviar o termo, aplicar filtros —, e
  // nunca por um efeito.
  /*
   * `proxima` pede a pagina seguinte e soma a grade; sem ela, a busca recomeca.
   * Relatado pelo dono do produto: so as doze primeiras cartas apareciam, e
   * parecia que o deck aceitava so um trait — o resto do catalogo existia, mas
   * nao havia como chegar nele sem digitar.
   */
  const buscar = useCallback(
    async (termoAtual: string, filtrosAtuais: CatalogSearchParams, proxima?: number) => {
      const query = deckCatalogQuery(filtrosAtuais, termoAtual, tipos, cores)
      setErro(null)
      if (!query) {
        setForaDaTrava(true)
        setCartas([])
        setTemMais(false)
        return
      }
      setForaDaTrava(false)
      setCarregando(true)
      const alvo = proxima ?? 1
      try {
        const resposta = await fetch(`/api/catalog?${query}&page=${alvo}`, { cache: 'no-store' })
        if (!resposta.ok) throw new Error('falhou')
        const dados = (await resposta.json()) as { items: Carta[]; totalPages: number }
        setCartas((atual) => (proxima ? [...atual, ...dados.items] : dados.items))
        setPagina(alvo)
        setTemMais(alvo < dados.totalPages)
      } catch {
        setErro('Não foi possível buscar agora. Tente de novo.')
      } finally {
        setCarregando(false)
      }
    },
    [tipos, cores],
  )

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(evento) => {
          evento.preventDefault()
          void buscar(termo, filtros)
        }}
      >
        <SearchBar
          label="Buscar carta"
          value={termo}
          onValueChange={setTermo}
          onClear={() => setTermo('')}
          placeholder="Nome ou código"
          className="flex-1"
        />
        <CatalogFilters
          vocabulary={vocabulary}
          activeCount={countActiveFilters(filtros)}
          values={filtros}
          onApply={(novos) => {
            setFiltros(novos)
            void buscar(termo, novos)
          }}
        />
        <Button type="submit" variant="secondary" loading={carregando}>
          Buscar
        </Button>
      </form>

      {erro ? (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      ) : null}

      {foraDaTrava ? (
        <p className="text-sm text-text-muted">
          Esses filtros saem das regras do deck: {cores ? `só entram cartas ${cores.join(' ou ')}` : 'aqui só entram líderes'}
          {cores ? ', e nenhum Leader' : ''}.
        </p>
      ) : cartas.length === 0 && !carregando ? (
        <p className="text-sm text-text-muted">Nada encontrado com essa busca.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {cartas.map((carta) => (
            <li key={carta.variantId}>
              <button
                type="button"
                disabled={desabilitado}
                onClick={() => onEscolher(carta)}
                className="flex w-full flex-col gap-1 text-left disabled:opacity-45"
              >
                <CardArt
                  src={carta.imageUrl}
                  alt={`${carta.cardCode} — ${carta.cardName}`}
                  fallback={carta.cardCode}
                  sizes="(max-width: 639px) 33vw, (max-width: 767px) 25vw, 17vw"
                />
                <span className="truncate text-xs font-semibold text-text tabular-nums">{carta.cardCode}</span>
                <span className="truncate text-xs text-text-muted">{carta.cardName}</span>
                {carta.variantType !== 'Normal' ? (
                  <span className="truncate text-xs text-accent-ink">{carta.variantType}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {temMais && !foraDaTrava && cartas.length > 0 ? (
        <Button
          variant="secondary"
          loading={carregando}
          onClick={() => void buscar(termo, filtros, pagina + 1)}
        >
          Mostrar mais
        </Button>
      ) : null}
    </div>
  )
}
