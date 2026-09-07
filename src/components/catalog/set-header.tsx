import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Symbol } from '@/components/brand/logo'
import type { SetSummary } from '@/server/application/catalog/list-sets'

/**
 * Cabeçalho do set.
 *
 * A tela de referência abre com uma faixa de arte do mangá. Duas coisas
 * impedem: a seção 19 da especificação proíbe arte de franquia como decoração,
 * e o modelo de dados não guarda capa de set — não existe o dado.
 *
 * A faixa usa, então, o que é nosso: o roxo de ênfase e o símbolo da marca em
 * marca d'água. Cumpre a mesma função — dar peso ao topo e situar quem chegou —
 * sem tomar emprestada a arte de ninguém.
 */
export function SetHeader({ set }: { set: SetSummary }) {
  return (
    <div className="-mx-4 mb-4 md:mx-0 md:rounded-card md:overflow-hidden">
      <div className="relative overflow-hidden bg-accent px-4 py-6 md:px-6">
        <Symbol
          label={null}
          className="pointer-events-none absolute -top-8 -right-6 h-40 w-auto opacity-10 [&_path]:fill-white"
        />

        <Link
          href="/catalogo/sets"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Todos os sets
        </Link>

        <p className="text-sm font-semibold text-white/80 tabular-nums">{set.code}</p>
        <h1 className="mt-0.5 text-2xl leading-tight font-bold tracking-tight text-white">
          {set.displayName}
        </h1>
        <p className="mt-2 text-sm text-white/80 tabular-nums">
          {set.variantCount === 1 ? '1 variante' : `${set.variantCount} variantes`}
        </p>
      </div>
    </div>
  )
}
