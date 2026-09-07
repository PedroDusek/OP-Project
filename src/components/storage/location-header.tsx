import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, SquarePen } from 'lucide-react'
import { Symbol } from '@/components/brand/logo'
import { cardCountLabel } from '@/server/domain/catalog/sets'
import type { StorageLocationDetail } from '@/server/application/storage'

/**
 * Cabeçalho do local (tela 22).
 *
 * Segue o mesmo arranjo do cabeçalho de set, e de propósito: são a mesma coisa
 * na tela — um objeto com foto, um nome e uma contagem —, e duas aparências
 * diferentes fariam o produto parecer dois.
 *
 * A foto entra desfocada, a 25% de opacidade, sob uma camada do roxo da marca.
 * Isso não é estética: é a foto que a pessoa enviou, de qualquer cor, e o texto
 * branco por cima precisa de piso de contraste medido. Aumentar a opacidade
 * derruba esse piso. Sem foto, fica o roxo com a marca esmaecida.
 */
export function LocationHeader({ location }: { location: StorageLocationDetail }) {
  return (
    <div className="-mx-4 mb-4 md:mx-0 md:overflow-hidden md:rounded-card">
      <div className="relative isolate overflow-hidden bg-accent px-4 py-6 md:px-6">
        {location.image ? (
          <Image
            src={location.image}
            alt=""
            aria-hidden
            fill
            sizes="480px"
            className="-z-10 scale-110 object-cover opacity-25 blur-md"
          />
        ) : null}

        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-linear-to-r from-accent via-accent/85 to-accent/60"
        />

        <Symbol
          label={null}
          className="pointer-events-none absolute -top-8 -right-6 -z-10 h-40 w-auto opacity-10 [&_path]:fill-white"
        />

        <div className="flex items-start gap-3">
          <Link
            href="/binders"
            aria-label="Voltar para Binders"
            className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-white/90 transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>

          <div className="min-w-0 flex-1 pt-2">
            <h1 className="truncate text-2xl font-bold tracking-tight text-white">
              {location.name}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {location.subtitle} · {cardCountLabel(location.cardCount)}
            </p>
          </div>

          <Link
            href={`/binders/${location.id}/editar`}
            aria-label="Editar informações"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-white/15 text-white transition-colors hover:bg-white/25"
          >
            <SquarePen className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  )
}
