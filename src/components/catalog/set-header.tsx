import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Symbol } from '@/components/brand/logo'
import { cardCountLabel, SET_KIND_LABEL } from '@/server/domain/catalog/sets'
import type { SetSummary } from '@/server/application/catalog/list-sets'

/**
 * Cabeçalho do set.
 *
 * ## A arte
 *
 * O modelo não guarda capa de set — a fonte não publica uma que a importação
 * alcance —, então a arte é a **primeira carta do set**, por código. É
 * determinística, pertence ao set, e é o mais próximo de "a imagem da coleção"
 * que o dado permite hoje.
 *
 * Ela entra desfocada e por baixo de uma camada do roxo da marca, por dois
 * motivos que se somam. Uma carta é 5:7 e a faixa é larga: mostrada nítida,
 * seria um recorte arbitrário do meio de uma ilustração. E o texto por cima
 * precisa de contraste garantido sobre arte que não controlamos.
 *
 * Os 25% de opacidade da imagem não são estética: são o que sustenta o
 * contraste. Medido no pior caso — arte inteiramente branca, no ponto mais
 * transparente do gradiente — o branco fica em **6.05:1** no tema escuro e
 * 8.97:1 no claro, os dois acima do mínimo de 4.5:1. Aumentar a opacidade da
 * arte derruba esse piso.
 *
 * ## As informações escritas continuam
 *
 * Código, nome, tipo e contagem seguem em texto, como pediu o dono do produto.
 * A arte é ambientação; quem precisa da informação não depende de reconhecê-la.
 */
export function SetHeader({ set }: { set: SetSummary }) {
  const backHref = `/catalogo/sets?tipo=${set.kind}`

  return (
    <div className="-mx-4 mb-4 md:mx-0 md:overflow-hidden md:rounded-card">
      <div className="relative isolate overflow-hidden bg-accent px-4 py-6 md:px-6">
        {set.coverUrl ? (
          <Image
            src={set.coverUrl}
            alt=""
            aria-hidden
            fill
            // Desfocada e a 25%: a resolucao pedida pode ser pequena.
            sizes="480px"
            className="-z-10 scale-110 object-cover opacity-25 blur-md"
          />
        ) : null}

        {/* Escurece o topo o bastante para o texto não depender da arte. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-linear-to-r from-accent via-accent/85 to-accent/60"
        />

        <Symbol
          label={null}
          className="pointer-events-none absolute -top-8 -right-6 -z-10 h-40 w-auto opacity-10 [&_path]:fill-white"
        />

        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {SET_KIND_LABEL[set.kind]}
        </Link>

        <p className="text-sm font-semibold text-white/80 tabular-nums">{set.displayCode}</p>
        <h1 className="mt-0.5 text-2xl leading-tight font-bold tracking-tight text-white">
          {set.displayName}
        </h1>
        <p className="mt-2 text-sm text-white/80 tabular-nums">
          {cardCountLabel(set.variantCount)}
        </p>
      </div>
    </div>
  )
}
