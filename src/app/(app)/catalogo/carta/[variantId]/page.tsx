import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { isAppError } from '@/server/domain/errors'
import { getCardVariant } from '@/server/application/catalog'
import { searchCollection } from '@/server/application/collection'
import { listVariantAllocations } from '@/server/application/storage'
import { getWantQuantity } from '@/server/application/wants'
import { getMarketPrice } from '@/server/application/prices'
import { safeReturnTo } from '@/lib/catalog-params'
import { currentViewer } from '@/server/http/viewer'
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
 * Detalhe da variante (telas 13, 15 e 16).
 *
 * A quantidade possuída e o botão de adicionar entram aqui porque sem eles o
 * catálogo não leva a lugar nenhum: dá para navegar o jogo inteiro e não
 * registrar uma carta sequer.
 *
 * O link de volta carrega a lista de onde a pessoa veio, com os filtros. Sem
 * isso, quem filtrou por azul para registrar cinco cartas azuis refazia o filtro
 * cinco vezes — uma vez por carta.
 *
 * Onde as cópias estão guardadas entra logo abaixo, e só para quem tem a carta:
 * é daqui que se guarda pela primeira vez num binder, sem passar pelo
 * armazenamento e procurar a carta de novo.
 *
 * O preço de mercado fica logo acima do link da Liga: quem chega aqui querendo
 * saber quanto vale a carta encontra o número em dólar e, um toque abaixo, o
 * caminho para o preço em real. Ele é lido sem sessão — o valor da carta não
 * depende de quem está olhando.
 *
 * O que ainda não existe: disponível para troca. É caso de uso dos próximos
 * checkpoints, e botão que não faz nada seria pior que a ausência dele.
 */
export default async function CartaPage({
  params,
  searchParams,
}: PageProps<'/catalogo/carta/[variantId]'>) {
  const { variantId } = await params
  const id = parseId(variantId)
  if (!id) notFound()

  // Só caminho relativo entra: um valor absoluto transformaria "voltar" num
  // desvio para fora do site.
  const backHref = safeReturnTo((await searchParams).de, '/catalogo')

  const variant = await getCardVariant(id).catch((error) => {
    if (isAppError(error) && error.kind === 'NOT_FOUND') notFound()
    throw error
  })

  /*
   * Quantas copias a pessoa tem desta variante. A consulta e escopada pela
   * colecao dela; sem sessao, zero — a pagina continua legivel para quem so
   * esta olhando o catalogo.
   */
  const viewer = await currentViewer()
  const owned = viewer
    ? (await searchCollection(viewer, { code: variant.card.code })).items.find(
        (item) => String(item.variantId) === variantId,
      )?.quantity ?? 0
    : 0

  const [allocations, wanted, price] = await Promise.all([
    viewer && owned > 0 ? listVariantAllocations(viewer, id) : undefined,
    viewer ? getWantQuantity(viewer, id) : 0,
    getMarketPrice(id),
  ])

  return (
    <>
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Catálogo
      </Link>

      <VariantDetail
        variant={variant}
        ownedQuantity={owned}
        wantedQuantity={wanted}
        allocations={allocations}
        price={price}
      />
    </>
  )
}
