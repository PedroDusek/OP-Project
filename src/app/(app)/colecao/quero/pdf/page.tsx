import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { WantSheetPrint } from '@/components/wants/want-sheet-print'
import { listWants } from '@/server/application/wants'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Want list em PDF' }

/**
 * A want list em folha, para levar a um grupo local.
 *
 * O PDF sai pela impressão do navegador, e não de um gerador nosso: as imagens
 * de carta são referenciadas na origem e nunca copiadas (decisão 026), e
 * desenhá-las num `canvas` exigiria servi-las pelo nosso domínio. Ver
 * `WantSheetPrint`.
 *
 * Só entra o que **falta**. Uma folha com o que a pessoa já conseguiu faria
 * alguém oferecer carta que ela não quer mais — que é o oposto do motivo de
 * levar a lista.
 */
export default async function WantPdfPage() {
  const viewer = await requireViewer('/colecao/quero/pdf')
  const wants = await listWants(viewer)

  return (
    <>
      <div className="flex items-start gap-3 pb-4 print:hidden">
        <Link
          href="/colecao/quero"
          aria-label="Voltar para a want list"
          className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 pt-2">
          <h1 className="truncate text-2xl font-bold tracking-tight text-text">Want list em PDF</h1>
          <p className="mt-1 text-sm text-text-muted">
            Uma folha com o que falta, para mandar nos grupos.
          </p>
        </div>
      </div>

      <WantSheetPrint wants={wants} />
    </>
  )
}
