import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LigaReprintReview } from '@/components/catalog/liga-reprint-review'
import { ligaMappingAvailable, readReprintReview } from '@/server/application/catalog'

export const metadata: Metadata = {
  title: 'Revisão das reimpressões',
  robots: { index: false, follow: false },
}

// Le a tabela do disco a cada visita: cada gravacao tira arte da lista.
export const dynamic = 'force-dynamic'

/**
 * As paralelas conferidas na Liga como `(Reprint)` que provavelmente são outra
 * versão — quase sempre a Pirate Foil da PRB-02 (`isReprintSuspect`).
 *
 * Só fora de produção, como `/dev/liga`: grava o mesmo arquivo, pela mesma ação.
 */
export default async function RevisarReimpressoesPage() {
  if (!ligaMappingAvailable()) notFound()

  const rows = await readReprintReview()

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <header className="space-y-1">
        <Link href="/dev/liga" className="text-sm text-accent-ink underline">
          Voltar para a conferência
        </Link>
        <h1 className="text-xl font-semibold text-text">Revisão das reimpressões</h1>
        <p className="text-sm text-text-muted">
          Estas paralelas foram conferidas na Liga como <em>(Reprint)</em>, mas a normal da mesma
          carta já saiu no mesmo set — e reimpressão igual à normal não vira arte nova no catálogo
          (decisão 052). A paralela deve ser outra versão. Abra a Liga, cole o endereço da versão
          certa, ou confirme que a reimpressão estava certa.
        </p>
        <p className="text-xs text-text-subtle">
          {rows.length} {rows.length === 1 ? 'arte falta' : 'artes faltam'}
        </p>
      </header>

      <LigaReprintReview rows={rows} />
    </main>
  )
}
