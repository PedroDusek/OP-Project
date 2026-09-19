import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { PremiumNotice } from '@/components/premium/premium-notice'
import { WantSheetPrint } from '@/components/wants/want-sheet-print'
import { isPremium } from '@/server/application/authorization'
import { listWants } from '@/server/application/wants'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Compartilhar a want list' }

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
  const viewer = await requireViewer('/quero/pdf')

  // Decisao 093: a folha e Premium. A tela anterior ja esconde o caminho; isto
  // recusa quem escreve o endereco a mao.
  if (!isPremium(viewer)) {
    return (
      <>
        <PageHeader back={{ href: '/quero', label: 'a want list' }} title="Compartilhar a want list" description="Uma folha com o que falta, para mandar nos grupos." />
        <PremiumNotice
          title="Compartilhar a want list é Premium"
          description="Com o Premium, você gera uma folha com as cartas que faltam, em imagem para mandar nos grupos ou pronta para imprimir."
        />
      </>
    )
  }

  const wants = await listWants(viewer)

  return (
    <>
      <div className="flex items-start gap-3 pb-4 print:hidden">
        <Link
          href="/quero"
          aria-label="Voltar para a want list"
          className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 pt-2">
          <h1 className="truncate text-2xl font-bold tracking-tight text-text">Compartilhar a want list</h1>
          <p className="mt-1 text-sm text-text-muted">
            Uma folha com o que falta, para mandar nos grupos.
          </p>
        </div>
      </div>

      <WantSheetPrint wants={wants} />
    </>
  )
}
