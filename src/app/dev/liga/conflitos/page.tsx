import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LigaConflictsReview } from '@/components/prices/liga-conflicts-review'
import { EmptyState } from '@/components/ui/states'
import { ligaConflictsAvailable, readLigaConflicts } from '@/server/application/prices/liga-conflicts'

export const metadata: Metadata = {
  title: 'Conflitos entre a Liga e o TCGplayer',
  robots: { index: false, follow: false },
}

// Le arquivos do disco a cada visita: o levantamento muda quando o script roda,
// e o arquivo manual muda a cada gravacao.
export const dynamic = 'force-dynamic'

/**
 * Os vínculos automáticos que discordam do nome que a Liga conferiu (decisão 074).
 *
 * Só fora de produção: grava `data/vinculos-manuais.json`. Sem sessão e fora do
 * shell, como as outras telas de mapeamento.
 */
export default function ConflitosPage() {
  if (!ligaConflictsAvailable()) notFound()

  const { levantamento, respostas } = readLigaConflicts()
  const valor = levantamento?.conflitos.reduce((total, c) => total + (c.vinculado.value ?? 0), 0) ?? 0

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="space-y-1">
        <Link href="/dev/liga" className="text-sm text-accent-ink underline">
          Voltar para a conferência
        </Link>
        <h1 className="text-xl font-semibold text-text">Conflitos entre a Liga e o TCGplayer</h1>
        <p className="text-sm text-text-muted">
          Nestas paralelas, o produto do TCGplayer vinculado hoje não tem o tratamento que a Liga dá à
          arte. Um dos dois está errado. Compare com a arte da Bandai e escolha o produto certo — ou, se
          quem erra é a Liga, corrija a página e mantenha o vínculo de hoje. A escolha vai para{' '}
          <code>data/vinculos-manuais.json</code>, e a importação de preço a aplica.
        </p>
        {levantamento ? (
          <p className="text-xs text-text-subtle">
            {levantamento.conflitos.length} conflitos · US$ {valor.toFixed(0)} em preço hoje
          </p>
        ) : null}
      </header>

      {levantamento ? (
        <LigaConflictsReview conflitos={levantamento.conflitos} respostas={respostas} />
      ) : (
        <EmptyState
          title="O levantamento ainda não foi gerado"
          description="Rode npm run liga:conflitos e recarregue esta página."
        />
      )}
    </main>
  )
}
