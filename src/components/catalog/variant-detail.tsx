import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CardArt } from './card-art'
import { AddToCollection } from '@/components/collection/add-to-collection'
import { VariantAllocationsPanel } from '@/components/storage/variant-allocations'
import { Panel } from '@/components/ui/surface'
import type { getCardVariant } from '@/server/application/catalog/get-card-variant'
import type { VariantAllocations } from '@/server/application/storage'
import { displaySetCode, displaySetName } from '@/server/domain/catalog/sets'
import { cn } from '@/lib/cn'

type Variant = Awaited<ReturnType<typeof getCardVariant>>

/**
 * A carta, em detalhe.
 *
 * A imagem é a protagonista (seção 13 da especificação), e vem **referenciada
 * na origem**: `<img>` com carregamento tardio, sem passar pelo otimizador do
 * `next/image`, que baixaria o arquivo e o serviria do nosso domínio — o que a
 * decisão 020 proíbe. Ver a decisão 026.
 *
 * A ficha mostra só o que a carta tem. `Leader` não tem custo e tem `life`;
 * `Event` e `Stage` não têm poder. Renderizar linha vazia para cada ausência
 * encheria a tela de traços e faria a pessoa procurar o dado que existe no meio
 * dos que não existem.
 */
export function VariantDetail({
  variant,
  ownedQuantity = 0,
  allocations,
}: {
  variant: Variant
  ownedQuantity?: number
  /** Onde as copias estao guardadas. Ausente para quem nao tem sessao. */
  allocations?: VariantAllocations
}) {
  const { card } = variant

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-8">
      <div className="mx-auto w-full max-w-64 shrink-0 md:mx-0 md:max-w-80">
        <CardArt
          src={variant.imageUrl}
          alt={`${card.code} — ${card.name}`}
          fallback={card.code}
          sizes="(max-width: 767px) 256px, 320px"
          priority
          className="shadow-card"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-text-muted tabular-nums">{card.code}</p>
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-text">{card.name}</h1>

          <div className="mt-1 flex flex-wrap gap-1.5">
            {variant.rarity ? <Badge tone="accent">{variant.rarity}</Badge> : null}
            <Badge>{card.type}</Badge>
            {variant.variantType !== 'Normal' ? <Badge>{variant.variantType}</Badge> : null}
            {card.colors.map((color) => (
              <Badge key={color}>{color}</Badge>
            ))}
            {card.hasTrigger ? <Badge tone="warning">Trigger</Badge> : null}
          </div>
        </header>

        <AddToCollection
          variantId={String(variant.variantId)}
          code={card.code}
          name={card.name}
          imageUrl={variant.imageUrl}
          labels={[variant.rarity, variant.variantType].filter((l): l is string => Boolean(l))}
          currentQuantity={ownedQuantity}
        />

        {allocations ? (
          <VariantAllocationsPanel
            variantId={String(variant.variantId)}
            code={card.code}
            name={card.name}
            imageUrl={variant.imageUrl}
            allocations={allocations}
          />
        ) : null}

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text">Informações</h2>
          <Panel className="divide-y divide-border">
            <Row label="Tipo" value={card.type} />
            <Row label="Raridade" value={variant.rarity} />
            <Row label="Variante" value={variant.variantType} />
            <Row label="Cor" value={card.colors.join(', ')} />
            <Row label="Atributo" value={card.attributes.join(', ')} />
            {/*
              "Custo" aqui é o custo de jogo, não dinheiro. A seção 16 da
              especificação pede essa separação em voz alta; o valor financeiro,
              quando existir, aparece como "preço de mercado".
            */}
            <Row label="Custo" value={card.cost} />
            <Row label="Life" value={card.life} />
            <Row label="Poder" value={card.power} />
            <Row label="Contador" value={card.counter} />
            <Row label="Bloqueio" value={card.blockIcon} />
            <Row label="Traits" value={card.traits.join(' · ')} />
            <Row label="Mecânicas" value={card.mechanics.join(' · ')} />
          </Panel>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text">
            {variant.sets.length === 1 ? 'Set' : 'Sets'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {variant.sets.map((set) => (
              <Link
                key={set.code}
                href={`/catalogo/sets/${encodeURIComponent(set.code)}`}
                className="inline-flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
              >
                <span className="font-semibold text-text tabular-nums">
                  {displaySetCode(set.code)}
                </span>
                <span className="text-text-muted">{displaySetName(set.name)}</span>
              </Link>
            ))}
          </div>
        </section>

        {variant.siblings.length > 1 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text">
              Outras artes de {card.code}
            </h2>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {variant.siblings.map((sibling) => (
                <li key={String(sibling.variantId)}>
                  <Link
                    href={`/catalogo/carta/${sibling.variantId}`}
                    aria-current={sibling.current ? 'page' : undefined}
                    className="flex flex-col gap-1.5"
                  >
                    <CardArt
                      src={sibling.imageUrl}
                      alt={`${card.code}, ${sibling.variantType}`}
                      // Sem arte, o util e o que distingue esta versao das
                      // outras. O codigo e o mesmo nas quatro; o tipo, nao.
                      fallback={sibling.variantType}
                      sizes="(max-width: 639px) 33vw, 20vw"
                      className={cn(
                        sibling.current && 'border-accent-ink ring-2 ring-accent-ink',
                      )}
                    />
                    <span className="truncate text-xs text-text-muted">
                      {sibling.rarity ?? sibling.variantType}
                      {sibling.current ? ' · atual' : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

/** Linha da ficha. Some quando não há valor, em vez de mostrar um traço. */
function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null

  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-text tabular-nums">{value}</dd>
    </div>
  )
}
