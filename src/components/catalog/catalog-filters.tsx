'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { FilterSection, FilterSheet } from '@/components/ui/filter-sheet'
import { Field, Input } from '@/components/ui/field'
import { SearchBar } from '@/components/ui/search-bar'
import { Select } from '@/components/ui/select'
import { COUNTER_LABELS, COUNTER_TOKENS } from '@/server/domain/catalog/counter'
import { SET_KIND_LABEL } from '@/server/domain/catalog/sets'
import { buildCatalogHref, PARAM, type CatalogSearchParams } from '@/lib/catalog-params'
import type { CatalogVocabulary } from '@/server/application/catalog/vocabulary'
import { cn } from '@/lib/cn'

/**
 * O painel de filtros do catálogo (tela 12).
 *
 * O vocabulário vem do servidor, extraído do catálogo importado. Por isso o
 * painel não oferece nada que não exista: só Normal e Parallel em variante
 * (decisão 023), só os dez termos da allowlist em mecânica (decisão 022), e
 * nenhuma seção de efeito, porque a tabela está vazia de propósito
 * (decisão 021).
 *
 * As telas de referência mostram "Alt Art", "Manga" e "Promo" como variantes.
 * Não existem no nosso modelo, e a instrução é usar as telas para estética e
 * layout, não para função.
 *
 * ## Vários valores por seção
 *
 * Dentro de uma seção os valores se somam por **ou**: marcar Preto e Azul pede
 * "preta ou azul". Entre seções vale o **e**: Azul com raridade SR pede as duas
 * coisas.
 *
 * É a combinação que responde à pergunta que se faz montando deck. Com um valor
 * por seção, escolher a segunda cor apagava a primeira — e não havia como
 * pedir "as pretas e as azuis" de uma vez.
 *
 * Custo e poder ficam de fora disso: são faixas, e duas faixas ao mesmo tempo
 * seriam duas perguntas na mesma pergunta.
 *
 * O set também fica de fora: são sessenta, e "as cartas de OP-09" é a pergunta
 * que alguém faz — "as de OP-09 ou de OP-11" não é um gesto de quem organiza
 * coleção. Por isso é uma lista suspensa, e não uma fileira de chips que não
 * caberia na tela.
 *
 * "Todos os sets" tem um valor de sentinela, e não string vazia: o `Select` do
 * Radix recusa item com valor vazio — ele reserva o vazio para "nada
 * escolhido" — e o painel quebraria ao ser aberto.
 *
 * ## Dois destinos para o resultado
 *
 * Por padrão a escolha vai para a **URL**, que é onde os filtros do catálogo
 * moram — a busca fica compartilhável e volta igual pelo histórico.
 *
 * Com `onApply`, ela volta para quem chamou. É o que a tela de adicionar em
 * massa precisa: lá os filtros são passo de uma tarefa, não um endereço, e
 * navegar a cada mudança apagaria as cartas já escolhidas.
 *
 * ## Rascunho local, aplicação explícita
 *
 * Mexer num chip **não** consulta o servidor. A pessoa monta a combinação
 * inteira e toca em Aplicar. Filtrar a cada toque geraria uma consulta por
 * dedada e faria a lista pular sob o dedo enquanto ela ainda escolhe.
 */

/** As seções que aceitam vários valores. */
const MULTI_KEYS = [
  PARAM.tipo,
  PARAM.cor,
  PARAM.raridade,
  PARAM.variante,
  PARAM.atributo,
  PARAM.mecanica,
  PARAM.trait,
  PARAM.contador,
] as const

/** As que aceitam um só: o set e os limites das faixas. */
const RANGE_KEYS = [
  PARAM.set,
  PARAM.custoMin,
  PARAM.custoMax,
  PARAM.poderMin,
  PARAM.poderMax,
] as const

/** "Sem filtro de set". Não é string vazia porque o Radix reserva o vazio. */
const TODOS_OS_SETS = '*'

