import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { isAppError } from '@/server/domain/errors'
import { getCardVariant } from '@/server/application/catalog'
import { VariantDetail } from '@/components/catalog/variant-detail'

function parseId(raw: string): bigint | null {
  return /^\d+$/.test(raw) ? BigInt(raw) : null
}

export async function generateMetadata({
  params,
}: PageProps<'/catalogo/carta/[variantId]'>): Promise<Metadata> {
  const { variantId } = await params
  const id = parseId(variantId)
  if (!id) return { title: 'Carta' }

  try {
    const variant = await getCardVariant(id)
    return { title: `${variant.card.code} — ${variant.card.name}` }
  } catch {
    return { title: 'Carta' }
  }
}

/**
 * Detalhe da variante (telas 13 e 16), **em leitura**.
 *
 * O que falta aqui em relação às telas de referência é tudo o que depende da
 * coleção: quantidade possuída, adicionar, want, disponível para troca, preço.
 * Nada disso existe ainda — são casos de uso de coleção e de preço, dos
 * próximos checkpoints. Botões que não fazem nada seriam pior que a ausência
 * deles.
 *
 * O que existe é o catálogo inteiro da carta: a arte, os dados do jogo, os sets
 * em que foi impressa, e as outras artes do mesmo código.
 */
export default async function CartaPage({ params }: PageProps<'/catalogo/carta/[variantId]'>) {
  const { variantId } = await params
  const id = parseId(variantId)
  if (!id) notFound()

  const variant = await getCardVariant(id).catch((error) => {
    if (isAppError(error) && error.kind === 'NOT_FOUND') notFound()
    throw error
  })

  return (
    <>
      <Link
        href="/catalogo"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Catálogo
      </Link>

      <VariantDetail variant={variant} />
    </>
  )
}
