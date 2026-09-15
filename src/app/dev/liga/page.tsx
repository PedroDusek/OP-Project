import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LigaWorksheetView } from '@/components/catalog/liga-worksheet'
import { ligaMappingAvailable, readLigaWorksheet } from '@/server/application/catalog'
import { isAppError } from '@/server/domain/errors'

export const metadata: Metadata = {
  title: 'Conferência da Liga',
  robots: { index: false, follow: false },
}

// Le o arquivo da tabela do disco a cada visita: ele muda a cada gravacao.
export const dynamic = 'force-dynamic'

/** A primeira coleção conferida, e onde a conferência começa. */
const SET_INICIAL = 'OP01'

/**
 * A conferência das páginas da Liga, coleção a coleção (decisão 071).
 *
 * Só existe fora de produção: grava `data/liga-cartas.json`, um arquivo do
 * repositório. A recusa está também no caso de uso, porque a ação pode ser
 * chamada sem a página. Sem sessão e fora do shell, como `/dev/paralelas`.
 */
export default async function LigaPage({ searchParams }: { searchParams: Promise<{ set?: string }> }) {
  if (!ligaMappingAvailable()) notFound()

  const { set } = await searchParams
  const worksheet = await readLigaWorksheet(set?.trim() || SET_INICIAL).catch((error: unknown) => {
    if (isAppError(error) && error.kind === 'NOT_FOUND') notFound()
    throw error
  })

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-text">Conferência da Liga</h1>
        <p className="text-sm text-text-muted">
          Como a LigaOnePiece cadastrou cada arte desta coleção. Abra a página da carta na Liga, cole o
          endereço ao lado da arte, e ele vai para <code>data/liga-cartas.json</code>. A normal sem
          conferência continua com o link montado; a paralela só vai direto depois de conferida.
        </p>
        <nav aria-label="Revisões" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/dev/liga/revisar" className="text-accent-ink underline">
            Revisar reimpressões
          </Link>
          <Link href="/dev/liga/repetidas" className="text-accent-ink underline">
            Revisar artes repetidas
          </Link>
        </nav>
      </header>

      <LigaWorksheetView worksheet={worksheet} />
    </main>
  )
}