type MultiDraft = Record<string, string[]>
type RangeDraft = Record<string, string | undefined>

export interface CatalogFiltersProps {
  vocabulary: CatalogVocabulary
  /** Quantos filtros estão ativos agora, para o rótulo do botão. */
  activeCount: number
  /** Recebe a escolha em vez de navegar. Exige `values`. */
  onApply?: (changes: CatalogSearchParams) => void
  /**
   * Esconde o filtro de set.
   *
   * Na pagina de um set a rota ja fixa qual e — e ela vence o parametro da URL.
   * Oferecer o campo ali seria oferecer um controle que nao muda nada.
   */
  hideSetFilter?: boolean
  /** Os filtros atuais, quando não vêm da URL. */
  values?: CatalogSearchParams
}

export function CatalogFilters({
  vocabulary,
  activeCount,
  onApply,
  values,
  hideSetFilter = false,
}: CatalogFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  const [open, setOpen] = useState(false)
  const [multi, setMulti] = useState<MultiDraft>({})
  const [ranges, setRanges] = useState<RangeDraft>({})
  const [traitTerm, setTraitTerm] = useState('')

  /** Os valores atuais: da URL, ou de quem chamou quando ela não é o destino. */
  const currentValues = (key: string): string[] => {
    if (!values) return params.getAll(key).filter(Boolean)
    const value = values[key]
    if (value === undefined) return []
    return (Array.isArray(value) ? value : [value]).filter(Boolean)
  }

  /** Ao abrir, o rascunho parte do que já está aplicado. */
  const openSheet = () => {
    const nextMulti: MultiDraft = {}
    for (const key of MULTI_KEYS) {
      const chosen = currentValues(key)
      if (chosen.length > 0) nextMulti[key] = chosen
    }

    const nextRanges: RangeDraft = {}
    for (const key of RANGE_KEYS) {
      const [value] = currentValues(key)
      if (value) nextRanges[key] = value
    }

    setMulti(nextMulti)
    setRanges(nextRanges)
    setTraitTerm('')
    setOpen(true)
  }

  const selected = (key: string): string[] => multi[key] ?? []

  /** Tocar no que já está escolhido desmarca; nos outros, acrescenta. */
  const toggle = (key: string, value: string) =>
    setMulti((current) => {
      const values = current[key] ?? []
      const next = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value]

      // Seção sem nenhum valor sai do rascunho, para não virar parâmetro vazio
      // na URL nem contar como filtro ativo.
      const rest = { ...current }
      delete rest[key]
      return next.length > 0 ? { ...rest, [key]: next } : rest
    })

  const setRange = (key: string, value: string | undefined) =>
    setRanges((current) => ({ ...current, [key]: value }))

  const apply = () => {
    const changes: Record<string, string | string[] | undefined> = {}
    for (const key of MULTI_KEYS) changes[key] = multi[key]
    for (const key of RANGE_KEYS) changes[key] = ranges[key]

    setOpen(false)

    if (onApply) {
      onApply(changes)
      return
    }

    startTransition(() => {
      router.push(buildCatalogHref(pathname, params, changes), { scroll: false })
    })
  }

  const clear = () => {
    setMulti({})
    setRanges({})
    setTraitTerm('')
  }

  const draftCount =
    Object.values(multi).reduce((total, values) => total + values.length, 0) +
    Object.values(ranges).filter(Boolean).length

  const chosenTraits = selected(PARAM.trait)
  const traitMatches = traitTerm
    ? vocabulary.traits
        .filter((t) => t.toLowerCase().includes(traitTerm.toLowerCase()))
        .filter((t) => !chosenTraits.includes(t))
        .slice(0, 12)
    : []

  return (
    <>
      <Button
        variant="secondary"
        onClick={openSheet}
        aria-label={activeCount > 0 ? `Filtros, ${activeCount} ativos` : 'Filtros'}
        className="shrink-0"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtros
        {activeCount > 0 ? (
          <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-contrast">
            {activeCount}
          </span>
        ) : null}
      </Button>

      <FilterSheet
        open={open}
        onOpenChange={setOpen}
        title="Filtros do catálogo"
        onApply={apply}
        onClear={clear}
        activeCount={draftCount}
      >
        <p className="text-xs text-text-muted">
          Dentro de uma seção, vale qualquer um dos escolhidos. Entre seções, valem todos.
        </p>

        {vocabulary.sets.length > 0 && !hideSetFilter ? (
          <FilterSection title="Set">
            <Select
              label="Set"
              value={ranges[PARAM.set] ?? TODOS_OS_SETS}
              onValueChange={(value) =>
                setRange(PARAM.set, value === TODOS_OS_SETS ? undefined : value)
              }
              placeholder="Todos os sets"
              options={[
                { value: TODOS_OS_SETS, label: 'Todos os sets' },
                ...vocabulary.sets.map((set) => ({
                  value: set.code,
                  // O tipo no rótulo separa coleção de starter deck sem exigir
                  // uma segunda lista: são sessenta numa lista só.
                  label: `${set.displayCode} · ${set.displayName} (${SET_KIND_LABEL[set.kind]})`,
                })),
              ]}
            />
          </FilterSection>
        ) : null}

        <ChipSection
          title="Tipo"
          param={PARAM.tipo}
          values={vocabulary.types}
          selected={selected(PARAM.tipo)}
          onToggle={toggle}
        />

        {/*
          Os três valores do jogo, fixos, e não do vocabulário importado: o
          catálogo tem exatamente 1000, 2000 e personagens sem counter — medido
          —, e o zero não existe como valor no banco para o vocabulário achar.
          Qualquer opção marcada restringe o resultado a personagens.
        */}
        <ChipSection
          title="Counter"
          param={PARAM.contador}
          values={[...COUNTER_TOKENS]}
          labels={COUNTER_LABELS}
          selected={selected(PARAM.contador)}
          onToggle={toggle}
        />

        <FilterSection title="Cor">
          <ChipRow>
            {vocabulary.colors.map((value) => (
              <Chip
                key={value}
                selected={selected(PARAM.cor).includes(value)}
                onClick={() => toggle(PARAM.cor, value)}
              >
                {/*
                  O ponto é redundante de propósito: a seção 18 pede que
                  informação não dependa só de cor, e o nome ao lado é o que
                  garante isso.
                */}
                <span
                  aria-hidden
                  className={cn('size-2.5 rounded-full ring-1 ring-black/20', COLOR_DOT[value])}
                />
                {value}
              </Chip>
            ))}
          </ChipRow>
        </FilterSection>

        <ChipSection
          title="Raridade"
          param={PARAM.raridade}
          values={vocabulary.rarities}
          selected={selected(PARAM.raridade)}
          onToggle={toggle}
        />
        <ChipSection
          title="Variante"
          param={PARAM.variante}
          values={vocabulary.variantTypes}
          selected={selected(PARAM.variante)}
          onToggle={toggle}
        />
        <ChipSection
          title="Atributo"
          param={PARAM.atributo}
          values={vocabulary.attributes}
          selected={selected(PARAM.atributo)}
          onToggle={toggle}
        />
        <ChipSection
          title="Mecânica"
          param={PARAM.mecanica}
          values={vocabulary.mechanics}
          selected={selected(PARAM.mecanica)}
          onToggle={toggle}
        />

        <FilterSection title="Trait">
          {/*
            Os traits são milhares, então a lista não cabe na tela como as
            outras seções. O que já foi escolhido fica visível em cima — sem
            isso, uma escolha some assim que a busca muda, e a pessoa não tem
            como saber o que está filtrando.
          */}
          {chosenTraits.length > 0 ? (
            <ChipRow>
              {chosenTraits.map((value) => (
                <Chip key={value} selected onClick={() => toggle(PARAM.trait, value)}>
                  {value}
                  <X className="size-3" aria-hidden />
                </Chip>
              ))}
            </ChipRow>
          ) : null}

          <SearchBar
            label="Buscar trait"
            value={traitTerm}
            onValueChange={setTraitTerm}
            placeholder="Ex: Straw Hat Crew"
          />
          {traitMatches.length > 0 ? (
            <ChipRow className="mt-1">
              {traitMatches.map((value) => (
                <Chip key={value} onClick={() => toggle(PARAM.trait, value)}>
                  {value}
                </Chip>
              ))}
            </ChipRow>
          ) : null}
          <p className="text-xs text-text-subtle">
            {vocabulary.traits.length} traits no catálogo. Digite para encontrar.
          </p>
        </FilterSection>

        {vocabulary.costRange ? (
          <FilterSection title="Custo">
            <RangeInputs
              draft={ranges}
              set={setRange}
              minKey={PARAM.custoMin}
              maxKey={PARAM.custoMax}
              range={vocabulary.costRange}
              label="custo"
            />
          </FilterSection>
        ) : null}

        {vocabulary.powerRange ? (
          <FilterSection title="Poder">
            <RangeInputs
              draft={ranges}
              set={setRange}
              minKey={PARAM.poderMin}
              maxKey={PARAM.poderMax}
              range={vocabulary.powerRange}
              label="poder"
              step={1000}
            />
          </FilterSection>
        ) : null}
      </FilterSheet>
    </>
  )
}

