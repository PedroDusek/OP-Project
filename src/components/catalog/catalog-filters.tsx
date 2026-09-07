'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { FilterSection, FilterSheet } from '@/components/ui/filter-sheet'
import { Field, Input } from '@/components/ui/field'
import { SearchBar } from '@/components/ui/search-bar'
import { buildCatalogHref, PARAM } from '@/lib/catalog-params'
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
 * ## Rascunho local, aplicação explícita
 *
 * Mexer num chip **não** consulta o servidor. A pessoa monta a combinação
 * inteira e toca em Aplicar. Filtrar a cada toque geraria uma consulta por
 * dedada e faria a lista pular sob o dedo enquanto ela ainda escolhe.
 */

type Draft = Record<string, string | undefined>

export interface CatalogFiltersProps {
  vocabulary: CatalogVocabulary
  /** Quantos filtros estão ativos agora, para o rótulo do botão. */
  activeCount: number
}

export function CatalogFilters({ vocabulary, activeCount }: CatalogFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>({})
  const [traitTerm, setTraitTerm] = useState('')

  /** Ao abrir, o rascunho parte do que está na URL. */
  const openSheet = () => {
    const current: Draft = {}
    for (const key of FILTER_KEYS) {
      const value = params.get(key)
      if (value) current[key] = value
    }
    setDraft(current)
    setTraitTerm(current[PARAM.trait] ?? '')
    setOpen(true)
  }

  const set = (key: string, value: string | undefined) =>
    setDraft((current) => ({ ...current, [key]: value }))

  /** Chip que alterna: tocar no que já está escolhido desmarca. */
  const toggle = (key: string, value: string) =>
    set(key, draft[key] === value ? undefined : value)

  const apply = () => {
    const changes: Record<string, string | undefined> = {}
    for (const key of FILTER_KEYS) changes[key] = draft[key]
    changes[PARAM.trait] = traitTerm || undefined

    setOpen(false)
    startTransition(() => {
      router.push(buildCatalogHref(pathname, params, changes), { scroll: false })
    })
  }

  const clear = () => {
    setDraft({})
    setTraitTerm('')
  }

  const traitMatches = traitTerm
    ? vocabulary.traits.filter((t) => t.toLowerCase().includes(traitTerm.toLowerCase())).slice(0, 12)
    : []

  return (
    <>
      <Button
        variant="secondary"
        onClick={openSheet}
        aria-label={
          activeCount > 0 ? `Filtros, ${activeCount} ativos` : 'Filtros'
        }
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
        activeCount={Object.values(draft).filter(Boolean).length}
      >
        <FilterSection title="Tipo">
          <ChipRow>
            {vocabulary.types.map((value) => (
              <Chip
                key={value}
                selected={draft[PARAM.tipo] === value}
                onClick={() => toggle(PARAM.tipo, value)}
              >
                {value}
              </Chip>
            ))}
          </ChipRow>
        </FilterSection>

        <FilterSection title="Cor">
          <ChipRow>
            {vocabulary.colors.map((value) => (
              <Chip
                key={value}
                selected={draft[PARAM.cor] === value}
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

        <FilterSection title="Raridade">
          <ChipRow>
            {vocabulary.rarities.map((value) => (
              <Chip
                key={value}
                selected={draft[PARAM.raridade] === value}
                onClick={() => toggle(PARAM.raridade, value)}
              >
                {value}
              </Chip>
            ))}
          </ChipRow>
        </FilterSection>

        <FilterSection title="Variante">
          <ChipRow>
            {vocabulary.variantTypes.map((value) => (
              <Chip
                key={value}
                selected={draft[PARAM.variante] === value}
                onClick={() => toggle(PARAM.variante, value)}
              >
                {value}
              </Chip>
            ))}
          </ChipRow>
        </FilterSection>

        <FilterSection title="Atributo">
          <ChipRow>
            {vocabulary.attributes.map((value) => (
              <Chip
                key={value}
                selected={draft[PARAM.atributo] === value}
                onClick={() => toggle(PARAM.atributo, value)}
              >
                {value}
              </Chip>
            ))}
          </ChipRow>
        </FilterSection>

        <FilterSection title="Mecânica">
          <ChipRow>
            {vocabulary.mechanics.map((value) => (
              <Chip
                key={value}
                selected={draft[PARAM.mecanica] === value}
                onClick={() => toggle(PARAM.mecanica, value)}
              >
                {value}
              </Chip>
            ))}
          </ChipRow>
        </FilterSection>

        <FilterSection title="Trait">
          <SearchBar
            label="Buscar trait"
            value={traitTerm}
            onValueChange={setTraitTerm}
            placeholder="Ex: Straw Hat Crew"
          />
          {traitMatches.length > 0 ? (
            <ChipRow className="mt-1">
              {traitMatches.map((value) => (
                <Chip key={value} selected={traitTerm === value} onClick={() => setTraitTerm(value)}>
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
              draft={draft}
              set={set}
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
              draft={draft}
              set={set}
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

const FILTER_KEYS = [
  PARAM.tipo,
  PARAM.cor,
  PARAM.raridade,
  PARAM.variante,
  PARAM.atributo,
  PARAM.mecanica,
  PARAM.trait,
  PARAM.custoMin,
  PARAM.custoMax,
  PARAM.poderMin,
  PARAM.poderMax,
]

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
  draft: Draft
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
