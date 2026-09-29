import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DonSetsWorksheetView } from '@/components/catalog/don-sets-worksheet'
import { donSetsAvailable, readDonSetsWorksheet } from '@/server/application/catalog'

export const metadata: Metadata = {
  title: 'Coleções dos DON!!',
  robots: { index: false, follow: false },
}

// Le o arquivo da tabela do disco a cada visita: ele muda a cada gravacao.
export const dynamic = 'force-dynamic'

/**
 * Em que coleção cada DON!! saiu (decisão 112).
 *
 * Só existe fora de produção: grava `data/don-sets.json`, um arquivo do
 * repositório. Mesmo desenho da conferência da Liga, e de propósito — são o
 * mesmo gesto, conhecimento levantado à mão que só chega a produção por PR.
 *
 * Os DON!! são lançados junto das coleções, e o dono do produto quer vê-los
 * nelas. O tcgcsv não diz qual é: os grupos de lá não são as nossas coleções.
 */
export default async function DonSetsPage() {
  if (!donSetsAvailable()) notFound()

  const worksheet = await readDonSetsWorksheet()

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-text">Coleções dos DON!!</h1>
        <p className="text-sm text-text-muted">
          Em que coleção cada DON!! saiu. Marque as coleções da arte e grave; vai para{' '}
          <code>data/don-sets.json</code> e é aplicado na próxima importação dos DON!!. Toda arte já
          está no set <code>DON</code>, que não aparece aqui porque não é escolha.
        </p>
        <nav aria-label="Outras conferências" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/dev/liga?set=DON" className="text-accent-ink underline">
            Conferir os DON!! na Liga
          </Link>
        </nav>
      </header>

      <DonSetsWorksheetView worksheet={worksheet} />
    </main>
  )
}