/** Uma seção de chips que aceita vários valores. */
function ChipSection({
  title,
  param,
  values,
  labels,
  selected,
  onToggle,
}: {
  title: string
  param: string
  values: string[]
  /** Rótulo por valor, quando o valor da URL não é o que a pessoa lê. */
  labels?: Record<string, string>
  selected: string[]
  onToggle: (key: string, value: string) => void
}) {
  return (
    <FilterSection title={title}>
      <ChipRow>
        {values.map((value) => (
          <Chip
            key={value}
            selected={selected.includes(value)}
            onClick={() => onToggle(param, value)}
          >
            {labels?.[value] ?? value}
          </Chip>
        ))}
      </ChipRow>
    </FilterSection>
  )
}

/** As seis cores do jogo. Não são tokens do design system: são dado do jogo. */
const COLOR_DOT: Record<string, string> = {
  Red: 'bg-[#d3242c]',
  Green: 'bg-[#009a63]',
  Blue: 'bg-[#0d6fb8]',
  Yellow: 'bg-[#f2c200]',
  Purple: 'bg-[#7a3d99]',
  Black: 'bg-[#1b1b1b]',
}

function ChipRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap gap-2', className)}>{children}</div>
}

function RangeInputs({
  draft,
  set,
  minKey,
  maxKey,
  range,
  label,
  step = 1,
}: {
  draft: RangeDraft
  set: (key: string, value: string | undefined) => void
  minKey: string
  maxKey: string
  range: { min: number; max: number }
  label: string
  step?: number
}) {
  return (
    <div className="flex items-end gap-3">
      <Field label={`Mínimo de ${label}`} hideLabel className="flex-1">
        {(props) => (
          <Input
            {...props}
            type="number"
            inputMode="numeric"
            step={step}
            min={range.min}
            max={range.max}
            placeholder={`Mín. ${range.min}`}
            value={draft[minKey] ?? ''}
            onChange={(event) => set(minKey, event.target.value || undefined)}
          />
        )}
      </Field>
      <span className="pb-3 text-sm text-text-subtle" aria-hidden>
        até
      </span>
      <Field label={`Máximo de ${label}`} hideLabel className="flex-1">
        {(props) => (
          <Input
            {...props}
            type="number"
            inputMode="numeric"
            step={step}
            min={range.min}
            max={range.max}
            placeholder={`Máx. ${range.max}`}
            value={draft[maxKey] ?? ''}
            onChange={(event) => set(maxKey, event.target.value || undefined)}
          />
        )}
      </Field>
    </div>
  )
}
