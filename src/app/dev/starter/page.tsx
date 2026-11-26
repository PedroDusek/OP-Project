import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StarterDecksWorksheetView } from '@/components/catalog/starter-decks-worksheet'
import { readStarterDecksWorksheet, starterDecksAvailable } from '@/server/application/catalog'

export const metadata: Metadata = {
  title: 'Composição dos starter decks',
  robots: { index: false, follow: false },
}

// Le o arquivo da tabela do disco a cada visita: ele muda a cada gravacao.
export const dynamic = 'force-dynamic'

/**
 * Quantas cópias de cada carta vêm em cada starter deck (decisão 116).
 *
 * Só existe fora de produção: grava `data/starter-decks.json`, um arquivo do
 * repositório. Mesmo desenho da conferência da Liga e da tabela dos DON!!, e de
 * propósito — são o mesmo gesto, conhecimento levantado à mão que só chega a
 * produção por PR.
 *
 * O catálogo sabe **quais** cartas saem em cada ST, e nenhuma fonte legível diz
 * **quantas de cada**: a Bandai publica o tamanho e as raridades e avisa que
 * "multiples of one card may appear", sem dizer qual repete.
 */
export default async function StarterDecksPage() {
  if (!starterDecksAvailable()) notFound()

  const worksheet = await readStarterDecksWorksheet()

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-text">Composição dos starter decks</h1>
        <p className="text-sm text-text-muted">
          Quantas cópias de cada carta vêm em cada ST. Abra um deck, preencha as cópias e grave; vai
          para <code>data/starter-decks.json</code> e é o que vai alimentar o &ldquo;Adicionar
          ST&rdquo;. O botão só acende quando as cópias somam <strong>50</strong> — o líder não
          entra na conta, porque é uma cópia de cada líder do produto.
        </p>
        <p className="text-sm text-text-muted">
          <strong>{worksheet.faltam}</strong> de {worksheet.total} decks ainda sem conferir.
        </p>
        <nav aria-label="Outras conferências" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/dev/don" className="text-accent-ink underline">
            Coleções dos DON!!
          </Link>
          <Link href="/dev/liga" className="text-accent-ink underline">
            Conferência da Liga
          </Link>
        </nav>
      </header>

      <StarterDecksWorksheetView worksheet={worksheet} />
    </main>
  )
}
