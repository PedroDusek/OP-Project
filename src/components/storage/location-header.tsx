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
 * ## A foto é um quadro, e não o fundo
 *
 * Ela já foi fundo: cortada na largura toda, desfocada e a 25% de opacidade. O
 * arranjo garantia contraste para o texto branco, e destruía a foto — uma foto
 * de binder é 4:3, a faixa é larga e baixa, e o que sobrava era um borrão
 * colorido que não se reconhecia. Quem enviou a foto não a via em lugar nenhum.
 *
 * Agora ela aparece contida, num quadrado ao lado do nome — o mesmo quadro da
 * lista, para o binder ter a mesma cara nos dois lugares. Cortar um 4:3 em
 * quadrado tira as laterais e mantém o assunto; é bem menos do que a faixa
 * tirava.
 *
 * O contraste, de quebra, ficou mais fácil: o texto branco passa a estar sobre
 * o roxo da marca puro, e não sobre uma imagem que não controlamos.
 */
export function LocationHeader({ location }: { location: StorageLocationDetail }) {
  return (
    <div className="-mx-4 mb-4 md:mx-0 md:overflow-hidden md:rounded-card">
      <div className="relative isolate overflow-hidden bg-accent px-4 py-6 md:px-6">
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

          {location.image ? (
            <span className="relative block size-16 shrink-0 overflow-hidden rounded-card border border-white/30 bg-white/10 shadow-card md:size-20">
              <Image
                src={location.image}
                alt=""
                aria-hidden
                fill
                sizes="(max-width: 767px) 64px, 80px"
                priority
                className="object-cover"
              />
            </span>
          ) : null}

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
