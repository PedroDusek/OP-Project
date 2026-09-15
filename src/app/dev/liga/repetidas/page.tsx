import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LigaDuplicateReview } from '@/components/catalog/liga-duplicate-review'
import { ligaMappingAvailable, readDuplicateReview } from '@/server/application/catalog'

export const metadata: Metadata = {
  title: 'Artes repetidas na Liga',
  robots: { index: false, follow: false },
}

// Le a tabela do disco a cada visita: cada gravacao tira arte da lista.
export const dynamic = 'force-dynamic'

/**
 * As artes de uma carta que a Liga deixa indistinguíveis (decisão 073).
 *
 * Só fora de produção, como `/dev/liga`: grava o mesmo arquivo, pela mesma ação.
 */
export default async function ArtesRepetidasPage() {
  if (!ligaMappingAvailable()) notFound()

  const rows = await readDuplicateReview()
  const grupos = new Set(rows.map((row) => `${row.cardCode}|${row.identidade}`)).size

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <header className="space-y-1">
        <Link href="/dev/liga" className="text-sm text-accent-ink underline">
          Voltar para a conferência
        </Link>
        <h1 className="text-xl font-semibold text-text">Artes repetidas na Liga</h1>
        <p className="text-sm text-text-muted">
          Nestas cartas, duas ou mais artes estão na Liga com o mesmo tratamento, ou na mesma
          página. O vínculo com o TCGplayer não tem como saber qual é qual, e nenhuma delas ganha
          preço pela regra. Se uma arte está na página errada, cole a certa; se a Liga não as separa
          mesmo, confirme — o preço delas fica para o mapeamento manual.
        </p>
        <p className="text-xs text-text-subtle">
          {grupos} {grupos === 1 ? 'carta' : 'cartas'}, {rows.length} artes
        </p>
      </header>

      <LigaDuplicateReview rows={rows} />
    </main>
  )
}
