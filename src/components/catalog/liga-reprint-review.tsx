'use client'

import { useMemo, useState } from 'react'
import { LigaCardForm } from '@/components/catalog/liga-worksheet'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import type { ReprintReviewRow } from '@/server/application/catalog'

/**
 * A revisão das paralelas conferidas como `(Reprint)` que provavelmente são
 * outra versão (`isReprintSuspect`).
 *
 * O filtro no topo separa por set, na ordem do catálogo, com quantas faltam em
 * cada um: a revisão se faz coleção a coleção, como a conferência.
 *
 * A lista vem calculada do servidor. Corrigir o endereço ou confirmar a
 * reimpressão tira a arte dela na volta da gravação — o que sobra é o que falta.
 */

const TODAS = 'todas'

export function LigaReprintReview({ rows }: { rows: ReprintReviewRow[] }) {
  const [set, setSet] = useState<string>(TODAS)

  const sets = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const row of rows) contagem.set(row.setCode, (contagem.get(row.setCode) ?? 0) + 1)
    return [...contagem]
  }, [rows])

  // O set escolhido pode esvaziar depois de a ultima arte dele ser revisada.
  const ativo = set !== TODAS && !sets.some(([code]) => code === set) ? TODAS : set
  const visiveis = ativo === TODAS ? rows : rows.filter((row) => row.setCode === ativo)

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nada para revisar"
        description="Nenhuma paralela conferida como reimpressão está em conflito com a normal."
      />
    )
  }

  return (
    <div className="space-y-4">
      <Segmented<string>
        label="Filtrar por set"
        value={ativo}
        onValueChange={setSet}
        options={[
          { value: TODAS, label: 'Todas', count: rows.length },
          ...sets.map(([code, count]) => ({ value: code, label: code, count })),
        ]}
      />

      <ul className="space-y-3">
        {visiveis.map((row) => (
          <li key={row.sourceId}>
            <LigaCardForm
              row={row}
              setCode={row.setCode}
              review={{
                motivo:
                  `Conferida como reimpressão, mas a normal de ${row.cardCode} já saiu em ` +
                  `${row.normalSets.join(', ')} — a reimpressão igual desse set é a própria normal. ` +
                  'Esta paralela deve ser outra versão.',
                confirmar: { intencao: 'confirmar-reprint', rotulo: 'A reimpressão está certa' },
                tcgProductId: row.tcgProductId,
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
