import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DON_SET_CODE } from '@/server/domain/catalog/don'
import { Symbol } from '@/components/brand/logo'
import { hasSetCover, SetCover } from '@/components/catalog/set-cover'
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
 * ## A imagem do produto, quando existe
 *
 * O pacote ou a caixa, desenhados pelo dono do produto (`SetCover`), ficam à
 * direita, nítidos: esses sim identificam o set. O símbolo da marca em marca
 * d'água sai quando ela entra — a imagem já traz a forma da marca atrás do
 * produto, e os dois no mesmo canto brigavam.
 *
 * ## As informações escritas continuam
 *
 * Código, nome, tipo e contagem seguem em texto, como pediu o dono do produto.
 * A arte é ambientação; quem precisa da informação não depende de reconhecê-la.
 */
export function SetHeader({ set }: { set: SetSummary }) {
  /*
   * A seta volta para **onde se entra**, e nao para a lista do tipo.
   *
   * Nos outros sets as duas coisas coincidem: quem abre a OP01 veio da lista de
   * coleções. No DON!! nao: ele e um set artificial, unico do seu tipo, e a
   * entrada dele e o botao no catalogo (decisao 112). Voltar para
   * `?tipo=don` levava a uma lista de um item so, que nao e lugar nenhum —
   * relatado pelo dono do produto em 24/09.
   */
  const ehDon = set.code === DON_SET_CODE
  const backHref = ehDon ? '/catalogo' : `/catalogo/sets?tipo=${set.kind}`
  const comCapa = hasSetCover(set.code)

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

        {comCapa ? null : (
          <Symbol
            label={null}
            className="pointer-events-none absolute -top-8 -right-6 -z-10 h-40 w-auto opacity-10 [&_path]:fill-white"
          />
        )}

        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {ehDon ? 'Catálogo' : SET_KIND_LABEL[set.kind]}
        </Link>

        <div className="flex items-end gap-4">
          <div className={comCapa ? 'min-w-0 flex-1 pr-24 md:pr-32' : 'min-w-0 flex-1'}>
            <p className="text-sm font-semibold text-white/80 tabular-nums">{set.displayCode}</p>
            <h1 className="mt-0.5 text-2xl leading-tight font-bold tracking-tight text-white">
              {set.displayName}
            </h1>
            <p className="mt-2 text-sm text-white/80 tabular-nums">
              {cardCountLabel(set.variantCount)}
            </p>
          </div>
          {/* No canto, rente: a forma roxa da imagem continua para fora do quadro. */}
          <SetCover
            code={set.code}
            alt=""
            sizes="128px"
            esmaecer={false}
            className="absolute right-0 bottom-0 h-[92%] md:h-full"
          />
        </div>
      </div>
    </div>
  )
}
